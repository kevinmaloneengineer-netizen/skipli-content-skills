import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { buildCombo, comboCost, dishNames, firstPromo, items, section } from "../server/combos.mjs";
import { costOf } from "../server/billing.mjs";

test("combo helpers: report sections, table rows, costs, form checks", () => {
  const md = "## Tổng quan\nok\n\n## Khách khen gì\n| Điểm khen | Số bài nhắc |\n|---|---|\n| Nước lẩu đậm đà | 24 |\n| Thịt bò mềm | 18 |\n\n## Khách chê gì\n- Vệ sinh\n";
  assert.deepEqual(items(section(md, "Khách khen gì")), ["Nước lẩu đậm đà (24 lượt nhắc)", "Thịt bò mềm (18 lượt nhắc)"]);
  assert.deepEqual(items(section(md, "Khách chê gì")), ["Vệ sinh"]);
  assert.equal(section(md, "Không có"), null);
  assert.equal(comboCost("launch", costOf), 8);
  assert.equal(comboCost("care", costOf), 4);
  assert.throws(() => buildCombo({ recipe: "launch", dish: "Phở" }, { hasUpload: () => true }), /ảnh/);
  assert.throws(() => buildCombo({ recipe: "nope" }), /Gói/);
  assert.equal(buildCombo({ recipe: "care", place: "Phở Cali" }).input.business, "Phở Cali");
  assert.equal(comboCost("promo", costOf), 4);
  assert.equal(comboCost("us-launch", costOf), 3);
  assert.throws(() => buildCombo({ recipe: "promo", business: "Phở Cali", dishes: "Phở bò - 65.000" }), /2 món/);
  assert.throws(() => buildCombo({ recipe: "us-launch", business: "Pho Cali", dishes: "Pho - $14" }), /khu phố/);
  assert.equal(dishNames("Phở Tái - $14.95 - rare beef\nGỏi Cuốn - $7\n"), "Phở Tái, Gỏi Cuốn");
  const promo = firstPromo("Intro\n\n## Phương án 1: Combo trưa\n**Gồm:** 1 Phở bò + 1 Trà đá\n**Áp dụng:** 11h đến 14h\n\n| | Số tiền |\n|---|---|\n| Giá khuyến mãi | **65.000đ** (giảm 7%) |\n\n**Câu quảng bá:** Combo trưa 65k.\n\n## Phương án 2: Khác\n**Gồm:** x");
  assert.deepEqual(promo, { title: "Combo trưa", facts: "Gồm: 1 Phở bò + 1 Trà đá\nÁp dụng: 11h đến 14h\nGiá khuyến mãi: 65.000đ (giảm 7%)\nCâu quảng bá: Combo trưa 65k." });
  assert.equal(firstPromo("no plan"), null);
});

async function serve(adapter = memoryAdapter()) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "combo-"));
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, mailEnv: {}, errorEnv: {}, billingEnv: { TRIAL_CREDITS: "10" },
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 20 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
    video: { dataDir, timeoutMs: 60_000, mock: true },
  }, adapter);
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const finish = async (id, cookie) => {
    for (let i = 0; i < 300; i++) {
      const job = (await req("GET", `/api/jobs/${id}`, null, cookie)).body.job;
      if (["done", "failed", "canceled"].includes(job.status)) return job;
      await sleep(100);
    }
    throw new Error("combo did not finish");
  };
  return { s, req, app, finish };
}

test("care combo: Maps report, then a reply to the complaints and a Google post from the praise; each step pays its credits", async () => {
  const { s, req, app, finish } = await serve();
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const made = await req("POST", "/api/jobs", { type: "combo", input: { recipe: "care", place: "Lẩu Bò Phố", business: "Lẩu Bò Phố" } }, me.cookie);
    assert.equal(made.status, 201);
    const combo = await finish(made.body.job.id, me.cookie);
    assert.equal(combo.status, "done", combo.error);
    assert.deepEqual(combo.steps.map((x) => [x.type, x.status]), [["maps", "done"], ["review", "done"], ["gbp-post", "done"]]);
    // The later steps were fed by the report.
    const review = app.store.cachedJob(combo.steps[1].jobId);
    assert.match(review.input.review, /Vệ sinh \(9 lượt nhắc\)/);
    const gbp = app.store.cachedJob(combo.steps[2].jobId);
    assert.match(gbp.input.promote, /Nước lẩu đậm đà/);
    assert.equal(app.store.getUser(me.body.user.id).credits, 10 - 4);
  } finally {
    s.close();
  }
});

