// OPTIONAL backup source for the "100 latest reels" scan. The default path is
// free: the fb-reel-reader skill pages the public reels tab logged-out
// (list_reels.py --count 100). If APIFY_TOKEN is set, the server instead gets
// the reel list from Apify (actor "apify/facebook-reels-scraper") - useful if
// Facebook ever blocks the logged-out paging. Only reel IDs are used; the skill
// still fetches reactions/comments/shares itself. The token never reaches the agent.

const REEL_ID = /(?:\/reel\/|\/reels\/|\/videos\/(?:[^/?#]+\/)?|[?&]v=)(\d{8,20})/;
const APIFY_BASE = "https://api.apify.com/v2";

/** Pull reel IDs out of scraper items, whatever field the actor puts the link in. Keeps order, drops dupes. */
export function reelIdsFromItems(items) {
  const ids = [];
  const seen = new Set();
  for (const item of items ?? []) {
    const candidates = [item?.topLevelReelUrl, item?.shareable_url, item?.url, item?.reelUrl, item?.postUrl, item?.link];
    let id = candidates.map((u) => (typeof u === "string" ? u.match(REEL_ID)?.[1] : undefined)).find(Boolean);
    id ??= [item?.video?.id, item?.videoId, item?.id].map(String).find((v) => /^\d{8,20}$/.test(v));
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** One cache key per channel: host + first path segment (or profile.php?id=…), lowercased. */
export function channelKey(url) {
  const u = new URL(url);
  const id = u.searchParams.get("id");
  const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
  return `${u.hostname.replace(/^(www|m|web)\./, "")}/${first === "profile.php" && id ? `profile.php?id=${id}` : first}`.toLowerCase();
}

export function createFacebookSource({ apifyToken = "", actor = "apify~facebook-reels-scraper", cacheHours = 6, fetchImpl = fetch, log = console } = {}) {
  const cache = new Map(); // channelKey -> { at, ids }
  const ttl = cacheHours * 3600_000;

  async function fromApify(url, limit, signal) {
    const res = await fetchImpl(`${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?timeout=240&format=json&clean=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apifyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startUrls: [{ url }], resultsLimit: limit }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(270_000)]) : AbortSignal.timeout(270_000),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300);
      try {
        msg = JSON.parse(text)?.error?.message ?? msg;
      } catch {
        /* keep raw text */
      }
      throw new Error(`Apify ${res.status}: ${msg}`);
    }
    return reelIdsFromItems(JSON.parse(text));
  }

  return {
    /** True when the Apify backup is configured. */
    enabled: Boolean(apifyToken),

    /** Latest reel IDs of the channel at `url` (newest first, at most `limit`). Cached per channel. */
    async latestReelIds(url, limit = 100, { signal } = {}) {
      const key = channelKey(url);
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttl && hit.limit >= limit) { // a channel may simply have fewer reels than asked
        return { ids: hit.ids.slice(0, limit), cached: true };
      }
      if (!apifyToken) throw new Error("APIFY_TOKEN chưa được cấu hình");
      const ids = await fromApify(url, limit, signal);
      log.info?.(`facebook source: ${ids.length} reel IDs for ${key} (Apify)`);
      if (ids.length) cache.set(key, { at: Date.now(), ids, limit });
      return { ids, cached: false };
    },
  };
}
