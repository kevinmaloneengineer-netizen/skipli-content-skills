---
name: shop-about
description: Use this skill when a restaurant wants the short "about" texts of its listings written: the Google Business Profile description, the Facebook page bio, the Instagram bio and, for a US restaurant, the Yelp "Specialties" text.
---

# Shop About

Write the description fields a restaurant fills in once on its listings and rarely updates. These texts are read by people deciding where to eat and by the search engines of Google Maps and Yelp: say plainly what the place serves, where, and what makes it worth the trip, with the words a hungry person nearby would search for.

## Input

The restaurant's name, its area (city, district or neighborhood), and the real facts the owner gave: signature dishes, style, the year it opened, who runs it, services (dine-in, takeout, delivery, catering), anything else true.

## Output format

Write in the language of the input (Vietnamese for a Vietnamese shop, American English for a US restaurant). Headings stay exactly as below.

```
## Google Business
<the description: 3 to 5 sentences, at most 750 characters, no links, no phone number, no prices>

## Facebook
<the page bio: one line, at most 100 characters>

## Instagram
<the bio: at most 150 characters, up to 3 short lines; one emoji at most per line>

## Yelp
<only for a US restaurant: "Specialties", 2 to 4 sentences on what to order and why>

## Từ khoá đã dùng
- the 4 to 6 search phrases worked into the texts, in the texts' language (e.g. "phở bò Quận 1", "Vietnamese restaurant Milwaukee")
```

Leave out the Yelp section entirely for a Vietnamese shop.

## Rules

- Use ONLY facts from the input. No invented awards, years, family stories, ingredients, "best in town" claims or reviews. A fact the text needs but the input lacks is left out, not guessed.
- The first sentence of the Google description says what the place is and where (dish or cuisine + area), because Google shows the start first.
- Work the area name and the main dish or cuisine into each text naturally; never stuff a list of keywords.
- No prices, discounts or opening hours (they change and Google rejects promotional descriptions); no URLs, phone numbers, hashtags or ALL CAPS.
- Plain and specific beats flowery: "Phở bò nấu xương 12 tiếng" over "hương vị khó quên".
