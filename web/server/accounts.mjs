// Customer accounts (ACCOUNTS=1): email + password per customer, each one sees only their own jobs,
// library, calendar and watched channels. The first account (created on the setup screen, or from
// ADMIN_EMAIL / ADMIN_PASSWORD at start) is the admin: it creates the customers' accounts, sets their
// daily limit, and owns the data made before accounts were turned on.

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
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
export const publicUser = (u) => u && { id: u.id, email: u.email, name: u.name ?? "", role: u.role, dailyLimit: u.dailyLimit ?? null, disabled: !!u.disabled, createdAt: u.createdAt };

export class AccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {{ store, dataDir: string }} opts
 * @returns the same gate interface as the single-password mode (middleware, signedIn, login, logout)
 *   plus setup, admin helpers and `ownerId` for data written before accounts existed.
 */
export function createAccounts({ store, dataDir }) {
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
  const admin = () => store.listUsers().find((u) => u.role === "admin");

  async function create({ email, password, name = "", role = "member", dailyLimit = null }) {
    email = String(email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new AccountError(400, "Email không hợp lệ");
    if (String(password ?? "").length < 8) throw new AccountError(400, "Mật khẩu cần ít nhất 8 ký tự");
    if (store.userByEmail(email)) throw new AccountError(409, "Email này đã có tài khoản");
    return store.addUser({ email, name: String(name).trim().slice(0, 80), role, dailyLimit: dailyLimit ? Number(dailyLimit) : null, passHash: await hashPassword(password) });
  }

  return {
    mode: "accounts",
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
      if (req.user) return next();
      const open = ["/api/login", "/api/session", "/api/setup", "/api/logout"].includes(req.path) || (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/media/"));
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
      if (body.password !== undefined) {
        if (String(body.password).length < 8) throw new AccountError(400, "Mật khẩu cần ít nhất 8 ký tự");
        patch.passHash = await hashPassword(body.password);
      }
      return store.updateUser(id, patch);
    },
  };
}
