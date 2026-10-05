// AI video: the writer agent returns a shot list (JSON), then a GPU worker
// (video-worker/, run on a free Kaggle/Colab GPU) renders it to MP4. The worker
// URL changes every GPU session, so it is set from the UI and kept in DATA_DIR.

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const run = promisify(execFile);
export const RATIOS = { "9:16": [480, 832], "16:9": [832, 480], "1:1": [640, 640] };
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const UPLOAD_ID = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const MAX_UPLOAD = 6 * 1024 * 1024;

export class VideoError extends Error {}

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

export function createVideoService({ dataDir, timeoutMs, mock, log = console }) {
  const dirs = { videos: path.join(dataDir, "videos"), uploads: path.join(dataDir, "uploads") };
  const settingsFile = path.join(dataDir, "video-worker.json");
  let worker = { url: process.env.VIDEO_WORKER_URL ?? "", token: process.env.VIDEO_WORKER_TOKEN ?? "" };

  async function init() {
    await mkdir(dirs.videos, { recursive: true });
    await mkdir(dirs.uploads, { recursive: true });
    try {
      worker = { ...worker, ...JSON.parse(await readFile(settingsFile, "utf8")) };
    } catch {
      // no saved worker yet
    }
  }

  const isMock = () => worker.url === "mock" || (!worker.url && mock);

  async function call(p, { method = "GET", body, signal, raw = false } = {}) {
    const res = await fetch(`${worker.url}${p}`, {
      method,
      headers: { Authorization: `Bearer ${worker.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(15_000),
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

  /** Runner hook: shot list -> worker render -> MP4 in DATA_DIR. */
  async function finish(job, content, { setPhase, signal }) {
    if (job.type !== "video") return null;
    const script = parseScript(content);
    const result = scriptMarkdown(script);
    const out = videoPath(job.id);
    let seconds;

    if (isMock()) {
      await setPhase("Đang dựng video demo…");
      seconds = await mockRender(job, script, out);
    } else {
      if (!worker.url) throw new VideoError("Chưa kết nối GPU. Mở trang Tạo video AI để kết nối rồi chạy lại.");
      const body = { shots: script.shots, ratio: job.input.ratio, voice: job.input.voice, style: job.input.style };
      const b64 = async (id) => (hasUpload(id) ? (await readFile(path.join(dirs.uploads, id))).toString("base64") : null);
      if (job.input.referenceImageId) body.reference_image = await b64(job.input.referenceImageId);
      if (job.input.panelIds?.length) {
        // storyboard: panel i is the first frame of shot i; extra shots or panels are dropped
        body.shots = await Promise.all(script.shots.slice(0, job.input.panelIds.length).map(async (s, i) => ({ ...s, continue: false, image: await b64(job.input.panelIds[i]) })));
      }
      await setPhase("Đang gửi kịch bản cho GPU…");
      const { id } = await call("/render", { method: "POST", body, signal });
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
    const shots = job.input.panelIds?.length ? script.shots.slice(0, job.input.panelIds.length) : script.shots;
    return { result, fields: { video: { file: `${job.id}.mp4`, duration: seconds, ratio: job.input.ratio, title: script.title, shots } } };
  }

  return { init, status, setWorker, saveUpload, hasUpload, videoPath, finish, remove: (jobId) => rm(videoPath(jobId), { force: true }) };
}
