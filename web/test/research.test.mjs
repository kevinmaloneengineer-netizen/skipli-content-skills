import assert from "node:assert/strict";
import test from "node:test";
import { buildJob } from "../server/prompts.mjs";
import { aboutTerm, closingMinutes, compareTable, findMine, nearbyReport, trendsReport } from "../server/research.mjs";
import { cleanPlace } from "../server/sources/places.mjs";
import { createWatcher } from "../server/watcher.mjs";
import { costOf } from "../server/billing.mjs";

const place = (name, rating, reviews, extra = {}) => ({
  name, rating, reviews, stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: reviews }, price: "", category: "Pho restaurant", hours: [], tags: [], url: `https://www.google.com/maps/place/${name}`, ...extra,
});

test("research: closing times read from Google's opening hours", () => {
  assert.equal(closingMinutes("11 AM to 9 PM"), 21 * 60);
  assert.equal(closingMinutes("10:30 AM to 9:30 PM"), 21 * 60 + 30);
  assert.equal(closingMinutes("5 PM to 2 AM"), 26 * 60); // after midnight
  assert.equal(closingMinutes("11 AM to 12 AM"), 24 * 60);
  assert.equal(closingMinutes("Open 24 hours"), 24 * 60);
  assert.equal(closingMinutes("Closed"), null);
  assert.equal(closingMinutes("10:00–22:00"), 22 * 60);
});

test("research: the nearby table and its facts are counted here", () => {
  const places = [
    place("Pho 99", 4.6, 900, { hours: [{ day: "Friday", hours: "11 AM to 10 PM" }], price: "$10–20", stars: { 1: 50, 2: 40, 3: 60, 4: 150, 5: 600 }, tags: [{ title: "broth", count: 40 }] }),
    place("Pho Cali", 4.2, 120, { hours: [{ day: "Friday", hours: "11 AM to 9 PM" }], price: "$10–20", tags: [{ title: "broth", count: 5 }, { title: "spring rolls", count: 3 }] }),
    place("Saigon Bowl", 4.8, 60, { price: "$", stars: { 1: 1, 2: 0, 3: 1, 4: 8, 5: 50 } }),
  ];
  const { table, facts, stats } = nearbyReport(places, { mine: "pho cali" });
  assert.match(table, /\| 2 \| \[Pho Cali\]\(https:\/\/www\.google\.com\/maps\/place\/Pho Cali\) \*\*\(quán bạn\)\*\* \| 4,2 \| 120 \|/);
  assert.match(table, /\| 10% \| \$10–20 \| đến 22:00 \|/); // Pho 99: (50 + 40) / 900
  assert.equal(stats.count, 3);
  assert.equal(stats.avgRating, 4.5);
  assert.equal(stats.medianReviews, 120);
  assert.equal(stats.strongest.name, "Pho 99"); // Saigon Bowl rates higher but has fewer reviews than the median
  assert.deepEqual(stats.openLate.names, ["Pho 99"]);
  assert.equal(stats.pastMidnight.count, 0);
  assert.deepEqual(stats.mine, { name: "Pho Cali", rating: 4.2, reviews: 120, rankByRating: 3, rankByReviews: 2, lowShare: 0 });
  assert.equal(stats.topTags[0].title, "broth");
  assert.match(facts, /đứng thứ 3\/3 về số sao và thứ 2\/3 về lượt đánh giá/);
  assert.match(nearbyReport(places, { mine: "Pho Hoa" }).facts, /Không thấy quán "Pho Hoa"/);
  assert.equal(findMine(places, ""), -1);
});

test("research: Apify places are cleaned to the report fields", () => {
  const p = cleanPlace({ title: "Pho 99", totalScore: 4.6, reviewsCount: 900, reviewsDistribution: { oneStar: 5, twoStar: 1, threeStar: 2, fourStar: 10, fiveStar: 80 }, openingHours: [{ day: "Friday", hours: "11 AM to 10 PM" }], reviewsTags: [{ title: "broth", count: 4 }], permanentlyClosed: false });
  assert.equal(p.rating, 4.6);
  assert.deepEqual(p.stars, { 1: 5, 2: 1, 3: 2, 4: 10, 5: 80 });
  assert.equal(p.closed, false);
});

test("research: review compare table counts owner replies to 1-3 star reviews", () => {
  const { table, rows } = compareTable([
    { name: "Pho 99", url: "https://maps.google.com/x", rating: "4,6", total: "900", low: [{ stars: 1, ownerReplied: true }, { stars: 2, ownerReplied: false }, { stars: 4 }], high: [{ stars: 5 }], mine: false },
    { name: "Pho Cali", url: "", rating: "4,2", total: "120", low: [], high: [{ stars: 5 }], mine: true },
  ]);
  assert.equal(rows[0].readLow, 2);
  assert.equal(rows[0].replied, 50);
  assert.match(table, /Pho Cali \*\*\(quán bạn\)\*\* \| – \| 4,2 \| 120 \| 0 \| – \|/);
});

