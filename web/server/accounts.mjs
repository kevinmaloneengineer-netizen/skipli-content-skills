// Customer accounts (ACCOUNTS=1): email + password per customer, each one sees only their own jobs,
// library, calendar and watched channels. The first account (created on the setup screen, or from
// ADMIN_EMAIL / ADMIN_PASSWORD at start) is the admin: it creates the customers' accounts, sets their
// daily limit, and owns the data made before accounts were turned on. With SIGNUP=1 customers also
// create their own account on the login page and start with trial credits (see ./billing.mjs).

import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const COOKIE = "skipli_user";
const DAYS = 30;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(String(password), salt, 32);
  return `${salt}:${key.toString("hex")}`;
}

export async function checkPassword(password, stored) {
  const [salt, hex] = String(stored ?? "").split(":");
  if (!salt || !hex) return false;
  const key = await scryptAsync(String(password), salt, 32);
  const want = Buffer.from(hex, "hex");
  return want.length === key.length && timingSafeEqual(want, key);
}

/** Session secret: SESSION_SECRET, else one generated once and kept in the data folder. */
function sessionSecret(dataDir) {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(dataDir, "session-secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(dataDir, { recursive: true });
  const secret = randomBytes(32).toString("hex");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const cookieOf = (req, name) => (req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === name)?.[1] ?? "";
/** What the client may see of a user. */
export const publicUser = (u) => u && { id: u.id, email: u.email, name: u.name ?? "", role: u.role, dailyLimit: u.dailyLimit ?? null, credits: typeof u.credits === "number" ? u.credits : null, emailVerified: u.emailVerified !== false, disabled: !!u.disabled, createdAt: u.createdAt };

export class AccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {{ store, dataDir: string, signup?: { credits: number, perIp?: number, mailer?: object } | null }} opts  signup:
 *   self sign-up is open; perIp = accounts one IP address may ever create (0 = no cap); with a mailer that is
 *   enabled, a new account confirms its email with a 6-digit code first, and gets the credits then
 * @returns the same gate interface as the single-password mode (middleware, signedIn, login, logout)
 *   plus setup, admin helpers and `ownerId` for data written before accounts existed.
 */
export function createAccounts({ store, dataDir, signup = null }) {
  const secret = sessionSecret(dataDir);
  // The token changes when the password does, so a password change signs out every other device.
  const sign = (user, exp) => createHmac("sha256", secret).update(`${user.id}.${exp}.${user.passHash.slice(-12)}`).digest("hex");
  const token = (user) => {
    const exp = Date.now() + DAYS * 86_400_000;
    return `${user.id}.${exp}.${sign(user, exp)}`;
  };
  function userOf(req) {
    const [id, exp, mac] = cookieOf(req, COOKIE).split(".");
    const user = id && store.getUser(id);
    if (!user || user.disabled || !(Number(exp) > Date.now())) return null;
    const want = Buffer.from(sign(user, exp));
    const got = Buffer.from(mac ?? "");
    return want.length === got.length && timingSafeEqual(want, got) ? user : null;
  }
  const setCookie = (req, res, value, maxAge) => {
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.set("Set-Cookie", `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  };
  const attempts = new Map(); // ip → failed logins
  const signups = new Map(); // ip → sign-up timestamps
  // The sign-up IP is kept as a keyed hash: enough to count accounts per address, not to read it back.
  // Email codes: 6 digits, kept only as a keyed hash on the user, valid 10 minutes, 5 tries, resent at most
  // once a minute and 5 times an hour.
  const codeHash = (userId, code) => createHmac("sha256", secret).update(`otp:${userId}:${code}`).digest("hex");
  async function sendCode(user) {
    const now = Date.now();
    const sends = (user.otp?.sends ?? []).filter((t) => now - t < 3600_000);
    if (user.otp?.sentAt && now - user.otp.sentAt < 60_000) throw new AccountError(429, `Đợi ${Math.ceil((60_000 - (now - user.otp.sentAt)) / 1000)} giây rồi gửi lại mã nhé.`);
    if (sends.length >= 5) throw new AccountError(429, "Đã gửi mã 5 lần trong 1 giờ qua, thử lại sau nhé.");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await store.updateUser(user.id, { otp: { hash: codeHash(user.id, code), exp: now + 10 * 60_000, tries: 0, sentAt: now, sends: [...sends, now] } });
    await signup.mailer.send({
      to: user.email,
      subject: `${code} là mã xác nhận Skipli Content`,
      text: `Mã xác nhận email của bạn: ${code}\n\nMã có hiệu lực trong 10 phút. Nếu bạn không tạo tài khoản Skipli Content, hãy bỏ qua email này.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#1c1a16"><h2 style="margin:0 0 12px">Xác nhận email</h2><p>Nhập mã này trên trang Skipli Content để kích hoạt tài khoản và nhận credit dùng thử:</p><p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:18px 0;padding:14px;text-align:center;background:#f3efe6;border-radius:12px">${code}</p><p style="color:#6e685d;font-size:13px">Mã có hiệu lực trong 10 phút. Nếu bạn không tạo tài khoản, hãy bỏ qua email này.</p></div>`,
    });
  }
  const verifying = () => !!signup?.mailer?.enabled;
  const ipKey = (ip) => createHmac("sha256", secret).update(`signup-ip:${ip}`).digest("hex").slice(0, 32);
  const admin = () => store.listUsers().find((u) => u.role === "admin");

  async function create({ email, password, name = "", role = "member", dailyLimit = null, credits, signupIp, emailVerified }) {
    email = String(email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new AccountError(400, "Email không hợp lệ");
    if (String(password ?? "").length < 8) throw new AccountError(400, "Mật khẩu cần ít nhất 8 ký tự");
    if (store.userByEmail(email)) throw new AccountError(409, "Email này đã có tài khoản");
    return store.addUser({ email, name: String(name).trim().slice(0, 80), role, dailyLimit: dailyLimit ? Number(dailyLimit) : null, ...(typeof credits === "number" ? { credits } : {}), ...(signupIp ? { signupIp } : {}), ...(emailVerified === false ? { emailVerified } : {}), passHash: await hashPassword(password) });
  }

  return {
    mode: "accounts",
    signupOpen: !!signup,
    userOf,
    /** Owner of a record: data from before accounts belongs to the admin. */
    ownerId: (item) => item?.userId ?? admin()?.id ?? null,
    needsSetup: () => store.listUsers().length === 0,

    /** First admin from ADMIN_EMAIL / ADMIN_PASSWORD when the user list is empty. */
    async bootstrap(log = console) {
      if (store.listUsers().length) return;
      if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        await create({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: "Quản trị", role: "admin" });
        log.log?.(`accounts: created the admin ${process.env.ADMIN_EMAIL}`);
      } else {
        log.warn?.("accounts: no user yet. Open the web app to create the admin account (or set ADMIN_EMAIL and ADMIN_PASSWORD).");
      }
    },

    middleware(req, res, next) {
      req.user = userOf(req);
      // Signed up but the email is not confirmed yet: only the confirm calls (and the public pages).
      if (req.user?.emailVerified === false) {
        const allowed = ["/api/session", "/api/logout", "/api/verify", "/api/verify/resend"].includes(req.path) || (req.method === "GET" && req.path.startsWith("/api/samples/")) || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/"));
        if (allowed) return next();
        return res.status(403).set("Cache-Control", "no-store").json({ error: "Xác nhận email trước khi dùng công cụ", verify: true });
      }
      if (req.user) return next();
      // Open without a login: the session and login calls, the page itself, and the canned sample results
      // shown on the home page (no customer data in them).
      const open = ["/api/login", "/api/session", "/api/setup", "/api/logout", "/api/signup", "/api/stripe/webhook"].includes(req.path) || (req.method === "GET" && req.path.startsWith("/api/samples/")) || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/"));
      if (open) return next();
      if (req.path.startsWith("/api/")) return res.status(401).set("Cache-Control", "no-store").json({ error: "Cần đăng nhập", auth: true });
      res.status(401).send("Cần đăng nhập");
    },
    signedIn: (req) => !!userOf(req),

    async login(req, res) {
      const ip = req.ip ?? "?";
      const recent = (attempts.get(ip) ?? []).filter((t) => Date.now() - t < 15 * 60_000);
      if (recent.length >= 10) return res.status(429).json({ error: "Sai mật khẩu nhiều lần, thử lại sau 15 phút." });
      const user = store.userByEmail(req.body?.email);
      const ok = user && (await checkPassword(req.body?.password ?? "", user.passHash));
      if (!ok) {
        attempts.set(ip, [...recent, Date.now()]);
        return res.status(401).json({ error: "Sai email hoặc mật khẩu" });
      }
      if (user.disabled) return res.status(403).json({ error: "Tài khoản đã bị khoá, liên hệ quản trị viên." });
      attempts.delete(ip);
      await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      setCookie(req, res, token(user), DAYS * 86_400);
      res.json({ ok: true, user: publicUser(user) });
    },
    logout(req, res) {
      setCookie(req, res, "", 0);
      res.json({ ok: true });
    },

    /** Self sign-up (SIGNUP=1): a customer account with the trial credits, signed in right away. */
    async signup(req, res) {
      if (!signup) throw new AccountError(403, "Chưa mở đăng ký, liên hệ quản trị viên để có tài khoản.");
      if (store.listUsers().length === 0) throw new AccountError(409, "Web chưa có tài khoản quản trị");
      const ip = req.ip ?? "?";
      const recent = (signups.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
      if (recent.length >= 5) throw new AccountError(429, "Bạn đã tạo nhiều tài khoản trong 1 giờ qua, thử lại sau nhé.");
      // Trial credits are per person: one address only ever makes `perIp` accounts (kept in the store, so restarts don't reset it).
      const key = ipKey(ip);
      const perIp = signup.perIp ?? 2;
      if (perIp && store.listUsers().filter((u) => u.signupIp === key).length >= perIp) {
        throw new AccountError(429, "Mạng này đã tạo đủ số tài khoản dùng thử. Đăng nhập tài khoản cũ hoặc liên hệ quản trị viên.");
      }
      // With mail set up the account starts unconfirmed and without credits; the code brings them.
      const verify = verifying();
      const user = await create({ email: req.body?.email, password: req.body?.password, name: req.body?.name ?? "", credits: verify ? 0 : signup.credits, signupIp: key, ...(verify ? { emailVerified: false } : {}) });
      signups.set(ip, [...recent, Date.now()]);
      await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      setCookie(req, res, token(user), DAYS * 86_400);
      let mailError = null;
      if (verify) {
        await sendCode(user).catch((e) => {
          console.error(`signup: code mail to ${user.email} failed: ${e.message}`);
          mailError = "Chưa gửi được mã xác nhận. Bấm Gửi lại mã sau ít phút.";
        });
      }
      res.status(201).json({ ok: true, user: publicUser(store.getUser(user.id)), mailError });
    },

    /** POST /api/verify { code }: the 6 digits from the email confirm the account and add the trial credits. */
    async verify(req, res) {
      const user = req.user;
      if (user.emailVerified !== false) return res.json({ ok: true, user: publicUser(user) });
      const otp = user.otp;
      const code = String(req.body?.code ?? "").replace(/\D/g, "");
      if (!otp || Date.now() > otp.exp) throw new AccountError(400, "Mã đã hết hạn, bấm Gửi lại mã để nhận mã mới.");
      if (otp.tries >= 5) throw new AccountError(429, "Nhập sai quá 5 lần, bấm Gửi lại mã để nhận mã mới.");
      const want = Buffer.from(otp.hash);
      const got = Buffer.from(codeHash(user.id, code));
      if (code.length !== 6 || want.length !== got.length || !timingSafeEqual(want, got)) {
        await store.updateUser(user.id, { otp: { ...otp, tries: otp.tries + 1 } });
        const left = 4 - otp.tries;
        throw new AccountError(400, left > 0 ? `Mã chưa đúng, còn ${left} lần thử.` : "Mã chưa đúng. Bấm Gửi lại mã để nhận mã mới.");
      }
      const done = await store.updateUser(user.id, { emailVerified: true, otp: null, verifiedAt: new Date().toISOString(), credits: (user.credits ?? 0) + (signup?.credits ?? 0) });
      res.json({ ok: true, user: publicUser(done) });
    },

    /** POST /api/verify/resend: a new code (once a minute, 5 an hour). */
    async resend(req, res) {
      const user = req.user;
      if (user.emailVerified !== false) return res.json({ ok: true });
      if (!verifying()) throw new AccountError(503, "Chưa cấu hình gửi mail");
      try {
        await sendCode(user);
      } catch (e) {
        if (e instanceof AccountError) throw e;
        console.error(`verify: code mail to ${user.email} failed: ${e.message}`);
        throw new AccountError(502, "Chưa gửi được mail, thử lại sau ít phút.");
      }
      res.json({ ok: true });
    },

    /** Setup screen: only while there is no account yet; the first account is the admin. */
    async setup(req, res) {
      if (store.listUsers().length) throw new AccountError(409, "Đã có tài khoản quản trị");
      const user = await create({ ...req.body, role: "admin" });
      await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      setCookie(req, res, token(user), DAYS * 86_400);
      res.status(201).json({ ok: true, user: publicUser(user) });
    },

    async changePassword(req, res) {
      const user = req.user;
      if (!(await checkPassword(req.body?.current ?? "", user.passHash))) throw new AccountError(400, "Mật khẩu hiện tại không đúng");
      if (String(req.body?.next ?? "").length < 8) throw new AccountError(400, "Mật khẩu mới cần ít nhất 8 ký tự");
      const updated = await store.updateUser(user.id, { passHash: await hashPassword(req.body.next) });
      setCookie(req, res, token(updated), DAYS * 86_400); // keep this device signed in
      res.json({ ok: true });
    },

    create,
    /** The admin removes a customer's account (it frees the sign-up slot of its network too). */
    async remove(id, by) {
      const user = store.getUser(id);
      if (!user) throw new AccountError(404, "Không tìm thấy tài khoản");
      if (user.role === "admin" || user.id === by?.id) throw new AccountError(400, "Không xoá được tài khoản quản trị");
      await store.deleteUser(id);
    },
    async update(id, body) {
      const user = store.getUser(id);
      if (!user) throw new AccountError(404, "Không tìm thấy tài khoản");
      const patch = {};
      if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 80);
      if (body.disabled !== undefined) {
        if (user.role === "admin" && body.disabled) throw new AccountError(400, "Không khoá được tài khoản quản trị");
        patch.disabled = !!body.disabled;
      }
      if (body.dailyLimit !== undefined) patch.dailyLimit = body.dailyLimit === null || body.dailyLimit === "" ? null : Math.max(0, Math.min(1000, Number(body.dailyLimit) || 0));
      // The admin tops up (or takes back) credits by hand; turning metering on gives the account a balance.
      if (body.addCredits !== undefined) {
        const n = Math.trunc(Number(body.addCredits));
        if (!Number.isFinite(n) || Math.abs(n) > 100_000) throw new AccountError(400, "Số credit không hợp lệ");
        patch.credits = Math.max(0, (typeof user.credits === "number" ? user.credits : 0) + n);
      }
      if (body.password !== undefined) {
        if (String(body.password).length < 8) throw new AccountError(400, "Mật khẩu cần ít nhất 8 ký tự");
        patch.passHash = await hashPassword(body.password);
      }
      return store.updateUser(id, patch);
    },
  };
}
