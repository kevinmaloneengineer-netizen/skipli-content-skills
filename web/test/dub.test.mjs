import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { buildJob, InputError } from "../server/prompts.mjs";
import { ClipError, createClipper, mediaSeconds, parseLines, videoSize } from "../server/clipper.mjs";

const run = promisify(execFile);
const ID = "22222222-3333-4444-5555-666666666666.mp4";

// A stand-in for server/voice/tts.py: one tone per line, as long as the text needs (no network).
const FAKE_TTS = `import json, subprocess, sys, os
spec = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
for i, t in enumerate(spec["texts"], 1):
    d = 0.6 + 0.08 * len(t)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=f=440:d={d:.2f}", os.path.join(out, f"s{i}.mp3")], check=True)
print(out)
`;

test("dub: buildJob validates the upload and the target", () => {
  assert.throws(() => buildJob("dub", { videoId: ID }, { hasUpload: () => false }), InputError);
  const job = buildJob("dub", { videoId: ID, target: "xx", voice: "male" }, { hasUpload: () => true });
  assert.equal(job.direct, "video-dubber");
  assert.deepEqual(job.input, { videoId: ID, target: "vi", voice: "male", sourceLang: "" });
  assert.equal(buildJob("dub", { videoId: ID, target: "en", sourceLang: "vi" }, { hasUpload: () => true }).input.target, "en");
});

test("parseLines: a JSON list of lines; empty lines refused", () => {
  assert.deepEqual(parseLines('```json\n{"lines":["Hello  there", "Next"]}\n```'), ["Hello there", "Next"]);
  assert.throws(() => parseLines('{"lines":["ok", ""]}'), ClipError);
  assert.throws(() => parseLines("không có json"), ClipError);
});

test("finishDub: the dubbed MP4 keeps the picture, lasts as long as the source, and lists its lines", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dub-"));
  const uploads = path.join(root, "uploads");
  const videos = path.join(root, "videos");
  await mkdir(uploads);
  const fake = path.join(root, "tts.py");
  await writeFile(fake, FAKE_TTS);
  const src = path.join(uploads, ID);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=10:d=6", "-f", "lavfi", "-i", "sine=f=220:d=6", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", src]);
  // The speech was already read once (cached beside the upload): three lines with their times.
  await writeFile(path.join(uploads, `${ID}.auto.json`), JSON.stringify({ language: "vi", segments: [
    { start: 0, end: 2, text: "Chào các bạn." }, { start: 2.5, end: 4, text: "Phở rất ngon." }, { start: 4.2, end: 6, text: "Cảm ơn đã xem." }] }));
  const clipper = createClipper({ dir: uploads, outDir: videos, voiceScript: fake });
  const job = { id: "job-dub-1", input: { videoId: ID, target: "en", voice: "female", sourceLang: "" } };
  const steps = [];
  const out = await clipper.finishDub(job, '{"lines":["Hello everyone.","The pho is delicious.","Thanks for watching."]}', { setPhase: async (p) => steps.push(p), signal: new AbortController().signal });
  assert.equal(out.fields.clips.length, 1);
  const clip = out.fields.clips[0];
  assert.equal(clip.file, "job-dub-1-dub.mp4");
  assert.ok((await stat(path.join(videos, clip.file))).size > 1000);
  assert.ok(Math.abs((await mediaSeconds(path.join(videos, clip.file))) - 6) < 0.5, "same length as the source");
  assert.deepEqual(await videoSize(path.join(videos, clip.file)), { width: 640, height: 360 });
  assert.match(out.result, /### Lời đã dịch/);
  assert.match(out.result, /The pho is delicious/);
  assert.ok(steps.length >= 1);
  await assert.rejects(clipper.finishDub(job, '{"lines":["only one"]}', { setPhase: async () => {}, signal: new AbortController().signal }), /không khớp số câu/);
});
