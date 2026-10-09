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

const IMAGE = JSON.stringify({
  images: [
    { prompt: "a glass of iced salted coffee with cream foam on a wooden cafe table, morning sunlight, shallow depth of field, warm tones, empty space at the bottom", headline: "Cà phê muối, mặn mà khó quên", sub: "Lớp kem muối béo nhẹ trên nền cà phê đậm", cta: "Đặt ngay", caption: "Sáng nay bạn đã có ly cà phê nào chưa? ☕\nCà phê muối của quán: đậm vị, béo nhẹ, uống một lần là nhớ.\nGiá [GIÁ], giao tận nơi trong khu vực [KHU VỰC].\n#caphemuoi #caphesang", layout: "bottom" },
    { prompt: "two friends laughing and holding iced coffee cups in a cozy cafe corner with plants, soft natural light, lifestyle photo, empty space at the top", headline: "Hẹn nhau một ly chiều nay?", sub: "Góc quán yên tĩnh, wifi mạnh, ngồi cả buổi", cta: "Xem menu", caption: "Chiều nay rảnh không? Rủ bạn thân ra quán một ly nha 🌿\nGóc yên tĩnh, nhạc nhẹ, ngồi bao lâu cũng được.\n#cafe #henho", layout: "top" },
  ],
}, null, 2);

const PLAN = `Kế hoạch 7 ngày cho Quán cà phê: tuần này tập trung giới thiệu món mới và kéo khách quen quay lại.

## Ngày 1 · 19:30 · Giáo dục: 3 cách phân biệt cà phê nguyên chất
Bạn có biết cà phê pha sẵn và cà phê rang xay khác nhau thế nào không?
1. Mùi thơm tự nhiên, không gắt
2. Màu nâu sánh, không đen kịt
3. Vị đắng hậu ngọt, không chát
Lưu lại để lần sau chọn cà phê cho chuẩn nhé!
#caphe #kienthuc

## Ngày 2 · 11:30 · Bán hàng: Cà phê muối đã có mặt
Món mới của quán đây: cà phê muối, mặn mà béo nhẹ ☕
Giá [GIÁ], ghé quán hoặc đặt giao tận nơi: [LINK]
#caphemuoi

## Ngày 3 · 20:00 · Tương tác: Bạn là team nào?
Đen đá hay bạc xỉu? Comment team của bạn nha 👇

## Ngày 4 · 12:00 · Giải trí: Một ngày của barista
6h mở quán, 7h khách đầu tiên, 9h đã pha 50 ly. Barista cũng cần cà phê đấy 😅
#barista

## Ngày 5 · 19:00 · Bán hàng: Ưu đãi cuối tuần
Cuối tuần này mua 2 ly tặng [ƯU ĐÃI]. Rủ bạn ghé quán nhé!

## Ngày 6 · 09:30 · Tương tác: Góc quán bạn thích nhất
Bạn hay ngồi góc nào ở quán? Chụp ảnh khoe dưới comment nha 📸

## Ngày 7 · 20:30 · Giải trí: Playlist chill cuối tuần
Tối chủ nhật, một ly cà phê và playlist nhẹ nhàng. Bạn đang nghe bài gì?

---
**Ghi chú:**
- Bài bán hàng đặt trưa và tối, khi khách hay lướt điện thoại.
- Điền giá, link và ưu đãi thật trước khi đăng.

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

const REVIEW = `**Khách đang nói gì:** khen nước lẩu đậm đà nhưng phải chờ món khá lâu, hơi thất vọng.

## Phương án 1 · Chân thành
Dạ quán cảm ơn anh đã ghé và khen nước lẩu ạ. Quán thành thật xin lỗi vì hôm đó anh phải chờ món lâu, quán đã nhắc bếp chuẩn bị sẵn phần ăn vào giờ cao điểm. Mong lần tới được phục vụ anh nhanh và chu đáo hơn ạ.

