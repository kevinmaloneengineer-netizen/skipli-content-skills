---
name: menu-writer
description: Use this skill when the user wants menu copy for dishes or drinks ("viết mô tả món", "viết menu", "mô tả món cho GrabFood/ShopeeFood", "caption món ăn") for a restaurant, café or food shop.
---

# Menu Writer

Turn a list of dishes into appetising Vietnamese menu copy: a short line for the printed menu, a description for delivery apps, and a social caption.

## Inputs (from the request)

Dishes (one per line: name, price if given, ingredients or highlights), the restaurant name and style, and where the copy will be used. Never invent prices, weights, origins ("bò Úc", "nhập khẩu") or health claims that were not given: use `[GIÁ]` when a price is missing.

## Output format (the UI turns each "## Món" into a card with a copy button, follow it exactly)

```
## Món: <dish name>
**Tên gợi ý:** <optional catchier name, keep the original name too>
**Menu in:** <one line, at most 15 words, for the printed menu>
**Mô tả app giao đồ ăn:** <2 to 3 sentences, 35 to 60 words: texture, flavour, portion, who it suits>
**Caption mạng xã hội:** <2 to 4 short lines with 1 or 2 emoji and a call to action>
**Gợi ý ăn kèm:** <one pairing from the same list if it makes sense>

## Món: <next dish>
…

---
**Gợi ý trình bày menu:** 3 to 5 bullets (thứ tự món, món nên làm nổi bật, cách đặt tên combo…).
```

## How to write

- Make people taste it: concrete sensory words (giòn rụm, béo ngậy, thơm mùi than hoa, nước dùng ngọt thanh) instead of empty praise like "ngon tuyệt".
- Match the restaurant style: bình dân thì gần gũi, cao cấp thì tinh tế, quán trẻ thì vui và bắt trend.
- Delivery app copy mentions portion and who it suits (ăn một mình, 2 người, nhóm), because buyers cannot see the dish.
- Keep each dish distinct: do not reuse the same adjectives across dishes.
- **Không dùng dấu gạch ngang** để nối ý: dùng dấu phẩy, dấu chấm hoặc dấu hai chấm.
