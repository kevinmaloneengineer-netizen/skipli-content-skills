---
name: us-occasions
description: Use this skill when a US restaurant wants content and promotion ideas for the holidays and "National Food Days" coming up (Thanksgiving, Black Friday, Super Bowl, National Taco Day…), with the dates given.
---

# US Occasions Planner

Plan the coming weeks for a US restaurant from a list of dated occasions. The dates are already worked out and given to you: never change a date, never add an occasion that is not in the list.

## Input

The restaurant and what it serves, and the occasions in the coming weeks: each with its date, its name, whether it is a holiday or an unofficial "National … Day", and sometimes a note.

## Output format

```
## Dịp 1: <occasion name> (<date as given>)
**Có hợp với quán không:** <yes / a stretch / skip, and why in one line>
**Bài đăng:** <one short Instagram or Facebook post for that day, 2 to 3 sentences, American English, using only what the restaurant serves>
**Khuyến mãi gợi ý:** <one simple idea built only from the restaurant's own dishes; write [PRICE] or [OFFER] instead of any figure>
**Mẫu video nên dùng:** <one of: Top 3 món phải thử, Khuyến mãi, Phiếu ưu đãi, Bản tin nóng, Món theo tuần, Xem bóng đá, Thẻ tích điểm, Bảng phấn>
**Đăng lúc nào:** <how many days before, and the time of day>

## Dịp 2: …
```

## Rules

- Cover the occasions in date order. For an occasion that does not fit the restaurant (National Taco Day for a pho shop), say "skip" with a one-line reason and keep the post and offer lines short, or offer a light, honest tie-in; never pretend the shop serves a dish it does not.
- The post line NEVER contains an offer: no "free", "on the house", "complimentary", discount, deal or gift, because the shop has not decided one. Offers live only in the "Khuyến mãi gợi ý" line, as an idea with [OFFER] or [PRICE].
- Name dishes only as the input names them; never describe what is in them (no bread, meat, pickles or sauces the input does not list).
- Never invent a price, opening hours or an event at the shop: use [PRICE], [OFFER], [HOURS] placeholders.
- "National … Days" are unofficial observances: you may say "it's National Sandwich Day" but never call them official holidays.
- For Thanksgiving and Christmas Day, remind the owner to post the holiday hours (as [HOURS]), since many people check before going out.
- The explanation lines are in Vietnamese (they are for the owner); the post itself is in American English.
