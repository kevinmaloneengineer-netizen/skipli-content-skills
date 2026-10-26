// Competitor watch: re-read each followed Facebook channel on a schedule (no model tokens) and, when
// it posted new reels, record a finished "watch" job. Google Maps places (kind "maps") are watched the
// same way for their stars and new reviews ("rating-watch" jobs). Finished jobs show up in the bell and history,
// so the user is told without any extra notification system.

import { randomUUID } from "node:crypto";
import { reelLine, runScript } from "./scanners.mjs";
import { readPlace } from "./sources/places.mjs";
import { fetchNewestReviews } from "./sources/mapsApify.mjs";

const HOURS = Number(process.env.WATCH_INTERVAL_HOURS) || 168; // weekly
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

export function createWatcher({ store, log = console }) {
  let busy = false;

  /**
   * A Google Maps place: its stars and number of reviews; when reviews came in, read the new ones and
   * record a "rating-watch" job (the 1 to 3 star ones first, they are the ones to answer).
   */
  async function checkPlace(item) {
    const place = await readPlace(item.url);
    const prev = item.history?.at(-1);
    // A read without the numbers would be stored as 0 reviews, and the next one would report them all as new.
    if (place.rating == null || (!place.reviews && prev?.reviews)) throw new Error("Google Maps chưa trả về số sao và lượt đánh giá, sẽ thử lại sau.");
    const fresh = prev ? Math.max(0, place.reviews - prev.reviews) : 0; // first check only sets the baseline
    const reviews = fresh ? await fetchNewestReviews(item.url, Math.min(fresh, 20)) : [];
    const low = reviews.filter((r) => r.stars <= 3);
    const point = { at: new Date().toISOString(), rating: place.rating, reviews: place.reviews, fresh, low: low.length };
    const history = [...(item.history ?? []), point].slice(-52);
    await store.updateWatch(item.id, { name: place.name || item.name, lastCheckedAt: point.at, lastNew: fresh, lastError: null, history });
    const moved = prev && prev.rating != null && place.rating != null && place.rating !== prev.rating;
    if (!fresh && !moved) return { fresh: 0, low: 0 };

    const stars = (n) => String(n ?? "?").replace(".", ",");
    const line = (r) => `- (${r.stars} sao, ${r.when}${r.ownerReplied ? ", chủ quán đã trả lời" : ""}) ${r.text || "_(không có chữ)_"}`;
    const high = reviews.filter((r) => r.stars > 3);
    const result = [
      `**${place.name}** có **${fresh} đánh giá mới** kể từ lần kiểm tra trước.${moved ? ` Điểm Google đổi từ ${stars(prev.rating)} thành **${stars(place.rating)} sao** (${place.rating > prev.rating ? "▲" : "▼"} ${stars(Math.abs(Math.round((place.rating - prev.rating) * 10) / 10))}).` : ` Điểm vẫn là ${stars(place.rating)} sao.`}`,
      low.length ? `## Đánh giá mới 1-3 sao (${low.length})\n${low.map(line).join("\n")}` : "",
      high.length ? `## Đánh giá mới 4-5 sao (${high.length})\n${high.slice(0, 8).map(line).join("\n")}` : "",
      fresh > reviews.length ? `_Đã đọc ${reviews.length} trong ${fresh} đánh giá mới (mới nhất trước)._` : "",
      low.length ? "Nếu đây là quán của bạn, bấm **Trả lời review khách** để soạn câu trả lời cho các đánh giá ít sao." : "",
      place.url ? `[Mở quán trên Google Maps](${place.url})` : "",
    ].filter(Boolean).join("\n\n");
    const now = new Date().toISOString();
    await store.addJob({
      id: randomUUID(), ...(item.userId ? { userId: item.userId } : {}), type: "rating-watch", agent: null, direct: null,
      title: `Theo dõi sao · ${place.name} · ${fresh} đánh giá mới${low.length ? ` · ${low.length} ít sao` : ""}`.slice(0, 120),
      input: { url: item.url, watchId: item.id }, prompt: null, status: "done", result, error: null, usage: null,
      createdAt: now, startedAt: now, finishedAt: now,
    });
    return { fresh, low: low.length };
  }

  /** Read the channel, compare with the reels seen last time, record a job when something is new. */
  async function check(item) {
    if (item.kind === "maps") return checkPlace(item);
    const data = await runScript("fb-reel-reader", "list_reels.py", [item.url, "--count", "30", "--stats", "--limit", "30"], { timeoutMs: 180_000 });
    const reels = data.reels ?? [];
    const known = new Set(item.knownIds);
    const fresh = item.lastCheckedAt ? reels.filter((r) => !known.has(r.id)) : []; // first check only sets the baseline
    const sorted = [...reels].map((r) => r.engagement ?? 0).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const viral = fresh.filter((r) => median && (r.engagement ?? 0) >= 3 * median);
    // history: one point per good read, drawn as the trend chart on the Lịch sử page.
    const top = sorted.at(-1) ?? 0;
    const point = { at: new Date().toISOString(), median, top, count: reels.length, fresh: fresh.length, viral: viral.length };
    const history = [...(item.history ?? []), point].slice(-52);
    await store.updateWatch(item.id, { lastCheckedAt: point.at, knownIds: reels.map((r) => r.id).slice(0, 200), median, lastNew: fresh.length, lastError: null, history });
    if (!fresh.length) return { fresh: 0, viral: 0 };

    const ranked = [...viral, ...fresh.filter((r) => !viral.includes(r))].slice(0, 8);
    const result = [
      `Kênh @${item.name} vừa đăng **${fresh.length} reel mới** kể từ lần kiểm tra trước${viral.length ? `, trong đó **${viral.length} reel đang viral** (tương tác gấp 3 lần mức thường của kênh, ${fmt(median)})` : ""}.`,
      ...ranked.map((r, i) => {
        const [link, stats, caption] = reelLine(r, i, 240).split("\n");
        return `### ${i + 1}. ${viral.includes(r) ? "🔥 " : ""}${String(r.caption ?? "Reel mới").replace(/\s+/g, " ").slice(0, 70) || "Reel mới"}\n${stats.trim()}\n${r.url}\n- ${caption.trim().replace(/^caption:\s*/, "")}`;
      }),
      "Bấm **Viết content từ kết quả này** để AI viết bài học theo các reel đang chạy tốt.",
    ].join("\n\n");
    const now = new Date().toISOString();
    await store.addJob({
      id: randomUUID(), ...(item.userId ? { userId: item.userId } : {}), type: "watch", agent: null, direct: null,
      title: `Theo dõi @${item.name} · ${fresh.length} reel mới${viral.length ? ` · ${viral.length} viral` : ""}`,
      input: { url: item.url, watchId: item.id }, prompt: null, status: "done", result, error: null, usage: null,
      createdAt: now, startedAt: now, finishedAt: now,
    });
    return { fresh: fresh.length, viral: viral.length };
  }

  /** One pass over the channels that are due. Runs one channel at a time: Facebook dislikes bursts. */
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const since = (iso) => (iso ? Date.now() - Date.parse(iso) : Infinity);
      // Due when the last good read is older than the interval; after a failure wait 6 hours before retrying.
      const due = store.listWatch().filter((w) => since(w.lastCheckedAt) >= HOURS * 3600_000 && since(w.lastAttemptAt) >= 6 * 3600_000);
      for (const item of due) {
        try {
          await check(item);
        } catch (e) {
          log.warn?.(`watch ${item.url}: ${e.message}`);
          // Not lastCheckedAt: without a good read there is no baseline, and old reels would look new next time.
          await store.updateWatch(item.id, { lastError: e.message, lastAttemptAt: new Date().toISOString() });
        }
      }
    } finally {
      busy = false;
    }
  }

  return {
    start() {
      setTimeout(tick, 60_000).unref();
      setInterval(tick, 3600_000).unref(); // hourly look for due channels
    },
    check,
  };
}
