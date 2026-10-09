// TikTok videos without login or API key: find video links with a web search (DuckDuckGo HTML,
// "site:tiktok.com …"), then read each video page, which embeds its stats in the rehydration JSON.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const timed = (signal, ms) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms));
const VIDEO = /tiktok\.com\/@([\w.-]+)\/video\/(\d{15,20})/;

async function ddg(query, signal) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": UA }, signal: timed(signal, 20_000) });
  const page = await res.text();
  const urls = [];
  for (const m of page.matchAll(/uddg=([^&"]+)/g)) {
    const u = decodeURIComponent(m[1]);
    const v = u.match(VIDEO);
    if (v) urls.push(`https://www.tiktok.com/@${v[1]}/video/${v[2]}`);
  }
  return urls;
}

/**
 * Download a TikTok video to `file` (no login): the page carries the mp4 address, which only
 * plays with the cookies that same page response set.
 * @returns true when saved
 */
export async function downloadVideo(url, file, signal) {
  const { writeFile } = await import("node:fs/promises");
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9" }, signal: timed(signal, 20_000) });
  if (!res.ok) return false;
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const json = (await res.text()).match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return false;
  let video;
  try {
    video = JSON.parse(json).__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.video;
  } catch {
    return false;
  }
  const src = video?.playAddr || video?.downloadAddr;
  if (!src) return false;
  const media = await fetch(src, { headers: { "User-Agent": UA, Referer: "https://www.tiktok.com/", Cookie: cookies }, signal: timed(signal, 90_000) });
  if (!media.ok) return false;
  const buf = Buffer.from(await media.arrayBuffer());
  if (buf.length < 10_000 || buf.length > 150 * 1024 * 1024) return false;
  await writeFile(file, buf);
  return true;
}

/** Stats and caption of one video, or null when TikTok does not serve the data. */
export async function readVideo(url, signal) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9" }, signal: timed(signal, 20_000) });
  if (!res.ok) return null;
  const page = await res.text();
  const json = page.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return null;
  let item;
  try {
    item = JSON.parse(json).__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  } catch {
    return null;
  }
  if (!item?.id) return null;
  const s = item.statsV2 ?? item.stats ?? {};
  const n = (v) => Number(v) || 0;
  return {
    url: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
    id: item.id,
    author: item.author?.uniqueId ?? "",
    desc: (item.desc ?? "").replace(/\s+/g, " ").trim(),
    createdAt: item.createTime ? new Date(Number(item.createTime) * 1000).toISOString().slice(0, 10) : "",
    duration: n(item.video?.duration),
    music: item.music?.title ?? "",
    views: n(s.playCount),
    likes: n(s.diggCount),
    comments: n(s.commentCount),
    shares: n(s.shareCount),
    saves: n(s.collectCount),
  };
}

/**
 * Most-viewed videos for keywords and/or @accounts.
 * @returns {{ scanned: number, videos: object[] }} sorted by an engagement score
 */
export async function findVideos({ keywords = [], profiles = [], limit = 10, signal, onProgress }) {
  const queries = [...keywords.map((k) => `site:tiktok.com ${k}`), ...profiles.map((p) => `site:tiktok.com/@${p.replace(/^@/, "")} video`)];
  const seen = new Set();
  const urls = [];
  for (const q of queries) {
    for (const u of await ddg(q, signal).catch(() => [])) {
      const id = u.match(VIDEO)[2];
      if (!seen.has(id)) seen.add(id) && urls.push(u);
    }
  }
  if (!urls.length) return { scanned: 0, videos: [] };
  onProgress?.(`Tìm thấy ${urls.length} video, đang đọc số liệu…`);
  const videos = [];
  for (let i = 0; i < urls.length; i += 4) {
    const batch = await Promise.all(urls.slice(i, i + 4).map((u) => readVideo(u, signal).catch(() => null)));
    videos.push(...batch.filter(Boolean));
  }
  const score = (v) => v.likes + 2 * v.comments + 3 * v.shares + 2 * v.saves;
  videos.sort((a, b) => score(b) - score(a) || b.views - a.views);
  return { scanned: urls.length, videos: videos.slice(0, limit) };
}
