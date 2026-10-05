"""Skipli video worker: turns a shot list into a short MP4 on a free GPU (Kaggle / Colab).

Per shot: keyframe (SDXL-Turbo; from the reference image when given, or the last
frame of the previous clip for "continue" shots) -> clip (LTX-Video image-to-video)
-> Vietnamese voice (Edge TTS) -> clip stretched to the voice, subtitles burned in.
Then all shots are concatenated. One render at a time; the web app polls progress.

  POST /render            {"shots": [...], "ratio": "9:16", "voice": "female", "reference_image": "<base64>"}
  GET  /render/{id}       {"status", "phase", "done", "total", "error"}
  GET  /render/{id}/video MP4
  GET  /health

Env: WORKER_TOKEN (required, sent as "Authorization: Bearer ..."), WORKER_MOCK=1 (no GPU:
keyframes are gradients, clips are slow zooms; for testing the pipeline), LTX_MODEL, LTX_STEPS.
"""

import asyncio
import base64
import hmac
import io
import json
import os
import queue
import re
import shutil
import subprocess
import threading
import time
import traceback
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from PIL import Image

TOKEN = os.environ.get("WORKER_TOKEN", "")
MOCK = os.environ.get("WORKER_MOCK") == "1"
WORK = Path(os.environ.get("WORKER_DIR", "/tmp/skipli-video"))
LTX_MODEL = os.environ.get("LTX_MODEL", "Lightricks/LTX-Video")
LTX_STEPS = int(os.environ.get("LTX_STEPS", "30"))
FPS = 24
SIZES = {"9:16": (480, 832), "16:9": (832, 480), "1:1": (640, 640)}
VOICES = {"female": "vi-VN-HoaiMyNeural", "male": "vi-VN-NamMinhNeural"}
STYLES = {
    "real": "photorealistic, natural light, sharp focus",
    "cinematic": "cinematic film still, dramatic lighting, shallow depth of field",
    "anime": "anime style, cel shading, vibrant colors",
    "pixar": "3D animation, Pixar style, soft lighting",
    "clay": "claymation, plasticine, stop motion look",
    "cyberpunk": "cyberpunk, neon lights, night city",
}
NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted, deformed, text, watermark, logo"
MAX_SHOTS = 14

