"""Build skipli_video_worker.ipynb (Kaggle/Colab) from worker.py. Run after editing worker.py."""
import json
from pathlib import Path

here = Path(__file__).parent
worker = (here / "worker.py").read_text()

md = """# Skipli video worker (GPU miễn phí)

1. **Settings** (cột phải): *Accelerator* → **GPU T4 x2**, *Internet* → **On** (Kaggle cần xác minh số điện thoại một lần).
2. **Run All**. Lần đầu mất khoảng 10 phút để cài thư viện và tải model.
3. Ô cuối in ra **URL** và **Token**: dán vào trang *Tạo video AI* trên web, bấm *Kết nối*.
4. Giữ tab này mở trong lúc tạo video. Phiên Kaggle tự tắt sau tối đa 12 giờ; mỗi lần chạy lại, URL và token đổi, cần dán lại."""

install = """%%capture
!pip install -q -U diffusers transformers accelerate sentencepiece ftfy imageio imageio-ffmpeg edge-tts fastapi uvicorn
!apt-get -qq update && apt-get -qq install -y ffmpeg fonts-dejavu-core
# Kaggle's preinstalled torchao is older than what new diffusers expects (ImportError FqnToConfig); we don't use it.
!pip uninstall -y -q torchao"""

run = r'''import os, re, secrets, subprocess, sys, threading, time, json, urllib.request

TOKEN = secrets.token_urlsafe(18)
env = {**os.environ, "WORKER_TOKEN": TOKEN, "PORT": "8000"}
worker = subprocess.Popen([sys.executable, "worker.py"], env=env, stdout=open("worker.log", "w"), stderr=subprocess.STDOUT)

if not os.path.exists("cloudflared"):
    subprocess.run(["wget", "-q", "-O", "cloudflared", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"], check=True)
    os.chmod("cloudflared", 0o755)
tunnel = subprocess.Popen(["./cloudflared", "tunnel", "--no-autoupdate", "--url", "http://localhost:8000"],
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
URL = None
for line in tunnel.stdout:
    m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
    if m:
        URL = m.group(0)
        break
threading.Thread(target=lambda: [None for _ in tunnel.stdout], daemon=True).start()  # keep draining logs

print("=" * 60)
print("URL:  ", URL)
print("Token:", TOKEN)
print("=" * 60)
print("Dán 2 dòng trên vào trang Tạo video AI. Giữ ô này chạy.\n")

last = None
while worker.poll() is None:
    try:
        req = urllib.request.Request("http://localhost:8000/health", headers={"Authorization": f"Bearer {TOKEN}"})
        h = json.load(urllib.request.urlopen(req, timeout=10))
        s = f"model: {h['models']['status']} | GPU: {h['gpu']} | đang dựng: {h['busy']}"
        if h["models"].get("error"):
            s += f" | lỗi: {h['models']['error']}"
    except Exception as e:
        s = f"worker chưa sẵn sàng ({type(e).__name__})"
    if s != last:
        print(time.strftime("%H:%M:%S"), s)
        last = s
    time.sleep(20)
print("Worker đã dừng. Xem worker.log:")
print(open("worker.log").read()[-3000:])'''


def cell(kind, src):
    c = {"cell_type": kind, "metadata": {}, "source": src.splitlines(keepends=True)}
    if kind == "code":
        c.update(execution_count=None, outputs=[])
    return c


nb = {
    "cells": [cell("markdown", md), cell("code", install), cell("code", "%%writefile worker.py\n" + worker), cell("code", run)],
    "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                 "language_info": {"name": "python"}, "accelerator": "GPU"},
    "nbformat": 4,
    "nbformat_minor": 5,
}
(here / "skipli_video_worker.ipynb").write_text(json.dumps(nb, ensure_ascii=False, indent=1))
print("wrote skipli_video_worker.ipynb")
