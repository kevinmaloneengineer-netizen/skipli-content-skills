import { test } from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { openStore } from "../server/store/index.mjs";
import { runBackup } from "../server/backup.mjs";
import { createErrorLog } from "../server/errors.mjs";

const base = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, billingEnv: { TRIAL_CREDITS: "20" }, errorEnv: {},
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};
async function serve(config = {}) {
  const app = await createApp({ ...base, ...config }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  return { s, req, app };
}

test("forgot password by email: code to the inbox, new password, signed in; no hint whether an email exists", async () => {
  const texts = [];
  const mailer = { enabled: true, send: async (m) => texts.push({ to: m.to, text: m.subject }) };
  const { s, req } = await serve({ mailer });
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me0 = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const me = await req("POST", "/api/verify", { code: texts[0].text.match(/(\d{6})/)[1] }, me0.cookie);

    // Unknown email: same answer, nothing sent.
    assert.equal((await req("POST", "/api/password/forgot", { email: "nobody@shop.com" })).status, 200);
    assert.equal(texts.length, 1);

    assert.equal((await req("POST", "/api/password/forgot", { email: "Cafe@Shop.com" })).status, 200);
    assert.equal(texts.length, 2);
    assert.match(texts[1].text, /đặt lại mật khẩu/);
    const code = texts[1].text.match(/(\d{6})/)[1];
    assert.equal((await req("POST", "/api/password/forgot", { email: "cafe@shop.com" })).status, 429); // once a minute

    assert.equal((await req("POST", "/api/password/reset", { email: "cafe@shop.com", code, password: "short" })).status, 400);
    const wrong = code === "000000" ? "111111" : "000000";
    assert.equal((await req("POST", "/api/password/reset", { email: "cafe@shop.com", code: wrong, password: "new-password-1" })).status, 400);
    const done = await req("POST", "/api/password/reset", { email: "cafe@shop.com", code, password: "new-password-1" });
    assert.equal(done.status, 200);
    assert.ok(done.cookie);
    assert.equal((await req("GET", "/api/jobs", null, done.cookie)).status, 200);
    assert.equal((await req("GET", "/api/jobs", null, me.cookie)).status, 401); // the old session is signed out
    assert.equal((await req("POST", "/api/login", { login: "cafe@shop.com", password: "password-1" })).status, 401);
    assert.equal((await req("POST", "/api/login", { login: "cafe@shop.com", password: "new-password-1" })).status, 200);
    // The code works once.
    assert.equal((await req("POST", "/api/password/reset", { email: "cafe@shop.com", code, password: "other-pass-1" })).status, 400);
  } finally {
    s.close();
  }
});

test("admin settings change the trial credits, the packs and the per-IP cap without a restart", async () => {
  const { s, req } = await serve({ signupPerIp: 5, mailEnv: {} });
  try {
    const admin = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const before = (await req("GET", "/api/admin/settings", null, admin.cookie)).body;
    assert.deepEqual(before.settings, { signupPerIp: 5, trialCredits: 20, creditPacks: "100:900,300:2400,1000:6900", heavyPerUser: 2 });
    assert.equal((await req("PUT", "/api/admin/settings", { creditPacks: "nope" }, admin.cookie)).status, 400);
    assert.equal((await req("PUT", "/api/admin/settings", { trialCredits: -1 }, admin.cookie)).status, 400);
    assert.equal((await req("PUT", "/api/admin/settings", { trialCredits: 3, signupPerIp: 1, creditPacks: "50:500, 200:1500" }, admin.cookie)).status, 200);

    const a = await req("POST", "/api/signup", { email: "a@shop.com", password: "password-1" });
    assert.equal(a.body.user.credits, 3);
    assert.equal((await req("POST", "/api/signup", { email: "b@shop.com", password: "password-1" })).status, 429); // 1 per IP now
    const billing = (await req("GET", "/api/billing", null, a.cookie)).body;
    assert.deepEqual(billing.packs.map((p) => p.credits), [50, 200]);
    assert.equal((await req("GET", "/api/admin/settings", null, a.cookie)).status, 403);
  } finally {
    s.close();
  }
});