WORK.mkdir(parents=True, exist_ok=True)
FONT_DIR = next((d for d in ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu", "/Library/Fonts"] if os.path.isdir(d)), None)
HAS_SUBTITLES = " subtitles " in subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout


class Shot(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    narration: str = Field(max_length=400)
    visual: str = Field(max_length=600)
    motion: str = Field("", max_length=300)
    cont: bool = Field(False, alias="continue")
    role: str = "scene"  # "narrator": the storyteller talking to camera (keyframe = reference photo as is)
    image: Optional[str] = None  # base64 keyframe for this shot (a storyboard panel); skips generation


class RenderRequest(BaseModel):
    shots: List[Shot]
    ratio: str = "9:16"
    voice: str = "female"
    reference_image: Optional[str] = None
    style: str = "real"
    seed: Optional[int] = None


# ---------------------------------------------------------------- models

_models = {}
_model_lock = threading.Lock()
_model_state = {"status": "mock" if MOCK else "idle", "error": None}


def models():
    """Load SDXL-Turbo (keyframes) + LTX-Video (image-to-video) once; offload to fit a 16 GB T4."""
    with _model_lock:
        if _models:
            return _models
        _model_state["status"] = "loading"
        import torch
        from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image, LTXImageToVideoPipeline

        cap = torch.cuda.get_device_capability(0)[0]
        # T4/P100 have no native bf16; LTX_DTYPE overrides if fp16 gives black frames.
        dtype = {"bf16": torch.bfloat16, "fp16": torch.float16}.get(os.environ.get("LTX_DTYPE", ""), torch.bfloat16 if cap >= 8 else torch.float16)
        ltx = LTXImageToVideoPipeline.from_pretrained(LTX_MODEL, torch_dtype=dtype)
        ltx.enable_model_cpu_offload(gpu_id=0)
        ltx.vae.enable_tiling()

        t2i = AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.float16, variant="fp16")
        if torch.cuda.device_count() > 1:  # Kaggle "T4 x2": keyframes on the second GPU
            t2i.to("cuda:1")
            i2i = AutoPipelineForImage2Image.from_pipe(t2i)
        else:
            t2i.enable_model_cpu_offload()
            i2i = AutoPipelineForImage2Image.from_pipe(t2i)
            i2i.enable_model_cpu_offload()
        _models.update(torch=torch, ltx=ltx, t2i=t2i, i2i=i2i, dtype=str(dtype))
        _model_state["status"] = "ready"
        return _models


def warm_up():
    if MOCK:
        return
    try:
        models()
    except Exception as e:  # noqa: BLE001 - reported on /health
        _model_state.update(status="error", error=f"{type(e).__name__}: {e}")
        traceback.print_exc()


# ---------------------------------------------------------------- helpers

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {p.stderr[-800:]}")
    return p.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def fit(img, w, h):
    """Center-crop to the target aspect ratio, then resize."""
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    img = img.resize((max(w, round(iw * scale)), max(h, round(ih * scale))), Image.LANCZOS)
    iw, ih = img.size
    left, top = (iw - w) // 2, (ih - h) // 2
    return img.crop((left, top, left + w, top + h)).convert("RGB")


def num_frames(seconds):
    """LTX wants 8k+1 frames; 2 to 5 s per clip (longer narration is covered by slowing + holding)."""
    n = round(min(max(seconds * 1.15, 2.0), 5.0) * FPS / 8) * 8 + 1  # +15%: the smeared tail is cut off
    return n


def tts(text, voice, path):
    import edge_tts

    async def go():
        await edge_tts.Communicate(text, voice).save(str(path))

    # The free Edge endpoint sometimes answers with no audio; a retry usually works.
    for attempt in range(5):
        try:
            return asyncio.run(go())
        except Exception:  # noqa: BLE001
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def write_srt(text, dur, path):
    """Split narration into short lines, timed by character share (no word timings from TTS)."""
    words = text.split()
    chunks, cur = [], []
    for wd in words:
        cur.append(wd)
        if len(cur) >= 7 or re.search(r"[.,!?;:]$", wd) and len(cur) >= 3:
            chunks.append(" ".join(cur))
            cur = []
    if cur:
        chunks.append(" ".join(cur))
    total = sum(len(c) for c in chunks) or 1
    t, lines = 0.0, []
    for i, c in enumerate(chunks, 1):
        d = dur * len(c) / total
        lines.append(f"{i}\n{srt_time(t)} --> {srt_time(min(dur, t + d))}\n{c}\n")
        t += d
    Path(path).write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------- pipeline

def decode_image(b64):
    return Image.open(io.BytesIO(base64.b64decode(b64.split(",", 1)[-1]))).convert("RGB")


def keyframe(shot, prev_last, reference, w, h, seed, style="real"):
    if shot.image:
        return fit(decode_image(shot.image), w, h)
    if shot.role == "narrator" and reference is not None:
        return fit(reference, w, h)  # keep the narrator's face exactly
    if shot.cont and prev_last is not None:
        return prev_last
    if MOCK:
        img = Image.linear_gradient("L").resize((w, h)).convert("RGB")
        return Image.merge("RGB", (img.getchannel(0), Image.new("L", (w, h), (seed * 37) % 255), img.getchannel(2)))
    m = models()
    torch = m["torch"]
    gen = torch.Generator("cpu").manual_seed(seed)
    gw, gh = (round(w * 1.07 / 64) * 64, round(h * 1.07 / 64) * 64)
    # SDXL reads ~75 tokens: the shot's own subject/action first, style last.
    prompt = f"{shot.visual}, {STYLES.get(style, STYLES['real'])}"
    if reference is not None:
        img = m["i2i"](prompt=prompt, image=fit(reference, gw, gh), strength=0.55, num_inference_steps=4, guidance_scale=0.0, generator=gen).images[0]
    else:
        img = m["t2i"](prompt=prompt, width=gw, height=gh, num_inference_steps=4, guidance_scale=0.0, generator=gen).images[0]
    return fit(img, w, h)


def animate(shot, image, seconds, w, h, seed, out, style="real"):
    """Image-to-video; returns the last frame (for "continue" shots)."""
    n = num_frames(seconds)
    if MOCK:
        image.save(out.with_suffix(".png"))
        run(["ffmpeg", "-y", "-loop", "1", "-i", str(out.with_suffix(".png")), "-vf",
             f"zoompan=z='1+0.0015*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={w}x{h}:fps={FPS}",
             "-frames:v", str(n), "-pix_fmt", "yuv420p", str(out)])
        return image
    from diffusers.utils import export_to_video

    m = models()
    gen = m["torch"].Generator("cpu").manual_seed(seed)
    motion = shot.motion or ("the person talks to the camera with natural facial expressions and small head movements" if shot.role == "narrator" else "")
    prompt = f"{shot.visual}. {motion}. {STYLES.get(style, STYLES['real'])}".strip()
    frames = m["ltx"](image=image, prompt=prompt, negative_prompt=NEGATIVE, width=w, height=h, num_frames=n,
                      num_inference_steps=LTX_STEPS, guidance_scale=3.0, generator=gen).frames[0]
    frames = frames[: len(frames) - max(4, len(frames) // 8)]  # LTX's last frames smear; drop them
    export_to_video(frames, str(out), fps=FPS)
    return frames[-1] if isinstance(frames[-1], Image.Image) else Image.fromarray(frames[-1])


def finish_shot(clip, audio, srt, dur, w, out):
    """Stretch the clip to the voice (slow down up to 1.5x, then hold the last frame), burn subtitles."""
    k = min(max(dur / duration(clip), 1.0), 1.25)
    vf = f"setpts={k:.4f}*PTS,tpad=stop_mode=clone:stop_duration={dur:.2f},fps={FPS},format=yuv420p"
    if HAS_SUBTITLES:
        size = 15 if w < 600 else 12
        style = f"FontName=DejaVu Sans,FontSize={size},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=38"
        vf += f",subtitles={srt}:force_style='{style}'" + (f":fontsdir={FONT_DIR}" if FONT_DIR else "")
    run(["ffmpeg", "-y", "-i", str(clip), "-i", str(audio), "-filter_complex", f"[0:v]{vf}[v];[1:a]apad,aresample=44100[a]",
         "-map", "[v]", "-map", "[a]", "-t", f"{dur:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-c:a", "aac", "-b:a", "128k", "-ac", "2", str(out)])


def render(job, req):
    d = WORK / job["id"]
    d.mkdir(parents=True, exist_ok=True)
    w, h = SIZES.get(req.ratio, SIZES["9:16"])
    voice = VOICES.get(req.voice, VOICES["female"])
    reference = None
    if req.reference_image:
        reference = decode_image(req.reference_image)
    seed = req.seed if req.seed is not None else int(time.time()) % 100000
    job["total"] = len(req.shots)

    if not MOCK and _model_state["status"] != "ready":
        job["phase"] = "Đang tải model AI (lần đầu mất vài phút)…"
        models()

    parts, last = [], None
    for i, shot in enumerate(req.shots, 1):
        job["phase"] = f"Đang dựng cảnh {i}/{len(req.shots)}…"
        audio = d / f"s{i}.mp3"
        tts(shot.narration, voice, audio)
        dur = duration(audio) + 0.3
        image = keyframe(shot, last, reference, w, h, seed + i, req.style)
        clip = d / f"s{i}_raw.mp4"
        last = animate(shot, image, dur, w, h, seed + i, clip, req.style)
        write_srt(shot.narration, dur, d / f"s{i}.srt")
        part = d / f"s{i}.mp4"
        finish_shot(clip, audio, d / f"s{i}.srt", dur, w, part)
        parts.append(part)
        job["done"] = i

    job["phase"] = "Đang ghép video…"
    (d / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(d / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(d / "final.mp4")])
    job["duration"] = round(duration(d / "final.mp4"), 1)


# ---------------------------------------------------------------- queue + API

jobs = {}
todo = queue.Queue()


def loop():
    while True:
        job, req = todo.get()
        job["status"] = "running"
        try:
            render(job, req)
            job.update(status="done", phase=None)
        except Exception as e:  # noqa: BLE001 - reported to the web app
            traceback.print_exc()
            job.update(status="failed", phase=None, error=f"{type(e).__name__}: {e}"[:500])
        # keep the last few renders on disk
        old = sorted((j for j in jobs.values() if j["status"] in ("done", "failed")), key=lambda j: j["created"])[:-5]
        for j in old:
            shutil.rmtree(WORK / j["id"], ignore_errors=True)
            jobs.pop(j["id"], None)


threading.Thread(target=loop, daemon=True).start()
threading.Thread(target=warm_up, daemon=True).start()
app = FastAPI()


def check(auth):
    if not TOKEN:
        raise HTTPException(500, "WORKER_TOKEN is not set")
    if not hmac.compare_digest((auth or "").removeprefix("Bearer ").strip(), TOKEN):
        raise HTTPException(401, "bad token")


@app.get("/health")
def health(authorization: str = Header(None)):
    check(authorization)
    gpu = None
    if not MOCK:
        try:
            import torch
            gpu = [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]
        except Exception:  # noqa: BLE001
            gpu = None
    return {"ok": True, "mock": MOCK, "models": _model_state, "gpu": gpu, "subtitles": HAS_SUBTITLES,
            "queue": todo.qsize(), "busy": any(j["status"] == "running" for j in jobs.values())}


@app.post("/render")
def start(req: RenderRequest, authorization: str = Header(None)):
    check(authorization)
    if not 1 <= len(req.shots) <= MAX_SHOTS:
        raise HTTPException(400, f"need 1 to {MAX_SHOTS} shots")
    job = {"id": uuid.uuid4().hex, "status": "queued", "phase": "Đang chờ GPU…", "done": 0, "total": len(req.shots),
           "error": None, "created": time.time(), "duration": None}
    jobs[job["id"]] = job
    todo.put((job, req))
    return {"id": job["id"]}


@app.get("/render/{rid}")
def status(rid: str, authorization: str = Header(None)):
    check(authorization)
    job = jobs.get(rid)
    if not job:
        raise HTTPException(404, "unknown render (worker restarted?)")
    return {k: job[k] for k in ("status", "phase", "done", "total", "error", "duration")}


@app.get("/render/{rid}/video")
def video(rid: str, authorization: str = Header(None)):
    check(authorization)
    path = WORK / rid / "final.mp4"
    if jobs.get(rid, {}).get("status") != "done" or not path.exists():
        raise HTTPException(404, "video not ready")
    return FileResponse(path, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
