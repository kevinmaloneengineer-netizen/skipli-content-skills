import express from "express";
import compression from "compression";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { WEB_ROOT } from "./config.mjs";
import { createGoclawClient } from "./goclaw.mjs";
import { createJobRunner, ACTIVE } from "./jobs.mjs";
import { createPreparer } from "./prepare.mjs";
import { createFacebookSource } from "./sources/facebook.mjs";
import { cleanTexts } from "../shared/templateTexts.js";
import { isMapsLink, MapLinkError, placeFromLink } from "./sources/osm.mjs";
import { buildJob, cleanHashtags, InputError, OFFER_TEMPLATES, parseDishes, SLIDE_TEMPLATES } from "./prompts.mjs";
import { placesEnabled } from "./sources/places.mjs";
import { CHECKED_TYPES, checkFacts, englishBlanks } from "./facts.mjs";
import { reviewsIn, verifyQuotes } from "./quotes.mjs";
import { complete, directEnabled, fixDashes } from "./llm.mjs";
import { sampleReply } from "./mock.mjs";
import { createWatcher } from "./watcher.mjs";
import { competitorsOf } from "./competitors.mjs";
import { makeClip } from "./watch.mjs";
import { createLimits } from "./limits.mjs";
import { pageConfigured, publishToPage } from "./facebookPage.mjs";
import { openStore } from "./store/index.mjs";
import { AccountError, createAccounts, publicUser } from "./accounts.mjs";
import { BillingError, createBilling } from "./billing.mjs";
import { createMailer } from "./mailer.mjs";
import { createErrorLog } from "./errors.mjs";
import { runBackup } from "./backup.mjs";
import { parsePacks } from "./billing.mjs";
import { RECIPES, buildCombo, comboCost } from "./combos.mjs";
import { askDirect, extractAction, systemPrompt } from "./assistant.mjs";
import { createVideoService, VideoError } from "./video.mjs";
import { ClipError, createClipper } from "./clipper.mjs";
import { dashboard } from "./dashboard.mjs";
import { moneyStats } from "./stats.mjs";
import { cleanUploads, createStorage, filesOf } from "./storage.mjs";
import { SEED_TEMPLATES } from "./seed-templates.mjs";
import { readMenu } from "./vision.mjs";
import { promoReport } from "./promo.mjs";
import { detectMapping, MAX_SALES_BYTES, readSheet, salesStats, statsText } from "./sales.mjs";
import { cleanOccasions } from "./usDays.mjs";

const CLIENT_DIST = path.join(WEB_ROOT, "client", "dist");
const LIBRARY_KINDS = new Set(["template", "saved"]);

const vnDay = (iso) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const SESSION_COOKIE = "skipli_session";
// Shared results (/s/<token>): the viewer has no account; this cookie (path /media) lets the result's
// pictures and videos load. It holds the last few share tokens opened in this browser.
const SHARE_COOKIE = "skipli_share";
const MAX_SHARE_TOKENS = 5;
/** "<job id>.<secret>" → { id, secret }, or null. */
const parseShare = (token) => {
  const m = String(token ?? "").match(/^([0-9a-f-]{36})\.([\w-]{20,40})$/);
  return m ? { id: m[1], secret: m[2] } : null;
};
// What a shared result shows: the result and the data its view draws, never the owner, the prompt or the costs.
const PRIVATE_FIELDS = ["userId", "prompt", "credits", "refunded", "usage", "llm", "error", "share", "phases", "notice", "agent", "direct"];
const SESSION_DAYS = 30;
/** Session token: derived from the password, so changing APP_PASSWORD logs everyone out. */
const sessionToken = (password) => createHmac("sha256", password).update("skipli-content-session").digest("hex");
const same = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const cookieOf = (req, name) => (req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === name)?.[1] ?? "";

/**
 * APP_PASSWORD gate: the login page sets a session cookie; scripts can still send Basic auth.
 * The React app itself (index.html, assets) loads without it so the login page can render;
 * every /api call and media file needs the session.
 */
