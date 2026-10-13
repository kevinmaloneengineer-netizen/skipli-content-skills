import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildJob, InputError } from "../server/prompts.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { captionChunks, createVideoService, parseScript, stillPrompt, VideoError } from "../server/video.mjs";

const run = promisify(execFile);

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

test("finish: stills video, storyboard panels used as is, the other shots drawn on the GPU, subtitles and music", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "vid-"));
  const frame = path.join(dataDir, "frame.png");
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x2e6b4f:s=384x672", "-frames:v", "1", frame]);
  const pngB64 = (await readFile(frame)).toString("base64");
  let drawn;
  const worker = createServer((req, res) => {
    if (req.headers.authorization !== "Bearer sekret") return res.writeHead(401).end();
    if (req.method === "POST" && req.url === "/image") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        drawn = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: "i1" }));
      });
      return;
    }
    if (req.url === "/image/i1") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "done", images: drawn.prompts.map(() => pngB64), width: 384, height: 672 }));
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
    await assert.rejects(video.saveUpload("data:text/html;base64,PGI+"), VideoError);

    // Storyboard: 3 shots trimmed to the 2 panels, nothing to draw.
    const ids = [await video.saveUpload(`data:image/png;base64,${pngB64}`), await video.saveUpload(`data:image/png;base64,${pngB64}`)];
    const phases = [];
    const sb = { id: "11111111-2222-3333-4444-555555555555", type: "video", input: { mode: "storyboard", ratio: "9:16", audio: "music", panelIds: ids } };
    const out = await video.finish({ ...sb, input: { ...sb.input, review: false } }, script(3), { setPhase: async (p) => phases.push(p), signal: new AbortController().signal });
    assert.equal(drawn, undefined, "panels are not drawn again");
    assert.equal(out.fields.video.shots.length, 2, "3 shots trimmed to 2 panels");
    assert.ok(out.fields.video.shots.every((x) => video.imagePath(x.image)), "each shot keeps its still");
    assert.ok(out.fields.video.duration > 4 && out.fields.video.duration < 12, `duration ${out.fields.video.duration}`);
    assert.ok((await readFile(video.videoPath(sb.id))).length > 1000, "an MP4 was written");
    assert.ok(phases.includes("Đang thêm nhạc nền…"));

    // Topic: every shot drawn on the GPU as a still, then the review stops before rendering.
    const tp = { id: "22222222-2222-3333-4444-555555555555", type: "video", input: { mode: "topic", ratio: "9:16", audio: "music", style: "real" } };
    const reviewed = await video.finish(tp, script(3), { setPhase: async () => {}, signal: new AbortController().signal });
    assert.equal(reviewed.fields.status, "review");
    assert.equal(reviewed.fields.slides.length, 3);
    assert.deepEqual(drawn.prompts, ["v0", "v1", "v2"]);
    assert.match(drawn.negative, /text/);
    assert.equal(drawn.negative.includes("people"), false, "narrated stills may show people");

    // The user puts their own photo into shot 2, then renders: that still is used, the words stay with their shot.
    const tpr = { ...tp, slides: reviewed.fields.slides };
    const replaced = await video.replaceSlide(tpr, 1, ids[0]);
    assert.equal(replaced[1].real, true);
    const rendered = await video.renderSlides({ ...tp, input: { ...tp.input } }, replaced, reviewed.fields.draft, async () => {});
    assert.equal(rendered.fields.video.shots.length, 3);
    assert.equal(rendered.fields.video.shots[1].image, replaced[1].image);
    assert.equal(rendered.fields.video.shots[1].narration, replaced[1].narration);
    assert.ok((await readFile(video.videoPath(tp.id))).length > 1000);
  } finally {
    worker.close();
  }
});

test("stillPrompt: no names or signs for the image model", () => {
  assert.equal(stillPrompt("Exterior of Phở Cali storefront, subtle signage, bustling street background"), "Exterior of the restaurant storefront, bustling street background, architecture only, plain blank awning, no signboard");
  assert.equal(stillPrompt("Bowl of beef pho with fresh herbs, lime wedge"), "Bowl of beef pho with fresh herbs, lime wedge");
});

test("captionChunks: short subtitle lines, cut at about 7 words or a clause", () => {
  assert.deepEqual(captionChunks("Mỗi sáng, khi thành phố còn ngủ, bếp của Phở Cali đã đỏ lửa."), ["Mỗi sáng, khi thành phố còn ngủ,", "bếp của Phở Cali đã đỏ lửa."]);
  assert.deepEqual(captionChunks(""), []);
});

test("finish without a connected GPU fails with a clear message", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "vid-"));
  await writeFile(path.join(dataDir, "video-worker.json"), JSON.stringify({ url: "", token: "" }));
  const video = createVideoService({ dataDir, timeoutMs: 1000, mock: false });
  await video.init();
  await assert.rejects(video.finish({ id: "x", type: "video", input: {} }, script(2), { setPhase: async () => {}, signal: new AbortController().signal }), /Chưa kết nối GPU/);
});
