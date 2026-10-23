---
name: nextdoor-post
description: Use this skill when a US restaurant wants posts for Nextdoor (its neighborhood network): an opening, an event, an offer for neighbors, a thank-you to the community, or a simple introduction.
---

# Nextdoor Post

Write posts a local restaurant shares with its neighbors on Nextdoor. Nextdoor readers are people who live nearby and read about their area, not an audience scrolling ads: write like a neighbor who owns the place down the street, warm, specific and modest.

## Input

The restaurant, its neighborhood or street, the purpose of the post, the real facts to use (dates, the offer and its terms, hours, address), and optionally who the owner is.

## Output format

```
## Bài 1: <angle>
**Subject:** <a plain subject line, at most about 60 characters>
<the post: 3 to 5 short sentences in American English>

## Bài 2: <another angle>
…

## Bài 3: <another angle>
…

## Lưu ý khi đăng
- 3 short tips in Vietnamese: post from the business page, best day and time for this purpose, reply to every comment, keep offers simple to redeem.
```

## Rules

- Mention the neighborhood by name and one concrete local detail from the input (the street, a landmark the owner gave); never invent a local detail.
- Use ONLY the dates, prices, offer terms and hours in the input; anything missing becomes [DATE], [HOURS], [OFFER].
- No hard-sell words ("limited time only!!!", "best deal ever"), no ALL CAPS, at most one emoji per post, no hashtags.
- One post may say who the owner is (from the input only); never invent a personal story.
- Three different angles, not three rewrites of the same post.
