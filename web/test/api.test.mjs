import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";

// Memory by default; the real Firestore adapter when the emulator is running (npm run test:firestore).
let newAdapter = memoryAdapter;
if (process.env.FIRESTORE_EMULATOR_HOST) {
  const { randomUUID } = await import("node:crypto");
  const { connectFirestore, firestoreAdapter } = await import("../server/store/firestore.mjs");
  const db = connectFirestore({ projectId: "demo-skipli-test" });
  newAdapter = () => firestoreAdapter(db, `api${randomUUID().slice(0, 8)}_`);
}

let ctx, server, base, adapter;

function config(overrides = {}) {
  return {
    port: 0,
    host: "127.0.0.1",
    store: "memory",
    appPassword: "",
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 150 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
    ...overrides,
  };
}

async function listen(app) {
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  return s;
}

async function call(method, p, body, headers = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { ...(body !== undefined && { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function waitFor(id, statuses) {
  for (let i = 0; i < 100; i++) {
    const { body } = await call("GET", `/api/jobs/${id}`);
    if (statuses.includes(body.job.status)) return body.job;
    await sleep(50);
  }
  throw new Error(`job ${id} never reached ${statuses}`);
}

before(async () => {
  adapter = newAdapter();
  ctx = await createApp(config(), adapter);
  server = await listen(ctx.app);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (let i = 0; i < 100 && ctx.store.listJobs().some((j) => j.status === "queued" || j.status === "running"); i++) await sleep(50);
  server.close();
});

test("health reports mock mode and store", async () => {
  const { status, body } = await call("GET", "/api/health");
  assert.equal(status, 200);
  assert.deepEqual(body.goclaw, { ok: true, mock: true });
  assert.equal(body.store, "memory");
});

test("library is seeded once with templates", async () => {
  const { body } = await call("GET", "/api/library?kind=template");
  assert.ok(body.items.length >= 5);
  const again = await createApp(config(), adapter); // same database, second boot
  assert.equal(again.store.listLibrary().length, body.items.length, "no duplicate seeding");
});

test("jobs run FIFO one at a time and finish", async () => {
  const a = (await call("POST", "/api/jobs", { type: "fb-reels", input: { url: "https://www.facebook.com/natgeo/reels/" } })).body.job;
  const b = (await call("POST", "/api/jobs", { type: "threads", input: { keywords: ["marketing"] } })).body.job;
  assert.equal(a.status, "running", "idle runner starts the first job immediately");
  assert.equal(b.status, "queued");
  const list = (await call("GET", "/api/jobs")).body.jobs;
  assert.equal(list.find((j) => j.id === b.id).queuePosition, 1, "second job waits behind the first");
  assert.equal(list[0].prompt, undefined, "list omits prompt/result");

  const doneA = await waitFor(a.id, ["done"]);
  assert.match(doneA.result, /Đã quét/);
  const doneB = await waitFor(b.id, ["done"]);
  assert.match(doneB.result, /Pattern chung/);
  assert.ok(new Date(doneB.startedAt) >= new Date(doneA.finishedAt));
  assert.equal((await adapter.loadJob(b.id)).status, "done", "persisted through the adapter");
});

test("100-reel channel scan: free path tells the skill to page 100 reels itself", async () => {
  const j = (await call("POST", "/api/jobs", { type: "fb-reels", input: { url: "https://www.facebook.com/someshop/reels/", depth: 100 } })).body.job;
  assert.equal(j.input.depth, 100);
  const done = await waitFor(j.id, ["done"]);
  assert.match(done.prompt, /Quét 100 reel gần nhất .*--count 100/);
  assert.equal(done.notice, null, "no backup configured is not an error");
  assert.equal(done.phase, null, "phase cleared when finished");
  const health = (await call("GET", "/api/health")).body;
  assert.deepEqual(health.sources, { facebook100: true, apifyBackup: false });
  const quick = (await call("POST", "/api/jobs", { type: "fb-reels", input: { url: "https://www.facebook.com/someshop/", depth: 10 } })).body.job;
  assert.match((await waitFor(quick.id, ["done"])).prompt, /--count 10/);
});

test("type filter on job list", async () => {
  const { body } = await call("GET", "/api/jobs?type=threads");
  assert.ok(body.jobs.length >= 1);
  assert.ok(body.jobs.every((j) => j.type === "threads"));
});

test("invalid input → 400/415 with Vietnamese message", async () => {
  const { status, body } = await call("POST", "/api/jobs", { type: "write", input: { topic: "" } });
  assert.equal(status, 400);
  assert.match(body.error, /Thiếu chủ đề/);
  assert.equal((await call("POST", "/api/jobs", "x", { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await call("POST", "/api/jobs", "{bad", { "Content-Type": "application/json" })).status, 400);
  assert.equal((await call("GET", "/api/nope")).status, 404);
});

test("failed job keeps the error; retry creates a new job", async () => {
  const j = (await call("POST", "/api/jobs", { type: "write", input: { topic: "mock-fail please" } })).body.job;
  const failed = await waitFor(j.id, ["failed"]);
  assert.match(failed.error, /Mock failure/);
  const { status, body } = await call("POST", `/api/jobs/${j.id}/retry`);
  assert.equal(status, 201);
  assert.notEqual(body.job.id, j.id);
  await waitFor(body.job.id, ["failed"]);
});

test("cancel a running job and a queued job", async () => {
  const run = (await call("POST", "/api/jobs", { type: "write", input: { topic: "a" } })).body.job;
  const queued = (await call("POST", "/api/jobs", { type: "write", input: { topic: "b" } })).body.job;
  await waitFor(run.id, ["running"]);
  assert.equal((await call("DELETE", `/api/jobs/${run.id}`)).status, 409, "cannot delete while running");
  assert.equal((await call("POST", `/api/jobs/${queued.id}/cancel`)).status, 200);
  assert.equal((await call("POST", `/api/jobs/${run.id}/cancel`)).status, 200);
  assert.equal((await waitFor(run.id, ["canceled"])).error, null);
  assert.equal((await waitFor(queued.id, ["canceled"])).startedAt, null);
  assert.equal((await call("POST", `/api/jobs/${run.id}/cancel`)).status, 409);
  assert.equal((await call("DELETE", `/api/jobs/${run.id}`)).status, 200);
  assert.equal((await call("GET", `/api/jobs/${run.id}`)).status, 404);
  assert.equal(await adapter.loadJob(run.id), undefined, "deleted from the database");
});

test("write can reference a finished scan and a template", async () => {
  const scan = (await call("POST", "/api/jobs", { type: "threads", input: { profiles: ["@zuck"] } })).body.job;
  await waitFor(scan.id, ["done"]);
  const tpl = (await call("GET", "/api/library?kind=template")).body.items[0];
  const w = (await call("POST", "/api/jobs", { type: "write", input: { topic: "SEO", templateId: tpl.id, referenceJobId: scan.id } })).body.job;
  const done = await waitFor(w.id, ["done"]);
  assert.ok(done.prompt.includes(`Theo cấu trúc mẫu "${tpl.title}"`));
  assert.match(done.prompt, /THAM KHẢO/);
  const bad = await call("POST", "/api/jobs", { type: "write", input: { topic: "SEO", templateId: "missing" } });
  assert.equal(bad.status, 400);
});

test("library CRUD with validation", async () => {
  assert.equal((await call("POST", "/api/library", { kind: "bogus", title: "x", body: "y" })).status, 400);
  assert.equal((await call("POST", "/api/library", { kind: "saved", title: "", body: "y" })).status, 400);
  const { status, body } = await call("POST", "/api/library", { kind: "saved", title: "Bài 1", body: "Nội dung", tags: "a, b, a", platform: "threads" });
  assert.equal(status, 201);
  assert.deepEqual(body.item.tags, ["a", "b"]);
  const upd = await call("PUT", `/api/library/${body.item.id}`, { title: "Bài 1 (sửa)" });
  assert.equal(upd.body.item.title, "Bài 1 (sửa)");
  assert.equal(upd.body.item.body, "Nội dung", "partial update keeps other fields");
  assert.equal((await adapter.loadLibrary()).find((x) => x.id === body.item.id).title, "Bài 1 (sửa)");
  assert.equal((await call("DELETE", `/api/library/${body.item.id}`)).status, 200);
  assert.equal((await call("PUT", `/api/library/${body.item.id}`, { title: "x" })).status, 404);
});

test("restart marks in-flight jobs as interrupted and resumes the queue", async () => {
  const run = (await call("POST", "/api/jobs", { type: "write", input: { topic: "r1" } })).body.job;
  const queued = (await call("POST", "/api/jobs", { type: "write", input: { topic: "r2" } })).body.job;
  await waitFor(run.id, ["running"]);

  // Second app instance on the same database simulates a restart.
  const app2 = await createApp(config(), adapter);
  assert.equal(app2.store.cachedJob(run.id).status, "failed");
  assert.match(app2.store.cachedJob(run.id).error, /khởi động lại/);
  for (let i = 0; i < 100 && app2.store.cachedJob(queued.id).status !== "done"; i++) await sleep(50);
  assert.equal(app2.store.cachedJob(queued.id).status, "done");
  await waitFor(run.id, ["done", "failed"]); // let the first instance settle too
});

test("APP_PASSWORD enables basic auth", async () => {
  const locked = await createApp(config({ appPassword: "s3cret" }), newAdapter());
  const s = await listen(locked.app);
  const url = `http://127.0.0.1:${s.address().port}/api/health`;
  assert.equal((await fetch(url)).status, 401);
  const auth = { Authorization: `Basic ${Buffer.from("any:s3cret").toString("base64")}` };
  assert.equal((await fetch(url, { headers: auth })).status, 200);
  const wrong = { Authorization: `Basic ${Buffer.from("any:nope").toString("base64")}` };
  assert.equal((await fetch(url, { headers: wrong })).status, 401);
  s.close();
});

test("login page session: cookie from /api/login opens the API, logout closes it", async () => {
  const locked = await createApp(config({ appPassword: "s3cret" }), newAdapter());
  const s = await listen(locked.app);
  const root = `http://127.0.0.1:${s.address().port}`;
  const post = (p, body, headers = {}) => fetch(root + p, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.deepEqual(await (await fetch(`${root}/api/session`)).json(), { mode: "password", required: true, signedIn: false });
  assert.equal((await post("/api/login", { password: "nope" })).status, 401);
  const ok = await post("/api/login", { password: "s3cret" });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get("set-cookie").split(";")[0];
  assert.match(ok.headers.get("set-cookie"), /HttpOnly/);
  assert.equal((await fetch(`${root}/api/health`, { headers: { cookie } })).status, 200);
  assert.equal((await fetch(`${root}/api/health`, { headers: { cookie: "skipli_session=forged" } })).status, 401);
  assert.equal((await fetch(`${root}/media/clips/v1234567890.mp4`)).status, 401);
  const out = await post("/api/logout", {}, { cookie });
  assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
  s.close();
});

test("samples, rewrite and live phases", async () => {
  const sample = await call("GET", "/api/samples/maps");
  assert.equal(sample.status, 200);
  assert.equal(sample.body.job.sample, true);
  assert.match(sample.body.job.result, /Tổng quan/);
  assert.equal((await call("GET", "/api/samples/video")).status, 404);
  assert.match((await call("GET", "/api/samples/plan")).body.job.input.start, /^\d{4}-\d{2}-\d{2}$/);

  const rw = await call("POST", "/api/rewrite", { text: "Lẩu bò nhúng giấm ngon tuyệt, ghé quán nhé!", style: "shorter" });
  assert.equal(rw.status, 200);
  assert.ok(rw.body.text.length > 0);
  assert.equal((await call("POST", "/api/rewrite", { text: "Lẩu bò nhúng giấm ngon", style: "bogus" })).status, 400);
});

test("customer accounts: setup admin, each customer sees only their own data, admin can disable", async () => {
  const app = await createApp(config({ accounts: true, goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 } }), newAdapter());
  const s = await listen(app.app);
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    assert.equal((await req("GET", "/api/session")).body.setup, true);
    assert.equal((await req("GET", "/api/jobs")).status, 401);
    const admin = await req("POST", "/api/setup", { email: "Boss@Example.com", password: "admin-pass-1", name: "Boss" });
    assert.equal(admin.status, 201);
    assert.equal(admin.body.user.role, "admin");
    assert.equal((await req("POST", "/api/setup", { email: "x@y.com", password: "12345678" })).status, 409); // only once

    for (const email of ["a@shop.com", "b@shop.com"]) assert.equal((await req("POST", "/api/admin/users", { email, password: "customer-1", dailyLimit: 1 }, admin.cookie)).status, 201);
    const a = await req("POST", "/api/login", { email: "a@shop.com", password: "customer-1" });
    const b = await req("POST", "/api/login", { email: "b@shop.com", password: "customer-1" });
    assert.equal((await req("POST", "/api/login", { email: "a@shop.com", password: "wrong-pass" })).status, 401);
    assert.equal((await req("GET", "/api/admin/users", null, a.cookie)).status, 403);
    assert.equal((await req("PUT", "/api/video/worker", { url: "https://evil.example", token: "x" }, a.cookie)).status, 403); // the GPU is the admin's

    const job = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Lẩu bò" } }, a.cookie);
    assert.equal(job.status, 201);
    assert.equal((await req("GET", `/api/jobs/${job.body.job.id}`, null, a.cookie)).status, 200);
    assert.equal((await req("GET", `/api/jobs/${job.body.job.id}`, null, b.cookie)).status, 404);
    assert.equal((await req("GET", "/api/jobs", null, b.cookie)).body.jobs.length, 0);
    assert.equal((await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Lẩu gà" } }, a.cookie)).status, 429); // daily limit 1

    await req("POST", "/api/library", { kind: "saved", title: "Bài của A", body: "Nội dung" }, a.cookie);
    const libB = (await req("GET", "/api/library?kind=saved", null, b.cookie)).body.items;
    assert.equal(libB.length, 0);
    assert.ok((await req("GET", "/api/library?kind=template", null, b.cookie)).body.items.length > 0); // starter templates are shared

    const users = (await req("GET", "/api/admin/users", null, admin.cookie)).body.users;
    const ua = users.find((u) => u.email === "a@shop.com");
    assert.equal(ua.today, 1);
    assert.equal(users[0].passHash, undefined); // never sent
    await req("PUT", `/api/admin/users/${ua.id}`, { disabled: true }, admin.cookie);
    assert.equal((await req("GET", "/api/jobs", null, a.cookie)).status, 401); // a disabled account is signed out
  } finally {
    s.close();
  }
});
