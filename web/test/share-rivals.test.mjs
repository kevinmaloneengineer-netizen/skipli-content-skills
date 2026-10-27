import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { competitorsOf, facebookOf, mapsOf } from "../server/competitors.mjs";

const config = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "",
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 30 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};

test("share: a done result gets a read-only link, without the prompt or the owner, and the link can be turned off", async () => {
  const { app, runner } = await createApp(config, memoryAdapter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  try {
    const job = (await call("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Phở bò", variants: 1 } })).body.job;
    assert.equal((await call("POST", `/api/jobs/${job.id}/share`)).status, 409); // not finished yet
    for (let i = 0; i < 100 && (await call("GET", `/api/jobs/${job.id}`)).body.job.status !== "done"; i++) await sleep(50);
    const { token } = (await call("POST", `/api/jobs/${job.id}/share`)).body.share;
    assert.match(token, new RegExp(`^${job.id}\\.[\\w-]{20,40}$`));
    assert.equal((await call("POST", `/api/jobs/${job.id}/share`)).body.share.token, token); // same link again
    const open = await call("GET", `/api/public/shared/${token}`);
    assert.equal(open.status, 200);
    assert.ok(open.body.job.result);
    for (const k of ["prompt", "share", "usage", "userId"]) assert.equal(open.body.job[k], undefined, k);
    assert.match(open.headers.get("set-cookie"), /skipli_share=.*Path=\/media; HttpOnly/);
    assert.equal((await call("GET", `/api/public/shared/${job.id}.wrongwrongwrongwrongwrong`)).status, 404);
    await call("DELETE", `/api/jobs/${job.id}/share`);
    assert.equal((await call("GET", `/api/public/shared/${token}`)).status, 404);
  } finally {
    runner.stop?.();
    server.close();
  }
});

test("rivals: runs and the watch list are gathered per competitor", () => {
  assert.deepEqual(facebookOf("https://www.facebook.com/ShakeShack/reels/"), { key: "fb:shakeshack", name: "ShakeShack", url: "https://www.facebook.com/ShakeShack/" });
  assert.equal(facebookOf("https://www.facebook.com/reel/123"), null);
  const link = "https://www.google.com/maps/search/?api=1&query=Xankia&query_place_id=ChIJ96x";
  assert.equal(mapsOf(link, "Xankia").key, "maps:ChIJ96x");
  const watches = [{ id: "w1", kind: "maps", url: link, name: "Xankia" }, { id: "w2", url: "https://www.facebook.com/shakeshack/" }];
  const jobs = [
    { id: "a", type: "maps", status: "done", createdAt: "2026-10-20", title: "Review", input: { place: "Xankia, Milwaukee" }, place: { name: "Xankia", url: link } },
    { id: "b", type: "rating-watch", status: "done", createdAt: "2026-10-26", title: "Theo dõi sao · Xankia · 2 đánh giá mới", input: { watchId: "w1" } },
    { id: "c", type: "fanpage", status: "done", createdAt: "2026-10-21", title: "Fanpage", input: { url: "https://www.facebook.com/ShakeShack/" } },
    { id: "d", type: "maps", status: "done", createdAt: "2026-10-01", title: "Old review", input: { place: "Xankia" }, place: { name: "Xankia", url: "" } }, // older run: no place id
    { id: "e", type: "fanpage", status: "failed", createdAt: "2026-10-22", title: "Failed", input: { url: "https://www.facebook.com/Wendys/" } },
    { id: "f", type: "review-compare", status: "done", createdAt: "2026-10-23", title: "Compare", input: {}, researchTable: `| [Pho 99](https://www.google.com/maps/search/?api=1&query=Pho&query_place_id=P99) | x |\n| [Xankia](${link}) | y |` },
  ];
  const cards = competitorsOf(watches, jobs);
  assert.deepEqual(cards.map((c) => [c.kind, c.name, !!c.watch]), [["maps", "Xankia", true], ["facebook", "@shakeshack", true], ["maps", "Pho 99", false]]);
  assert.deepEqual(cards[0].events.map((e) => e.id), ["b"]);
  assert.deepEqual(cards[0].runs.map((r) => r.id), ["f", "a", "d"]);
  assert.deepEqual(cards[1].runs.map((r) => r.id), ["c"]);
});

test("share: behind the app password, the link's cookie opens that result's files only", async () => {
  const { app, runner } = await createApp({ ...config, appPassword: "pw" }, memoryAdapter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "pw" }) });
  const owner = login.headers.get("set-cookie").split(";")[0];
  const call = (method, p, body, cookie = owner) => fetch(base + p, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  try {
    const make = async () => {
      const { job } = await (await call("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Phở", variants: 1 } })).json();
      for (let i = 0; i < 100 && (await (await call("GET", `/api/jobs/${job.id}`)).json()).job.status !== "done"; i++) await sleep(50);
      return job;
    };
    const a = await make();
    const b = await make();
    const { token } = (await (await call("POST", `/api/jobs/${a.id}/share`)).json()).share;
    const opened = await call("GET", `/api/public/shared/${token}`, undefined, "");
    assert.equal(opened.status, 200);
    const share = opened.headers.get("set-cookie").split(";")[0];
    assert.equal((await call("GET", `/media/videos/${a.id}.mp4`, undefined, "")).status, 401); // no link, no login
    const own = await call("GET", `/media/videos/${a.id}.mp4`, undefined, share);
    assert.equal(await own.text(), "Không tìm thấy file"); // let through: only the file itself is missing here
    const other = await call("GET", `/media/videos/${b.id}.mp4`, undefined, share);
    assert.equal(await other.text(), "Không tìm thấy video"); // another run's file stays closed
  } finally {
    runner.stop?.();
    server.close();
  }
});
