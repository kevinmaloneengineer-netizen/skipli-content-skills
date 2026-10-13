// Long videos for the "Cắt Reels" and "Lồng tiếng" skills: upload, length check, and the audio track
// for speech-to-text. Files live in the same uploads folder as the photos (DATA_DIR/uploads).

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TITLE_SCRIPT = path.join(HERE, "overlay", "make_title.py");
const VOICE_SCRIPT = path.join(HERE, "voice", "tts.py");
/** Voices for the dubbed track: vi-* for Vietnamese, en-* for English (same as the video tool). */
export const DUB_VOICES = { "vi-female": "vi-VN-HoaiMyNeural", "vi-male": "vi-VN-NamMinhNeural", "en-female": "en-US-AriaNeural", "en-male": "en-US-GuyNeural" };
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 10 * 60;
export const VIDEO_ID = /^[0-9a-f-]{36}\.mp4$/;

export class ClipError extends Error {}

/** Length of a media file in seconds (ffprobe); throws when the file is not a readable video. */
export async function mediaSeconds(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).catch(() => ({ stdout: "" }));
  const seconds = Number(stdout);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new ClipError("Không đọc được video. Hãy dùng file MP4 hoặc MOV.");
  return seconds;
}

const round = (n) => Math.round(Number(n) * 100) / 100;
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/**
 * Speech in a video with timings: the audio track goes to Groq Whisper (free), which returns segments
 * of about a sentence each. language: "vi" or "en" (empty = detect).
 * @returns {Promise<{ language: string, segments: { start: number, end: number, text: string }[] }>}
 */
export async function transcribe(file, { language = "", signal } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ClipError("Chưa có khoá Groq để nghe lời trong video.");
  const audio = `${file}.mp3`;
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", audio]);
  try {
    const form = new FormData();
    form.append("model", process.env.WHISPER_MODEL ?? "whisper-large-v3-turbo");
    if (language) form.append("language", language);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("file", new Blob([await readFile(audio)], { type: "audio/mpeg" }), "audio.mp3");
    const res = await fetch(process.env.GROQ_AUDIO_URL ?? "https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(180_000)]),
    });
    if (!res.ok) throw new ClipError(`Không nghe được lời trong video (lỗi ${res.status}). Thử lại sau ít phút.`);
    const data = await res.json();
    const segments = (data.segments ?? [])
      .map((x) => ({ start: round(x.start), end: round(x.end), text: String(x.text ?? "").trim() }))
      .filter((x) => x.text && x.end > x.start);
    if (!segments.length) throw new ClipError("Không nghe thấy lời nói rõ trong video.");
    return { language: data.language ?? language, segments };
  } finally {
    await rm(audio, { force: true });
  }
}

/** The translated lines: a JSON object {"lines":["…", "…"]}, one per timed speech, in order. */
export function parseLines(content) {
  const text = String(content ?? "");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let data = null;
  try {
    data = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new ClipError("AI không trả về bản dịch đúng định dạng. Thử lại nhé.");
  }
  const lines = (Array.isArray(data?.lines) ? data.lines : []).map((x) => String(x ?? "").replace(/\s+/g, " ").trim());
  if (!lines.length || lines.some((x) => !x)) throw new ClipError("Bản dịch có câu trống. Thử lại nhé.");
  return lines;
}

/** The clips the model chose: a JSON object {"clips":[{title,start,end}]}, bare or in a code fence. */
export function parseClips(content) {
  const text = String(content ?? "");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let data = null;
  try {
    data = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new ClipError("AI không trả về danh sách đoạn đúng định dạng. Thử lại nhé.");
  }
  const clips = (Array.isArray(data?.clips) ? data.clips : [])
    .map((c) => ({ title: String(c.title ?? "").trim().slice(0, 80), start: round(c.start), end: round(c.end), why: String(c.why ?? "").trim().slice(0, 200) }))
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end - c.start >= 5 && c.end - c.start <= 90);
  if (!clips.length) throw new ClipError("AI không chọn được đoạn nào hợp lệ. Thử video khác hoặc thử lại.");
  return clips;
}

