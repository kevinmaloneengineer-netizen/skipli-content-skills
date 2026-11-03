import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { answerFields, isLow, surveyStats } from "../server/survey.mjs";

const base = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: false, signupPerIp: 0,
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};

test("survey helpers: answers are checked, poor ones spotted, averages worked out", () => {
  assert.throws(() => answerFields({ food: 6, service: 3, back: "yes" }), /số sao/);
  assert.throws(() => answerFields({ food: 4, service: 3 }), /quay lại/);
  assert.deepEqual(answerFields({ food: "4", service: 5, back: "maybe", comment: "  Ngon   lắm ", extra: "x" }), { food: 4, service: 5, back: "maybe", comment: "Ngon lắm", contact: "" });
  assert.equal(isLow({ food: 5, service: 2, back: "yes" }), true);
  assert.equal(isLow({ food: 4, service: 4, back: "no" }), true);
  assert.equal(isLow({ food: 3, service: 3, back: "maybe" }), false);
  const s = surveyStats([{ food: 5, service: 4, back: "yes", createdAt: "2026-11-02" }, { food: 2, service: 3, back: "no", createdAt: "2026-11-01" }]);
  assert.deepEqual(s, { count: 2, food: 3.5, service: 3.5, backYes: 50, low: 1, lastAt: "2026-11-02" });
  assert.deepEqual(surveyStats([]), { count: 0, food: null, service: null, backYes: null, low: 0, lastAt: null });
});

test("table survey: guests answer without an account, the owner sees the averages and gets an email for a poor answer", async () => {
  const sent = [];
  const { app, store } = await createApp({ ...base, mailer: { enabled: true, send: async (m) => sent.push(m) } }, memoryAdapter());
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, redirect: "manual", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    const admin = (await req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1" })).cookie;
    await req("POST", "/api/admin/users", { email: "an@shop.vn", password: "member-pass-1" }, admin);
    await req("POST", "/api/admin/users", { email: "binh@shop.vn", password: "member-pass-1" }, admin);
    const an = (await req("POST", "/api/login", { login: "an@shop.vn", password: "member-pass-1" })).cookie;
    const binh = (await req("POST", "/api/login", { login: "binh@shop.vn", password: "member-pass-1" })).cookie;

    assert.equal((await req("POST", "/api/surveys", { name: "" }, an)).status, 400);
    const made = await req("POST", "/api/surveys", { name: "Phở Cali", intro: "Góp ý để quán làm tốt hơn" }, an);
    assert.equal(made.status, 201);
    const id = made.body.survey.id;

    // The guest's page: the shop's lines only.
    assert.deepEqual((await req("GET", `/api/public/surveys/${id}`)).body.survey, { name: "Phở Cali", intro: "Góp ý để quán làm tốt hơn", thanks: "", open: true, lang: "vi" });
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 0, service: 3, back: "yes" })).status, 400);
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 5, service: 5, back: "yes", comment: "Nước dùng ngon" })).status, 201);
    await sleep(20);
    assert.equal(sent.length, 1); // praise is passed on too
    assert.match(sent[0].subject, /Khách vừa khen Phở Cali/);
    assert.match(sent[0].html, /Khách khen/);
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 2, service: 4, back: "no", comment: "Phở nguội", contact: "0909 123 456" })).status, 201);
    await sleep(20);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].to, "an@shop.vn");
    assert.match(sent[1].subject, /Góp ý chưa tốt/);
    assert.match(sent[1].text, /Phở nguội/);
    assert.match(sent[1].html, /tel:0909123456/);
    // A bot filling the hidden field is told "ok" and nothing is kept.
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 1, service: 1, back: "no", website: "spam.example" })).status, 201);
    // Three answers an hour from one address.
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 4, service: 4, back: "maybe" })).status, 201);
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 4, service: 4, back: "maybe" })).status, 429);

    const view = await req("GET", `/api/surveys/${id}/answers?days=7`, null, an);
    assert.equal(view.status, 200);
    assert.deepEqual({ count: view.body.stats.count, food: view.body.stats.food, backYes: view.body.stats.backYes, low: view.body.stats.low }, { count: 3, food: 3.7, backYes: 33, low: 1 });
    assert.equal(view.body.answers[1].low, true);
    assert.equal(view.body.answers[1].contact, "0909 123 456");
    // Someone else's survey stays theirs.
    assert.equal((await req("GET", `/api/surveys/${id}/answers`, null, binh)).status, 404);
    assert.equal((await req("GET", "/api/surveys", null, binh)).body.surveys.length, 0);

    // Paused: the page says so and takes no answers. Deleted: the answers go too.
    await req("PUT", `/api/surveys/${id}`, { name: "Phở Cali", open: false }, an);
    assert.equal((await req("POST", `/api/public/surveys/${id}/answers`, { food: 5, service: 5, back: "yes" })).status, 409);
    assert.equal((await req("DELETE", `/api/surveys/${id}`, null, an)).status, 200);
    assert.equal((await req("GET", `/api/public/surveys/${id}`)).status, 404);
    assert.equal((await store.listAnswers(id)).length, 0);
  } finally {
    s.close();
  }
});
