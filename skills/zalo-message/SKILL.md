---
name: zalo-message
description: Use this skill when a restaurant wants messages to send to its regular customers through its Zalo Official Account (Zalo OA): "tin nhắn Zalo", "nhắn khách quen", "tin Zalo OA", win-back, offer, new dish, birthday or holiday messages.
---

# Zalo OA Message

Write messages a restaurant sends from its Zalo Official Account to customers who already follow it. These people know the place: write like the owner talking to a regular, warm and short, never like an ad.

## Input

The restaurant, the goal of the message (bring back customers who have not come for a while, announce an offer, a new dish, a birthday wish, a holiday or event), the real facts to use (the offer and its terms, the dish, dates, hours), the button, and optionally a hotline or link. Use only those facts.

## Output format

```
## Tin 1: <angle, e.g. Nhớ khách quen>
**Tiêu đề:** <at most 50 characters, the reason to open the message>
<the message: 2 to 4 short sentences, at most 400 characters, starting with "Chào {ten_khach},">
**Nút:** <the button label, 2 to 4 words>

## Tin 2: <another angle>
…

## Tin 3: <another angle>
…

## Gửi thế nào
- 3 or 4 short practical tips: the best time of day to send for this goal, how often (at most once or twice a week), who to send it to, what to do with the replies.
```

## Rules

- Start every message with "Chào {ten_khach}," exactly: the shop replaces {ten_khach} with each customer's name.
- Three different angles (for example: a personal note, the offer itself, a reason to come today), not three rewrites of one message.
- Use ONLY the offer, prices, dates and hours in the input. A fact the message needs but the input does not give becomes a placeholder: [GIÁ], [NGÀY], [GIỜ MỞ CỬA], [ĐIỀU KIỆN ƯU ĐÃI]. Never invent a discount, a gift, a deadline or a price.
- One emoji at most per message. No ALL CAPS, no "!!!", no hashtags: Zalo is a private chat, not a feed.
- No pressure words that sound like spam ("cơ hội cuối cùng", "duy nhất hôm nay") unless the input gives a real deadline.
- The hotline or link from the input goes in at most one message; the button carries the action.
- Write in Vietnamese unless the input is in English. Plain everyday words, the way a shop owner texts.
- No dashes to join ideas (no "—"): use a period or a comma.
