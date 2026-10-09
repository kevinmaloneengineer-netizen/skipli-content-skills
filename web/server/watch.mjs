// "AI xem video" for scanned reels without a GoClaw agent: download the reel with the skill's own
// fetch_reel.py (yt-dlp + ffmpeg), then
//   1. Gemini watches a small 480p copy (pictures, on-screen text, speech), else
//   2. Groq Whisper transcribes the audio (speech only), else
//   3. only the caption is left.
// Each result says which source it came from, so the report can be honest about it.

import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { runScript } from "./scanners.mjs";
import { downloadVideo } from "./sources/tiktok.mjs";

const GEMINI_MODELS = (process.env.GEMINI_VIDEO_MODELS ?? "gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash").split(",");
const MAX_INLINE = 18 * 1024 * 1024; // Gemini inline request limit is 20 MB (base64 grows ~33%: keep the file well under)

const ASK = `Bạn đang xem một reel Facebook của người bán hàng / quán ăn. Mô tả bằng tiếng Việt, tối đa 130 chữ, đúng 4 dòng:
Hook: điều gì xảy ra hoặc được nói trong 3 giây đầu để giữ người xem.
Lời thoại: tóm tắt ý chính người trong video nói (không có thì ghi "không có lời thoại").
Hình ảnh: cảnh quay, món ăn hoặc sản phẩm, chữ hiện trên màn hình.
Kêu gọi: lời kêu gọi hành động ở cuối (không có thì ghi "không có").
Chỉ mô tả những gì thật sự thấy và nghe, không đoán.`;

function run(cmd, args, { signal, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { signal, timeout: timeoutMs });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split("\n").at(-1) || `${cmd} exit ${code}`))));
  });
}

/** Gemini: inline video, key in the URL (the newer "AQ." keys are rejected in the header). Retries: the free tier often answers 503/404 under load. */
async function geminiWatch(file, signal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: "video/mp4", data: (await readFile(file)).toString("base64") } }, { text: ASK }] }],
    generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body,
          signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(90_000)]),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (text) return text;
      } catch (e) {
        if (signal?.aborted) throw e;
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

/** Groq Whisper (free): speech to text for the audio track. */
async function whisper(file, signal) {
  const key = process.env.GROQ_API_KEY;
  if (!key || !file) return null;
  const form = new FormData();
  form.append("model", process.env.WHISPER_MODEL ?? "whisper-large-v3-turbo");
  form.append("language", "vi");
  form.append("response_format", "json");
  form.append("file", new Blob([await readFile(file)], { type: "audio/mpeg" }), "audio.mp3");
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(90_000)]),
    });
    if (!res.ok) return null;
    const text = (await res.json()).text?.replace(/\s+/g, " ").trim();
    return text || null;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

/** Video + audio files for a reel: TikTok straight from its page, everything else with fetch_reel.py (yt-dlp). */
async function download(url, dir, signal) {
  try {
    if (/tiktok\.com\//.test(url)) {
      const video = path.join(dir, "video.mp4");
      // TikTok turns away bursts of page loads for a few seconds: retry with a growing pause.
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 4000 * attempt));
        ok = await downloadVideo(url, video, signal).catch(() => false);
      }
      if (!ok) return null;
      const audio = path.join(dir, "audio.mp3");
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio], { signal }).catch(() => {});
      return { video, audio: (await stat(audio).catch(() => null)) ? audio : null };
    }
    return await runScript("fb-reel-reader", "fetch_reel.py", [url, "--out", dir, "--frames", "0", "--height", "480"], { signal, timeoutMs: 180_000 });
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

/**
 * Watch one reel (Facebook or TikTok). Never throws for a download or model failure (falls back to the caption).
 * @returns {{ source: "video" | "lời thoại" | "caption", text: string }}
 */
export async function watchReel(url, { signal, keepIn } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  const started = Date.now();
  let clip = null; // id of the 480p copy kept in `keepIn`, played on the result page instead of the platform's embed
  const done = (source, text = "") => ({ source, text, ms: Date.now() - started, clip });
  try {
    const fetched = await download(url, dir, signal);
    if (!fetched) return done("caption");
    if (fetched.video) {
      const small = path.join(dir, "small.mp4");
      try {
        // 480p, 12 fps, first 2 minutes: enough to read the reel, small enough to send inline.
        await run("ffmpeg", ["-y", "-loglevel", "error", "-i", fetched.video, "-t", "120", "-vf", "scale=-2:480,fps=12", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-c:a", "aac", "-b:a", "48k", "-ac", "1", small], { signal });
        if (keepIn) {
          await mkdir(keepIn, { recursive: true });
          const id = randomUUID();
          await copyFile(small, path.join(keepIn, `${id}.mp4`));
          clip = id;
        }
        if ((await stat(small)).size <= MAX_INLINE) {
          const seen = await geminiWatch(small, signal);
          if (seen) return done("video", seen);
        }
      } catch (e) {
        if (signal?.aborted) throw e;
      }
    }
    const heard = await whisper(fetched.audio, signal);
    if (heard) return done("lời thoại", heard.slice(0, 600));
    return done("caption");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * On-demand playable copy of a reel / TikTok for the result page (reports made before clips were kept,
 * or a reel that was not watched). Cached by the platform's video id.
 * @returns the clip id (file `<keepIn>/<id>.mp4`) or null
 */
export async function makeClip(url, keepIn, { signal } = {}) {
  const vid = url.match(/(\d{9,25})/)?.[1];
  if (!vid) return null;
  const id = `v${vid}`;
  const target = path.join(keepIn, `${id}.mp4`);
  if (await stat(target).catch(() => null)) return id;
  const dir = await mkdtemp(path.join(tmpdir(), "clip-"));
  try {
    const fetched = await download(url, dir, signal);
    if (!fetched?.video) return null;
    await mkdir(keepIn, { recursive: true });
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", fetched.video, "-t", "180", "-vf", "scale=-2:480", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", target], { signal });
    return id;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
