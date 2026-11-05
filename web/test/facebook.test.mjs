import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";

const base = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: false, signupPerIp: 0,
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("Facebook Pages: connect through Facebook Login, tokens kept encrypted, post text or a photo, clear errors", async () => {
  const calls = [];
  let refuse = null; // a Graph error to answer the next post with
  const fbFetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, params: Object.fromEntries(u.searchParams), body: init.body });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.pathname.endsWith("/oauth/access_token")) return json({ access_token: u.searchParams.get("grant_type") ? "LONG_USER" : "SHORT_USER" });
    if (u.pathname.endsWith("/me/accounts")) return json({ data: [{ id: "111", name: "Phở Cali", access_token: "PAGE_TOKEN_111", tasks: ["CREATE_CONTENT", "MANAGE"], picture: { data: { url: "https://x/p.jpg" } } }, { id: "222", name: "Chỉ xem", access_token: "PAGE_TOKEN_222", tasks: ["ANALYZE"] }] });
    if (refuse) { const e = refuse; refuse = null; return json({ error: e }, 400); }
    if (u.pathname.endsWith("/111/feed")) return json({ id: "111_999" });
    if (u.pathname.endsWith("/111/photos")) return json({ id: "555", post_id: "111_777" });
    return json({ error: { message: "unexpected" } }, 400);
  };
  const { app, store } = await createApp({ ...base, fbEnv: { FB_APP_ID: "1234567890", FB_APP_SECRET: "0123456789abcdef0123456789abcdef" }, fbFetch }, memoryAdapter());
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, redirect: "manual", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, location: r.headers.get("location"), body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    const admin = (await req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1" })).cookie;
    await req("POST", "/api/admin/users", { email: "an@shop.vn", password: "member-pass-1" }, admin);
    await req("POST", "/api/admin/users", { email: "binh@shop.vn", password: "member-pass-1" }, admin);
    const an = (await req("POST", "/api/login", { login: "an@shop.vn", password: "member-pass-1" })).cookie;
    const binh = (await req("POST", "/api/login", { login: "binh@shop.vn", password: "member-pass-1" })).cookie;
    assert.equal((await req("GET", "/api/session", null, an)).body.facebook, true);

    // Facebook Login: the browser goes to Facebook with the permissions and a state, then comes back.
    const go = await req("GET", "/api/facebook/connect", null, an);
    assert.equal(go.status, 302);
    const dialog = new URL(go.location);
    assert.equal(dialog.host, "www.facebook.com");
    assert.equal(dialog.searchParams.get("scope"), "pages_show_list,pages_read_engagement,pages_manage_posts");
    const state = dialog.searchParams.get("state");
    const redirect = dialog.searchParams.get("redirect_uri");
    assert.match(redirect, /\/api\/facebook\/callback$/);
    // Someone else cannot finish this login.
    assert.match((await req("GET", `/api/facebook/callback?code=c&state=${state}`, null, binh)).location, /fb=error/);
    const go2 = await req("GET", "/api/facebook/connect", null, an);
    const state2 = new URL(go2.location).searchParams.get("state");
    const back = await req("GET", `/api/facebook/callback?code=CODE&state=${state2}`, null, an);
    assert.match(back.location, /^\/account\?fb=ok&n=1#facebook$/); // the Page without posting rights is left out
    assert.equal(calls.find((c) => c.path.endsWith("/oauth/access_token")).params.redirect_uri, redirect);

    // Kept encrypted; the browser sees the Page, never its token.
    const saved = store.userByEmail("an@shop.vn").fbPages;
    assert.equal(saved.length, 1);
    assert.ok(!JSON.stringify(saved).includes("PAGE_TOKEN"));
    const me = (await req("GET", "/api/session", null, an)).body.user;
    assert.deepEqual(me.fbPages, [{ id: "111", name: "Phở Cali", picture: "https://x/p.jpg" }]);
    assert.ok(!JSON.stringify(me).includes("PAGE_TOKEN"));

    // A text post, remembered on the result it came from.
    const job = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Phở bò" } }, an);
    const posted = await req("POST", "/api/facebook/post", { pageId: "111", message: "Phở bò nóng hổi!", jobId: job.body.job.id }, an);
    assert.equal(posted.status, 201);
    assert.deepEqual({ id: posted.body.id, url: posted.body.url, scheduled: posted.body.scheduled }, { id: "111_999", url: "https://www.facebook.com/111_999", scheduled: false });
    const feed = calls.find((c) => c.path.endsWith("/111/feed"));
    assert.equal(new URLSearchParams(String(feed.body)).get("access_token"), "PAGE_TOKEN_111");
    assert.equal(new URLSearchParams(String(feed.body)).get("message"), "Phở bò nóng hổi!");
    assert.equal(store.cachedJob(job.body.job.id).fbPosts[0].url, "https://www.facebook.com/111_999");

    // A photo with its caption, sent as the file itself.
    const photoId = (await req("POST", "/api/uploads", { dataUrl: PNG }, an)).body.id;
    const photo = await req("POST", "/api/facebook/post", { pageId: "111", message: "Món mới", photoId }, an);
    assert.equal(photo.body.id, "111_777");
    const form = calls.find((c) => c.path.endsWith("/111/photos")).body;
    assert.equal(form.get("caption"), "Món mới");
    assert.equal(form.get("source").type, "image/png");

    // Scheduled a day ahead: Facebook holds it.
    await req("POST", "/api/facebook/post", { pageId: "111", message: "Mai mở cửa", at: new Date(Date.now() + 86_400_000).toISOString() }, an);
    const sched = new URLSearchParams(String(calls.filter((c) => c.path.endsWith("/111/feed")).at(-1).body));
    assert.equal(sched.get("published"), "false");
    assert.ok(Number(sched.get("scheduled_publish_time")) > Date.now() / 1000);

    // Errors that say what to do; another account's Page is not reachable.
    refuse = { code: 190, message: "Error validating access token" };
    const expired = await req("POST", "/api/facebook/post", { pageId: "111", message: "x" }, an);
    assert.equal(expired.status, 401);
    assert.match(expired.body.error, /kết nối lại Facebook/);
    assert.equal((await req("POST", "/api/facebook/post", { pageId: "111", message: "x" }, binh)).status, 404);
    assert.equal((await req("POST", "/api/facebook/post", { pageId: "111", message: "  " }, an)).status, 400);

    // Disconnect forgets the Page and its token.
    assert.deepEqual((await req("DELETE", "/api/facebook/pages/111", null, an)).body, { left: 0 });
    assert.deepEqual(store.userByEmail("an@shop.vn").fbPages, []);
  } finally {
    s.close();
  }
});

test("Facebook Pages: without an app configured the connect button explains", async () => {
  const { app } = await createApp({ ...base, fbEnv: {} }, memoryAdapter());
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  try {
    const setup = await fetch(`${root}/api/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@shop.vn", password: "admin-pass-1" }) });
    const cookie = setup.headers.get("set-cookie").split(";")[0];
    const r = await fetch(`${root}/api/facebook/connect`, { headers: { cookie }, redirect: "manual" });
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /FB_APP_ID/);
  } finally {
    s.close();
  }
});
