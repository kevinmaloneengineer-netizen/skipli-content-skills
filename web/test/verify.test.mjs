import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { buildMessage, smtpSend } from "../server/mailer.mjs";

const base = {
  port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0,
  goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
  agents: { scout: "content-scout", writer: "content-writer" },
  jobs: { concurrency: 1, timeoutMs: 60_000 },
};
async function serve(config) {
  const app = await createApp({ ...base, ...config }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const req = async (method, p, body, cookie) => {
    const r = await fetch(root + p, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  return { s, req, app };
}

test("SMTP: logs in, sends the message, reports a refused login", async () => {
  const seen = [];
  let data = "";
  const server = net.createServer((sock) => {
    sock.setEncoding("utf8");
    let inData = false;
    let buf = "";
    let n = 0; // commands on this connection
    sock.write("220 fake ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            sock.write("250 queued\r\n");
          } else data += `${line}\n`;
          continue;
        }
        seen.push(line);
        n++;
        if (line.startsWith("EHLO")) sock.write("250-fake\r\n250 AUTH LOGIN\r\n");
        else if (line === "AUTH LOGIN") sock.write("334 VXNlcm5hbWU6\r\n");
        else if (n === 3) sock.write("334 UGFzc3dvcmQ6\r\n");
        else if (n === 4) sock.write(line === Buffer.from("secret").toString("base64") ? "235 ok\r\n" : "535 bad\r\n");
        else if (line === "DATA") {
          inData = true;
          sock.write("354 go\r\n");
        } else if (line === "QUIT") sock.end("221 bye\r\n");
        else sock.write("250 ok\r\n");
      }
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const msg = buildMessage({ from: "shop@gmail.com", to: "a@b.com", subject: "123456 là mã xác nhận", text: "Mã: 123456" });
    await smtpSend({ host: "127.0.0.1", port: server.address().port, user: "shop@gmail.com", pass: "secret", secure: false }, { from: "shop@gmail.com", to: "a@b.com", data: msg });
    assert.equal(seen[2], Buffer.from("shop@gmail.com").toString("base64"));
    assert.ok(seen.includes("MAIL FROM:<shop@gmail.com>"));
    assert.ok(seen.includes("RCPT TO:<a@b.com>"));
    assert.match(data, /Subject: =\?UTF-8\?B\?/); // Vietnamese subject encoded
    await assert.rejects(
      smtpSend({ host: "127.0.0.1", port: server.address().port, user: "x", pass: "wrong", secure: false }, { from: "x@y.z", to: "a@b.com", data: msg }),
      /535/,
    );
  } finally {
    server.close();
  }
});

test("sign-up by email: nothing is stored until the code is right; then the account gets its credits", async () => {
  const sent = [];
  const mailer = { enabled: true, send: async (m) => sent.push(m) };
  const { s, req } = await serve({ billingEnv: { TRIAL_CREDITS: "20" }, mailer });
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const admin = await req("POST", "/api/login", { login: "boss@example.com", password: "admin-pass-1" });
    assert.equal((await req("POST", "/api/signup", { email: "nope", password: "password-1" })).status, 400);
    const me = await req("POST", "/api/signup", { email: "Cafe@Shop.com", password: "password-1", name: "Mây" });
    assert.equal(me.status, 201);
    assert.equal(me.body.user.email, "cafe@shop.com");
    assert.equal(me.body.user.verified, false);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "cafe@shop.com");
    const code = sent[0].subject.match(/^(\d{6}) /)[1];

    // Not an account yet: not listed, no tools, the session asks for the code.
    assert.equal((await req("GET", "/api/admin/users", null, admin.cookie)).body.users.length, 1);
    assert.equal((await req("GET", "/api/session", null, me.cookie)).body.user.verified, false);
    assert.equal((await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "x" } }, me.cookie)).status, 401);
    assert.equal((await req("POST", "/api/verify/resend", {}, me.cookie)).status, 429); // once a minute

    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await req("POST", "/api/verify", { code: wrong }, me.cookie);
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /còn 4 lần/);
    const ok = await req("POST", "/api/verify", { code: `${code.slice(0, 3)} ${code.slice(3)}` }, me.cookie);
    assert.equal(ok.body.user.verified, true);
    assert.equal(ok.body.user.credits, 20);
    assert.equal((await req("GET", "/api/admin/users", null, admin.cookie)).body.users.length, 2); // now it exists
    assert.equal((await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Lẩu bò" } }, ok.cookie)).status, 201);
    assert.equal((await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-2" })).status, 409); // taken now
    assert.equal((await req("POST", "/api/login", { login: "cafe@shop.com", password: "password-1" })).status, 200);

    // Five wrong tries lock the code.
    const two = await req("POST", "/api/signup", { email: "b@shop.com", password: "password-1" });
    const code2 = sent[1].subject.slice(0, 6);
    const wrong2 = code2 === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) await req("POST", "/api/verify", { code: wrong2 }, two.cookie);
    assert.equal((await req("POST", "/api/verify", { code: code2 }, two.cookie)).status, 429);
  } finally {
    s.close();
  }
});

test("sign-up without mail set up: no code, credits right away", async () => {
  const { s, req } = await serve({ billingEnv: { TRIAL_CREDITS: "5" }, mailEnv: {} });
  try {
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "a@shop.com", password: "password-1" });
    assert.equal(me.body.user.verified, true);
    assert.equal(me.body.user.credits, 5);
  } finally {
    s.close();
  }
});
