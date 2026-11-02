// "Gói chạy liền": a few tools run one after another, each step fed by the steps before it.
// The combo job itself costs nothing; every step is an ordinary job that takes (and on failure gives
// back) its own credits. A failed step does not stop the steps that do not need it.

import { InputError } from "./prompts.mjs";

const clip = (v, max) => String(v ?? "").trim().slice(0, max);

/** A "## Heading" section of a markdown report (null when missing). */
export function section(md, name) {
  const parts = String(md ?? "").split(/^(?=## )/m);
  const hit = parts.find((p) => p.toLowerCase().startsWith(`## ${name.toLowerCase()}`));
  return hit ? hit.split("\n").slice(1).join("\n").trim() : null;
}

/** "| Nước lẩu đậm đà | 24 |" table rows (or "- …" bullets) → ["Nước lẩu đậm đà (24 lượt nhắc)", …]. */
export function items(text, max = 5) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const row = line.match(/^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|/);
    if (row && !/^-+$/.test(row[1]) && !/điểm|số bài/i.test(row[1])) out.push(`${row[1]} (${row[2]} lượt nhắc)`);
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (!row && bullet) out.push(bullet[1].trim());
  }
  return out.slice(0, max);
}

/**
 * The first option of a promotion plan (server/promo.mjs), as plain facts for the posts after it: its name,
 * what it includes, when, the price the server worked out and its one-line pitch. Null when there is none.
 */
