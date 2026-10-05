import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJob, InputError } from "../server/prompts.mjs";

test("fb channel URL builds a channel scan prompt", () => {
  const j = buildJob("fb-reels", { url: "facebook.com/tony.g.jung/reels/", topic: "SEO", top: 5 });
  assert.equal(j.agent, "scout");
  assert.equal(j.input.url, "https://facebook.com/tony.g.jung/reels/");
  assert.match(j.prompt, /Quét 100 reel mới nhất của kênh Facebook https:\/\/facebook\.com\/tony\.g\.jung\/reels\/ \(list_reels\.py --count 100 --stats, không cần đăng nhập\) và chọn 5 reel tốt nhất về chủ đề "SEO"/);
  assert.equal(j.input.depth, 100, "default scan depth is 100");
  assert.match(buildJob("fb-reels", { url: "facebook.com/x", depth: 10 }).prompt, /Quét 10 reel gần nhất/);
  assert.match(j.title, /@tony\.g\.jung · SEO/);
});

test("fb single reel URL builds an analysis prompt", () => {
  for (const url of ["https://www.facebook.com/reel/1234567890", "https://fb.watch/abcDEF/", "https://www.facebook.com/x/videos/123/"]) {
    const j = buildJob("fb-reels", { url });
    assert.match(j.prompt, /^Phân tích nội dung reel/, url);
  }
});

test("fb rejects non-facebook URLs and bad counts", () => {
  assert.throws(() => buildJob("fb-reels", { url: "https://evil.example/facebook.com" }), InputError);
  assert.throws(() => buildJob("fb-reels", { url: "" }), InputError);
  assert.throws(() => buildJob("fb-reels", { url: "facebook.com/x", top: 50 }), InputError);
});

test("threads normalises keywords and accounts", () => {
  const j = buildJob("threads", { keywords: ["bán hàng online", " ", "bán hàng online"], profiles: ["https://www.threads.com/@zuck", "mosseri"], days: 30, top: 10 });
  assert.deepEqual(j.input.keywords, ["bán hàng online"]);
  assert.deepEqual(j.input.profiles, ["@zuck", "@mosseri"]);
  assert.match(j.prompt, /từ khoá "bán hàng online" và tài khoản @zuck, @mosseri trong 30 ngày/);
});

test("threads needs at least one source and caps counts", () => {
  assert.throws(() => buildJob("threads", { keywords: [], profiles: [] }), /ít nhất một/);
  assert.throws(() => buildJob("threads", { keywords: ["a", "b", "c", "d", "e"] }), /Tối đa 4/);
  assert.throws(() => buildJob("threads", { profiles: ["not valid!"] }), InputError);
});

test("write includes template, reference job and typed reference", () => {
  const template = { id: "t1", title: "PAS", body: "1. Problem" };
  const refJob = { id: "j1", status: "done", result: "REPORT TEXT" };
  const j = buildJob("write", { platform: "threads", topic: "Khoá học SEO", templateId: "t1", referenceJobId: "j1", reference: "bài mẫu" }, { template, refJob });
  assert.equal(j.agent, "writer");
  assert.match(j.prompt, /Viết 3 phương án content Threads/);
  assert.match(j.prompt, /Theo cấu trúc mẫu "PAS":\n1\. Problem/);
  assert.match(j.prompt, /<<<THAM KHẢO\nbài mẫu\n\nREPORT TEXT\nTHAM KHẢO>>>/);
  assert.equal(j.input.reference, "bài mẫu"); // typed text kept separately so retry rebuilds the same prompt
  assert.equal(j.input.referenceJobId, "j1");
  assert.equal(j.input.templateTitle, "PAS");
});

test("write validates topic, platform, template and reference job", () => {
  assert.throws(() => buildJob("write", { topic: "" }), /Thiếu chủ đề/);
  assert.throws(() => buildJob("write", { topic: "x", platform: "myspace" }), /Nền tảng/);
  assert.throws(() => buildJob("write", { topic: "x", templateId: "nope" }, {}), /mẫu/);
  assert.throws(() => buildJob("write", { topic: "x", referenceJobId: "j" }, {}), /tham khảo/);
  assert.throws(() => buildJob("write", { topic: "x", referenceJobId: "j" }, { refJob: { status: "running" } }), /tham khảo/);
});

test("unknown type is rejected", () => {
  assert.throws(() => buildJob("hack", {}), InputError);
});
