"""Skipli video worker: turns a shot list into a short MP4 on a free GPU (Kaggle / Colab).

Per shot: keyframe (IMAGE_MODEL, RealVisXL Lightning by default; from the reference image when given, or the last
frame of the previous clip for "continue" shots) -> clip (LTX-Video image-to-video)
-> voice (Edge TTS, Vietnamese or US English) -> clip stretched to the voice, subtitles burned in.
Then all shots are concatenated. One render at a time; the web app polls progress.

  POST /render            {"shots": [...], "ratio": "9:16", "voice": "female", "reference_image": "<base64>"}
  GET  /render/{id}       {"status", "phase", "done", "total", "error"}
  GET  /render/{id}/video MP4
  POST /image             {"prompts": [...], "size": "1:1", "style": "real", "reference_image": "<base64>"}  → PNGs (base64)
  GET  /health

Env: WORKER_TOKEN (required, sent as "Authorization: Bearer ..."), WORKER_MOCK=1 (no GPU:
keyframes are gradients, clips are slow zooms; for testing the pipeline), LTX_MODEL, LTX_STEPS.
"""

import asyncio
import base64
import hmac
import io
import json
import math
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
WAN5B_MODEL = os.environ.get("WAN5B_MODEL", "Wan-AI/Wan2.2-TI2V-5B-Diffusers")
WAN5B_STEPS = int(os.environ.get("WAN5B_STEPS", "25"))
WAN5B_MAX_S = float(os.environ.get("WAN5B_MAX_S", "2.5"))
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")  # before torch is imported
FPS = 24
SIZES = {"9:16": (480, 832), "16:9": (832, 480), "1:1": (640, 640)}
VOICES = {"female": "vi-VN-HoaiMyNeural", "male": "vi-VN-NamMinhNeural",
          "en-female": "en-US-AriaNeural", "en-male": "en-US-GuyNeural"}  # en-*: US restaurants, English narration
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


# Final sizes. With SDXL-Turbo (sharp near 512 px) each image is drawn at half size, upscaled 2x
# and refined with a light img2img pass (adds real detail instead of a soft, stretched picture).
IMAGE_SIZES = {"1:1": (1024, 1024), "4:5": (896, 1120), "9:16": (768, 1344), "16:9": (1344, 768)}
AD_NEGATIVE = "text, letters, words, watermark, logo, blurry, low quality, deformed, extra fingers"


class ImageRequest(BaseModel):
    prompts: List[str] = Field(min_length=1, max_length=6)
    size: str = "1:1"
    style: str = "real"
    reference_image: Optional[str] = None
    seed: Optional[int] = None
    negative: Optional[str] = None  # extra things to keep out (a slideshow: "people, hands, faces")


# Free Wan 2.2 image-to-video on Hugging Face ZeroGPU Spaces (tried in order; daily quota per user/IP).
WAN_SPACES = [s.strip() for s in os.environ.get("WAN_SPACES", "zerogpu-aoti-wan2-2-fp8da-aoti-faster,r3gm-wan2-2-fp8da-aoti-preview").split(",") if s.strip()]


MUSIC_SHOT_S = 3.2  # shot length in music mode (no voice to time it)


class RenderRequest(BaseModel):
    shots: List[Shot]
    ratio: str = "9:16"
    voice: str = "female"
    reference_image: Optional[str] = None
    style: str = "real"
    seed: Optional[int] = None
    engine: str = "ltx"  # "ltx" | "wan5b" (both on this GPU) | "wan" (Hugging Face Space, falls back to wan5b)
    hf_token: Optional[str] = None
    audio: str = "voice"  # "music": no voice, ~3 s per shot, narration shown as a short on-screen caption (the app adds the music)


# ---------------------------------------------------------------- models

_models = {}
_model_lock = threading.Lock()
_sd_lock = threading.Lock()  # one SDXL call at a time: video keyframes and /image share the pipeline
_model_state = {"status": "mock" if MOCK else "idle", "error": None}


# Still images (ads, slideshows, video keyframes). RealVisXL Lightning: SDXL tuned for real photos, ~6 steps,
# follows negative prompts (no text, no signs). IMAGE_MODEL=stabilityai/sdxl-turbo brings back the old, faster look.
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "SG161222/RealVisXL_V5.0_Lightning")
TURBO = "turbo" in IMAGE_MODEL.lower()
SD = {"steps": 4, "guidance": 0.0} if TURBO else {"steps": 6, "guidance": 1.5}
PHOTO_NEGATIVE = "text, letters, words, watermark, logo, signage, cartoon, illustration, 3d render, cgi, painting, oversaturated, blurry, deformed"


