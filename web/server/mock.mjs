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

const CLONE = `Đã đọc 30 bài của kênh, chọn 6 bài nhiều tương tác nhất làm gốc.

## Bài 1 · Giải trí: Một ngày của chủ shop online
> Gốc: video "một ngày làm việc" hài hước của chủ shop · 👍 3.2K · 💬 412 · 🔁 506
6h sáng: "Hôm nay mình sẽ chốt 50 đơn" 💪
9h: trả lời 37 tin nhắn "còn hàng không shop"
12h: ăn trưa bằng một tay, tay kia gõ "dạ còn ạ"
18h: chốt được 12 đơn, vẫn thấy mình là CEO 😎

Ai bán online thì điểm danh nào! 🙋

#banhangonline #chushop #doisongkinhdoanh

## Bài 2 · Giáo dục: 3 lỗi khiến khách đọc xong vẫn không mua
> Gốc: reel liệt kê lỗi thường gặp, dạng danh sách · 👍 2.1K · 💬 380 · 🔁 290
Bài đăng nhiều like mà không ra đơn? Thường là do 3 lỗi này:

1. Dòng đầu nói về shop, không nói về khách
2. Không có giá hoặc cách đặt hàng rõ ràng
3. Kết bài không có lời mời hành động

Sửa được 1 lỗi thôi là bạn sẽ thấy khác biệt. Lưu lại để kiểm tra bài tiếp theo nhé 📌

#kinhdoanhonline #content

## Bài 3 · Tương tác: Bạn chọn A hay B?
> Gốc: câu hỏi hai lựa chọn kéo bình luận · 👍 1.8K · 💬 1.2K · 🔁 95
Nếu chỉ được chọn một, bạn chọn:

🅰️ Giao nhanh trong 2 giờ, giá cao hơn một chút
🅱️ Giao trong 2 ngày, được freeship

Comment A hoặc B, shop đang lắng nghe để cải thiện dịch vụ đây! 👇

## Bài 4 · Bán hàng: Bộ quà tặng cho người bận rộn
> Gốc: video khoe sản phẩm, nhấn vào lợi ích · 👍 1.5K · 💬 210 · 🔁 180
Không có thời gian chọn quà? Shop gói sẵn rồi đây 🎁

✔️ Đóng hộp đẹp, kèm thiệp viết tay
✔️ Giao tận nơi trong ngày tại [KHU VỰC]
✔️ Giá chỉ [GIÁ]

Inbox "QUÀ" để shop gửi mẫu cho bạn xem trước nhé: [LINK]

#quatang #giaonhanh

## Bài 5 · Giáo dục: Mẹo chụp ảnh sản phẩm bằng điện thoại
> Gốc: reel mẹo nhanh, có trước và sau · 👍 1.2K · 💬 96 · 🔁 240
Ảnh đẹp không cần máy xịn, chỉ cần 3 mẹo:

📸 Chụp gần cửa sổ, tránh đèn vàng
📸 Dùng tờ giấy trắng làm phông
📸 Chụp ngang tầm mắt sản phẩm

Thử ngay rồi khoe ảnh dưới comment nha!

## Bài 6 · Tương tác: Điền vào chỗ trống
> Gốc: bài "điền vào chỗ trống" nhiều bình luận · 👍 980 · 💬 640 · 🔁 30
Mình mua hàng online nhiều nhất là vào lúc ______ 🕐

Comment câu trả lời của bạn, shop sẽ lên khung giờ ưu đãi theo số đông nhé!

---
**Ghi chú:**
- Bài 1 và 3 mượn kiểu hook "một ngày của…" và "A hay B" vì kéo bình luận tốt nhất ở kênh gốc.
- Điền thông tin thật vào [GIÁ], [LINK], [KHU VỰC] trước khi đăng.

_(Dữ liệu mẫu, GOCLAW_MOCK=1)_`;

const FANPAGE = `## Tổng quan
Đã phân tích 40 reel từ 2026-08-04 đến 2026-10-05, trung bình 4,6 reel mỗi tuần. Tương tác trung vị 53, có 11 reel vượt 3 lần mức trung vị.

## Đăng khi nào
| Ngày | Số reel | Tương tác trung vị |
|---|---|---|
| Thứ 3 | 10 | 80 |
| Thứ 5 | 7 | 61 |
| Chủ nhật | 6 | 58 |

Buổi tối (18h đến 23h) có tương tác trung vị cao nhất: 90, gấp hơn 2 lần khung đêm khuya.

## Video dài bao lâu, caption ra sao
- Video 15 đến 30 giây hiệu quả nhất (trung vị 64), trên 60 giây kém hẳn (25).
- Caption vừa (80 đến 250 ký tự) kèm lời kêu gọi bình luận kéo tương tác tốt nhất.

## Chủ đề và kiểu bài ăn khách
- "Comment từ khoá để nhận tài liệu": kéo bình luận gấp nhiều lần bài thường.
- Sai lầm thường gặp khi làm SEO cho cửa hàng.
- So sánh trước và sau khi tối ưu Google Map.

## Top reel
### 1. Comment SEO để nhận checklist
👍 3.2K · 💬 1.7K · 🔁 510 · 230K views · 20s · 2026-09-13 21:02
https://www.facebook.com/reel/979553765175817/
- Vì sao hiệu quả: hứa tặng tài liệu cụ thể, video ngắn, đăng buổi tối.

## Nên học và nên tránh
- Nên: video 15 đến 30 giây, đăng buổi tối, kết bằng lời mời bình luận nhận quà.
- Tránh: video trên 1 phút, đăng sau 23h.

_(Dữ liệu mẫu, GOCLAW_MOCK=1)_`;

