import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";

test("with object storage set up: uploads are copied up, and a file this server lacks is served from storage", async () => {
  const puts = [];
  const s3 = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      if (req.method === "PUT") puts.push(decodeURIComponent(new URL(req.url, "http://x").pathname));
      res.writeHead(200).end();
    });
  });
  await new Promise((r) => s3.listen(0, "127.0.0.1", r));
  const env = { STORAGE_ENDPOINT: `http://127.0.0.1:${s3.address().port}`, STORAGE_BUCKET: "skipli", STORAGE_ACCESS_KEY_ID: "id", STORAGE_SECRET_ACCESS_KEY: "secret" };
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  const dataDir = await mkdtemp(path.join(tmpdir(), "app-st-"));
  const ctx = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "",
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 50 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
    video: { dataDir, timeoutMs: 60_000, mock: true },
  }, memoryAdapter());
  const app = (ctx.app ?? ctx).listen(0, "127.0.0.1");
  await new Promise((r) => app.once("listening", r));
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    // A real PNG header: uploads are checked byte by byte, not only by the "image/png" label.
    const png = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("PNGDATA")]).toString("base64");
    const up = await (await fetch(`${base}/api/uploads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: png }) })).json();
    assert.ok(puts.includes(`/skipli/uploads/${up.id}`), `upload copied up: ${puts.join(", ")}`);

    const res = await fetch(`${base}/media/videos/11111111-2222-3333-4444-555555555555.mp4`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location"), /\/skipli\/videos\/11111111-2222-3333-4444-555555555555\.mp4\?X-Amz-Algorithm=/);
    const img = await fetch(`${base}/media/images/11111111-2222-3333-4444-555555555555-1.png`, { redirect: "manual" });
    assert.equal(img.status, 302);
  } finally {
    app.close();
    s3.close();
    await ctx.close?.();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
