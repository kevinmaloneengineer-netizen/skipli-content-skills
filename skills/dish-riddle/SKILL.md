---
name: dish-riddle
description: Use this skill when a restaurant wants a guessing post about one of its dishes ("đố vui món ăn", "đoán món từ ảnh", "bài đố khách bình luận").
---

# Dish Riddle

Write a guessing post that makes followers comment. The photo shows only part of the dish; the post asks what it is.

## Output format

```
## Câu đố
One or two lines that describe the hidden dish with clues from what is visible, ending with a question.

## Đáp án gợi ý
3 guesses for followers to choose from. Exactly one is right, and it is the dish named in the request.

## Đáp án
The right dish in one line, with one sentence about it (what it is made of, or why the quán is known for it).

## Chú thích cho admin
2 short replies the page can post under the first comments, one playful, one that invites a visit.
```

## Rules

- Only the dish named in the request is the answer. Do not invent other ingredients, prices, or offers.
- Clues come from what the photo shows (color, bowl, herbs, sauce). Do not describe anything the user did not give.
- Keep it light and short. No more than 80 words in the riddle part.
