---
name: inbox-scripter
description: Use this skill when the user wants ready replies for customer messages ("kịch bản inbox", "mẫu trả lời tin nhắn", "chốt đơn qua inbox", "trả lời khách hỏi giá") for a shop or restaurant on Messenger, Zalo or TikTok.
---

# Inbox Scripter

Write a set of ready-to-send replies for the questions customers ask in Messenger, Zalo or TikTok inbox, aimed at closing the order or the table booking. Vietnamese, chat style.

## Inputs (from the request)

The business and its products or menu, real policies the owner gave (giá, phí ship, giờ mở cửa, đổi trả, đặt cọc), the channel and the tone. Never invent policies, prices or stock: use placeholders like `[GIÁ]`, `[PHÍ SHIP]`, `[GIỜ MỞ CỬA]`, `[ĐỊA CHỈ]`, `[SỐ TÀI KHOẢN]`.

## Output format (the UI turns each "## Tình huống" into a card with a copy button, follow it exactly)

```
## Tình huống: <customer situation, e.g. Khách hỏi giá>
**Khách nhắn:** "<typical message>"
**Trả lời:**
<reply, 1 to 4 short lines, ready to send>
**Nếu khách im lặng:** <one follow up message to send later>

## Tình huống: <next>
…

---
**Mẹo chốt đơn qua inbox:** 3 to 5 bullets.
```

Prices: write a number only if it appears in the user's policies or business description; otherwise always `[GIÁ]` (never guess a price per person, per pot or per item).

## Which situations

Write 8 to 12 situations, chosen for the business type:
- Shop: hỏi giá, hỏi còn hàng hoặc size, hỏi phí ship và thời gian giao, chê đắt, so sánh chỗ khác, xin giảm giá, hỏi đổi trả, khách để suy nghĩ, chốt đơn (xin tên, số điện thoại, địa chỉ), xác nhận chuyển khoản, khách phàn nàn sau khi nhận hàng.
- Restaurant: hỏi menu và giá, đặt bàn (số người, giờ), hỏi chỗ đậu xe, hỏi giao hàng, hỏi ưu đãi, đặt tiệc nhóm, khách đến trễ hoặc huỷ bàn, khách phàn nàn.

## How to write

- Short lines like real chat, warm and respectful ("dạ", "ạ" when the tone is polite), at most 1 or 2 emoji.
- Every reply ends with a next step: a question that moves toward the order or booking ("Mình lấy size M hay L ạ?").
- Handle objections with value (chất lượng, bảo hành, số lượng phần ăn), never pressure or fake scarcity.
- **Không dùng dấu gạch ngang** để nối ý: dùng dấu phẩy, dấu chấm hoặc dấu hai chấm.
