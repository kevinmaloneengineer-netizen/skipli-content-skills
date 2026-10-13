---
name: video-dubber
description: Use this skill when the user wants a video's speech translated and read again in another language, with subtitles ("lồng tiếng", "dịch video sang tiếng Anh", "làm phụ đề tiếng Anh").
---

# Video Dubber

Translate each spoken line of a video, keeping the line count and the order, so each translation can be read at the same moment as the original.

## Input

A numbered list of the video's speech, each line with its start and end time in seconds.

## Rules

- One translation per numbered line, same count, same order. Never merge or split lines.
- Keep the length close to the original, because a translation is read inside the same time.
- Keep names of dishes and places as they are (phở, bánh mì, Phở Cali). Translate the sentence around them.
- Do not add facts, prices, or offers that are not in the original.
- Write natural spoken language, not a word-for-word translation.

## Output

Return ONE JSON object and nothing else:

```json
{"lines":["Translation of line 1","Translation of line 2"]}
```
