import { randomUUID } from "node:crypto";
import { directEnabled, runSkill } from "./llm.mjs";
import { directSkill } from "./prompts.mjs";

export const ACTIVE = new Set(["queued", "running"]);

const REPORT_TYPES = new Set(["fb-reels", "threads", "tiktok", "maps", "yelp", "instagram", "fanpage", "compare"]);
const ENGLISH_REPORT = "LANGUAGE: write the report in natural US English. Keep in Vietnamese ONLY the structure the app reads: the section headings (\"## Tổng quan\", \"## Khách khen gì\"…), the table header rows (\"| Điểm khen | Số bài nhắc |\"), star markers like \"(5 sao)\" and labels like \"- Vì sao viral:\". Everything else is English: every table row, every bullet, every sentence (the first sentence of Tổng quan may keep the template wording with the numbers). Quotes keep their original language.";

/**
 * FIFO job runner. Concurrency defaults to 1: scans share one Chrome sidecar
 * and one Facebook session, and free-tier model quotas punish bursts.
 */
/** @param {{ prepare?: (job, ctx: { setPhase, signal }) => Promise<{ prompt: string, notice?: string }> }} opts */
/** finish(job, content, ctx) may post-process the agent answer (e.g. render a video) → { result, fields } or null. */
/** onEnd(job) runs after a job failed or was canceled (e.g. to give its credits back). */
/**
 * Lanes (when `lanes` is set): writing jobs take a few seconds on the model and run side by side;
 * scans share one Chrome sidecar and one Apify account, and image / video jobs share the one GPU,
 * so those run one at a time each, without making the quick jobs wait behind them.
 */
const SCAN_TYPES = new Set(["fb-reels", "threads", "tiktok", "maps", "yelp", "instagram", "fanpage", "compare", "clone", "campaign", "watch"]);
export const laneOf = (job) => (job.type === "image" || job.type === "video" ? "gpu" : SCAN_TYPES.has(job.type) ? "scan" : "light");

