import assert from "node:assert/strict";
import test from "node:test";
import { buildJob } from "../server/prompts.mjs";
import { occasionsOf, upcoming } from "../server/usDays.mjs";

const day = (y, name) => occasionsOf(y).find((o) => o.name === name)?.date.toISOString().slice(0, 10);

test("US occasions: rule-based holidays land on the right dates", () => {
  assert.equal(day(2026, "Thanksgiving"), "2026-11-26");
  assert.equal(day(2026, "Black Friday"), "2026-11-27");
  assert.equal(day(2027, "Thanksgiving"), "2027-11-25");
  assert.equal(day(2026, "Easter"), "2026-04-05");
  assert.equal(day(2027, "Easter"), "2027-03-28");
  assert.equal(day(2026, "Memorial Day"), "2026-05-25");
  assert.equal(day(2026, "Labor Day"), "2026-09-07");
  assert.equal(day(2027, "Martin Luther King Jr. Day"), "2027-01-18");
  assert.equal(day(2027, "Mother's Day"), "2027-05-09");
  assert.equal(day(2027, "Lunar New Year"), "2027-02-06");
});

test("US occasions: the window crosses the new year and is sorted", () => {
  const list = upcoming(new Date("2026-12-20"), 30);
  // 20/12/2026 + 30 days = 19/01/2027: MLK Day (18/01/2027) is in, National Pizza Day (09/02) is not.
  assert.deepEqual(list.map((o) => o.name), ["Christmas Eve", "Christmas Day", "New Year's Eve", "New Year's Day", "Martin Luther King Jr. Day"]);
  assert.ok(list.every((o, i) => i === 0 || list[i - 1].date <= o.date));
  assert.ok(list.some((o) => o.date === "2027-01-01"));
});

test("US skills: the occasions given to the model are the computed ones, with the dates", () => {
  const job = buildJob("us-occasions", { business: "Pho Cali", serves: "Pho, banh mi", days: "60" }, { now: () => new Date("2026-10-23") });
  assert.match(job.prompt, /2026-11-26: Thanksgiving \(holiday\)/);
  assert.match(job.prompt, /2026-11-03: National Sandwich Day \(unofficial National Food Day\)/);
  assert.equal(job.input.days, 60);
  assert.throws(() => buildJob("us-occasions", { business: "Pho Cali" }), /món quán bán/);
});

test("US skills: delivery menu and Nextdoor need their facts", () => {
  assert.equal(buildJob("delivery-menu", { business: "Pho Cali", dishes: "Phở Tái - $14.95", app: "doordash" }).input.app, "doordash");
  assert.throws(() => buildJob("delivery-menu", { business: "Pho Cali" }), /danh sách món/);
  assert.throws(() => buildJob("nextdoor-post", { business: "Pho Cali", neighborhood: "Bay View", goal: "offer" }), /thông tin thật/);
  assert.equal(buildJob("nextdoor-post", { business: "Pho Cali", neighborhood: "Bay View" }).input.goal, "intro");
});

test("US occasions: offers the shop never chose are taken out of the posts, unknown ingredients flagged", async () => {
  const { cleanOccasions } = await import("../server/usDays.mjs");
  const md = cleanOccasions(
    "**Bài đăng:** Thank you to all who have served. Enjoy a free spring roll with any pho.\n**Khuyến mãi gợi ý:** Free spring roll [OFFER]\n**Bài đăng:** Our bánh mì with crisp baguette and pork.",
    "Pho, spring rolls, banh mi",
  );
  assert.match(md, /\*\*Bài đăng:\*\* Thank you to all who have served\.\n/);
  assert.doesNotMatch(md.split("\n")[0], /free/i);
  assert.match(md, /Khuyến mãi gợi ý:\*\* Free spring roll \[OFFER\]/); // the idea line keeps its offer
  assert.match(md, /Kiểm tra lại: bài nhắc baguette, pork/);
  assert.match(md, /Đã bỏ 1 câu có ưu đãi/);
});

test("US occasions: offers worded around the filter are caught too", async () => {
  const { cleanOccasions } = await import("../server/usDays.mjs");
  for (const s of ["Today we're offering a special thank-you bowl of Pho for our veterans.", "Enjoy a special combo of Pho + Vietnamese iced coffee.", "Lunch is on us today.", "Grab the Black Friday deal."]) {
    assert.match(cleanOccasions(`**Bài đăng:** Thanks for coming. ${s}`, "Pho"), /Đã bỏ 1 câu/, s);
  }
  assert.doesNotMatch(cleanOccasions("**Bài đăng:** Warm up with our classic Pho tonight.", "Pho"), /Đã bỏ/);
});
