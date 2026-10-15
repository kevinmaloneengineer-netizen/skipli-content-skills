import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../server/dashboard.mjs";

test("dashboard: runs, results, tokens and the last run per skill; watch rows left out", () => {
  const jobs = [
    { type: "write", status: "done", createdAt: "2026-10-13T02:00:00Z", usage: { total_tokens: 1000 } },
    { type: "write", status: "failed", createdAt: "2026-10-12T02:00:00Z", usage: null },
    { type: "dub", status: "running", createdAt: "2026-10-13T03:00:00Z" },
    { type: "watch", status: "done", createdAt: "2026-10-13T04:00:00Z", usage: { total_tokens: 99 } },
  ];
  const d = dashboard(jobs, { today: "2026-10-13", dayOf: (iso) => iso.slice(0, 10) });
  assert.deepEqual(d.totals, { runs: 3, today: 2, done: 1, failed: 1, live: 1, tokens: 1000 });
  assert.deepEqual(d.byType.write, { runs: 2, done: 1, failed: 1, live: 0, tokens: 1000, last: "2026-10-13T02:00:00Z" });
  assert.equal(d.byType.dub.live, 1);
  assert.equal(d.byType.watch, undefined);
  assert.deepEqual(dashboard([]), { totals: { runs: 0, today: 0, done: 0, failed: 0, live: 0, tokens: 0 }, byType: {}, days: [], recent: [] });
  assert.equal(d.days.length, 14);
  assert.deepEqual(d.days.at(-1), { day: "2026-10-13", done: 1, failed: 0 });
  assert.deepEqual(d.days.at(-2), { day: "2026-10-12", done: 0, failed: 1 });
  assert.deepEqual(d.recent.map((j) => j.type), ["dub", "write", "write"], "newest first, watch rows left out");
});
