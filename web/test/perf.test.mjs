import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createApp, listItem } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";

const config = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "",
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 50 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};

test("perf: a list row drops what only the job page reads, and keeps the thumbnail", () => {
  const job = {
    id: "j1", type: "video", title: "Video", status: "done", prompt: "p", result: "r",
    input: { business: "Pho Cali", layout: "map", dishes: "x".repeat(2000), count: 3 },
    video: { file: "v.mp4", shots: [{ image: "shot.jpg" }] }, slides: [{ image: "s.jpg" }], draft: "long draft", usage: { total_tokens: 9 }, phases: [{ text: "a" }],
  };
  const row = listItem(job, { position: () => 1 });
  for (const k of ["prompt", "result", "video", "slides", "draft", "usage", "phases"]) assert.equal(row[k], undefined, k);
  assert.deepEqual(row.input, { business: "Pho Cali", layout: "map", count: 3 });
  assert.equal(row.thumb, "shot.jpg");
  assert.equal(row.status, "done");
  assert.equal(job.video.file, "v.mp4"); // the stored job is not touched
});

test("perf: answers are gzipped and built assets are cached for good", async () => {
  const { app, runner } = await createApp(config, memoryAdapter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // A big enough JSON answer comes back compressed.
    const res = await fetch(`${base}/api/skills/content-writer`, { headers: { "Accept-Encoding": "gzip" } });
    if (res.ok && Number((await res.clone().text()).length) > 1024) assert.equal(res.headers.get("content-encoding"), "gzip");
    const dist = path.resolve("client/dist/assets");
    if (existsSync(dist)) {
      const css = (await readdir(dist)).find((f) => f.endsWith(".css"));
      const asset = await fetch(`${base}/assets/${css}`, { headers: { "Accept-Encoding": "gzip" } });
      assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
      assert.equal(asset.headers.get("content-encoding"), "gzip");
    }
  } finally {
    runner.stop?.();
    server.close();
  }
});
