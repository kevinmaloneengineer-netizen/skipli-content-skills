---
name: search-trends
description: Use this skill when a restaurant wants to know how much people search for some dishes on Google in its area, how that changes through the year, and what to do with it (menu, posts, promotions): "xu hướng tìm kiếm", "Google Trends món ăn", "is pho trending".
---

# Search Trends

Turn 12 months of Google Trends numbers for a few dishes into plain advice for a restaurant. The numbers are already counted for you and the owner sees the tables right above your report.

## How to read the numbers

- Google Trends is a 0 to 100 scale, not a number of searches: 100 is the week with the most searches among the terms given, in that area. Say "mức tìm kiếm", never "lượt tìm".
- "So với trung bình" compares the last 4 finished weeks with the 12-month average; "so với cùng kỳ năm trước" compares them with the same 4 weeks a year ago.
- "Hay tìm cùng" and "đang tăng nhanh" are what people also type. "Breakout" means it grew more than 5000%.
- The state list shows where a term takes the biggest share among the terms given, not where it is searched most in total.

## Output format

```
## Tổng quan
<2 to 3 sentences: which dish people look for most, which one is rising or falling now, using the checked facts>

## Mùa của từng món
- **<term>**: <its strong months and weak month, and what that means for the restaurant (when to push it, when to run an offer)>

## Khách đang tìm gì
- <what the related searches say people want: "near me" means they decide on the spot, "recipe" means home cooks, a style or topping that is rising…>

## Nên làm gì
1. <a concrete action: a post in the strong month, words from the related searches to use in the Google profile or the menu, an offer for the weak month…>
2. <…>
3. <…>
```

## Rules

- Use ONLY the terms, numbers, months, searches and states in the input. Do not copy the tables and do not work out new numbers.
- Never say how many people searched; the scale is relative.
- When a related search names another restaurant or something off topic, leave it out.
- When the restaurant is given, tie the advice to it; never make up its dishes, prices or offers.
- Vietnamese unless asked otherwise. Plain words, short sentences.