test("error log: browser errors reach the admin page; the webhook hears the same error once per 10 minutes", async () => {
  const hooks = [];
  const fetchFn = async (url, init) => {
    hooks.push({ url, body: JSON.parse(init.body) });
    return new Response("ok");
  };
  const { s, req } = await serve({ errorEnv: { ERROR_WEBHOOK_URL: "https://hooks.example/x" }, fetchFn, mailEnv: {} });
  try {
    const admin = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    assert.equal((await req("POST", "/api/client-error", { message: "TypeError: x is undefined", path: "/write" })).status, 204); // guests too
    await req("POST", "/api/client-error", { message: "TypeError: x is undefined", path: "/write" });
    const list = (await req("GET", "/api/admin/errors", null, admin.cookie)).body;
    assert.equal(list.webhook, true);
    assert.equal(list.errors.filter((e) => e.source === "browser").length, 2);
    assert.equal(hooks.length, 1); // same message: one alert
    assert.match(hooks[0].body.text, /browser: TypeError/);
    assert.equal((await req("DELETE", "/api/admin/errors", null, admin.cookie)).status, 200);
    assert.equal((await req("GET", "/api/admin/errors", null, admin.cookie)).body.errors.length, 0);
  } finally {
    s.close();
  }
});

test("error log caps the records per hour", async () => {
  const store = await openStore(memoryAdapter());
  const log = createErrorLog({ store, env: { ERROR_LOG_PER_HOUR: "3" }, log: { error() {} } });
  for (let i = 0; i < 6; i++) await log.record({ source: "server", message: `boom ${i}` });
  assert.equal((await store.listErrors(50)).length, 3);
});

test("backup: every collection gzipped to backups/<day>.json.gz, old days removed", async () => {
  const store = await openStore(memoryAdapter());
  await store.addUser({ email: "a@b.com", passHash: "x:y" });
  await store.saveSettings({ trialCredits: 5 });
  const files = new Map([["backups/2026-09-01.json.gz", 1], ["backups/2026-10-10.json.gz", 1], ["uploads/keep.mp4", 1]]);
  const storage = {
    remote: true,
    async put(key, file) {
      files.set(key, readFileSync(file));
    },
    async list(prefix) {
      return [...files.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1, modified: 0 }));
    },
    async remove(key) {
      files.delete(key);
    },
  };
  const out = await runBackup({ store, storage, dir: mkdtempSync(path.join(tmpdir(), "bk-")), keepDays: 14, today: "2026-10-18" });
  assert.equal(out.key, "backups/2026-10-18.json.gz");
  assert.equal(out.removed, 1);
  assert.ok(!files.has("backups/2026-09-01.json.gz"));
  assert.ok(files.has("backups/2026-10-10.json.gz") && files.has("uploads/keep.mp4"));
  const saved = JSON.parse(gunzipSync(files.get(out.key)));
  assert.equal(saved.data.users[0].email, "a@b.com");
  assert.equal(saved.data.meta[0].trialCredits, 5);
  await assert.rejects(runBackup({ store, storage: { remote: false }, dir: tmpdir() }), /lưu trữ/);
});

test("shutdown drain waits for the running job, then nothing new starts", async () => {
  const { s, req, app } = await serve({ accounts: false, signup: false, goclaw: { ...base.goclaw, mockDelayMs: 300 } });
  try {
    const a = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "a" } });
    const b = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "b" } });
    for (let i = 0; i < 40 && app.store.cachedJob(a.body.job.id).status !== "running"; i++) await new Promise((r) => setTimeout(r, 25));
    const left = await app.runner.drain(5000);
    assert.equal(left, 0);
    assert.equal(app.store.cachedJob(a.body.job.id).status, "done");
    assert.equal(app.store.cachedJob(b.body.job.id).status, "queued"); // waits for the next boot
  } finally {
    s.close();
  }
});
