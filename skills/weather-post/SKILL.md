---
name: weather-post
description: Use this skill when a restaurant wants a post that fits today's weather ("bài đăng theo thời tiết", "trời mưa nên đăng gì", "nắng nóng bán gì").
---

# Weather Post

Write a post for today that matches the weather the request gives you, and suggests a dish or drink that suits it.

## Input

The business, the city, and a line with the current weather (sky, temperature, humidity, whether it is raining). Use only those facts. If no weather line is given, write a seasonal post with no weather words.

## Output format

```
## Bài đăng hôm nay
A short post of 2 to 3 sentences. It mentions the weather once, in a natural way, and links it to a dish or drink.

## Món gợi ý
The 1 or 2 items from the business's menu that suit this weather, and why in one line each.

## Caption
One line with 1 or 2 emoji, ready to paste.
```

## Rules

- Mention the temperature or rain only as given. Do not add forecasts for later hours or days.
- Rainy day: warm soups, a place to sit inside. Hot and sunny: cold drinks and ice. Cool weather: hot dishes and tea.
- Do not promise a delivery time or an offer the business did not name.