## Phương án 2 · Chuyên nghiệp
Cảm ơn anh đã dành thời gian đánh giá. Quán ghi nhận góp ý về thời gian lên món và đang điều chỉnh quy trình giờ cao điểm. Anh có thể inbox [SỐ ĐIỆN THOẠI] để quán gửi lời xin lỗi riêng ạ.

## Phương án 3 · Gần gũi
Hihi cảm ơn anh mê nước lẩu nhà mình nha! Vụ chờ lâu là lỗi của quán, tụi mình xin lỗi anh nhiều. Lần sau anh ghé báo tên, quán ưu tiên lên món cho anh liền ạ.

---
**Việc nên làm thêm:**
- Chuẩn bị sẵn khay rau, thịt vào giờ cao điểm.
- Nhắn riêng cho khách để xin lỗi.`;
const MENU = `## Món: Lẩu bò nhúng giấm
**Menu in:** Lẩu bò nhúng giấm chua thanh, thịt bò mềm cuốn rau rừng
**Mô tả app giao đồ ăn:** Nồi giấm chua thanh nấu với sả và hành, ăn kèm thịt bò thái mỏng, bánh tráng và rau rừng. Phần vừa cho 2 người.
**Caption mạng xã hội:** Trời se lạnh là phải có nồi bò nhúng giấm 🍲\nCuốn một miếng là ghiền, inbox đặt bàn nha!
**Gợi ý ăn kèm:** Gỏi bò bóp thấu

## Món: Gỏi bò bóp thấu
**Menu in:** Gỏi bò bóp thấu chua ngọt, giòn mát
**Mô tả app giao đồ ăn:** Bò tái chanh trộn khế, chuối chát và đậu phộng rang, chua ngọt giòn mát. Hợp ăn khai vị.
**Caption mạng xã hội:** Khai vị kiểu miền Tây, giòn sần sật 😋
**Gợi ý ăn kèm:** Lẩu bò nhúng giấm`;
const INBOX = `## Tình huống: Khách hỏi giá
**Khách nhắn:** "Shop ơi áo này bao nhiêu?"
**Trả lời:**
Dạ áo này giá [GIÁ] ạ, chất cotton mát, có 4 màu.
Mình mặc size nào để shop check còn hàng ạ?
**Nếu khách im lặng:** Dạ mẫu này đang được hỏi nhiều, mình cần shop giữ size giúp không ạ?

## Tình huống: Khách chê đắt
**Khách nhắn:** "Sao đắt vậy shop"
**Trả lời:**
Dạ shop hiểu ạ. Áo dùng vải [CHẤT LIỆU], giặt nhiều không xù, đổi size miễn phí trong 7 ngày.
Mình thử 1 cái trước nha?
**Nếu khách im lặng:** Dạ shop gửi thêm ảnh khách mặc thật để mình tham khảo ạ.`;
const HASHTAG = `## Bộ 1 · Tiếp cận rộng
#amthuc #reviewanngon #ancungtiktok #foodtiktok #anngon

## Bộ 2 · Khách quanh khu vực
#anngonquan3 #saigonfood #quan3saigon #anvatsaigon

## Bộ 3 · Ngách
#laubo #laubonhunggiam #laubongon

## Giờ đăng gợi ý
| Nền tảng | Ngày | Khung giờ | Vì sao |
|---|---|---|---|
| Facebook | Thứ 2 đến thứ 6 | 10:30 đến 11:30 | Khách tính chuyện ăn trưa |
| TikTok | Cuối tuần | 18:00 đến 20:00 | Lướt nhiều nhất trước bữa tối |`;
const MAPS = `## Tổng quan
Lẩu Bò Quán Gỗ được 3,8 sao trên 1.547 lượt đánh giá. Đã đọc 80 bài gần đây: 41 bài 5 sao, 14 bài từ 1 đến 2 sao.

