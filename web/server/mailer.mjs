// Outgoing mail over SMTP (Gmail with an App Password by default), with no package: one TLS connection
// per message, AUTH LOGIN, then the message as UTF-8 multipart text + HTML. Used for the sign-up codes.
//
// SMTP_USER / SMTP_PASS turn it on; SMTP_HOST (smtp.gmail.com), SMTP_PORT (465, implicit TLS) and
// MAIL_FROM (the user) are optional. MAIL_LOG=1 prints the mails in the log instead (local testing).

import net from "node:net";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

export class MailError extends Error {}

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
/** Header text outside ASCII as an RFC 2047 encoded word. */
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
/** Base64 body wrapped at 76 columns. */
const body64 = (s) => b64(s).replace(/.{1,76}/g, "$&\r\n");

/** The raw message: headers, then text and HTML alternatives. */
export function buildMessage({ from, fromName, to, subject, text, html, id = randomUUID() }) {
  const boundary = `b-${id}`;
  const domain = String(from).split("@")[1] ?? "localhost";
  return [
    `From: ${fromName ? `${word(fromName)} ` : ""}<${from}>`,
    `To: <${to}>`,
    `Subject: ${word(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${id}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body64(html ?? text),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/**
 * One SMTP conversation. Replies are read line by line; a multi-line reply ends at "NNN " (space).
 * @param {{ host, port, user, pass, secure?: boolean, timeoutMs?: number }} server  secure=false: plain TCP (tests)
 */
export function smtpSend(server, { from, to, data }) {
  const { host, port, user, pass, secure = true, timeoutMs = 20_000 } = server;
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    socket.setTimeout(timeoutMs, () => socket.destroy(new MailError("SMTP: hết thời gian chờ")));
    let buf = "";
    let waiting = null; // resolve of the reply we wait for
    const lines = [];
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        lines.push(line);
        if (/^\d{3} /.test(line) && waiting) {
          const reply = lines.splice(0).join("\n");
          const w = waiting;
          waiting = null;
          w(reply);
        }
      }
    });
    socket.on("error", (e) => reject(e instanceof MailError ? e : new MailError(`SMTP: ${e.message}`)));
    const reply = () => new Promise((r) => (waiting = r));
    const expect = async (code, send) => {
      const pending = reply();
      if (send !== undefined) socket.write(`${send}\r\n`);
      const text = await pending;
      const last = text.split("\n").at(-1);
      if (!last.startsWith(String(code))) throw new MailError(`SMTP: ${last}`);
      return text;
    };
    (async () => {
      await expect(220);
      await expect(250, `EHLO ${host === "localhost" ? "localhost" : "skipli-content"}`);
      if (user) {
        await expect(334, "AUTH LOGIN");
        await expect(334, b64(user));
        await expect(235, b64(pass));
      }
      await expect(250, `MAIL FROM:<${from}>`);
      await expect(250, `RCPT TO:<${to}>`);
      await expect(354, "DATA");
      // Dot-stuffing: a line starting with "." gets one more.
      await expect(250, `${data.replace(/\r\n\./g, "\r\n..")}\r\n.`);
      socket.end("QUIT\r\n");
      resolve();
    })().catch((e) => {
      socket.destroy();
      reject(e);
    });
  });
}

/** The app's mailer: `enabled` when SMTP is configured; send({ to, subject, text, html }). */
export function createMailer(env = process.env) {
  const user = env.SMTP_USER ?? "";
  const pass = (env.SMTP_PASS ?? "").replace(/\s+/g, ""); // Gmail shows App Passwords in groups of 4
  const server = { host: env.SMTP_HOST || "smtp.gmail.com", port: Number(env.SMTP_PORT) || 465, user, pass };
  const from = env.MAIL_FROM || user;
  // MAIL_LOG=1 without SMTP (local testing): the mail is printed in the server log instead of sent.
  if (!(user && pass) && env.MAIL_LOG === "1") {
    return { enabled: true, async send({ to, subject, text }) { console.log(`mail (MAIL_LOG) to ${to}: ${subject}\n${text}`); } };
  }
  return {
    enabled: !!(user && pass),
    async send({ to, subject, text, html }) {
      if (!user || !pass) throw new MailError("Chưa cấu hình gửi mail (SMTP_USER, SMTP_PASS)");
      await smtpSend(server, { from, to, data: buildMessage({ from, fromName: env.MAIL_FROM_NAME || "Skipli Content", to, subject, text, html }) });
    },
  };
}
