// Google Trends through Apify (datasteady/google-trends-scraper; the official Apify actor timed out and
// only takes countries). Two runs side by side: the terms together (one 0 to 100 scale, so they can be
// compared, plus the US states) and each term alone (its own related searches).

import { runActor } from "./apify.mjs";

const ACTOR = process.env.APIFY_TRENDS_ACTOR ?? "datasteady~google-trends-scraper";

const run = (terms, geo, isMultiple, signal) =>
  runActor({ actor: ACTOR, token: process.env.APIFY_REVIEWS_TOKEN, timeoutSecs: 300, signal, input: { searchTerms: terms, geo, timeRange: "", isMultiple, includeGeo: isMultiple, includeRelated: !isMultiple } });

// Keyed by the term in lower case (the actor may not keep the user's capitals).
/**
 * Weekly points of the last 12 months per term (one shared 0 to 100 scale), the states (each state's
 * split between the terms, in the order of `terms`) and the related searches of each term.
 */
export async function fetchTrends(terms, geo, { signal } = {}) {
  const [together, alone] = await Promise.all([run(terms, geo, true, signal), run(terms, geo, false, signal)]);
  const series = Object.fromEntries(together.filter((it) => it.interestOverTime_timelineData?.length).map((it) => [String(it.searchTerm).toLowerCase(), it.interestOverTime_timelineData.map((w) => ({ start: Number(w.time) * 1000, label: w.formattedAxisTime, value: w.value?.[0] ?? 0 }))]));
  if (!Object.keys(series).length) throw new Error("Google Trends chưa trả về số liệu. Thử lại sau ít phút hoặc đổi từ khoá.");
  const states = (together[0].interestBySubregion ?? []).map((s) => ({ code: s.geoCode, name: s.geoName, values: s.value }));
  const related = Object.fromEntries(alone.map((it) => [String(it.searchTerm).toLowerCase(), {
    top: (it.relatedQueries_top ?? []).map((q) => q.query),
    rising: (it.relatedQueries_rising ?? []).map((q) => ({ query: q.query, growth: q.formattedValue })),
  }]));
  return { series, states, related };
}