test("launch combo: fixed photo feeds the slideshow; not enough credits is refused up front", async (t) => {
  try {
    execFileSync("python3", ["-c", "import numpy, PIL"]);
    execFileSync("ffmpeg", ["-version"]);
  } catch {
    return t.skip("needs numpy, Pillow and ffmpeg");
  }
  const { s, req, app, finish } = await serve();
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const b64 = execFileSync("python3", ["-c", "import io,base64;from PIL import Image;im=Image.new('RGB',(800,600),(90,60,40));b=io.BytesIO();im.save(b,'JPEG');print(base64.b64encode(b.getvalue()).decode())"]).toString().trim();
    const up = await req("POST", "/api/uploads", { dataUrl: `data:image/jpeg;base64,${b64}` }, me.cookie);
    const input = { recipe: "launch", photoId: up.body.id, dish: "Phở bò cay", business: "Phở Cali", details: "Có trong tuần này" };
    // 10 credits, the combo needs 8: fine. Then 2 left: refused before anything runs.
    const made = await req("POST", "/api/jobs", { type: "combo", input }, me.cookie);
    assert.equal(made.status, 201);
    const combo = await finish(made.body.job.id, me.cookie);
    assert.deepEqual(combo.steps.map((x) => x.type), ["photo-fix", "write", "gbp-post", "video"]);
    assert.equal(combo.steps[0].status, "done");
    assert.equal(combo.steps[1].status, "done");
    const videoJob = app.store.cachedJob(combo.steps[3].jobId);
    assert.ok(videoJob, combo.steps[3].error);
    assert.equal(videoJob.input.photoIds.length, 1); // the fixed photo, imported as an upload
    const spent = combo.steps.reduce((n, x) => n + (x.status === "done" || x.status === "running" ? x.credits ?? 0 : 0), 0);
    assert.ok(spent >= 3);
    await app.store.updateUser(me.body.user.id, { credits: 2 });
    const refused = await req("POST", "/api/jobs", { type: "combo", input }, me.cookie);
    assert.equal(refused.status, 402);
    assert.match(refused.body.error, /gói này cần 8 credit/);
  } finally {
    s.close();
  }
});

test("promo combo: the plan's first option (server-worked price) feeds the Facebook post, the Zalo message and the Google post", async () => {
  const { s, req, app, finish } = await serve();
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const made = await req("POST", "/api/jobs", { type: "combo", input: { recipe: "promo", business: "Phở Cali", dishes: "Phở bò - 65.000 - 28.000\nTrà đá - 5.000 - 1.000" } }, me.cookie);
    assert.equal(made.status, 201);
    const combo = await finish(made.body.job.id, me.cookie);
    assert.equal(combo.status, "done", combo.error);
    assert.deepEqual(combo.steps.map((x) => [x.type, x.status]), [["promo-plan", "done"], ["write", "done"], ["zalo-message", "done"], ["gbp-post", "done"]]);
    const write = app.store.cachedJob(combo.steps[1].jobId);
    assert.match(write.input.brief, /Giá khuyến mãi: 65\.000đ/);
    assert.match(app.store.cachedJob(combo.steps[2].jobId).input.details, /Combo trưa văn phòng/);
    assert.equal(app.store.cachedJob(combo.steps[3].jobId).input.button, "offer");
    assert.equal(app.store.getUser(me.body.user.id).credits, 10 - 4);
  } finally {
    s.close();
  }
});

test("US launch combo: delivery menu, a Nextdoor hello and the US occasions from one form", async () => {
  const { s, req, app, finish } = await serve();
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const made = await req("POST", "/api/jobs", { type: "combo", input: { recipe: "us-launch", business: "Pho Cali", neighborhood: "Bay View, Milwaukee", dishes: "Phở Tái - $14.95 - rare beef\nGỏi Cuốn - $7 - shrimp" } }, me.cookie);
    assert.equal(made.status, 201);
    const combo = await finish(made.body.job.id, me.cookie);
    assert.equal(combo.status, "done", combo.error);
    assert.deepEqual(combo.steps.map((x) => [x.type, x.status]), [["delivery-menu", "done"], ["nextdoor-post", "done"], ["us-occasions", "done"]]);
    assert.equal(app.store.cachedJob(combo.steps[2].jobId).input.serves, "Phở Tái, Gỏi Cuốn");
    assert.equal(app.store.getUser(me.body.user.id).credits, 10 - 3);
  } finally {
    s.close();
  }
});

test("heavy runs: quick clicks at once cannot get past the cap per account", async () => {
  // Saving a job takes a moment, like Firestore: the window the second click used to slip through.
  const adapter = memoryAdapter();
  const saveJob = adapter.saveJob.bind(adapter);
  adapter.saveJob = async (j) => (await sleep(150), saveJob(j));
  const { s, req } = await serve(adapter);
  try {
    const admin = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    assert.equal((await req("PUT", "/api/admin/settings", { heavyPerUser: 1 }, admin.cookie)).status, 200);
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const body = { type: "combo", input: { recipe: "us-launch", business: "Pho Cali", neighborhood: "Bay View", dishes: "Pho - $14" } };
    const tries = await Promise.all([1, 2, 3].map(() => req("POST", "/api/jobs", body, me.cookie)));
    assert.deepEqual(tries.map((t) => t.status).sort(), [201, 429, 429]);
  } finally {
    s.close();
  }
});
