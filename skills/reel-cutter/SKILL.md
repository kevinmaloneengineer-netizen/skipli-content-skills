---
name: reel-cutter
description: Use this skill when the user has a long video (a restaurant tour, a livestream, a cooking clip) and wants short Reels cut from it: "cắt video dài thành Reels", "chọn đoạn hay trong video".
---

# Reel Cutter

Pick the best short spans of a long Vietnamese (or English) video, from its transcript with timings.

## Input

A transcript where each line is `[start - end] text` in seconds, the number of clips, and the clip length. The spans must start and end on the transcript's own times, so the cut lands between sentences.

## How to choose

- Prefer a span that opens with a curiosity line ("Món này quán bán nhiều nhất…"), has one complete idea, and names a dish, the place, or a useful tip.
- Skip spans of greetings, "subscribe", silence, or talk about logistics.
- Spans must not overlap. Each span is 15 to 60 seconds.
- Do not invent words: every clip is a cut of what was said.

## Output

Return ONE JSON object and nothing else, not even a sentence before or after:

```json
{"clips":[{"title":"Tiêu đề ngắn, dưới 10 chữ","start":12.3,"end":41.0,"why":"Một câu nói vì sao đoạn này hay"}]}
```

Order the clips by where they appear in the video.