## Phân bố số sao
| Số sao | Số bài |
|---|---|
| 5 sao | 41 |
| 4 sao | 15 |
| 3 sao | 10 |
| 2 sao | 8 |
| 1 sao | 6 |

## Khách khen gì
| Điểm khen | Số bài nhắc |
|---|---|
| Nước lẩu đậm đà | 24 |
| Thịt bò mềm | 18 |
| Phần ăn nhiều | 11 |

## Khách chê gì
| Điểm chê | Số bài nhắc |
|---|---|
| Vệ sinh | 9 |
| Thái độ phục vụ | 7 |

## Nên học và nên tránh
- Nên: giữ nước lẩu đậm đà
- Tránh: để khách ngồi gần khu rửa chén`;
const TIKTOK = `## Tổng quan
Đã đọc 8 video cho "lẩu bò". Video có tình huống hài và giá rõ ràng ăn đứt video quay món thuần.

## Top video
### 1. Cô giáo mời ăn lẩu
👁 1.6M · ❤️ 179K · 💬 881 · 🔁 9.5K · 15s · 2026-09-01
https://www.tiktok.com/@tn.170604/video/7680434571602709768
- **Hook:** câu mời "qua ăn lẩu nha" kèm biểu cảm
- **Vì sao viral:** tình huống quen thuộc, video ngắn 15 giây

## Ý tưởng quay cho bạn
1. **Một ngày làm chủ quán lẩu**: quay nhanh từ sáng nấu nước dùng đến tối đông khách.`;
const COMPARE = `## Tổng quan\nKênh A đăng đều nhất, kênh B có tương tác trung vị cao gấp đôi.\n\n## Mỗi kênh mạnh ở đâu\n### @a\n- Đăng 3 reel mỗi tuần.\n- Điểm yếu: video dài, giữ chân kém.\n\n## Bài học cho bạn\n- Học kênh B: mở đầu bằng món ăn cận cảnh.`;
const REPLIES = { campaign: PLAN, compare: COMPARE, review: REVIEW, menu: MENU, inbox: INBOX, hashtag: HASHTAG, maps: MAPS, tiktok: TIKTOK, "fb-reels": FB, threads: THREADS, write: WRITE, clone: CLONE, fanpage: FANPAGE, livestream: LIVESTREAM, image: "```json\n" + IMAGE + "\n```", plan: PLAN, video: "```json\n" + VIDEO + "\n```" };

function mockChat(q) {
  const url = q.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s]+/i)?.[0];
  if (/quét|phân tích/i.test(q) && url) return `Được, mình chuẩn bị quét **100 reel mới nhất** của kênh này, chọn ra 5 reel đáng học nhất.\n\n\`\`\`action\n{"type":"fb-reels","input":{"url":"${url}","top":5,"depth":100}}\n\`\`\``;
  if (/viết|bài/i.test(q)) return 'Mình viết giúp **3 phương án bài Facebook**. Bấm Chạy là có sau khoảng 1 phút.\n\n```action\n{"type":"write","input":{"platform":"facebook","topic":"Lẩu bò nhúng giấm, combo 2 người","variants":3}}\n```';
  return "Chào bạn! Mình là **Trợ lý Skipli**. Mình có thể:\n- Giải thích từng công cụ và cách dùng\n- Tư vấn content cho nhà hàng\n- Chạy công cụ giúp bạn, ví dụ: *\"quét kênh facebook.com/tenkenh\"* hoặc *\"viết 3 bài cho quán lẩu\"*\n\n_(Dữ liệu mẫu, GOCLAW_MOCK=1)_";
}

export async function mockReply({ kind, prompt, delayMs, signal }) {
  await sleep(delayMs, undefined, { signal });
  if (kind === "chat") return { content: mockChat(prompt), usage: null };
  if (/mock-fail/i.test(prompt)) throw new Error("Mock failure requested (input contains 'mock-fail')");
  return { content: REPLIES[kind] ?? WRITE, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
}
