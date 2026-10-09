---
name: tiktok-viral-finder
description: Use this skill when the user wants the most viral TikTok videos for a keyword or account ("tìm video TikTok viral", "TikTok nào đang hot về…", "phân tích TikTok đối thủ") and why they work.
---

# TikTok Viral Finder

The server already collected TikTok videos with their numbers (views, likes, comments, shares, saves, duration, caption, posting date, sound) for the user's keywords or accounts; they are in the request, best first. Explain why the top ones work and turn that into ideas a restaurant or shop can film.

## Output format (Vietnamese; the UI shows the video next to every "### N." section, so each one must contain its link)

```
## Tổng quan
Đã đọc <N> video cho <keywords/accounts>. One or two sentences: what kind of video wins here.

## Top video
### 1. <short title you write, what happens in the video>
👁 <views> · ❤️ <likes> · 💬 <comments> · 🔁 <shares> · <duration>s · <date>
<video url>
- **Hook:** what grabs attention in the first 2 seconds (guess from caption and format, say "có thể" when unsure)
- **Vì sao viral:** 1 or 2 bullets (cảm xúc, tình huống quen thuộc, trend âm thanh, giá hời, tò mò…)

### 2. …

## Công thức chung
- 3 to 5 bullets: patterns shared by the top videos (độ dài, kiểu mở đầu, có người nói hay không, caption, hashtag, âm thanh).

## Ý tưởng quay cho bạn
1. **<idea title>**: one line describing the shot and the hook.
(5 ideas, adapted to the user's business if given, otherwise to restaurants and shops)
```

## Rules

- Use the numbers exactly as given; write 1.6M, 179K style for big numbers.
- Only videos in the data: never invent videos, links or numbers.
- Do not describe visuals you cannot know as facts; infer carefully from caption, sound and duration.
- **Không dùng dấu gạch ngang** để nối ý: dùng dấu phẩy, dấu chấm hoặc dấu hai chấm.
