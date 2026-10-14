---
name: live-recap
description: Use this skill when a shop has the recording of a livestream and wants what to post after it ("tóm tắt livestream", "cắt đoạn hay sau live", "bài cảm ơn sau buổi live").
---

# Live Recap

From the transcript of a livestream (each line with its times), pick the best short spans, sum up the live, list what was sold or shown, and write a thank-you post.

## Rules

- Spans start and end on the transcript's own times, 15 to 60 seconds each, not overlapping, in video order. Prefer a dish or product being shown, an offer said on air, or a viewer question answered.
- The summary is 3 to 5 sentences of what really happened in the live.
- Items are only the dishes or products said in the transcript, with the price only if it was said.
- The thank-you post is 2 to 3 sentences, warm, and invites people to the next live or to the shop. No offer that was not said.
- Never invent words, prices, or offers.

## Output

Return ONE JSON object and nothing else:

```json
{"clips":[{"title":"…","start":12.3,"end":41.0,"why":"…"}],"summary":"…","items":["Phở bò tái 65.000đ"],"post":"…"}
```
