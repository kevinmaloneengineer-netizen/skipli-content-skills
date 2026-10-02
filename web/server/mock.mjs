import { setTimeout as sleep } from "node:timers/promises";

// Canned agent answers for GOCLAW_MOCK=1, shaped like the real skills' reports
// so the UI (tables, variant cards, links) can be developed without GoClaw.

const FB = `Đã quét **toàn bộ kênh** (81 reel), xem 10 video ứng viên.

| # | Reel | 👍 | 💬 | 🔁 | Engagement |
|---|---|---|---|---|---|
| 1 | Lỗi SEO khiến web không lên top | 3.2K | 412 | 506 | 5,542 |
| 2 | 3 công cụ AI viết content | 2.1K | 380 | 290 | 3,730 |
| 3 | Audit website trong 60 giây | 1.8K | 120 | 95 | 2,325 |

### 1. Lỗi SEO khiến web không lên top
👍 3.2K · 💬 412 · 🔁 506 · 11K views · 48s · 2026-09-12
https://www.facebook.com/reel/1234567890/
- Vì sao chọn: đúng chủ đề, hook mạnh ở 3 giây đầu ("Web bạn đẹp nhưng Google không thấy").
- Nội dung chính:
  - Thiếu thẻ title/description chuẩn
  - Trang tải chậm trên mobile
  - Không có internal link

### 2. 3 công cụ AI viết content
👍 2.1K · 💬 380 · 🔁 290 · 8.4K views · 55s · 2026-09-03
https://www.facebook.com/reel/2234567890/
- Vì sao chọn: dạng list, dễ lưu lại, CTA "comment AI để nhận link".
- Nội dung chính:
  - So sánh nhanh 3 công cụ
  - Demo prompt mẫu

Đã quét 81 reel (toàn kênh), xem 10 video. Nguồn phân tích: video ✅ · audio ❌ · frames ❌ · caption ✅

_(Dữ liệu mẫu, GOCLAW_MOCK=1)_`;

const THREADS = `Đã quét 3 nguồn, 58 bài, giữ lại 3 bài.

### 1. @paaaa161
❤️ 19.8K · 💬 303 · 🔁 2.4K · 2026-09-22
https://www.threads.com/@paaaa161/post/Dd0000000a1
> Tao là người hoa, từ nhỏ tao được dạy kinh doanh theo kiểu…
- Vì sao viral: kể chuyện cá nhân + bài học cụ thể, giọng thẳng thắn gây tranh luận.

### 2. @mikexunk
❤️ 1.2K · 💬 494 · 🔁 146 · 2026-09-09
https://www.threads.com/@mikexunk/post/Dd0000000a2
> Ơi các bác nào muốn nhập hàng Trung để kinh doanh…
- Vì sao viral: câu hỏi mở kéo comment, giá trị thực tế (nguồn hàng).

## Pattern chung
- Mở đầu bằng trải nghiệm thật, ngôi thứ nhất
- Dưới 300 ký tự, một ý duy nhất
- Kết bằng câu hỏi để kéo reply

## Ý tưởng cho bạn
- "3 sai lầm mình mắc khi mới bán online": kể chuyện kèm bài học
- Hỏi cộng đồng: "Bạn chọn ship COD hay chuyển khoản trước?"

_(Dữ liệu mẫu, GOCLAW_MOCK=1)_`;

const WRITE = `## Phương án 1: Nỗi đau khách hàng
Bạn chạy quảng cáo mỗi tháng nhưng đơn vẫn lèo tèo? 😩

Vấn đề thường không nằm ở ngân sách, mà ở nội dung chưa đủ "chạm".

👉 Inbox ngay để nhận bộ checklist content miễn phí: [LINK]

#kinhdoanhonline #content #marketing

## Phương án 2: Kể chuyện
Tháng trước, một shop mỹ phẩm nhỏ ở Đà Nẵng nhờ mình xem lại fanpage…

[Kể ngắn: vấn đề → thay đổi → kết quả THẬT của bạn]

Bạn muốn mình xem giúp fanpage của bạn không? Comment "XEM" nhé!

## Phương án 3: Danh sách mẹo
5 cách viết dòng đầu tiên khiến khách dừng lướt:
1. Hỏi đúng nỗi đau
2. Đưa con số cụ thể
3. Nói điều ngược số đông
4. Kể khoảnh khắc đời thường
5. Hứa hẹn một kết quả rõ ràng

Lưu lại để dùng dần nha! 📌

---
**Ghi chú:**
- PA1 theo cấu trúc PAS, PA2 storytelling, PA3 listicle.
- Điền thông tin thật vào [LINK] và phần kể chuyện ở PA2.

_(Dữ liệu mẫu, GOCLAW_MOCK=1)_`;

const REPLIES = { "fb-reels": FB, threads: THREADS, write: WRITE };

export async function mockReply({ kind, prompt, delayMs, signal }) {
  await sleep(delayMs, undefined, { signal });
  if (/mock-fail/i.test(prompt)) throw new Error("Mock failure requested (input contains 'mock-fail')");
  return { content: REPLIES[kind] ?? WRITE, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
}
