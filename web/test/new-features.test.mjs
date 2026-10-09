import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFacts } from "../server/facts.mjs";
import { buildJob, baseHashtags, cleanHashtags, directSkill, InputError } from "../server/prompts.mjs";
import { fixDashes, tidyMarkdown } from "../server/llm.mjs";
import { splitVariants } from "../client/src/lib/text.js";

test("checkFacts: keeps stated numbers, replaces invented ones, flags gifts", () => {
  const facts = "Combo 2 người 299k. Mở cửa 16h đến 23h. Giảm 10% hoá đơn";
  const md = "Combo chỉ 299.000đ, lẩu đặc biệt 450k, giảm 10% và giảm 20% hôm nay.\nMở cửa 11h đến 22h, tặng tô bún miễn phí.\nĐăng lúc 19:00\n> Gốc: abc · 👍 48.6K";
  const { text, replaced, warnings } = checkFacts(md, facts);
  assert.match(text, /299\.000đ/);
  assert.match(text, /lẩu đặc biệt \[GIÁ\]/);
  assert.match(text, /giảm 10%/);
  assert.match(text, /giảm \[ƯU ĐÃI\]/);
  assert.match(text, /Mở cửa \[GIỜ\] đến \[GIỜ\]/);
  assert.match(text, /Đăng lúc 19:00/); // posting times are not opening hours
  assert.match(text, /48\.6K/); // stat lines untouched
  assert.equal(replaced, 4);
  assert.deepEqual(warnings, ["tặng tô bún miễn phí"]);
});

test("hashtags: seeds from the user's words, drops wrong city, district, meaning, spam, duplicates", () => {
  const tags = baseHashtags("Quán lẩu bò bình dân", "Quận 3, TP.HCM");
  assert.ok(tags.includes("#laubo") && tags.includes("#quan3") && tags.includes("#saigon"));
  const out = cleanHashtags("#laubo #laubochay #quanhanoi #hoian #phunhuan #lauboquang3 #followforfollow #anngonquan5 #laubo #saigon", { business: "Quán lẩu bò bình dân", area: "Quận 3, TP.HCM" });
  assert.equal(out.trim(), "#laubo #saigon");
  assert.match(cleanHashtags("#laubochay", { business: "Quán lẩu chay", area: "" }), /#laubochay/); // vegetarian shop keeps it
});

test("tidyMarkdown and fixDashes", () => {
  assert.equal(tidyMarkdown("A  \n<link> https://x/  \n- a\n- Nội dung: • b • c"), "A  \nhttps://x/  \n\n- a\n- Nội dung:\n  - b\n  - c");
  assert.equal(fixDashes("16h‑23h · Thứ 2 – Thứ 6 · 2026‑07‑05 · Lẩu – ngon"), "16h đến 23h · Thứ 2 đến Thứ 6 · 2026‑07‑05 · Lẩu: ngon");
});

test("splitVariants: custom heading word and lead-in text", () => {
  const { variants, intro, rest } = splitVariants("Lead\n## Món: Lẩu\nA\n## Món: Gỏi\nB\n---\nNotes", "Món");
  assert.deepEqual(variants.map((v) => v.title), ["Lẩu", "Gỏi"]);
  assert.equal(intro, "Lead");
  assert.match(rest, /Notes/);
});

test("new job types build and validate", () => {
  assert.equal(directSkill(buildJob("review", { review: "Ngon", stars: 5 })), "review-replier");
  assert.throws(() => buildJob("review", {}), InputError);
  assert.equal(buildJob("menu", { dishes: "A\nB" }).direct, "menu-writer");
  assert.throws(() => buildJob("menu", { dishes: Array.from({ length: 13 }, (_, i) => `Món ${i}`).join("\n") }), /12 món/);
  assert.match(buildJob("inbox", { business: "Shop áo" }).prompt, /\[GIÁ\]/); // no prices given → placeholders
  assert.match(buildJob("hashtag", { business: "Quán lẩu bò", area: "Quận 3" }).prompt, /#laubo/);
  assert.deepEqual(buildJob("tiktok", { profiles: "tiktok.com/@abc, @def" }).input.profiles, ["@abc", "@def"]);
  assert.throws(() => buildJob("tiktok", {}), InputError);
  assert.throws(() => buildJob("maps", { place: "https://example.com/x" }), /Google Maps/);
  assert.equal(buildJob("maps", { place: "Lẩu bò Quận 3" }).direct, "review-analyzer");
  assert.throws(() => buildJob("compare", { urls: ["facebook.com/a"] }), /2 hoặc 3/);
  assert.equal(buildJob("compare", { urls: "facebook.com/a\nfacebook.com/b" }).input.urls.length, 2);
  const c = buildJob("campaign", { url: "facebook.com/doithu", topic: "Quán bún bò", start: "2026-10-12" });
  assert.equal(c.direct, "content-planner");
  assert.equal(c.input.days, 7);
  assert.throws(() => buildJob("campaign", { url: "facebook.com/reel/123456789", topic: "x", start: "2026-10-12" }), /không phải link một reel/);
});
