// Competitor watch: re-read each followed Facebook channel on a schedule (no model tokens) and, when
// it posted new reels, record a finished "watch" job. Finished jobs show up in the bell and history,
// so the user is told without any extra notification system.

import { randomUUID } from "node:crypto";
import { reelLine, runScript } from "./scanners.mjs";

const HOURS = Number(process.env.WATCH_INTERVAL_HOURS) || 168; // weekly
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

export function createWatcher({ store, log = console }) {
  let busy = false;

  /** Read the channel, compare with the reels seen last time, record a job when something is new. */
  async function check(item) {
    const data = await runScript("fb-reel-reader", "list_reels.py", [item.url, "--count", "30", "--stats", "--limit", "30"], { timeoutMs: 180_000 });
    const reels = data.reels ?? [];
    const known = new Set(item.knownIds);
    const fresh = item.lastCheckedAt ? reels.filter((r) => !known.has(r.id)) : []; // first check only sets the baseline
    const sorted = [...reels].map((r) => r.engagement ?? 0).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const viral = fresh.filter((r) => median && (r.engagement ?? 0) >= 3 * median);
    await store.updateWatch(item.id, { lastCheckedAt: new Date().toISOString(), knownIds: reels.map((r) => r.id).slice(0, 200), median, lastNew: fresh.length, lastError: null });
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
      id: randomUUID(), type: "watch", agent: null, direct: null,
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
