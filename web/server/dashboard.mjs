// Overview of every skill for the dashboard: runs, results, tokens and the last run, per job type.
// Competitor-watch rows are not skills, so they are left out.

const LIVE = new Set(["queued", "running", "review"]);

/**
 * @param {object[]} jobs      the jobs the viewer may see
 * @param {string}   today     the Vietnam calendar day of "now" (yyyy-mm-dd)
 * @param {(iso: string) => string} dayOf  the Vietnam calendar day of an ISO time
 */
export function dashboard(jobs, { today = "", dayOf = (iso) => String(iso).slice(0, 10) } = {}) {
  const byType = {};
  const totals = { runs: 0, today: 0, done: 0, failed: 0, live: 0, tokens: 0 };
  for (const j of jobs) {
    if (!j.type || j.type === "watch") continue;
    const t = (byType[j.type] ??= { runs: 0, done: 0, failed: 0, live: 0, tokens: 0, last: null });
    const tokens = Number(j.usage?.total_tokens) || 0;
    t.runs++;
    t.tokens += tokens;
    if (j.status === "done") t.done++;
    else if (j.status === "failed") t.failed++;
    else if (LIVE.has(j.status)) t.live++;
    if (!t.last || j.createdAt > t.last) t.last = j.createdAt;
    totals.runs++;
    totals.tokens += tokens;
    totals.done += j.status === "done" ? 1 : 0;
    totals.failed += j.status === "failed" ? 1 : 0;
    totals.live += LIVE.has(j.status) ? 1 : 0;
    if (today && j.createdAt && dayOf(j.createdAt) === today) totals.today++;
  }
  return { totals, byType };
}
