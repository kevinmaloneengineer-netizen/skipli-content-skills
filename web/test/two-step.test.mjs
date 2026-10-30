import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { base32, checkTotp, totpCode } from "../server/totp.mjs";

const base = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: false, signupPerIp: 0,
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};
async function serve(extra = {}) {
  const app = await createApp({ ...base, ...extra }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  /** A browser: keeps its own cookies. */
  const browser = () => {
    const jar = new Map();
    const req = async (method, p, body) => {
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const set = r.headers.getSetCookie();
      for (const c of set) {
        const [kv] = c.split(";");
        const [k, v] = kv.split("=");
        if (/Max-Age=0\b/.test(c)) jar.delete(k);
        else jar.set(k, v);
      }
      return { status: r.status, body: await r.json().catch(() => null), set };
    };
    return { req, jar };
  };
  return { s, browser };
}
const signedIn = async (b) => (await b.req("GET", "/api/session")).body.user?.verified !== false && !!(await b.req("GET", "/api/session")).body.user;

test("TOTP: RFC 6238 test vectors, a used code does not work twice", () => {
  const secret = base32(Buffer.from("12345678901234567890"));
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(totpCode(secret, Math.floor(59 / 30)), "287082");
  assert.equal(totpCode(secret, Math.floor(1111111109 / 30)), "081804");
  const now = 1111111109_000;
  const step = checkTotp(secret, "081804", { now });
  assert.equal(step, Math.floor(1111111109 / 30));
  assert.equal(checkTotp(secret, "081804", { now, lastStep: step }), null);
  assert.equal(checkTotp(secret, "000000", { now }), null);
});

test("sessions: admin 7 days, sign out every other device, admin signs a customer out", async () => {
  const { s, browser } = await serve();
  try {
    const admin = browser();
    const r = await admin.req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1", name: "Boss" });
    assert.equal(r.status, 201);
    assert.match(r.set.join(), /Max-Age=604800\b/); // 7 days
    const created = await admin.req("POST", "/api/admin/users", { email: "an@shop.vn", password: "member-pass-1" });
    assert.equal(created.status, 201);

    const phone = browser();
    const laptop = browser();
    for (const b of [phone, laptop]) {
      const login = await b.req("POST", "/api/login", { login: "an@shop.vn", password: "member-pass-1" });
      assert.equal(login.status, 200);
      assert.match(login.set.join(), /Max-Age=2592000\b/); // customers keep 30 days
    }
    assert.equal((await phone.req("POST", "/api/me/logout-all")).status, 200);
    assert.equal(await signedIn(phone), true); // this device stays
    assert.equal(await signedIn(laptop), false);
    assert.equal((await laptop.req("GET", "/api/jobs")).status, 401);

    // The admin signs the customer out everywhere.
    assert.equal((await admin.req("PUT", `/api/admin/users/${created.body.user.id}`, { signOut: true })).status, 200);
    assert.equal(await signedIn(phone), false);
  } finally {
    s.close();
  }
});

test("admin 2-step login: turn on, sign in with the app code or a backup code once, then turn off", async () => {
  const { s, browser } = await serve();
  try {
    const admin = browser();
    await admin.req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1" });
    const other = browser(); // signed in before 2-step login is turned on
    await other.req("POST", "/api/login", { login: "boss@shop.vn", password: "admin-pass-1" });
    assert.equal(await signedIn(other), true);

    const setup = await admin.req("POST", "/api/me/mfa/setup");
    assert.equal(setup.status, 200);
    assert.match(setup.body.uri, /^otpauth:\/\/totp\/Skipli%20Content%3Aboss%40shop\.vn\?secret=/);
    const step = Math.floor(Date.now() / 30_000);
    assert.equal((await admin.req("POST", "/api/me/mfa/enable", { password: "wrong-pass", code: totpCode(setup.body.secret, step) })).status, 400);
    assert.equal((await admin.req("POST", "/api/me/mfa/enable", { password: "admin-pass-1", code: "000000" })).status, 400);
    const on = await admin.req("POST", "/api/me/mfa/enable", { password: "admin-pass-1", code: totpCode(setup.body.secret, step) });
    assert.equal(on.status, 200);
    assert.equal(on.body.codes.length, 8);
    assert.deepEqual(on.body.user.mfa, { backupLeft: 8 });
    assert.equal(await signedIn(admin), true); // this browser stays
    assert.equal(await signedIn(other), false); // the one signed in without the code is out

    // The password alone is not a session.
    const fresh = browser();
    const pw = await fresh.req("POST", "/api/login", { login: "boss@shop.vn", password: "admin-pass-1" });
    assert.deepEqual(pw.body, { ok: true, mfa: true });
    assert.equal(fresh.jar.has("skipli_user"), false);
    assert.equal((await fresh.req("GET", "/api/session")).body.mfa, true);
    assert.equal((await fresh.req("GET", "/api/jobs")).status, 401);
    assert.equal((await fresh.req("POST", "/api/login/mfa", { code: "123456" })).status, 400);
    assert.equal((await fresh.req("POST", "/api/login/mfa", { code: totpCode(setup.body.secret, step) })).status, 400); // already used to turn it on
    const ok = await fresh.req("POST", "/api/login/mfa", { code: totpCode(setup.body.secret, step + 1) });
    assert.equal(ok.status, 200);
    assert.equal(await signedIn(fresh), true);
    assert.equal(fresh.jar.has("skipli_mfa"), false);

    // A backup code works once.
    const lost = browser();
    await lost.req("POST", "/api/login", { login: "boss@shop.vn", password: "admin-pass-1" });
    const backup = await lost.req("POST", "/api/login/mfa", { code: on.body.codes[0].toUpperCase() });
    assert.equal(backup.status, 200);
    assert.equal(backup.body.user.mfa.backupLeft, 7);
    const again = browser();
    await again.req("POST", "/api/login", { login: "boss@shop.vn", password: "admin-pass-1" });
    assert.equal((await again.req("POST", "/api/login/mfa", { code: on.body.codes[0] })).status, 400);
    // Without the password step there is nothing to answer.
    assert.equal((await browser().req("POST", "/api/login/mfa", { code: on.body.codes[1] })).status, 400);

    // Turning it off needs the password and a code.
    assert.equal((await admin.req("POST", "/api/me/mfa/disable", { password: "admin-pass-1", code: "000000" })).status, 400);
    const off = await admin.req("POST", "/api/me/mfa/disable", { password: "admin-pass-1", code: on.body.codes[1] });
    assert.equal(off.status, 200);
    assert.equal(off.body.user.mfa, null);
    const plain = await browser().req("POST", "/api/login", { login: "boss@shop.vn", password: "admin-pass-1" });
    assert.equal(plain.body.user.role, "admin");
  } finally {
    s.close();
  }
});

test("2-step login is for the admin; customers cannot turn it on", async () => {
  const { s, browser } = await serve();
  try {
    const admin = browser();
    await admin.req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1" });
    await admin.req("POST", "/api/admin/users", { email: "an@shop.vn", password: "member-pass-1" });
    const member = browser();
    await member.req("POST", "/api/login", { login: "an@shop.vn", password: "member-pass-1" });
    assert.equal((await member.req("POST", "/api/me/mfa/setup")).status, 403);
  } finally {
    s.close();
  }
});

test("forgot password with 2-step login on: the email code sets the password, the app code is still asked", async () => {
  const sent = [];
  const { s, browser } = await serve({ signup: true, mailer: { enabled: true, send: async (m) => sent.push(m) } }); // mail is set up with sign-up
  try {
    const admin = browser();
    await admin.req("POST", "/api/setup", { email: "boss@shop.vn", password: "admin-pass-1" });
    const setup = await admin.req("POST", "/api/me/mfa/setup");
    const step = Math.floor(Date.now() / 30_000);
    await admin.req("POST", "/api/me/mfa/enable", { password: "admin-pass-1", code: totpCode(setup.body.secret, step) });

    const b = browser();
    assert.equal((await b.req("POST", "/api/password/forgot", { email: "boss@shop.vn" })).status, 200);
    const code = sent.at(-1).subject.slice(0, 6);
    const reset = await b.req("POST", "/api/password/reset", { email: "boss@shop.vn", code, password: "new-pass-123" });
    assert.deepEqual(reset.body, { ok: true, mfa: true });
    assert.equal(b.jar.has("skipli_user"), false);
    assert.equal(await signedIn(admin), false); // the new password signed the old browser out
    assert.equal((await b.req("POST", "/api/login/mfa", { code: totpCode(setup.body.secret, step + 1) })).status, 200);
    assert.equal(await signedIn(b), true);
  } finally {
    s.close();
  }
});
