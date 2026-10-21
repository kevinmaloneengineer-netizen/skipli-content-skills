# Deploy GoClaw cho Skipli

## 0. Lên server cho nhóm dùng thử (20–60 người)

Máy: VPS Ubuntu 4 vCPU / 8 GB RAM / 80 GB ổ, đã cài Docker. Video GPU vẫn chạy trên worker GPU riêng.

1. Trỏ DNS: bản ghi A của tên miền (vd. `content.example.com`) về IP server. Mở cổng 80 và 443, đóng các cổng còn lại (3000, 18790, 5432, 9222 chỉ nghe trên localhost).
2. Chép code lên server, rồi build image GoClaw có patch: `bash deploy/build-goclaw.sh` (mục 1).
3. Tạo `deploy/.env` từ `.env.example`, điền thêm:
   ```
   DOMAIN=content.example.com
   PUBLIC_URL=https://content.example.com
   TRUST_PROXY=loopback,uniquelocal   # 2 nếu bật proxy (mây cam) của Cloudflare
   GOCLAW_ENCRYPTION_KEY=<openssl rand -hex 32, giữ cố định>
   GOCLAW_GATEWAY_TOKEN=<openssl rand -hex 32>
   POSTGRES_PASSWORD=<mật khẩu riêng>
   ACCOUNTS=1  SIGNUP=1  ADMIN_EMAIL=...  ADMIN_PASSWORD=...
   ```
   Cùng các khoá đang dùng ở máy dev: Firebase, `STORAGE_*`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `SMTP_*`, Stripe, `VIDEO_WORKER_*`.
4. Chạy: `cd deploy && docker compose --profile https up -d --build`. Caddy tự lấy chứng chỉ HTTPS.
5. Cấu hình GoClaw một lần (mục 4). Lúc đó mở GoClaw qua SSH tunnel: `ssh -L 18790:localhost:18790 <server>` rồi vào `http://localhost:18790`.
6. Vào `https://<DOMAIN>`, đăng nhập admin, kiểm tra trang admin: "Tài khoản dùng thử mỗi IP" = 0, bấm "Sao lưu ngay" để thử bucket.

Cập nhật code: `git pull && docker compose --profile https up -d --build web`. Xem log: `docker compose logs -f web`.

Mặc định cho nhóm dùng thử: không giới hạn đăng ký và lượt chạy theo IP (cả văn phòng chung một mạng vẫn dùng được), mỗi tài khoản 30 lượt mỗi ngày, toàn web 500 lượt mỗi ngày (`DAILY_JOB_LIMIT`), 2 lượt quét chạy cùng lúc (`JOB_CONCURRENCY`).

## 1. Build image GoClaw có patch

Bản upstream chưa có fix browser (Facebook bị đóng tab, extension sync 0 cookie). Xem `docs/HANDOFF.md` mục 6.
Cho tới khi PR được merge, phải build image từ source có patch. Cách nhanh: `bash deploy/build-goclaw.sh`. Làm tay:

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

## 3b. Lưu file trên Cloudflare R2 (khi có nhiều người dùng)

Ảnh AI vẽ, video đã dựng, đoạn Reels và file người dùng tải lên mặc định nằm trên ổ đĩa (`DATA_DIR`, mặc định `web/.data`). Khi chạy cho nhiều người, đặt thêm vào `deploy/.env`:

```
STORAGE_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
STORAGE_BUCKET=skipli-media
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_REGION=auto
```

Job vẫn dựng trên ổ đĩa; xong thì file được chép lên bucket, và trang kết quả mở link có chữ ký (hết hạn sau 15 phút) khi server không còn file. Bucket để riêng tư, không bật public access.

Nên đặt quy tắc tự xoá (Object lifecycle) trên bucket: tiền tố `uploads/` xoá sau 7 ngày. Bất kỳ kho tương thích S3 nào cũng dùng được (đổi `STORAGE_ENDPOINT` và `STORAGE_REGION`).

## 3c. Khách tự đăng ký và nạp credit qua Stripe

Bật trong `deploy/.env` (cần `ACCOUNTS=1`):

```
SIGNUP=1
TRIAL_CREDITS=20                          # credit tặng khi đăng ký
CREDIT_PACKS=100:900,300:2400,1000:6900   # credit:giá (cent)
STRIPE_SECRET_KEY=sk_test_...             # Stripe Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_URL=https://content.example.com
```

- Chống tạo nhiều tài khoản lấy credit free: mỗi tài khoản phải xác nhận email bằng mã. Có thể giới hạn thêm số tài khoản mỗi IP bằng `SIGNUP_PER_IP` hoặc ở trang admin (mặc định 0 = không giới hạn, vì cả văn phòng thường chung một IP).
  Nếu web chạy sau nginx, Cloudflare hay load balancer thì **bắt buộc** đặt `TRUST_PROXY` (docker compose đặt sẵn `loopback,uniquelocal` cho Caddy; thêm Cloudflare proxy thì đặt `2`), không thì mọi khách đều mang IP của proxy và các giới hạn còn lại theo IP (khách chưa đăng nhập hỏi trợ lý, sai mật khẩu) dồn chung cho mọi người.
