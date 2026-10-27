// The "Đối thủ" page: every competitor the user looked at, gathered from the runs (reel scans, page
// analyses, compares, Google Maps and Yelp reviews, Instagram) and the weekly watch list, one card each.

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const url = (s) => {
  try {
    return new URL(String(s));
  } catch {
    return null;
  }
};

/** A Facebook page or profile link → { key, name, url }; a single reel or video → null. */
export function facebookOf(link) {
  const u = url(link);
  if (!u || !/(^|\.)facebook\.com$/i.test(u.hostname)) return null;
  const seg = u.pathname.split("/").filter(Boolean)[0] ?? "";
  if (seg === "profile.php") {
    const id = u.searchParams.get("id");
    return id ? { key: `fb:${id}`, name: id, url: `https://www.facebook.com/profile.php?id=${id}` } : null;
  }
  if (!seg || /^(reel|watch|share|videos|story\.php|groups|events)$/i.test(seg)) return null;
  return { key: `fb:${seg.toLowerCase()}`, name: seg, url: `https://www.facebook.com/${seg}/` };
}

/** A Google Maps place: by its place id when the link has one, else by name. */
export function mapsOf(link, name) {
  const id = url(link)?.searchParams.get("query_place_id");
  if (id) return { key: `maps:${id}`, name: name || "Quán trên Google Maps", url: link };
  const n = fold(name);
  return n ? { key: `maps:${n}`, name, url: url(link) ? link : "" } : null;
}

// Places a review compare read: the table the code wrote links each shop to its Google Maps page.
const comparedPlaces = (table) => [...String(table ?? "").matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]*query_place_id=[\w-]+[^)\s]*)\)/g)].map((m) => mapsOf(m[2], m[1]));

/** The competitors a run looked at. */
function targetsOf(job) {
  const i = job.input ?? {};
  switch (job.type) {
    case "fb-reels":
    case "fanpage":
    case "campaign":
    case "clone":
      return [facebookOf(i.url)];
    case "compare":
      return (i.urls ?? []).map(facebookOf);
    case "maps":
      return [job.place ? mapsOf(job.place.url, job.place.name) : null];
    case "review-compare":
      return comparedPlaces(job.researchTable);
    case "yelp": {
      const slug = String(i.url ?? "").split("/biz/")[1]?.split(/[?#/]/)[0];
      return [slug ? { key: `yelp:${slug.toLowerCase()}`, name: slug.replace(/-/g, " "), url: i.url } : null];
    }
    case "instagram":
      return [i.user ? { key: `ig:${String(i.user).toLowerCase()}`, name: `@${i.user}`, url: `https://www.instagram.com/${i.user}/` } : null];
    default:
      return [];
  }
}
const KIND = { fb: "facebook", maps: "maps", yelp: "yelp", ig: "instagram" };
const row = (j) => ({ id: j.id, type: j.type, title: j.title, createdAt: j.createdAt });

/**
 * One card per competitor, followed ones first, then the most recently looked at.
 * @returns {{ key, kind, name, url, watch: object|null, events: object[], runs: object[], lastAt: string }[]}
 */
export function competitorsOf(watches, jobs) {
  const cards = new Map();
  const byName = new Map(); // folded Maps name → key: older runs have no place id, only the name
  const card = (t) => {
    if (t.key.startsWith("maps:")) {
      const n = fold(t.name);
      if (!cards.has(t.key) && byName.has(n)) return cards.get(byName.get(n));
      if (n) byName.set(n, byName.get(n) ?? t.key);
    }
    if (!cards.has(t.key)) cards.set(t.key, { key: t.key, kind: KIND[t.key.split(":")[0]], name: t.name, url: t.url, watch: null, events: [], runs: [], lastAt: "" });
    return cards.get(t.key);
  };
  for (const w of watches) {
    const t = w.kind === "maps" ? mapsOf(w.url, w.name) : facebookOf(w.url);
    if (!t) continue;
    const c = card(t);
    c.watch = w;
    c.name = w.kind === "maps" ? w.name : `@${t.name}`;
    c.url = w.url;
  }
  const byWatch = new Map(watches.map((w) => [w.id, w]));
  const done = jobs.filter((j) => j.status === "done").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  for (const j of done) {
    // What the weekly watch recorded: new reels, new reviews.
    const w = byWatch.get(j.input?.watchId);
    if (w && (j.type === "watch" || j.type === "rating-watch")) {
      const t = w.kind === "maps" ? mapsOf(w.url, w.name) : facebookOf(w.url);
      if (t) card(t).events.push(row(j));
      continue;
    }
    for (const t of targetsOf(j)) {
      if (!t) continue;
      const c = card(t);
      if (!c.runs.some((r) => r.id === j.id)) c.runs.push(row(j));
      if (c.kind === "facebook" && !c.watch) c.name = `@${t.name}`;
    }
  }
  for (const c of cards.values()) {
    c.events = c.events.slice(0, 8);
    c.runs = c.runs.slice(0, 10);
    c.lastAt = [c.events[0]?.createdAt, c.runs[0]?.createdAt, c.watch?.lastCheckedAt, c.watch?.createdAt].filter(Boolean).sort().at(-1) ?? "";
  }
  return [...cards.values()].sort((a, b) => Number(!!b.watch) - Number(!!a.watch) || b.lastAt.localeCompare(a.lastAt));
}
