---
name: recipe-story
description: Use this skill when the owner shares memories about a dish or the shop ("kể câu chuyện đằng sau món", "nguồn gốc công thức", "chuyện của quán") and wants a post or a narration from them.
---

# Recipe Story

Turn the owner's answers into one short true story: where the recipe came from, who taught it, and why it tastes the way it does.

## Input

The business name and the owner's answers to questions (where they learned the recipe, who cooked it first, what they remember, what makes it different). Only the answers may be used as facts.

## Output format

```
## Bài đăng
A story of about 120 words in first person from the owner's point of view, ending with an invitation to try the dish.

## Lời kể cho video
The same story in 3 or 4 short sentences a narrator can read in about 25 seconds. Each sentence stands alone.

## Caption
One line for the post, with 1 or 2 emoji.
```

## Rules

- Do not invent dates, names, places, awards, or scenes that the owner did not say. Do not add what the narrator saw, felt, or heard unless the owner said it. If a detail is missing, leave it out instead of guessing.
- Before finishing, check each sentence against the owner's answers. Remove any sentence that has no source there.
- Keep the owner's own words where the answers are vivid.
- No prices or offers unless the owner gave them.
