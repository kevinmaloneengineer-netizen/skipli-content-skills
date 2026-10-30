// Customer accounts (ACCOUNTS=1): email + password per customer, each one sees only their own jobs,
// library, calendar and watched channels. The first account (created on the setup screen, or from
// ADMIN_EMAIL / ADMIN_PASSWORD at start) is the admin: it creates the customers' accounts, sets their
// daily limit, and owns the data made before accounts were turned on. With SIGNUP=1 customers also
// create their own account on the login page with their email (confirmed by a 6-digit code sent there,
// ./mailer.mjs) and start with trial credits (see ./billing.mjs).

import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { backupHash, checkTotp, newBackupCodes, newSecret, otpauthUri } from "./totp.mjs";

const scryptAsync = promisify(scrypt);
const COOKIE = "skipli_user";
const PENDING_COOKIE = "skipli_pending"; // a sign-up waiting for its email code (no account yet)
const PENDING_MS = 30 * 60_000;
const MFA_COOKIE = "skipli_mfa"; // password right, waiting for the 2-step code
const MFA_MS = 5 * 60_000;
const DAYS = 30;
const ADMIN_DAYS = 7; // the admin sets prices and credits: a shorter session
const daysOf = (u) => (u.role === "admin" ? ADMIN_DAYS : DAYS);
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
export const publicUser = (u) =>
  u && {
    id: u.id,
    email: u.email ?? null,
    contact: u.email || "", // what the screens show for the account
    name: u.name ?? "",
    role: u.role,
    dailyLimit: u.dailyLimit ?? null,
    credits: typeof u.credits === "number" ? u.credits : null,
    verified: u.verified !== false && u.emailVerified !== false,
    disabled: !!u.disabled,
    disabledReason: u.disabledReason ?? null, // "dispute": locked by a chargeback (server/billing.mjs)
    mfa: u.mfa?.on ? { backupLeft: u.mfa.backup?.length ?? 0 } : null, // 2-step login on (admin)
    createdAt: u.createdAt,
  };
/** Not confirmed yet: an account made before sign-ups waited for their code (cleaned up after a day). */
const unconfirmed = (u) => u?.verified === false || u?.emailVerified === false;

export class AccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {{ store, dataDir: string, signup?: { credits: number, perIp?: number, mailer?: object } | null }} opts  signup:
 *   self sign-up is open; perIp = accounts one IP address may ever create (0 = no cap); with SMS set up, a new
 *   account confirms its email with a 6-digit code first, and is only made (with its credits) then
 * @returns the same gate interface as the single-password mode (middleware, signedIn, login, logout)
 *   plus setup, admin helpers and `ownerId` for data written before accounts existed.
 */
