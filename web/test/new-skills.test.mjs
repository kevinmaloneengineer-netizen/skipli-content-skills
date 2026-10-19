import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { buildJob, InputError } from "../server/prompts.mjs";

test("gbp-post: the button, the real details and English for a US restaurant", () => {
  const job = buildJob("gbp-post", { business: "Pho Cali, Milwaukee", promote: "New spicy beef pho this week", button: "book", details: "Open 11am to 9pm" });
  assert.equal(job.direct, "gbp-post");
  assert.equal(job.input.button, "book");
  assert.equal(job.input.lang, "en");
  assert.match(job.prompt, /Đặt bàn \(Book\)/);
  assert.match(job.prompt, /Open 11am to 9pm/);
  assert.equal(buildJob("gbp-post", { business: "Phở Cali", promote: "Món mới phở bò cay", button: "nope" }).input.button, "learn");
  assert.throws(() => buildJob("gbp-post", { business: "Phở Cali" }), InputError);
});

test("photo-fix: needs a photo and at least one known frame", () => {
  const refs = { hasUpload: () => true };
  const job = buildJob("photo-fix", { photoId: "a.jpg", look: "warm", ratios: ["9:16", "3:2", "1:1"] }, refs);
  assert.deepEqual(job.input.ratios, ["9:16", "1:1"]);
  assert.equal(job.input.look, "warm");
  assert.equal(buildJob("photo-fix", { photoId: "a.jpg", look: "neon", ratios: ["1:1"] }, refs).input.look, "natural");
  assert.throws(() => buildJob("photo-fix", { photoId: "", ratios: ["1:1"] }, refs), InputError);
  assert.throws(() => buildJob("photo-fix", { photoId: "a.jpg", ratios: ["3:2"] }, refs), InputError);
  assert.equal(job.input.background, "original");
  assert.equal(buildJob("photo-fix", { photoId: "a.jpg", ratios: ["1:1"], background: "marble" }, refs).input.background, "marble");
  assert.equal(buildJob("photo-fix", { photoId: "a.jpg", ratios: ["1:1"], background: "space" }, refs).input.background, "original");
  assert.equal(job.input.ai, "off");
  assert.equal(buildJob("photo-fix", { photoId: "a.jpg", ratios: ["1:1"], ai: "medium" }, refs).input.ai, "medium");
  assert.equal(buildJob("photo-fix", { photoId: "a.jpg", ratios: ["1:1"], ai: "max" }, refs).input.ai, "off");
});

test("photo-fix job: graded on the server with no model, one file per frame, served under /media/images", async (t) => {
  try {
    execFileSync("python3", ["-c", "import numpy, PIL"]);
  } catch {
    return t.skip("needs numpy and Pillow");
  }
  const dataDir = mkdtempSync(path.join(tmpdir(), "pf-"));
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "",
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
    video: { dataDir, timeoutMs: 60_000, mock: true },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  try {
    // A dark landscape "dish" photo.
    const b64 = execFileSync("python3", ["-c", "import io,base64;from PIL import Image,ImageDraw;im=Image.new('RGB',(800,500),(40,30,25));d=ImageDraw.Draw(im);d.ellipse((250,100,550,400),fill=(150,90,40));b=io.BytesIO();im.save(b,'JPEG');print(base64.b64encode(b.getvalue()).decode())"]).toString().trim();
    const up = await (await fetch(`${root}/api/uploads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: `data:image/jpeg;base64,${b64}` }) })).json();
    const made = await (await fetch(`${root}/api/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "photo-fix", input: { photoId: up.id, look: "bright", ratios: ["1:1", "9:16"], label: "Bò" } }) })).json();
    let job;
    for (let i = 0; i < 100; i++) {
      job = (await (await fetch(`${root}/api/jobs/${made.job.id}`)).json()).job;
      if (job.status === "done" || job.status === "failed") break;
      await sleep(100);
    }
    assert.equal(job.status, "done", job.error);
    assert.equal(job.usage ?? null, null); // no model call
    assert.deepEqual(job.photos.items.map((x) => [x.ratio, x.width, x.height]), [["1:1", 1080, 1080], ["9:16", 1080, 1920]]);
    for (const f of [job.photos.original, job.photos.fixed, ...job.photos.items.map((x) => x.file)]) {
      const r = await fetch(`${root}/media/images/${f}`);
      assert.equal(r.status, 200, f);
    }
    // Brighter than the dark original.
    const mean = (f) => Number(execFileSync("python3", ["-c", `from PIL import Image,ImageStat;print(sum(ImageStat.Stat(Image.open('${path.join(dataDir, "images", f)}').convert('L')).mean))`]).toString());
    assert.ok(mean(job.photos.fixed) > mean(job.photos.original) + 10);
  } finally {
    s.close();
  }
});

test("photo-fix with a new background: cut out and put on the surface (demo GPU), and a clear error with no GPU", async (t) => {
  try {
    execFileSync("python3", ["-c", "import numpy, PIL"]);
  } catch {
    return t.skip("needs numpy and Pillow");
  }
  const run = async (mock, extra = { background: "wood" }) => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "pfbg-"));
    const app = await createApp({
      port: 0, host: "127.0.0.1", store: "memory", appPassword: "",
      goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
      agents: { scout: "content-scout", writer: "content-writer" },
      jobs: { concurrency: 1, timeoutMs: 60_000 },
      video: { dataDir, timeoutMs: 60_000, mock },
    }, memoryAdapter());
    const s = app.app.listen(0, "127.0.0.1");
    await new Promise((r) => s.once("listening", r));
    const root = `http://127.0.0.1:${s.address().port}`;
    try {
      const b64 = execFileSync("python3", ["-c", "import io,base64;from PIL import Image;im=Image.new('RGB',(600,400),(80,90,100));b=io.BytesIO();im.save(b,'JPEG');print(base64.b64encode(b.getvalue()).decode())"]).toString().trim();
      const up = await (await fetch(`${root}/api/uploads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: `data:image/jpeg;base64,${b64}` }) })).json();
      const made = await (await fetch(`${root}/api/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "photo-fix", input: { photoId: up.id, ratios: ["1:1"], ...extra } }) })).json();
      let job;
      for (let i = 0; i < 100; i++) {
        job = (await (await fetch(`${root}/api/jobs/${made.job.id}`)).json()).job;
        if (job.status === "done" || job.status === "failed") break;
        await sleep(100);
      }
      return { job, dataDir };
    } finally {
      s.close();
    }
  };
  const ok = await run(true);
  assert.equal(ok.job.status, "done", ok.job.error);
  assert.equal(ok.job.photos.background, "wood");
  // The surface shows where the old background was (warm brown, not the photo's grey).
  const corner = execFileSync("python3", ["-c", `from PIL import Image;im=Image.open('${path.join(ok.dataDir, "images", ok.job.photos.fixed)}').convert('RGB');print(*im.getpixel((10,10)))`]).toString().trim().split(" ").map(Number);
  assert.ok(corner[0] > corner[2] + 15, `corner ${corner}`);
  const off = await run(false);
  assert.equal(off.job.status, "failed");
  assert.match(off.job.error, /GPU chưa được kết nối/);
  // AI touch-up (demo GPU): done and marked; without a GPU, the same clear error.
  const touched = await run(true, { ai: "light" });
  assert.equal(touched.job.status, "done", touched.job.error);
  assert.equal(touched.job.photos.ai, "light");
  const noGpu = await run(false, { ai: "light" });
  assert.match(noGpu.job.error, /AI làm đẹp cần GPU/);
});