export function firstPromo(md) {
  const parts = String(md ?? "").split(/^(?=## )/m);
  const hit = parts.find((p) => /^## Phương án 1:/.test(p));
  if (!hit) return null;
  const title = hit.match(/^## Phương án 1:\s*(.+)/)?.[1]?.trim() ?? "";
  const plain = (t) => String(t ?? "").replace(/\*\*/g, "").trim();
  const line = (label) => plain(hit.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`))?.[1]);
  const price = plain(hit.match(/\|\s*Giá khuyến mãi\s*\|\s*(.+?)\s*\|/)?.[1]);
  const facts = [line("Gồm") && `Gồm: ${line("Gồm")}`, line("Áp dụng") && `Áp dụng: ${line("Áp dụng")}`, price && `Giá khuyến mãi: ${price}`, line("Câu quảng bá") && `Câu quảng bá: ${line("Câu quảng bá")}`].filter(Boolean);
  return title ? { title, facts: facts.join("\n") } : null;
}

/** "Phở Tái - $14.95 - rare beef" lines → "Phở Tái, Gỏi Cuốn, …" (names only, for "what the shop serves"). */
export const dishNames = (text, max = 8) =>
  String(text ?? "").split("\n").map((l) => l.split(/\s[-–|]\s/)[0].trim()).filter(Boolean).slice(0, max).join(", ");

/**
 * Each recipe: what it needs from the form, and its steps. A step's `input(c)` builds the tool input from
 * the combo input and the finished steps before it (c.steps[i] = { job, status }); null skips the step.
 */
export const RECIPES = {
  launch: {
    title: "Ra mắt món mới",
    form(raw, refs) {
      const photoId = String(raw.photoId ?? "");
      if (!photoId || !refs.hasUpload?.(photoId)) throw new InputError("Chọn ảnh món mới");
      const dish = clip(raw.dish, 120);
      const business = clip(raw.business, 120);
      if (!dish) throw new InputError("Nhập tên món mới");
      if (!business) throw new InputError("Nhập tên quán");
      return { photoId, dish, business, details: clip(raw.details, 600) };
    },
    steps: [
      { type: "photo-fix", title: "Chỉnh ảnh món", input: (c) => ({ photoId: c.input.photoId, look: "warm", ratios: ["1:1", "9:16"], label: c.input.dish }) },
      {
        type: "write",
        title: "Bài đăng Facebook",
        input: (c) => ({ platform: "facebook", topic: `${c.input.dish}: món mới của ${c.input.business}`, brief: c.input.details, variants: 3 }),
      },
      {
        type: "gbp-post",
        title: "Bài Google Business",
        input: (c) => ({ business: c.input.business, promote: `Món mới: ${c.input.dish}`, button: "order", details: c.input.details }),
      },
      {
        type: "video",
        title: "Video trình chiếu",
        needs: [0], // the photo, after the fix
        input: (c) => ({ mode: "slideshow", topic: `${c.input.business}: ${c.input.dish}`, photoIds: c.photoIds, seconds: 15, ratio: "9:16", name: c.input.business, layout: "collage", review: false }),
      },
    ],
  },
  care: {
    title: "Chăm khách tuần này",
    form(raw) {
      const place = clip(raw.place, 300);
      if (!place) throw new InputError("Nhập tên quán hoặc link Google Maps");
      const business = clip(raw.business, 120) || (/^https?:/i.test(place) ? "" : place);
      return { place, business };
    },
    steps: [
      { type: "maps", title: "Đọc review Google Maps", input: (c) => ({ place: c.input.place }) },
      {
        type: "review",
        title: "Trả lời các điểm khách chê",
        needs: [0],
        input(c) {
          const bad = items(section(c.steps[0].job.result, "Khách chê gì"));
          if (!bad.length) return null; // nothing to answer
          return { review: `Tổng hợp những điểm khách chê trên Google Maps gần đây: ${bad.join("; ")}.`, stars: 2, business: c.input.business, style: "Cầu thị, xin lỗi chân thành, nói rõ quán sẽ cải thiện" };
        },
      },
      {
        type: "gbp-post",
        title: "Bài Google Business từ điểm được khen",
        needs: [0],
        input(c) {
          const good = items(section(c.steps[0].job.result, "Khách khen gì"));
          if (!good.length) return null;
          return { business: c.input.business || "Quán", promote: `Những điều khách khen nhiều nhất: ${good.join("; ")}`, button: "learn" };
        },
      },
    ],
  },
  promo: {
    title: "Đẩy khuyến mãi",
    form(raw) {
      const business = clip(raw.business, 120);
      const dishes = clip(raw.dishes, 3000);
      if (!business) throw new InputError("Nhập tên quán");
      if (dishes.split("\n").filter((l) => l.trim()).length < 2) throw new InputError("Nhập ít nhất 2 món, mỗi dòng: Tên món - giá bán - giá vốn");
      const goal = ["slow", "bill", "launch", "return"].includes(raw.goal) ? raw.goal : "slow";
      return { business, dishes, goal, limits: clip(raw.limits, 500) };
    },
    steps: [
      { type: "promo-plan", title: "Lên khuyến mãi (có tính lãi)", input: (c) => ({ business: c.input.business, goal: c.input.goal, dishes: c.input.dishes, limits: c.input.limits }) },
      {
        type: "write",
        title: "Bài Facebook cho khuyến mãi",
        needs: [0],
        input(c) {
          const p = firstPromo(c.steps[0].job.result);
          if (!p) return null;
          return { platform: "facebook", topic: `Khuyến mãi "${p.title}" của ${c.input.business}`, brief: `Chỉ dùng đúng các thông tin này, không đổi giá:\n${p.facts}`, variants: 3 };
        },
      },
      {
        type: "zalo-message",
        title: "Tin Zalo báo khách quen",
        needs: [0],
        input(c) {
          const p = firstPromo(c.steps[0].job.result);
          return p && { business: c.input.business, goal: "offer", details: `${p.title}\n${p.facts}`, button: "offer" };
        },
      },
      {
        type: "gbp-post",
        title: "Bài Google Business",
        needs: [0],
        input(c) {
          const p = firstPromo(c.steps[0].job.result);
          return p && { business: c.input.business, promote: `Khuyến mãi: ${p.title}`, button: "offer", details: p.facts };
        },
      },
    ],
  },
  "us-launch": {
    title: "Ra mắt quán ở Mỹ",
    form(raw) {
      const business = clip(raw.business, 120);
      const neighborhood = clip(raw.neighborhood, 200);
      const dishes = clip(raw.dishes, 3000);
      if (!business) throw new InputError("Nhập tên quán");
      if (!neighborhood) throw new InputError("Nhập khu phố hoặc thành phố của quán");
      if (!dishes) throw new InputError("Nhập món của quán");
      const app = ["all", "doordash", "ubereats", "grubhub"].includes(raw.app) ? raw.app : "all";
      return { business, neighborhood, dishes, app, notes: clip(raw.notes, 600) };
    },
    steps: [
      { type: "delivery-menu", title: "Menu app giao đồ ăn", input: (c) => ({ business: c.input.business, app: c.input.app, dishes: c.input.dishes, notes: c.input.notes }) },
      { type: "nextdoor-post", title: "Bài Nextdoor chào hàng xóm", input: (c) => ({ business: c.input.business, neighborhood: c.input.neighborhood, goal: "intro", details: c.input.notes }) },
      { type: "us-occasions", title: "Ngày lễ Mỹ 60 ngày tới", input: (c) => ({ business: c.input.business, serves: dishNames(c.input.dishes), days: 60 }) },
    ],
  },
};

/** Credits the whole combo takes, at today's prices. */
export const comboCost = (recipe, costOf) => (RECIPES[recipe]?.steps ?? []).reduce((n, s) => n + costOf(s.type), 0);

/** POST /jobs { type: "combo", input: { recipe, … } } → the combo job spec. */
export function buildCombo(raw = {}, refs = {}) {
  const recipe = RECIPES[raw.recipe];
  if (!recipe) throw new InputError("Gói không hợp lệ");
  const input = { recipe: raw.recipe, ...recipe.form(raw, refs) };
  const what = input.dish ?? input.business ?? input.place;
  return { agent: "writer", title: `${recipe.title} · ${String(what).slice(0, 60)}`, input, prompt: "" };
}
