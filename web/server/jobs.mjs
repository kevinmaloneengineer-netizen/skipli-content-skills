import { randomUUID } from "node:crypto";
import { directEnabled, runSkill } from "./llm.mjs";
import { directSkill } from "./prompts.mjs";

export const ACTIVE = new Set(["queued", "running"]);

/**
 * FIFO job runner. Concurrency defaults to 1: scans share one Chrome sidecar
 * and one Facebook session, and free-tier model quotas punish bursts.
 */
/** @param {{ prepare?: (job, ctx: { setPhase, signal }) => Promise<{ prompt: string, notice?: string }> }} opts */
/** finish(job, content, ctx) may post-process the agent answer (e.g. render a video) → { result, fields } or null. */
export function createJobRunner({ store, goclaw, agents, concurrency, timeoutMs, prepare = async (job) => ({ prompt: job.prompt }), finish = async () => null, log = console }) {
  const queue = [];
  const running = new Map(); // id -> AbortController

  async function recover() {
    // A restart kills in-flight HTTP calls to GoClaw; they cannot be resumed.
    for (const job of store.listJobs()) {
      if (job.status === "running") {
        await store.updateJob(job.id, { status: "failed", error: "Bị gián đoạn do server khởi động lại. Hãy chạy lại.", finishedAt: new Date().toISOString() });
      }
    }
    const queued = store.listJobs().filter((j) => j.status === "queued").reverse(); // oldest first
    queue.push(...queued.map((j) => j.id));
    pump();
  }

  function pump() {
    while (running.size < concurrency && queue.length) {
      const id = queue.shift();
      const job = store.cachedJob(id);
      if (!job || job.status !== "queued") continue;
      execute(job).catch((e) => log.error(`job ${id}: could not record state:`, e.message));
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
      const { prompt, notice, fields, direct } = await prepare(job, { setPhase, signal: ctrl.signal });
      if (ctrl.signal.aborted) throw new Error("canceled");
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
    } finally {
      running.delete(job.id);
      pump();
    }
  }

  return {
    recover,

    async submit({ type, agent, direct = null, title, input, prompt, userId }) {
      const job = {
        id: randomUUID(),
        ...(userId ? { userId } : {}), // owner, with customer accounts on
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
      }
      return true;
    },

    position(id) {
      const i = queue.indexOf(id);
      return i < 0 ? null : i + 1;
    },
  };
}
