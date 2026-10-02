---
name: content-writer
description: Use this skill when the user asks to write social media content - Facebook posts, Threads posts, TikTok/Reels video scripts or captions, ad copy - from a topic, a product brief, a template/structure, or reference content (e.g. competitor posts or a viral-post report they want to take inspiration from). Vietnamese triggers include "viết content", "viết bài", "viết caption", "viết kịch bản video", "lên ý tưởng bài đăng".
---

# Content Writer

Write original, ready-to-post content in the user's language (default Vietnamese) for a business.

## Inputs (from the request; ask only if the topic itself is missing)

| Input | Default |
|---|---|
| Platform: `facebook` · `threads` · `tiktok` (video script + caption) · `ads` | facebook |
| Topic / product / brief | **required** |
| Brand, audience, offer, CTA | infer conservatively from the brief; never invent prices, promotions, statistics or testimonials |
| Tone | thân thiện, tự nhiên |
| Length | platform default (below) |
| Variants | 3 |
| Template / structure | none - choose the structure that fits |
| Reference content | none |

Platform defaults:

- **facebook**: 80–200 words, strong first line (shown before "Xem thêm"), short paragraphs, 0–5 emoji, 3–5 hashtags at the end.
- **threads**: ≤ 500 characters, conversational, one idea, no hashtag wall (0–1 tag); a question or opinion that invites replies.
- **tiktok**: 30–60 s script: `Hook (0–3s)` / `Thân bài` (scene-by-scene: lời thoại + hình ảnh/chữ trên màn hình) / `CTA`; then a caption ≤ 150 characters + 3–5 hashtags.
- **ads**: primary text ≤ 125 characters + headline ≤ 40 characters + description ≤ 30 characters + CTA button suggestion.

## Using a template

If the user gives a template (e.g. AIDA, PAS, a numbered structure, or a sample post they own), follow its **structure** section by section, filled with the user's topic. Do not copy wording from the template's example text.

## Using reference content (competitor / viral posts)

Reference content is **inspiration only**:

1. Extract what makes it work: hook type, emotion, format, angle, length, CTA style.
2. Write **new** content for the user's own topic/brand using those patterns.
3. Never reuse sentences, distinctive phrases, stories, personal claims or numbers from the reference. If the user asks to copy, re-up or lightly reword someone else's post, decline that part and offer an original version instead.

## Output format

```
## Phương án 1: <angle in a few words>
<the post, ready to paste>

## Phương án 2: <angle>
...

---
**Ghi chú:** <1–3 bullets: which pattern/template each variant uses, what to check (e.g. "điền giá thật vào [GIÁ]")>
```

Use placeholders in square brackets (`[GIÁ]`, `[LINK]`, `[SĐT]`) for facts not given. Each variant must take a clearly different angle (e.g. pain point, story, list/tips, social proof, offer).

## Rules

- Write only what the brief supports. No fake reviews, fake customer quotes, fabricated results or "giả làm khách hàng" content - refuse that part.
- No health/financial guarantees ("chữa khỏi", "cam kết lãi") and nothing that violates platform ad policies.
- **Hạn chế dấu gạch ngang.** Trong bài viết, tiêu đề phương án và ghi chú, không dùng "—", "–" hay " - " để nối ý; dùng dấu phẩy, dấu chấm hoặc dấu hai chấm. Khoảng số viết "từ 3 đến 5", không viết "3–5". (Gạch đầu dòng của danh sách thì vẫn dùng bình thường.)
- Natural Vietnamese: avoid machine-translated phrasing and overused filler ("Bạn có biết…?" at most once across all variants).
