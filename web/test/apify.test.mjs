import assert from "node:assert/strict";
import test from "node:test";
import { runActor } from "../server/sources/apify.mjs";

const json = (data, status = 200) => ({ ok: status < 400, status, statusText: "x", json: async () => data });

test("apify: a dropped connection while waiting is asked again, and the items come back", async () => {
  const calls = [];
  let polls = 0;
  const fetchFn = async (url, init) => {
    calls.push(`${init.method ?? "GET"} ${url.replace("https://api.apify.com/v2", "")}`);
    if (url.includes("/runs?")) return json({ data: { id: "r1", status: "RUNNING", defaultDatasetId: "d1" } });
    if (url.includes("/actor-runs/r1")) {
      polls++;
      if (polls === 1) throw new TypeError("fetch failed"); // the network blip of the Yelp run
      return json({ data: { id: "r1", status: polls < 3 ? "RUNNING" : "SUCCEEDED", defaultDatasetId: "d1" } });
    }
    if (url.includes("/datasets/d1/items")) return json([{ review: "ngon" }]);
    throw new Error(`unexpected ${url}`);
  };
  assert.deepEqual(await runActor({ actor: "a~b", token: "t", input: {}, fetchFn }), [{ review: "ngon" }]);
  assert.equal(calls.filter((c) => c.startsWith("POST")).length, 1); // started once, never twice
});

test("apify: a failed run or a refused start is reported, not returned as empty", async () => {
  const failed = async (url) => (url.includes("/runs?") ? json({ data: { id: "r", status: "RUNNING" } }) : json({ data: { id: "r", status: "FAILED" } }));
  await assert.rejects(runActor({ actor: "a", token: "t", input: {}, fetchFn: failed }), /lượt chạy failed/);
  const refused = async () => json({ error: { message: "Not enough usage" } }, 402);
  await assert.rejects(runActor({ actor: "a", token: "t", input: {}, fetchFn: refused }), /Not enough usage/);
});
