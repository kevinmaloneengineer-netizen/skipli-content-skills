import { channelPromptWithIds } from "./prompts.mjs";
import { fetchReviews } from "./sources/maps.mjs";

/**
 * Work the server does before handing a job to the agent. Only used when the
 * optional Apify backup is configured: for a "100 latest reels" channel scan it
 * fetches the reel list (sources/facebook.mjs) and bakes the IDs into the prompt.
 * Without it - or if the call fails - the plain prompt is used and the skill
 * pages the reels itself for free (a failure adds a notice, never fails the job).
 *
 * @returns {Promise<{ prompt: string, notice?: string }>}
 */
/** Google Maps: collect recent reviews in the Chrome sidecar, count stars, send a trimmed sample. */
async function mapsPrompt(input, { setPhase, signal }) {
  await setPhase("Đang mở Google Maps…");
  const place = await fetchReviews(input.place, { max: 80, signal, onProgress: setPhase });
  if (!place.reviews.length) throw new Error(`Không đọc được bài đánh giá nào của ${place.name}.`);
  await setPhase(`Đã đọc ${place.reviews.length} đánh giá của ${place.name}, AI đang phân tích…`);
  const stars = [5, 4, 3, 2, 1].map((n) => `${n} sao: ${place.reviews.filter((r) => r.stars === n).length}`).join(", ");
  const all = Object.keys(place.starCounts ?? {}).length ? [5, 4, 3, 2, 1].map((n) => `${n} sao: ${place.starCounts[n] ?? 0}`).join(", ") : "";
  // Keep every low-star review (the complaints matter most) and fill the rest with the longest ones, inside the token budget.
  const withText = place.reviews.filter((r) => r.text);
  const low = withText.filter((r) => r.stars && r.stars <= 3);
  const high = withText.filter((r) => !r.stars || r.stars > 3).sort((a, b) => b.text.length - a.text.length);
  const sample = [...low.slice(0, 18), ...high].slice(0, 40);
  const lines = sample.map((r) => `- (${r.stars ?? "?"} sao, ${r.when}) ${r.text.slice(0, 170)}`);
  const prompt = [
    "Phân tích đánh giá Google Maps của quán dưới đây theo skill review-analyzer, bằng tiếng Việt.",
    `Quán: ${place.name}${place.address ? ` (${place.address})` : ""}. Điểm: ${place.rating || "?"} sao trên ${place.total || "?"} lượt đánh giá.`,
    all ? `Phân bố số sao trên TOÀN BỘ đánh giá của Google (dùng cho bảng "Phân bố số sao"): ${all}.` : "",
    `Đã đọc ${place.reviews.length} bài gần đây. Phân bố số sao trong các bài đã đọc: ${stars}. Có ${withText.length} bài có chữ, dưới đây là ${sample.length} bài tiêu biểu (giữ hết bài từ 3 sao trở xuống):`,
    lines.join("\n"),
    `"Số bài nhắc" là số bài trong ${place.reviews.length} bài đã đọc có nhắc tới ý đó: phải là số nguyên, KHÔNG lớn hơn ${place.reviews.length}, không ghi "~" hay "khoảng".`,
    input.focus ? `Người dùng muốn chú ý thêm: ${input.focus}` : "",
  ].filter(Boolean).join("\n\n");
  // The result page draws the scorecard from these numbers rather than from the AI's text.
  const counts = Object.keys(place.starCounts ?? {}).length ? place.starCounts : Object.fromEntries([5, 4, 3, 2, 1].map((n) => [n, place.reviews.filter((r) => r.stars === n).length]));
  return { prompt, fields: { place: { name: place.name, rating: place.rating, total: place.total, address: place.address, url: place.url, starCounts: counts, read: place.reviews.length } } };
}

export function createPreparer({ facebook, mock = false, log = console }) {
  return async function prepare(job, { setPhase, signal }) {
    const input = job.input ?? {};
    // Demo mode answers from canned replies: do not open Chrome.
    if (job.type === "maps") return mock ? { prompt: job.prompt || job.title } : mapsPrompt(input, { setPhase, signal });
    if (job.type !== "fb-reels" || input.mode !== "channel" || input.depth !== 100) return { prompt: job.prompt };

    if (!facebook.enabled) return { prompt: job.prompt }; // default: the skill pages the reels itself, free
    await setPhase("Đang lấy danh sách 100 reel mới nhất…");
    try {
      const { ids, cached } = await facebook.latestReelIds(input.url, 100, { signal });
      if (!ids.length) {
        return { prompt: job.prompt, notice: "Nguồn dữ liệu dự phòng không trả về reel nào, đã chuyển sang quét trực tiếp." };
      }
      await setPhase(`Đã có ${ids.length} reel${cached ? " (từ bộ nhớ đệm)" : ""}. AI đang xếp hạng và xem video…`);
      return { prompt: channelPromptWithIds(input, ids) };
    } catch (e) {
      if (signal?.aborted) throw e;
      log.warn?.(`prepare ${job.id}: reel list failed: ${e.message}`);
      return { prompt: job.prompt, notice: `Nguồn dữ liệu dự phòng lỗi (${e.message}), đã chuyển sang quét trực tiếp.` };
    }
  };
}
