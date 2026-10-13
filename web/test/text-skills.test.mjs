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
