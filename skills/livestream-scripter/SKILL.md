---
name: livestream-scripter
description: Use this skill when the user asks for a livestream selling script ("kịch bản livestream", "kịch bản live bán hàng") - a minute-by-minute run sheet for a Facebook or TikTok live with product segments, closing lines, objection handling and quick replies to common comments.
---

# Livestream Scripter

Write a practical run sheet a seller can follow live, in Vietnamese, spoken style (what to actually say, not essay prose).

## Inputs (from the request)

Products (name, price if given, key points), live length (30, 60 or 90 minutes), platform (Facebook or TikTok), real offers if any, audience, host style. Never invent prices, discounts, stock numbers, gifts or testimonials: use `[GIÁ]`, `[ƯU ĐÃI]`, `[SỐ LƯỢNG]` placeholders.

## Output format (the UI parses the timeline, follow it exactly)

```
## 00:00 đến 03:00 · Mở màn
**Mục tiêu:** giữ người xem ở lại, kéo tương tác
**Lời thoại:**
- "…"
- "…"

**Hành động:** ghim bình luận, mời thả tim, nhắc chia sẻ live…

## 03:00 đến 12:00 · <Tên sản phẩm 1>
**Mục tiêu:** …
**Lời thoại:**
- "…"

**Hành động:** …

(… one block per segment until the end time …)

## Câu chốt đơn
- "…" (5 to 8 lines, varied: khan hiếm, lợi ích, cảm xúc, thời hạn)

## Xử lý từ chối
| Khách nói | Trả lời |
|---|---|
| "Đắt quá" | "…" |
(5 to 7 rows: đắt, để suy nghĩ, có hàng thật không, ship lâu, so với chỗ khác…)

## Trả lời nhanh bình luận
| Bình luận | Trả lời |
|---|---|
(6 to 10 rows: giá bao nhiêu, còn size không, ship không, đổi trả, inbox…)
```

- Leave a blank line before **Hành động:** (otherwise it sticks to the last spoken line).
- Segment headings are exactly `## MM:SS đến MM:SS · Tên phần` (use `H:MM:SS` past 60 minutes, e.g. `1:05:00`). Segments are contiguous from `00:00` to the requested end.
- Structure: mở màn (2 to 5 min) → one segment per product (demo, lợi ích, chứng minh, chốt) → mini game or Q&A breaks every 15 to 20 minutes to keep viewers → final call and thank you.
- 3 to 6 spoken lines per segment, short and natural, addressing viewers ("cả nhà", "các bạn"). Include when to repeat the offer for newcomers.

## Rules

- No fake scarcity ("chỉ còn 2 cái" unless given), no fake reviews, no health or financial guarantees, nothing against platform policies.
- **Hạn chế dấu gạch ngang:** dùng dấu phẩy, dấu chấm hoặc dấu hai chấm thay cho "—", "–", " - " khi nối ý; khoảng thời gian viết bằng "đến".
