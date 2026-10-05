import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildJob, InputError } from "../server/prompts.mjs";
import { createVideoService, parseScript, VideoError } from "../server/video.mjs";

const has = () => true;
const script = (n, extra = {}) => "```json\n" + JSON.stringify({ title: "T", shots: Array.from({ length: n }, (_, i) => ({ narration: `Câu ${i + 1}.`, visual: `v${i}`, motion: "pan", ...extra })) }) + "\n```";

test("video: three modes build writer jobs with the right prompt", () => {
  const t = buildJob("video", { mode: "topic", topic: "Bánh mì", seconds: 45 }, { hasUpload: has });
  assert.equal(t.agent, "writer");
  assert.match(t.prompt, /video-scripter/);
  assert.match(t.prompt, /45 giây, 14 cảnh/);

  const sb = buildJob("video", { mode: "storyboard", topic: "Cha và con", panelIds: ["a", "b", "c"] }, { hasUpload: has });
  assert.match(sb.prompt, /Viết đúng 3 cảnh/);
  assert.deepEqual(sb.input.panelIds, ["a", "b", "c"]);

  const st = buildJob("video", { mode: "story", narration: "Ngày xưa có một cô bé. ".repeat(20), narratorPct: 33 }, { hasUpload: has });
  assert.match(st.prompt, /GIỮ NGUYÊN từng chữ/);
  assert.equal(st.input.narratorPct, 30, "rounded to 10%");
});

test("video: input validation", () => {
  assert.throws(() => buildJob("video", { mode: "topic" }), InputError);
  assert.throws(() => buildJob("video", { mode: "storyboard", topic: "x", panelIds: ["a"] }, { hasUpload: has }), /2 đến 12 ô/);
  assert.throws(() => buildJob("video", { mode: "storyboard", topic: "x", panelIds: ["a", "b"] }, { hasUpload: () => false }), /không còn/);
  assert.throws(() => buildJob("video", { mode: "story", narration: "từ ".repeat(400) }), /tối đa 350 từ/);
});

test("parseScript reads fenced or bare JSON and rejects junk", () => {
  assert.equal(parseScript(script(3)).shots.length, 3);
  assert.equal(parseScript("Đây là kịch bản: " + JSON.parse(JSON.stringify(script(2))).replace(/```(json)?/g, "")).shots.length, 2);
  const s = parseScript(script(3, { continue: true, role: "narrator" }));
  assert.equal(s.shots[0].continue, false, "first shot never continues");
  assert.equal(s.shots[1].role, "narrator");
  assert.throws(() => parseScript("không có json"), VideoError);
  assert.throws(() => parseScript(script(1)), /2 đến 14 cảnh/);
});

test("finish: storyboard panels go to the worker as per-shot images; MP4 is saved", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "vid-"));
  let received;
  let polls = 0;
  const worker = createServer((req, res) => {
    if (req.headers.authorization !== "Bearer sekret") return res.writeHead(401).end();
    if (req.method === "POST" && req.url === "/render") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: "r1" }));
      });
      return;
    }
    if (req.url === "/render/r1") {
      polls++;
      const done = polls > 1;
      return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: done ? "done" : "running", phase: "Đang dựng cảnh 1/2…", duration: done ? 16.4 : null }));
    }
    if (req.url === "/render/r1/video") return res.writeHead(200, { "Content-Type": "video/mp4" }).end("FAKEMP4");
    if (req.url === "/health") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, models: { status: "ready" }, gpu: ["T4"] }));
    res.writeHead(404).end();
  });
  await new Promise((r) => worker.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${worker.address().port}`;
  try {
    const video = createVideoService({ dataDir, timeoutMs: 60_000, mock: false, log: { warn() {} } });
    await video.init();
    assert.equal((await video.setWorker({ url, token: "sekret" })).ok, true);
    assert.equal((await video.setWorker({ url, token: "wrong" })).error, "Token GPU không đúng");
    await video.setWorker({ url, token: "sekret" });

    const png = "data:image/png;base64," + Buffer.from("PNGDATA").toString("base64");
    const ids = [await video.saveUpload(png), await video.saveUpload(png)];
    await assert.rejects(video.saveUpload("data:text/html;base64,PGI+"), VideoError);

    const phases = [];
    const job = { id: "11111111-2222-3333-4444-555555555555", type: "video", input: { mode: "storyboard", ratio: "9:16", voice: "male", panelIds: ids } };
    const out = await video.finish(job, script(3), { setPhase: async (p) => phases.push(p), signal: new AbortController().signal });

    assert.equal(received.shots.length, 2, "3 shots trimmed to 2 panels");
    assert.equal(Buffer.from(received.shots[1].image, "base64").toString(), "PNGDATA");
    assert.equal(received.voice, "male");
    assert.ok(phases.includes("Đang dựng cảnh 1/2…"));
    assert.equal(out.fields.video.duration, 16.4);
    assert.equal(out.fields.video.shots.length, 2);
    assert.equal(await readFile(video.videoPath(job.id), "utf8"), "FAKEMP4");
  } finally {
    worker.close();
  }
});

test("finish without a connected GPU fails with a clear message", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "vid-"));
  await writeFile(path.join(dataDir, "video-worker.json"), JSON.stringify({ url: "", token: "" }));
  const video = createVideoService({ dataDir, timeoutMs: 1000, mock: false });
  await video.init();
  await assert.rejects(video.finish({ id: "x", type: "video", input: {} }, script(2), { setPhase: async () => {}, signal: new AbortController().signal }), /Chưa kết nối GPU/);
});
