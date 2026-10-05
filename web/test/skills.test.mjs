import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJob, InputError } from "../server/prompts.mjs";
import { mockReply } from "../server/mock.mjs";
import { splitLivestream } from "../client/src/lib/text.js";

test("fanpage: scout reads 100 reels and runs the analyzer", () => {
  const j = buildJob("fanpage", { url: "facebook.com/doithu/", focus: "khoá học" });
  assert.equal(j.agent, "scout");
  assert.equal(j.title, "Phân tích fanpage @doithu");
  assert.match(j.prompt, /list_reels\.py --count 100 --stats --limit 200/);
  assert.match(j.prompt, /analyze_reels\.py/);
  assert.match(j.prompt, /Chú ý thêm: khoá học\./);
  assert.throws(() => buildJob("fanpage", { url: "https://www.facebook.com/reel/1234567890" }), /không phải link một reel/);
  assert.throws(() => buildJob("fanpage", { url: "tiktok.com/@x" }), InputError);
});

test("livestream: writer gets products, length and a no-invented-offers rule", () => {
  const j = buildJob("livestream", { products: "\nÁo khoác gió, 350k\nQuần jogger", minutes: 90, platform: "tiktok" });
  assert.equal(j.agent, "writer");
  assert.equal(j.title, "Livestream 90 phút · Áo khoác gió, 350k");
  assert.match(j.prompt, /90 phút trên TikTok/);
  assert.match(j.prompt, /\[ƯU ĐÃI\], không tự bịa/);
  assert.equal(buildJob("livestream", { products: "x", minutes: 45 }).input.minutes, 60, "unknown length falls back to 60");
  assert.throws(() => buildJob("livestream", { products: "  " }), InputError);
});

test("livestream answer splits into timeline segments + closing sections", async () => {
  const { content } = await mockReply({ kind: "livestream", prompt: "", delayMs: 0 });
  const { segments, rest } = splitLivestream(content);
  assert.deepEqual(segments.map((s) => `${s.start}-${s.end}`), ["00:00-03:00", "03:00-15:00", "15:00-20:00", "20:00-30:00"]);
  assert.equal(segments[1].title, "Áo khoác gió");
  assert.match(rest, /^## Câu chốt đơn/);
  assert.equal(splitLivestream("## 1:00:00 - 1:05:00 · Cảm ơn\nx").segments[0].start, "1:00:00", "hyphen and hours accepted");
});

test("stats + feedback endpoints", async () => {
  const { createApp } = await import("../server/app.mjs");
  const { memoryAdapter } = await import("../server/store/memory.mjs");
  const adapter = memoryAdapter();
  const { app, store } = await createApp({ goclaw: { mock: true, mockDelayMs: 0, url: "http://127.0.0.1:1", token: "", userId: "t" }, agents: { scout: "s", writer: "w" }, jobs: { concurrency: 1, timeoutMs: 1000 }, facebook: {}, store: "memory", appPassword: "" }, adapter);
  await store.addJob({ id: "a", type: "fb-reels", status: "done", input: { mode: "channel", depth: 100 }, createdAt: "2026-01-01" });
  await store.addJob({ id: "b", type: "fanpage", status: "done", input: {}, createdAt: "2026-01-02" });
  await store.addJob({ id: "c", type: "write", status: "failed", input: {}, createdAt: "2026-01-03" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const stats = await (await fetch(`${base}/stats`)).json();
    assert.equal(stats.runs, 2);
    assert.equal(stats.reels, 200);
    assert.ok(stats.templates > 0);
    const bad = await fetch(`${base}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "a" }) });
    assert.equal(bad.status, 400);
    const ok = await fetch(`${base}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Rất hữu ích", page: "/fb" }) });
    assert.equal(ok.status, 201);
  } finally {
    server.close();
  }
});