function passwordGate(password) {
  const token = password ? sessionToken(password) : "";
  const signedIn = (req) => {
    if (!password) return true;
    if (same(cookieOf(req, SESSION_COOKIE), token)) return true;
    const [scheme, value] = (req.headers.authorization ?? "").split(" ");
    const pass = scheme === "Basic" && value ? Buffer.from(value, "base64").toString("utf8").split(":").slice(1).join(":") : "";
    return same(pass, password);
  };
  const attempts = new Map(); // ip → failed login timestamps
  return {
    signedIn,
    middleware(req, res, next) {
      if (signedIn(req)) return next();
      const open = req.path === "/api/login" || req.path === "/api/session" || req.path === "/api/client-error" || (req.method === "GET" && /^\/api\/(samples|public)\//.test(req.path)) || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/")) || (req.method === "GET" && req.path.startsWith("/media/") && !!req.sharedJobs);
      if (open) return next();
      if (req.path.startsWith("/api/")) return res.status(401).set("Cache-Control", "no-store").json({ error: "Cần đăng nhập", auth: true });
      res.status(401).send("Cần đăng nhập");
    },
    login(req, res) {
      const ip = req.ip ?? "?";
      const recent = (attempts.get(ip) ?? []).filter((t) => Date.now() - t < 15 * 60_000);
      if (recent.length >= 10) return res.status(429).json({ error: "Sai mật khẩu nhiều lần, thử lại sau 15 phút." });
      const pass = typeof req.body?.password === "string" ? req.body.password : "";
      if (!password || !same(pass, password)) {
        attempts.set(ip, [...recent, Date.now()]);
        return res.status(401).json({ error: "Sai mật khẩu" });
      }
      attempts.delete(ip);
      const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      res.set("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure}`).json({ ok: true });
    },
    logout(req, res) {
      res.set("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`).json({ ok: true });
    },
  };
}

/** Job without the heavy fields, for lists. */
function summary(job, runner) {
  const { prompt, result, researchTable, ...rest } = job;
  return { ...rest, queuePosition: job.status === "queued" ? runner.position(job.id) : null };
}

// What a job page loads on its own (/jobs/:id) and the polled list never reads: 200 jobs with these came
// to about 545 KB, fetched every 2.5 s while a job runs.
const DETAIL_FIELDS = ["video", "images", "photos", "draft", "slides", "usage", "llm", "phases", "watch", "lowReviews", "igPosts", "compare", "learned", "steps", "clips", "place", "nearby", "factCheck", "quotesFixed", "igName"];

/** A row of the polled job list: the summary, short input values only, and the row's thumbnail. */
export function listItem(job, runner) {
  const row = summary(job, runner);
  for (const k of DETAIL_FIELDS) delete row[k];
  // Long inputs (dish lists, pasted posts) are only read on the job page; names and links stay for the rows.
  row.input = Object.fromEntries(Object.entries(job.input ?? {}).filter(([, v]) => (typeof v === "string" ? v.length <= 300 : typeof v === "number" || typeof v === "boolean")));
  row.thumb = job.photos?.items?.[0]?.file ?? job.images?.items?.[0]?.file ?? job.video?.shots?.find((s) => s.image)?.image ?? job.slides?.find((s) => s.image)?.image ?? null;
  return row;
}

function libraryFields(body, partial = false) {
  const out = {};
  if (!partial || body.kind !== undefined) {
    if (!LIBRARY_KINDS.has(body.kind)) throw new HttpError(400, "kind phải là template hoặc saved");
    out.kind = body.kind;
  }
  for (const [field, max, required] of [["title", 200, true], ["body", 20_000, true], ["platform", 20, false]]) {
    if (partial && body[field] === undefined) continue;
    const v = typeof body[field] === "string" ? body[field].trim() : "";
    if (required && !v) throw new HttpError(400, `Thiếu ${field}`);
    if (v.length > max) throw new HttpError(400, `${field} dài quá ${max} ký tự`);
    out[field] = v;
  }
  if (!partial || body.tags !== undefined) {
    const tags = Array.isArray(body.tags) ? body.tags : String(body.tags ?? "").split(",");
    out.tags = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
  }
  if (!partial && typeof body.sourceJobId === "string") out.sourceJobId = body.sourceJobId;
  return out;
}

function nextMondayYmd() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

const SLOT_PLATFORMS = new Set(["facebook", "threads", "tiktok", "instagram"]);
// Market research reports: a table counted by the code, then the model's reading (research.mjs).
const RESEARCH_TYPES = new Set(["nearby", "review-compare", "trends"]);
function slotFields(body, partial = false) {
  const out = {};
  const text = (field, max, required) => {
    if (partial && body[field] === undefined) return;
    const v = typeof body[field] === "string" ? body[field].trim() : "";
    if (required && !v) throw new HttpError(400, `Thiếu ${field === "title" ? "tiêu đề" : "nội dung"}`);
    if (v.length > max) throw new HttpError(400, `${field} dài quá ${max} ký tự`);
    out[field] = v;
  };
  text("title", 200, true);
  text("body", 20_000, false);
  text("note", 500, false);
  if (!partial || body.at !== undefined) {
    const at = new Date(body.at);
    if (Number.isNaN(at.getTime())) throw new HttpError(400, "Ngày giờ đăng không hợp lệ");
    out.at = at.toISOString();
  }
  if (!partial || body.platform !== undefined) {
    if (!SLOT_PLATFORMS.has(body.platform)) throw new HttpError(400, "Nền tảng không hợp lệ");
    out.platform = body.platform;
  }
  if (body.status !== undefined) {
    if (!["planned", "posted", "scheduled"].includes(body.status)) throw new HttpError(400, "Trạng thái không hợp lệ");
    out.status = body.status;
  }
  for (const k of ["pillar", "libraryId", "sourceJobId"]) if (!partial && typeof body[k] === "string") out[k] = body[k].slice(0, 60);
  return out;
}

/**
 * @param {object} config   see ./config.mjs
 * @param {object} adapter  persistence adapter (./store/firestore.mjs or ./store/memory.mjs)
 */
export async function createApp(config, adapter) {
  const store = await openStore(adapter, { templates: SEED_TEMPLATES });
  // ACCOUNTS=1: one login per customer, each sees only their own data (see ./accounts.mjs).
  // SIGNUP=1: customers make their own account with trial credits and top up through Stripe (./billing.mjs).
  const billing = createBilling({ store, env: config.billingEnv ?? process.env, fetchFn: config.fetchFn });
  const mailer = config.mailer ?? createMailer(config.mailEnv ?? process.env); // sign-up and password codes
  // Sign-up rules read live, so the admin's settings page applies without a restart.
  const signupRules = {
    mailer,
    get credits() {
      return billing.trial;
    },
    get perIp() {
      return store.getSettings().signupPerIp ?? config.signupPerIp ?? 0;
    },
  };
  const errors = createErrorLog({ store, env: config.errorEnv ?? process.env, fetchFn: config.fetchFn });
  const accounts = config.accounts ? createAccounts({ store, dataDir: config.video?.dataDir ?? path.join(tmpdir(), `skipli-accounts-${process.pid}`), signup: config.signup ? signupRules : null }) : null;
  if (config.signup && accounts && !mailer.enabled) console.warn("signup: SMTP_USER / SMTP_PASS not set (and no MAIL_LOG=1), new accounts skip the email code.");
  if (accounts) {
    await accounts.bootstrap();
    // Unconfirmed accounts from before sign-ups waited for the code: removed after a day.
    const stale = () => accounts.removeStale().then((n) => n && console.log(`accounts: removed ${n} unconfirmed sign-up(s)`)).catch(() => {});
    stale();
    setInterval(stale, 3600_000).unref();
  }
  /** Is this record the signed-in customer's? (always true without accounts) */
  const own = (req, item) => !accounts || accounts.ownerId(item) === req.user?.id;
  const userId = (req) => (accounts ? req.user?.id ?? null : undefined);
  const goclaw = createGoclawClient(config.goclaw);
  const facebook = createFacebookSource(config.facebook);
  // Tests build a config without `video`: keep their files out of the repo.
  const video = createVideoService(config.video ?? { dataDir: path.join(tmpdir(), `skipli-video-${process.pid}`), timeoutMs: 60_000, mock: config.goclaw.mock });
  const videoRoot = config.video?.dataDir ?? path.join(tmpdir(), `skipli-video-${process.pid}`);
  const clipper = createClipper({ dir: path.join(videoRoot, "uploads"), outDir: path.join(videoRoot, "videos") });
  await video.init();
  const clipsDir = path.join(config.video?.dataDir ?? path.join(tmpdir(), `skipli-clips-${process.pid}`), "clips"); // watched videos, for playback
  // Clips older than CLIP_KEEP_DAYS are removed daily; an old report re-downloads one when it is played.
  const sweepClips = async () => {
    const maxAge = (Number(process.env.CLIP_KEEP_DAYS) || 30) * 86_400_000;
    const { readdir, stat: statFile, unlink } = await import("node:fs/promises");
    for (const name of await readdir(clipsDir).catch(() => [])) {
      const file = path.join(clipsDir, name);
      const info = await statFile(file).catch(() => null);
      if (info && Date.now() - info.mtimeMs > maxAge) await unlink(file).catch(() => {});
    }
  };
  if (!config.goclaw.mock) setInterval(sweepClips, 86_400_000).unref();
  // Finished files go to object storage (R2) when it is set up; the disk stays the working copy.
  const storage = createStorage();
  const localOf = (key) => path.join(videoRoot, key); // keys are "videos/…", "images/…", "uploads/…"
  async function publish(keys) {
    if (!storage.remote) return;
    for (const key of keys) {
      if (!existsSync(localOf(key))) continue;
      await storage.put(key, localOf(key)).catch((e) => console.error(`storage: ${key}: ${e.message}`));
    }
  }
  /** After a job (or a render, redraw, replace) wrote its files: copy them up, then hand the result on. */
  async function publishAfter(job, out) {
    await publish(filesOf({ ...job, ...(out?.fields ?? {}) }));
    return out;
  }
  /** An upload another server took (or this disk lost): fetch it back before a job needs it. */
  async function ensureUploads(input = {}) {
    if (!storage.remote) return;
    const ids = [input.referenceImageId, input.logoId, input.videoId, input.audioId, input.photoId, ...(input.photoIds ?? []), ...(input.panelIds ?? [])].filter((x) => typeof x === "string" && /^[0-9a-f-]{36}\.\w{3,4}$/.test(x));
    for (const id of ids) if (!existsSync(localOf(`uploads/${id}`))) await storage.get(`uploads/${id}`, localOf(`uploads/${id}`)).catch(() => false);
  }
  // Uploads are kept 7 days (UPLOAD_KEEP_DAYS): cleaned at start, then once a day.
  const keepDays = Number(process.env.UPLOAD_KEEP_DAYS) || 7;
  const sweep = () => cleanUploads({ storage, dir: localOf("uploads"), days: keepDays })
    .then((n) => n && console.log(`storage: removed ${n} uploads older than ${keepDays} days`))
    .catch((e) => console.error(`storage: cleaning uploads failed: ${e.message}`));
  if (!config.goclaw?.mock || storage.remote) {
    sweep();
    setInterval(sweep, 24 * 3600_000).unref();
  }
  // Daily database backup to the bucket (BACKUP_KEEP_DAYS, 14): first one a minute after start, then every 24 h.
  const backupKeep = Number(process.env.BACKUP_KEEP_DAYS) || 14;
  const backupNow = () => runBackup({ store, storage, dir: path.join(videoRoot, "backups"), keepDays: backupKeep });
  if (storage.remote && !config.goclaw?.mock && process.env.BACKUP_DISABLED !== "1") {
    const daily = () => backupNow()
      .then((b) => console.log(`backup: ${b.key} (${Math.round(b.bytes / 1024)} KB), removed ${b.removed} old`))
      .catch((e) => {
        console.error(`backup failed: ${e.message}`);
        errors.record({ source: "backup", message: e.message });
      });
    setTimeout(daily, 60_000).unref();
    setInterval(daily, 24 * 3600_000).unref();
  }
  /** Send the viewer to the stored copy when this server does not have the file. */
  const fromStorage = (res, key) => (storage.remote ? res.redirect(302, storage.url(key)) : res.status(404).send("Không tìm thấy file"));

  async function finishContent(job, content, ctx) {
    if (job.input?.lang === "en") content = englishBlanks(content);
    // The fanpage report template says "reel"; most Instagram posts are photos and albums.
    if (job.type === "instagram") content = content.replace(/(?<![/#@]\s?)\b(R|r)eels?\b/g, (w, r) => (r === "R" ? "Bài" : "bài"));
    if (job.type === "hashtag") return { result: cleanHashtags(content, job.input) };
    // The money of each promotion is worked out here from the owner's prices, never taken from the model.
    if (job.type === "promo-plan") return { result: promoReport(content, job.input) };
    // Offers the shop never chose are taken out of the posts; unknown ingredients are flagged (usDays.mjs).
    if (job.type === "us-occasions") content = cleanOccasions(content, job.input?.serves);
    if (job.type === "reel-cut") return clipper.finishReels(job, content, ctx);
    if (job.type === "live-recap") return clipper.finishRecap(job, content, ctx);
    if (job.type === "dub") return clipper.finishDub(job, content, ctx);
    if (RESEARCH_TYPES.has(job.type)) {
      // The table the code counted goes on top; the model's reading follows (with its quotes checked).
      const { text, fixed } = job.type === "review-compare" ? verifyQuotes(content, reviewsIn(job.prompt)) : { text: content, fixed: 0 };
      return { result: job.researchTable ? `${job.researchTable}\n\n${text}` : text, fields: { quotesFixed: fixed } };
    }
    if (job.type === "maps" || job.type === "yelp") {
      // Quotes must be word for word: a trimmed or reworded one is replaced by the review's own words.
      const { text, fixed } = verifyQuotes(content, reviewsIn(job.prompt));
      return { result: text, fields: { quotesFixed: fixed } };
    }
    if (CHECKED_TYPES.has(job.type)) {
      // Prices, discounts, hours the user never gave → placeholders; gifts → warnings shown on the result page.
      const { text, replaced, warnings } = checkFacts(content, Object.values(job.input ?? {}).filter((v) => typeof v === "string").join("\n")); // what the user typed, not our prompt wording
      return { result: text, fields: { factCheck: { replaced, warnings } } };
    }
    return (await video.finish(job, content, ctx)) ?? { result: content }; // content may have been edited above
  }

  const prepareJob = createPreparer({ facebook, mock: goclaw.mock, clipsDir, clipper, uploadsDir: path.join(videoRoot, "uploads") });
  const runner = createJobRunner({ store, goclaw, agents: config.agents, ...config.jobs,
    // A photo fix runs on this server only (no model); its files go to storage like a video's.
    prepare: async (job, ctx) => {
      if (job.type === "photo-fix") return { done: await publishAfter(job, await video.fixPhoto(job, ctx)) };
      // Reviewed photos (or a finished video's, for "Đổi mẫu") laid out as the video: nothing is drawn again.
      if (job.type === "video" && job.renderOnly) return { done: await publishAfter(job, await video.renderSlides(job, job.slides, job.draft ?? "", ctx.setPhase)) };
      if (job.type === "combo") return { done: await runCombo(job, ctx) };
      return prepareJob(job, ctx);
    },
    finish: async (job, content, ctx) => publishAfter(job, await finishContent(job, content, ctx)),
    // A failed or canceled run gives its credits back; a failure also goes to the error log.
    onEnd: async (job) => {
      await billing.refund(job);
      if (job.status === "failed") await errors.record({ source: "job", type: job.type, message: job.error ?? "Tác vụ lỗi", jobId: job.id, userId: job.userId });
    },
  });
  await runner.recover();

  /**
   * A combo ("Gói chạy liền"): its steps, one after another, as ordinary jobs of the same owner. Each step
   * takes its credits when it starts; a step whose input needs a failed step is skipped. After a restart
   * it carries on from the steps it already started (their ids are kept on the combo job).
   */
  async function runCombo(job, { setPhase, signal }) {
    const recipe = RECIPES[job.input?.recipe];
    if (!recipe) throw new Error("Gói không hợp lệ");
    const steps = recipe.steps.map((def, i) => ({ type: def.type, title: def.title, status: "waiting", ...(job.steps?.[i] ?? {}) }));
    const save = () => store.updateJob(job.id, { steps: steps.map((s) => ({ ...s })) });
    const over = (s) => ["done", "failed", "canceled"].includes(s);
    const ctx = { input: job.input, steps: [], photoIds: [] };
    const jobOf = async (id) => (id ? store.cachedJob(id) ?? (await store.getJob(id)) : null);
    for (let i = 0; i < recipe.steps.length; i++) {
      if (signal.aborted) throw new Error("canceled");
      const def = recipe.steps[i];
      const st = steps[i];
      if (["done", "failed", "skipped"].includes(st.status)) continue; // finished before a restart
      await setPhase(`Bước ${i + 1}/${steps.length}: ${def.title}…`);
      if (!st.jobId) {
        ctx.steps = await Promise.all(steps.map(async (s) => ({ status: s.status, job: await jobOf(s.jobId) })));
        if ((def.needs ?? []).some((k) => steps[k].status !== "done")) {
          Object.assign(st, { status: "skipped", error: "Bước trước chưa xong nên bỏ qua bước này" });
          await save();
          continue;
        }
        try {
          if (def.type === "video" && ctx.steps[0].job?.photos?.fixed) {
            const id = await video.importImage(ctx.steps[0].job.photos.fixed);
            await publish([`uploads/${id}`]);
            ctx.photoIds = [id];
          }
          const input = def.input(ctx);
          if (!input) {
            Object.assign(st, { status: "skipped", error: "Không có gì để làm ở bước này" });
            await save();
            continue;
          }
          const spec = await jobSpec(def.type, input);
          if (job.input?.uiLang === "en") spec.input = { ...spec.input, uiLang: "en" };
          const owner = job.userId ? store.getUser(job.userId) : null;
          const credits = await billingCall(() => billing.charge(owner, def.type));
          const child = await runner.submit({ type: def.type, ...spec, userId: job.userId, credits });
          Object.assign(st, { jobId: child.id, status: child.status, credits: credits ?? 0 });
          await save();
        } catch (e) {
          Object.assign(st, { status: "failed", error: e.message });
          await save();
          continue;
        }
      }
      // Wait for the step, mirroring its status on the combo for the page.
      for (;;) {
        const child = await jobOf(st.jobId);
        const status = child?.status ?? "failed";
        if (status !== st.status) {
          Object.assign(st, { status: over(status) ? (status === "done" ? "done" : "failed") : status, ...(child?.error ? { error: child.error } : {}) });
          await save();
        }
        if (over(status) || !child) break;
        try {
          await sleep(1500, undefined, { signal });
        } catch {
          await runner.cancel(st.jobId).catch(() => {});
          throw new Error("canceled");
        }
      }
    }
    const ok = steps.filter((s) => s.status === "done").length;
    if (!ok) throw new Error(steps.find((s) => s.error)?.error ?? "Không bước nào chạy được");
    return { result: `Xong ${ok}/${steps.length} bước.`, fields: { steps: steps.map((s) => ({ ...s })) } };
  }

  async function jobSpec(type, input = {}) {
    await ensureUploads(input);
    if (type === "combo") {
      try {
        return buildCombo(input, { hasUpload: video.hasUpload });
      } catch (e) {
        if (e instanceof InputError) throw new HttpError(400, e.message);
        throw e;
      }
    }
    const refs = {
      template: input.templateId ? store.getItem(input.templateId) : undefined,
      refJob: input.referenceJobId ? await store.getJob(String(input.referenceJobId)) : undefined,
      hasUpload: video.hasUpload,
    };
    try {
      return buildJob(type, input, refs);
    } catch (e) {
      if (e instanceof InputError) throw new HttpError(400, e.message);
      throw e;
    }
  }

  async function loadJob(req) {
    const job = await store.getJob(req.params.id);
    if (!job || !own(req, job)) throw new HttpError(404, "Không tìm thấy tác vụ");
    return job;
  }

  const gate = accounts ?? passwordGate(config.appPassword);
  const api = express.Router();
  // Stripe calls this after a payment; it needs the raw body for the signature, and no login.
  api.post("/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const out = await billingCall(() => billing.webhook(req.body.toString("utf8"), req.headers["stripe-signature"]));
    // A chargeback is something the admin should know about: it goes to "Lỗi gần đây" (and the webhook alert).
    if (out.dispute?.handled) {
      const who = store.getUser(out.dispute.userId ?? "")?.email ?? out.dispute.userId ?? "";
      await errors.record({ source: "billing", userId: out.dispute.userId, message: out.dispute.won === undefined ? `Khách ${who} yêu cầu ngân hàng hoàn tiền: đã thu lại ${out.dispute.taken} credit${out.dispute.locked ? ", tài khoản bị khoá vì đã dùng hết credit" : ""}` : `Tranh chấp thanh toán đã kết thúc: ${out.dispute.won ? "công ty thắng, đã trả lại credit và mở khoá" : "khách được hoàn tiền"}` });
    }
    res.json(out);
  });
  // Reference images for videos arrive as data URLs; only this route accepts a large body.
  api.post("/uploads", express.json({ limit: "9mb" }), async (req, res) => {
    try {
      const id = await video.saveUpload(req.body?.dataUrl);
      await publish([`uploads/${id}`]);
      res.status(201).json({ id });
    } catch (e) {
      throw e instanceof VideoError ? new HttpError(400, e.message) : e;
    }
  });
  // Long videos (Cắt Reels, Lồng tiếng): the raw file, up to 200MB; the length is checked after saving.
  api.post("/uploads/video", express.raw({ type: ["video/mp4", "video/quicktime", "application/octet-stream"], limit: "200mb" }), async (req, res) => {
    try {
      const saved = await clipper.saveVideo(req.body);
      await publish([`uploads/${saved.id}`]);
      res.status(201).json(saved);
    } catch (e) {
      throw e instanceof ClipError ? new HttpError(400, e.message) : e;
    }
  });
  // The viewer's own narration for a video: any common audio file, up to 25MB; saved as MP3.
  api.post("/uploads/audio", express.raw({ type: ["audio/*", "video/mp4", "application/octet-stream"], limit: "25mb" }), async (req, res) => {
    try {
      const saved = await clipper.saveAudio(req.body, { music: req.query.purpose === "music" });
      await publish([`uploads/${saved.id}`]);
      res.status(201).json(saved);
    } catch (e) {
      throw e instanceof ClipError ? new HttpError(400, e.message) : e;
    }
  });
  api.use(express.json({ limit: "256kb" }));
  api.use((req, res, next) => {
    if ((req.method === "POST" || req.method === "PUT") && req.headers["content-length"] !== "0" && req.headers["content-type"] && !req.is("application/json")) {
      return next(new HttpError(415, "Content-Type phải là application/json"));
    }
    next();
  });

  api.get("/session", (req, res) => {
    if (!accounts) return res.json({ mode: config.appPassword ? "password" : "open", required: !!config.appPassword, signedIn: gate.signedIn(req) });
    const user = accounts.userOf(req);
    const waiting = !user && accounts.pendingOf(req); // signed up, code not entered yet
    res.json({ mode: "accounts", required: true, signedIn: !!(user || waiting), user: user ? publicUser(user) : waiting || null, mfa: !user && accounts.mfaPending(req), setup: accounts.needsSetup(), signup: accounts.signupOpen, trial: accounts.signupOpen ? billing.trial : null, billing: billing.enabled, codes: !!mailer.enabled });
  });
  api.post("/login", (req, res) => gate.login(req, res));
  api.post("/logout", (req, res) => gate.logout(req, res));

  // ---- accounts ----
  const accountRoute = (fn) => async (req, res) => {
    if (!accounts) throw new HttpError(404, "Chưa bật tài khoản (ACCOUNTS=1)");
    try {
      await fn(req, res);
    } catch (e) {
      throw e instanceof AccountError ? new HttpError(e.status, e.message) : e;
    }
  };
  const adminOnly = (req) => {
    if (req.user?.role !== "admin") throw new HttpError(403, "Chỉ quản trị viên mới làm được việc này");
  };
  api.post("/setup", accountRoute((req, res) => accounts.setup(req, res)));
  api.post("/password/forgot", accountRoute((req, res) => accounts.forgot(req, res)));
  api.post("/password/reset", accountRoute((req, res) => accounts.reset(req, res)));
  // Browser errors (window.onerror) from the page, guests included; a few per minute per visitor.
  const clientErrors = new Map();
  api.post("/client-error", async (req, res) => {
    const ip = req.ip ?? "?";
    const recent = (clientErrors.get(ip) ?? []).filter((t) => Date.now() - t < 60_000);
    if (recent.length < 5) {
      clientErrors.set(ip, [...recent, Date.now()]);
      const b = req.body ?? {};
      await errors.record({ source: "browser", message: String(b.message ?? ""), stack: b.stack, path: String(b.path ?? ""), userId: req.user?.id });
    }
    res.status(204).end();
  });
  api.post("/signup", accountRoute((req, res) => accounts.signup(req, res)));
  api.post("/verify", accountRoute((req, res) => accounts.verify(req, res)));
  api.post("/verify/resend", accountRoute((req, res) => accounts.resend(req, res)));

  // ---- credits (SIGNUP=1) ----
  const billingCall = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      throw e instanceof BillingError ? new HttpError(e.status, e.message) : e;
    }
  };
  const origin = (req) => (process.env.PUBLIC_URL || `${req.headers["x-forwarded-proto"] ?? req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  api.get("/billing", accountRoute((req, res) => res.json(billing.account(req.user))));
  api.post("/billing/checkout", accountRoute(async (req, res) => {
    if (!billing.metered(req.user)) throw new HttpError(400, "Tài khoản này không tính credit");
    res.json(await billingCall(() => billing.checkout(req.user, String(req.body?.pack ?? ""), origin(req))));
  }));
  api.post("/billing/confirm", accountRoute(async (req, res) => {
    const out = await billingCall(() => billing.confirm(req.user, req.body?.sessionId));
    res.json({ paid: out.paid, added: out.added, credits: store.getUser(req.user.id).credits ?? null });
  }));
  api.put("/me/password", accountRoute((req, res) => accounts.changePassword(req, res)));
  api.post("/login/mfa", accountRoute((req, res) => accounts.loginMfa(req, res)));
  api.post("/me/logout-all", accountRoute((req, res) => accounts.logoutAll(req, res)));
  api.post("/me/mfa/setup", accountRoute((req, res) => accounts.mfaSetup(req, res)));
  api.post("/me/mfa/enable", accountRoute((req, res) => accounts.mfaEnable(req, res)));
  api.post("/me/mfa/disable", accountRoute((req, res) => accounts.mfaDisable(req, res)));
  // ---- admin: errors, backups, settings ----
  api.get("/admin/errors", accountRoute(async (req, res) => {
    adminOnly(req);
    res.json({ errors: await store.listErrors(100), webhook: !!(config.errorEnv ?? process.env).ERROR_WEBHOOK_URL });
  }));
  api.delete("/admin/errors", accountRoute(async (req, res) => {
    adminOnly(req);
    await store.clearErrors();
    res.json({ ok: true });
  }));
  api.get("/admin/backups", accountRoute(async (req, res) => {
    adminOnly(req);
    const items = storage.remote ? (await storage.list("backups/")).sort((a, b) => b.key.localeCompare(a.key)) : [];
    res.json({ enabled: storage.remote, keepDays: backupKeep, backups: items.map((x) => ({ key: x.key, size: x.size, at: x.modified ? new Date(x.modified).toISOString() : null })) });
  }));
  api.post("/admin/backups", accountRoute(async (req, res) => {
    adminOnly(req);
    try {
      res.json(await backupNow());
    } catch (e) {
      throw new HttpError(storage.remote ? 502 : 400, e.message);
    }
  }));
  api.get("/admin/settings", accountRoute((req, res) => {
    adminOnly(req);
    const saved = store.getSettings();
    res.json({
      settings: { signupPerIp: signupRules.perIp, trialCredits: billing.trial, creditPacks: saved.creditPacks || billing.defaults.creditPacks, heavyPerUser: heavyCap() },
      defaults: { signupPerIp: config.signupPerIp ?? 0, heavyPerUser: HEAVY_DEFAULT, ...billing.defaults },
      signupOpen: !!config.signup,
      updatedAt: saved.updatedAt ?? null,
    });
  }));
  api.put("/admin/settings", accountRoute(async (req, res) => {
    adminOnly(req);
    const body = req.body ?? {};
    const patch = {};
    const whole = (v, max, name) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, `${name} phải là số nguyên từ 0 đến ${max}`);
      return n;
    };
    if (body.signupPerIp !== undefined) patch.signupPerIp = whole(body.signupPerIp, 1000, "Số tài khoản mỗi IP");
    if (body.trialCredits !== undefined) patch.trialCredits = whole(body.trialCredits, 10_000, "Credit dùng thử");
    if (body.heavyPerUser !== undefined) patch.heavyPerUser = whole(body.heavyPerUser, 20, "Số tác vụ nặng cùng lúc");
    if (body.creditPacks !== undefined) {
      const text = String(body.creditPacks).trim();
      const packs = parsePacks(text);
      if (!packs.length || packs.length > 6) throw new HttpError(400, "Gói nạp không hợp lệ: ghi dạng credit:giá-cent, ví dụ 100:900,300:2400 (1 đến 6 gói, giá từ 50 cent)");
      patch.creditPacks = packs.map((p) => `${p.credits}:${p.cents}`).join(",");
    }
    await store.saveSettings(patch);
    res.json({ ok: true });
  }));

  /** Money: top-ups, refunds through the bank, credits per tool and a rough running cost. */
  api.get("/admin/stats", accountRoute((req, res) => {
    adminOnly(req);
    res.json(moneyStats({ users: store.listUsers(), jobs: store.listJobs(), today: vnDay(new Date().toISOString()), dayOf: (iso) => (iso ? vnDay(iso) : "") }));
  }));

  api.get("/admin/users", accountRoute((req, res) => {
    adminOnly(req);
    const today = vnDay(new Date().toISOString());
    const jobs = store.listJobs();
    res.json({
      users: store.listUsers().map((u) => {
        const mine = jobs.filter((j) => accounts.ownerId(j) === u.id);
        return { ...publicUser(u), paid: (u.payments ?? []).reduce((a, p) => a + (p.amount ?? 0), 0), lastLoginAt: u.lastLoginAt ?? null, jobs: mine.length, today: mine.filter((j) => vnDay(j.createdAt) === today).length, lastJobAt: mine[0]?.createdAt ?? null };
      }),
      defaultLimit: limits.LIMITS.jobsPerUserDay,
    });
  }));
  api.post("/admin/users", accountRoute(async (req, res) => {
    adminOnly(req);
    res.status(201).json({ user: publicUser(await accounts.create({ ...req.body, role: req.body?.role === "admin" ? "admin" : "member" })) });
  }));
  api.delete("/admin/users/:id", accountRoute(async (req, res) => {
    adminOnly(req);
    await accounts.remove(req.params.id, req.user);
    res.json({ ok: true });
  }));
  api.put("/admin/users/:id", accountRoute(async (req, res) => {
    adminOnly(req);
    res.json({ user: publicUser(await accounts.update(req.params.id, req.body ?? {}, req.user)) });
  }));

  api.get("/health", async (req, res) => {
    res.json({
      goclaw: await goclaw.health(),
      agents: config.agents,
      user: config.goclaw.userId,
      store: config.store,
      sources: { facebook100: true, apifyBackup: facebook.enabled }, // 100-reel scan is free (logged-out paging); Apify optional
    });
  });

  api.get("/video/worker", async (req, res) => {
    res.json(await video.status());
  });

  api.put("/video/worker", async (req, res) => {
    // One GPU for everyone: with customer accounts only the admin connects or changes it.
    if (accounts && req.user?.role !== "admin") throw new HttpError(403, "GPU do quản trị viên kết nối. Liên hệ quản trị viên nếu GPU đang tắt.");
    try {
      res.json(await video.setWorker(req.body ?? {}));
    } catch (e) {
      throw e instanceof VideoError ? new HttpError(400, e.message) : e;
    }
  });

  api.get("/stats", (req, res) => {
    res.json(store.stats((x) => own(req, x)));
  });

  /** Dashboard: every skill's runs, results, tokens and last run (the viewer's own jobs; the admin sees all). */
  api.get("/dashboard", (req, res) => {
    const day = (iso) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10); // Vietnam calendar day
    res.json(dashboard(store.listJobs().filter((j) => own(req, j)), { today: day(new Date().toISOString()), dayOf: day }));
  });

  api.post("/feedback", async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const contact = typeof req.body?.contact === "string" ? req.body.contact.trim() : "";
    const page = typeof req.body?.page === "string" ? req.body.page.slice(0, 200) : "";
    if (message.length < 3) throw new HttpError(400, "Hãy viết vài chữ góp ý");
    if (message.length > 3000 || contact.length > 200) throw new HttpError(400, "Góp ý dài quá");
    await store.addFeedback({ message, contact, page, ...(accounts ? { userId: req.user.id, email: req.user.email } : {}) });
    res.status(201).json({ ok: true });
  });

  const limits = createLimits({ store });

  api.post("/chat", limits.chat, async (req, res) => {
    const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    const messages = raw
      .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length || messages.at(-1).role !== "user") throw new HttpError(400, "Thiếu câu hỏi");
    const path = typeof req.body?.path === "string" ? req.body.path.slice(0, 200) : "";
    const jobId = path.match(/^\/jobs\/([0-9a-f-]{36})$/)?.[1];
    const found = jobId ? await store.getJob(jobId) : null;
    const job = found && own(req, found) ? found : null;
    try {
      const system = systemPrompt({ path, job }) + (req.body?.lang === "en" ? "\n\nThe user's interface is in English: always reply in natural US English." : "");
      let content = goclaw.mock ? null : await askDirect({ system, messages: messages.slice(-8) });
      if (content === null) {
        // GoClaw agents keep their own system prompt and ignore ours, so the instructions ride on the latest user turn.
        const last = messages.at(-1);
        const turns = [...messages.slice(0, -1), { role: "user", content: `${system}\n\n=== TIN NHẮN CỦA NGƯỜI DÙNG ===\n${last.content}` }];
        ({ content } = await goclaw.chat({ agent: config.agents.writer, messages: turns }));
      }
      let answer = extractAction(content, { hasUpload: video.hasUpload });
      // The free models sometimes write the posts right in the chat instead of proposing the tool.
      // A task request ("viết…", "quét…") answered with a long text and no action gets one strict retry.
      const task = /^\s*(viết|tạo|làm|lên (lịch|kế hoạch)|quét|phân tích|tìm|so sánh|nhân bản|trả lời review|gợi ý hashtag)/i.test(messages.at(-1).content);
      if (task && !answer.action && (answer.text ?? "").length > 500 && directEnabled()) {
        const retry = await askDirect({
          system,
          messages: [...messages.slice(-8, -1), { role: "user", content: `${messages.at(-1).content}\n\n(Chỉ trả lời 1 câu ngắn rồi khối \`\`\`action\`\`\` của công cụ phù hợp. KHÔNG tự viết nội dung.)` }],
        });
        const second = extractAction(retry ?? "", { hasUpload: video.hasUpload });
        if (second.action) answer = second;
      }
      // With the action card there, the tool writes the content: keep only the lead-in paragraph.
      if (task && answer.action && (answer.text ?? "").length > 400) {
        answer = { ...answer, text: `Việc này để công cụ **${answer.action.skill}** làm nhé: mình đã điền sẵn thông tin bên dưới. Bấm **Chạy** để nhận bài đầy đủ, có nút sao chép và lưu cho từng bài.` };
      }
      res.json(answer);
    } catch (e) {
      console.error("chat:", e.message);
      throw new HttpError(502, /429|usage|limit/i.test(e.message) ? "Trợ lý đang hết lượt dùng, thử lại sau nhé." : "Trợ lý chưa trả lời được, thử lại sau ít phút.");
    }
  });

  /** Quick edit of one written post ("Ngắn hơn", "Vui hơn"…): one model call, no job. */
  const REWRITE = {
    shorter: "Viết lại ngắn hơn khoảng một nửa, giữ ý chính và lời kêu gọi.",
    fun: "Viết lại vui hơn, trẻ trung, dí dỏm hơn nhưng vẫn tự nhiên.",
    emoji: "Giữ nguyên nội dung, thêm emoji phù hợp ở đầu đoạn và các ý chính (không quá 8 emoji).",
    formal: "Viết lại trang trọng, lịch sự, chuyên nghiệp hơn.",
  };
  api.post("/rewrite", limits.chat, async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const ask = REWRITE[req.body?.style];
    if (!ask) throw new HttpError(400, "Kiểu viết lại không hợp lệ");
    if (text.length < 10 || text.length > 6000) throw new HttpError(400, "Bài cần viết lại phải từ 10 đến 6000 ký tự");
    if (goclaw.mock || !directEnabled()) return res.json({ text: `${text}\n\n_(Bản viết lại mẫu, chưa có GROQ_API_KEY)_` });
    try {
      const { content } = await complete({
        messages: [
          { role: "system", content: "Bạn là người viết content cho quán ăn và người bán hàng. Viết lại bằng ĐÚNG ngôn ngữ của bài gốc (bài tiếng Anh thì trả lời tiếng Anh, không dịch). Chỉ trả về bài đã viết lại, không giải thích, không tiêu đề. Giữ nguyên định dạng markdown, hashtag và các chỗ trống dạng [GIÁ], [LINK]. Không thêm giá, ưu đãi, giờ mở cửa hay quà tặng nào không có trong bài gốc. Không dùng dấu gạch ngang để nối ý." },
          { role: "user", content: `${ask}\n\nBÀI GỐC:\n${text}` },
        ],
      }, { maxTokens: 1500 });
      // Same guard as the jobs: numbers that were not in the original become placeholders.
      const { text: checked } = checkFacts(fixDashes(String(content ?? "").trim()), text);
      if (!checked) throw new Error("empty");
      res.json({ text: checked });
    } catch (e) {
      console.error("rewrite:", e.message);
      throw new HttpError(502, /429|limit/i.test(e.message) ? "AI đang hết lượt dùng, thử lại sau ít phút." : "Chưa viết lại được, thử lại nhé.");
    }
  });

  /** Canned result of a skill, rendered by the same result views, so a new user sees what it makes. */
  const SAMPLE_INPUT = {
    plan: () => ({ start: nextMondayYmd(), platform: "facebook", days: 7, perDay: 1, topic: "Quán cà phê" }),
    campaign: () => ({ start: nextMondayYmd(), platform: "facebook", days: 7, perDay: 1, topic: "Quán cà phê" }),
    clone: () => ({ platform: "facebook", topic: "Quán cà phê nhỏ", pillars: ["entertain", "educate", "engage", "sell"] }),
    "promo-plan": () => ({ business: "Phở Cali", goal: "slow", dishes: "Phở bò - 65.000 - 28.000\nTrà đá - 5.000 - 1.000" }),
  };
  api.get("/samples/:type", (req, res) => {
    const raw = sampleReply(req.params.type);
    // The promotion sample is a model answer like any other: its money is worked out the same way.
    const result = raw && req.params.type === "promo-plan" ? promoReport(raw, SAMPLE_INPUT["promo-plan"]()) : raw;
    if (!result) throw new HttpError(404, "Công cụ này chưa có kết quả mẫu");
    const now = new Date().toISOString();
    res.json({ job: { id: `sample-${req.params.type}`, type: req.params.type, sample: true, status: "done", title: "Kết quả mẫu", input: SAMPLE_INPUT[req.params.type]?.() ?? {}, result, createdAt: now, startedAt: now, finishedAt: now } });
  });

  // ---- competitor watch ----
  const watcher = createWatcher({ store });
  if (!goclaw.mock) watcher.start();

  api.get("/watch", (req, res) => {
    res.json({ items: store.listWatch().filter((w) => own(req, w)) });
  });

  // Each followed channel or place is read again every week for free (Apify, Facebook): a cap per account,
  // and "Kiểm tra ngay" at most every 10 minutes per item.
  const MAX_WATCH = 10;
  const CHECK_GAP_MS = 10 * 60_000;
  const checking = new Set();

  api.post("/watch", async (req, res) => {
    let url;
    const mine = store.listWatch().filter((w) => own(req, w));
    const full = () => mine.length >= MAX_WATCH && new HttpError(400, `Tối đa ${MAX_WATCH} kênh và quán đang theo dõi. Bỏ theo dõi bớt ở trang Lịch sử rồi thêm lại.`);
    // A Google Maps place: its stars and new reviews are read every week (watcher.mjs, kind "maps").
    const raw = String(req.body?.url ?? "").trim();
    if (/^https:\/\//i.test(raw) && isMapsLink(raw)) {
      if (!placesEnabled()) throw new HttpError(400, "Chưa cấu hình APIFY_REVIEWS_TOKEN: theo dõi quán trên Google Maps cần Apify.");
      if (raw.length > 600) throw new HttpError(400, "Link Google Maps dài quá");
      const existing = mine.find((w) => w.url === raw);
      if (existing) return res.json({ item: existing });
      if (full()) throw full();
      const name = String(req.body?.name ?? "").trim().slice(0, 120) || "Quán trên Google Maps";
      const item = await store.addWatch({ url: raw, name, kind: "maps", ...(accounts ? { userId: req.user.id } : {}) });
      watcher.check(item).catch((e) => store.updateWatch(item.id, { lastError: e.message }));
      return res.status(201).json({ item });
    }
    try {
      url = buildJob("fanpage", { url: req.body?.url }).input.url; // same link validation as the fanpage tool
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    const existing = mine.find((w) => w.url === url);
    if (existing) return res.json({ item: existing });
    if (full()) throw full();
    const name = new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
    const item = await store.addWatch({ url, name, ...(accounts ? { userId: req.user.id } : {}) });
    // First read sets the baseline, so the next check reports only reels posted after today.
    watcher.check(item).catch((e) => store.updateWatch(item.id, { lastError: e.message }));
    res.status(201).json({ item });
  });

  /** The "Đối thủ" page: competitors from the runs and the watch list (competitors.mjs). */
  api.get("/competitors", (req, res) => {
    const watches = store.listWatch().filter((w) => own(req, w));
    res.json({ competitors: competitorsOf(watches, store.listJobs().filter((j) => own(req, j))), maxWatch: MAX_WATCH });
  });

  api.post("/watch/:id/check", async (req, res) => {
    const item = store.getWatch(req.params.id);
    if (!item || !own(req, item)) throw new HttpError(404, "Không tìm thấy kênh đang theo dõi");
    const last = Math.max(Date.parse(item.lastCheckedAt ?? "") || 0, Date.parse(item.lastAttemptAt ?? "") || 0);
    if (checking.has(item.id)) throw new HttpError(429, "Đang kiểm tra, chờ một chút rồi tải lại trang nhé.");
    if (Date.now() - last < CHECK_GAP_MS) throw new HttpError(429, "Vừa kiểm tra xong, thử lại sau ít phút nhé.");
    checking.add(item.id);
    try {
      res.json({ ...(await watcher.check(item)), item: store.getWatch(item.id) });
    } catch (e) {
      await store.updateWatch(item.id, { lastAttemptAt: new Date().toISOString() });
      throw new HttpError(502, `Không đọc được kênh: ${e.message}`);
    } finally {
      checking.delete(item.id);
    }
  });

  api.delete("/watch/:id", async (req, res) => {
    if (!own(req, store.getWatch(req.params.id))) throw new HttpError(404, "Không tìm thấy kênh đang theo dõi");
    await store.deleteWatch(req.params.id);
    res.json({ ok: true });
  });

  /** How the AI pipeline is doing over the cached recent jobs: watch sources, Groq retries, failures. */
  api.get("/ai-stats", (req, res) => {
    const jobs = store.listJobs().filter((j) => own(req, j));
    const watch = jobs.flatMap((j) => j.watch ?? []);
    const by = (src) => watch.filter((w) => w.source === src).length;
    const llmJobs = jobs.filter((j) => j.llm?.engine === "groq");
    const failed = jobs.filter((j) => j.status === "failed");
    res.json({
      watched: { total: watch.length, video: by("video"), speech: by("lời thoại"), caption: by("caption"), avgSeconds: watch.length ? Math.round(watch.reduce((a, w) => a + (w.ms ?? 0), 0) / watch.length / 1000) : 0 },
      groq: { jobs: llmJobs.length, retried: llmJobs.filter((j) => j.llm.tries > 1).length, waited: llmJobs.filter((j) => j.llm.waited).length },
      failed: { total: failed.length, rateLimit: failed.filter((j) => /429|rate limit|hết lượt/i.test(j.error ?? "")).length },
      since: jobs.at(-1)?.createdAt ?? null,
    });
  });

  api.get("/jobs", (req, res) => {
    const { type } = req.query;
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const jobs = store.listJobs().filter((j) => own(req, j) && (!type || j.type === type)).slice(0, limit);
    res.json({ jobs: jobs.map((j) => listItem(j, runner)), credits: billing.metered(req.user) ? req.user.credits : null });
  });

  /** Take the run's credits (customers on credits), then queue it; credits come back if queuing fails. */
  async function submitPaid(req, type, spec) {
    const credits = await billingCall(() => billing.charge(req.user, type));
    try {
      return await runner.submit({ type, ...spec, userId: userId(req), credits });
    } catch (e) {
      if (credits) await store.updateUser(req.user.id, { credits: store.getUser(req.user.id).credits + credits });
      throw e;
    }
  }
  const enoughCredits = (req, type, input) =>
    billingCall(async () => {
      // A combo needs, up front, what all its steps will take.
      if (type === "combo" && billing.metered(req.user)) {
        const need = comboCost(input?.recipe, billing.costOf);
        if (req.user.credits < need) throw new BillingError(402, `Hết credit: gói này cần ${need} credit, bạn còn ${req.user.credits}. Nạp thêm ở trang Credit nhé.`);
        return;
      }
      billing.check(req.user, type);
    });

  // Heavy runs (GPU, video) one account may have going at once, so one shop cannot fill the queue for everyone.
  const HEAVY = new Set(["video", "image", "photo-fix", "reel-cut", "dub", "live-recap", "combo"]);
  const HEAVY_DEFAULT = Number.isInteger(Number(process.env.HEAVY_PER_USER)) && process.env.HEAVY_PER_USER !== undefined ? Number(process.env.HEAVY_PER_USER) : 2;
  const heavyCap = () => (Number.isInteger(store.getSettings?.()?.heavyPerUser) ? store.getSettings().heavyPerUser : HEAVY_DEFAULT);
  function heavyGate(req, type) {
    const cap = heavyCap();
    if (!accounts || !req.user || req.user.role === "admin" || !HEAVY.has(type) || !cap) return;
    const busy = store.listJobs().filter((j) => j.userId === req.user.id && HEAVY.has(j.type) && (j.status === "queued" || j.status === "running")).length;
    if (busy >= cap) throw new HttpError(429, `Bạn đang có ${busy} tác vụ nặng (video, ảnh) đang chạy. Chờ xong bớt rồi chạy tiếp nhé, tối đa ${cap} tác vụ cùng lúc.`);
  }

  api.post("/jobs", limits.jobs, async (req, res) => {
    const { type, input } = req.body ?? {};
    heavyGate(req, type);
    await enoughCredits(req, type, input);
    const spec = await jobSpec(type, input);
    if (input?.uiLang === "en") spec.input = { ...spec.input, uiLang: "en" }; // English interface: English reports
    const job = await submitPaid(req, type, spec);
    res.status(201).json({ job: summary(job, runner) });
  });

  api.get("/jobs/:id", async (req, res) => {
    const job = await loadJob(req);
    res.json({ job: { ...job, queuePosition: runner.position(job.id) } });
  });

  api.post("/jobs/:id/cancel", async (req, res) => {
    await loadJob(req);
    if (!(await runner.cancel(req.params.id))) throw new HttpError(409, "Tác vụ đã kết thúc");
    res.json({ ok: true });
  });

  api.post("/jobs/:id/retry", limits.jobs, async (req, res) => {
    const job = await loadJob(req);
    if (ACTIVE.has(job.status)) throw new HttpError(409, "Tác vụ đang chạy");
    heavyGate(req, job.type);
    await enoughCredits(req, job.type, job.input);
    const spec = await jobSpec(job.type, job.input);
    if (job.input?.uiLang === "en") spec.input = { ...spec.input, uiLang: "en" };
    const fresh = await submitPaid(req, job.type, spec);
    res.status(201).json({ job: summary(fresh, runner) });
  });

  // ---- shared results: a read-only link the owner can turn off ----
  api.post("/jobs/:id/share", async (req, res) => {
    const job = await loadJob(req);
    if (job.status !== "done" || job.type === "combo") throw new HttpError(409, "Chỉ chia sẻ được kết quả đã xong");
    const share = job.share?.secret ? job.share : { secret: randomBytes(18).toString("base64url"), at: new Date().toISOString() };
    if (share !== job.share) await store.updateJob(job.id, { share });
    res.json({ share: { token: `${job.id}.${share.secret}`, at: share.at } });
  });
  api.delete("/jobs/:id/share", async (req, res) => {
    const job = await loadJob(req);
    await store.updateJob(job.id, { share: null });
    res.json({ ok: true });
  });
  /** The job a share token opens, or null when the link is wrong or turned off. */
  async function sharedJob(token) {
    const t = parseShare(token);
    if (!t) return null;
    const job = store.cachedJob(t.id) ?? (await store.getJob(t.id));
    return job?.share?.secret && same(job.share.secret, t.secret) ? job : null;
  }
  api.get("/public/shared/:token", async (req, res) => {
    const job = await sharedJob(req.params.token);
    if (!job) throw new HttpError(404, "Link này không còn hoạt động. Người chia sẻ có thể đã tắt link.");
    const view = { ...job, input: { ...(job.input ?? {}) } };
    for (const k of PRIVATE_FIELDS) delete view[k];
    const tokens = [req.params.token, ...cookieOf(req, SHARE_COOKIE).split("~").filter((t) => t && t !== req.params.token)].slice(0, MAX_SHARE_TOKENS);
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.set({ "Set-Cookie": `${SHARE_COOKIE}=${tokens.join("~")}; Path=/media; HttpOnly; SameSite=Lax; Max-Age=${7 * 86_400}${secure}`, "X-Robots-Tag": "noindex" }).json({ job: view });
  });

  // ---- slideshow photo review (job status "review") ----
  async function reviewJob(req) {
    const job = await loadJob(req);
    if (job.status !== "review" || !Array.isArray(job.slides)) throw new HttpError(409, "Video này không ở bước duyệt ảnh");
    return job;
  }
  const slideIndex = (req, job) => {
    const i = Number(req.params.i);
    if (!Number.isInteger(i) || i < 0 || i >= job.slides.length) throw new HttpError(400, "Không có ảnh này");
    return i;
  };
  const videoCall = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      throw e instanceof VideoError ? new HttpError(400, e.message) : e;
    }
  };
  api.post("/jobs/:id/slides/:i/redraw", async (req, res) => {
    const job = await reviewJob(req);
    const slides = await videoCall(() => video.redrawSlide(job, slideIndex(req, job), req.body?.prompt));
    await publish(filesOf({ slides }));
    res.json({ slides: (await store.updateJob(job.id, { slides })).slides });
  });
  api.post("/jobs/:id/slides/:i/replace", async (req, res) => {
    const job = await reviewJob(req);
    const slides = await videoCall(() => video.replaceSlide(job, slideIndex(req, job), String(req.body?.uploadId ?? "")));
    await publish(filesOf({ slides }));
    res.json({ slides: (await store.updateJob(job.id, { slides })).slides });
  });
  /** Render the reviewed photos (in the order chosen on the page): queued on the runner, the page polls. */
  api.post("/jobs/:id/render", async (req, res) => {
    const job = await reviewJob(req);
    const order = Array.isArray(req.body?.order) ? req.body.order.map(Number) : job.slides.map((_, i) => i);
    if (order.length < 2 || new Set(order).size !== order.length || order.some((i) => !job.slides[i])) throw new HttpError(400, "Thứ tự ảnh không hợp lệ (cần ít nhất 2 ảnh)");
    const slides = order.map((i) => job.slides[i]);
    // On the runner like any job: one lane limit, cancel, a restart renders it again (never redraws), failures refund.
    await store.updateJob(job.id, { status: "queued", renderOnly: true, phase: "Đang chờ ghép ảnh thành video…", slides });
    runner.requeue(job.id);
    res.status(202).json({ ok: true });
  });

  /**
   * Same photos, another template: lay a finished slideshow out again without drawing anything on the GPU.
   * A new video job (the old one stays), charged as "video-restyle".
   */
  // The video form checks the restaurant's Google Maps link before the "Chỉ đường" video is made.
  api.post("/map/check", limits.map, async (req, res) => {
    try {
      res.json(await placeFromLink(req.body?.link));
    } catch (e) {
      throw new HttpError(400, e instanceof MapLinkError ? e.message : "Chưa đọc được link, thử lại sau ít phút.");
    }
  });

  api.post("/jobs/:id/restyle", limits.jobs, async (req, res) => {
    const job = await loadJob(req);
    if (job.type !== "video" || job.input?.mode !== "slideshow" || job.status !== "done" || !Array.isArray(job.slides) || job.slides.length < 2) throw new HttpError(409, "Chỉ đổi mẫu được cho video trình chiếu đã dựng xong");
    const layout = String(req.body?.layout ?? "");
    if (!SLIDE_TEMPLATES.has(layout)) throw new HttpError(400, "Mẫu video không hợp lệ");
    const ratio = ["9:16", "16:9", "1:1"].includes(req.body?.ratio) ? req.body.ratio : job.input.ratio;
    const offer = String(req.body?.offer ?? job.input.offer ?? "").trim().slice(0, 120);
    if (OFFER_TEMPLATES.has(layout) && !offer) throw new HttpError(400, "Mẫu này cần câu ưu đãi (chỉ ghi ưu đãi có thật)");
    const dishes = req.body?.dishes !== undefined ? parseDishes(req.body.dishes) : job.input.dishes ?? [];
    // The template's own words the user changed (kept from the old video when not sent again).
    const texts = cleanTexts(layout, req.body?.texts ?? job.input.texts);
    const tagline = String(req.body?.tagline ?? job.input.tagline ?? "").trim().slice(0, 60);
    const mapLink = layout === "map" ? String(req.body?.mapLink ?? job.input.mapLink ?? "").trim().slice(0, 1000) : job.input.mapLink;
    if (layout === "map" && !isMapsLink(mapLink)) throw new HttpError(400, "Mẫu Chỉ đường cần link Google Maps của quán");
    heavyGate(req, "video");
    await billingCall(() => billing.check(req.user, "video-restyle"));
    // The photos may only be in object storage (another server, a cleaned disk): fetch them back first.
    if (storage.remote) for (const s of job.slides) if (s.image && !existsSync(localOf(`images/${s.image}`))) await storage.get(`images/${s.image}`, localOf(`images/${s.image}`)).catch(() => false);
    await ensureUploads(job.input);
    const credits = await billingCall(() => billing.charge(req.user, "video-restyle"));
    const fresh = await runner.submit({
      type: "video",
      agent: job.agent,
      title: job.title,
      input: { ...job.input, layout, ratio, offer, dishes, texts, tagline, mapLink, review: false, restyledFrom: job.id },
      prompt: "",
      userId: job.userId,
      credits,
      extra: { renderOnly: true, slides: job.slides, images: job.images, draft: job.draft ?? "" },
    });
    res.status(201).json({ job: summary(fresh, runner) });
  });

  // ---- "Menu in & menu điện tử": a menu kept as a library item of kind "menu"; its online page is public ----
  const MENU_THEMES = new Set(["cream", "noir", "garden", "street"]);
  function menuFields(raw = {}) {
    const text = (v, max) => String(v ?? "").trim().slice(0, max);
    const sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 12).map((sec) => ({
      title: text(sec?.title, 60),
      items: (Array.isArray(sec?.items) ? sec.items : []).slice(0, 40).map((it) => ({ name: text(it?.name, 80), price: text(it?.price, 24), desc: text(it?.desc, 200), tag: text(it?.tag, 20) })).filter((it) => it.name),
    })).filter((sec) => sec.items.length);
    if (!sections.length) throw new HttpError(400, "Menu cần ít nhất một món");
    if (sections.reduce((a, sec) => a + sec.items.length, 0) > 150) throw new HttpError(400, "Menu tối đa 150 món");
    // The logo travels inside the menu as a small data URL; a bad or too big one is refused, never dropped silently.
    const logo = typeof raw.logo === "string" ? raw.logo : "";
    if (logo && !(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo) && logo.length <= 120_000)) throw new HttpError(400, "Logo quá lớn, hãy chọn lại logo (ảnh nhỏ hơn).");
    const color = /^#[0-9a-f]{6}$/i.test(String(raw.color ?? "")) ? raw.color : "#c2451f";
    return {
      name: text(raw.name, 60) || "Menu",
      tagline: text(raw.tagline, 120),
      note: text(raw.note, 200),
      contact: text(raw.contact, 160),
      theme: MENU_THEMES.has(raw.theme) ? raw.theme : "cream",
      color,
      logo,
      sections,
    };
  }
  const myMenu = (req) => {
    const item = store.getItem(req.params.id);
    if (!item || item.kind !== "menu" || !own(req, item)) throw new HttpError(404, "Không tìm thấy menu");
    return item;
  };
  api.get("/menus", (req, res) => {
    res.json({ menus: store.listLibrary().filter((x) => x.kind === "menu" && own(req, x)).map((x) => ({ id: x.id, title: x.title, menu: x.menu, updatedAt: x.updatedAt })) });
  });
  // "Đọc file bán hàng": an Excel export from the POS. Step 1 reads the headers and guesses the columns (the
  // owner confirms them on the page); step 2 counts the numbers here and queues the reading for the model.
  const salesFile = (dataUrl) => {
    const m = String(dataUrl ?? "").match(/^data:application\/(?:vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel|octet-stream);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new HttpError(400, "Chọn file Excel (.xlsx hoặc .xls)");
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > MAX_SALES_BYTES) throw new HttpError(400, "File quá lớn (tối đa 5 MB)");
    try {
      return readSheet(buf);
    } catch (e) {
      throw new HttpError(400, e.message || "Không đọc được file Excel này");
    }
  };
  api.post("/sales/read", express.json({ limit: "8mb" }), async (req, res) => {
    const f = salesFile(req.body?.dataUrl);
    res.json({ sheet: f.sheet, sheets: f.sheets, headers: f.headers, rows: f.rows.length, mapping: detectMapping(f.headers), preview: f.rows.slice(0, 5) });
  });
  api.post("/sales/analyze", express.json({ limit: "8mb" }), limits.jobs, async (req, res) => {
    const f = salesFile(req.body?.dataUrl);
    const map = req.body?.mapping ?? {};
    const mapping = {};
    for (const k of ["dish", "qty", "amount", "time", "date"]) {
      const v = map[k];
      if (v === "" || v == null) continue;
      const i = Number(v);
      if (!Number.isInteger(i) || i < 0 || i >= f.headers.length) throw new HttpError(400, "Cột đã chọn không hợp lệ");
      mapping[k] = i;
    }
    let stats;
    try {
      stats = salesStats(f.rows, mapping);
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    const business = String(req.body?.business ?? "").trim().slice(0, 120) || "quán";
    const text = statsText(stats);
    const spec = {
      agent: "writer",
      direct: "sales-insight",
      title: `Đọc doanh số · ${business.slice(0, 60)}`,
      input: { business, stats: { lines: stats.lines, dishCount: stats.dishCount, totalQty: stats.totalQty, totalAmount: stats.totalAmount }, summary: text },
      prompt: `Gợi ý nội dung và khuyến mãi từ số liệu bán hàng theo skill sales-insight, bằng tiếng Việt.\n\nQuán: ${business}\n\nSố liệu (đã tính sẵn, chỉ dùng những số này):\n${text}`,
    };
    const job = await submitPaid(req, "sales-insight", spec);
    res.status(201).json({ job: summary(job, runner) });
  });

  // "Chụp menu giấy": a photo of the paper menu read into the menu text (the owner checks it before saving).
  // 1 credit, taken only when dishes were read.
  api.post("/menus/scan", express.json({ limit: "9mb" }), limits.jobs, async (req, res) => {
    const m = String(req.body?.dataUrl ?? "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new HttpError(400, "Chọn ảnh menu (JPG, PNG hoặc WebP)");
    await billingCall(async () => billing.check(req.user, "menu-scan"));
    const text = await readMenu({ data: Buffer.from(m[2], "base64"), mime: m[1] }).catch(() => null);
    if (text === null) throw new HttpError(503, "AI đọc ảnh đang quá tải, thử lại sau ít phút (không bị trừ credit).");
    if (!text) throw new HttpError(422, "Chưa đọc được món nào từ ảnh này. Chụp thẳng, đủ sáng, rõ chữ rồi thử lại (không bị trừ credit).");
    const credits = await billingCall(() => billing.charge(req.user, "menu-scan"));
    res.json({ text, credits });
  });

  api.post("/menus", async (req, res) => {
    if (store.listLibrary().filter((x) => x.kind === "menu" && own(req, x)).length >= 10) throw new HttpError(400, "Mỗi tài khoản lưu tối đa 10 menu, xoá bớt menu cũ nhé");
    const menu = menuFields(req.body ?? {});
    const item = await store.addItem({ kind: "menu", title: menu.name, menu, ...(accounts ? { userId: req.user.id } : {}) });
    res.status(201).json({ menu: { id: item.id, title: item.title, menu: item.menu, updatedAt: item.updatedAt } });
  });
  api.put("/menus/:id", async (req, res) => {
    myMenu(req);
    const menu = menuFields(req.body ?? {});
    const item = await store.updateItem(req.params.id, { title: menu.name, menu });
    res.json({ menu: { id: item.id, title: item.title, menu: item.menu, updatedAt: item.updatedAt } });
  });
  api.delete("/menus/:id", async (req, res) => {
    myMenu(req);
    await store.deleteItem(req.params.id);
    res.json({ ok: true });
  });
  /** The online menu guests open from the QR code: no login, only the menu itself. */
  api.get("/public/menus/:id", (req, res) => {
    const item = store.getItem(req.params.id);
    if (!item || item.kind !== "menu") throw new HttpError(404, "Menu không tồn tại hoặc đã bị xoá");
    res.set("Cache-Control", "public, max-age=60").json({ menu: item.menu, updatedAt: item.updatedAt });
  });

  api.delete("/jobs/:id", async (req, res) => {
    const job = await loadJob(req);
    if (ACTIVE.has(job.status)) throw new HttpError(409, "Huỷ tác vụ trước khi xoá");
    // "Đổi mẫu" makes a new run on the same photos: files another run still shows are kept.
    const shared = new Set(store.listJobs().filter((j) => j.id !== job.id).flatMap(filesOf));
    await store.deleteJob(job.id);
    await video.remove(job, shared);
    await clipper.removeClips(job);
    if (storage.remote) for (const key of filesOf(job)) if (!shared.has(key)) await storage.remove(key).catch(() => {});
    res.json({ ok: true });
  });

  api.get("/schedule", (req, res) => {
    res.json({ slots: store.listSchedule(req.query.from, req.query.to).filter((x) => own(req, x)) });
  });

  /** One slot, or { slots: [...] } to add a whole plan at once (max 31). */
  api.post("/schedule", async (req, res) => {
    const list = Array.isArray(req.body?.slots) ? req.body.slots : [req.body ?? {}];
    if (!list.length || list.length > 31) throw new HttpError(400, "Mỗi lần thêm từ 1 đến 31 bài");
    res.status(201).json({ slots: await store.addSlots(list.map((x) => ({ ...slotFields(x ?? {}), ...(accounts ? { userId: req.user.id } : {}) }))) });
  });

  api.put("/schedule/:id", async (req, res) => {
    if (!own(req, store.getSlot(req.params.id) ?? null) || !store.getSlot(req.params.id)) throw new HttpError(404, "Không tìm thấy bài trong lịch");
    res.json({ slot: await store.updateSlot(req.params.id, slotFields(req.body ?? {}, true)) });
  });

  /** Download a reel / TikTok on demand and return a playable clip id (the platform embed is blocked or missing). */
  const clipJobs = new Map(); // video url → pending promise, so double clicks share one download
  api.get("/clip", async (req, res) => {
    const url = String(req.query.url ?? "");
    if (!/^https:\/\/(www\.|m\.)?(tiktok\.com\/@[\w.-]+\/video\/\d{15,20}|facebook\.com\/(reel\/\d{9,25}|[^\s/]+\/videos\/\d{9,25}|watch\/?\?v=\d{9,25}))/.test(url)) throw new HttpError(400, "Link video không hợp lệ");
    if (!clipJobs.has(url)) clipJobs.set(url, makeClip(url, clipsDir).finally(() => setTimeout(() => clipJobs.delete(url), 60_000)));
    const clip = await clipJobs.get(url);
    if (!clip) throw new HttpError(502, "Không tải được video này, hãy mở trên nền tảng gốc.");
    res.json({ clip });
  });

  api.get("/facebook", (req, res) => {
    res.json({ configured: pageConfigured() });
  });

  /** Post a calendar slot to the Facebook Page (now, or scheduled on Facebook for its time). */
  api.post("/schedule/:id/publish", async (req, res) => {
    const slot = store.getSlot(req.params.id);
    if (!slot || !own(req, slot)) throw new HttpError(404, "Không tìm thấy bài trong lịch");
    if (slot.fbPostId) throw new HttpError(409, "Bài này đã được gửi lên Facebook");
    try {
      const out = await publishToPage({ message: [slot.body || slot.title].join(""), at: slot.at });
      res.json({ slot: await store.updateSlot(slot.id, { status: out.scheduled ? "scheduled" : "posted", fbPostId: out.id }), ...out });
    } catch (e) {
      throw new HttpError(pageConfigured() ? 502 : 400, e.message);
    }
  });

  api.delete("/schedule/:id", async (req, res) => {
    if (!own(req, store.getSlot(req.params.id) ?? null) || !store.getSlot(req.params.id)) throw new HttpError(404, "Không tìm thấy bài trong lịch");
    await store.deleteSlot(req.params.id);
    res.json({ ok: true });
  });

  // Starter templates (no owner) are shown to every customer; only the admin can edit them.
  const sharedTemplate = (x) => x.kind === "template" && !x.userId;
  api.get("/library", (req, res) => {
    const { kind } = req.query;
    res.json({ items: store.listLibrary().filter((x) => x.kind !== "menu" && (!kind || x.kind === kind) && (sharedTemplate(x) || own(req, x))) });
  });

  api.post("/library", async (req, res) => {
    res.status(201).json({ item: await store.addItem({ ...libraryFields(req.body ?? {}), ...(accounts ? { userId: req.user.id } : {}) }) });
  });

  api.put("/library/:id", async (req, res) => {
    if (!store.getItem(req.params.id) || !own(req, store.getItem(req.params.id))) throw new HttpError(404, "Không tìm thấy mục trong thư viện");
    res.json({ item: await store.updateItem(req.params.id, libraryFields(req.body ?? {}, true)) });
  });

  api.delete("/library/:id", async (req, res) => {
    if (!store.getItem(req.params.id) || !own(req, store.getItem(req.params.id))) throw new HttpError(404, "Không tìm thấy mục trong thư viện");
    await store.deleteItem(req.params.id);
    res.json({ ok: true });
  });

  api.use((req, res, next) => next(new HttpError(404, "Không có API này")));

  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    const status = err instanceof HttpError ? err.status : err.type === "entity.too.large" ? 413 : err.type === "entity.parse.failed" ? 400 : 500;
    if (status === 500) {
      console.error(err);
      errors.record({ source: "server", message: err.message, stack: err.stack, path: `${req.method} ${req.baseUrl}${req.path}`, userId: req.user?.id });
    }
    const message = { 413: "Dữ liệu gửi lên quá lớn", 400: "JSON không hợp lệ" }[status];
    res.status(status).set("Cache-Control", "no-store").json({ error: err instanceof HttpError ? err.message : message ?? "Lỗi máy chủ" });
  });

  const app = express();
  app.disable("x-powered-by");
  // gzip for pages, scripts and API answers when no proxy does it (Caddy compresses on its own and skips
  // what is already compressed). Videos, images and audio are compressed already: left alone by default.
  app.use(compression());
  // Behind a reverse proxy (nginx, Cloudflare…) the visitor's IP is in X-Forwarded-For: TRUST_PROXY=1 reads it,
  // so the per-IP limits (sign-up, runs, chat) count visitors and not the proxy.
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  // Pictures and videos of the results this browser opened through a share link (see SHARE_COOKIE).
  app.use("/media", async (req, res, next) => {
    const tokens = cookieOf(req, SHARE_COOKIE).split("~").filter(Boolean).slice(0, MAX_SHARE_TOKENS);
    if (tokens.length && req.method === "GET") {
      const jobs = (await Promise.all(tokens.map((t) => sharedJob(t).catch(() => null)))).filter(Boolean);
      if (jobs.length) req.sharedJobs = jobs;
    }
    next();
  });
  app.use(gate.middleware);
  /** A file of a shared result: its own, or one it shows from another run (a restyle keeps the first run's photos). */
  const sharedMedia = (req, jobId, file) => (req.sharedJobs ?? []).some((j) => j.id === jobId || JSON.stringify(j).includes(file));
  /** The owner (or, without accounts, anyone signed in) sees a run's files; a share-link viewer only that result's. */
  const canSee = async (req, jobId, file) => {
    const signed = accounts ? !!req.user : gate.signedIn?.(req) ?? true;
    if (signed && (!accounts || own(req, store.cachedJob(jobId) ?? (await store.getJob(jobId))))) return true;
    return sharedMedia(req, jobId, file);
  };
  app.get("/media/videos/:file", async (req, res) => {
    // <job id>.mp4 for the job video, <job id>-clipN.mp4 or <job id>-dub.mp4 for the cut and dubbed files
    const m = req.params.file.match(/^([0-9a-f-]{36})(-clip\d+|-dub)?\.mp4$/);
    if (m && !(await canSee(req, m[1], req.params.file))) return res.status(404).send("Không tìm thấy video");
    const file = m && path.join(videoRoot, "videos", req.params.file);
    if (!file) return res.status(404).send("Không tìm thấy video");
    if (!existsSync(file)) return fromStorage(res, `videos/${req.params.file}`);
    res.set("X-Content-Type-Options", "nosniff").sendFile(file, { dotfiles: "allow" }); // DATA_DIR defaults to web/.data
  });
  // 480p copies of the reels / TikToks the AI watched: played on the result page (platform embeds get blocked).
  app.get("/media/clips/:file", (req, res) => {
    const m = req.params.file.match(/^([0-9a-f-]{36}|v\d{9,25})\.mp4$/);
    const file = m && path.join(clipsDir, `${m[1]}.mp4`);
    if (!file || !existsSync(file)) return res.status(404).send("Không tìm thấy video");
    res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" }).sendFile(file, { dotfiles: "allow" });
  });
  // Instagram post pictures kept by the Instagram analysis (the CDN links expire).
  app.get("/media/thumbs/:file", (req, res) => {
    const m = req.params.file.match(/^ig-[\w-]{5,40}\.jpg$/);
    const file = m && path.join(clipsDir, req.params.file);
    if (!file || !existsSync(file)) return res.status(404).send("Không tìm thấy ảnh");
    res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" }).sendFile(file, { dotfiles: "allow" });
  });
  app.get("/media/images/:file", async (req, res) => {
    const jobId = req.params.file.slice(0, 36);
    if (!(await canSee(req, jobId, req.params.file))) return res.status(404).send("Không tìm thấy ảnh");
    const file = video.imagePath(req.params.file);
    if (!file) return res.status(404).send("Không tìm thấy ảnh");
    if (!existsSync(file)) return fromStorage(res, `images/${req.params.file}`);
    res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" }).sendFile(file, { dotfiles: "allow" });
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  }, api);

  // Built React app (npm run build). In dev, Vite serves it and proxies /api here.
  if (existsSync(CLIENT_DIST)) {
    const csp = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; frame-src https://www.facebook.com https://www.threads.com https://www.threads.net https://www.tiktok.com https://www.instagram.com https://maps.google.com https://www.google.com; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com";
    app.use(express.static(CLIENT_DIST, {
      index: false,
      setHeaders: (res, file) => {
        res.set("X-Content-Type-Options", "nosniff");
        // Built files carry a content hash in their name: never asked for again. Sample videos and the
        // rest of public/ change rarely: kept a day, so the template picker does not re-download them.
        const rel = path.relative(CLIENT_DIST, file).split(path.sep).join("/");
        if (rel.startsWith("assets/")) res.set("Cache-Control", "public, max-age=31536000, immutable");
        else if (rel.startsWith("samples/")) res.set("Cache-Control", "public, max-age=86400");
      },
    }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.set({ "Content-Security-Policy": csp, "Cache-Control": "no-cache" }).sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  return { app, store, runner, goclaw, errors };
}
