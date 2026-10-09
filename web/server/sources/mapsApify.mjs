// Google Maps reviews through Apify (compass/google-maps-reviews-scraper): the only reliable way to get
// both ends of the rating scale, since logged-out Google Maps hides sorting and serves ~5 to 10 reviews.
// Paid per review (about $0.0003 each); APIFY_REVIEWS_TOKEN is kept apart from APIFY_TOKEN, which
// turns on the paid Facebook reel list.

const ACTOR = process.env.APIFY_REVIEWS_ACTOR ?? "compass~google-maps-reviews-scraper";

export const apifyReviewsEnabled = () => !!process.env.APIFY_REVIEWS_TOKEN;

async function run(url, sort, max, signal) {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240&format=json&clean=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.APIFY_REVIEWS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startUrls: [{ url }], maxReviews: max, reviewsSort: sort, language: "vi", personalData: false }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(280_000)]) : AbortSignal.timeout(280_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) throw new Error(`Apify lỗi: ${data?.error?.message ?? res.statusText}`);
  return data;
}

const clean = (r) => ({
  id: r.reviewId,
  stars: Number(r.stars) || null,
  when: r.publishedAtDate ? r.publishedAtDate.slice(0, 10) : "",
  text: String(r.text ?? r.textTranslated ?? "").replace(/\s+/g, " ").trim(),
  ownerReplied: !!r.responseFromOwnerText,
});

/**
 * The lowest and the highest rated reviews of one place, read in parallel.
 * @param {string} place  a Google Maps link, or a name with area (searched on Maps)
 * @returns {{ name, rating, total, address, url, low: object[], high: object[] }}
 */
export async function fetchReviewsApify(place, { perSide = 30, signal } = {}) {
  const url = /^https?:\/\//i.test(place) ? place : `https://www.google.com/maps/search/${encodeURIComponent(place)}`;
  const [lowRaw, highRaw] = await Promise.all([run(url, "lowestRanking", perSide, signal), run(url, "highestRanking", perSide, signal)]);
  const info = lowRaw[0] ?? highRaw[0];
  if (!info) throw new Error("Không tìm thấy quán hoặc quán chưa có đánh giá. Hãy dán link Google Maps của quán.");
  const low = lowRaw.map(clean).filter((r) => r.text);
  const lowIds = new Set(low.map((r) => r.id));
  const high = highRaw.map(clean).filter((r) => r.text && !lowIds.has(r.id)); // small places: both lists can overlap
  return {
    name: info.title ?? "",
    rating: info.totalScore != null ? String(info.totalScore).replace(".", ",") : "",
    total: info.reviewsCount != null ? String(info.reviewsCount) : "",
    address: info.address ?? "",
    url: info.url ?? url,
    low,
    high,
  };
}
