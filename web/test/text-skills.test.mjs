import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJob, InputError } from "../server/prompts.mjs";

test("dish-riddle, story-behind, weather-post: required fields checked, skill named", () => {
  assert.throws(() => buildJob("dish-riddle", { business: "Phở Cali" }), InputError);
  const riddle = buildJob("dish-riddle", { business: "Phở Cali", dish: "Phở bò tái", seen: "Tô nước nâu" });
  assert.equal(riddle.direct, "dish-riddle");
  assert.match(riddle.prompt, /Món cần đố: Phở bò tái/);

  assert.throws(() => buildJob("story-behind", { business: "Phở Cali" }), InputError);
  const story = buildJob("story-behind", { business: "Phở Cali", answers: "Học từ bà ngoại." });
  assert.equal(story.direct, "recipe-story");
  assert.match(story.prompt, /Học từ bà ngoại/);

  assert.throws(() => buildJob("weather-post", { business: "Phở Cali" }), InputError);
  const weather = buildJob("weather-post", { business: "Phở Cali", city: "Hà Nội" });
  assert.equal(weather.direct, "weather-post");
  assert.equal(weather.input.city, "Hà Nội");
});

test("video: the review checkbox reaches the job input of the narrated modes", () => {
  const off = buildJob("video", { mode: "topic", topic: "Phở bò", review: false });
  assert.equal(off.input.review, false);
  assert.equal(buildJob("video", { mode: "topic", topic: "Phở bò" }).input.review, true, "on by default");
});

test("post-score: the post is required and goes into the prompt between markers", () => {
  assert.throws(() => buildJob("post-score", { business: "Phở Cali" }), InputError);
  const job = buildJob("post-score", { post: "Phở ngon lắm, ghé nha!", platform: "Facebook" });
  assert.equal(job.direct, "post-scorer");
  assert.match(job.prompt, /<<<BÀI\nPhở ngon lắm, ghé nha!\nBÀI>>>/);
});

test("parseDishes: typed lines and an already parsed list (a retried job) give the same dishes", async () => {
  const { parseDishes } = await import("../server/prompts.mjs");
  const typed = parseDishes("Smoked Brisket - $24\nPork Spare Ribs - $21\nMac and Cheese - $7");
  assert.deepEqual(typed, [{ name: "Smoked Brisket", price: "$24" }, { name: "Pork Spare Ribs", price: "$21" }, { name: "Mac and Cheese", price: "$7" }]);
  assert.deepEqual(parseDishes(typed), typed);
  const retried = buildJob("video", { mode: "slideshow", topic: "Smokey Joe's BBQ", layout: "top3", dishes: typed });
  assert.deepEqual(retried.input.dishes, typed);
  assert.doesNotMatch(retried.prompt, /object Object/);
});

test("English input: post score, recipe story and dish riddle write the customer copy in English", () => {
  const post = buildJob("post-score", { post: "NEW!!! Detroit pizza at Slice Society. Come try it #pizza #chicago", business: "Slice Society" });
  assert.match(post.prompt, /NGÔN NGỮ: thông tin được nhập bằng tiếng Anh/);
  assert.equal(post.input.lang, "en");
  const story = buildJob("story-behind", { business: "La Güera Taqueria", answers: "Started as a food truck in 2014, her mom's al pastor marinade has eleven chiles." });
  assert.equal(story.input.lang, "en");
});
