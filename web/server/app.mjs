import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WEB_ROOT } from "./config.mjs";
import { createGoclawClient } from "./goclaw.mjs";
import { createJobRunner, ACTIVE } from "./jobs.mjs";
import { createPreparer } from "./prepare.mjs";
import { createFacebookSource } from "./sources/facebook.mjs";
import { buildJob, cleanHashtags, InputError } from "./prompts.mjs";
import { CHECKED_TYPES, checkFacts, englishBlanks } from "./facts.mjs";
import { complete, directEnabled, fixDashes } from "./llm.mjs";
import { sampleReply } from "./mock.mjs";
import { createWatcher } from "./watcher.mjs";
import { makeClip } from "./watch.mjs";
import { createLimits } from "./limits.mjs";
import { pageConfigured, publishToPage } from "./facebookPage.mjs";
import { openStore } from "./store/index.mjs";
import { AccountError, createAccounts, publicUser } from "./accounts.mjs";
import { askDirect, extractAction, systemPrompt } from "./assistant.mjs";
import { createVideoService, VideoError } from "./video.mjs";
import { SEED_TEMPLATES } from "./seed-templates.mjs";

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
      const open = req.path === "/api/login" || req.path === "/api/session" || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/"));
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
  const { prompt, result, ...rest } = job;
  return { ...rest, queuePosition: job.status === "queued" ? runner.position(job.id) : null };
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
  const accounts = config.accounts ? createAccounts({ store, dataDir: config.video?.dataDir ?? path.join(tmpdir(), `skipli-accounts-${process.pid}`) }) : null;
  if (accounts) await accounts.bootstrap();
  /** Is this record the signed-in customer's? (always true without accounts) */
  const own = (req, item) => !accounts || accounts.ownerId(item) === req.user?.id;
  const userId = (req) => (accounts ? req.user?.id ?? null : undefined);
  const goclaw = createGoclawClient(config.goclaw);
  const facebook = createFacebookSource(config.facebook);
  // Tests build a config without `video`: keep their files out of the repo.
  const video = createVideoService(config.video ?? { dataDir: path.join(tmpdir(), `skipli-video-${process.pid}`), timeoutMs: 60_000, mock: config.goclaw.mock });
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
  const runner = createJobRunner({ store, goclaw, agents: config.agents, ...config.jobs, prepare: createPreparer({ facebook, mock: goclaw.mock, clipsDir }),
    finish: async (job, content, ctx) => {
      if (job.input?.lang === "en") content = englishBlanks(content);
      // The fanpage report template says "reel"; most Instagram posts are photos and albums.
      if (job.type === "instagram") content = content.replace(/(?<![/#@]\s?)\b(R|r)eels?\b/g, (w, r) => (r === "R" ? "Bài" : "bài"));
      if (job.type === "hashtag") return { result: cleanHashtags(content, job.input) };
      if (CHECKED_TYPES.has(job.type)) {
        // Prices, discounts, hours the user never gave → placeholders; gifts → warnings shown on the result page.
        const { text, replaced, warnings } = checkFacts(content, Object.values(job.input ?? {}).filter((v) => typeof v === "string").join("\n")); // what the user typed, not our prompt wording
        return { result: text, fields: { factCheck: { replaced, warnings } } };
      }
      return (await video.finish(job, content, ctx)) ?? { result: content }; // content may have been edited above
    },
  });
  await runner.recover();

  async function jobSpec(type, input = {}) {
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
  // Reference images for videos arrive as data URLs; only this route accepts a large body.
  api.post("/uploads", express.json({ limit: "9mb" }), async (req, res) => {
    try {
      res.status(201).json({ id: await video.saveUpload(req.body?.dataUrl) });
    } catch (e) {
      throw e instanceof VideoError ? new HttpError(400, e.message) : e;
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
    res.json({ mode: "accounts", required: true, signedIn: !!user, user: publicUser(user), setup: accounts.needsSetup() });
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
  api.put("/me/password", accountRoute((req, res) => accounts.changePassword(req, res)));
  api.get("/admin/users", accountRoute((req, res) => {
    adminOnly(req);
    const today = vnDay(new Date().toISOString());
    const jobs = store.listJobs();
    res.json({
      users: store.listUsers().map((u) => {
        const mine = jobs.filter((j) => accounts.ownerId(j) === u.id);
        return { ...publicUser(u), lastLoginAt: u.lastLoginAt ?? null, jobs: mine.length, today: mine.filter((j) => vnDay(j.createdAt) === today).length, lastJobAt: mine[0]?.createdAt ?? null };
      }),
      defaultLimit: limits.LIMITS.jobsPerUserDay,
    });
  }));
  api.post("/admin/users", accountRoute(async (req, res) => {
    adminOnly(req);
    res.status(201).json({ user: publicUser(await accounts.create({ ...req.body, role: req.body?.role === "admin" ? "admin" : "member" })) });
  }));
  api.put("/admin/users/:id", accountRoute(async (req, res) => {
    adminOnly(req);
    res.json({ user: publicUser(await accounts.update(req.params.id, req.body ?? {})) });
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
      const system = systemPrompt({ path, job });
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
  };
  api.get("/samples/:type", (req, res) => {
    const result = sampleReply(req.params.type);
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

  api.post("/watch", async (req, res) => {
    let url;
    try {
      url = buildJob("fanpage", { url: req.body?.url }).input.url; // same link validation as the fanpage tool
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    const existing = store.listWatch().find((w) => w.url === url && own(req, w));
    if (existing) return res.json({ item: existing });
    const name = new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
    const item = await store.addWatch({ url, name, ...(accounts ? { userId: req.user.id } : {}) });
    // First read sets the baseline, so the next check reports only reels posted after today.
    watcher.check(item).catch((e) => store.updateWatch(item.id, { lastError: e.message }));
    res.status(201).json({ item });
  });

  api.post("/watch/:id/check", async (req, res) => {
    const item = store.getWatch(req.params.id);
    if (!item || !own(req, item)) throw new HttpError(404, "Không tìm thấy kênh đang theo dõi");
    try {
      res.json({ ...(await watcher.check(item)), item: store.getWatch(item.id) });
    } catch (e) {
      throw new HttpError(502, `Không đọc được kênh: ${e.message}`);
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
    res.json({ jobs: jobs.map((j) => summary(j, runner)) });
  });

  api.post("/jobs", limits.jobs, async (req, res) => {
    const { type, input } = req.body ?? {};
    const job = await runner.submit({ type, ...(await jobSpec(type, input)), userId: userId(req) });
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
    const fresh = await runner.submit({ type: job.type, ...(await jobSpec(job.type, job.input)), userId: userId(req) });
    res.status(201).json({ job: summary(fresh, runner) });
  });

  api.delete("/jobs/:id", async (req, res) => {
    const job = await loadJob(req);
    if (ACTIVE.has(job.status)) throw new HttpError(409, "Huỷ tác vụ trước khi xoá");
    await store.deleteJob(job.id);
    await video.remove(job);
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
    res.json({ items: store.listLibrary().filter((x) => (!kind || x.kind === kind) && (sharedTemplate(x) || own(req, x))) });
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
    if (status === 500) console.error(err);
    const message = { 413: "Dữ liệu gửi lên quá lớn", 400: "JSON không hợp lệ" }[status];
    res.status(status).set("Cache-Control", "no-store").json({ error: err instanceof HttpError ? err.message : message ?? "Lỗi máy chủ" });
  });

  const app = express();
  app.disable("x-powered-by");
  app.use(gate.middleware);
  app.get("/media/videos/:file", async (req, res) => {
    const m = req.params.file.match(/^([0-9a-f-]{36})\.mp4$/);
    if (accounts && m && !own(req, store.cachedJob(m[1]) ?? (await store.getJob(m[1])))) return res.status(404).send("Không tìm thấy video");
    const file = m && video.videoPath(m[1]);
    if (!file || !existsSync(file)) return res.status(404).send("Không tìm thấy video");
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
    if (accounts && !own(req, store.cachedJob(jobId) ?? (await store.getJob(jobId)))) return res.status(404).send("Không tìm thấy ảnh");
    const file = video.imagePath(req.params.file);
    if (!file || !existsSync(file)) return res.status(404).send("Không tìm thấy ảnh");
    res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" }).sendFile(file, { dotfiles: "allow" });
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  }, api);

  // Built React app (npm run build). In dev, Vite serves it and proxies /api here.
  if (existsSync(CLIENT_DIST)) {
    const csp = "default-src 'self'; img-src 'self' data: blob:; frame-src https://www.facebook.com https://www.threads.com https://www.threads.net https://www.tiktok.com https://www.instagram.com; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com";
    app.use(express.static(CLIENT_DIST, { index: false, setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff") }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.set({ "Content-Security-Policy": csp, "Cache-Control": "no-cache" }).sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  return { app, store, runner, goclaw };
}
