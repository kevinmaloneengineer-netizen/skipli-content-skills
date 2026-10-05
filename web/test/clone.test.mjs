import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJob, InputError } from "../server/prompts.mjs";
import { mockReply } from "../server/mock.mjs";
import { splitClonePosts } from "../client/src/lib/text.js";

test("clone from a channel link runs on the scout agent and reads 30 reels", () => {
  const j = buildJob("clone", { url: "facebook.com/doithu", topic: "Shop quà tặng", count: 6, pillars: ["educate", "sell"] });
  assert.equal(j.agent, "scout");
  assert.match(j.prompt, /^Nhân bản kênh: viết 6 bài Facebook MỚI/);
  assert.match(j.prompt, /list_reels\.py --count 30 --stats/);
  assert.match(j.prompt, /Chia đều các bài vào các nhóm: Giáo dục, Bán hàng\./);
  assert.equal(j.title, "Nhân bản @doithu · Shop quà tặng");
  assert.deepEqual(j.input.pillars, ["educate", "sell"]);
});

test("clone from pasted posts runs on the writer agent and wraps the posts", () => {
  const j = buildJob("clone", { source: "posts", posts: "Bài A\n\n---\n\nBài B", topic: "Quán cà phê" });
  assert.equal(j.agent, "writer");
  assert.match(j.prompt, /<<<BÀI GỐC\nBài A\n\n---\n\nBài B\nBÀI GỐC>>>/);
  assert.equal(j.input.count, 9, "default 9 posts");
  assert.equal(j.input.pillars.length, 4, "all pillars by default");
});

test("clone validates its input", () => {
  assert.throws(() => buildJob("clone", { url: "facebook.com/x" }), InputError, "topic required");
  assert.throws(() => buildJob("clone", { url: "facebook.com/reel/1234567890", topic: "x" }), /không phải link một reel/);
  assert.throws(() => buildJob("clone", { source: "posts", posts: " ", topic: "x" }), InputError);
  assert.throws(() => buildJob("clone", { url: "facebook.com/x", topic: "x", count: 40 }), InputError);
  assert.throws(() => buildJob("clone", { url: "facebook.com/x", topic: "x", pillars: ["memes"] }), InputError);
  assert.throws(() => buildJob("clone", { url: "facebook.com/x", topic: "x", platform: "ads" }), InputError);
});

test("clone answer splits into pillar posts with their source line", async () => {
  const { content } = await mockReply({ kind: "clone", prompt: "", delayMs: 0 });
  const { intro, posts, notes } = splitClonePosts(content);
  assert.match(intro, /^Đã đọc 30 bài/);
  assert.deepEqual(posts.map((p) => p.pillar), ["entertain", "educate", "engage", "sell", "educate", "engage"]);
  assert.match(posts[0].source, /^video "một ngày làm việc"/);
  assert.doesNotMatch(posts[0].body, /Gốc:/);
  assert.match(notes, /Ghi chú/);
  assert.doesNotMatch(posts.at(-1).body, /Ghi chú/, "notes after --- are not part of the last post");
});

test("unknown pillar names land in 'other' instead of being dropped", () => {
  const { posts } = splitClonePosts("## Bài 1 · Truyền cảm hứng: Tiêu đề\nNội dung");
  assert.equal(posts[0].pillar, "other");
  assert.equal(posts[0].body, "Nội dung");
});
