import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { costOf, parsePacks, verifySignature } from "../server/billing.mjs";

const SECRET = "whsec_test_secret";
const sign = (raw, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex")}`;

test("billing helpers: packs, costs, Stripe signatures", () => {
  assert.deepEqual(parsePacks("100:900, 300:2400, bad, 5:10"), [{ id: "p100", credits: 100, cents: 900 }, { id: "p300", credits: 300, cents: 2400 }]);
  assert.equal(costOf("video"), 5);
  assert.equal(costOf("write"), 1);
  const raw = '{"a":1}';
  assert.equal(verifySignature(raw, sign(raw), SECRET), true);
  assert.equal(verifySignature(raw + " ", sign(raw), SECRET), false); // body changed
  assert.equal(verifySignature(raw, sign(raw, Math.floor(Date.now() / 1000) - 600), SECRET), false); // too old
  assert.equal(verifySignature(raw, "t=1", SECRET), false);
});

test("sign-up with trial credits, runs take credits, failed runs give them back, Stripe top-up adds them once", async () => {
  const calls = [];
  const session = (userId) => ({ id: "cs_test_0123456789abc", url: "https://checkout.stripe.com/c/pay/x", payment_status: "paid", client_reference_id: userId, metadata: { credits: "100" }, amount_total: 900, currency: "usd" });
  let owner = "";
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(session(owner)), { status: 200 });
  };
  const env = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, TRIAL_CREDITS: "6", CREDIT_PACKS: "100:900" };
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, billingEnv: env, fetchFn,
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 400 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, headers = {}) => {
    const raw = typeof body === "string";
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    // Sign-up waits for the admin, then is open to anyone.
    assert.equal((await req("POST", "/api/signup", { email: "user0@shop.com", password: "password-1" })).status, 409);
    const admin = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const session0 = (await req("GET", "/api/session")).body;
    assert.equal(session0.signup, true);
    assert.equal(session0.billing, true);
    const me = await req("POST", "/api/signup", { email: "user1@shop.com", password: "password-1", name: "Cà phê" });
    assert.equal(me.status, 201);
    assert.equal(me.body.user.credits, 6);
    assert.equal((await req("POST", "/api/signup", { email: "user1@shop.com", password: "password-2" })).status, 409);
    owner = me.body.user.id;

    // A written post takes 1 credit.
    const post = { type: "write", input: { platform: "facebook", topic: "Lẩu bò" } };
    assert.equal((await req("POST", "/api/jobs", post, { cookie: me.cookie })).status, 201);
    let list = (await req("GET", "/api/jobs", null, { cookie: me.cookie })).body;
    assert.equal(list.credits, 5);
    // Canceled run (still queued behind the first): its credit comes back.
    const second = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Lẩu gà" } }, { cookie: me.cookie });
    assert.equal((await req("GET", "/api/billing", null, { cookie: me.cookie })).body.credits, 4);
    await req("POST", `/api/jobs/${second.body.job.id}/cancel`, {}, { cookie: me.cookie });
    await sleep(50);
    assert.equal((await req("GET", "/api/billing", null, { cookie: me.cookie })).body.credits, 5);

    // Spend down to 0, then a run is refused with 402.
    await app.store.updateUser(owner, { credits: 0 });
    const refused = await req("POST", "/api/jobs", post, { cookie: me.cookie });
    assert.equal(refused.status, 402);
    assert.match(refused.body.error, /Hết credit/);

    // Checkout → Stripe session; the success page confirms; the webhook for the same session adds nothing more.
    const checkout = await req("POST", "/api/billing/checkout", { pack: "p100" }, { cookie: me.cookie });
    assert.equal(checkout.body.url, "https://checkout.stripe.com/c/pay/x");
    const sent = new URLSearchParams(calls[0].init.body);
    assert.equal(sent.get("client_reference_id"), owner);
    assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "900");
    assert.equal(sent.get("metadata[credits]"), "100");
    assert.equal((await req("POST", "/api/billing/checkout", { pack: "nope" }, { cookie: me.cookie })).status, 400);

    const confirmed = await req("POST", "/api/billing/confirm", { sessionId: "cs_test_0123456789abc" }, { cookie: me.cookie });
    assert.deepEqual([confirmed.body.paid, confirmed.body.added, confirmed.body.credits], [true, 100, 100]);
    const raw = JSON.stringify({ type: "checkout.session.completed", data: { object: session(owner) } });
    assert.equal((await req("POST", "/api/stripe/webhook", raw, { "stripe-signature": sign(raw) })).status, 200);
    assert.equal((await req("GET", "/api/billing", null, { cookie: me.cookie })).body.credits, 100); // not twice
    assert.equal((await req("POST", "/api/stripe/webhook", raw, { "stripe-signature": "t=1,v1=bad" })).status, 400);

    // A new session through the webhook only.
    const other = { ...session(owner), id: "cs_test_zzzzzzzzzzzz" };
    const raw2 = JSON.stringify({ type: "checkout.session.completed", data: { object: other } });
    await req("POST", "/api/stripe/webhook", raw2, { "stripe-signature": sign(raw2) });
    assert.equal((await req("GET", "/api/billing", null, { cookie: me.cookie })).body.credits, 200);

    // The admin is never metered and can add credits by hand.
    assert.equal((await req("GET", "/api/billing", null, { cookie: admin.cookie })).body.metered, false);
    await req("PUT", `/api/admin/users/${owner}`, { addCredits: 25 }, { cookie: admin.cookie });
    const users = (await req("GET", "/api/admin/users", null, { cookie: admin.cookie })).body.users;
    const row = users.find((u) => u.id === owner);
    assert.equal(row.credits, 225);
    assert.equal(row.paid, 1800);
  } finally {
    s.close();
  }
});