/** Cut one clip to a vertical (9:16) or wide (16:9) file, re-encoded so it plays everywhere. */
export async function cutClip(src, out, { start, end, ratio = "9:16" }) {
  const [w, h] = ratio === "16:9" ? [1280, 720] : [720, 1280];
  await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start), "-i", src, "-t", String(round(end - start)),
    "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], { maxBuffer: 1 << 24 });
}

/** Width and height of a video in pixels (ffprobe). */
export async function videoSize(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
  const [w, h] = stdout.trim().split(",").map(Number);
  if (!w || !h) throw new ClipError("Không đọc được khung hình của video.");
  return { width: w, height: h };
}

/**
 * Dubbed track: each line of the translation is read in its own voice and placed at the start of the
 * speech it replaces (sped up a little when it is longer than the gap), with subtitles burned in.
 * @param {{ file: string, lines: string[], segments: {start:number,end:number}[], voice: string, out: string, dir: string, voiceScript?: string }} o
 */
export async function dubVideo({ file, lines, segments, voice, out, dir, voiceScript = VOICE_SCRIPT }) {
  const n = lines.length;
  await writeFile(path.join(dir, "tts.json"), JSON.stringify({ voice: DUB_VOICES[voice] ?? DUB_VOICES["vi-female"], texts: lines }));
  await run(process.env.TTS_PYTHON ?? process.env.PYTHON ?? "python3", [voiceScript, path.join(dir, "tts.json"), dir], { timeout: 240_000 })
    .catch((e) => { throw new ClipError(`Không tạo được giọng đọc (${e.stderr?.trim().split("\n").at(-1) ?? e.message}).`); });
  const total = await mediaSeconds(file);
  const { width, height } = await videoSize(file);
  const voices = lines.map((_, i) => path.join(dir, `s${i + 1}.mp3`));
  const spans = await Promise.all(voices.map(mediaSeconds));
  // Each voice starts where its speech starts; a line longer than its gap is sped up (at most 1.6x).
  const tempo = spans.map((len, i) => {
    const gap = Math.max(0.5, (segments[i]?.end ?? len) - (segments[i]?.start ?? 0));
    return Math.min(1.6, Math.max(1, len / gap));
  });
  await writeFile(path.join(dir, "captions.json"), JSON.stringify({ kind: "captions", width, height, chunks: lines }));
  await run("python3", [TITLE_SCRIPT, path.join(dir, "caps"), path.join(dir, "captions.json")]);

  const args = ["-y", "-loglevel", "error", "-i", file];
  for (const v of voices) args.push("-i", v);
  for (let i = 0; i < n; i++) args.push("-loop", "1", "-framerate", "30", "-t", String(total), "-i", path.join(dir, "caps", `cap${i + 1}.png`));
  const f = [];
  for (let i = 0; i < n; i++) {
    const ms = Math.round((segments[i]?.start ?? 0) * 1000);
    f.push(`[${i + 1}:a]${tempo[i] > 1.01 ? `atempo=${tempo[i].toFixed(3)},` : ""}aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[a${i}]`);
  }
  f.push(`${voices.map((_, i) => `[a${i}]`).join("")}amix=inputs=${n}:normalize=0:duration=longest,volume=1.3[aout]`);
  let last = "0:v";
  for (let i = 0; i < n; i++) {
    const from = segments[i]?.start ?? 0;
    const to = segments[i]?.end ?? from + 1;
    f.push(`[${last}][${n + 1 + i}:v]overlay=0:0:enable='between(t,${from.toFixed(2)},${to.toFixed(2)})'[v${i}]`);
    last = `v${i}`;
  }
  await run("ffmpeg", [...args, "-filter_complex", f.join(";"), "-map", `[${last}]`, "-map", "[aout]", "-t", String(total),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], { maxBuffer: 1 << 24 });
  return round(total);
}

