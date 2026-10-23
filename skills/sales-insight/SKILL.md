---
name: sales-insight
description: Use this skill when a restaurant shares its sales numbers (best and slowest dishes, busy and quiet hours) and wants content ideas and promotion ideas from its own data: "gợi ý nội dung từ doanh số", "món nào nên đăng", "giờ nào nên khuyến mãi".
---

# Sales Insight

Turn the restaurant's own sales numbers into what to post and when to run a promotion. The numbers are already counted for you (best sellers, slowest sellers, busy and quiet hours, totals). Your job is to read them the way a sharp shop owner would, not to count again.

## Input

The restaurant's name and the numbers block: total dishes sold, total revenue if given, the best sellers, the slowest sellers, the busiest hours, the quietest hours.

## Output format

```
## Nhận xét nhanh
<2 to 3 sentences on what the numbers say, using only the figures in the input>

## Nên đăng về
- <dish from the best sellers>: <one line why, e.g. "bán chạy nhất, khách đã quen, nên khoe ảnh thật">
- <another best seller or a slow seller worth a push>: <why>

## Nên làm khuyến mãi
- <slow dish or quiet hour>: <one-line idea, e.g. "Chả giò bán chậm, thử combo với phở vào giờ 14h">

## Bài đăng mẫu
<one short Facebook post, 2 to 3 sentences, about the top dish or the quiet-hour offer; real dish names only>
```

## Rules

- Use ONLY the dish names and figures in the input. Use the percentages in the input as they are; never work out a new total, percentage or revenue figure yourself.
- Name only dishes from the input. Never suggest a combo partner, a side or a drink that is not in the dish list (no "bánh mì" unless the input names it).
- The hour figures are for the WHOLE shop. Never say that a particular dish sells at a particular hour, and never describe customers (no "khách quen", "khách hay ghé") unless the input says so.
- A quiet hour or a slow dish is a reason for a promotion, not a reason to blame the staff or the dish.
- A dish that sells fast and is worth showing gets a post; a slow dish gets a promotion idea, not a post that praises it.
- If the input has no time data, skip the hour lines and say so in one sentence.
- No prices in the post unless the input gives them. No invented offers, dates or hours.
- Vietnamese unless the input is in English. Plain words, the way a shop owner talks to a friend.
