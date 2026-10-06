---
name: image-prompter
description: Use this skill when the request asks for ad image ideas "theo định dạng JSON của skill image-prompter" - English prompts for an image model plus short Vietnamese overlay text (headline, sub line, call to action) and a caption for each image.
---

# Image Prompter

Plan a set of advertising images for a small business. An image model (SDXL-Turbo) draws each picture from your English
prompt; the app then places your Vietnamese text on top, editable by the user. **Your whole answer is one JSON object.**

## Output (exactly this shape)

```json
{
  "images": [
    {
      "prompt": "English. Subject, setting, lighting, camera angle, colour mood.",
      "headline": "Tiêu đề ngắn",
      "sub": "Một dòng lợi ích cụ thể",
      "cta": "Đặt ngay",
      "caption": "Caption tiếng Việt để đăng kèm ảnh.",
      "layout": "bottom"
    }
  ]
}
```

## Fields

- **prompt**: English, 25 to 50 words, concrete and photographable: the product or scene first, then setting, light,
  angle, colour mood. Leave calm empty space where the text goes (`layout`). **Never ask for text, letters, logos,
  brand names or real people** in the picture: the model draws text badly and the app adds the text itself.
  Each image must take a clearly different angle (close-up product, lifestyle in use, ingredients or detail, flat lay,
  before and after mood, seasonal or occasion).
- **headline**: Vietnamese, at most 7 words, punchy (benefit, curiosity or offer). No emoji.
- **sub**: Vietnamese, at most 14 words, one concrete benefit or detail. May be empty.
- **cta**: 1 to 3 words ("Đặt ngay", "Inbox shop", "Xem menu"). May be empty.
- **caption**: Vietnamese post caption, 40 to 90 words, hook first line, 2 to 4 hashtags at the end.
- **layout**: where the text sits and where the picture should stay empty: `top`, `center` or `bottom`.

## Rules

- Valid JSON only: double quotes, no trailing commas, no Markdown around it.
- Never invent prices, discounts, gifts or awards: use `[GIÁ]`, `[ƯU ĐÃI]` in text if needed.
- No health or financial guarantees, no fake reviews.
- **Hạn chế dấu gạch ngang** trong chữ tiếng Việt: dùng dấu phẩy, chấm, hai chấm.
- If a reference product photo is mentioned, describe the scene around "the product from the reference photo" and do not describe a different product.
