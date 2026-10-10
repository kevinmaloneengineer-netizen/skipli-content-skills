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

test("job phases: a counter phase updates in place, a new step is appended", async () => {
  const { createJobRunner } = await import("../server/jobs.mjs");
  const { openStore } = await import("../server/store/index.mjs");
  const { memoryAdapter } = await import("../server/store/memory.mjs");
  const store = await openStore(memoryAdapter());
  const goclaw = { mock: true, run: async () => ({ content: "xong", usage: null }) };
  const prepare = async (job, { setPhase }) => {
    await setPhase("Đang quét kênh…");
    await setPhase("AI đã xem 1/3 reel…");
    await setPhase("AI đã xem 2/3 reel…");
    await setPhase("AI đang viết…");
    return { prompt: "p" };
  };
  const runner = createJobRunner({ store, goclaw, agents: { writer: "w" }, concurrency: 1, timeoutMs: 1000, prepare, log: { error() {} } });
  const job = await runner.submit({ type: "fb-reels", agent: "writer", title: "t", input: {}, prompt: "p" });
  for (let i = 0; i < 50 && store.cachedJob(job.id).status !== "done"; i++) await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(store.cachedJob(job.id).phases.map((p) => p.text), ["Đang quét kênh…", "AI đã xem 2/3 reel…", "AI đang viết…"]);
});

test("fill blanks: finds [GIÁ]-style placeholders, skips markdown links, fills only what was typed", async () => {
  const { blanksOf, fillBlanks } = await import("../client/src/lib/edits.js");
  const md = "Combo [GIÁ], giảm [ƯU ĐÃI]. Lại [GIÁ] nữa. Đặt tại [LINK]. Xem [Menu](https://x.vn) hoặc [ghi chú].";
  assert.deepEqual(blanksOf(md), [{ name: "GIÁ", count: 2 }, { name: "ƯU ĐÃI", count: 1 }, { name: "LINK", count: 1 }]);
  assert.equal(fillBlanks(md, { "GIÁ": "299k", LINK: " " }), "Combo 299k, giảm [ƯU ĐÃI]. Lại 299k nữa. Đặt tại [LINK]. Xem [Menu](https://x.vn) hoặc [ghi chú].");
});

test("checkFacts (English): USD prices, am/pm hours, English placeholders and deals", () => {
  const facts = "Open 11am to 9pm. Family platter $59.";
  const { text, warnings } = checkFacts("Open from 11 am to 9pm, platter $59, ribs $24.99, 20% off! Gluten-free sides. Open until 10 pm. Post at 7pm.", facts);
  assert.match(text, /Open from 11 am to 9pm/);
  assert.match(text, /platter \$59, ribs \[PRICE\], \[DEAL\] off/);
  assert.match(text, /Open until \[HOURS\]\. Post at 7pm\./); // 7pm is not opening hours
  assert.deepEqual(warnings, []); // "Gluten-free" is not a free offer
  assert.match(checkFacts("Mở cửa từ 9h đến 22h tại quán", "").text, /\[GIỜ\] đến \[GIỜ\] tại/); // keeps the space
});

test("englishBlanks: renames Vietnamese placeholders only inside English lines", async () => {
  const { englishBlanks } = await import("../server/facts.mjs");
  const md = "## Tình huống: Price\nOur brisket is [GIÁ] per pound, call [SỐ ĐIỆN THOẠI].\nGhi chú: điền [GIÁ] thật.";
  assert.equal(englishBlanks(md), "## Tình huống: Price\nOur brisket is [PRICE] per pound, call [PHONE].\nGhi chú: điền [GIÁ] thật.");
  assert.deepEqual(checkFacts("Is there a gluten‑free side?", "").warnings, []);
});

test("video music mode: prompt asks for on-screen captions, the generator writes a track of the right length", async (t) => {
  const job = buildJob("video", { mode: "topic", topic: "Showcase of a Texas BBQ restaurant in Austin with brisket and ribs", seconds: 15, audio: "music" });
  assert.equal(job.input.audio, "music");
  assert.match(job.prompt, /KHÔNG có giọng đọc/);
  assert.equal(buildJob("video", { mode: "topic", topic: "Lẩu bò", seconds: 15 }).input.audio, "voice");

  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync("python3", ["-c", "import numpy"]);
  } catch {
    return t.skip("numpy not installed");
  }
  const { mkdtempSync, statSync } = await import("node:fs");
  const out = `${mkdtempSync(`${(await import("node:os")).tmpdir()}/music-`)}/m.wav`;
  execFileSync("python3", [new URL("../server/music/make_music.py", import.meta.url).pathname, out, "--seconds", "5", "--seed", "4"]);
  assert.ok(Math.abs(statSync(out).size - 44 - 5 * 44100 * 4) < 1000); // 5 s of 16-bit stereo
});

test("slideshow title card: name, city and address drawn into a transparent PNG", async (t) => {
  const job = buildJob("video", { mode: "slideshow", topic: "Vietnamese restaurant in Milwaukee: pho, banh mi", name: "Phở Cali", city: "Milwaukee, Wisconsin", address: "4756 S 27th St\nMilwaukee, WI 53221" }, { hasUpload: () => false });
  assert.equal(job.input.name, "Phở Cali");
  assert.equal(job.input.seconds, 15);
  assert.match(job.prompt, /Tên quán \(chỉ để biết món đặc trưng, KHÔNG đưa vào prompt\): Phở Cali/); // the server also strips it before drawing
  assert.match(job.prompt, /bên trong quán/);
  assert.match(job.prompt, /bên ngoài quán/);
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync("python3", ["-c", "import PIL"]);
  } catch {
    return t.skip("Pillow not installed");
  }
  const { mkdtempSync, writeFileSync, readFileSync } = await import("node:fs");
  const dir = mkdtempSync(`${(await import("node:os")).tmpdir()}/title-`);
  writeFileSync(`${dir}/s.json`, JSON.stringify({ width: 360, height: 640, name: job.input.name, city: job.input.city, address: job.input.address }));
  execFileSync("python3", [new URL("../server/overlay/make_title.py", import.meta.url).pathname, `${dir}/t.png`, `${dir}/s.json`]);
  assert.equal(readFileSync(`${dir}/t.png`).subarray(1, 4).toString(), "PNG");
});

test("slideshow with real photos: the image model only fills the missing slots", () => {
  const has = { hasUpload: () => true };
  const some = buildJob("video", { mode: "slideshow", topic: "Pho restaurant", photoIds: ["a.jpg", "b.jpg"] }, has);
  assert.equal(some.input.ai, 3);
  assert.match(some.prompt, /đã có 2 ảnh thật/);
  assert.match(some.prompt, /Viết đúng 3 ý tưởng ảnh VẼ THÊM/);
  const full = buildJob("video", { mode: "slideshow", topic: "Pho restaurant", photoIds: ["a", "b", "c", "d", "e", "f"] }, has);
  assert.equal(full.input.photoIds.length, 5); // 15 s = 5 slides
  assert.equal(full.input.ai, 0);
  assert.throws(() => buildJob("video", { mode: "slideshow", topic: "x", photoIds: ["gone.jpg"] }, { hasUpload: () => false }), /không còn/);
});