/** @param {{ dir: string, outDir?: string }} opts  dir: uploads folder, outDir: finished files (served at /media/videos) */
export function createClipper({ dir, outDir = dir, voiceScript = VOICE_SCRIPT }) {
  /** Store an uploaded video; refuses files that are too big, too long, or not video. */
  async function saveVideo(buffer) {
    if (!buffer?.length) throw new ClipError("Chưa có video.");
    if (buffer.length > MAX_VIDEO_BYTES) throw new ClipError("Video lớn quá 200MB.");
    const id = `${randomUUID()}.mp4`;
    const file = path.join(dir, id);
    await writeFile(file, buffer);
    try {
      const seconds = await mediaSeconds(file);
      if (seconds > MAX_VIDEO_SECONDS) throw new ClipError("Video dài quá 10 phút. Hãy cắt bớt rồi tải lại.");
      return { id, seconds: Math.round(seconds * 10) / 10 };
    } catch (e) {
      await rm(file, { force: true });
      throw e;
    }
  }

  /** The speech of an upload, read once and kept beside it, so the next job on the same video does not pay again. */
  async function transcriptOf(id, { language = "", signal } = {}) {
    const cache = path.join(dir, `${id}.${language || "auto"}.json`);
    if (existsSync(cache)) return JSON.parse(await readFile(cache, "utf8"));
    const out = await transcribe(path.join(dir, id), { language, signal });
    await writeFile(cache, JSON.stringify(out));
    return out;
  }

  /** Lồng tiếng job: the translated lines are read aloud over the original timing, with subtitles. */
  async function finishDub(job, content, { setPhase, signal }) {
    const lines = parseLines(content);
    const { segments } = await transcriptOf(job.input.videoId, { language: job.input.sourceLang, signal });
    if (lines.length !== segments.length) throw new ClipError("Bản dịch không khớp số câu của video. Thử lại nhé.");
    const src = path.join(dir, job.input.videoId);
    await mkdir(outDir, { recursive: true });
    const tmp = path.join(outDir, `${job.id}.dubwork`);
    await mkdir(tmp, { recursive: true });
    const file = `${job.id}-dub.mp4`;
    try {
      await setPhase?.("Đang đọc bản lồng tiếng và ghép phụ đề…");
      const seconds = await dubVideo({ file: src, lines, segments, voice: `${job.input.target}-${job.input.voice}`, out: path.join(outDir, file), dir: tmp, voiceScript });
      const clip = { file, title: job.input.target === "en" ? "English dub" : "Lồng tiếng tiếng Việt", start: 0, end: seconds, duration: seconds, why: "" };
      const result = ["### Lời đã dịch", ...lines.map((t, i) => `${fmt(segments[i].start)} ${t}`)].join("\n");
      return { result, fields: { clips: [clip] } };
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  /** Reels job: the chosen spans are cut from the upload, each becomes its own MP4 file. */
  async function finishReels(job, content, { setPhase, signal }) {
    const clips = parseClips(content);
    const src = path.join(dir, job.input.videoId);
    const length = await mediaSeconds(src);
    const usable = clips.filter((c) => c.start < length - 1).map((c) => ({ ...c, end: Math.min(c.end, round(length)) })).filter((c) => c.end - c.start >= 5);
    if (!usable.length) throw new ClipError("Các đoạn AI chọn nằm ngoài độ dài video.");
    await mkdir(outDir, { recursive: true });
    const files = [];
    for (const [i, c] of usable.entries()) {
      signal?.throwIfAborted?.();
      await setPhase?.(`Đang cắt đoạn ${i + 1}/${usable.length}…`);
      const file = `${job.id}-clip${i + 1}.mp4`;
      await cutClip(src, path.join(outDir, file), { ...c, ratio: job.input.ratio });
      files.push({ file, title: c.title, start: c.start, end: c.end, duration: round(c.end - c.start), why: c.why });
    }
    const result = files.map((f, i) => `### Đoạn ${i + 1}: ${f.title}\n${fmt(f.start)} → ${fmt(f.end)} (${f.duration} giây)${f.why ? `\n${f.why}` : ""}`).join("\n\n");
    return { result, fields: { clips: files } };
  }

  /** Remove the cut files of a deleted job (the uploaded source is kept: a retry may use it). */
  async function removeClips(job) {
    for (const c of job.clips ?? []) await rm(path.join(outDir, c.file), { force: true });
  }

  return {
    finishReels,
    finishDub,
    transcriptOf,
    removeClips,
    saveVideo,
    hasVideo: (id) => VIDEO_ID.test(id) && existsSync(path.join(dir, id)),
    transcribe: (id, opts) => transcribe(path.join(dir, id), opts),
    filePath: (id) => path.join(dir, id),
  };
}
