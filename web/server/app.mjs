import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { WEB_ROOT } from "./config.mjs";
import { createGoclawClient } from "./goclaw.mjs";
import { createJobRunner, ACTIVE } from "./jobs.mjs";
import { createPreparer } from "./prepare.mjs";
import { createFacebookSource } from "./sources/facebook.mjs";
import { buildJob, InputError } from "./prompts.mjs";
import { openStore } from "./store/index.mjs";
import { SEED_TEMPLATES } from "./seed-templates.mjs";

const CLIENT_DIST = path.join(WEB_ROOT, "client", "dist");
const LIBRARY_KINDS = new Set(["template", "saved"]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function basicAuth(password) {
  return (req, res, next) => {
    if (!password) return next();
    const [scheme, value] = (req.headers.authorization ?? "").split(" ");
    const pass = scheme === "Basic" && value ? Buffer.from(value, "base64").toString("utf8").split(":").slice(1).join(":") : "";
    const a = Buffer.from(pass);
    const b = Buffer.from(password);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();
    res.set("WWW-Authenticate", 'Basic realm="Skipli Content", charset="UTF-8"').status(401).send("Cần đăng nhập");
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

/**
 * @param {object} config   see ./config.mjs
 * @param {object} adapter  persistence adapter (./store/firestore.mjs or ./store/memory.mjs)
 */
export async function createApp(config, adapter) {
  const store = await openStore(adapter, { templates: SEED_TEMPLATES });
  const goclaw = createGoclawClient(config.goclaw);
  const facebook = createFacebookSource(config.facebook);
  const runner = createJobRunner({ store, goclaw, agents: config.agents, ...config.jobs, prepare: createPreparer({ facebook }) });
  await runner.recover();

  async function jobSpec(type, input = {}) {
    const refs = {
      template: input.templateId ? store.getItem(input.templateId) : undefined,
      refJob: input.referenceJobId ? await store.getJob(String(input.referenceJobId)) : undefined,
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
    if (!job) throw new HttpError(404, "Không tìm thấy tác vụ");
    return job;
  }

  const api = express.Router();
  api.use(express.json({ limit: "256kb" }));
  api.use((req, res, next) => {
    if ((req.method === "POST" || req.method === "PUT") && req.headers["content-length"] !== "0" && req.headers["content-type"] && !req.is("application/json")) {
      return next(new HttpError(415, "Content-Type phải là application/json"));
    }
    next();
  });

  api.get("/health", async (req, res) => {
    res.json({
      goclaw: await goclaw.health(),
      agents: config.agents,
      user: config.goclaw.userId,
      store: config.store,
      sources: { facebook100: true, apifyBackup: facebook.enabled }, // 100-reel scan is free (logged-out paging); Apify optional
    });
  });

  api.get("/jobs", (req, res) => {
    const { type } = req.query;
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const jobs = store.listJobs().filter((j) => !type || j.type === type).slice(0, limit);
    res.json({ jobs: jobs.map((j) => summary(j, runner)) });
  });

  api.post("/jobs", async (req, res) => {
    const { type, input } = req.body ?? {};
    const job = await runner.submit({ type, ...(await jobSpec(type, input)) });
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

  api.post("/jobs/:id/retry", async (req, res) => {
    const job = await loadJob(req);
    if (ACTIVE.has(job.status)) throw new HttpError(409, "Tác vụ đang chạy");
    const fresh = await runner.submit({ type: job.type, ...(await jobSpec(job.type, job.input)) });
    res.status(201).json({ job: summary(fresh, runner) });
  });

  api.delete("/jobs/:id", async (req, res) => {
    const job = await loadJob(req);
    if (ACTIVE.has(job.status)) throw new HttpError(409, "Huỷ tác vụ trước khi xoá");
    await store.deleteJob(job.id);
    res.json({ ok: true });
  });

  api.get("/library", (req, res) => {
    const { kind } = req.query;
    res.json({ items: store.listLibrary().filter((x) => !kind || x.kind === kind) });
  });

  api.post("/library", async (req, res) => {
    res.status(201).json({ item: await store.addItem(libraryFields(req.body ?? {})) });
  });

  api.put("/library/:id", async (req, res) => {
    if (!store.getItem(req.params.id)) throw new HttpError(404, "Không tìm thấy mục trong thư viện");
    res.json({ item: await store.updateItem(req.params.id, libraryFields(req.body ?? {}, true)) });
  });

  api.delete("/library/:id", async (req, res) => {
    if (!store.getItem(req.params.id)) throw new HttpError(404, "Không tìm thấy mục trong thư viện");
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
  app.use(basicAuth(config.appPassword));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  }, api);

  // Built React app (npm run build). In dev, Vite serves it and proxies /api here.
  if (existsSync(CLIENT_DIST)) {
    const csp = "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com";
    app.use(express.static(CLIENT_DIST, { index: false, setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff") }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.set({ "Content-Security-Policy": csp, "Cache-Control": "no-cache" }).sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  return { app, store, runner, goclaw };
}
