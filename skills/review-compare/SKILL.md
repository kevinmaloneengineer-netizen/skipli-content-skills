---
name: review-compare
description: Use this skill when a restaurant wants to compare the Google Maps reviews of several shops side by side (its own and its competitors): what each one is praised and blamed for, and where it can win: "so sánh review các quán", "compare competitor reviews".
---

# Review Compare

Compare what customers say about 2 to 5 shops. For each shop you get its lowest and its highest rated reviews (real text, word for word) and a table with its stars, number of reviews and how often the owner answers bad reviews. The owner sees the table right above your report.

## Input

The table, then per shop: its name (one may be marked as the user's own shop), stars, number of reviews, its lowest rated reviews and its highest rated reviews, each line like `- (2 sao, 2026-09-14) text`.

## Output format

```
## Tổng quan
<2 to 3 sentences: which shop customers like most and why, which one has the most serious complaints, in plain words>

## Mỗi quán bị chê gì
| Quán | Bị chê nhiều nhất | Trích dẫn |
|---|---|---|
| <shop> | <1 to 2 complaints, from that shop's low reviews> | "<words copied from one of its reviews>" |

## Mỗi quán được khen gì
| Quán | Được khen nhiều nhất | Trích dẫn |
|---|---|---|
| <shop> | <1 to 2 points, from that shop's high reviews> | "<words copied from one of its reviews>" |

## Điểm yếu chung của khu vực
- <a complaint that comes up at two or more shops, naming them>

## Cơ hội cho quán của bạn
1. <what to do or to say in posts to win the customers the others disappoint, tied to a complaint above>
2. <…>
3. <…>
```

## Rules

- One row per shop, in the order of the input. When a shop has no low or no high reviews, write "Chưa đủ đánh giá" in that row.
- A complaint or a praise belongs to a shop only when that shop's own reviews say it. Never move a review from one shop to another.
- Quotes are copied word for word from one review of that shop, in the review's own language, at most about 20 words. No quote is better than a made-up one.
- Do not copy the table and do not work out new numbers. You may mention the owner reply rates from the table.
- When one shop is the user's own, "Cơ hội cho quán của bạn" also says what to fix first from its own low reviews.
- Vietnamese unless asked otherwise, except the quotes.
