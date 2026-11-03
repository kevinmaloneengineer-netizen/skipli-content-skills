import assert from "node:assert/strict";
import test from "node:test";
import { buildJob, directSkill } from "../server/prompts.mjs";
import { aboutLengths } from "../server/about.mjs";
import { costOf } from "../server/billing.mjs";

test("shop about: needs the shop, the area and real facts; runs its own skill; English input writes English", () => {
  assert.throws(() => buildJob("shop-about", { business: "Phở Cali", area: "Quận 1" }), /thông tin thật/);
  assert.throws(() => buildJob("shop-about", { business: "Phở Cali", facts: "Phở bò" }), /khu vực/);
  const job = buildJob("shop-about", { business: "Phở Cali", area: "Quận 1, TP.HCM", facts: "Phở bò hầm xương 12 tiếng" });
  assert.equal(directSkill(job), "shop-about");
  assert.match(job.prompt, /Quận 1, TP\.HCM/);
  assert.equal(costOf("shop-about"), 1);
  const us = buildJob("shop-about", { business: "Pho Cali", area: "Bay View, Milwaukee", facts: "Family-owned pho shop since 2015, 12-hour beef broth, takeout and delivery" });
  assert.equal(us.input.lang, "en");
});

test("shop about: the character count is worked out here and an over-long text is flagged", () => {
  const long = "x".repeat(760);
  const out = aboutLengths(`## Google Business\n${long}\n\n## Facebook\nPhở bò Quận 1 🍜\n\n## Instagram\nok\n\n## Từ khoá đã dùng\n- phở`);
  assert.match(out, /^## Google Business · 760\/750 ký tự, dài quá, cắt bớt trước khi dán$/m);
  assert.match(out, /^## Facebook · 15\/101 ký tự$/m); // the emoji counts as one character
  assert.match(out, /^## Instagram · 2\/150 ký tự$/m);
  assert.match(out, /^## Từ khoá đã dùng$/m);
  assert.ok(out.includes(long));
});

test("language: an English text that names pho several times is still English; Vietnamese without accents is not", async () => {
  const { isEnglish } = await import("../server/prompts.mjs");
  assert.equal(isEnglish("Family-owned Vietnamese pho shop since 2015. 12-hour beef bone broth. Signature: rare beef pho, banh mi. Pho Cali"), true);
  assert.equal(isEnglish("quan lau bo ngon gia re"), false);
  assert.equal(isEnglish("pho bo tai ngon, quan gia re cho khach"), false);
  const us = buildJob("shop-about", { business: "Pho Cali", area: "Bay View, Milwaukee", facts: "Family-owned pho shop since 2015, rare beef pho, 12-hour broth, pho to go" });
  assert.equal(us.input.lang, "en");
  assert.match(us.prompt, /^Write the restaurant's about texts/);
  assert.match(us.prompt, /include the ## Yelp section/);
});