def sd(m, prompt, w, h, gen, image=None, strength=0.6, negative=None):
    """One SDXL picture with the settings of IMAGE_MODEL (text-to-image, or image-to-image from `image`)."""
    neg = None if TURBO else ", ".join(x for x in (negative, PHOTO_NEGATIVE) if x)
    if image is not None:
        steps = max(SD["steps"], math.ceil(SD["steps"] / strength))  # img2img runs strength * steps
        return m["i2i"](prompt=prompt, negative_prompt=neg, image=fit(image, w, h), strength=strength, num_inference_steps=steps, guidance_scale=SD["guidance"], generator=gen).images[0]
    return m["t2i"](prompt=prompt, negative_prompt=neg, width=w, height=h, num_inference_steps=SD["steps"], guidance_scale=SD["guidance"], generator=gen).images[0]


def _dtype(torch):
    cap = torch.cuda.get_device_capability(0)[0]
    # T4/P100 have no native bf16; LTX_DTYPE overrides if fp16 gives black frames.
    return {"bf16": torch.bfloat16, "fp16": torch.float16}.get(os.environ.get("LTX_DTYPE", ""), torch.bfloat16 if cap >= 8 else torch.float16)


def models():
    """IMAGE_MODEL (keyframes, ads, slideshows) + the current video model. Loaded once; video models swap (see video_pipe)."""
    with _model_lock:
        if "t2i" in _models:
            return _models
        _model_state["status"] = "loading"
        import torch
        from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image

        try:
            t2i = AutoPipelineForText2Image.from_pretrained(IMAGE_MODEL, torch_dtype=torch.float16, variant="fp16")
        except Exception:  # noqa: BLE001 - repos without an fp16 variant
            t2i = AutoPipelineForText2Image.from_pretrained(IMAGE_MODEL, torch_dtype=torch.float16)
        if not TURBO:  # Lightning models want DPM++ SDE Karras
            from diffusers import DPMSolverMultistepScheduler
            t2i.scheduler = DPMSolverMultistepScheduler.from_config(t2i.scheduler.config, use_karras_sigmas=True, algorithm_type="sde-dpmsolver++")
        if torch.cuda.device_count() > 1:  # Kaggle "T4 x2": keyframes on the second GPU
            t2i.to("cuda:1")
            i2i = AutoPipelineForImage2Image.from_pipe(t2i)
        else:
            t2i.enable_model_cpu_offload()
            i2i = AutoPipelineForImage2Image.from_pipe(t2i)
            i2i.enable_model_cpu_offload()
        _models.update(torch=torch, t2i=t2i, i2i=i2i)
    video_pipe("ltx")
    _model_state["status"] = "ready"
    return _models


