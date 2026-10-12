"""Voice-over for the GPU video worker: one MP3 per shot with the free Microsoft Edge voices (edge-tts).

The worker on Kaggle cannot reach the Edge endpoint any more (Microsoft answers 403 to cloud IPs), so the
web server reads the narration and sends the audio along with the shots.

usage: python3 tts.py <shots.json> <out_dir>
  shots.json: {"voice": "vi-VN-HoaiMyNeural", "texts": ["…", "…"]}  ->  out_dir/s1.mp3, s2.mp3, …
"""
import asyncio
import json
import sys
import time
from pathlib import Path

import edge_tts


async def say(text, voice, path):
    await edge_tts.Communicate(text, voice).save(str(path))


def main():
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for i, text in enumerate(spec["texts"], 1):
        path = out / f"s{i}.mp3"
        # The free endpoint now and then answers a sentence with no audio (NoAudioReceived), even one it
        # reads fine a minute later. Retry with longer waits; from the 2nd try, start with a capital letter.
        for attempt in range(6):
            try:
                said = text if attempt == 0 else text[:1].upper() + text[1:]
                asyncio.run(say(said, spec["voice"], path))
                break
            except Exception:  # noqa: BLE001
                if attempt == 5:
                    raise
                time.sleep(2 * (attempt + 1))
    print(out)


if __name__ == "__main__":
    main()
