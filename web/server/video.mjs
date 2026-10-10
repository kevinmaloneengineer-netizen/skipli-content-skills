// AI video: the writer agent returns a shot list (JSON), then a GPU worker
// (video-worker/, run on a free Kaggle/Colab GPU) renders it to MP4. The worker
// URL changes every GPU session, so it is set from the UI and kept in DATA_DIR.

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const run = promisify(execFile);
const MUSIC_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "music", "make_music.py");
const TITLE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "overlay", "make_title.py");
export const RATIOS = { "9:16": [480, 832], "16:9": [832, 480], "1:1": [640, 640] };
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const UPLOAD_ID = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const MAX_UPLOAD = 6 * 1024 * 1024;

export class VideoError extends Error {}

export const IMAGE_SIZES = { "1:1": [1024, 1024], "4:5": [896, 1120], "9:16": [768, 1344], "16:9": [1344, 768] };
const IMAGE_FILE = /^[0-9a-f-]{36}-r?\d{1,2}\.(png|jpg|webp)$/; // "-r3": a slideshow's real photo
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
    const zoom = i % 2 === 0 ? `1+0.10*on/${frames}` : `1.10-0.10*on/${frames}`;
    const drift = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0; // left, right or none
    // zoompan on a 2x picture keeps the motion smooth (it moves in whole pixels).
    return `[${i}:v]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},` +
      `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+${drift}*(on/${frames}-0.5)*iw*0.03':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=${fps},setsar=1,format=yuv420p[v${i}]`;
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
      const { id } = await call("/image", { method: "POST", body, signal });
      const deadline = Date.now() + 20 * 60_000; // first call of a session may wait for the models to load
      for (;;) {
        if (Date.now() > deadline) throw new VideoError("Vẽ ảnh quá lâu, đã dừng chờ.");
        await sleep(3000, undefined, { signal });
        try {
          res = await call(`/image/${id}`, { signal });
        } catch (e) {
          if (signal.aborted || /Token/.test(e.message)) throw e;
          continue; // tunnel hiccup
        }
        if (res.status === "failed") throw new VideoError(`GPU vẽ lỗi: ${res.error}`);
        if (res.status === "done") break;
      }
      await Promise.all(res.images.map((b64, i) => writeFile(path.join(dirs.images, files[i]), Buffer.from(b64, "base64"))));
    }
    if (res?.width) [w, h] = [res.width, res.height]; // the worker decides the real size
    const images = plan.images.map((x, i) => ({ ...x, file: files[i] }));
    return {
      result: images.map((x, i) => `### Ảnh ${i + 1}\n**${x.headline}**${x.sub ? `\n${x.sub}` : ""}${x.cta ? `\n[${x.cta}]` : ""}\n\n${x.caption ?? ""}`).join("\n\n"),
      fields: { images: { size: job.input.size, width: w, height: h, items: images } },
    };
  }

  /**
   * Photo slideshow: the GPU draws the stills (same path as "Ảnh AI"), then ffmpeg here gives each a slow
   * zoom/pan, joins them with crossfades and lays soft music under it. No voice, no text.
   */
  async function finishSlideshow(job, content, ctx) {
    const { setPhase } = ctx;
    // The name never goes to the image model (it would paint it, misspelt), and nobody should appear.
    const name = String(job.input.name ?? "").trim();
    const clean = name ? String(content).replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "the restaurant") : content;
    const real = (job.input.photoIds ?? []).filter(hasUpload).map((id) => ({ file: path.join(dirs.uploads, id), prompt: "Ảnh thật của quán", upload: id }));
    let drawnImages = { items: [] };
    if (job.input.ai !== 0) {
      const drawn = await finishImages({ ...job, input: { ...job.input, size: job.input.ratio, negative: "people, person, face, hands, fingers, crowd, text, signage, menu board" } }, clean, ctx);
      drawnImages = drawn.fields.images;
      drawnImages.items = drawnImages.items.slice(0, Math.max(0, (job.input.count ?? 5) - real.length));
    }
    const slides = [...real, ...drawnImages.items.map((x) => ({ ...x, file: path.join(dirs.images, x.file), image: x.file }))];
    if (slides.length < 2) throw new VideoError("Cần ít nhất 2 ảnh để làm video trình chiếu.");
    const files = slides.map((x) => x.file);
    await setPhase("Đang ghép ảnh thành video…");
    const out = videoPath(job.id);
    const title = job.input.name ? await titleCard(job) : null;
    try {
      await slideshow(files, out, { ratio: job.input.ratio, seconds: job.input.seconds ?? 15, title });
    } finally {
      if (title) await rm(title, { force: true });
    }
    await setPhase("Đang thêm nhạc nền…");
    const seconds = await addMusic(out, job.id, "soft");
    // Thumbnails: drawn stills live in /media/images, real photos are copied there too.
    for (const [i, x] of slides.entries()) {
      if (!x.upload) continue;
      x.image = `${job.id}-r${i + 1}.${path.extname(x.upload).slice(1)}`;
      await copyFile(x.file, path.join(dirs.images, x.image));
    }
    const shots = slides.map((x) => ({ narration: "", visual: x.prompt, motion: "", role: "scene", image: x.image }));
    return {
      result: `Video trình chiếu ${files.length} ảnh (${real.length} ảnh thật, ${files.length - real.length} ảnh AI vẽ), nhạc nền không lời.\n\n${shots.map((x, i) => `${i + 1}. ${x.visual}`).join("\n")}`,
      fields: { images: drawnImages, video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title: job.title, shots, slideshow: true } },
    };
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

  /** Runner hook: shot list -> worker render -> MP4 in DATA_DIR. */
  async function finish(job, content, ctx) {
    if (job.type === "image") return finishImages(job, content, ctx);
    if (job.type !== "video") return null;
    if (job.input.mode === "slideshow") return finishSlideshow(job, content, ctx);
    const { setPhase, signal } = ctx;
    const script = parseScript(content);
    const result = scriptMarkdown(script);
    const out = videoPath(job.id);
    let seconds;
    let workerNotice = null;

    if (isMock()) {
      await setPhase("Đang dựng video demo…");
      seconds = await mockRender(job, script, out);
    } else {
      if (!worker.url) throw new VideoError("Chưa kết nối GPU. Mở trang Tạo video AI để kết nối rồi chạy lại.");
      const body = { shots: script.shots, ratio: job.input.ratio, voice: job.input.lang === "en" ? `en-${job.input.voice}` : job.input.voice, audio: job.input.audio ?? "voice", style: job.input.style, engine: job.input.engine ?? "ltx" };
      if (body.engine === "wan" && process.env.HF_TOKEN) body.hf_token = process.env.HF_TOKEN; // more free Hugging Face quota than anonymous
      const b64 = async (id) => (hasUpload(id) ? (await readFile(path.join(dirs.uploads, id))).toString("base64") : null);
      if (job.input.referenceImageId) body.reference_image = await b64(job.input.referenceImageId);
      if (job.input.panelIds?.length) {
        // storyboard: panel i is the first frame of shot i; extra shots or panels are dropped
        body.shots = await Promise.all(script.shots.slice(0, job.input.panelIds.length).map(async (s, i) => ({ ...s, continue: false, image: await b64(job.input.panelIds[i]) })));
      }
      await setPhase("Đang gửi kịch bản cho GPU…");
      const { id } = await call("/render", { method: "POST", body, signal });
      // Canceled here → stop the GPU too (an old worker without DELETE just finishes the render).
      signal.addEventListener("abort", () => request(`/render/${id}`, { method: "DELETE" }).catch(() => {}), { once: true });
      const deadline = Date.now() + timeoutMs;
      let last = "";
      for (;;) {
        if (Date.now() > deadline) throw new VideoError("Dựng video quá lâu, đã dừng chờ.");
        await sleep(5000, undefined, { signal });
        let st;
        try {
          st = await call(`/render/${id}`, { signal });
        } catch (e) {
          if (signal.aborted || e instanceof VideoError) throw e;
          log.warn?.(`video ${job.id}: poll failed: ${e.message}`);
          continue; // tunnel hiccup; keep waiting
        }
        if (st.status === "failed") throw new VideoError(`GPU dựng lỗi: ${st.error}`);
        if (st.notice) workerNotice = st.notice;
        if (st.status === "done") {
          seconds = st.duration;
          break;
        }
        if (st.phase && st.phase !== last) await setPhase((last = st.phase));
      }
      await setPhase("Đang tải video về…");
      const res = await call(`/render/${id}/video`, { signal, raw: true });
      await writeFile(out, Buffer.from(await res.arrayBuffer()));
    }
    if (job.input.audio === "music") {
      await setPhase("Đang thêm nhạc nền…");
      seconds = await addMusic(out, job.id);
    }
    const shots = job.input.panelIds?.length ? script.shots.slice(0, job.input.panelIds.length) : script.shots;
    return { result, fields: { video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title: script.title, shots, engine: job.input.engine ?? "ltx" }, ...(workerNotice ? { notice: workerNotice } : {}) } };
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
    for (const x of job.video?.shots ?? []) if (x.image && imagePath(x.image)) await rm(imagePath(x.image), { force: true });
  }

  return { init, status, setWorker, saveUpload, hasUpload, videoPath, imagePath, finish, remove };
}
