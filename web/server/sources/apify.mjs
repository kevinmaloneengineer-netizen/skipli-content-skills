// One Apify actor run, started and then followed, instead of one "run-sync" request held open for up to 4
// minutes: a network blip during that wait used to fail the whole scan ("fetch failed", the Yelp run of
// 23/10). Here each wait is a short request (at most 60 s) and a dropped one is simply asked again.

const BASE = "https://api.apify.com/v2";
const WAITING = new Set(["READY", "RUNNING", "TIMING-OUT", "ABORTING"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch + JSON, tried again on a network error (never on an HTTP answer). */
async function call(fetchFn, url, init, signal, tries) {
  for (let k = 0; ; k++) {
    try {
      const res = await fetchFn(url, { ...init, signal });
      return { res, data: await res.json().catch(() => null) };
    } catch (e) {
      if (signal?.aborted || k >= tries - 1) throw e;
      await sleep(2000 * (k + 1));
    }
  }
}

/**
 * Run `actor` with `input` and return its dataset items.
 * @param {{ actor: string, token: string, input: object, signal?: AbortSignal, fetchFn?: typeof fetch, timeoutSecs?: number }} p
 */
export async function runActor({ actor, token, input, signal, fetchFn = fetch, timeoutSecs = 240 }) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const deadline = AbortSignal.timeout((timeoutSecs + 90) * 1000);
  const sig = signal ? AbortSignal.any([signal, deadline]) : deadline;
  // Starting is not retried: a retry after a lost answer could start (and pay for) a second run.
  const start = await call(fetchFn, `${BASE}/acts/${actor}/runs?timeout=${timeoutSecs}`, { method: "POST", headers, body: JSON.stringify(input) }, sig, 1);
  if (!start.res.ok) throw new Error(`Apify lỗi: ${start.data?.error?.message ?? start.res.statusText}`);
  let run = start.data?.data;
  while (run && WAITING.has(run.status)) {
    const poll = await call(fetchFn, `${BASE}/actor-runs/${run.id}?waitForFinish=60`, { headers }, sig, 4);
    if (!poll.res.ok) throw new Error(`Apify lỗi: ${poll.data?.error?.message ?? poll.res.statusText}`);
    run = poll.data?.data;
  }
  if (run?.status !== "SUCCEEDED") throw new Error(`Apify lỗi: lượt chạy ${String(run?.status ?? "không rõ").toLowerCase()}`);
  const items = await call(fetchFn, `${BASE}/datasets/${run.defaultDatasetId}/items?format=json&clean=true`, { headers }, sig, 4);
  if (!items.res.ok || !Array.isArray(items.data)) throw new Error(`Apify lỗi: ${items.data?.error?.message ?? items.res.statusText}`);
  return items.data;
}
