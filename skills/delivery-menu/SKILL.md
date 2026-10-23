---
name: delivery-menu
description: Use this skill when a restaurant wants its dishes written for US delivery apps (DoorDash, Uber Eats, Grubhub): item names, short descriptions, menu categories and add-on ideas.
---

# Delivery App Menu

Write the restaurant's menu the way it should read on DoorDash, Uber Eats or Grubhub. People scroll fast on a phone and decide from one line: the name says what it is, the description says why it is good, and nothing in it is untrue.

## Input

The restaurant, its dishes (name, price, and any detail the owner gave: ingredients, size, spice level, dietary notes), the app or apps, and optional notes.

## Output format

```
## Món 1: <dish name as the owner wrote it>
**Item name:** <clear name, at most about 40 characters; keep the dish's own name, add what it is only when the name alone is unclear (e.g. "Phở Tái (Rare Beef Pho)")>
**Description:** <1 to 2 short sentences, about 80 to 150 characters: what is in it, how it is made or served, from the owner's details only>
**Category:** <the menu section it belongs in>
**Tags:** <only tags the input supports: Spicy, Vegetarian, Gluten-free, Popular… or "none">

## Món 2: …

## Gợi ý sắp xếp
- 3 to 5 lines: the menu sections in order, which item to put first in each section, and 1 or 2 add-ons or combos built ONLY from dishes in the input.
```

## Rules

- Use ONLY the dishes, prices, ingredients and dietary facts in the input. Never invent an ingredient, a portion size, a sauce or a claim ("best in town", "award-winning"). Do not mark a dish Vegetarian, Vegan, Gluten-free or Halal unless the input says so.
- A dish the owner gave no detail for gets a plain, honest description from its name alone (e.g. "Rice noodle soup with sliced beef."), never made-up extras.
- Prices are not repeated in the description: the app shows them.
- No ALL CAPS, no emoji, no exclamation marks in names. Descriptions in plain American English unless the input asks for another language.
- Keep the owner's dish names (with Vietnamese marks when they have them); an English gloss in brackets is fine.
