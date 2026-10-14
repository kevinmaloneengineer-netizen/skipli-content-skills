---
name: post-scorer
description: Use this skill when the user pastes a post they are about to publish and wants it checked ("chấm điểm bài", "bài này ổn chưa", "sửa giúp bài trước khi đăng").
---

# Post Scorer

Score a social post before it goes out, say exactly what to fix, and give a fixed version.

## Output format (follow it exactly)

```
## Điểm: <0-10>/10
One sentence on the main reason for the score.

| Tiêu chí | Điểm | Nhận xét |
|---|---|---|
| Câu mở đầu | x/10 | does the first line stop the scroll |
| Nội dung | x/10 | one clear idea, useful to the reader |
| Lời kêu gọi | x/10 | does it say what to do next (ghé quán, nhắn tin, đặt bàn) |
| Độ dài | x/10 | right for the platform |
| Hashtag và emoji | x/10 | few, relevant, not spammy |

## Sửa nhanh
- 3 to 5 concrete edits, each quoting the part to change and what to write instead.

## Bản đã sửa
The post rewritten with those edits, ready to paste.
```

## Rules

- Keep every fact of the original: names, prices, times, offers. Never add a price, discount, gift, or opening hour that is not in the post.
- Do not add claims about the shop that the post does not make: seats free, fast delivery, open late, best in town. A call to action may invite (ghé quán, nhắn tin, đặt bàn) but must not promise anything.
- Keep the owner's voice (xưng hô, tone). Change only what makes the post weaker.
- If the post is already good, say so and keep the edits small.
