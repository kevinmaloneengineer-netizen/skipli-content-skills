---
name: fanpage-analyzer
description: Use this skill when the user asks to analyze a competitor's Facebook page or channel ("phân tích fanpage", "phân tích kênh đối thủ") - how often they post, which days and times, video lengths and caption styles get the most engagement, recurring topics, and what to learn or avoid. Works logged-out from the page's public reels.
---

# Fanpage Analyzer

Give a business owner a clear picture of what works on a competitor's Facebook page, backed by numbers.

## Step 1: Collect (no login, about 1 minute for 100 reels)

```bash
python3 {baseDir}/scripts/list_reels.py "<PAGE_URL>" --count 100 --stats --limit 200 > /tmp/reels.json
python3 {baseDir}/scripts/analyze_reels.py /tmp/reels.json
```

`analyze_reels.py` prints the statistics as JSON: reels per week, median and average engagement, breakdowns by weekday, time of day (Vietnam time), video length and caption length, top hashtags, the top 8 and bottom 5 reels. **Use these numbers as given; never recompute or invent numbers.** If `ok` is false, say in one plain sentence that the page could not be read (private, no reels, or blocked) and stop.

## Step 2: Read the content yourself

From the captions of the top reels (and the bottom ones), work out 3 to 5 recurring topics or formats and what the best ones have in common (hook, promise, CTA such as "comment X to get Y").

## Step 3: Report (Vietnamese, this structure)

```
## Tổng quan
Đã phân tích <N> reel từ <from> đến <to>, trung bình <reels_per_week> reel mỗi tuần. Tương tác trung vị <median>, có <viral.count> reel vượt 3 lần mức trung vị.

## Đăng khi nào
| Ngày | Số reel | Tương tác trung vị |
...one table for weekdays, then one line on time of day...

## Video dài bao lâu, caption ra sao
...short tables or bullets from by_duration and by_caption_length...

## Chủ đề và kiểu bài ăn khách
...3 to 5 bullets, each with one example reel link...

## Top reel
### 1. <short title you write>
👍 … · 💬 … · 🔁 … · <plays_text> views · <duration>s · <posted>
<url>
- Vì sao hiệu quả: …

## Nên học và nên tránh
- Nên: … (3 bullets)
- Tránh: … (2 bullets)
```

## Rules

- Prefer the **median** when comparing groups (one viral reel inflates the average). Groups with only 1 or 2 reels are not reliable: say "chưa đủ dữ liệu" instead of concluding.
- Engagement means reactions + 2 × comments + 3 × shares; explain it once in plain words if you mention it.
- Write for a business owner: never mention scripts, flags, JSON or tools.
- **Hạn chế dấu gạch ngang.** Dùng dấu phẩy, dấu chấm hoặc dấu hai chấm thay cho "—", "–", " - " khi nối ý; khoảng số viết "từ 3 đến 5".
- Learn patterns, never suggest copying someone's posts word for word.