test("without SIGNUP=1 the sign-up route is closed", async () => {
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, billingEnv: {},
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  try {
    await fetch(`${root}/api/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@example.com", password: "admin-pass-1" }) });
    const r = await fetch(`${root}/api/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "user2@shop.com", password: "password-1" }) });
    assert.equal(r.status, 403);
    assert.equal((await (await fetch(`${root}/api/session`)).json()).signup, false);
  } finally {
    s.close();
  }
});

test("one IP address only makes SIGNUP_PER_IP trial accounts, and the cap survives a restart", async () => {
  const adapter = memoryAdapter();
  const boot = () => createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 2, billingEnv: {},
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
  }, adapter);
  const post = (root, p, body) => fetch(root + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const listen = async (app) => {
    const s = app.app.listen(0, "127.0.0.1");
    await new Promise((r) => s.once("listening", r));
    return [s, `http://127.0.0.1:${s.address().port}`];
  };
  let [s, root] = await listen(await boot());
  try {
    await post(root, "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    assert.equal((await post(root, "/api/signup", { email: "user3@shop.com", password: "password-1" })).status, 201);
    assert.equal((await post(root, "/api/signup", { email: "user4@shop.com", password: "password-1" })).status, 201);
    const third = await post(root, "/api/signup", { email: "user5@shop.com", password: "password-1" });
    assert.equal(third.status, 429);
    assert.match((await third.json()).error, /đủ số tài khoản/);
  } finally {
    s.close();
  }
  [s, root] = await listen(await boot()); // restarted server, same data
  try {
    assert.equal((await post(root, "/api/signup", { email: "user6@shop.com", password: "password-1" })).status, 429);
    const users = await adapter.loadUsers();
    assert.ok(users.filter((u) => u.signupIp).every((u) => !u.signupIp.includes("127.0.0.1"))); // stored as a hash
  } finally {
    s.close();
  }
});

test("admin deletes a customer account, which frees its network's sign-up slot; the admin cannot be deleted", async () => {
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 1, billingEnv: {}, mailEnv: {},
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    const admin = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const a = await req("POST", "/api/signup", { email: "user3@shop.com", password: "password-1" });
    assert.equal((await req("POST", "/api/signup", { email: "user4@shop.com", password: "password-1" })).status, 429);
    assert.equal((await req("DELETE", `/api/admin/users/${a.body.user.id}`, null, a.cookie)).status, 403); // customers cannot
    assert.equal((await req("DELETE", `/api/admin/users/${admin.body.user.id}`, null, admin.cookie)).status, 400);
    assert.equal((await req("DELETE", `/api/admin/users/${a.body.user.id}`, null, admin.cookie)).status, 200);
    assert.equal((await req("GET", "/api/jobs", null, a.cookie)).status, 401); // signed out
    assert.equal((await req("POST", "/api/signup", { email: "user4@shop.com", password: "password-1" })).status, 201);
  } finally {
    s.close();
  }
});

