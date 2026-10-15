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
  // The last `span` days (oldest first) with how many runs finished or failed, and the newest runs.
  const span = 14;
  const days = [];
  if (today) {
    const base = Date.parse(`${today}T00:00:00Z`);
    for (let k = span - 1; k >= 0; k--) days.push({ day: new Date(base - k * 86_400_000).toISOString().slice(0, 10), done: 0, failed: 0 });
    const at = Object.fromEntries(days.map((d, i) => [d.day, i]));
    for (const j of jobs) {
      if (!j.type || j.type === "watch" || !j.createdAt) continue;
      const i = at[dayOf(j.createdAt)];
      if (i === undefined) continue;
      if (j.status === "failed") days[i].failed++;
      else if (j.status === "done") days[i].done++;
    }
  }
  const recent = jobs
    .filter((j) => j.type && j.type !== "watch" && j.createdAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)
    .map((j) => ({ id: j.id, type: j.type, title: j.title ?? "", status: j.status, createdAt: j.createdAt }));
  return { totals, byType, days, recent };
}
