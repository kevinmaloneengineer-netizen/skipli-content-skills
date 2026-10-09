#!/usr/bin/env python3
"""Download a Facebook Reel (or other short video) and preprocess it for AI analysis.

Outputs a single JSON object on stdout:
  {"ok": true, "video": ..., "audio": ..., "frames": [...], "caption": ..., ...}
  {"ok": false, "error": "..."}

Usage:
  python3 fetch_reel.py <url> [--out reels] [--frames 6] [--cookies cookies.txt]
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

MAX_BYTES = 100 * 1024 * 1024  # read_video limit is 100MB


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    sys.exit(1)


def safe_id(value):
    return re.sub(r"[^A-Za-z0-9_-]", "_", str(value))[:64] or "reel"


class _SilentLogger:
    """Keep stdout clean so the only output is the final JSON object."""

    def debug(self, msg):
        pass

    def info(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        print(msg, file=sys.stderr)


def probe_duration(video):
    """Fallback when the site does not report a duration."""
    if shutil.which("ffprobe") is None:
        return None
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
        capture_output=True, text=True,
    )
    try:
        return round(float(r.stdout.strip()), 2)
    except ValueError:
        return None


def download(url, out_root, cookies, height=720):
    try:
        import yt_dlp
    except ImportError:
        fail("yt_dlp is not installed. Install the skill dependencies (pip package: yt-dlp).")

    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "logger": _SilentLogger(),
        "noplaylist": True,
        # Prefer a single mp4 file at or below `height` to stay small (long reels at 720p can pass 100MB);
        # fall back to the smallest available.
        "format": f"best[ext=mp4][height<={height}]/best[height<={height}]/worst[ext=mp4]/worst",
        "max_filesize": MAX_BYTES,
        "outtmpl": os.path.join(out_root, "%(id)s", "video.%(ext)s"),
        "retries": 2,
    }
    if cookies:
        if not os.path.isfile(cookies):
            fail(f"cookies file not found: {cookies}")
        opts["cookiefile"] = cookies

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                fail("no video found at this URL")
            if "entries" in info:  # playlist-like result; take the first item
                info = next((e for e in info["entries"] if e), None)
                if info is None:
                    fail("no video found at this URL")
            path = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        if re.search(r"login|log in|private|cookies|not available", msg, re.I):
            msg += " (reel may be private or require login - try --cookies)"
        fail(msg)

    if not os.path.isfile(path):
        fail("download finished but video file is missing (possibly exceeded 100MB limit)")
    return info, path


def extract_audio(video, out_dir):
    audio = os.path.join(out_dir, "audio.mp3")
    r = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio],
        capture_output=True, text=True,
    )
    if r.returncode != 0 or not os.path.isfile(audio) or os.path.getsize(audio) == 0:
        return None  # e.g. video has no audio stream
    return audio


def extract_frames(video, out_dir, count, duration):
    frames = []
    if count <= 0:
        return frames
    duration = duration or 0
    for i in range(count):
        # Evenly spaced timestamps, avoiding the very first/last instant.
        ts = duration * (i + 0.5) / count if duration > 0 else i
        path = os.path.join(out_dir, f"frame_{i + 1:02d}.jpg")
        r = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{ts:.2f}", "-i", video,
             "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", path],
            capture_output=True, text=True,
        )
        if r.returncode == 0 and os.path.isfile(path):
            frames.append(path)
    return frames


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url")
    p.add_argument("--out", default="reels", help="workspace-relative output folder")
    p.add_argument("--frames", type=int, default=6, help="number of frames to extract (0 to skip)")
    p.add_argument("--cookies", help="Netscape cookies.txt for login-required reels")
    p.add_argument("--height", type=int, default=720, help="max video height to download (lower for long reels)")
    args = p.parse_args()

    if not re.match(r"^https?://", args.url):
        fail("URL must start with http:// or https://")

    info, raw_path = download(args.url, args.out, args.cookies, args.height)

    out_dir = os.path.join(args.out, safe_id(info.get("id")))
    os.makedirs(out_dir, exist_ok=True)
    ext = os.path.splitext(raw_path)[1] or ".mp4"
    video = os.path.join(out_dir, "video" + ext)
    if os.path.abspath(raw_path) != os.path.abspath(video):
        shutil.move(raw_path, video)

    has_ffmpeg = shutil.which("ffmpeg") is not None
    duration = info.get("duration") or probe_duration(video)
    audio = extract_audio(video, out_dir) if has_ffmpeg else None
    frames = extract_frames(video, out_dir, min(args.frames, 12), duration) if has_ffmpeg else []

    result = {
        "ok": True,
        "id": info.get("id"),
        "url": info.get("webpage_url") or args.url,
        "title": info.get("title"),
        "caption": info.get("description"),
        "uploader": info.get("uploader") or info.get("channel"),
        "upload_date": info.get("upload_date"),
        "duration": duration,
        "view_count": info.get("view_count"),
        "like_count": info.get("like_count"),
        "video": video,
        "video_bytes": os.path.getsize(video),
        "audio": audio,
        "frames": frames,
    }
    if not has_ffmpeg:
        result["warning"] = "ffmpeg not found: audio/frames were not extracted"
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
