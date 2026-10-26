// Google Maps places through Apify (compass/crawler-google-places): the shops of one kind in one area
// ("pho" in "Milwaukee, WI"), or the current numbers of places given by link. Paid per place (about
// $0.004 each), on the same APIFY_REVIEWS_TOKEN as the Maps reviews.

import { runActor } from "./apify.mjs";

const ACTOR = process.env.APIFY_PLACES_ACTOR ?? "compass~crawler-google-places";

export const placesEnabled = () => !!process.env.APIFY_REVIEWS_TOKEN;

const run = (input, signal) => runActor({ actor: ACTOR, token: process.env.APIFY_REVIEWS_TOKEN, input, signal });

/** The fields the reports use, from one Apify place. */
export function cleanPlace(p) {
  const dist = p.reviewsDistribution ?? {};
  const stars = { 1: dist.oneStar ?? 0, 2: dist.twoStar ?? 0, 3: dist.threeStar ?? 0, 4: dist.fourStar ?? 0, 5: dist.fiveStar ?? 0 };
  return {
    name: String(p.title ?? "").trim(),
    rating: typeof p.totalScore === "number" ? p.totalScore : null,
    reviews: Number(p.reviewsCount) || 0,
    stars,
    price: p.price ?? "",
    category: p.categoryName ?? "",
    address: p.address ?? "",
    neighborhood: p.neighborhood ?? "",
    hours: (p.openingHours ?? []).map((h) => ({ day: h.day, hours: h.hours })),
    // What customers mention most on the place's page ("pho" 120, "broth" 45…).
    tags: (p.reviewsTags ?? []).slice(0, 8).map((t) => ({ title: t.title, count: t.count })),
    url: p.url ?? "",
    placeId: p.placeId ?? "",
    closed: !!(p.permanentlyClosed || p.temporarilyClosed),
    ad: !!p.isAdvertisement,
  };
}

/** Up to `max` places for a search ("pho") in an area ("Milwaukee, WI"), in Google's order, closed ones left out. */
export async function searchPlaces(query, location, { max = 15, language = "en", signal } = {}) {
  const items = await run({ searchStringsArray: [query], locationQuery: location, maxCrawledPlacesPerSearch: max, language, skipClosedPlaces: true }, signal);
  const seen = new Set();
  return items.map(cleanPlace).filter((p) => p.name && !p.closed && !seen.has(p.placeId || p.name) && seen.add(p.placeId || p.name));
}

/** The current numbers of one place from its Google Maps link (or "name, city"). */
export async function readPlace(place, { language = "en", signal } = {}) {
  const url = /^https?:\/\//i.test(place) ? place : `https://www.google.com/maps/search/${encodeURIComponent(place)}`;
  const [item] = await run({ startUrls: [{ url }], maxCrawledPlacesPerSearch: 1, language }, signal);
  if (!item) throw new Error("Không tìm thấy quán trên Google Maps. Hãy dán link Google Maps của quán.");
  return cleanPlace(item);
}

// Words every shop name may or may not carry: "Quán Ốc Oanh" is the place Google calls "Ốc Oanh - Vĩnh Khánh".
const GENERIC = new Set(["quan", "nha", "hang", "tiem", "cua", "the", "restaurant", "cafe", "kitchen", "and", "llc", "inc"]);
const words = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !GENERIC.has(w));

/** Whether a typed name and a Google Maps name are the same shop: every telling word of one is in the other. */
export function sameName(typed, found) {
  const a = words(typed), b = words(found);
  if (!a.length || !b.length) return false;
  return a.every((w) => b.includes(w)) || b.every((w) => a.includes(w));
}

/**
 * A Google Maps link for "name, area" ("Pho 99, Milwaukee WI"): searched in that area. A plain Maps search
 * by name has no area and picked a shop of the same name in another state (Harrisburg, PA). Links and
 * names without an area are kept as they are.
 */
export async function placeLink(text, { signal } = {}) {
  const s = String(text ?? "").trim();
  const comma = s.indexOf(",");
  if (/^https?:\/\//i.test(s) || comma < 1) return s;
  const name = s.slice(0, comma).trim();
  // Google fills the list with nearby shops when the name is not there: keep only a shop with that name.
  const hit = (await searchPlaces(name, s.slice(comma + 1).trim(), { max: 3, signal })).find((p) => sameName(name, p.name));
  if (!hit?.url) throw new Error(`Không tìm thấy "${s}" trên Google Maps. Hãy dán link Google Maps của quán.`);
  return hit.url;
}

/** Share of 1 and 2 star reviews, in percent (null without a histogram). */
export function lowShare(p) {
  const total = Object.values(p.stars ?? {}).reduce((a, b) => a + b, 0);
  return total ? Math.round(((p.stars[1] + p.stars[2]) / total) * 100) : null;
}
