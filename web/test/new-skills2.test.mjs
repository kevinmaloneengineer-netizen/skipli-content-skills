import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { buildJob } from "../server/prompts.mjs";
import { parseDishTable, parseMoney, promoMath, promoReport } from "../server/promo.mjs";
import { cleanMenuText } from "../server/vision.mjs";

const DISHES = "Phở bò - 65.000 - 28.000\nPhở tái - 60k - 25k\nTrà đá - 5.000 - 1.000\nChả giò - 30.000";
const answer = (promos) => "```json\n" + JSON.stringify({ promos }) + "\n```";

test("promo: prices read the way owners write them", () => {
  assert.equal(parseMoney("65.000đ"), 65000);
  assert.equal(parseMoney("65k"), 65000);
  assert.equal(parseMoney("65,000"), 65000);
  assert.equal(parseMoney("$14.95", true), 14.95);
  assert.equal(parseMoney("hết"), null);
  const t = parseDishTable(DISHES);
  assert.equal(t.usd, false);
  assert.deepEqual(t.dishes.map((d) => [d.name, d.price, d.cost]), [["Phở bò", 65000, 28000], ["Phở tái", 60000, 25000], ["Trà đá", 5000, 1000], ["Chả giò", 30000, null]]);
});

test("promo: the money is computed from the owner's prices; invented dishes and bad prices are dropped", () => {
  const table = parseDishTable(DISHES);
  const out = promoMath(answer([
    { title: "Combo trưa", items: [{ dish: "Phở bò", qty: 1 }, { dish: "Trà đá", qty: 1 }], gift: [], price: 65000 },
    { title: "Món không có", items: [{ dish: "Bún bò", qty: 1 }], price: 40000 },
    { title: "Đắt hơn giá thường", items: [{ dish: "Phở bò", qty: 1 }], price: 99000 },
    { title: "Tặng chả giò", items: [{ dish: "Phở tái", qty: 2 }], gift: [{ dish: "Chả giò", qty: 1 }], price: 120000 },
  ]), table);
  assert.deepEqual(out.map((p) => p.title), ["Combo trưa", "Tặng chả giò"]);
  const [combo, gift] = out;
  assert.equal(combo.normal, 70000);
  assert.equal(combo.cost, 29000);
  assert.equal(combo.profit, 36000);
  assert.equal(combo.usual, 41000); // (65.000 - 28.000) + (5.000 - 1.000) at the menu price
  assert.equal(gift.profit, null); // the gift has no cost: no profit shown, never guessed
  assert.deepEqual(gift.missing, ["Chả giò"]);
  const md = promoReport(answer([{ title: "Combo trưa", items: [{ dish: "Phở bò", qty: 1 }, { dish: "Trà đá", qty: 1 }], price: 65000 }]), { dishes: DISHES });
  assert.match(md, /## Phương án 1: Combo trưa/);
  assert.match(md, /Lãi mỗi đơn \| \*\*36\.000đ\*\*/);
  assert.throws(() => promoReport("không phải JSON", { dishes: DISHES }), /khuyến mãi hợp lệ/);
});

test("menu photo: only menu lines are kept from the model's answer", () => {
  const text = cleanMenuText("Đây là menu:\n```\n# Món chính\n- Phở bò - 65.000đ\n# Trống\n# Nước\nTrà đá - 5.000\n```\nChúc ngon miệng!");
  assert.equal(text, "# Món chính\nPhở bò - 65.000đ\n# Nước\nTrà đá - 5.000");
  assert.equal(cleanMenuText("Không đọc được ảnh."), "");
});

test("zalo and promo forms: real facts required where the message needs them", () => {
  const has = { hasUpload: () => true };
  assert.throws(() => buildJob("zalo-message", { business: "Phở Cali", goal: "offer" }, has), /ưu đãi, món hoặc ngày/);
  const zalo = buildJob("zalo-message", { business: "Phở Cali", goal: "back" }, has);
  assert.equal(zalo.direct, "zalo-message");
  assert.throws(() => buildJob("promo-plan", { business: "Phở Cali", dishes: "Phở bò - 65.000" }, has), /ít nhất 2 món/);
  const promo = buildJob("promo-plan", { business: "Phở Cali", dishes: DISHES, goal: "bill" }, has);
  assert.match(promo.prompt, /Phở bò: giá bán 65000, giá vốn 28000/);
  assert.match(promo.prompt, /Chả giò: giá bán 30000, chưa có giá vốn/);
});

async function serve() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "skills2-"));
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, mailEnv: {}, errorEnv: {}, billingEnv: { TRIAL_CREDITS: "10" },
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 20 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
    video: { dataDir, timeoutMs: 60_000, mock: true },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const login = async (email) => (await fetch(root + "/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "password-1" }) })).headers.get("set-cookie")?.split(";")[0];
  await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
  return { s, req, a: await login("a@shop.com") };
}

test("menu photo API: nothing read → an error and no credit taken", async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const { s, req, a } = await serve();
  try {
    const before = (await req("GET", "/api/billing", null, a)).body.credits;
    assert.equal((await req("POST", "/api/menus/scan", { dataUrl: "data:text/plain;base64,aGk=" }, a)).status, 400);
    const r = await req("POST", "/api/menus/scan", { dataUrl: "data:image/jpeg;base64,/9j/4AAQ" }, a);
    assert.equal(r.status, 422);
    assert.equal((await req("GET", "/api/billing", null, a)).body.credits, before);
  } finally {
    s.close();
    if (saved) process.env.GEMINI_API_KEY = saved;
  }
});

test("zalo and promo runs: messages split per message, promotions priced by the server", async () => {
  const { s, req, a } = await serve();
  const wait = async (id) => {
    for (let i = 0; i < 100; i++) {
      const job = (await req("GET", `/api/jobs/${id}`, null, a)).body.job;
      if (!["queued", "running"].includes(job.status)) return job;
      await sleep(30);
    }
    throw new Error("job did not finish");
  };
  try {
    const zalo = await req("POST", "/api/jobs", { type: "zalo-message", input: { business: "Phở Cali", goal: "back" } }, a);
    assert.equal(zalo.status, 201);
    assert.match((await wait(zalo.body.job.id)).result, /## Tin 1:/);
    const promo = await req("POST", "/api/jobs", { type: "promo-plan", input: { business: "Phở Cali", goal: "slow", dishes: "Phở bò - 65.000 - 28.000\nTrà đá - 5.000 - 1.000" } }, a);
    const done = await wait(promo.body.job.id);
    assert.equal(done.status, "done");
    assert.match(done.result, /Lãi mỗi đơn \| \*\*36\.000đ\*\*/);
    const sample = (await req("GET", "/api/samples/promo-plan")).body.job;
    assert.match(sample.result, /## Phương án 1:/);
  } finally {
    s.close();
  }
});
