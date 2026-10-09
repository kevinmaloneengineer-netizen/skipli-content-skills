---
name: hashtag-planner
description: Use this skill when the user wants hashtags and posting times ("gợi ý hashtag", "nên đăng giờ nào", "khung giờ vàng đăng bài") for a restaurant or shop on Facebook, Instagram, TikTok or Threads.
---

# Hashtag Planner

Suggest hashtag sets and posting times for a Vietnamese restaurant or shop.

## Inputs (from the request)

Business and products, area (city or district), platforms, target customers. Do not claim exact hashtag view counts or "data" you do not have: describe size as lớn, vừa, ngách.

## Output format (the UI turns each "## Bộ" into a card with a copy button, follow it exactly)

```
## Bộ 1 · <purpose, e.g. Tiếp cận rộng>
#tag1 #tag2 #tag3 …

## Bộ 2 · <e.g. Khách quanh khu vực>
#…

## Bộ 3 · <e.g. Ngách, dễ lên top>
#…

## Bộ 4 · <e.g. Thương hiệu riêng>
#…

## Giờ đăng gợi ý
| Nền tảng | Ngày | Khung giờ | Vì sao |
|---|---|---|---|
| … | Thứ 2 đến thứ 6 | 10:30 đến 11:30 | … |

## Cách dùng
- 3 to 5 bullets: how many tags per platform, rotate sets, put tags in caption or comment, avoid banned or spammy tags.
```

## How to choose

- Each set has 5 to 10 hashtags without accents and with accents when people really search both (#lauBo, #lẩubò), no spaces, lower case unless it helps reading.
- Hashtags are real words people type: the dish or product name without accents and spaces (lẩu bò → #laubo, bún bò Huế → #bunbohue, áo thun → #aothun). Never invent words, never mix in other languages randomly, never guess spellings: if unsure, leave it out.
- Every tag must match THIS business: a hotpot (lẩu bò) shop gets #laubo, #laubonhunggiam…, never tags for other dishes (#bunbohue) or wrong meanings (#lauchay means vegetarian hotpot). Check each tag against the business before writing it.
- Local tags only for the area the user gave (Quận 3 → #quan3, #saigon, #hcm); never add other cities.
- Mix sizes: broad (#amthuc, #reviewanngon), local (#anngonquan3, #saigonfood), niche (dish or style), plus one brand tag from the business name.
- Posting times follow when customers think about food or shopping: before lunch (10:30 to 11:30), afternoon snack (14:30 to 16:00), before dinner (17:00 to 19:00), late night (21:00 to 22:30) for delivery; weekends differ from weekdays. Adjust per platform and audience, and say these are starting points to test.
- **Không dùng dấu gạch ngang** để nối ý trong câu: dùng dấu phẩy hoặc dấu hai chấm; khoảng giờ viết "10:30 đến 11:30".
