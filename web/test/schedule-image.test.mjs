import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildJob, InputError } from "../server/prompts.mjs";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { mockReply } from "../server/mock.mjs";
import { createVideoService, parseImagePlan, VideoError } from "../server/video.mjs";
import { splitPlan } from "../client/src/lib/text.js";

const has = () => true;

test("image job: writer, size/count/style validated, product photo checked", () => {
  const j = buildJob("image", { topic: "Cà phê muối", size: "9:16", count: 2, style: "pixar" }, { hasUpload: has });
  assert.equal(j.agent, "writer");
  assert.match(j.prompt, /2 ảnh quảng cáo/);
  assert.match(j.prompt, /9:16 \(story, reels\)/);
  assert.equal(buildJob("image", { topic: "x", size: "3:2", count: 9 }).input.size, "1:1");
  assert.equal(buildJob("image", { topic: "x", count: 9 }).input.count, 4);
  assert.match(buildJob("image", { topic: "x", withText: false }).prompt, /không cần chữ/);
  assert.throws(() => buildJob("image", {}), InputError);
  assert.throws(() => buildJob("image", { topic: "x", referenceImageId: "a.png" }, { hasUpload: () => false }), /không còn/);
});

test("plan job: start date required, weekday of day 1 in the prompt", () => {
  const j = buildJob("plan", { topic: "Quán cà phê", start: "2026-10-12", days: 14, perDay: 2, platform: "threads", pillars: ["sell", "engage"] });
  assert.match(j.prompt, /14 ngày, mỗi ngày 2 bài Threads/);
  assert.match(j.prompt, /Ngày 1 là 2026-10-12 \(Thứ 2\)/);
  assert.match(j.prompt, /Tương tác, Bán hàng|Bán hàng, Tương tác/);
  assert.throws(() => buildJob("plan", { topic: "x" }), /ngày bắt đầu/);
  assert.throws(() => buildJob("plan", { topic: "x", start: "2026-10-12", pillars: ["memes"] }), InputError);
});

test("plan answer splits into day/time/pillar slots", async () => {
  const { content } = await mockReply({ kind: "plan", prompt: "", delayMs: 0 });
  const { intro, slots, notes } = splitPlan(content);
  assert.match(intro, /^Kế hoạch 7 ngày/);
  assert.equal(slots.length, 7);
  assert.deepEqual(slots[1], { day: 2, time: "11:30", pillar: "sell", title: "Cà phê muối đã có mặt", body: slots[1].body });
  assert.match(notes, /Ghi chú/);
  assert.equal(splitPlan("## Ngày 3 · 9h05 · Lạ: Tiêu đề\nx").slots[0].time, "09:05", "9h05 and unknown pillar accepted");
});

test("image plan parsing and demo render", async () => {
  const { content } = await mockReply({ kind: "image", prompt: "", delayMs: 0 });
  assert.equal(parseImagePlan(content).images.length, 2);
  assert.throws(() => parseImagePlan("không có json"), VideoError);
  assert.throws(() => parseImagePlan('{"images":[]}'), /chưa đưa ra/);
  const video = createVideoService({ dataDir: await mkdtemp(path.join(tmpdir(), "img-")), timeoutMs: 1000, mock: true });
  await video.init();
  const job = { id: "11111111-2222-3333-4444-555555555555", type: "image", input: { size: "4:5" } };
  const out = await video.finish(job, content, { setPhase: async () => {}, signal: new AbortController().signal });
  assert.equal(out.fields.images.items.length, 2);
  assert.deepEqual([out.fields.images.width, out.fields.images.height], [896, 1120]);
  const png = await readFile(video.imagePath(out.fields.images.items[0].file));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(video.imagePath("../x.png"), null, "no path traversal");
});

test("schedule API: add, list by range, move, mark posted, delete", async () => {
  const cfg = { goclaw: { mock: true, mockDelayMs: 0, url: "http://127.0.0.1:1", token: "", userId: "t" }, agents: { scout: "s", writer: "w" }, jobs: { concurrency: 1, timeoutMs: 1000 }, store: "memory", appPassword: "" };
  const { app } = await createApp(cfg, memoryAdapter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/schedule`;
  const call = async (p, method = "GET", body) => {
    const r = await fetch(base + p, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body && JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  };
  try {
    assert.equal((await call("", "POST", { title: "x", platform: "myspace", at: "2026-10-12T12:30:00Z" })).status, 400);
    assert.equal((await call("", "POST", { title: "x", platform: "facebook", at: "không phải ngày" })).status, 400);
    const one = await call("", "POST", { title: "Bài A", body: "Nội dung", platform: "facebook", at: "2026-10-12T12:30:00Z", pillar: "sell" });
    assert.equal(one.status, 201);
    const many = await call("", "POST", { slots: [{ title: "Bài B", platform: "threads", at: "2026-10-13T13:00:00Z" }, { title: "Bài C", platform: "tiktok", at: "2026-11-01T13:00:00Z" }] });
    assert.equal(many.data.slots.length, 2);
    const week = await call("?from=2026-10-12T00:00:00.000Z&to=2026-10-19T00:00:00.000Z");
    assert.deepEqual(week.data.slots.map((s) => s.title), ["Bài A", "Bài B"]);
    const id = one.data.slots[0].id;
    const moved = await call(`/${id}`, "PUT", { at: "2026-10-14T12:30:00Z", status: "posted" });
    assert.equal(moved.data.slot.status, "posted");
    assert.equal(moved.data.slot.at, "2026-10-14T12:30:00.000Z");
    assert.equal(moved.data.slot.title, "Bài A", "partial update keeps other fields");
    assert.equal((await call(`/${id}`, "DELETE")).status, 200);
    assert.equal((await call(`/${id}`, "DELETE")).status, 404);
    assert.equal((await call("", "POST", { slots: Array.from({ length: 32 }, () => ({ title: "x", platform: "facebook", at: "2026-10-12T12:30:00Z" })) })).status, 400);
  } finally {
    server.close();
  }
});
