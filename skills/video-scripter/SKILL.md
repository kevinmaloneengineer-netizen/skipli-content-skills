---
name: video-scripter
description: Use this skill when the request asks for a short AI video script "theo định dạng JSON của skill video-scripter" - splitting a topic, a storyboard, or a narration into shots (scenes) with Vietnamese narration plus English visual and motion prompts for an image-to-video model.
---

# Video Scripter

Turn the request into a shot list that a video pipeline renders automatically: per shot it draws (or takes) a first frame, animates it for a few seconds, reads the narration aloud, and burns it in as subtitles. **Your whole answer is one JSON object, nothing else.**

## Output (exactly this shape)

```json
{
  "title": "Tiêu đề ngắn của video",
  "shots": [
    {
      "narration": "Lời đọc tiếng Việt của cảnh này.",
      "visual": "English, under 40 words. Main subject doing the key action, key objects, setting.",
      "motion": "English. What moves: camera move and subject action.",
      "continue": false,
      "role": "scene"
    }
  ]
}
```

## Fields

- **One idea per shot.** If a line lists several things (e.g. "súc miệng nước muối, dùng máy tạo ẩm, tránh khói thuốc"), make one shot per thing, so the picture always shows what is being said.
- **narration**: Vietnamese, natural spoken style. About 7 to 10 words for a 3 second shot (about 20 words for an 8 second storyboard shot). No emoji, no hashtags, no stage directions.
- **visual**: English, **under 40 words**: the image model only reads the first ~75 tokens, so put first what this narration line is about (the action and the objects it names), then the setting. Do **not** add style words, camera specs, "photorealistic", "9:16", "video" or quality tags: the pipeline appends the chosen style itself. Repeat the **same short fixed description** (under 12 words) of each recurring character or product in every shot where it appears (e.g. always "young Vietnamese woman, black bob, beige sweater"), otherwise the model draws a different person each time. Never ask for on-screen text, logos, or real people or brands.
- **motion**: English, short: one camera move (slow push in, pan left, static close up…) plus one simple action. Keep motion small; image-to-video models break on complex action.
- **continue**: `true` only when the shot directly continues the previous shot's action in the same place (the pipeline then starts from the previous clip's last frame). First shot is always `false`.
- **role**: `"narrator"` for a storyteller speaking to camera (visual = that person, medium close up, facing camera), otherwise `"scene"`.

## By request type

- **Topic**: write the story yourself: hook in shot 1 (a question, a surprise, or a strong claim), clear middle, a closing line or call to action in the last shot.
- **Storyboard with N panels**: exactly N shots in order; panels are already drawn, so `visual` is a short summary and `motion` matters most.
- **Narration given**: keep the user's words **verbatim** and in order, only split them at natural pauses; mark about the requested share of shots as `"narrator"`, spread out (always include the first shot if the share is above 0), and illustrate the other shots with what that line talks about.

## Rules

- Valid JSON: double quotes, no trailing commas, no comments, no Markdown around it.
- **Hạn chế dấu gạch ngang** in narration: dùng dấu phẩy hoặc dấu chấm thay cho "—", "–", " - ".
- No fake claims, health or financial guarantees, or content imitating real people.
