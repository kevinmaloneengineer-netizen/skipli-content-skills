import { test } from "node:test";
import assert from "node:assert/strict";
import { channelKey, createFacebookSource, reelIdsFromItems } from "../server/sources/facebook.mjs";
import { createPreparer } from "../server/prepare.mjs";
import { buildJob } from "../server/prompts.mjs";

const quiet = { info() {}, warn() {} };

test("reelIdsFromItems reads ids from any link field, keeps order, drops dupes", () => {
  const items = [
    { topLevelReelUrl: "https://www.facebook.com/reel/1234567890123/" },
    { shareable_url: "https://www.facebook.com/natgeo/videos/9876543210987/" },
    { url: "https://www.facebook.com/watch/?v=5555555555555" },
    { video: { id: "4444444444444" } },
    { topLevelReelUrl: "https://www.facebook.com/reel/1234567890123/" }, // dupe
    { text: "no link at all" },
  ];
  assert.deepEqual(reelIdsFromItems(items), ["1234567890123", "9876543210987", "5555555555555", "4444444444444"]);
  assert.deepEqual(reelIdsFromItems(null), []);
});

test("channelKey normalises hosts and paths", () => {
  assert.equal(channelKey("https://www.facebook.com/Tony.G.Jung/reels/"), "facebook.com/tony.g.jung");
  assert.equal(channelKey("https://m.facebook.com/tony.g.jung"), "facebook.com/tony.g.jung");
  assert.equal(channelKey("https://www.facebook.com/profile.php?id=100012345&sk=reels_tab"), "facebook.com/profile.php?id=100012345");
});

test("Apify call: request shape, ids, and per-channel cache", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify([{ topLevelReelUrl: "https://www.facebook.com/reel/1111111111/" }, { topLevelReelUrl: "https://www.facebook.com/reel/2222222222/" }]), { status: 201 });
  };
  const fb = createFacebookSource({ apifyToken: "tok", fetchImpl, log: quiet });
  assert.equal(fb.enabled, true);
  const a = await fb.latestReelIds("https://www.facebook.com/abc/reels/", 100);
  assert.deepEqual(a, { ids: ["1111111111", "2222222222"], cached: false });
  assert.match(calls[0].url, /acts\/apify~facebook-reels-scraper\/run-sync-get-dataset-items/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(calls[0].init.body), { startUrls: [{ url: "https://www.facebook.com/abc/reels/" }], resultsLimit: 100 });
  const b = await fb.latestReelIds("https://facebook.com/ABC", 100);
  assert.equal(b.cached, true, "same channel served from cache");
  assert.equal(calls.length, 1);
});

test("Apify errors surface the provider message", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { type: "not-enough-usage", message: "Monthly usage limit exceeded" } }), { status: 402 });
  const fb = createFacebookSource({ apifyToken: "tok", fetchImpl, log: quiet });
  await assert.rejects(fb.latestReelIds("https://www.facebook.com/abc", 100), /Apify 402: Monthly usage limit exceeded/);
});

test("no token → disabled", async () => {
  const fb = createFacebookSource({ log: quiet });
  assert.equal(fb.enabled, false);
  await assert.rejects(fb.latestReelIds("https://www.facebook.com/abc", 100), /APIFY_TOKEN/);
});

const job = (input) => ({ id: "j", type: "fb-reels", ...buildJob("fb-reels", input) });

test("prepare: 100-reel scan bakes the ids into the prompt and reports phases", async () => {
  const phases = [];
  const facebook = { enabled: true, latestReelIds: async () => ({ ids: ["111111111", "222222222"], cached: false }) };
  const out = await createPreparer({ facebook, log: quiet })(job({ url: "facebook.com/abc", depth: 100 }), { setPhase: async (p) => phases.push(p) });
  assert.match(out.prompt, /Danh sách 2 reel gần nhất/);
  assert.match(out.prompt, /111111111,222222222/);
  assert.equal(out.notice, undefined);
  assert.equal(phases.length, 2);
});

test("prepare: falls back to the plain prompt with a notice", async () => {
  const j = job({ url: "facebook.com/abc", depth: 100 });
  const failing = { enabled: true, latestReelIds: async () => { throw new Error("Apify 402: limit"); } };
  const a = await createPreparer({ facebook: failing, log: quiet })(j, { setPhase: async () => {} });
  assert.equal(a.prompt, j.prompt);
  assert.match(a.notice, /Nguồn dữ liệu dự phòng lỗi \(Apify 402: limit\)/);

  const off = await createPreparer({ facebook: { enabled: false }, log: quiet })(j, { setPhase: async () => {} });
  assert.deepEqual(off, { prompt: j.prompt }, "no backup configured → skill pages the reels itself, no notice");

  const empty = await createPreparer({ facebook: { enabled: true, latestReelIds: async () => ({ ids: [] }) }, log: quiet })(j, { setPhase: async () => {} });
  assert.match(empty.notice, /không trả về reel/);
});

test("prepare: leaves other jobs alone (10-reel scan, single reel, other types)", async () => {
  const facebook = { enabled: true, latestReelIds: async () => assert.fail("must not be called") };
  const prepare = createPreparer({ facebook, log: quiet });
  for (const j of [job({ url: "facebook.com/abc", depth: 10 }), job({ url: "https://www.facebook.com/reel/1234567890" }), { type: "write", prompt: "p", input: {} }]) {
    const out = await prepare(j, { setPhase: async () => {} });
    assert.equal(out.prompt, j.prompt);
  }
});
