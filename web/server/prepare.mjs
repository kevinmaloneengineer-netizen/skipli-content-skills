import { channelPromptWithIds } from "./prompts.mjs";

/**
 * Work the server does before handing a job to the agent. Only used when the
 * optional Apify backup is configured: for a "100 latest reels" channel scan it
 * fetches the reel list (sources/facebook.mjs) and bakes the IDs into the prompt.
 * Without it - or if the call fails - the plain prompt is used and the skill
 * pages the reels itself for free (a failure adds a notice, never fails the job).
 *
 * @returns {Promise<{ prompt: string, notice?: string }>}
 */
export function createPreparer({ facebook, log = console }) {
  return async function prepare(job, { setPhase, signal }) {
    const input = job.input ?? {};
    if (job.type !== "fb-reels" || input.mode !== "channel" || input.depth !== 100) return { prompt: job.prompt };

    if (!facebook.enabled) return { prompt: job.prompt }; // default: the skill pages the reels itself, free
    await setPhase("Đang lấy danh sách 100 reel gần nhất…");
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
