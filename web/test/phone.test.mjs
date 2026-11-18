import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhoneGate, maskPhone, normalizePhone, twilioConfig } from "../server/phone.mjs";

test("phone: US numbers in any common shape, Vietnamese ones only when allowed", () => {
  for (const raw of ["(404) 555-0123", "404-555-0123", "+1 404 555 0123", "14045550123"]) assert.equal(normalizePhone(raw), "+14045550123");
  assert.equal(normalizePhone("123-555-0123"), null); // area codes never start with 0 or 1
  assert.equal(normalizePhone("0912 345 678"), null);
  assert.equal(normalizePhone("0912 345 678", { intl: true }), "+84912345678");
  assert.equal(normalizePhone("+84 912 345 678", { intl: true }), "+84912345678");
  assert.equal(normalizePhone("+44 20 7946 0958", { intl: true }), null);
  assert.equal(maskPhone("+14045550123"), "(***) ***-0123");
});

test("phone: live Twilio keys only in production, test keys elsewhere", () => {
  const env = { TWILIO_ACCOUNT_SID_TEST: "ACtest", TWILIO_AUTH_TOKEN_TEST: "t", TWILIO_PHONE_NUMBER_TEST: "+15005550006", TWILIO_ACCOUNT_SID_LIVE: "AClive", TWILIO_AUTH_TOKEN_LIVE: "l", TWILIO_PHONE_NUMBER_LIVE: "+14049994462" };
  assert.equal(twilioConfig(env).sid, "ACtest");
  assert.equal(twilioConfig({ ...env, NODE_ENV: "production" }).sid, "AClive");
  assert.equal(twilioConfig({ ...env, NODE_ENV: "production" }).from, "+14049994462");
});

function setup(env = {}) {
  const users = new Map([["u1", { id: "u1", email: "owner@slice.com" }]]);
  const store = { getUser: (id) => users.get(id), updateUser: async (id, patch) => users.set(id, { ...users.get(id), ...patch }) };
  const texts = [];
  const fetchFn = async (url, init) => {
    texts.push({ url, to: new URLSearchParams(init.body).get("To"), body: new URLSearchParams(init.body).get("Body") });
    return new Response(JSON.stringify({ sid: "SM1", status: "queued" }), { status: 201 });
  };
  const rows = [];
  const logs = [];
  const sheets = { enabled: true, append: async (row) => rows.push(row) };
  const gate = createPhoneGate({ store, env: { TWILIO_ACCOUNT_SID_TEST: "ACtest", TWILIO_AUTH_TOKEN_TEST: "t", TWILIO_PHONE_NUMBER_TEST: "+15005550006", ...env }, sheets, fetchFn, log: (m) => logs.push(m) });
  return { gate, users, texts, rows, logs };
}

test("phone: a code by SMS, a wait before resending, wrong codes counted, then the details unlock", async () => {
  const { gate, users, texts, rows, logs } = setup();
  assert.equal(gate.enabled, true);
  assert.equal(gate.pending(users.get("u1")), true);
  await assert.rejects(gate.send("u1", "0912 345 678"), /số điện thoại Mỹ/); // customers: US numbers only
  const sent = await gate.send("u1", "(404) 555-0123");
  assert.equal(sent.sentTo, "(***) ***-0123");
  assert.equal(sent.code, undefined); // the code only goes by SMS (and the server log in test mode)
  assert.equal(texts[0].to, "+14045550123");
  const code = texts[0].body.match(/^\d{6}/)[0];
  assert.match(logs[0], new RegExp(code));
  await assert.rejects(gate.send("u1", "(404) 555-0123"), /giây/); // 30 s between codes
  await assert.rejects(gate.verify("u1", code === "000000" ? "111111" : "000000"), /còn 4 lần/);
  await assert.rejects(gate.details("u1", { name: "Ana" }), /Xác minh số điện thoại trước/);
  await gate.verify("u1", code);
  assert.equal(users.get("u1").phone, "+14045550123");
  assert.equal(users.get("u1").phoneOtp, null);
  await assert.rejects(gate.details("u1", { name: "Ana", email: "ana@slice.com", restaurant: "", city: "Chicago" }), /tên quán/);
  await gate.details("u1", { name: "Ana", email: "Ana@Slice.com", restaurant: "Slice Society", city: "Chicago, IL", channels: ["instagram", "bogus"], marketer: "owner", budget: "200-500" });
  const lead = users.get("u1").lead;
  assert.deepEqual([lead.email, lead.channels, lead.marketer], ["ana@slice.com", ["instagram"], "owner"]);
  assert.equal(gate.pending(users.get("u1")), false);
  await new Promise((r) => setImmediate(r));
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].slice(1, 7), ["Ana", "ana@slice.com", "+14045550123", "Slice Society", "Chicago, IL", "instagram"]);
});

test("phone: admins may test with a Vietnamese number; production never logs the code", async () => {
  const { gate, logs } = setup({ NODE_ENV: "production", TWILIO_ACCOUNT_SID_LIVE: "AClive", TWILIO_AUTH_TOKEN_LIVE: "l", TWILIO_PHONE_NUMBER_LIVE: "+14049994462" });
  const sent = await gate.send("u1", "0912 345 678", { intl: true });
  assert.equal(logs.length, 0);
  assert.equal(sent.sentTo, "+84 *** *** 678");
});

test("phone: off without Twilio keys or with PHONE_GATE=0", () => {
  const store = { getUser: () => null, updateUser: async () => {} };
  assert.equal(createPhoneGate({ store, env: {} }).enabled, false);
  assert.equal(createPhoneGate({ store, env: { PHONE_GATE: "0", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_PHONE_NUMBER: "+1" } }).enabled, false);
});
