# Deploy GoClaw cho Skipli

## 1. Build image GoClaw có patch

Bản upstream chưa có fix browser (Facebook bị đóng tab, extension sync 0 cookie). Xem `docs/HANDOFF.md` mục 6.
Cho tới khi PR được merge, phải build image từ source có patch:

```bash
git clone https://github.com/nextlevelbuilder/goclaw.git && cd goclaw
git checkout 52ced371                     # commit mà patch được tạo trên đó
git apply /path/to/skipli-content-skills/deploy/goclaw-patches/browser-settle-and-cookie-sync.patch
docker build -t skipli/goclaw:patched \
  --build-arg ENABLE_EMBEDUI=true --build-arg ENABLE_PYTHON=true \
  --build-arg VERSION=v3.15.0-beta.225-skipli .
```

Patch sửa cả `extensions/chrome-selected-cookie-sync/`. Load unpacked extension từ bản clone này, không dùng bản upstream.

## 2. Chạy

```bash
cd deploy
cp .env.example .env      # điền GOCLAW_GATEWAY_TOKEN, GOCLAW_ENCRYPTION_KEY (openssl rand -hex 32)
docker compose up -d
open http://localhost:18790
```

Dừng: `docker compose stop`. **Không** dùng `down -v`, vì lệnh này xoá DB, provider và cookie đã sync.
`GOCLAW_ENCRYPTION_KEY` phải giữ cố định. Đổi key thì provider key và cookie đã lưu không giải mã được nữa.

## 3. Firebase (dữ liệu của web)

1. Tạo (hoặc dùng) Firebase project, bật **Firestore** (Native mode).
2. IAM, tạo service account với role **Cloud Datastore User**, tải key JSON.
3. Trong `deploy/.env`: `FIREBASE_PROJECT_ID=<id>`, `FIREBASE_SERVICE_ACCOUNT='<nội dung JSON trên 1 dòng>'`.
   **Bắt buộc dùng nháy đơn**: nháy kép làm hỏng `\n` trong private key. In ra dòng cần dán:
   `node -e 'const k=JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")));console.log("FIREBASE_SERVICE_ACCOUNT=\x27"+k+"\x27")' deploy/firebase-key.json`.
   Nếu dùng chung project với app Skipli thì giữ `FIRESTORE_PREFIX=content_` để không đụng collection khác.
4. Deploy rule chặn truy cập từ client:
   `cd deploy/firebase && npx firebase-tools deploy --only firestore:rules --project <id>`.
   Nếu project đã có rules cho app chính thì **gộp** đoạn `content_*` vào, không ghi đè.

## 4. Cấu hình GoClaw sau lần chạy đầu (một lần)

1. Providers: `openai-codex` (chat) và một provider tên đúng **`gemini`** (cho `read_video`).
2. Bật media tools: `PUT /v1/tools/builtin/{read_video,read_audio,read_image}`, body có trong HANDOFF mục 5.
3. Tạo agent từ `agents/content-scout.json` (xem `agents/README.md`).
4. `scripts/push-skills.sh` → bấm **Install all dependencies** (cài `yt-dlp`).
5. Sync cookie FB bằng extension, với Agent ID là **UUID** của agent.
