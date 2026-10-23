import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { moneyStats } from "../server/stats.mjs";

async function serve() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "ops2-"));
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, mailEnv: {}, errorEnv: {}, billingEnv: { TRIAL_CREDITS: "10" },
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 20 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
    video: { dataDir, timeoutMs: 60_000, mock: true },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const boss = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
  const a = await req("POST", "/api/signup", { email: "a@shop.com", password: "password-1" });
  const b = await req("POST", "/api/signup", { email: "b@shop.com", password: "password-1" });
  return { s, req, app, boss: boss.cookie, a, b };
}

const MENU = { name: "Phở Cali", theme: "noir", color: "#d4a64a", sections: [{ title: "Món chính", items: [{ name: "Phở bò", price: "65.000đ", desc: "Nước dùng 12 tiếng" }] }] };

test("menus: saved per account, the online page opens without a login, kept out of the library", async () => {
  const { s, req, a, b } = await serve();
  try {
    assert.equal((await req("POST", "/api/menus", { name: "Trống", sections: [] }, a.cookie)).status, 400);
    const made = await req("POST", "/api/menus", MENU, a.cookie);
    assert.equal(made.status, 201);
    const id = made.body.menu.id;
    const pub = await req("GET", `/api/public/menus/${id}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.menu.sections[0].items[0].price, "65.000đ");
    assert.equal(pub.body.menu.theme, "noir");
    assert.equal((await req("GET", "/api/public/menus/nope")).status, 404);
    // Another shop can neither see nor change it; the library does not list it.
    assert.equal((await req("GET", "/api/menus", null, b.cookie)).body.menus.length, 0);
    assert.equal((await req("PUT", `/api/menus/${id}`, MENU, b.cookie)).status, 404);
    assert.ok(!(await req("GET", "/api/library", null, a.cookie)).body.items.some((x) => x.kind === "menu"));
    const edited = await req("PUT", `/api/menus/${id}`, { ...MENU, name: "Phở Cali 2" }, a.cookie);
    assert.equal(edited.body.menu.title, "Phở Cali 2");
    assert.equal((await req("DELETE", `/api/menus/${id}`, null, a.cookie)).status, 200);
    assert.equal((await req("GET", `/api/public/menus/${id}`)).status, 404);
  } finally {
    s.close();
  }
});

test("heavy runs: one account cannot start more GPU/video work than the admin allows", async () => {
  const { s, req, app, boss, a } = await serve();
  try {
    assert.equal((await req("PUT", "/api/admin/settings", { heavyPerUser: 1 }, boss)).status, 200);
    assert.equal((await req("GET", "/api/admin/settings", null, boss)).body.settings.heavyPerUser, 1);
    await app.store.addJob({ id: "busy-1", userId: a.body.user.id, type: "video", status: "running", input: {}, title: "x", createdAt: new Date().toISOString() });
    const refused = await req("POST", "/api/jobs", { type: "image", input: { topic: "Phở" } }, a.cookie);
    assert.equal(refused.status, 429);
    assert.match(refused.body.error, /tối đa 1 tác vụ/);
    // Light work is not limited.
    assert.notEqual((await req("POST", "/api/jobs", { type: "hashtag", input: { topic: "phở bò" } }, a.cookie)).status, 429);
  } finally {
    s.close();
  }
});

test("restyle: only finished slideshows, a real template; 1 credit, given back when the render fails", async () => {
  const { s, req, app, a } = await serve();
  try {
    const uid = a.body.user.id;
    const now = new Date().toISOString();
    await app.store.addJob({ id: "text-1", userId: uid, type: "write", status: "done", input: {}, title: "x", createdAt: now });
    assert.equal((await req("POST", "/api/jobs/text-1/restyle", { layout: "neon" }, a.cookie)).status, 409);
    await app.store.addJob({ id: "slides-1", userId: uid, type: "video", status: "done", title: "Video", createdAt: now, input: { mode: "slideshow", layout: "collage", ratio: "9:16", seconds: 15 }, slides: [{ image: "missing-1.png", role: "food" }, { image: "missing-2.png", role: "ext" }], video: { file: "slides-1.mp4", shots: [] } });
    assert.equal((await req("POST", "/api/jobs/slides-1/restyle", { layout: "nope" }, a.cookie)).status, 400);
    assert.equal((await req("POST", "/api/jobs/slides-1/restyle", { layout: "promo" }, a.cookie)).status, 400); // needs an offer
    const made = await req("POST", "/api/jobs/slides-1/restyle", { layout: "neon" }, a.cookie);
    assert.equal(made.status, 201);
    assert.equal(made.body.job.input.layout, "neon");
    assert.equal(made.body.job.input.restyledFrom, "slides-1");
    assert.equal(app.store.getUser(uid).credits, 9);
    // The photos do not exist here, so the render fails and the credit comes back.
    let job;
    // A restyle waits its turn on the job queue first ("queued"), then renders ("running").
    for (let i = 0; i < 400; i++) {
      job = app.store.cachedJob(made.body.job.id);
      if (!["queued", "running"].includes(job.status)) break;
      await sleep(50);
    }
    assert.equal(job.status, "failed");
    assert.equal(app.store.getUser(uid).credits, 10);
  } finally {
    s.close();
  }
});

test("money stats: net of lost disputes, credits per tool, rough cost", () => {
  const users = [
    { id: "u1", role: "member", credits: 40, email: "a@x", payments: [{ id: "p1", credits: 100, amount: 900, currency: "usd", at: "2026-10-19T03:00:00Z" }] },
    { id: "u2", role: "member", credits: 0, email: "b@x", payments: [{ id: "p2", credits: 100, amount: 900, currency: "usd", at: "2026-10-18T03:00:00Z", disputed: "dp_1", disputeClosed: "lost" }] },
    { id: "admin", role: "admin" },
  ];
  const jobs = [
    { type: "video", status: "done", credits: 5, usage: { total_tokens: 2000 } },
    { type: "video", status: "failed", credits: 5, refunded: true },
    { type: "write", status: "done", credits: 1, usage: { total_tokens: 1000 } },
  ];
  const out = moneyStats({ users, jobs, today: "2026-10-20", dayOf: (iso) => iso.slice(0, 10) });
  assert.deepEqual(out.revenue, { gross: 1800, disputed: 900, net: 900, payments: 2, payers: 1, members: 2 });
  assert.equal(out.credits.sold, 100);
  assert.equal(out.credits.balance, 40);
  const video = out.tools.find((t) => t.type === "video");
  assert.equal(video.credits, 5); // the refunded run is not counted
  assert.equal(video.earnedCents, 45);
  assert.ok(video.costUsd > 0.02);
  assert.equal(out.daily.length, 30);
  assert.equal(out.daily.at(-2).amount, 900);
});

test("money stats: free trial credits spent do not count as money earned", () => {
  // 50 trial accounts spent their 20 free credits each; one shop bought 100 credits for $9 and still has them all.
  const users = [{ id: "buyer", role: "member", credits: 100, payments: [{ id: "p", credits: 100, amount: 900, currency: "usd", at: "2026-10-19T03:00:00Z" }] }];
  for (let k = 0; k < 50; k++) users.push({ id: `t${k}`, role: "member", credits: 0 });
  const jobs = Array.from({ length: 200 }, () => ({ type: "video", status: "done", credits: 5 }));
  const out = moneyStats({ users, jobs, today: "2026-10-20", dayOf: (iso) => iso.slice(0, 10) });
  const earned = out.tools.reduce((a, t) => a + t.earnedCents, 0);
  assert.ok(earned <= 900, `earned ${earned} > the $9 actually paid`);
  assert.equal(out.credits.paidShare, +(100 / 1100).toFixed(3));
});
