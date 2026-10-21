// AI video: the writer agent returns a shot list (JSON), then a GPU worker
// (video-worker/, run on a free Kaggle/Colab GPU) renders it to MP4. The worker
// URL changes every GPU session, so it is set from the UI and kept in DATA_DIR.

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { collage } from "./collage.mjs";
import { transcribe } from "./clipper.mjs";
import { checkFacts } from "./facts.mjs";
import { placeFromLink } from "./sources/osm.mjs";
import { PHOTO_AI, PHOTO_BACKGROUNDS, slideRoles } from "./prompts.mjs";

const run = promisify(execFile);
const MUSIC_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "music", "make_music.py");
const TITLE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "overlay", "make_title.py");
const PHOTO_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "overlay", "photo_fix.py");
const VOICE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "voice", "tts.py");
// Same voices as the GPU worker (video-worker/worker.py VOICES).
const VOICES = { female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural", "en-female": "en-US-AriaNeural", "en-male": "en-US-GuyNeural" };
export const RATIOS = { "9:16": [480, 832], "16:9": [832, 480], "1:1": [640, 640] };
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const UPLOAD_ID = /^[0-9a-f-]{36}\.(png|jpg|webp|mp4|mp3)$/;
const MAX_UPLOAD = 6 * 1024 * 1024;

export class VideoError extends Error {}

export const IMAGE_SIZES = { "1:1": [1024, 1024], "4:5": [896, 1120], "9:16": [768, 1344], "16:9": [1344, 768] };
const IMAGE_FILE = /^[0-9a-f-]{36}-[rspo]?\d{1,2}\.(png|jpg|webp)$/; // "-r3": a slideshow's real photo, "-s3": a narrated video's still, "-p1" / "-o0": a fixed dish photo and its original
const LAYOUTS = new Set(["top", "center", "bottom"]);

/** Pull the image plan out of the agent's answer: { images: [{ prompt, headline, sub, cta, caption, layout }] }. */
export function parseImagePlan(content) {
  const text = String(content ?? "");
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const raw = fenced?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new VideoError("AI không trả về ý tưởng ảnh đúng định dạng. Hãy chạy lại.");
  }
  const clip = (v, n) => String(v ?? "").trim().slice(0, n);
  const images = (Array.isArray(data?.images) ? data.images : [])
    .map((x) => ({ prompt: clip(x?.prompt, 600), headline: clip(x?.headline, 80), sub: clip(x?.sub, 140), cta: clip(x?.cta, 40), caption: clip(x?.caption, 1500), layout: LAYOUTS.has(x?.layout) ? x.layout : "bottom" }))
    .filter((x) => x.prompt)
    .slice(0, 6);
  if (!images.length) throw new VideoError("AI chưa đưa ra ý tưởng ảnh nào. Hãy chạy lại.");
  return { images };
}

/**
 * Slogan and short intro for the collage's landing page, from the same JSON as the image ideas.
 * Sentences with a price, a percentage or an hour are dropped: the model must not invent them.
 */
export function landingText(content) {
  const text = String(content ?? "");
  const raw = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    return { tagline: "", blurb: "", caption: "", hashtags: [], words: [], dishes: [] };
  }
  const risky = /[$€£₫]|\d+\s*%|\b\d{1,2}(:\d{2})?\s*(am|pm|h)\b|\d+\s*(k|đ|usd|dollars?)\b/i;
  const blurb = String(data.blurb ?? "").split(/(?<=[.!?])\s+/).filter((x) => x && !risky.test(x)).join(" ").slice(0, 260);
  const tags = (Array.isArray(data.hashtags) ? data.hashtags : String(data.hashtags ?? "").split(/[\s,]+/))
    .map((t) => `#${String(t).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`)
    .filter((t) => t.length > 2);
  return {
    tagline: risky.test(String(data.tagline ?? "")) ? "" : String(data.tagline ?? "").slice(0, 60),
    blurb,
    caption: String(data.post_caption ?? "").trim().slice(0, 600),
    words: (Array.isArray(data.words) ? data.words : []).map((w) => String(w).trim().slice(0, 18)).filter((w) => w && !risky.test(w)).slice(0, 3),
    dishes: (Array.isArray(data.dishes) ? data.dishes : []).map((d) => String(typeof d === "object" ? d?.name ?? "" : d).trim().slice(0, 40)).filter(Boolean).slice(0, 4),
    hashtags: [...new Set(tags.map((t) => t.toLowerCase()))].slice(0, 12),
  };
}

/** Pull the shot list out of the agent's answer (a ```json block or the first {...}). */
export function parseScript(content) {
  const text = String(content ?? "");
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const raw = fenced?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new VideoError("AI không trả về kịch bản đúng định dạng. Hãy chạy lại.");
  }
  const shots = (Array.isArray(data?.shots) ? data.shots : [])
    .map((s) => ({
      narration: String(s?.narration ?? "").trim().slice(0, 400),
      visual: String(s?.visual ?? "").trim().slice(0, 600),
      motion: String(s?.motion ?? "").trim().slice(0, 300),
      continue: s?.continue === true,
      role: s?.role === "narrator" ? "narrator" : "scene",
    }))
    .filter((s) => s.narration);
  if (shots.length < 2 || shots.length > 14) throw new VideoError(`Kịch bản cần 2 đến 14 cảnh, AI trả về ${shots.length}.`);
  for (const s of shots) if (!s.visual) s.visual = "a cinematic scene";
  shots[0].continue = false;
  return { title: String(data.title ?? "").trim().slice(0, 120), shots };
}

