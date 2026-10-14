import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { buildJob, InputError } from "../server/prompts.mjs";
import { ClipError, createClipper, cutClip, mediaSeconds, parseClips } from "../server/clipper.mjs";

const run = promisify(execFile);
const yes = { hasUpload: () => true };
const ID = "11111111-2222-3333-4444-555555555555.mp4";

test("reels: the job needs an uploaded video; defaults are clamped", () => {
  assert.throws(() => buildJob("reel-cut", { videoId: ID }, { hasUpload: () => false }), InputError);
  const job = buildJob("reel-cut", { videoId: ID, count: 99, clipSeconds: 5 }, yes);
  assert.equal(job.direct, "reel-cutter");
  assert.deepEqual(job.input, { videoId: ID, count: 5, clipSeconds: 15, lang: "vi", ratio: "9:16" });
  assert.equal(buildJob("reel-cut", { videoId: ID, ratio: "16:9", lang: "en" }, yes).input.ratio, "16:9");
});

test("parseClips: fenced or bare JSON, bad spans dropped", () => {
  const clips = parseClips('Đây là kết quả:\n```json\n{"clips":[{"title":"A","start":3,"end":30,"why":"w"},{"title":"ngắn quá","start":5,"end":7},{"title":"đảo","start":40,"end":20},{"title":"B","start":50,"end":80}]}\n```');
  assert.deepEqual(clips.map((c) => c.title), ["A", "B"]);
  assert.throws(() => parseClips("không có json"), ClipError);
  assert.throws(() => parseClips('{"clips":[]}'), ClipError);
});

test("finishReels: each span becomes a 9:16 MP4 of the asked length, the result lists them", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "reels-"));
  const uploads = path.join(root, "uploads");
  const videos = path.join(root, "videos");
  await mkdir(uploads);
  const clipper = createClipper({ dir: uploads, outDir: videos });
  const src = path.join(uploads, ID);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=10:d=20", "-f", "lavfi", "-i", "sine=f=330:d=20", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", src]);
  const job = { id: "job-1", input: { videoId: ID, ratio: "9:16" } };
  const content = JSON.stringify({ clips: [{ title: "Phở nóng", start: 1, end: 8, why: "câu mở đầu hay" }, { title: "Cuối", start: 12, end: 19.5, why: "" }] });
  const steps = [];
  const out = await clipper.finishReels(job, content, { setPhase: async (p) => steps.push(p), signal: new AbortController().signal });
  assert.equal(out.fields.clips.length, 2);
  assert.deepEqual(steps, ["Đang cắt đoạn 1/2…", "Đang cắt đoạn 2/2…"]);
  for (const [i, c] of out.fields.clips.entries()) {
    const file = path.join(videos, c.file);
    assert.ok((await stat(file)).size > 1000, "clip file written");
    const secs = await mediaSeconds(file);
    assert.ok(Math.abs(secs - c.duration) < 0.6, `clip ${i + 1} length ${secs} vs ${c.duration}`);
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
    assert.equal(stdout.trim(), "720,1280", "vertical 9:16");
  }
  assert.match(out.result, /### Đoạn 1: Phở nóng/);
  await clipper.removeClips({ clips: out.fields.clips });
  await assert.rejects(stat(path.join(videos, out.fields.clips[0].file)));
  // a 16:9 job keeps the wide frame
  await cutClip(src, path.join(videos, "wide.mp4"), { start: 0, end: 3, ratio: "16:9" });
  const { stdout: wide } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(videos, "wide.mp4")]);
  assert.equal(wide.trim(), "1280,720");
  assert.ok((await readFile(path.join(videos, "wide.mp4"))).length > 1000);
});

test("live recap: needs an upload; the JSON gives clips, summary, items and the thank-you post", async () => {
  assert.throws(() => buildJob("live-recap", { videoId: ID }, { hasUpload: () => false }), InputError);
  assert.deepEqual(buildJob("live-recap", { videoId: ID, count: 9 }, yes).input, { videoId: ID, count: 5, ratio: "9:16", lang: "vi" });
  const { parseRecap } = await import("../server/clipper.mjs");
  const r = parseRecap('{"clips":[{"title":"A","start":1,"end":8}],"summary":"Buổi live giới thiệu phở.","items":["Phở bò 65.000đ",""],"post":"Cảm ơn cả nhà!"}');
  assert.deepEqual(r.items, ["Phở bò 65.000đ"]);
  assert.equal(r.post, "Cảm ơn cả nhà!");
  assert.throws(() => parseRecap('{"clips":[{"title":"A","start":1,"end":8}],"summary":"","post":""}'), ClipError);

  const root = await mkdtemp(path.join(tmpdir(), "recap-"));
  const uploads = path.join(root, "uploads");
  await mkdir(uploads);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=10:d=12", "-f", "lavfi", "-i", "sine=f=330:d=12", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(uploads, ID)]);
  const clipper = createClipper({ dir: uploads, outDir: path.join(root, "videos") });
  const out = await clipper.finishRecap({ id: "live-1", input: { videoId: ID, ratio: "9:16" } }, '{"clips":[{"title":"Phở","start":1,"end":8,"why":"món chính"}],"summary":"Buổi live giới thiệu phở.","items":["Phở bò"],"post":"Cảm ơn cả nhà!"}', { setPhase: async () => {}, signal: new AbortController().signal });
  assert.equal(out.fields.clips.length, 1);
  assert.deepEqual(out.fields.recap, { summary: "Buổi live giới thiệu phở.", items: ["Phở bò"], post: "Cảm ơn cả nhà!" });
  assert.match(out.result, /### Tóm tắt buổi live\n\nBuổi live giới thiệu phở\./);
  assert.match(out.result, /### Bài cảm ơn\n\nCảm ơn cả nhà!/);
});
