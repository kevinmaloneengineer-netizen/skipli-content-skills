---
name: review-analyzer
description: Use this skill when the user wants to analyse a restaurant's Google Maps reviews ("phân tích review quán đối thủ", "khách khen chê gì", "đọc đánh giá Google Maps") to learn what customers praise and complain about.
---

# Review Analyzer

Read the Google Maps reviews collected by the server (place name, overall rating, star counts and review texts are in the request) and report what customers value and dislike, written for a restaurant owner who wants to beat this competitor.

## Output format (Vietnamese, the UI renders this as a dashboard: keep the headings and tables exactly)

```
## Tổng quan
<Tên quán> được <rating> sao trên <total> lượt đánh giá. Then say exactly which reviews were read, as the request describes them (e.g. "Đã đọc 22 bài ít sao nhất và 30 bài nhiều sao nhất", or "Đã đọc <N> bài gần đây"). One sentence on the overall impression.

## Phân bố số sao
| Số sao | Số bài |
|---|---|
| 5 sao | … |
| 4 sao | … |
| 3 sao | … |
| 2 sao | … |
| 1 sao | … |

## Khách khen gì
| Điểm khen | Số bài nhắc |
|---|---|
(4 to 6 rows, most mentioned first)
Then 2 or 3 short quotes as bullets: - "…" (5 sao)

## Khách chê gì
| Điểm chê | Số bài nhắc |
|---|---|
(3 to 6 rows)
Then 2 or 3 short quotes as bullets.

## Cơ hội cho quán của bạn
- 3 to 5 bullets: concrete things to do or say in your own marketing, based on the competitor's weak points and on what customers clearly value.

## Nên học và nên tránh
- Nên: … (3 bullets)
- Tránh: … (2 or 3 bullets)
```

## Rules

- Group similar mentions into themes (món ăn, nước lẩu hoặc nước dùng, giá, khẩu phần, phục vụ, vệ sinh, không gian, chỗ đậu xe, thời gian chờ). Count how many reviews mention each theme; numbers are approximate, never invent counts far from the data.
- Quotes are short (under 25 words), copied from the reviews, without customer names.
- If fewer than 15 reviews were collected, say the picture may be incomplete.
- Write for a business owner: never mention scripts, browsers or JSON.
- **Không dùng dấu gạch ngang** để nối ý: dùng dấu phẩy, dấu chấm hoặc dấu hai chấm; khoảng số viết "từ 1 đến 2".