def video_pipe(kind):
    """The image-to-video pipeline for "ltx" or "wan5b". Only one lives in RAM (Kaggle has ~30 GB): switching frees the other."""
    with _model_lock:
        if _models.get("video_kind") == kind:
            return _models["video"]
        import gc
        import torch
        _models.pop("video", None)
        _models.pop("video_kind", None)
        gc.collect()
        torch.cuda.empty_cache()
        _model_state["status"] = f"loading {kind}"
        if kind == "wan5b":
            from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
            vae = AutoencoderKLWan.from_pretrained(WAN5B_MODEL, subfolder="vae", torch_dtype=torch.float32)
            pipe = WanImageToVideoPipeline.from_pretrained(WAN5B_MODEL, vae=vae, torch_dtype=torch.float16)
            # A whole 5B transformer (or the 11 GB text encoder) plus activations does not fit a 15 GB T4, even in fp8.
            # Group offloading keeps weights in RAM and streams layers to the GPU just in time (overlapped with compute).
            from diffusers.hooks import apply_group_offloading
            gpu, cpu = torch.device("cuda:0"), torch.device("cpu")
            pipe.transformer.enable_layerwise_casting(storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.float16)
            pipe.transformer.enable_group_offload(onload_device=gpu, offload_device=cpu, offload_type="leaf_level", use_stream=True)
            apply_group_offloading(pipe.text_encoder, onload_device=gpu, offload_device=cpu, offload_type="block_level", num_blocks_per_group=2)
            pipe.vae.enable_group_offload(onload_device=gpu, offload_device=cpu, offload_type="leaf_level")
            pipe.vae.enable_tiling()
            if getattr(pipe, "image_encoder", None) is not None:
                pipe.image_encoder.to(gpu)
        else:
            from diffusers import LTXImageToVideoPipeline
            pipe = LTXImageToVideoPipeline.from_pretrained(LTX_MODEL, torch_dtype=_dtype(torch))
            pipe.enable_model_cpu_offload(gpu_id=0)
            pipe.vae.enable_tiling()
        _models.update(video=pipe, video_kind=kind)
        _model_state["status"] = "ready"
        return pipe


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
    k = 1.07 if TURBO else 1.6  # RealVisXL is sharpest near 1024 px: draw bigger, then fit down
    gw, gh = (round(w * k / 64) * 64, round(h * k / 64) * 64)
    # SDXL reads ~75 tokens: the shot's own subject/action first, style last.
    prompt = f"{shot.visual}, {STYLES.get(style, STYLES['real'])}"
    with _sd_lock:
        img = sd(m, prompt, gw, gh, gen, image=reference, strength=0.55)
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
    frames = video_pipe("ltx")(image=image, prompt=prompt, negative_prompt=NEGATIVE, width=w, height=h, num_frames=n,
                      num_inference_steps=LTX_STEPS, guidance_scale=3.0, generator=gen).frames[0]
    frames = frames[: len(frames) - max(4, len(frames) // 8)]  # LTX's last frames smear; drop them
    export_to_video(frames, str(out), fps=FPS)
    return frames[-1] if isinstance(frames[-1], Image.Image) else Image.fromarray(frames[-1])


def animate_wan5b(shot, image, seconds, w, h, seed, out, style="real"):
    """Wan 2.2 TI2V-5B image-to-video on the local T4 (24 fps). Slower than LTX, much better motion and detail."""
    from diffusers.utils import export_to_video

    pipe = video_pipe("wan5b")
    torch = models()["torch"]
    gen = torch.Generator("cpu").manual_seed(seed)
    n = round(min(max(seconds, 2.0), WAN5B_MAX_S) * 24 / 4) * 4 + 1  # 4k+1 frames; short clip, then stretched/held to the voice
    torch.cuda.empty_cache()
    motion = shot.motion or ("the person talks to the camera with natural facial expressions and small head movements" if shot.role == "narrator" else "subtle natural motion")
    prompt = f"{shot.visual}. {motion}. {STYLES.get(style, STYLES['real'])}"
    ww, hh = (w // 32) * 32, (h // 32) * 32  # Wan 2.2 VAE needs multiples of 32
    frames = pipe(image=fit(image, ww, hh), prompt=prompt, negative_prompt=NEGATIVE, width=ww, height=hh, num_frames=n,
                  num_inference_steps=WAN5B_STEPS, guidance_scale=5.0, generator=gen).frames[0]
    export_to_video(frames, str(out), fps=24)
    return frames[-1] if isinstance(frames[-1], Image.Image) else Image.fromarray((frames[-1] * 255).clip(0, 255).astype("uint8"))


def last_frame(clip):
    png = clip.with_suffix(".last.png")
    run(["ffmpeg", "-y", "-sseof", "-0.1", "-i", str(clip), "-frames:v", "1", "-update", "1", str(png)])
    return Image.open(png).convert("RGB")


def animate_wan(shot, image, seconds, out, style, token):
    """Image-to-video with Wan 2.2 on a free Hugging Face Space (Gradio HTTP API). Raises if every Space fails."""
    import requests

    headers = {"Authorization": f"Bearer {token}"} if token else {}
    motion = shot.motion or ("the person talks to the camera with natural facial expressions and small head movements" if shot.role == "narrator" else "subtle natural motion")
    prompt = f"{shot.visual}. {motion}. {STYLES.get(style, STYLES['real'])}"[:900]
    buf = io.BytesIO()
    image.save(buf, "PNG")
    errors = []
    for space in WAN_SPACES:
        base = f"https://{space}.hf.space/gradio_api"
        try:
            up = requests.post(f"{base}/upload", headers=headers, files={"files": ("frame.png", buf.getvalue(), "image/png")}, timeout=60)
            up.raise_for_status()
            path = up.json()[0]
            # same leading parameters on both Spaces: image, prompt, steps, negative, seconds, cfg, cfg2, seed, randomize
            data = [{"path": path, "meta": {"_type": "gradio.FileData"}}, prompt, 6, NEGATIVE, round(min(max(seconds, 2.0), 5.0), 1), 1, 1, 42, True]
            if "r3gm" in space:
                data = data[:1] + [None] + data[1:]  # this Space also takes an optional last frame
            ev = requests.post(f"{base}/call/generate_video", headers=headers, json={"data": data}, timeout=60)
            ev.raise_for_status()
            stream = requests.get(f"{base}/call/generate_video/{ev.json()['event_id']}", headers=headers, timeout=900).text
            if "event: error" in stream:
                tail = stream.strip().splitlines()[-1][:300]
                raise RuntimeError(f"Space error: {tail}")
            line = [l for l in stream.splitlines() if l.startswith("data:")][-1]
            url = re.search(r'"url":\s*"([^"]+)"', line).group(1)
            video = requests.get(url, headers=headers, timeout=300)
            video.raise_for_status()
            out.write_bytes(video.content)
            return last_frame(out)
        except Exception as e:  # noqa: BLE001 - try the next Space
            errors.append(f"{space}: {type(e).__name__}: {str(e)[:160]}")
    raise RuntimeError("; ".join(errors))


def finish_shot(clip, audio, srt, dur, w, out, h=None):
    """Stretch the clip to the voice (slow down up to 1.5x, then hold the last frame), burn subtitles."""
    k = min(max(dur / duration(clip), 1.0), 1.25)
    scale = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}," if h else ""  # Wan clips come at the Space's size
    vf = f"{scale}setpts={k:.4f}*PTS,tpad=stop_mode=clone:stop_duration={dur:.2f},fps={FPS},format=yuv420p"
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

    wan = req.engine == "wan" and not MOCK
    # Wan 2.2 5B does not fit a free Kaggle T4 x2 box (GPU then RAM out of memory), so only an explicit "wan5b" uses it.
    local = animate_wan5b if req.engine == "wan5b" and not MOCK else animate
    if not MOCK and _model_state["status"] != "ready":
        job["phase"] = "Đang tải model AI (lần đầu mất vài phút)…"
        models()

    parts, last = [], None
    for i, shot in enumerate(req.shots, 1):
        if job.get("cancel"):  # the web app canceled the job: stop between shots
            raise Canceled()
        job["phase"] = f"Đang dựng cảnh {i}/{len(req.shots)}{' bằng Wan 2.2' if wan else ''}…"
        audio = d / f"s{i}.mp3"
        if req.audio == "music":
            dur = MUSIC_SHOT_S
            run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", f"{dur:.2f}", "-c:a", "libmp3lame", str(audio)])
        else:
            tts(shot.narration, voice, audio)
            dur = duration(audio) + 0.3
        image = keyframe(shot, last, reference, w, h, seed + i, req.style)
        clip = d / f"s{i}_raw.mp4"
        if wan:
            try:
                last = animate_wan(shot, image, dur, clip, req.style, req.hf_token)
            except Exception as e:  # noqa: BLE001 - quota used up or Space down: keep going on the local GPU
                print(f"wan failed on shot {i}: {e}", flush=True)
                job["notice"] = "Hết lượt Wan 2.2 trên Hugging Face hôm nay (hoặc Space bận), các cảnh còn lại dựng bằng LTX."
                wan = False
                job["phase"] = f"Đang dựng cảnh {i}/{len(req.shots)} bằng LTX…"
                last = local(shot, image, dur, w, h, seed + i, clip, req.style)
        else:
            if local is animate_wan5b:
                job["phase"] = f"Đang dựng cảnh {i}/{len(req.shots)} bằng Wan 2.2 5B…"
            last = local(shot, image, dur, w, h, seed + i, clip, req.style)
        write_srt(shot.narration, dur, d / f"s{i}.srt")
        part = d / f"s{i}.mp4"
        finish_shot(clip, audio, d / f"s{i}.srt", dur, w, part, h)
        parts.append(part)
        job["done"] = i

    job["phase"] = "Đang ghép video…"
    (d / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(d / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(d / "final.mp4")])
    job["duration"] = round(duration(d / "final.mp4"), 1)


# ---------------------------------------------------------------- queue + API

jobs = {}
todo = queue.Queue()
# One GPU job at a time: drawing images while a video renders runs out of GPU memory and can leave
# CUDA in a broken state ("illegal memory access") until the notebook is restarted.
_gpu_lock = threading.Lock()


class Canceled(Exception):
    pass


def loop():
    while True:
        job, req = todo.get()
        if job.get("cancel"):
            job.update(status="canceled", phase=None)
            continue
        job["status"] = "running"
        try:
            with _gpu_lock:
                render(job, req)
            job.update(status="done", phase=None)
        except Canceled:
            job.update(status="canceled", phase=None)
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


def draw_images(req):
    """Ad and slideshow images (a few seconds each once loaded). Text is NOT drawn: the app overlays it."""
    w, h = IMAGE_SIZES.get(req.size, IMAGE_SIZES["1:1"])
    reference = decode_image(req.reference_image) if req.reference_image else None
    seed = req.seed if req.seed is not None else int(time.time()) % 100000
    out = []
    for i, p in enumerate(req.prompts):
        # Ads keep room for the text the app lays over them; slideshow photos (sent with a negative) fill the frame.
        prompt = f"{p[:600]}, {STYLES.get(req.style, STYLES['real'])}, " + ("RAW photo, professional photography, realistic textures" if req.negative else "advertising photo, clean composition, empty space for text")
        if MOCK:
            img = Image.linear_gradient("L").resize((w, h)).convert("RGB")
            img = Image.merge("RGB", (img.getchannel(0), Image.new("L", (w, h), (seed + i * 53) % 255), img.getchannel(2)))
        else:
            m = models()
            gen = m["torch"].Generator("cpu").manual_seed(seed + i)
            bw, bh = w // 2, h // 2
            with _sd_lock:
                if not TURBO:  # draws well at full size: one pass
                    img = sd(m, prompt, w // 8 * 8, h // 8 * 8, gen, image=reference, strength=0.6, negative=req.negative)
                else:
                    if reference is not None:
                        img = m["i2i"](prompt=prompt, negative_prompt=AD_NEGATIVE, image=fit(reference, bw, bh), strength=0.6, num_inference_steps=4, guidance_scale=0.0, generator=gen).images[0]
                    else:
                        img = m["t2i"](prompt=prompt, negative_prompt=AD_NEGATIVE, width=bw, height=bh, num_inference_steps=4, guidance_scale=0.0, generator=gen).images[0]
                    # 2x: Lanczos upscale, then refine (strength * steps must be >= 1 for SDXL-Turbo)
                    big = fit(img, bw, bh).resize((w, h), Image.LANCZOS)
                    img = m["i2i"](prompt=prompt, negative_prompt=AD_NEGATIVE, image=big, strength=0.35, num_inference_steps=6, guidance_scale=0.0, generator=gen).images[0]
            img = fit(img, w, h)
        buf = io.BytesIO()
        img.save(buf, "PNG")
        out.append(base64.b64encode(buf.getvalue()).decode())
    return {"images": out, "width": w, "height": h}


images = {}


@app.post("/image")
def image_start(req: ImageRequest, authorization: str = Header(None)):
    """Start drawing; poll GET /image/{id}. Async because the first call may wait minutes for the models (tunnel cuts at 100 s)."""
    check(authorization)
    iid = uuid.uuid4().hex
    images[iid] = {"status": "running", "error": None, "result": None, "created": time.time()}
    for k in [k for k, v in images.items() if time.time() - v["created"] > 3600]:
        images.pop(k, None)

    def go():
        try:
            with _gpu_lock:  # waits for a running video render
                images[iid].update(status="done", result=draw_images(req))
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            images[iid].update(status="failed", error=f"{type(e).__name__}: {e}"[:500])

    threading.Thread(target=go, daemon=True).start()
    return {"id": iid}


@app.get("/image/{iid}")
def image_status(iid: str, authorization: str = Header(None)):
    check(authorization)
    job = images.get(iid)
    if not job:
        raise HTTPException(404, "unknown image job (worker restarted?)")
    out = {"status": job["status"], "error": job["error"]}
    if job["status"] == "done":
        out.update(job["result"])
    return out


@app.get("/render/{rid}")
def status(rid: str, authorization: str = Header(None)):
    check(authorization)
    job = jobs.get(rid)
    if not job:
        raise HTTPException(404, "unknown render (worker restarted?)")
    return {k: job.get(k) for k in ("status", "phase", "done", "total", "error", "duration", "notice")}


@app.delete("/render/{rid}")
def cancel(rid: str, authorization: str = Header(None)):
    """Stop a render the web app canceled (checked between shots)."""
    check(authorization)
    job = jobs.get(rid)
    if job and job["status"] in ("queued", "running"):
        job["cancel"] = True
    return {"ok": True}


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