/** Readable script for the job's result field (shown if the video can't be). */
export function scriptMarkdown({ title, shots }) {
  const lines = [title ? `**${title}**` : "", `Kịch bản ${shots.length} cảnh:`, ""];
  shots.forEach((s, i) => lines.push(`${i + 1}. ${s.narration}`, `   _${s.role === "narrator" ? "Người kể nói trước camera" : `Hình: ${s.visual}`}${s.motion ? `. ${s.motion}` : ""}_`));
  return lines.filter((l, i) => l || i > 0).join("\n").trim();
}

const SLIDE_SIZES = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [1080, 1080] };

/**
 * Stills → MP4: each picture gets a slow zoom (in and out alternately, with a slight drift) and the
 * pictures crossfade into each other, so the whole clip lasts `seconds`.
 */
export async function slideshow(files, out, { ratio = "9:16", seconds = 15, fps = 30, fade = 0.7, title = null } = {}) {
  const [w, h] = SLIDE_SIZES[ratio] ?? SLIDE_SIZES["9:16"];
  const n = files.length;
  const each = (seconds + (n - 1) * fade) / n; // crossfades overlap
  const frames = Math.round(each * fps);
  const parts = files.map((_, i) => {
    const zoom = i % 2 === 0 ? `1+0.06*on/${frames}` : `1.06-0.06*on/${frames}`; // gentle: a photo show, not a moving scene
    const drift = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0; // left, right or none
    // zoompan on a 2x picture keeps the motion smooth (it moves in whole pixels).
    return `[${i}:v]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},` +
      `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+${drift}*(on/${frames}-0.5)*iw*0.02':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=${fps},setsar=1,format=yuv420p[v${i}]`;
  });
  let last = "v0";
  if (title) {
    // The card fades in over the first photo and leaves with it (the crossfade carries it out).
    parts.push(`[${n}:v]format=rgba,fade=in:st=0.3:d=0.8:alpha=1[card]`, `[v0][card]overlay=0:0:shortest=1,format=yuv420p[t0]`);
    last = "t0";
  }
  for (let i = 1; i < n; i++) {
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(i * (each - fade)).toFixed(3)}[x${i}]`);
    last = `x${i}`;
  }
  const cardInput = title ? ["-loop", "1", "-t", each.toFixed(3), "-framerate", String(fps), "-i", title] : [];
  await run("ffmpeg", ["-y", "-loglevel", "error", ...files.flatMap((f) => ["-i", f]), ...cardInput, "-filter_complex", parts.join(";"), "-map", `[${last}]`,
    "-t", String(seconds), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { maxBuffer: 1 << 24 });
}

/** Narration as short subtitle lines (about 7 words, or a clause), like the GPU worker used to burn in. */
export function captionChunks(text) {
  const chunks = [];
  let cur = [];
  for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
    cur.push(word);
    if (cur.length >= 7 || (/[.,!?;:]$/.test(word) && cur.length >= 3)) {
      chunks.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks;
}

/**
 * A shot's picture description made safe for the image model, which paints names and signs as garbled
 * letters: Vietnamese proper names ("Phở Cali") become "the restaurant", sign / logo / lettering phrases go,
 * and a storefront is asked for as architecture with a blank awning.
 */
export function stillPrompt(visual) {
  let p = String(visual ?? "")
    .replace(/[\p{Lu}][\p{L}'’]*(?:\s+[\p{Lu}][\p{L}'’]*)*/gu, (m) => (/[^\x00-\x7F]/.test(m) ? "the restaurant" : m))
    .replace(/[^,.]*\b(?:sign(?:age|board|s)?|logo|lettering|text|neon)\b[^,.]*[,.]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "");
  if (/storefront|exterior|facade|façade|shopfront/i.test(p)) p += ", architecture only, plain blank awning, no signboard";
  return p;
}

/**
 * The viewer's own music or voice under a finished video, in place of its sound: looped when shorter,
 * cut to the video's length and faded out over the last 1.5 seconds. Returns the length in seconds.
 */
export async function withOwnAudio(video, audio) {
  const length = await mediaLength(video);
  const tmp = `${video}.own.mp4`;
  const fade = Math.max(0, length - 1.5);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-stream_loop", "-1", "-i", audio, "-map", "0:v", "-map", "1:a",
    "-af", `atrim=0:${length.toFixed(3)},afade=t=out:st=${fade.toFixed(3)}:d=1.5`, "-t", length.toFixed(3),
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", tmp]);
  await rename(tmp, video);
  return Math.round(length * 10) / 10;
}

/** One MP3 per text (dir/s1.mp3, s2.mp3, …) read with the free Edge voices on this machine (server/voice/tts.py). */
async function readAloud(texts, voice, dir) {
  await writeFile(path.join(dir, "shots.json"), JSON.stringify({ voice: VOICES[voice] ?? VOICES.female, texts }));
  try {
    await run(process.env.TTS_PYTHON ?? process.env.PYTHON ?? "python3", [VOICE_SCRIPT, path.join(dir, "shots.json"), dir], { timeout: 180_000 });
  } catch (e) {
    throw new VideoError(`Không tạo được giọng đọc (${e.stderr?.trim().split("\n").at(-1) ?? e.message}). Máy chủ cần python3 có edge-tts (pip install edge-tts).`);
  }
  return texts.map((_, i) => path.join(dir, `s${i + 1}.mp3`));
}

const mediaLength = async (file) => Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])).stdout) || 0;

export function createVideoService({ dataDir, timeoutMs, mock, log = console }) {
  const dirs = { videos: path.join(dataDir, "videos"), uploads: path.join(dataDir, "uploads"), images: path.join(dataDir, "images") };
  const settingsFile = path.join(dataDir, "video-worker.json");
  let worker = { url: process.env.VIDEO_WORKER_URL ?? "", token: process.env.VIDEO_WORKER_TOKEN ?? "" };

  async function init() {
    await mkdir(dirs.videos, { recursive: true });
    await mkdir(dirs.uploads, { recursive: true });
    await mkdir(dirs.images, { recursive: true });
    try {
      worker = { ...worker, ...JSON.parse(await readFile(settingsFile, "utf8")) };
    } catch {
      // no saved worker yet
    }
  }

  const isMock = () => worker.url === "mock" || (!worker.url && mock);

  async function call(p, opts = {}) {
    try {
      return await request(p, opts);
    } catch (e) {
      if (e instanceof VideoError || opts.signal?.aborted) throw e;
      throw new VideoError("Không kết nối được GPU. Phiên Kaggle có thể đã tắt: chạy lại notebook (Run All) rồi dán URL và Token mới ở mục Kết nối GPU.");
    }
  }

  async function request(p, { method = "GET", body, signal, raw = false, timeout = 60_000 } = {}) {
    const res = await fetch(`${worker.url}${p}`, {
      method,
      headers: { Authorization: `Bearer ${worker.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new VideoError(res.status === 401 ? "Token GPU không đúng" : `GPU worker lỗi ${res.status}: ${detail.slice(0, 200)}`);
    }
    return raw ? res : res.json();
  }

  async function status() {
    if (isMock()) return { configured: true, mock: true, ok: true };
    if (!worker.url) return { configured: false, ok: false };
    try {
      const h = await call("/health");
      return { configured: true, ok: true, url: worker.url, models: h.models?.status, modelError: h.models?.error ?? null, gpu: h.gpu, busy: h.busy };
    } catch (e) {
      return { configured: true, ok: false, url: worker.url, error: e instanceof VideoError ? e.message : `Không kết nối được GPU (${e.message})` };
    }
  }

  async function setWorker({ url, token }) {
    const u = String(url ?? "").trim().replace(/\/+$/, "");
    if (u !== "mock" && !/^https?:\/\/[^\s/]+/.test(u)) throw new VideoError("URL GPU không hợp lệ");
    worker = { url: u, token: String(token ?? "").trim() };
    await writeFile(settingsFile, JSON.stringify(worker), { mode: 0o600 });
    return status();
  }

  async function saveUpload(dataUrl) {
    const m = String(dataUrl ?? "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new VideoError("Chỉ nhận ảnh PNG, JPG hoặc WEBP");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > MAX_UPLOAD) throw new VideoError("Ảnh lớn quá 6MB");
    const id = `${randomUUID()}.${IMAGE_TYPES[m[1]]}`;
    await writeFile(path.join(dirs.uploads, id), buf);
    return id;
  }

  const hasUpload = (id) => UPLOAD_ID.test(id) && existsSync(path.join(dirs.uploads, id));
  const videoPath = (jobId) => path.join(dirs.videos, `${jobId}.mp4`);

  /** Demo render without a GPU: test pattern for the script's length (needs local ffmpeg). */
  async function mockRender(job, script, out) {
    const [w, h] = RATIOS[job.input.ratio] ?? RATIOS["9:16"];
    const shots = job.input.panelIds?.length ? script.shots.slice(0, job.input.panelIds.length) : script.shots;
    const seconds = shots.reduce((t, s) => t + Math.max(2, s.narration.split(/\s+/).length / 2.8), 0);
    try {
      await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `testsrc2=s=${w}x${h}:r=24:d=${seconds.toFixed(1)}`, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out]);
    } catch (e) {
      throw new VideoError(`Chế độ demo cần ffmpeg trên máy (${e.code ?? e.message})`);
    }
    return Math.round(seconds * 10) / 10;
  }

  /** The worker's /image job: { images: [base64 PNG], width, height }. */
  async function drawOnGpu(body, signal) {
    const { id } = await call("/image", { method: "POST", body, signal });
    const deadline = Date.now() + 20 * 60_000; // first call of a session may wait for the models to load
    for (;;) {
      if (Date.now() > deadline) throw new VideoError("Vẽ ảnh quá lâu, đã dừng chờ.");
      await sleep(3000, undefined, { signal });
      let res;
      try {
        res = await call(`/image/${id}`, { signal });
      } catch (e) {
        if (signal?.aborted || /Token/.test(e.message)) throw e;
        continue; // tunnel hiccup
      }
      if (res.status === "failed") throw new VideoError(`GPU vẽ lỗi: ${res.error}`);
      if (res.status === "done") return res;
    }
  }

  const imagePath = (file) => (IMAGE_FILE.test(file) ? path.join(dirs.images, file) : null);

  /** Ad images: the agent's JSON (prompts + Vietnamese text) → PNGs from the GPU worker (text is overlaid in the app). */
  async function finishImages(job, content, { setPhase, signal }) {
    const plan = parseImagePlan(content);
    const files = plan.images.map((_, i) => `${job.id}-${i + 1}.png`);
    let [w, h] = IMAGE_SIZES[job.input.size] ?? IMAGE_SIZES["1:1"];
    let res;
    if (isMock()) {
      await setPhase("Đang tạo ảnh demo…");
      const colors = ["0xe25d33", "0x2e6b4f", "0x5b3fc4", "0x1b7fc4", "0xd99a1e", "0x7d3a6c"];
      try {
        for (const [i, f] of files.entries()) {
          await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=${colors[i % colors.length]}:s=${w}x${h}`, "-frames:v", "1", path.join(dirs.images, f)]);
        }
      } catch (e) {
        throw new VideoError(`Chế độ demo cần ffmpeg trên máy (${e.code ?? e.message})`);
      }
    } else {
      if (!worker.url) throw new VideoError("Chưa kết nối GPU. Mở trang Tạo ảnh AI để kết nối rồi chạy lại.");
      const body = { prompts: plan.images.map((x) => x.prompt), size: job.input.size, style: job.input.style, ...(job.input.negative ? { negative: job.input.negative } : {}) };
      if (job.input.referenceImageId && hasUpload(job.input.referenceImageId)) body.reference_image = (await readFile(path.join(dirs.uploads, job.input.referenceImageId))).toString("base64");
      await setPhase(`Đang vẽ ${files.length} ảnh trên GPU…`);
      res = await drawOnGpu(body, signal);
      await Promise.all(res.images.map((b64, i) => writeFile(path.join(dirs.images, files[i]), Buffer.from(b64, "base64"))));
    }
    if (res?.width) [w, h] = [res.width, res.height]; // the worker decides the real size
    const images = plan.images.map((x, i) => ({ ...x, file: files[i] }));
    return {
      result: images.map((x, i) => `### Ảnh ${i + 1}\n**${x.headline}**${x.sub ? `\n${x.sub}` : ""}${x.cta ? `\n[${x.cta}]` : ""}\n\n${x.caption ?? ""}`).join("\n\n"),
      fields: { images: { size: job.input.size, width: w, height: h, items: images } },
    };
  }

  const SLIDE_NEGATIVE = "people, person, face, hands, fingers, crowd, car, vehicle, traffic, motorcycle, animal, text, letters, words, signage, sign lettering, menu board";
  /** A free "<job>-<n>.png" / "<job>-r<n>.jpg" name in the images folder (served at /media/images). */
  function freeName(jobId, ext, prefix = "") {
    for (let n = 1; n < 100; n++) {
      const name = `${jobId}-${prefix}${n}.${ext}`;
      if (!existsSync(path.join(dirs.images, name))) return name;
    }
    throw new VideoError("Đã vẽ lại quá nhiều lần cho video này.");
  }

  /**
   * Photo slideshow, step 1: the GPU draws the stills (same path as "Ảnh AI"); real photos are copied
   * next to them. Each slide: { image (file in /media/images), prompt, role, real }.
   */
  async function slideshowSlides(job, content, ctx) {
    // The name never goes to the image model (it would paint it, misspelt), and nobody should appear.
    const name = String(job.input.name ?? "").trim();
    const clean = name ? String(content).replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "the place") : content;
    const ids = (job.input.photoIds ?? []).filter(hasUpload);
    // Role of each slide for this template, the same split the prompt used (prompts.mjs slideRoles).
    const { realRoles, drawRoles: roles } = slideRoles(job.input.layout, ids.length, job.input.count ?? 6);
    const real = [];
    for (const [k, id] of ids.entries()) {
      const image = freeName(job.id, path.extname(id).slice(1), "r");
      await copyFile(path.join(dirs.uploads, id), path.join(dirs.images, image));
      real.push({ image, prompt: "Ảnh thật của quán", role: realRoles[k] ?? "food", real: true });
    }
    let drawn = [];
    let images = { items: [] };
    if (job.input.ai !== 0) {
      images = (await finishImages({ ...job, input: { ...job.input, size: job.input.ratio, negative: SLIDE_NEGATIVE } }, clean, ctx)).fields.images;
      images.items = images.items.slice(0, Math.max(0, (job.input.count ?? 5) - real.length));
      drawn = images.items.map((x, i) => ({ image: x.file, prompt: x.prompt, role: roles[i] ?? "food" }));
    }
    const slides = [...real, ...drawn];
    if (slides.length < 2) throw new VideoError("Cần ít nhất 2 ảnh để làm video trình chiếu.");
    return { slides, images };
  }

  /** Photo slideshow, step 2: lay the slides out (collage or one per scene), add the music, write the caption. */
  async function renderSlides(job, slides, content, setPhase = async () => {}) {
    if (job.input.mode !== "slideshow") {
      const script = parseScript(content);
      const seconds = await renderScripted(job, slides, setPhase);
      return { result: scriptMarkdown(script), fields: narratedFields(job, slides, seconds, script.title) };
    }
    const files = slides.map((x) => path.join(dirs.images, x.image));
    await setPhase("Đang ghép ảnh thành video…");
    const out = videoPath(job.id);
    const title = job.input.name && job.input.layout === "single" ? await titleCard(job) : null; // the templates draw their own cards
    // "Chỉ đường": the pin from the restaurant's Google Maps link; no exact spot → no map scene, and the result says so.
    let place = null;
    if (job.input.layout === "map") {
      await setPhase("Đang đọc vị trí quán từ link Google Maps…");
      place = await placeFromLink(job.input.mapLink).catch((e) => {
        log.warn?.(`map: ${e.message}`);
        return null;
      });
    }
    let drawn = null;
    try {
      if (job.input.layout !== "single") {
        const logo = job.input.logoId && hasUpload(job.input.logoId) ? path.join(dirs.uploads, job.input.logoId) : null;
        const text = landingText(content);
        // Dish names the user typed (with their prices) first; names the AI picked fill the rest, never a price.
        const dishes = [0, 1, 2, 3].map((k) => job.input.dishes?.[k]?.name ? job.input.dishes[k] : text.dishes[k] ? { name: text.dishes[k], price: "" } : null).filter(Boolean);
        // The user's own words win over the AI's slogan and words, and over the template's labels.
        const { words: ownWords, ...labels } = job.input.texts ?? {};
        if (job.input.tagline) text.tagline = job.input.tagline;
        if (ownWords?.length) text.words = ownWords;
        drawn = await collage(slides.map((x, i) => ({ ...x, file: files[i] })), out, { template: job.input.layout, ratio: job.input.ratio, seconds: job.input.seconds ?? 15, name: job.input.name, city: job.input.city, address: job.input.address, phone: job.input.phone, logo, lang: job.input.lang, offer: job.input.offer, ...text, dishes, labels, place, tileDir: path.join(dataDir, "osm-tiles") });
      } else {
        await slideshow(files, out, { ratio: job.input.ratio, seconds: job.input.seconds ?? 15, title });
      }
    } finally {
      if (title) await rm(title, { force: true });
    }
    // The viewer's own music or voice replaces the generated music.
    const ownAudio = job.input.audioId && hasUpload(job.input.audioId) ? path.join(dirs.uploads, job.input.audioId) : null;
    await setPhase(ownAudio ? "Đang thêm âm thanh của bạn…" : "Đang thêm nhạc nền…");
    const seconds = ownAudio ? await withOwnAudio(out, ownAudio) : await addMusic(out, job.id, "soft");
    const shots = slides.map((x) => ({ narration: "", visual: x.prompt, motion: "", role: "scene", image: x.image }));
    // Caption + hashtags to post with the video; invented prices or offers become placeholders.
    const words = landingText(content);
    const facts = Object.values(job.input ?? {}).filter((v) => typeof v === "string").join("\n");
    const caption = words.caption ? checkFacts(words.caption, facts).text : "";
    const realCount = slides.filter((x) => x.real).length;
    const mapNote = job.input.layout !== "map" ? "" : drawn?.map
      ? `\n\nBản đồ: ghim đặt tại ${place.lat.toFixed(5)}, ${place.lon.toFixed(5)} theo link Google Maps của quán (bản đồ OpenStreetMap).`
      : "\n\nKhông đọc được vị trí từ link Google Maps (hoặc không tải được bản đồ) nên video không có cảnh bản đồ. Mở đúng quán trên Google Maps, bấm Chia sẻ, dán link mới rồi bấm Đổi mẫu.";
    return {
      result: `Video trình chiếu ${files.length} ảnh (${realCount} ảnh thật, ${files.length - realCount} ảnh AI vẽ), ${ownAudio ? "âm thanh của bạn" : "nhạc nền không lời"}.${mapNote}\n\n${shots.map((x, i) => `${i + 1}. ${x.visual}`).join("\n")}`,
      fields: { video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title: job.title, shots, slideshow: true, caption, hashtags: words.hashtags } },
    };
  }

  /** Runner step for slideshows: draw, then stop for the user to review the photos (or render straight away). */
  async function finishSlideshow(job, content, ctx) {
    const { slides, images } = await slideshowSlides(job, content, ctx);
    if (job.input.review !== false) {
      return { result: `Đã vẽ xong ${slides.length} ảnh. Duyệt ảnh rồi bấm Dựng video.`, fields: { status: "review", slides, images, draft: content } };
    }
    const out = await renderSlides(job, slides, content, ctx.setPhase);
    return { ...out, fields: { ...out.fields, images, slides, draft: content } }; // the draft lets "Đổi mẫu" re-lay it later
  }

  /** Review screen: draw one slide again (optionally from an edited prompt). */
  async function redrawSlide(job, index, prompt) {
    const slide = job.slides?.[index];
    if (!slide) throw new VideoError("Không có ảnh này");
    const text = String(prompt ?? slide.prompt).trim().slice(0, 600);
    if (!text) throw new VideoError("Mô tả ảnh đang trống");
    const image = freeName(job.id, "png");
    const [w, h] = IMAGE_SIZES[job.input.ratio] ?? IMAGE_SIZES["9:16"];
    if (isMock()) {
      await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}:s=${w}x${h}`, "-frames:v", "1", path.join(dirs.images, image)]);
    } else {
      if (!worker.url) throw new VideoError("Chưa kết nối GPU. Mở trang Tạo video AI để kết nối rồi thử lại.");
      const { id } = await call("/image", { method: "POST", body: { prompts: [text], size: job.input.ratio, style: job.input.style ?? "real", negative: job.input.mode === "slideshow" ? SLIDE_NEGATIVE : STILL_NEGATIVE } });
      const deadline = Date.now() + 10 * 60_000;
      let res;
      for (;;) {
        if (Date.now() > deadline) throw new VideoError("Vẽ ảnh quá lâu, đã dừng chờ.");
        await sleep(2500);
        try {
          res = await call(`/image/${id}`);
        } catch (e) {
          if (/Token/.test(e.message)) throw e;
          continue;
        }
        if (res.status === "failed") throw new VideoError(`GPU vẽ lỗi: ${res.error}`);
        if (res.status === "done") break;
      }
      await writeFile(path.join(dirs.images, image), Buffer.from(res.images[0], "base64"));
    }
    return job.slides.map((x, i) => (i === index ? { ...x, image, prompt: text, real: false } : x));
  }

  /** Review screen: put one of the user's photos in place of a slide (keeps the slide's role). */
  async function replaceSlide(job, index, uploadId) {
    if (!job.slides?.[index]) throw new VideoError("Không có ảnh này");
    if (!hasUpload(uploadId)) throw new VideoError("Ảnh tải lên không còn, hãy chọn lại");
    const image = freeName(job.id, path.extname(uploadId).slice(1), "r");
    await copyFile(path.join(dirs.uploads, uploadId), path.join(dirs.images, image));
    return job.slides.map((x, i) => (i === index ? { ...x, image, prompt: "Ảnh thật của quán", real: true } : x));
  }

  /** Name, city, address and logo as a transparent PNG for the first slide (server/overlay/make_title.py). */
  async function titleCard(job) {
    const [width, height] = SLIDE_SIZES[job.input.ratio] ?? SLIDE_SIZES["9:16"];
    const base = path.join(dirs.videos, `${job.id}.title`);
    const spec = { width, height, name: job.input.name, city: job.input.city, address: job.input.address, phone: job.input.phone, logo: job.input.logoId && hasUpload(job.input.logoId) ? path.join(dirs.uploads, job.input.logoId) : null };
    await writeFile(`${base}.json`, JSON.stringify(spec));
    try {
      await run("python3", [TITLE_SCRIPT, `${base}.png`, `${base}.json`]);
    } catch (e) {
      throw new VideoError(`Không vẽ được khung thông tin quán (${e.stderr?.trim().split("\n").at(-1) ?? e.message}). Máy chủ cần python3 có Pillow.`);
    } finally {
      await rm(`${base}.json`, { force: true });
    }
    return `${base}.png`;
  }

  const STILL_NEGATIVE = "text, letters, words, watermark, logo, signage, sign lettering, menu board, blurry, low quality, deformed, extra fingers";
  const narratedFields = (job, slides, seconds, title) => ({
    video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title, shots: slides.map((x) => ({ narration: x.narration, visual: x.prompt, role: x.role, image: x.image })) },
  });

  /**
   * Narrated videos, step 1: one still per shot. A storyboard panel or the narrator's own photo is used as it is,
   * every other shot is drawn on the GPU. Each slide keeps its own narration, so reordering moves the words with it.
   */
  async function drawStills(job, shots, { setPhase, signal }) {
    if (!worker.url) throw new VideoError("Chưa kết nối GPU. Mở trang Tạo video AI để kết nối rồi chạy lại.");
    const panels = (job.input.panelIds ?? []).filter(hasUpload);
    const reference = job.input.referenceImageId && hasUpload(job.input.referenceImageId) ? job.input.referenceImageId : null;
    const slides = [];
    const draw = [];
    for (const [i, shot] of shots.entries()) {
      const own = panels[i] ?? (shot.role === "narrator" && reference ? reference : null);
      const slide = { narration: shot.narration, role: shot.role, prompt: stillPrompt(shot.visual), real: !!own };
      if (own) {
        slide.image = freeName(job.id, path.extname(own).slice(1), "s");
        await copyFile(path.join(dirs.uploads, own), path.join(dirs.images, slide.image));
      } else draw.push(i);
      slides.push(slide);
    }
    if (draw.length) {
      await setPhase(`Đang vẽ ${draw.length} ảnh trên GPU…`);
      const res = await drawOnGpu({ prompts: draw.map((i) => slides[i].prompt), size: job.input.ratio, style: job.input.style ?? "real", negative: STILL_NEGATIVE }, signal);
      for (const [k, i] of draw.entries()) {
        slides[i].image = freeName(job.id, "png", "s");
        await writeFile(path.join(dirs.images, slides[i].image), Buffer.from(res.images[k], "base64"));
      }
    }
    return slides;
  }

  /**
   * Narrated videos, step 2: the voice of each slide (one MP3 per slide, read on this machine), subtitles burned in,
   * crossfades between the stills, then the music when that was asked. Returns the length in seconds.
   */
  async function renderScripted(job, slides, setPhase = async () => {}) {
    const out = videoPath(job.id);
    const dir = path.join(tmpdir(), `stills-${job.id}`);
    await mkdir(dir, { recursive: true });
    try {
      const [w, h] = SLIDE_SIZES[job.input.ratio] ?? SLIDE_SIZES["9:16"];
      const n = slides.length;
      const music = job.input.audio === "music";
      // The viewer's own narration replaces the AI voice: it is the whole soundtrack.
      const own = job.input.audioId && hasUpload(job.input.audioId) && !music ? path.join(dirs.uploads, job.input.audioId) : null;
      const FADE = 0.4;
      const LEAD = own ? 0 : 0.25; // silence before the voice in each shot
      let voices = [];
      let talk;
      let ownSeconds = 0;
      if (own) {
        // Each shot gets a share of the recording, by how many words it has.
        ownSeconds = await mediaLength(own);
        const words = slides.map((x) => Math.max(1, x.narration.split(/\s+/).length));
        const sum = words.reduce((a, b) => a + b, 0);
        talk = words.map((w) => (ownSeconds * w) / sum);
      } else if (music) {
        talk = slides.map((x) => Math.min(5, Math.max(2.6, x.narration.split(/\s+/).length / 2.6)));
      } else {
        await setPhase("Đang tạo giọng đọc…");
        const voice = job.input.lang === "en" ? `en-${job.input.voice ?? "female"}` : (job.input.voice ?? "female");
        voices = await readAloud(slides.map((x) => x.narration), voice, dir);
        talk = await Promise.all(voices.map(mediaLength));
      }
      let dur = talk.map((t) => LEAD + t + FADE + 0.25);
      let start = dur.map((_, i) => dur.slice(0, i).reduce((a, d) => a + d - FADE, 0));
      let total = start.at(-1) + dur.at(-1);
      if (own) {
        dur = talk.map((t, i) => (i < n - 1 ? t + FADE : t));
        start = talk.map((_, i) => talk.slice(0, i).reduce((a, t) => a + t, 0));
        total = ownSeconds;
      }

      // Subtitles. With the viewer's recording, the words come from its own timing (Whisper); otherwise each
      // line gets its share of the shot's voice by length.
      await setPhase("Đang ghép ảnh, giọng đọc và phụ đề…");
      let lines = [];
      if (own) {
        await setPhase("Đang nghe giọng của bạn để làm phụ đề…");
        const heard = await transcribe(own, { language: job.input.lang === "en" ? "en" : "vi" }).catch(() => null);
        for (const seg of heard?.segments ?? []) {
          const chunks = captionChunks(seg.text);
          const chars = chunks.reduce((a, c) => a + c.length, 0) || 1;
          let t = seg.start;
          for (const c of chunks) {
            const d = ((seg.end - seg.start) * c.length) / chars;
            lines.push({ text: c, from: t, to: t + d });
            t += d;
          }
        }
      }
      if (!lines.length) {
        for (const [i, slide] of slides.entries()) {
          const chunks = captionChunks(slide.narration);
          const chars = chunks.reduce((a, c) => a + c.length, 0) || 1;
          let t = start[i] + LEAD;
          for (const c of chunks) {
            const d = (talk[i] * c.length) / chars;
            lines.push({ text: c, from: t, to: t + d });
            t += d;
          }
        }
      }
      await writeFile(path.join(dir, "captions.json"), JSON.stringify({ kind: "captions", width: w, height: h, chunks: lines.map((x) => x.text) }));
      await run("python3", [TITLE_SCRIPT, path.join(dir, "caps"), path.join(dir, "captions.json")]);

      // ffmpeg: stills crossfaded, subtitle PNGs switched on in their window, each voice padded to its shot.
      const args = ["-y", "-loglevel", "error"];
      for (const [i, slide] of slides.entries()) args.push("-loop", "1", "-framerate", "30", "-t", dur[i].toFixed(3), "-i", path.join(dirs.images, slide.image));
      for (const k of lines.keys()) args.push("-loop", "1", "-framerate", "30", "-t", total.toFixed(3), "-i", path.join(dir, "caps", `cap${k + 1}.png`));
      for (const v of voices) args.push("-i", v);
      if (own) args.push("-i", own);
      const f = slides.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[v${i}]`);
      let last = "v0";
      for (let i = 1; i < n; i++) {
        f.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${start[i].toFixed(3)}[x${i}]`);
        last = `x${i}`;
      }
      for (const [k, line] of lines.entries()) {
        f.push(`[${last}][${n + k}:v]overlay=0:0:enable='between(t,${line.from.toFixed(2)},${line.to.toFixed(2)})'[o${k}]`);
        last = `o${k}`;
      }
      const map = ["-map", `[${last}]`];
      if (own) {
        f.push(`[${n + lines.length}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[aout]`);
        map.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
      } else if (voices.length) {
        const a0 = n + lines.length;
        voices.forEach((_, i) => {
          const len = i < n - 1 ? dur[i] - FADE : dur[i];
          const ms = Math.round(LEAD * 1000);
          f.push(`[${a0 + i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms},apad,atrim=duration=${len.toFixed(3)}[a${i}]`);
        });
        f.push(`${voices.map((_, i) => `[a${i}]`).join("")}concat=n=${n}:v=0:a=1[aout]`);
        map.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
      }
      await run("ffmpeg", [...args, "-filter_complex", f.join(";"), ...map, "-t", total.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { maxBuffer: 1 << 24 });
      if (music) {
        await setPhase("Đang thêm nhạc nền…");
        return addMusic(out, job.id);
      }
      return Math.round(total * 10) / 10;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Runner hook: shot list -> stills -> review (optional) or straight to the MP4 in DATA_DIR. */
  async function finish(job, content, ctx) {
    if (job.type === "image") return finishImages(job, content, ctx);
    if (job.type !== "video") return null;
    if (job.input.mode === "slideshow") return finishSlideshow(job, content, ctx);
    const script = parseScript(content);
    const shots = job.input.panelIds?.length ? script.shots.slice(0, job.input.panelIds.length) : script.shots;
    if (isMock()) {
      await ctx.setPhase("Đang dựng video demo…");
      const seconds = await mockRender(job, script, videoPath(job.id));
      return { result: scriptMarkdown(script), fields: { video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title: script.title, shots } } };
    }
    const slides = await drawStills(job, shots, ctx);
    // Optional review: the user can put their own photo into any shot, redraw or reorder, then render.
    if (job.input.review !== false) {
      return { result: `Đã vẽ xong ${slides.length} cảnh. Thêm ảnh của bạn ở cảnh nào cần, rồi bấm Dựng video.`, fields: { status: "review", slides, draft: content } };
    }
    const seconds = await renderScripted(job, slides, ctx.setPhase);
    return { result: scriptMarkdown(script), fields: narratedFields(job, slides, seconds, script.title) };
  }

  /** Music mode: an upbeat instrumental made for this video (server/music/make_music.py) replaces the silent track. */
  async function addMusic(file, jobId, mood = "upbeat") {
    const dur = Number((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])).stdout) || 30;
    const tmp = path.join(dirs.videos, `${jobId}.music`);
    const seed = parseInt(jobId.replace(/-/g, "").slice(0, 7), 16); // a different tune per video
    try {
      await run("python3", [MUSIC_SCRIPT, `${tmp}.wav`, "--seconds", dur.toFixed(2), "--seed", String(seed), "--mood", mood]);
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-i", `${tmp}.wav`, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", `${tmp}.mp4`]);
      await rename(`${tmp}.mp4`, file);
    } catch (e) {
      throw new VideoError(`Không thêm được nhạc nền (${e.code ?? e.message}). Máy chủ cần python3 có numpy và ffmpeg.`);
    } finally {
      await rm(`${tmp}.wav`, { force: true });
      await rm(`${tmp}.mp4`, { force: true });
    }
    return Math.round(dur * 10) / 10;
  }

  /** keep: "images/<file>" keys another run still uses (a restyle shares its original's photos). */
  async function remove(job, keep = new Set()) {
    const drop = async (file) => file && imagePath(file) && !keep.has(`images/${file}`) && rm(imagePath(file), { force: true });
    if (job.type === "video") await rm(videoPath(job.id), { force: true });
    for (const x of job.images?.items ?? []) await drop(x.file);
    for (const f of [job.photos?.original, job.photos?.fixed, ...(job.photos?.items ?? []).map((x) => x.file)]) await drop(f);
    for (const x of [...(job.video?.shots ?? []), ...(job.slides ?? [])]) await drop(x.image);
  }

  /**
   * "Chỉnh ảnh món": the uploaded photo, studio-graded on this server (no GPU, no model; the food is not
   * redrawn), one file per ratio in the images folder. Result for the job: { result, fields: { photos } }.
   */
  async function fixPhoto(job, { setPhase, signal } = {}) {
    const { photoId, look = "natural", ratios = ["1:1"], background = "original", ai = "off", label = "" } = job.input ?? {};
    if (!hasUpload(photoId)) throw new VideoError("Ảnh đã hết hạn lưu (7 ngày), hãy tải lại ảnh.");
    await mkdir(dirs.images, { recursive: true });
    const extra = [];
    /** Start a GPU job and wait for it (polled at /image/{id}, like the ad pictures). */
    async function onGpu(route, body, what) {
      if (!worker.url) throw new VideoError(`${what} cần GPU, mà GPU chưa được kết nối. Tắt lựa chọn này hoặc nhờ quản trị viên bật GPU.`);
      const { id } = await call(route, { method: "POST", body, signal });
      const deadline = Date.now() + 20 * 60_000; // the first call may wait for the models to load
      for (;;) {
        if (Date.now() > deadline) throw new VideoError(`${what} quá lâu, đã dừng chờ.`);
        await sleep(2500, undefined, { signal });
        let res;
        try {
          res = await call(`/image/${id}`, { signal });
        } catch (e) {
          if (signal?.aborted || /Token/.test(e.message)) throw e;
          continue; // tunnel hiccup
        }
        if (res.status === "failed") throw new VideoError(`GPU lỗi: ${res.error}`);
        if (res.status === "done") return res;
      }
    }
    // "AI làm đẹp": the GPU lightly repaints the photo for light and color; the result is then framed.
    if (PHOTO_AI[ai]) {
      const tmp = path.join(dirs.images, `.${job.id}`);
      await mkdir(tmp, { recursive: true });
      const touched = path.join(tmp, "ai.png");
      if (isMock()) {
        await copyFile(path.join(dirs.uploads, photoId), touched);
      } else {
        await setPhase?.("AI đang làm đẹp ánh sáng và màu…");
        const image = (await readFile(path.join(dirs.uploads, photoId))).toString("base64");
        const res = await onGpu("/enhance", { image, strength: PHOTO_AI[ai], prompt: label }, "AI làm đẹp");
        await writeFile(touched, Buffer.from(res.image, "base64"));
      }
      extra.push(`ai:${touched}`);
    }
    // A new surface: the GPU cuts the dish out (its pixels untouched) and draws the surface; then the
    // two are put together here, with a shadow, before the color grade.
    if (!extra.length && background !== "original" && PHOTO_BACKGROUNDS[background]) {
      const tmp = path.join(dirs.images, `.${job.id}`);
      await mkdir(tmp, { recursive: true });
      const cutout = path.join(tmp, "cutout.png");
      const back = path.join(tmp, "background.png");
      if (isMock()) {
        extra.push("mock", "mock");
      } else {
        await setPhase?.("AI đang tách món khỏi nền và vẽ nền mới…");
        const image = (await readFile(path.join(dirs.uploads, photoId))).toString("base64");
        const res = await onGpu("/cutout", { image, background: PHOTO_BACKGROUNDS[background] }, "Đổi nền");
        await writeFile(cutout, Buffer.from(res.cutout, "base64"));
        await writeFile(back, Buffer.from(res.background, "base64"));
        extra.push(cutout, back);
      }
    }
    await setPhase?.("Đang chỉnh sáng, màu và khung ảnh…");
    const { stdout } = await run(process.env.PYTHON ?? "python3", [PHOTO_SCRIPT, path.join(dirs.uploads, photoId), dirs.images, job.id, look, ratios.join(","), ...extra], { timeout: 120_000 });
    await rm(path.join(dirs.images, `.${job.id}`), { recursive: true, force: true });
    const photos = JSON.parse(stdout.trim().split("\n").at(-1));
    return { result: `Đã chỉnh ${photos.items.length} ảnh: ${photos.items.map((x) => x.ratio).join(", ")}.`, fields: { photos: { ...photos, look, background, ai } } };
  }

  /** A picture the app made (a fixed dish photo) as an upload, so another tool (a slideshow) can use it. */
  async function importImage(file) {
    const src = imagePath(file);
    if (!src || !existsSync(src)) throw new VideoError("Ảnh không còn trên máy chủ");
    const id = `${randomUUID()}${path.extname(file).toLowerCase()}`;
    await mkdir(dirs.uploads, { recursive: true });
    await copyFile(src, path.join(dirs.uploads, id));
    return id;
  }

  return { init, status, setWorker, saveUpload, hasUpload, videoPath, imagePath, finish, remove, redrawSlide, replaceSlide, renderSlides, fixPhoto, importImage };
}
