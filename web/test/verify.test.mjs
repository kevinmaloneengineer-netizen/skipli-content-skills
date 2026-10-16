import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { createApp } from "../server/app.mjs";
import { memoryAdapter } from "../server/store/memory.mjs";
import { buildMessage, smtpSend } from "../server/mailer.mjs";

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
    // A wrong password is reported.
    await assert.rejects(
      smtpSend({ host: "127.0.0.1", port: server.address().port, user: "x", pass: "wrong", secure: false }, { from: "x@y.z", to: "a@b.com", data: msg }),
      /535/,
    );
  } finally {
    server.close();
  }
});

test("sign-up with mail: account waits for the 6-digit code, then gets the trial credits", async () => {
  const sent = [];
  const mailer = { enabled: true, send: async (m) => sent.push(m) };
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, billingEnv: { TRIAL_CREDITS: "20" }, mailer,
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
    await req("POST", "/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await req("POST", "/api/signup", { email: "cafe@shop.com", password: "password-1" });
    assert.equal(me.status, 201);
    assert.equal(me.body.user.emailVerified, false);
    assert.equal(me.body.user.credits, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "cafe@shop.com");
    const code = sent[0].subject.match(/^(\d{6}) /)[1];

    // Until confirmed: no tools, but the session says who it is.
    const blocked = await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "x" } }, me.cookie);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.verify, true);
    assert.equal((await req("GET", "/api/session", null, me.cookie)).body.user.emailVerified, false);

    // Resend waits a minute.
    assert.equal((await req("POST", "/api/verify/resend", {}, me.cookie)).status, 429);

    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await req("POST", "/api/verify", { code: wrong }, me.cookie);
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /còn 4 lần/);

    const ok = await req("POST", "/api/verify", { code: `${code.slice(0, 3)} ${code.slice(3)}` }, me.cookie); // spaces are fine
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.emailVerified, true);
    assert.equal(ok.body.user.credits, 20);
    assert.equal((await req("POST", "/api/jobs", { type: "write", input: { platform: "facebook", topic: "Lẩu bò" } }, me.cookie)).status, 201);
    // The code works once.
    assert.equal((await req("POST", "/api/verify", { code }, me.cookie)).body.user.credits, 19);

    // Five wrong tries lock the code.
    const two = await req("POST", "/api/signup", { email: "b@shop.com", password: "password-1" });
    const code2 = sent[1].subject.slice(0, 6);
    const wrong2 = code2 === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) await req("POST", "/api/verify", { code: wrong2 }, two.cookie);
    const locked = await req("POST", "/api/verify", { code: code2 }, two.cookie);
    assert.equal(locked.status, 429);
  } finally {
    s.close();
  }
});

test("sign-up without mail set up: no code, credits right away", async () => {
  const app = await createApp({
    port: 0, host: "127.0.0.1", store: "memory", appPassword: "", accounts: true, signup: true, signupPerIp: 0, billingEnv: { TRIAL_CREDITS: "5" }, mailEnv: {},
    goclaw: { url: "http://127.0.0.1:1", token: "", userId: "system", mock: true, mockDelayMs: 10 },
    agents: { scout: "content-scout", writer: "content-writer" },
    jobs: { concurrency: 1, timeoutMs: 60_000 },
  }, memoryAdapter());
  const s = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const root = `http://127.0.0.1:${s.address().port}`;
  const post = (p, body) => fetch(root + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  try {
    await post("/api/setup", { email: "boss@example.com", password: "admin-pass-1" });
    const me = await post("/api/signup", { email: "a@shop.com", password: "password-1" });
    assert.equal(me.user.emailVerified, true);
    assert.equal(me.user.credits, 5);
  } finally {
    s.close();
  }
});
