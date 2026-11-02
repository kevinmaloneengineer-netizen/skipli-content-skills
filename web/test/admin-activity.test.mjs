import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { errorKind, redact } from "../server/errors.mjs";

const base = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: false, signupPerIp: 0,
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("admin activity: who ran which tool and how it went, never what was typed or the result", async () => {
  const { app, store } = await createApp(base, memoryAdapter());
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    const admin = (await req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1" })).cookie;
    const made = await req("POST", "/api/admin/users", { email: "an@shop.vn", password: "member-pass-1", name: "Quán An" }, admin);
    const an = (await req("POST", "/api/login", { login: "an@shop.vn", password: "member-pass-1" })).cookie;
    const job = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Lẩu bò bí mật nhà An" } }, an);
    assert.equal(job.status, 201);
    for (let i = 0; i < 50 && store.cachedJob(job.body.job.id).status !== "done"; i++) await sleep(50);
    // A failed run whose message quotes the customer's shop.
    await store.addJob({ id: "00000000-0000-4000-8000-000000000001", type: "maps", userId: made.body.user.id, status: "failed", error: 'Không tìm thấy "Phở Bí Mật, 12 Lê Lợi" trên Google Maps.', title: "Maps · Phở Bí Mật", input: { place: "Phở Bí Mật" }, credits: 2, refunded: true, createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });

    const out = await req("GET", "/api/admin/activity", null, admin);
    assert.equal(out.status, 200);
    const raw = JSON.stringify(out.body);
    for (const secret of ["Lẩu bò bí mật", "Phở Bí Mật", "Lê Lợi"]) assert.ok(!raw.includes(secret), `leaked: ${secret}`);
    const [failed, done] = out.body.rows;
    assert.deepEqual({ type: failed.type, status: failed.status, error: failed.error, credits: failed.credits, refunded: failed.refunded, userId: failed.userId }, { type: "maps", status: "failed", error: "Không tìm thấy quán hoặc dữ liệu", credits: 2, refunded: true, userId: made.body.user.id });
    assert.equal(done.type, "write");
    assert.equal(done.status, "done");
    for (const k of ["input", "title", "result", "prompt"]) assert.equal(k in done, false, k);
    // Filters.
    assert.equal((await req("GET", "/api/admin/activity?status=failed", null, admin)).body.rows.length, 1);
    assert.equal((await req("GET", "/api/admin/activity?type=write", null, admin)).body.rows.length, 1);
    // Only the admin.
    assert.equal((await req("GET", "/api/admin/activity", null, an)).status, 403);
    assert.equal((await req("GET", "/api/admin/skill-stats", null, an)).status, 403);

    // Per tool: runs, failures, people, credits kept (a refunded run brings none).
    const stats = (await req("GET", "/api/admin/skill-stats?days=7", null, admin)).body;
    assert.equal(stats.days, 7);
    const maps = stats.rows.find((r) => r.type === "maps");
    assert.deepEqual({ runs: maps.runs, failed: maps.failed, users: maps.users, credits: maps.credits }, { runs: 1, failed: 1, users: 1, credits: 0 });
    assert.equal(stats.rows.find((r) => r.type === "write").runs, 1);

    // The error log hides the customer's words too.
    await store.addError({ id: "e1", createdAt: new Date().toISOString(), source: "job", message: 'Không tìm thấy "Phở Bí Mật, 12 Lê Lợi" trên Google Maps.' });
    const log = JSON.stringify((await req("GET", "/api/admin/errors", null, admin)).body);
    assert.ok(!log.includes("Phở Bí Mật") && log.includes("Không tìm thấy “…” trên Google Maps."));
  } finally {
    s.close();
  }
});

test("error kinds and redaction", () => {
  assert.equal(errorKind("Bị gián đoạn do server khởi động lại. Hãy chạy lại."), "Gián đoạn do server khởi động lại");
  assert.equal(errorKind("GPU worker lỗi 404"), "GPU / máy dựng video");
  assert.equal(errorKind("fetch failed"), "Lỗi mạng");
  assert.equal(errorKind("Groq 429"), "AI đang bận hoặc hết lượt");
  assert.equal(errorKind("something odd"), "Lỗi khác");
  assert.equal(errorKind(null), null);
  assert.equal(redact('Google Maps chỉ thấy 2 quán "tacos" quanh East End, Houston, TX. Thử lại.'), "Google Maps chỉ thấy 2 quán “…” quanh …. Thử lại.");
  assert.equal(redact("Không đọc được đủ quán để so sánh (A, B)."), "Không đọc được đủ quán để so sánh (…).");
});