test("research: trends are counted per term, the running week left out, off-topic searches dropped", () => {
  const week = 7 * 86_400_000;
  const start = Date.UTC(2025, 9, 19);
  const series = (f) => Array.from({ length: 53 }, (_, i) => ({ start: start + i * week, label: "", value: f(i) }));
  const now = start + 52 * week + 2 * 86_400_000; // the 53rd week is still running
  const data = {
    series: { pho: series((i) => (i === 52 ? 0 : i < 4 ? 40 : i >= 48 ? 80 : 50)), ramen: series(() => 20) },
    states: [{ code: "US-HI", name: "Hawaii", values: [30, 70] }, { code: "US-TX", name: "Texas", values: [60, 40] }],
    related: { pho: { top: ["pho near me", "what is php"], rising: [{ query: "pho ga near me", growth: "Breakout" }, { query: "ipho", growth: "+700%" }] }, ramen: { top: [], rising: [] } },
  };
  const { table, facts, per } = trendsReport(["pho", "ramen"], data, { now, area: "Toàn nước Mỹ" });
  const pho = per[0];
  assert.equal(pho.recent, 80);
  assert.equal(pho.vsYearAgo, 100); // 80 against 40 a year ago
  assert.deepEqual(pho.top, ["pho near me"]);
  assert.deepEqual(pho.rising.map((q) => q.query), ["pho ga near me"]);
  assert.deepEqual(pho.states, ["Texas (60%)", "Hawaii (30%)"]);
  assert.equal(per[1].vsAvg, 0);
  assert.match(table, /\| pho \| \d+ \| 80 \| \+\d+% \| \+100% \|/);
  assert.match(facts, /Được tìm nhiều nhất trong 12 tháng: "pho"/);
  assert.ok(aboutTerm("banh mi near me", "banh mi"));
  assert.ok(!aboutTerm("what is php", "pho"));
});

test("research: inputs are checked before anything is read", () => {
  const nearby = buildJob("nearby", { query: "pho", location: "Milwaukee, WI", count: "25" });
  assert.deepEqual(nearby.input, { query: "pho", location: "Milwaukee, WI", mine: "", count: 25 });
  assert.throws(() => buildJob("nearby", { query: "pho" }), /Thiếu khu vực/);

  const cmp = buildJob("review-compare", { places: "https://maps.app.goo.gl/abc\nPho 99, Milwaukee WI", mine: "" });
  assert.equal(cmp.input.places.length, 2);
  assert.throws(() => buildJob("review-compare", { places: "Pho 99, Milwaukee" }), /ít nhất 2 quán/);
  assert.ok(buildJob("review-compare", { places: "Pho 99, Milwaukee", mine: "https://maps.app.goo.gl/abc" }));
  assert.throws(() => buildJob("review-compare", { places: "https://yelp.com/biz/x\nPho 99" }), /link Google Maps/);
  assert.throws(() => buildJob("review-compare", { places: "a\nb\nc\nd\ne" }), /Tối đa 4/);

  const trends = buildJob("trends", { terms: "pho, ramen", geo: "US-WI" });
  assert.deepEqual(trends.input, { terms: ["pho", "ramen"], geo: "US-WI", business: "" });
  assert.equal(buildJob("trends", { terms: "pho", geo: "XX" }).input.geo, "US");
  assert.throws(() => buildJob("trends", { terms: "" }), /ít nhất một/);
  assert.equal(costOf("nearby"), 2);
  assert.equal(costOf("review-compare"), 3);
  assert.equal(costOf("trends"), 2);
});

test("research: a watched Google Maps place records its stars and its new low reviews", async (t) => {
  process.env.APIFY_REVIEWS_TOKEN ||= "test-token";
  let reviewsCount = 100;
  const runs = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const u = String(url);
    const ok = (data) => new Response(JSON.stringify(data), { status: 200 });
    if (u.includes("/runs?")) {
      const body = JSON.parse(init.body);
      runs.push(u.includes("crawler-google-places") ? "place" : `reviews:${body.reviewsSort}:${body.maxReviews}`);
      return ok({ data: { id: `r${runs.length}`, status: "SUCCEEDED", defaultDatasetId: u.includes("crawler-google-places") ? "place" : "reviews" } });
    }
    if (u.includes("/datasets/place/")) return ok([{ title: "Pho 99", totalScore: reviewsCount > 100 ? 4.5 : 4.6, reviewsCount, url: "https://www.google.com/maps/place/Pho99" }]);
    if (u.includes("/datasets/reviews/")) return ok([{ reviewId: "a", stars: 2, text: "Cold broth", publishedAtDate: "2026-10-20T00:00:00Z" }, { reviewId: "b", stars: 5, text: "Great", publishedAtDate: "2026-10-21T00:00:00Z" }]);
    throw new Error(`unexpected ${u}`);
  });
  const watches = [{ id: "w1", kind: "maps", url: "https://maps.app.goo.gl/abc", name: "Quán trên Google Maps", history: [] }];
  const jobs = [];
  const store = {
    updateWatch: async (id, patch) => Object.assign(watches.find((w) => w.id === id), patch),
    addJob: async (j) => jobs.push(j),
  };
  const watcher = createWatcher({ store });
  assert.deepEqual(await watcher.check(watches[0]), { fresh: 0, low: 0 }); // first check: the baseline
  assert.equal(watches[0].name, "Pho 99");
  assert.equal(jobs.length, 0);
  reviewsCount = 102;
  assert.deepEqual(await watcher.check(watches[0]), { fresh: 2, low: 1 });
  assert.deepEqual(runs, ["place", "place", "reviews:newest:2"]);
  assert.equal(jobs[0].type, "rating-watch");
  assert.match(jobs[0].title, /Pho 99 · 2 đánh giá mới · 1 ít sao/);
  assert.match(jobs[0].result, /từ 4,6 thành \*\*4,5 sao\*\* \(▼ 0,1\)/);
  assert.match(jobs[0].result, /## Đánh giá mới 1-3 sao \(1\)\n- \(2 sao, 2026-10-20\) Cold broth/);
  assert.deepEqual(watches[0].history.map((h) => [h.rating, h.reviews, h.fresh, h.low]), [[4.6, 100, 0, 0], [4.5, 102, 2, 1]]);
});