export function createJobRunner({ store, goclaw, agents, concurrency, lanes = null, timeoutMs, prepare = async (job) => ({ prompt: job.prompt }), finish = async () => null, onEnd = async () => {}, log = console }) {
  const queue = [];
  const running = new Map(); // id -> AbortController
  let stopping = false; // shutting down: no new job starts
  // A combo only waits for the jobs it starts: it has its own lane, so it never takes their place.
  // Laying reviewed photos out as a video (renderOnly: "Dựng video", "Đổi mẫu") needs no GPU: its own lane too.
  const lane = (job) => (job.type === "combo" ? "combo" : job.renderOnly ? "render" : lanes ? laneOf(job) : "all");
  const limit = (name) => (name === "combo" ? 20 : name === "render" ? 2 : lanes ? lanes[name] ?? 1 : concurrency);
  const ended = async (id) => {
    const job = store.cachedJob(id);
    if (job) await onEnd(job).catch((e) => log.error(`job ${id}: onEnd:`, e.message));
  };
  const busy = (name) => [...running.keys()].filter((id) => lane(store.cachedJob(id) ?? {}) === name).length;

  async function recover() {
    // A restart kills in-flight calls; such a job starts over from the beginning once (it keeps the
    // credits it took). Interrupted a second time, it is marked failed and gives them back.
    for (const job of store.listJobs()) {
      if (job.status !== "running") continue;
      const restarts = (job.restarts ?? 0) + 1;
      if (restarts <= 1) {
        await store.updateJob(job.id, { status: "queued", restarts, startedAt: null, phase: "Server vừa khởi động lại, đang chạy lại từ đầu…" });
        log.warn?.(`job ${job.id}: interrupted by a restart, queued again`);
      } else {
        await store.updateJob(job.id, { status: "failed", error: "Bị gián đoạn do server khởi động lại. Hãy chạy lại.", finishedAt: new Date().toISOString() });
        await ended(job.id);
      }
    }
    const queued = store.listJobs().filter((j) => j.status === "queued").reverse(); // oldest first
    queue.push(...queued.map((j) => j.id));
    pump();
  }

  function pump() {
    if (stopping) return;
    // Oldest first within each lane; a full lane does not hold back the others.
    for (let i = 0; i < queue.length; ) {
      const job = store.cachedJob(queue[i]);
      if (!job || job.status !== "queued") {
        queue.splice(i, 1);
        continue;
      }
      const name = lane(job);
      if (busy(name) >= limit(name)) {
        i++;
        continue;
      }
      queue.splice(i, 1);
      execute(job).catch((e) => log.error(`job ${job.id}: could not record state:`, e.message));
    }
  }

  async function execute(job) {
    const ctrl = new AbortController();
    running.set(job.id, ctrl);
    await store.updateJob(job.id, { status: "running", startedAt: new Date().toISOString(), phase: null });
    try {
      // Server-side groundwork (e.g. fetching the 100-reel list) before the agent run.
      // phases: what the job has done so far, for the live step list. "AI đã xem 2/3" replaces "1/3".
      const phases = [];
      const setPhase = (phase) => {
        const shape = (t) => String(t).replace(/\d+/g, "#");
        const step = { text: phase, at: new Date().toISOString() };
        if (phases.length && shape(phases.at(-1).text) === shape(phase)) phases[phases.length - 1] = { ...step, at: phases.at(-1).at };
        else phases.push(step);
        return store.updateJob(job.id, { phase, phases: phases.slice(-20) });
      };
      const prepared = await prepare(job, { setPhase, signal: ctrl.signal });
      if (ctrl.signal.aborted) throw new Error("canceled");
      // Work done entirely on this server (e.g. a photo fix): no model call.
      if (prepared.done) {
        await store.updateJob(job.id, { status: "done", result: prepared.done.result, ...prepared.done.fields, phase: null, finishedAt: new Date().toISOString() });
        return;
      }
      let { prompt, notice, fields, direct } = prepared;
      // English interface: reports in English, with the template's Vietnamese headings kept (the result
      // views read them; the interface shows them in English).
      if (job.input?.uiLang === "en" && REPORT_TYPES.has(job.type)) {
        prompt = `${prompt.replace(/,? bằng tiếng Việt/g, "").replace(/Trả lời bằng tiếng Việt\.?/g, "")}\n\n${ENGLISH_REPORT}`;
      }
      await store.updateJob(job.id, { prompt, notice: notice ?? null, ...fields }); // fields: data the result page draws (e.g. the Maps scorecard)
      // Jobs that need no tools run straight on the model when a key is set (much cheaper than an agent run).
      // Scan jobs whose data the server collected itself (prepare → direct) also skip the agent.
      const skill = direct?.skill ?? directSkill(job);
      const { content, usage, meta } =
        skill && directEnabled() && !goclaw.mock
          ? await runSkill({ skill, from: direct?.from, prompt, signal: ctrl.signal })
          : await goclaw.run({ agent: agents[job.agent], kind: job.type, prompt, timeoutMs, signal: ctrl.signal });
      const extra = await finish(job, content, { setPhase, signal: ctrl.signal });
      // llm: which engine answered and how many model calls it took (rate limits show up as tries > 1).
      const llm = meta ? { engine: "groq", ...meta } : { engine: "goclaw" };
      await store.updateJob(job.id, { status: "done", result: extra?.result ?? content, usage, llm, ...extra?.fields, phase: null, finishedAt: new Date().toISOString() });
    } catch (e) {
      const canceled = ctrl.signal.aborted;
      if (!canceled) log.error(`job ${job.id} failed:`, e.message);
      await store.updateJob(job.id, {
        status: canceled ? "canceled" : "failed",
        error: canceled ? null : e.message,
        phase: null,
        finishedAt: new Date().toISOString(),
      });
      await ended(job.id);
    } finally {
      running.delete(job.id);
      pump();
    }
  }

  return {
    recover,

    /** Shutdown: start nothing new and wait (up to timeoutMs) for the running jobs; returns how many are left. */
    async drain(timeoutMs) {
      stopping = true;
      const end = Date.now() + timeoutMs;
      while (running.size && Date.now() < end) await new Promise((r) => setTimeout(r, 500));
      return running.size;
    },

    /** extra: fields the job starts with (e.g. a restyle's slides, draft and renderOnly). */
    async submit({ type, agent, direct = null, title, input, prompt, userId, credits = null, extra = {} }) {
      const job = {
        ...extra,
        id: randomUUID(),
        ...(userId ? { userId } : {}), // owner, with customer accounts on
        ...(credits ? { credits } : {}), // credits this run took (given back if it fails)
        type,
        agent,
        direct,
        title,
        input,
        prompt,
        status: "queued",
        result: null,
        error: null,
        usage: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      };
      await store.addJob(job);
      queue.push(job.id);
      pump();
      return job;
    },

    /** Queue a job that is already stored (set to "queued" by the caller), e.g. a reviewed slideshow to render. */
    requeue(id) {
      if (!queue.includes(id)) queue.push(id);
      pump();
    },

    /** Cancel a queued or running job. Aborting the HTTP call also stops the GoClaw run. */
    async cancel(id) {
      const job = store.cachedJob(id);
      if (!job || !ACTIVE.has(job.status)) return false;
      const ctrl = running.get(id);
      if (ctrl) {
        ctrl.abort();
      } else {
        const i = queue.indexOf(id);
        if (i >= 0) queue.splice(i, 1);
        await store.updateJob(id, { status: "canceled", finishedAt: new Date().toISOString() });
        await ended(id);
      }
      return true;
    },

    /** Place in its own lane's queue (1 = next). */
    position(id) {
      const i = queue.indexOf(id);
      if (i < 0) return null;
      const name = lane(store.cachedJob(id) ?? {});
      return queue.slice(0, i + 1).filter((q) => lane(store.cachedJob(q) ?? {}) === name).length;
    },
  };
}
