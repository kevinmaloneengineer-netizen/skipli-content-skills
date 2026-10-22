---
name: promo-plan
description: Use this skill when a restaurant wants promotion ideas built from its own dishes, prices and food costs: "gợi ý khuyến mãi", "combo", "giờ vàng", "mua 2 tặng 1", with the profit of each promotion checked.
---

# Promotion Planner

Suggest promotions for a restaurant from its own dish list. The server computes the money (normal price, cost, profit) from your answer, so you only decide WHAT the promotion is. Never write money totals or percentages yourself.

## Input

The restaurant, the goal (fill quiet hours, raise the bill per order, launch a dish, bring customers back), a table of dishes with their selling price and, when known, their cost, and optionally limits from the owner.

## Output

Answer with ONE fenced JSON block and nothing else:

```json
{
  "promos": [
    {
      "title": "Combo trưa văn phòng",
      "kind": "combo",
      "items": [{ "dish": "Phở bò", "qty": 1 }, { "dish": "Trà đá", "qty": 1 }],
      "gift": [],
      "price": 65000,
      "when": "11h đến 14h, thứ Hai đến thứ Sáu",
      "why": "Giờ trưa khách văn phòng cần ăn nhanh, giá chẵn dễ nhớ.",
      "post": "Combo trưa: phở bò kèm trà đá chỉ 65.000đ, 11h đến 14h các ngày trong tuần."
    }
  ]
}
```

- Exactly 3 promotions, of 3 different kinds among: "combo" (several dishes for one price), "gift" (buy something, get a dish free: put the free dish in "gift"), "discount" (a lower price on one dish or a set at a quiet time), "bundle" (more of the same dish for a better price, e.g. 2 bowls).
- "items" are what the customer pays for, "gift" what they get free. Every "dish" must be copied EXACTLY from the dish table: no other dishes, no renamed dishes.
- "price" is the promotion price for the whole set (items, gift included), a plain number in the same unit as the table (VND: a whole number such as 65000; USD: a number such as 12.5). It must be lower than the normal price of the items and still above their total cost when costs are given: keep a real profit.
- Prefer round prices (VND: ending in 000; USD: ending in .00, .50 or .99).
- "when": the hours or days it runs, fitting the goal. "why": one sentence on why it works for this goal. "post": one short line the shop can post or put on a coupon, with the real price; Vietnamese unless the input is in English.
- Respect the owner's limits from the input (budget, dishes to avoid, days).