const LIVESTREAM = `## 00:00 đến 03:00 · Mở màn
**Mục tiêu:** giữ người xem ở lại, kéo tương tác
**Lời thoại:**
- "Chào cả nhà, tối nay shop có quà cho ai ở lại đến cuối live nha!"
- "Ai vào rồi thả cho shop một trái tim để shop biết nè."

**Hành động:** ghim bình luận giới thiệu ưu đãi, mời chia sẻ live.

## 03:00 đến 15:00 · Áo khoác gió
**Mục tiêu:** cho khách thấy chất vải và form áo
**Lời thoại:**
- "Cả nhà nhìn nè, vải này mưa nhỏ là trượt nước luôn."
- "Giá trong live là [GIÁ], chỉ áp dụng trong buổi tối nay."

**Hành động:** vẩy nước lên áo, mặc thử, giơ sát camera.

## 15:00 đến 20:00 · Mini game
**Mục tiêu:** giữ người xem, tăng bình luận
**Lời thoại:**
- "Bình luận màu áo bạn thích nhất, shop chọn 1 bạn tặng [QUÀ]."

**Hành động:** đọc tên người thắng, nhắc lại ưu đãi cho người mới vào.

## 20:00 đến 30:00 · Chốt đơn và cảm ơn
**Mục tiêu:** chốt đơn cuối buổi
**Lời thoại:**
- "Ưu đãi chỉ còn đến hết live thôi nha cả nhà."
- "Cảm ơn mọi người đã ở lại, hẹn tối mai cùng giờ!"

**Hành động:** ghim link đặt hàng, đọc lại các đơn vừa chốt.

## Câu chốt đơn
- "Giá này chỉ có trong live, tắt live là về giá cũ nha."
- "Ai lấy 2 áo shop tặng thêm [ƯU ĐÃI]."

## Xử lý từ chối
| Khách nói | Trả lời |
|---|---|
| "Đắt quá" | "Áo dùng được 3 mùa, tính ra mỗi ngày chưa tới một ly trà đá đó cả nhà." |
| "Để suy nghĩ thêm" | "Dạ được ạ, nhưng giá live chỉ giữ đến hết buổi tối nay thôi nha." |

## Trả lời nhanh bình luận
| Bình luận | Trả lời |
|---|---|
| Giá bao nhiêu? | "Giá live là [GIÁ], bạn để lại SĐT shop gọi xác nhận nha." |
| Còn size L không? | "Còn ạ, bạn bình luận L + màu để shop giữ hàng." |

_(Dữ liệu mẫu, GOCLAW_MOCK=1)_`;

const VIDEO = JSON.stringify({
  title: "Bí quyết quán ăn đông khách",
  shots: [
    { narration: "Quán ăn ngon mà khách tìm trên Google Map lại không thấy tên bạn?", visual: "a cozy Vietnamese street food stall at night, warm lights, cinematic", motion: "slow push in", continue: false, role: "narrator" },
    { narration: "Việc đầu tiên, hãy điền đủ giờ mở cửa, số điện thoại và menu.", visual: "close up of a smartphone showing a restaurant profile, hands typing", motion: "static close up, fingers tapping", continue: false, role: "scene" },
    { narration: "Tiếp theo, mỗi tuần đăng vài tấm ảnh món mới thật đẹp.", visual: "a steaming bowl of pho on a wooden table, soft daylight", motion: "slow orbit around the bowl", continue: false, role: "scene" },
    { narration: "Và đừng quên mời khách quen để lại một đánh giá thật lòng.", visual: "a smiling customer holding a phone in the restaurant", motion: "pan right", continue: false, role: "scene" },
    { narration: "Làm đều ba việc nhỏ này, quán bạn sẽ dễ được tìm thấy hơn.", visual: "the street food stall busy with customers, warm lights", motion: "slow pull back", continue: false, role: "narrator" },
  ],
}, null, 2);

const REPLIES = { "fb-reels": FB, threads: THREADS, write: WRITE, clone: CLONE, fanpage: FANPAGE, livestream: LIVESTREAM, video: "```json\n" + VIDEO + "\n```" };

export async function mockReply({ kind, prompt, delayMs, signal }) {
  await sleep(delayMs, undefined, { signal });
  if (/mock-fail/i.test(prompt)) throw new Error("Mock failure requested (input contains 'mock-fail')");
  return { content: REPLIES[kind] ?? WRITE, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
}