export function createAccounts({ store, dataDir, signup = null }) {
  const secret = sessionSecret(dataDir);
  // The token changes when the password does, so a password change signs out every other device; so does
  // a new session version (sv: "Đăng xuất khỏi mọi thiết bị", 2-step login turned on). Accounts that never
  // bumped it keep the old form, so this change signed nobody out.
  const sign = (user, exp, kind = "") => createHmac("sha256", secret).update(`${kind}${user.id}.${exp}.${user.passHash.slice(-12)}${user.sv ? `.${user.sv}` : ""}`).digest("hex");
  const token = (user) => {
    const exp = Date.now() + daysOf(user) * 86_400_000;
    return `${user.id}.${exp}.${sign(user, exp)}`;
  };
  /** The user a signed cookie names: right signature, not expired, not longer than its role allows. */
  function signedUser(value, kind, maxMs) {
    const [id, exp, mac] = value.split(".");
    const user = id && store.getUser(id);
    const left = Number(exp) - Date.now();
    if (!user || user.disabled || !(left > 0) || left > maxMs(user) + 60_000) return null;
    const want = Buffer.from(sign(user, exp, kind));
    const got = Buffer.from(mac ?? "");
    return want.length === got.length && timingSafeEqual(want, got) ? user : null;
  }
  const userOf = (req) => signedUser(cookieOf(req, COOKIE), "", (u) => daysOf(u) * 86_400_000);
  const mfaUserOf = (req) => signedUser(cookieOf(req, MFA_COOKIE), "mfa:", () => MFA_MS);
  const setCookie = (req, res, value, maxAge, name = COOKIE) => {
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.append("Set-Cookie", `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  };
  const signIn = (req, res, user) => setCookie(req, res, token(user), daysOf(user) * 86_400);
  /** Password right: with 2-step login on, the session waits for the code (the answer says mfa: true). */
  async function passwordOk(req, res, user) {
    if (user.mfa?.on) {
      const exp = Date.now() + MFA_MS;
      setCookie(req, res, `${user.id}.${exp}.${sign(user, exp, "mfa:")}`, MFA_MS / 1000, MFA_COOKIE);
      return false;
    }
    signIn(req, res, user);
    return true;
  }
  /** The 6 digits from the app, or a backup code (used up): the patch that records it, or null. */
  function mfaMatch(user, raw) {
    const step = checkTotp(user.mfa.secret, raw, { lastStep: user.mfa.lastStep ?? -1 });
    if (step !== null) return { mfa: { ...user.mfa, lastStep: step } };
    const h = backupHash(user.id, raw);
    const backup = user.mfa.backup ?? [];
    if (String(raw ?? "").replace(/[^a-z0-9]/gi, "").length === 8 && backup.includes(h)) return { mfa: { ...user.mfa, backup: backup.filter((x) => x !== h) } };
    return null;
  }

  // Sign-ups waiting for their email code live here, not in the user list: the account is only made
  // once the code is right, so an unconfirmed email never shows up (or holds the address) anywhere.
  // In memory: a restart drops them, and the person signs up again.
  const pending = new Map(); // id -> { id, email, name, passHash, signupIp, createdAt, otp }
  const pendingMac = (id) => createHmac("sha256", secret).update(`pending:${id}`).digest("hex");
  function pendingOf(req) {
    const now = Date.now();
    for (const [id, p] of pending) if (now - p.createdAt > PENDING_MS) pending.delete(id);
    const [id, mac] = cookieOf(req, PENDING_COOKIE).split(".");
    const rec = id && pending.get(id);
    if (!rec) return null;
    const want = Buffer.from(pendingMac(id));
    const got = Buffer.from(mac ?? "");
    return want.length === got.length && timingSafeEqual(want, got) ? rec : null;
  }
  /** What the session shows for a pending sign-up (the login page asks for its code). */
  const publicPending = (p) => p && { id: p.id, email: p.email, contact: p.email, name: p.name, role: "member", dailyLimit: null, credits: 0, verified: false, disabled: false, createdAt: new Date(p.createdAt).toISOString() };
  // Failed logins: 10 per account and address (people sharing one office network don't lock each other
  // out), and a wider 100 per address against trying a few passwords on many accounts. 15 minutes each.
  const attempts = new Map(); // "ip|email" and "ip" → failure times
  const LOGIN_MS = 15 * 60_000;
  const recentOf = (key) => (attempts.get(key) ?? []).filter((t) => Date.now() - t < LOGIN_MS);
  function fail(...keys) {
    if (attempts.size > 20_000) for (const [k, list] of attempts) if (!list.some((t) => Date.now() - t < LOGIN_MS)) attempts.delete(k); // old entries go
    for (const k of keys) attempts.set(k, [...recentOf(k), Date.now()]);
  }
  // Sign-ups across the whole server (not per address: an office shares one), so a script cannot burn
  // the mail quota (Gmail ~500 a day) or, without mail, farm trial credits.
  let signupTimes = [];
  const SIGNUPS_PER_HOUR = Number(process.env.SIGNUP_PER_HOUR) || 60;
  // The sign-up IP is kept as a keyed hash: enough to count accounts per address, not to read it back.
  // Email codes: 6 digits, kept only as a keyed hash, valid 10 minutes, 5 tries, resent at most once a
  // minute and 5 times an hour.
  const mailer = signup?.mailer ?? { enabled: false };
  const codeHash = (userId, code) => createHmac("sha256", secret).update(`otp:${userId}:${code}`).digest("hex");
  const MAILS = {
    otp: { subject: (c) => `${c} là mã xác nhận Skipli Content`, title: "Xác nhận email", lead: "Nhập mã này trên trang Skipli Content để kích hoạt tài khoản và nhận credit dùng thử:", tail: "Nếu bạn không tạo tài khoản Skipli Content, hãy bỏ qua email này." },
    resetOtp: { subject: (c) => `${c} là mã đặt lại mật khẩu Skipli Content`, title: "Đặt lại mật khẩu", lead: "Nhập mã này trên trang Skipli Content để đặt mật khẩu mới:", tail: "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu cũ vẫn dùng được." },
  };
  // field: "otp" confirms a new account, "resetOtp" sets a new password; each has its own limits.
  async function sendCode(user, field = "otp", save = (patch) => store.updateUser(user.id, patch)) {
    const now = Date.now();
    const last = user[field];
    const sends = (last?.sends ?? []).filter((t) => now - t < 3600_000);
    if (last?.sentAt && now - last.sentAt < 60_000) throw new AccountError(429, `Đợi ${Math.ceil((60_000 - (now - last.sentAt)) / 1000)} giây rồi gửi lại mã nhé.`);
    if (sends.length >= 5) throw new AccountError(429, "Đã gửi mã 5 lần trong 1 giờ qua, thử lại sau nhé.");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await save({ [field]: { exp: now + 10 * 60_000, tries: 0, sentAt: now, sends: [...sends, now], hash: codeHash(`${field}:${user.id}`, code) } });
    const m = MAILS[field];
    await mailer.send({
      to: user.email,
      subject: m.subject(code),
      text: `${m.lead} ${code}\n\nMã có hiệu lực trong 10 phút. ${m.tail}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#1c1a16"><h2 style="margin:0 0 12px">${m.title}</h2><p>${m.lead}</p><p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:18px 0;padding:14px;text-align:center;background:#f3efe6;border-radius:12px">${code}</p><p style="color:#6e685d;font-size:13px">Mã có hiệu lực trong 10 phút. ${m.tail}</p></div>`,
    });
  }
  /** The code typed for `field`: right → true; wrong / expired / too many tries → an AccountError. */
  async function checkCode(user, field, raw, save = (patch) => store.updateUser(user.id, patch)) {
    const otp = user[field];
    const code = String(raw ?? "").replace(/\D/g, "");
    if (!otp || Date.now() > otp.exp) throw new AccountError(400, "Mã đã hết hạn, bấm Gửi lại mã để nhận mã mới.");
    if (otp.tries >= 5) throw new AccountError(429, "Nhập sai quá 5 lần, bấm Gửi lại mã để nhận mã mới.");
    let right = false;
    if (code.length === 6 && otp.hash) {
      const want = Buffer.from(otp.hash);
      const got = Buffer.from(codeHash(`${field}:${user.id}`, code));
      right = want.length === got.length && timingSafeEqual(want, got);
    }
    if (!right) {
      await save({ [field]: { ...otp, tries: otp.tries + 1 } });
      const left = 4 - otp.tries;
      throw new AccountError(400, left > 0 ? `Mã chưa đúng, còn ${left} lần thử.` : "Mã chưa đúng. Bấm Gửi lại mã để nhận mã mới.");
    }
    return true;
  }
  const mailFailure = "Chưa gửi được email, thử lại sau ít phút.";
  const resets = new Map(); // ip → password-reset requests
  const verifying = () => !!mailer.enabled;
  const ipKey = (ip) => createHmac("sha256", secret).update(`signup-ip:${ip}`).digest("hex").slice(0, 32);
  const admin = () => store.listUsers().find((u) => u.role === "admin");

  async function create({ email, password, name = "", role = "member", dailyLimit = null, credits, signupIp, verified }) {
    email = String(email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new AccountError(400, "Email không hợp lệ");
    if (store.userByEmail(email)) throw new AccountError(409, "Email này đã có tài khoản");
    if (String(password ?? "").length < 8) throw new AccountError(400, "Mật khẩu cần ít nhất 8 ký tự");
    return store.addUser({ email, name: String(name).trim().slice(0, 80), role, dailyLimit: dailyLimit ? Number(dailyLimit) : null, ...(typeof credits === "number" ? { credits } : {}), ...(signupIp ? { signupIp } : {}), ...(verified === false ? { verified } : {}), passHash: await hashPassword(password) });
  }

  return {
    mode: "accounts",
    signupOpen: !!signup,
    userOf,
    /** Owner of a record: data from before accounts belongs to the admin. */
    ownerId: (item) => item?.userId ?? admin()?.id ?? null,
    needsSetup: () => store.listUsers().length === 0,

    /** Accounts left unconfirmed from before (when sign-up made the account first), older than a day. */
    async removeStale(maxAgeMs = 86_400_000) {
      let n = 0;
      for (const u of store.listUsers()) {
        if (unconfirmed(u) && u.role !== "admin" && Date.now() - Date.parse(u.createdAt) > maxAgeMs) {
          await store.deleteUser(u.id);
          n++;
        }
      }
      return n;
    },

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
      // An old account not confirmed yet: only the confirm calls (and the public pages).
      if (unconfirmed(req.user)) {
        const allowed = ["/api/session", "/api/logout", "/api/verify", "/api/verify/resend"].includes(req.path) || (req.method === "GET" && /^\/api\/(samples|public)\//.test(req.path)) || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/")) || (req.method === "GET" && req.path.startsWith("/media/") && !!req.sharedJobs);
        if (allowed) return next();
        return res.status(403).set("Cache-Control", "no-store").json({ error: "Xác nhận email trước khi dùng công cụ", verify: true });
      }
      if (req.user) return next();
      // Open without a login: the session and login calls, the page itself, and the canned sample results
      // shown on the home page (no customer data in them).
      const open = ["/api/login", "/api/login/mfa", "/api/session", "/api/setup", "/api/logout", "/api/signup", "/api/stripe/webhook", "/api/password/forgot", "/api/password/reset", "/api/client-error", "/api/verify", "/api/verify/resend"].includes(req.path) || (req.method === "GET" && /^\/api\/(samples|public)\//.test(req.path)) || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/")) || (req.method === "GET" && req.path.startsWith("/media/") && !!req.sharedJobs);
      if (open) return next();
      if (req.path.startsWith("/api/")) return res.status(401).set("Cache-Control", "no-store").json({ error: "Cần đăng nhập", auth: true });
      res.status(401).send("Cần đăng nhập");
    },
    signedIn: (req) => !!userOf(req),

    async login(req, res) {
      const login = req.body?.login ?? req.body?.email;
      const ip = req.ip ?? "?";
      const key = `${ip}|${String(login ?? "").trim().toLowerCase()}`;
      if (recentOf(key).length >= 10 || recentOf(ip).length >= 100) return res.status(429).json({ error: "Sai mật khẩu nhiều lần, thử lại sau 15 phút." });
      const user = store.userByEmail(login);
      const ok = user && (await checkPassword(req.body?.password ?? "", user.passHash));
      if (!ok) {
        fail(key, ip);
        return res.status(401).json({ error: "Sai email hoặc mật khẩu" });
      }
      if (user.disabled) return res.status(403).json({ error: user.disabledReason === "dispute" ? "Tài khoản tạm khoá vì có yêu cầu hoàn tiền qua ngân hàng cho một lần nạp. Liên hệ hỗ trợ để mở lại." : "Tài khoản đã bị khoá, liên hệ quản trị viên." });
      attempts.delete(key);
      if (!(await passwordOk(req, res, user))) return res.json({ ok: true, mfa: true });
      await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      res.json({ ok: true, user: publicUser(user) });
    },
    /** POST /api/login/mfa { code }: the second step, within 5 minutes of the password. */
    async loginMfa(req, res) {
      const user = mfaUserOf(req);
      if (!user?.mfa?.on) throw new AccountError(400, "Phiên đăng nhập đã hết hạn, nhập lại mật khẩu nhé.");
      const ip = req.ip ?? "?";
      const key = `mfa|${user.id}`;
      if (recentOf(key).length >= 10 || recentOf(ip).length >= 100) throw new AccountError(429, "Sai mã nhiều lần, thử lại sau 15 phút.");
      const patch = mfaMatch(user, req.body?.code);
      if (!patch) {
        fail(key, ip);
        throw new AccountError(400, "Mã chưa đúng. Nhập mã đang hiện trong ứng dụng xác thực, hoặc một mã dự phòng.");
      }
      attempts.delete(key);
      const done = await store.updateUser(user.id, { ...patch, lastLoginAt: new Date().toISOString() });
      setCookie(req, res, "", 0, MFA_COOKIE);
      signIn(req, res, done);
      res.json({ ok: true, user: publicUser(done) });
    },
    /** Password typed, 2-step code not yet (the login page asks for it). */
    mfaPending: (req) => !!mfaUserOf(req)?.mfa?.on,
    logout(req, res) {
      const p = pendingOf(req);
      if (p) pending.delete(p.id);
      setCookie(req, res, "", 0);
      setCookie(req, res, "", 0, PENDING_COOKIE);
      setCookie(req, res, "", 0, MFA_COOKIE);
      res.json({ ok: true });
    },
    /** POST /api/me/logout-all: every other browser signed in to this account is signed out; this one stays. */
    async logoutAll(req, res) {
      const done = await store.updateUser(req.user.id, { sv: (req.user.sv ?? 0) + 1 });
      signIn(req, res, done);
      res.json({ ok: true });
    },

    /** Admin 2-step login, step 1: a new secret for the app (kept aside until a code from it comes back). */
    async mfaSetup(req, res) {
      const user = req.user;
      if (user.role !== "admin") throw new AccountError(403, "Xác thực 2 lớp hiện chỉ dành cho tài khoản quản trị");
      if (user.mfa?.on) throw new AccountError(409, "Xác thực 2 lớp đã bật");
      const secret = newSecret();
      await store.updateUser(user.id, { mfaSetup: { secret, at: Date.now() } });
      res.json({ secret, uri: otpauthUri({ secret, account: user.email }) });
    },
    /** Step 2: the password and a code from the app turn it on; the backup codes are shown once. */
    async mfaEnable(req, res) {
      const user = req.user;
      if (user.role !== "admin") throw new AccountError(403, "Xác thực 2 lớp hiện chỉ dành cho tài khoản quản trị");
      if (user.mfa?.on) throw new AccountError(409, "Xác thực 2 lớp đã bật");
      if (!(await checkPassword(req.body?.password ?? "", user.passHash))) throw new AccountError(400, "Mật khẩu hiện tại không đúng");
      const setup = user.mfaSetup;
      if (!setup || Date.now() - setup.at > 30 * 60_000) throw new AccountError(400, "Mã QR đã hết hạn, bấm Bật lại để lấy mã mới.");
      const step = checkTotp(setup.secret, req.body?.code);
      if (step === null) throw new AccountError(400, "Mã chưa đúng. Kiểm tra giờ trên điện thoại và nhập mã đang hiện.");
      const codes = newBackupCodes();
      // Browsers signed in before 2-step login was on are signed out (sv), this one stays.
      const done = await store.updateUser(user.id, { mfa: { on: true, secret: setup.secret, lastStep: step, backup: codes.map((c) => backupHash(user.id, c)), at: new Date().toISOString() }, mfaSetup: null, sv: (user.sv ?? 0) + 1 });
      signIn(req, res, done);
      res.json({ ok: true, codes, user: publicUser(done) });
    },
    /** Turn it off: the password and a current code (or a backup code). */
    async mfaDisable(req, res) {
      const user = req.user;
      if (!user.mfa?.on) return res.json({ ok: true, user: publicUser(user) });
      if (!(await checkPassword(req.body?.password ?? "", user.passHash))) throw new AccountError(400, "Mật khẩu hiện tại không đúng");
      if (!mfaMatch(user, req.body?.code)) throw new AccountError(400, "Mã chưa đúng");
      const done = await store.updateUser(user.id, { mfa: null, mfaSetup: null });
      res.json({ ok: true, user: publicUser(done) });
    },
    pendingOf: (req) => publicPending(pendingOf(req)),

    /** Self sign-up (SIGNUP=1): a customer account with the trial credits, signed in right away. */
    async signup(req, res) {
      if (!signup) throw new AccountError(403, "Chưa mở đăng ký, liên hệ quản trị viên để có tài khoản.");
      if (store.listUsers().length === 0) throw new AccountError(409, "Web chưa có tài khoản quản trị");
      signupTimes = signupTimes.filter((t) => Date.now() - t < 3600_000);
      if (signupTimes.length >= SIGNUPS_PER_HOUR) throw new AccountError(429, "Đang có quá nhiều lượt đăng ký, thử lại sau ít phút nhé.");
      signupTimes.push(Date.now());
      // Optional cap (admin page, 0 = off): one address only ever makes `perIp` accounts (kept in the store, so restarts don't reset it).
      const key = ipKey(req.ip ?? "?");
      const perIp = signup.perIp ?? 0;
      if (perIp && store.listUsers().filter((u) => u.signupIp === key).length >= perIp) {
        throw new AccountError(429, "Mạng này đã tạo đủ số tài khoản dùng thử. Đăng nhập tài khoản cũ hoặc liên hệ quản trị viên.");
      }
      // Without mail set up: the account is made at once, with the trial credits.
      if (!verifying()) {
        const user = await create({ email: req.body?.email, password: req.body?.password, name: req.body?.name ?? "", credits: signup.credits, signupIp: key });
        await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
        signIn(req, res, user);
        return res.status(201).json({ ok: true, user: publicUser(user), sendError: null });
      }
      // With mail: checked like a real account, but only held here until the code comes back.
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(email)) throw new AccountError(400, "Email không hợp lệ");
      if (store.userByEmail(email)) throw new AccountError(409, "Email này đã có tài khoản");
      if (String(req.body?.password ?? "").length < 8) throw new AccountError(400, "Mật khẩu cần ít nhất 8 ký tự");
      for (const [pid, p] of pending) if (p.email === email) pending.delete(pid); // signing up again replaces the old attempt
      const rec = { id: randomBytes(12).toString("hex"), email, name: String(req.body?.name ?? "").trim().slice(0, 80), passHash: await hashPassword(req.body.password), signupIp: key, createdAt: Date.now() };
      pending.set(rec.id, rec);
      setCookie(req, res, `${rec.id}.${pendingMac(rec.id)}`, PENDING_MS / 1000, PENDING_COOKIE);
      if (cookieOf(req, COOKIE)) setCookie(req, res, "", 0); // a session of another account on this browser ends
      let sendError = null;
      await sendCode(rec, "otp", (patch) => Object.assign(rec, patch)).catch((e) => {
        console.error(`signup: code mail to ${email} failed: ${e.message}`);
        sendError = "Chưa gửi được mã xác nhận. Bấm Gửi lại mã sau ít phút.";
      });
      res.status(201).json({ ok: true, user: publicPending(rec), sendError });
    },

    /** POST /api/verify { code }: the 6 digits from the email make the account, with the trial credits. */
    async verify(req, res) {
      const rec = !req.user && pendingOf(req);
      if (rec) {
        await checkCode(rec, "otp", req.body?.code, (patch) => Object.assign(rec, patch));
        // The code is right: now the account exists (unless the email was taken meanwhile).
        if (store.userByEmail(rec.email)) {
          pending.delete(rec.id);
          throw new AccountError(409, "Email này đã có tài khoản");
        }
        const user = await store.addUser({ email: rec.email, name: rec.name, role: "member", dailyLimit: null, credits: signup?.credits ?? 0, signupIp: rec.signupIp, passHash: rec.passHash, verifiedAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() });
        pending.delete(rec.id);
        signIn(req, res, user);
        setCookie(req, res, "", 0, PENDING_COOKIE);
        return res.json({ ok: true, user: publicUser(user) });
      }
      const user = req.user;
      if (!user) throw new AccountError(400, "Phiên đăng ký đã hết hạn (30 phút). Đăng ký lại nhé.");
      if (!unconfirmed(user)) return res.json({ ok: true, user: publicUser(user) });
      await checkCode(user, "otp", req.body?.code);
      const done = await store.updateUser(user.id, { verified: true, emailVerified: null, otp: null, verifiedAt: new Date().toISOString(), credits: (user.credits ?? 0) + (signup?.credits ?? 0) });
      res.json({ ok: true, user: publicUser(done) });
    },

    /** POST /api/verify/resend: a new code (once a minute, 5 an hour). */
    async resend(req, res) {
      const rec = !req.user && pendingOf(req);
      const user = rec || req.user;
      if (!user) throw new AccountError(400, "Phiên đăng ký đã hết hạn (30 phút). Đăng ký lại nhé.");
      if (!rec && !unconfirmed(user)) return res.json({ ok: true });
      if (!verifying()) throw new AccountError(503, "Chưa cấu hình gửi email");
      try {
        await sendCode(user, "otp", rec ? (patch) => Object.assign(rec, patch) : undefined);
      } catch (e) {
        if (e instanceof AccountError) throw e;
        console.error(`verify: code mail to ${user.email} failed: ${e.message}`);
        throw new AccountError(502, mailFailure);
      }
      res.json({ ok: true });
    },

    /**
     * Forgot password, step 1: POST /api/password/forgot { email } mails a code. The answer is the same
     * whether or not the email has an account (no way to probe who is signed up).
     */
    async forgot(req, res) {
      if (!verifying()) throw new AccountError(503, "Web chưa bật gửi email. Liên hệ quản trị viên để đặt lại mật khẩu.");
      const ip = req.ip ?? "?";
      const recent = (resets.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
      if (recent.length >= 10) throw new AccountError(429, "Bạn đã yêu cầu nhiều lần, thử lại sau 1 giờ nhé.");
      resets.set(ip, [...recent, Date.now()]);
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(email)) throw new AccountError(400, "Email không hợp lệ");
      const user = store.userByEmail(email);
      if (user && !user.disabled) {
        try {
          await sendCode(user, "resetOtp");
        } catch (e) {
          if (e instanceof AccountError) throw e; // wait a minute / too many today
          console.error(`forgot: code mail to ${email} failed: ${e.message}`);
          throw new AccountError(502, mailFailure);
        }
      }
      res.json({ ok: true, email });
    },

    /** Step 2: POST /api/password/reset { email, code, password } sets the password and signs in. */
    async reset(req, res) {
      const user = store.userByEmail(req.body?.email);
      if (!user || user.disabled || !user.resetOtp) throw new AccountError(400, "Mã đã hết hạn, bấm Gửi lại mã để nhận mã mới.");
      if (String(req.body?.password ?? "").length < 8) throw new AccountError(400, "Mật khẩu mới cần ít nhất 8 ký tự");
      await checkCode(user, "resetOtp", req.body?.code);
      // The code proves the email, so an old account still waiting for its sign-up code is confirmed too.
      const confirm = unconfirmed(user) ? { verified: true, emailVerified: null, otp: null, verifiedAt: new Date().toISOString(), credits: (user.credits ?? 0) + (signup?.credits ?? 0) } : {};
      const done = await store.updateUser(user.id, { passHash: await hashPassword(req.body.password), resetOtp: null, ...confirm });
      // The new password signs out every other device. The email code is one step: with 2-step login on,
      // the app code is still asked before this browser is signed in.
      if (!(await passwordOk(req, res, done))) return res.json({ ok: true, mfa: true });
      await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      res.json({ ok: true, user: publicUser(done) });
    },

    /** Setup screen: only while there is no account yet; the first account is the admin. */
    async setup(req, res) {
      if (store.listUsers().length) throw new AccountError(409, "Đã có tài khoản quản trị");
      const user = await create({ ...req.body, role: "admin" });
      await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
      signIn(req, res, user);
      res.status(201).json({ ok: true, user: publicUser(user) });
    },

    async changePassword(req, res) {
      const user = req.user;
      if (!(await checkPassword(req.body?.current ?? "", user.passHash))) throw new AccountError(400, "Mật khẩu hiện tại không đúng");
      if (String(req.body?.next ?? "").length < 8) throw new AccountError(400, "Mật khẩu mới cần ít nhất 8 ký tự");
      const updated = await store.updateUser(user.id, { passHash: await hashPassword(req.body.next) });
      signIn(req, res, updated); // keep this device signed in
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
    async update(id, body, by) {
      const user = store.getUser(id);
      if (!user) throw new AccountError(404, "Không tìm thấy tài khoản");
      const patch = {};
      if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 80);
      if (body.disabled !== undefined) {
        if (user.role === "admin" && body.disabled) throw new AccountError(400, "Không khoá được tài khoản quản trị");
        patch.disabled = !!body.disabled;
        if (!body.disabled) patch.disabledReason = null;
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
      if (body.signOut) patch.sv = (user.sv ?? 0) + 1; // every browser signed in to this account is signed out
      if (body.mfaOff) {
        if (id === by?.id) throw new AccountError(400, "Tự tắt xác thực 2 lớp ở trang Tài khoản");
        patch.mfa = null; // lost phone and backup codes: another admin turns it off
        patch.mfaSetup = null;
      }
      return store.updateUser(id, patch);
    },
  };
}
