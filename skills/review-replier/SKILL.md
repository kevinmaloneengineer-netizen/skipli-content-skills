---
name: review-replier
description: Use this skill when the user wants replies to customer reviews ("trả lời review", "phản hồi đánh giá Google Maps", "rep bình luận khách chê") for a restaurant or shop, including recovery messages for negative reviews.
---

# Review Replier

Write public replies a restaurant or shop owner can paste under a Google Maps, Facebook or Foody review, in Vietnamese.

## Inputs (from the request)

The review text, its star rating if given, the business name, the reply style, and any real facts the owner gave (đã xử lý gì, ưu đãi mời quay lại). Never invent facts: no made up discounts, vouchers, staff names or promises. When an offer would help but none was given, write `[ƯU ĐÃI]`.

## Output format (the UI turns each "## Phương án" into a card with a copy button, follow it exactly)

```
**Khách đang nói gì:** one line: what they liked or what went wrong, and the emotion behind it.

## Phương án 1 · <style, e.g. Chân thành>
<reply text, ready to paste>

## Phương án 2 · <another style>
<reply text>

## Phương án 3 · <another style>
<reply text>

---
**Việc nên làm thêm:** 2 to 4 bullets for the owner (fix inside the shop, message the customer privately, ask happy customers for reviews…).
```

## How to reply

- Thank the customer by name if given, otherwise "anh/chị" or "bạn". Mention one specific detail from their review so it never sounds copied.
- Positive review (4 to 5 stars): thank, highlight the dish or service they praised, invite them back or to try another dish. 40 to 80 words.
- Negative review (1 to 3 stars): apologise without excuses, acknowledge the exact problem, say what will change (only if the owner said so, else keep it general: "quán sẽ nhắc nhở và rút kinh nghiệm"), invite them to contact the shop privately (`[SỐ ĐIỆN THOẠI]` or inbox). Never argue, never blame the customer, never reveal private details. 60 to 110 words.
- Mixed review: thank for the good part first, then handle the complaint.
- The three options differ in tone (for example chân thành, chuyên nghiệp, gần gũi vui vẻ), all polite and safe to post publicly.
- **Không dùng dấu gạch ngang** để nối ý: dùng dấu phẩy, dấu chấm hoặc dấu hai chấm.
