---
name: gbp-post
description: Use this skill when a restaurant wants posts for its Google Business Profile (Google Maps / Google Search listing): "bài đăng Google Business", "Google Maps post", "đăng lên hồ sơ Google", plus questions and answers for the profile.
---

# Google Business Profile Post

Write posts for the restaurant's Google Business Profile, the listing people see on Google Maps and Google Search when they look for a place to eat nearby. These readers are already deciding where to go: be concrete, local and short.

## Input

The business, what it wants to promote (an offer, a new dish, an event, or the place in general), the button the post will carry, and optionally real facts (prices, hours, address, the offer's terms). Use only those facts.

## Output format

```
## Bài 1: <angle, e.g. Món mới>
<the post itself, no label before it: 2 short paragraphs, 60 to 120 words in total>

**Nút:** the button label as Google shows it (Book, Order online, Call now, Learn more, Offer)
**Ảnh nên dùng:** one line describing the photo to attach (close-up of the dish, the room at night…)

## Bài 2: <another angle>
…

## Bài 3: <another angle>
…

## Hỏi đáp gợi ý
- **<question>** <answer>
(5 questions customers ask on Google, each with a one-line answer)
```

## The posts

- Google shows about the first 80 characters before "More": the first line names the dish or the offer.
- One sensory detail, then a closing line that matches the button ("Order your bowl online today").
- Practical facts from the input (hours, parking, address) go in at most ONE of the three posts, not all of them.

## The Q&A

- Answer ONLY from the facts in the input. A question whose answer is not in the input gets the placeholder as its answer ("[HOURS]", "[PHONE]", "[PRICE]", "[YES/NO]"), never a guess: do not say the place has vegetarian dishes, delivery, reservations or kids' seats unless the input says so.
- When a fact is given, answer with it and no placeholder.

## Rules

- Three different angles (for example: the dish, the offer, the experience), not three rewrites of one post.
- No phone numbers, links or prices in the post text unless the input gives them: Google rejects posts with some contact details, and invented prices mislead customers.
- No hashtags, no emoji walls (one emoji at most per post), no ALL CAPS.
- Write like a local restaurant, not an ad agency: plain words, specific details.
- Do not invent services or features the input does not name (delivery, custom orders, scheduled pickup, an app, a loyalty card).
- Do not invent ingredients, cooking methods or claims ("newest in town", "best in Milwaukee"). The sensory detail comes from the dish as named (hot broth, tender beef), not from new ingredients.
- No dashes to join ideas (no "—" or " - "): use a period or a comma instead.
- Keep every post under 1,500 characters (Google's limit); aim for 60 to 120 words.
