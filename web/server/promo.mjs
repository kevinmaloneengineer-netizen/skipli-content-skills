// "Gợi ý khuyến mãi có tính lãi": the model only says WHAT each promotion is (dishes, free gifts, one price);
// every amount on the page (normal price, cost, profit, margin) is computed here from the owner's own dish
// table, never by the model.

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "65.000đ", "65k", "65,000", "$14.95" → a number (null when there is none). */
export function parseMoney(text, usd = false) {
  const s = String(text ?? "").trim().toLowerCase();
  if (!/\d/.test(s)) return null;
  if (usd) {
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const k = /\d\s*k\b/.test(s);
  const n = Number(s.replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return k ? n * 1000 : n;
}

/**
 * The owner's dish table, one dish per line: "Tên món - giá bán - giá vốn" (cost optional).
 * → { dishes: [{ name, price, cost }], usd }
 */
export function parseDishTable(text) {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  // Dollars when a "$" is written, or when every price is under 1,000 with no "k"/"đ" ("Deep dish - 32 - 11"):
  // no Vietnamese dish costs under 1.000đ.
  const prices = lines.map((l) => l.split(/\s+[-–|]\s+/)[1]).filter(Boolean);
  const usd = lines.some((l) => l.includes("$")) || (prices.length > 0 && !lines.some((l) => /\d\s*k\b|đ|vnd/i.test(l)) && prices.every((p) => (parseMoney(p) ?? 0) < 1000));
  const dishes = [];
  for (const line of lines.slice(0, 40)) {
    const [name, price, cost] = line.split(/\s+[-–|]\s+/).map((x) => x.trim());
    const p = parseMoney(price, usd);
    if (!name || !p) continue;
    const c = parseMoney(cost, usd);
    dishes.push({ name: name.slice(0, 80), price: p, cost: c && c < p ? c : null });
  }
  return { dishes, usd };
}

export const money = (n, usd) => (usd ? `$${n.toFixed(2)}` : `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`);

/** The promotions the model proposed, checked against the dish table, with their money worked out. */
export function promoMath(answer, { dishes, usd }) {
  const raw = String(answer ?? "");
  const json = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1] ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let promos = [];
  try {
    promos = JSON.parse(json).promos ?? [];
  } catch {
    return [];
  }
  const find = (name) => dishes.find((d) => norm(d.name) === norm(name)) ?? dishes.find((d) => norm(name) && (norm(d.name).includes(norm(name)) || norm(name).includes(norm(d.name))));
  const lines = (list) =>
    (Array.isArray(list) ? list : [])
      .map((x) => ({ dish: find(x?.dish), qty: Math.min(10, Math.max(1, Math.round(Number(x?.qty) || 1))) }))
      .filter((x) => x.dish);
  const out = [];
  for (const p of promos.slice(0, 5)) {
    const items = lines(p.items);
    const gift = lines(p.gift);
    // A promotion naming a dish that is not on the owner's list is dropped, never priced from a guess.
    if (!items.length || items.length !== (p.items ?? []).length || gift.length !== (p.gift ?? []).length) continue;
    const all = [...items, ...gift];
    const normal = all.reduce((a, x) => a + x.dish.price * x.qty, 0);
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0 || price >= normal) continue;
    const missing = all.filter((x) => x.dish.cost == null).map((x) => x.dish.name);
    const cost = missing.length ? null : all.reduce((a, x) => a + x.dish.cost * x.qty, 0);
    const paidCost = items.some((x) => x.dish.cost == null) ? null : items.reduce((a, x) => a + x.dish.cost * x.qty, 0);
    const paidNormal = items.reduce((a, x) => a + x.dish.price * x.qty, 0);
    out.push({
      title: String(p.title ?? "Khuyến mãi").slice(0, 80),
      when: String(p.when ?? "").slice(0, 160),
      why: String(p.why ?? "").slice(0, 300),
      post: String(p.post ?? "").slice(0, 300),
      items,
      gift,
      normal,
      price,
      off: 1 - price / normal,
      cost,
      profit: cost == null ? null : price - cost,
      // What the paid dishes alone earn at the menu price, without the promotion.
      usual: paidCost == null ? null : paidNormal - paidCost,
      missing: [...new Set(missing)],
    });
  }
  return out.slice(0, 3);
}

const pct = (x) => `${Math.round(x * 100)}%`;
const listOf = (xs) => xs.map((x) => `${x.qty} ${x.dish.name}`).join(" + ");

/** The result page: one "## Phương án" per promotion, the numbers in a table. */
export function promoReport(answer, input) {
  const table = parseDishTable(input?.dishes);
  const promos = promoMath(answer, table);
  if (!promos.length) throw new Error("AI chưa đưa ra được khuyến mãi hợp lệ từ danh sách món. Bấm Chạy lại nhé.");
  const m = (n) => money(n, table.usd);
  const intro = "Giá thường, giá vốn và tiền lãi dưới đây do hệ thống tính từ đúng giá bạn nhập, không phải AI ước lượng. Kiểm tra lại trước khi áp dụng.";
  const parts = promos.map((p, i) => {
    const rows = [
      `| Giá thường | ${m(p.normal)} |`,
      `| Giá khuyến mãi | **${m(p.price)}** (giảm ${pct(p.off)}) |`,
      p.cost == null ? `| Giá vốn | chưa tính được, thiếu giá vốn của: ${p.missing.join(", ")} |` : `| Giá vốn | ${m(p.cost)} |`,
      p.profit == null ? "" : `| Lãi mỗi đơn | **${m(p.profit)}** (${pct(p.profit / p.price)} giá bán)${p.profit <= 0 ? " ⚠ lỗ" : ""} |`,
      p.usual == null || p.profit == null ? "" : `| Lãi nếu bán giá thường | ${m(p.usual)}${p.gift.length ? " (không kèm quà)" : ""} |`,
    ].filter(Boolean);
    return [
      `## Phương án ${i + 1}: ${p.title}`,
      `**Gồm:** ${listOf(p.items)}${p.gift.length ? ` · **Tặng:** ${listOf(p.gift)}` : ""}`,
      p.when ? `**Áp dụng:** ${p.when}` : "",
      "",
      "| | Số tiền |",
      "|---|---|",
      ...rows,
      "",
      p.why ? `**Vì sao:** ${p.why}` : "",
      p.post ? `**Câu quảng bá:** ${p.post}` : "",
    ].filter((l, k, arr) => l !== "" || (arr[k - 1] !== "" && k > 0)).join("\n");
  });
  return [intro, ...parts].join("\n\n");
}