- Xác nhận email bằng mã 6 số (khách đăng ký và đăng nhập bằng email). Đặt `SMTP_USER` (địa chỉ Gmail) và `SMTP_PASS` (App Password 16 ký tự: Tài khoản Google → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng). Tài khoản chỉ được tạo, kèm credit dùng thử, sau khi nhập đúng mã (hết hạn 10 phút, sai tối đa 5 lần, gửi lại mỗi phút một lần, tối đa 5 lần mỗi giờ); chưa nhập mã thì không có gì trong danh sách tài khoản. Quên mật khẩu cũng gửi mã qua email. Để trống thì bỏ qua bước mã; chạy thử local đặt `MAIL_LOG=1` để mã in ra log server. Gmail gửi được khoảng 500 mail/ngày.
- Mỗi lượt chạy trừ credit theo loại (`CREDIT_COST` trong `web/server/billing.mjs`): bài viết 1, quét kênh 2, so sánh 3, cắt/lồng tiếng 4, video 5. Lượt lỗi hoặc bị huỷ được hoàn credit.
- Tài khoản admin, và tài khoản admin tạo tay, không bị tính credit. Admin cộng credit tay ở trang Quản lý tài khoản.
- Webhook: Stripe Dashboard → Developers → Webhooks → thêm endpoint `https://<PUBLIC_URL>/api/stripe/webhook`, sự kiện `checkout.session.completed`, `charge.dispute.created` và `charge.dispute.closed`, rồi chép signing secret vào `STRIPE_WEBHOOK_SECRET`.
- Khách đòi tiền lại qua ngân hàng (chargeback): web tự thu lại credit của lần nạp đó; nếu khách đã dùng hết thì khoá tài khoản cho tới khi tranh chấp kết thúc. Công ty thắng tranh chấp thì credit và tài khoản được trả lại. Mỗi lần như vậy hiện ở mục "Lỗi gần đây" trong trang admin. Cần webhook mới nhận được sự kiện này (chạy local thì không có).
  Chạy local thì không cần webhook: trang `/billing` tự hỏi Stripe sau khi thanh toán xong. Muốn thử webhook local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- Thử bằng key `sk_test_...` và thẻ `4242 4242 4242 4242` (ngày hết hạn bất kỳ trong tương lai, CVC bất kỳ). Khi công ty xác minh xong tài khoản Stripe thì đổi sang key `sk_live_...`.

## 3d. Vận hành: lỗi, sao lưu, tắt server

- **Lỗi:** lỗi máy chủ, tác vụ lỗi và lỗi trên trình duyệt người dùng hiện ở trang Quản lý tài khoản (mục "Lỗi gần đây"). Muốn nhận về Slack hoặc Discord: tạo Incoming Webhook rồi đặt `ERROR_WEBHOOK_URL`.
- **Sao lưu:** khi đã cấu hình bucket (mục 3b), server tự sao lưu toàn bộ Firestore mỗi ngày vào `backups/YYYY-MM-DD.json.gz`, giữ `BACKUP_KEEP_DAYS` ngày (mặc định 14). Trang admin có nút "Sao lưu ngay". Khôi phục (tắt server trước):
  ```bash
  cd web
  node scripts/restore-backup.mjs backups/2026-10-18.json.gz            # xem trong file có gì
  node scripts/restore-backup.mjs backups/2026-10-18.json.gz --confirm  # ghi lại vào Firestore
  ```
- **Tắt / khởi động lại:** server ngừng nhận việc mới và chờ tác vụ đang chạy xong (tối đa `SHUTDOWN_WAIT_SEC`, mặc định 25 giây). Tác vụ chưa xong được chạy lại từ đầu một lần khi server lên lại.
- **Cài đặt đăng ký và credit** (số tài khoản mỗi IP, credit tặng, gói nạp, số tác vụ nặng cùng lúc) sửa trực tiếp ở trang admin, áp dụng ngay; giá trị trong `.env` chỉ là mặc định.
- **Tác vụ nặng cùng lúc:** mỗi tài khoản chỉ chạy tối đa `HEAVY_PER_USER` việc nặng một lúc (video, ảnh AI, chỉnh ảnh, cắt reels, lồng tiếng; mặc định 2) để một quán không chiếm hết GPU.
- **Doanh thu và chi phí:** trang admin cộng tiền nạp Stripe (trừ các lần khách đòi lại mà quán thua), credit đã trừ theo từng công cụ và chi phí ước tính (giá model `COST_TOKEN_USD_PER_M` mỗi 1 triệu token, cộng GPU). Đây là ước tính, số thật xem trên hoá đơn Groq và GPU.
- **Menu điện tử:** link `/m/<id>` mở công khai, không cần đăng nhập. Menu lưu trong Firestore (cùng chỗ với thư viện), nên có trong bản sao lưu hằng ngày.

## 4. Cấu hình GoClaw sau lần chạy đầu (một lần)

1. Providers: `openai-codex` (chat) và một provider tên đúng **`gemini`** (cho `read_video`).
2. Bật media tools: `PUT /v1/tools/builtin/{read_video,read_audio,read_image}`, body có trong HANDOFF mục 5.
3. Tạo agent từ `agents/content-scout.json` (xem `agents/README.md`).
4. `scripts/push-skills.sh` → bấm **Install all dependencies** (cài `yt-dlp`).
5. Sync cookie FB bằng extension, với Agent ID là **UUID** của agent.
