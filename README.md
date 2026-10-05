# Skipli Content Agent

Bộ tính năng content kiểu KingContent cho Skipli, chạy trên [GoClaw](https://github.com/nextlevelbuilder/goclaw).
Bối cảnh và các quyết định kỹ thuật nằm trong [docs/HANDOFF.md](docs/HANDOFF.md).

| Tính năng | Skill | Agent |
|---|---|---|
| Quét Reels đối thủ: xếp hạng theo tương tác, AI xem video | [`fb-reel-reader`](skills/fb-reel-reader/SKILL.md) | `content-scout` |
| Tìm content viral Threads: theo từ khoá hoặc tài khoản | [`threads-viral-finder`](skills/threads-viral-finder/SKILL.md) | `content-scout` |
| Viết content AI: theo mẫu, lấy cảm hứng từ kết quả quét | [`content-writer`](skills/content-writer/SKILL.md) | `content-writer` |
| Nhân bản kênh đối thủ: viết hàng loạt bài mới chia theo nhóm | [`channel-cloner`](skills/channel-cloner/SKILL.md) | `content-scout` / `content-writer` |
| Phân tích fanpage: tần suất, ngày giờ, độ dài video, chủ đề | [`fanpage-analyzer`](skills/fanpage-analyzer/SKILL.md) | `content-scout` |
| Kịch bản livestream bán hàng theo từng mốc phút | [`livestream-scripter`](skills/livestream-scripter/SKILL.md) | `content-writer` |
| Tạo video AI (kịch bản + GPU worker Kaggle) | [`video-scripter`](skills/video-scripter/SKILL.md), [`video-worker/`](video-worker/worker.py) | `content-writer` |
| Thư viện mẫu content | lưu trong Firestore qua web | không |

```
React UI ──/api──▶ Node (Express) ──HTTP──▶ GoClaw /v1/chat/completions ──▶ agent ──▶ skill scripts
                     │ hàng đợi job          model = goclaw:<agent_key>
                     └──▶ Firestore (firebase-admin): jobs, thư viện
scripts/push-skills.sh ──▶ /v1/skills/upload (có version)
```

## Cấu trúc

```
skills/          skill GoClaw (SKILL.md ở gốc mỗi thư mục)
agents/          cấu hình agent (body cho POST /v1/agents)
web/             server/ = Node + Express API, client/ = React (Vite), test/
deploy/          docker-compose (GoClaw + Postgres + Chrome + web), patch GoClaw, firebase/ (rules, emulator)
scripts/         push-skills.sh, pack.sh (đóng gói sang project mới), rebrand.mjs (đổi tên, logo, màu)
video-worker/    GPU worker tạo video (chạy trên Kaggle)
examples/        gọi agent trực tiếp từ backend
tests/           test cho script Python của skill
docs/            HANDOFF.md
```

## Chạy thử UI không cần GoClaw

```bash
cd web
npm install
npm run dev            # API :3001 (GOCLAW_MOCK=1, STORE=memory) + Vite :3000
open http://127.0.0.1:3000
```

Khi chưa cấu hình gì, `npm run dev` chạy ở chế độ demo: GoClaw trả dữ liệu mẫu, dữ liệu lưu trong RAM.
Có `FIREBASE_PROJECT_ID` (hoặc `FIRESTORE_EMULATOR_HOST`) thì dùng Firestore. Có `GOCLAW_GATEWAY_TOKEN` thì gọi GoClaw thật.

## Chạy thật

1. Build image GoClaw có patch, rồi `docker compose up -d` trong `deploy/`. Chi tiết ở [deploy/README.md](deploy/README.md).
2. Tạo agent và upload skill theo [agents/README.md](agents/README.md).
3. Tạo Firebase project và service account (xem [deploy/README.md](deploy/README.md)), điền `FIREBASE_*` vào `deploy/.env`.
4. UI chạy ở `http://127.0.0.1:3000` (service `web` trong compose). Nếu chạy ngoài Docker: `cd web && npm run build && npm start`, file `deploy/.env` được đọc tự động.

Muốn mở UI ra ngoài máy (`WEB_BIND=0.0.0.0`) thì phải đặt `APP_PASSWORD`, vì mỗi lần chạy đều tốn quota model.

## Test

```bash
cd web && npm test                       # API, hàng đợi, prompt, store (adapter memory)
cd web && npm run test:firestore         # cùng bộ test trên Firestore emulator (cần Java 11+)
python3 -m unittest discover tests       # parser Threads
DRY_RUN=1 scripts/push-skills.sh         # build zip skill vào dist/
```

## Quét Facebook: người dùng chỉ cần dán link (miễn phí, không đăng nhập)

Khách dán link kênh và chọn **100 reel mới nhất**. Không dùng tài khoản Facebook nào, không tốn phí dịch vụ:

1. `list_reels.py <link> --count 100 --stats` mở tab Reels công khai, lấy ~10 reel có sẵn trong trang, rồi **phân trang không cần đăng nhập** bằng chính truy vấn GraphQL mà tab Reels dùng (`ProfileCometAppCollectionReelsRendererPaginationQuery`, ~10 reel mỗi request, nghỉ 0,6 giây giữa các request).
2. Lấy lượt cảm xúc, bình luận, chia sẻ của từng reel từ trang `/reel/<id>`, tách đúng khối số liệu của reel đó (mỗi trang nhúng ~6 video).
3. Xếp hạng theo `cảm xúc + 2×bình luận + 3×chia sẻ`, rồi AI xem top ~10 video.

Đo thực tế (02/10/2026): natgeo 100 reel mất 50 giây, cả 100 reel đều có số liệu riêng; một trang cá nhân 82 reel (toàn kênh) mất 19 giây, chưa tính số liệu. Không tốn token AI cho phần này.

**Rủi ro cần biết:**
- Đây là API nội bộ, không chính thức. Facebook đổi `doc_id` khi deploy thì script tự đọc lại `doc_id` từ file JS của trang và thử lại một lần. Vẫn hỏng thì trả về những gì có được (ít nhất ~10 reel) kèm ghi chú, không báo lỗi.
- Quét nhiều kênh từ cùng một IP có thể bị Facebook giới hạn tốc độ. Khi có nhiều khách thì cần giới hạn số lần quét đồng thời (`JOB_CONCURRENCY`) và cân nhắc proxy.
- Vẫn là thu thập dữ liệu công khai không qua API chính thức, giống các script hiện có. Nên được bộ phận pháp lý xem lại trước khi bán.

**Dự phòng tuỳ chọn:** đặt `APIFY_TOKEN` thì backend lấy danh sách reel qua Apify (`web/server/sources/facebook.mjs`, cache theo kênh) trước khi giao cho agent. Lỗi thì quay về cách miễn phí. Khoảng $3.16 / 1.000 reel theo trang Apify (10/2026).

## Web UI: ghi chú kỹ thuật

- Mỗi lần chạy là một **job** trong hàng đợi FIFO, mặc định chạy 1 job một lúc (`JOB_CONCURRENCY`), vì các job dùng chung một Chrome, một phiên Facebook và quota free tier.
- GoClaw chỉ trả kết quả khi agent chạy xong, nên server giữ request (tối đa `JOB_TIMEOUT_MIN`, mặc định 20 phút) và UI hỏi trạng thái định kỳ.
  Server gọi bằng `node:http` thay vì `fetch`, vì `fetch` tự ngắt sau 300 giây chờ header.
- Huỷ job là đóng kết nối, GoClaw sẽ huỷ luôn lượt chạy của agent. Khởi động lại server thì job đang chạy được đánh dấu lỗi, job đang chờ chạy tiếp.
- Dữ liệu nằm trong Firestore, gồm các collection `content_jobs`, `content_library` và `content_meta` (prefix đổi được qua `FIRESTORE_PREFIX`). Chỉ backend đọc/ghi qua firebase-admin; [firestore.rules](deploy/firebase/firestore.rules) chặn mọi truy cập từ trình duyệt.
- Server giữ một cache ghi-xuyên (write-through) trong RAM: UI hỏi trạng thái mỗi 2,5 giây nhưng các lượt đọc này không chạm Firestore. Firestore chỉ bị ghi khi trạng thái job đổi. Vì vậy chỉ được chạy **1 instance** backend; hàng đợi job cũng nằm trong process.
- Chỉ dùng query một field (`orderBy createdAt`, `where status in`), nên không cần tạo composite index.

| Biến môi trường | Mặc định | |
|---|---|---|
| `GOCLAW_URL` / `GOCLAW_GATEWAY_TOKEN` / `GOCLAW_USER_ID` | `http://localhost:18790` / - / `system` | User ID phải trùng user đã sync cookie Facebook |
| `AGENT_SCOUT` / `AGENT_WRITER` | `content-scout` / `content-writer` | |
| `GOCLAW_MOCK` | - | `1` = dữ liệu mẫu, không gọi GoClaw |
| `FIREBASE_PROJECT_ID` | - | Bật Firestore. `STORE=memory` = demo, mất dữ liệu khi tắt |
| `FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS` | - | JSON service account (1 dòng) / đường dẫn file key |
| `FIRESTORE_DATABASE_ID` / `FIRESTORE_PREFIX` | `(default)` / `content_` | |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Khi `npm run dev`: API ở `API_PORT` (3001), Vite ở 3000 |
| `APIFY_TOKEN` | - | Tuỳ chọn: lấy danh sách reel qua Apify thay cho cách phân trang miễn phí (xem dưới) |
| `APIFY_FB_REELS_ACTOR` / `REEL_LIST_CACHE_HOURS` | `apify~facebook-reels-scraper` / `6` | Actor Apify dùng; số giờ dùng lại danh sách reel của một kênh |
| `APP_PASSWORD` | - | Bật HTTP Basic auth (user tuỳ ý) |
| `JOB_CONCURRENCY` / `JOB_TIMEOUT_MIN` | `1` / `20` | |
