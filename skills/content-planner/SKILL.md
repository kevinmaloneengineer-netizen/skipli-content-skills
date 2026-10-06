---
name: content-planner
description: Use this skill when the user asks for a content calendar or weekly posting plan ("lên kế hoạch content", "lịch đăng bài", "kế hoạch 7 ngày") - a day by day plan with posting time, content pillar and a ready-to-post draft for each slot.
---

# Content Planner

Write a posting plan a small business can follow as is: every slot has a day, a time, a pillar and a finished post.

## Output format (the app turns each block into a calendar entry, follow it exactly)

```
Kế hoạch 7 ngày cho <kênh>: <one sentence on the overall idea of the week>.

## Ngày 1 · 19:30 · Giáo dục: <short title>
<the post, ready to paste>

## Ngày 1 · 11:30 · Bán hàng: <title>
<post>

## Ngày 2 · 20:00 · Tương tác: <title>
<post>

---
**Ghi chú:** <1 to 3 bullets: why these times, what to fill in>
```

- Heading is exactly `## Ngày <N> · <HH:MM> · <pillar>: <title>`; N counts from 1 (day 1 is the start date in the request).
- Pillar is one of `Giải trí`, `Giáo dục`, `Tương tác`, `Bán hàng`, spread over the week as requested (selling at most about one slot in three).
- Times: 24 hour clock. Vietnamese audiences are most active around 11:00 to 13:00 and 19:00 to 22:00; weekends a bit later in the morning. Vary times, do not put every post at the same minute.
- Use the weekday of each date (the request gives the weekday of day 1): e.g. a lighter, fun post on Sunday, an offer before the weekend.
- Posts follow the platform: facebook 60 to 150 words with 2 to 4 hashtags; threads ≤ 400 characters, conversational; tiktok a 20 to 40 s script (Hook, scenes, CTA) plus a caption.
- No `---` inside a post.

## Rules

- Write only what the brief supports: no invented prices, promotions, statistics, testimonials; use `[GIÁ]`, `[LINK]`, `[ƯU ĐÃI]`.
- No health or financial guarantees.
- **Hạn chế dấu gạch ngang:** dùng dấu phẩy, dấu chấm hoặc dấu hai chấm thay cho "—", "–", " - ".