test("chargeback: the bank takes the money back, the credits go too; spent already → locked; dispute won → back", async () => {
  const PI = "pi_test_dispute1";
  const sessions = new Map(); // id → session
  const fetchFn = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/v1/checkout/sessions" && u.searchParams.get("payment_intent")) {
      const hit = [...sessions.values()].find((x) => x.payment_intent === u.searchParams.get("payment_intent"));
      return new Response(JSON.stringify({ data: hit ? [hit] : [] }));
    }
    return new Response(JSON.stringify(sessions.get(u.pathname.split("/").pop()) ?? {}));
  };
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, mailEnv: {}, errorEnv: {}, fetchFn,
    billingEnv: { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, TRIAL_CREDITS: "20", CREDIT_PACKS: "100:900" },
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, headers = {}) => {
    const raw = typeof body === "string";
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const hook = (type, object) => {
    const raw = JSON.stringify({ type, data: { object } });
    return req("POST", "/api/stripe/webhook", raw, { "stripe-signature": sign(raw) });
  };
  try {
    const admin = await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    const uid = me.body.user.id;
    const paid = (id, pi) => ({ id, payment_status: "paid", client_reference_id: uid, metadata: { credits: "100" }, amount_total: 900, currency: "usd", payment_intent: pi });
    sessions.set("cs_test_aaaaaaaaaaaa", paid("cs_test_aaaaaaaaaaaa", PI));
    await hook("checkout.session.completed", paid("cs_test_aaaaaaaaaaaa", PI));
    assert.equal(app.store.getUser(uid).credits, 120);

    // Dispute while the credits are still there: they are taken back, the account stays open.
    await hook("charge.dispute.created", { id: "dp_1", payment_intent: PI, status: "needs_response" });
    assert.equal(app.store.getUser(uid).credits, 20);
    assert.equal(app.store.getUser(uid).disabled, false);
    await hook("charge.dispute.created", { id: "dp_1", payment_intent: PI }); // repeated event: nothing more
    assert.equal(app.store.getUser(uid).credits, 20);
    // The shop wins: the credits come back.
    await hook("charge.dispute.closed", { id: "dp_1", payment_intent: PI, status: "won" });
    assert.equal(app.store.getUser(uid).credits, 120);

    // A second top-up, spent, then disputed: balance to 0 and the account is locked.
    const PI2 = "pi_test_dispute2";
    sessions.set("cs_test_bbbbbbbbbbbb", paid("cs_test_bbbbbbbbbbbb", PI2));
    await hook("checkout.session.completed", paid("cs_test_bbbbbbbbbbbb", PI2));
    await app.store.updateUser(uid, { credits: 30 });
    const opened = await hook("charge.dispute.created", { id: "dp_2", payment_intent: PI2 });
    assert.deepEqual([opened.body.dispute.taken, opened.body.dispute.locked], [30, true]);
    assert.equal(app.store.getUser(uid).credits, 0);
    const login = await req("POST", "/api/login", { login: "cafe@shop.com", password: "password-1" });
    assert.equal(login.status, 403);
    assert.match(login.body.error, /hoàn tiền qua ngân hàng/);
    // Lost: the money went back to the customer; the account stays locked, the admin sees it.
    await hook("charge.dispute.closed", { id: "dp_2", payment_intent: PI2, status: "lost" });
    assert.equal(app.store.getUser(uid).disabled, true);
    const errs = (await req("GET", "/api/admin/errors", null, { cookie: admin.cookie })).body.errors;
    assert.ok(errs.some((e) => e.source === "billing" && /hoàn tiền/.test(e.message)));

    // A payment recorded before the intent was kept: found through Stripe's session lookup.
    const u = app.store.getUser(uid);
    await app.store.updateUser(uid, { disabled: false, disabledReason: null, credits: 100, payments: u.payments.map((p) => (p.id === "cs_test_aaaaaaaaaaaa" ? { id: p.id, credits: p.credits, amount: p.amount, currency: p.currency, at: p.at } : p)) });
    const PI3 = "pi_test_dispute3";
    sessions.set("cs_test_aaaaaaaaaaaa", { ...paid("cs_test_aaaaaaaaaaaa", PI3) });
    const old = await hook("charge.dispute.created", { id: "dp_3", payment_intent: PI3 });
    assert.equal(old.body.dispute.handled, true);
    assert.equal(app.store.getUser(uid).credits, 0);
  } finally {
    s.close();
  }
});
