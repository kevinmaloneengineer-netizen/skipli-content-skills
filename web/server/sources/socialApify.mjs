// Yelp reviews and Instagram posts through Apify (paid per item, billed to APIFY_REVIEWS_TOKEN like the
// Google Maps reviews). Yelp hides sorting from logged-out pages, and Instagram needs a login to page
// through a profile, so neither can be read for free the way the Facebook reels are.
//   Yelp:      delicious_zebu/yelp-reviews-scraper (lowest and highest rated, ~$0.001 a review). It also
//              returns the business card (rating, star histogram, address). The other Yelp actors either
//              ignore the sort or stop at 10 reviews on a free Apify plan.
//   Instagram: apify/instagram-post-scraper (~$0.0017 a post)

import { apifyReviewsEnabled } from "./mapsApify.mjs";

const YELP_ACTOR = process.env.APIFY_YELP_ACTOR ?? "delicious_zebu~yelp-reviews-scraper";
const IG_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR ?? "apify~instagram-post-scraper";

export const socialEnabled = apifyReviewsEnabled;

async function runActor(actor, input, signal) {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=240&format=json&clean=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.APIFY_REVIEWS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(280_000)]) : AbortSignal.timeout(280_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) throw new Error(`Apify lỗi: ${data?.error?.message ?? res.statusText}`);
  return data;
}

/** "https://www.yelp.com/biz/franklin-barbecue-austin?osq=…" → the canonical business URL. */
export function yelpUrl(raw) {
  const m = String(raw ?? "").match(/^https?:\/\/(?:[a-z]+\.)?yelp\.[a-z.]+\/biz\/([\w%-]+)/i);
  return m ? `https://www.yelp.com/biz/${m[1]}` : null;
}

const titleOf = (slug) => decodeURIComponent(slug).replace(/-\d+$/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/**
 * The lowest and highest rated Yelp reviews of one business, plus its rating and star histogram.
 * @returns {{ name, rating, total, address, url, starCounts, low: object[], high: object[] }}
 */
export async function fetchYelpReviews(url, { perSide = 30, signal } = {}) {
  const clean = (r) => ({ id: r.review_id, stars: Number(r.latest_reviewer_rating) || null, when: String(r.review_date ?? "").slice(0, 10), text: String(r.review_text ?? "").replace(/\s+/g, " ").trim(), ownerReplied: !!r.response_content });
  const side = (Sort) => runActor(YELP_ACTOR, { Urls: [url], Max_reviews: perSide, Sort, Rating: "All ratings" }, signal);
  const [lowRaw, highRaw] = await Promise.all([side("Lowest Rated"), side("Highest Rated")]);
  const low = lowRaw.map(clean).filter((r) => r.text).slice(0, perSide);
  const lowIds = new Set(low.map((r) => r.id));
  const high = highRaw.map(clean).filter((r) => r.text && !lowIds.has(r.id)).slice(0, perSide);
  if (!low.length && !high.length) throw new Error("Không đọc được review Yelp nào. Kiểm tra lại link trang quán trên Yelp.");
  const biz = lowRaw[0] ?? highRaw[0] ?? {};
  const counts = biz.review_counts_by_rating ?? {};
  const starCounts = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, Number(counts[`${n}stars`]) || 0]));
  const total = Object.values(starCounts).reduce((a, b) => a + b, 0);
  return {
    name: biz.business_name ?? titleOf(url.split("/biz/")[1]),
    rating: biz.average_rating ? String(biz.average_rating).replace(".", ",") : "",
    total: total ? String(total) : String(biz.total_reviews ?? ""),
    address: biz.business_address ?? "",
    url,
    starCounts: total ? starCounts : null,
    low,
    high,
  };
}

/** "@franklinbbq", "franklinbbq" or a profile link → "franklinbbq". */
export function instagramUser(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/instagram\.com\/([\w.]{1,30})\/?/i) ?? s.match(/^@?([\w.]{1,30})$/);
  const user = m?.[1];
  return user && !["p", "reel", "reels", "explore", "stories"].includes(user.toLowerCase()) ? user : null;
}

/**
 * Latest posts of a public Instagram profile, in the shape of list_reels.py ({ ok, reels: [...] }) so the
 * fanpage analyzer (analyze_reels.py) computes the same statistics. Likes count as reactions.
 */
export async function fetchInstagramPosts(user, { limit = 40, signal } = {}) {
  const raw = await runActor(IG_ACTOR, { username: [user], resultsLimit: limit, skipPinnedPosts: true, dataDetailLevel: "basicData" }, signal);
  const posts = raw.filter((p) => p.url && p.timestamp);
  if (!posts.length) throw new Error(`Không đọc được bài nào của @${user}. Tài khoản có thể riêng tư hoặc sai tên.`);
  const KIND = { Video: "video/reel", Image: "ảnh", Sidecar: "album nhiều ảnh" };
  return {
    name: posts[0].ownerFullName || user,
    data: {
      ok: true,
      count: posts.length,
      reels: posts.map((p) => ({
        id: p.id ?? p.shortCode,
        url: p.url,
        caption: p.caption ?? "",
        reactions: Number(p.likesCount) || 0, // hidden like counts come back as -1 or null
        comments: Number(p.commentsCount) || 0,
        shares: 0,
        plays: Number(p.videoViewCount ?? p.videoPlayCount) || null,
        duration: Number(p.videoDuration) || null,
        created_ts: Math.floor(Date.parse(p.timestamp) / 1000),
        kind: KIND[p.type] ?? p.type,
        code: p.shortCode ?? String(p.url).match(/\/(?:p|reel)\/([\w-]+)/)?.[1],
        image: p.displayUrl ?? null, // signed CDN link, expires within days: copied by prepare.mjs
      })),
    },
  };
}
