"""Voice-over for the GPU video worker: one MP3 per shot with the free Microsoft Edge voices (edge-tts).

The worker on Kaggle cannot reach the Edge endpoint any more (Microsoft answers 403 to cloud IPs), so the
web server reads the narration and sends the audio along with the shots.

usage: python3 tts.py <shots.json> <out_dir>
  shots.json: {"voice": "vi-VN-HoaiMyNeural", "texts": ["…", "…"]}  ->  out_dir/s1.mp3, s2.mp3, …
"""
import asyncio
import concurrent.futures
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import edge_tts


async def say(text, voice, path):
    await edge_tts.Communicate(text, voice).save(str(path))


def silence(path, seconds):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{seconds:.1f}", "-q:a", "9", str(path)], check=True)


def read_one(i, text, voice, out, total):
    """True when the shot was read; False when it got silence instead (its subtitles still show the words)."""
    path = out / f"s{i}.mp3"
    # Nothing to read (only "…", an emoji): Edge never answers it, so the shot gets a second of silence.
    if not re.search(r"\w", text):
        silence(path, 1)
        return True
    # The free endpoint now and then answers a sentence with no audio (NoAudioReceived), even one it
    # reads fine a minute later. Retry with longer waits; from the 2nd try, start with a capital letter.
    for attempt in range(6):
        try:
            said = text if attempt == 0 else text[:1].upper() + text[1:]
            asyncio.run(say(said, voice, path))
            return True
        except Exception as e:  # noqa: BLE001
            if attempt == 5:
                # One sentence Edge keeps refusing must not throw away the whole video: the shot stays
                # silent for about as long as the sentence takes to say, and the caller is told.
                print(f"shot {i} of {total} could not be read ({type(e).__name__}): {text[:80]!r}", file=sys.stderr)
                silence(path, max(1.5, len(text.split()) / 2.6))
                return False
            time.sleep(2 * (attempt + 1))


def main():
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    texts = spec["texts"]
    # Two shots at a time: one after another runs past the server's wait when Edge is slow (15-30 s a
    # sentence with retries), and more at once makes Edge refuse more often.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs = [pool.submit(read_one, i, text, spec["voice"], out, len(texts)) for i, text in enumerate(texts, 1)]
        read = [j.result() for j in jobs]
    # Last line: the shots left silent (1-based), for the result page.
    print(json.dumps({"silent": [i for i, ok in enumerate(read, 1) if not ok]}))


if __name__ == "__main__":
    main()
