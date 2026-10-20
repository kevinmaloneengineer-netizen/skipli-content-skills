import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { buildCombo, comboCost, items, section } from "../server/combos.mjs";
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
});

async function serve() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "combo-"));
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
