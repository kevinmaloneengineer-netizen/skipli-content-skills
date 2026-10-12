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
import { checkFacts } from "./facts.mjs";
import { slideRoles } from "./prompts.mjs";

const run = promisify(execFile);
const MUSIC_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "music", "make_music.py");
const TITLE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "overlay", "make_title.py");
const VOICE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "voice", "tts.py");
// Same voices as the GPU worker (video-worker/worker.py VOICES).
const VOICES = { female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural", "en-female": "en-US-AriaNeural", "en-male": "en-US-GuyNeural" };
export const RATIOS = { "9:16": [480, 832], "16:9": [832, 480], "1:1": [640, 640] };
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const UPLOAD_ID = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const MAX_UPLOAD = 6 * 1024 * 1024;

export class VideoError extends Error {}

export const IMAGE_SIZES = { "1:1": [1024, 1024], "4:5": [896, 1120], "9:16": [768, 1344], "16:9": [1344, 768] };
const IMAGE_FILE = /^[0-9a-f-]{36}-[rs]?\d{1,2}\.(png|jpg|webp)$/; // "-r3": a slideshow's real photo, "-s3": a narrated video's still
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
    const files = slides.map((x) => path.join(dirs.images, x.image));
    await setPhase("Đang ghép ảnh thành video…");
    const out = videoPath(job.id);
    const title = job.input.name && job.input.layout === "single" ? await titleCard(job) : null; // the templates draw their own cards
    try {
      if (job.input.layout !== "single") {
        const logo = job.input.logoId && hasUpload(job.input.logoId) ? path.join(dirs.uploads, job.input.logoId) : null;
        const text = landingText(content);
        // Dish names the user typed (with their prices) first; names the AI picked fill the rest, never a price.
        const dishes = [0, 1, 2, 3].map((k) => job.input.dishes?.[k]?.name ? job.input.dishes[k] : text.dishes[k] ? { name: text.dishes[k], price: "" } : null).filter(Boolean);
        await collage(slides.map((x, i) => ({ ...x, file: files[i] })), out, { template: job.input.layout, ratio: job.input.ratio, seconds: job.input.seconds ?? 15, name: job.input.name, city: job.input.city, address: job.input.address, phone: job.input.phone, logo, lang: job.input.lang, offer: job.input.offer, ...text, dishes });
      } else {
        await slideshow(files, out, { ratio: job.input.ratio, seconds: job.input.seconds ?? 15, title });
      }
    } finally {
      if (title) await rm(title, { force: true });
    }
    await setPhase("Đang thêm nhạc nền…");
    const seconds = await addMusic(out, job.id, "soft");
    const shots = slides.map((x) => ({ narration: "", visual: x.prompt, motion: "", role: "scene", image: x.image }));
    // Caption + hashtags to post with the video; invented prices or offers become placeholders.
    const words = landingText(content);
    const facts = Object.values(job.input ?? {}).filter((v) => typeof v === "string").join("\n");
    const caption = words.caption ? checkFacts(words.caption, facts).text : "";
    const realCount = slides.filter((x) => x.real).length;
    return {
      result: `Video trình chiếu ${files.length} ảnh (${realCount} ảnh thật, ${files.length - realCount} ảnh AI vẽ), nhạc nền không lời.\n\n${shots.map((x, i) => `${i + 1}. ${x.visual}`).join("\n")}`,
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
    return { ...out, fields: { ...out.fields, images, slides } };
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
      const { id } = await call("/image", { method: "POST", body: { prompts: [text], size: job.input.ratio, style: job.input.style ?? "real", negative: SLIDE_NEGATIVE } });
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

  /**
   * Narrated videos (topic, storyboard, story): one still per shot (a storyboard panel, the narrator's photo,
   * or drawn on the GPU like the slideshow photos), the narration read on this machine, subtitles burned in,
   * crossfades between shots. Moving clips from the free GPU looked bad, so there are none.
   * Sets script.images (files in /media/images) and returns the length in seconds.
   */
  async function stillsVideo(job, script, out, { setPhase, signal }) {
    if (!worker.url) throw new VideoError("Chưa kết nối GPU. Mở trang Tạo video AI để kết nối rồi chạy lại.");
    const panels = (job.input.panelIds ?? []).filter(hasUpload);
    const shots = panels.length ? script.shots.slice(0, panels.length) : script.shots;
    const reference = job.input.referenceImageId && hasUpload(job.input.referenceImageId) ? job.input.referenceImageId : null;
    const [w, h] = SLIDE_SIZES[job.input.ratio] ?? SLIDE_SIZES["9:16"];
    const music = job.input.audio === "music";
    const dir = path.join(tmpdir(), `stills-${job.id}`);
    await mkdir(dir, { recursive: true });
    try {
      // 1. One still per shot: the storyboard panel, the narrator's own photo, else drawn on the GPU.
      const images = [];
      const draw = [];
      for (const [i, shot] of shots.entries()) {
        const own = panels[i] ?? (shot.role === "narrator" && reference ? reference : null);
        if (own) {
          images[i] = freeName(job.id, path.extname(own).slice(1), "s");
          await copyFile(path.join(dirs.uploads, own), path.join(dirs.images, images[i]));
        } else draw.push(i);
      }
      if (draw.length) {
        await setPhase(`Đang vẽ ${draw.length} ảnh trên GPU…`);
        const res = await drawOnGpu({ prompts: draw.map((i) => shots[i].visual), size: job.input.ratio, style: job.input.style ?? "real", negative: STILL_NEGATIVE }, signal);
        for (const [k, i] of draw.entries()) {
          images[i] = freeName(job.id, "png", "s");
          await writeFile(path.join(dirs.images, images[i]), Buffer.from(res.images[k], "base64"));
        }
      }
      script.images = images;

      // 2. Voice (one MP3 per shot) and the time each shot stays on screen.
      const FADE = 0.4;
      const LEAD = 0.25; // silence before the voice in each shot
      let voices = [];
      let talk;
      if (music) {
        talk = shots.map((x) => Math.min(5, Math.max(2.6, x.narration.split(/\s+/).length / 2.6)));
      } else {
        await setPhase("Đang tạo giọng đọc…");
        const voice = job.input.lang === "en" ? `en-${job.input.voice ?? "female"}` : (job.input.voice ?? "female");
        voices = await readAloud(shots.map((x) => x.narration), voice, dir);
        talk = await Promise.all(voices.map(mediaLength));
      }
      const dur = talk.map((t) => LEAD + t + FADE + 0.25);
      const start = dur.map((_, i) => dur.slice(0, i).reduce((a, d) => a + d - FADE, 0));
      const total = start.at(-1) + dur.at(-1);

      // 3. Subtitles: each line gets its share of the shot's voice by length.
      await setPhase("Đang ghép ảnh, giọng đọc và phụ đề…");
      const lines = [];
      for (const [i, shot] of shots.entries()) {
        const chunks = captionChunks(shot.narration);
        const chars = chunks.reduce((a, c) => a + c.length, 0) || 1;
        let t = start[i] + LEAD;
        for (const c of chunks) {
          const d = (talk[i] * c.length) / chars;
          lines.push({ text: c, from: t, to: t + d });
          t += d;
        }
      }
      await writeFile(path.join(dir, "captions.json"), JSON.stringify({ kind: "captions", width: w, height: h, chunks: lines.map((x) => x.text) }));
      await run("python3", [TITLE_SCRIPT, path.join(dir, "caps"), path.join(dir, "captions.json")]);

      // 4. ffmpeg: stills crossfaded, subtitle PNGs switched on in their window, each voice padded to its shot.
      const n = shots.length;
      const args = ["-y", "-loglevel", "error"];
      for (const [i, img] of images.entries()) args.push("-loop", "1", "-framerate", "30", "-t", dur[i].toFixed(3), "-i", path.join(dirs.images, img));
      for (const k of lines.keys()) args.push("-loop", "1", "-framerate", "30", "-t", total.toFixed(3), "-i", path.join(dir, "caps", `cap${k + 1}.png`));
      for (const v of voices) args.push("-i", v);
      const f = images.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[v${i}]`);
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
      if (voices.length) {
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
      return Math.round(total * 10) / 10;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Runner hook: shot list -> stills + voice + subtitles -> MP4 in DATA_DIR. */
  async function finish(job, content, ctx) {
    if (job.type === "image") return finishImages(job, content, ctx);
    if (job.type !== "video") return null;
    if (job.input.mode === "slideshow") return finishSlideshow(job, content, ctx);
    const { setPhase } = ctx;
    const script = parseScript(content);
    const result = scriptMarkdown(script);
    const out = videoPath(job.id);
    let seconds;

    if (isMock()) {
      await setPhase("Đang dựng video demo…");
      seconds = await mockRender(job, script, out);
    } else {
      seconds = await stillsVideo(job, script, out, ctx);
    }
    if (job.input.audio === "music") {
      await setPhase("Đang thêm nhạc nền…");
      seconds = await addMusic(out, job.id);
    }
    const shots = (job.input.panelIds?.length ? script.shots.slice(0, job.input.panelIds.length) : script.shots).map((x, i) => ({ ...x, image: script.images?.[i] }));
    return { result, fields: { video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title: script.title, shots } } };
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

  async function remove(job) {
    if (job.type === "video") await rm(videoPath(job.id), { force: true });
    for (const x of job.images?.items ?? []) if (imagePath(x.file)) await rm(imagePath(x.file), { force: true });
    for (const x of [...(job.video?.shots ?? []), ...(job.slides ?? [])]) if (x.image && imagePath(x.image)) await rm(imagePath(x.image), { force: true });
  }

  return { init, status, setWorker, saveUpload, hasUpload, videoPath, imagePath, finish, remove, redrawSlide, replaceSlide, renderSlides };
}
