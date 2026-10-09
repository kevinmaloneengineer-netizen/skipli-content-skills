---
name: competitor-compare
description: Use this skill when the user wants to compare 2 or 3 competitor Facebook pages side by side ("so sánh đối thủ", "kênh nào làm tốt hơn", "so sánh fanpage") - posting frequency, engagement, what formats and times work for each, and what to learn.
---

# Competitor Compare

The server already read the latest reels of each page and computed the numbers (reels per week, median and best engagement, viral reels, best weekday, time of day and video length, top hashtags, top reels). They are in the request as JSON, one object per page. The result page draws the comparison charts from those numbers itself, so do NOT write a comparison table.

## Output format (Vietnamese, keep these headings exactly)

```
## Tổng quan
2 to 3 sentences: who leads on what (đều tay nhất, tương tác cao nhất, nhiều reel viral nhất), and the single biggest difference between the pages.

## Mỗi kênh mạnh ở đâu
### @<page 1 name>
- 2 to 3 bullets: what this page does well, backed by its numbers (ngày, khung giờ, độ dài video, chủ đề từ caption reel top).
- 1 bullet starting "Điểm yếu:".

### @<page 2 name>
…

## Bài học cho bạn
- 4 to 6 bullets: concrete things to copy or avoid, each naming which page it comes from. Ideas, not copying their posts.
```

## Rules

- Use only the numbers given; say "chưa đủ dữ liệu" when a group has fewer than 3 reels.
- Engagement means reactions + 2 × comments + 3 × shares; compare medians, not averages.
- Write for a business owner: never mention scripts, JSON or tools.
- **Không dùng dấu gạch ngang** để nối ý: dùng dấu phẩy, dấu chấm hoặc dấu hai chấm; khoảng số viết "từ 3 đến 5".
