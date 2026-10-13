import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ClipError, createClipper, mediaSeconds } from "../server/clipper.mjs";

const run = promisify(execFile);

async function makeMp4(file, seconds) {
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `testsrc2=s=320x240:r=10:d=${seconds}`, "-f", "lavfi", "-i", `sine=f=440:d=${seconds}`, "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file]);
  return readFile(file);
}

test("clipper: a real MP4 is stored with its length; junk is refused and removed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "clip-"));
  const clipper = createClipper({ dir });
  const mp4 = await makeMp4(path.join(dir, "src.mp4"), 2);
  const saved = await clipper.saveVideo(mp4);
  assert.match(saved.id, /^[0-9a-f-]{36}\.mp4$/);
  assert.ok(saved.seconds > 1.5 && saved.seconds < 2.5, `length ${saved.seconds}`);
  assert.equal(clipper.hasVideo(saved.id), true);

  await assert.rejects(clipper.saveVideo(Buffer.from("not a video at all")), ClipError);
  await assert.rejects(clipper.saveVideo(Buffer.alloc(0)), ClipError);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".mp4") && f !== "src.mp4");
  assert.deepEqual(files, [saved.id], "the refused file was removed");
});

test("clipper: only uuid.mp4 names count as uploads", async () => {
  const clipper = createClipper({ dir: tmpdir() });
  assert.equal(clipper.hasVideo("../../etc/passwd"), false);
  assert.equal(clipper.hasVideo("abc.mp4"), false);
  assert.equal(await mediaSeconds(path.join(tmpdir(), "missing.mp4")).then(() => "ok", () => "err"), "err");
});

test("transcribe: timed segments come back from Whisper; silence and missing key are clear errors", async () => {
  const { createServer } = await import("node:http");
  const dir = await mkdtemp(path.join(tmpdir(), "clip-"));
  const mp4 = await makeMp4(path.join(dir, "talk.mp4"), 3);
  let got = null;
  const server = createServer((req, res) => {
    let body = Buffer.alloc(0);
    req.on("data", (c) => (body = Buffer.concat([body, c])));
    req.on("end", () => {
      got = body.toString("latin1");
      const segments = [{ start: 0.2, end: 1.6, text: " Xin chào các bạn " }, { start: 1.6, end: 1.5, text: "đoạn lỗi thời gian" }, { start: 2, end: 2.9, text: "Cảm ơn" }];
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ language: "vi", segments }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.GROQ_API_KEY = "test";
  process.env.GROQ_AUDIO_URL = `http://127.0.0.1:${server.address().port}/`;
  try {
    const clipper = createClipper({ dir });
    const saved = await clipper.saveVideo(mp4);
    const out = await clipper.transcribe(saved.id, { language: "vi" });
    assert.equal(out.language, "vi");
    assert.deepEqual(out.segments, [{ start: 0.2, end: 1.6, text: "Xin chào các bạn" }, { start: 2, end: 2.9, text: "Cảm ơn" }], "bad segments dropped, text trimmed");
    assert.match(got, /verbose_json/);
    assert.match(got, /timestamp_granularities/);
    assert.match(got, /name="language"/);
  } finally {
    server.close();
    delete process.env.GROQ_AUDIO_URL;
    delete process.env.GROQ_API_KEY;
  }
  const noKey = createClipper({ dir });
  await assert.rejects(noKey.transcribe("00000000-0000-0000-0000-000000000000.mp4"), (e) => e instanceof ClipError && /khoá Groq/.test(e.message));
});
