// "Unlock your result": before a customer sees their first full result, they confirm a US phone
// number with a code sent by SMS (Twilio), then give a few details about their restaurant. The
// details go on the account and, when GOOGLE_SHEET_ID is set, into the team's Google Sheet.
//
// Twilio keys follow the Stripe pattern: the live ones only on the production server, the test
// (sandbox) ones everywhere else, so nobody is texted or billed by mistake. Twilio's test keys never
// deliver a message; outside production the code is written to the server log instead (never to the page).
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export class PhoneError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** The Twilio account this server sends from: live keys in production, test (sandbox) keys elsewhere. */
export function twilioConfig(env = process.env) {
  const live = env.NODE_ENV === "production";
  const pick = (name) => (live ? env[`${name}_LIVE`] : env[`${name}_TEST`]) || env[name] || "";
  return { live, sid: pick("TWILIO_ACCOUNT_SID"), token: pick("TWILIO_AUTH_TOKEN"), from: pick("TWILIO_PHONE_NUMBER") };
}

/**
 * A phone number as +E.164, or null. US numbers by default ("(404) 555-0123", "404-555-0123",
 * "+1 404 555 0123"); with `intl` (admins testing) a Vietnamese number too ("0912 345 678", "+84 912…").
 */
export function normalizePhone(raw, { intl = false } = {}) {
  const text = String(raw ?? "").trim();
  const digits = text.replace(/\D/g, "");
  const us = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (us && /^[2-9]\d{2}[2-9]\d{6}$/.test(us) && !(text.startsWith("+") && !text.startsWith("+1"))) return `+1${us}`;
  if (!intl) return null;
  const vn = digits.startsWith("84") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : null;
  if (vn && /^[35789]\d{8}$/.test(vn)) return `+84${vn}`;
  return null;
}

/** "(***) ***-2826" for a US number, "+84 *** *** 678" for another. */
export function maskPhone(e164) {
  const p = String(e164 ?? "");
  return p.startsWith("+1") ? `(***) ***-${p.slice(-4)}` : `${p.slice(0, 3)} *** *** ${p.slice(-3)}`;
}

const CHANNELS = ["facebook", "instagram", "tiktok", "google", "yelp", "website", "none"];
const MARKETERS = ["owner", "staff", "agency", "nobody"];
const BUDGETS = ["0", "under-200", "200-500", "500-1000", "over-1000"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Column names of the leads sheet, in the order `row` writes them. */
export const LEAD_HEADER = ["Time (UTC)", "Full name", "Work email", "Phone", "Restaurant", "City / State", "Channels", "Who runs marketing", "Monthly marketing budget", "Account email", "Account id", "Language"];

/**
 * @param {{ store: object, env?: object, sheets?: { enabled: boolean, append(row: any[]): Promise<void> }, fetchFn?: typeof fetch, log?: (msg: string) => void, onError?: (e: Error) => void }} opts
 */
export function createPhoneGate({ store, env = process.env, sheets = null, fetchFn = fetch, log = (m) => console.log(m), onError = () => {} }) {
  const tw = twilioConfig(env);
  const enabled = env.PHONE_GATE !== "0" && !!(tw.sid && tw.token && tw.from);
  const key = randomBytes(32); // codes live 10 minutes: a restart simply asks for a new one
  const hash = (userId, phone, code) => createHmac("sha256", key).update(`${userId}:${phone}:${code}`).digest("hex");
  const byPhone = new Map(); // phone → send times (last hour), across accounts
  const byIp = new Map(); // ip → send times (last hour)
  const recent = (map, k, now) => (map.get(k) ?? []).filter((t) => now - t < 3600_000);

  async function sms(to, body) {
    const r = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${tw.sid}:${tw.token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: tw.from, To: to, Body: body }),
    });
    if (r.ok) return;
    const j = await r.json().catch(() => ({}));
    // 21211 / 21614: not a number that can get a text; 21408: country not enabled on the Twilio account.
    if ([21211, 21614, 21408].includes(j.code)) throw new PhoneError(400, "Số này không nhận được tin nhắn, kiểm tra lại số điện thoại nhé.");
    throw new Error(`Twilio ${r.status} ${j.code ?? ""}: ${j.message ?? ""}`);
  }

  const userOf = (id) => store.getUser(id);

  return {
    enabled,
    live: tw.live,
    /** Still has to unlock: the gate is on and this account has not given its details yet. */
    pending: (user) => enabled && !!user && !user.lead,

    async send(userId, raw, { intl = false, ip = "" } = {}) {
      if (!enabled) throw new PhoneError(404, "Chưa bật xác minh số điện thoại");
      const user = userOf(userId);
      const phone = normalizePhone(raw, { intl });
      if (!phone) throw new PhoneError(400, intl ? "Số điện thoại chưa đúng. Nhập số Mỹ (404) 555-0123 hoặc số Việt Nam 0912 345 678." : "Nhập số điện thoại Mỹ, ví dụ (404) 555-0123.");
      const now = Date.now();
      const last = user.phoneOtp;
      if (last?.sentAt && now - last.sentAt < 30_000) throw new PhoneError(429, `Đợi ${Math.ceil((30_000 - (now - last.sentAt)) / 1000)} giây rồi gửi lại mã nhé.`);
      const sends = (last?.sends ?? []).filter((t) => now - t < 3600_000);
      if (sends.length >= 5 || recent(byPhone, phone, now).length >= 5 || (ip && recent(byIp, ip, now).length >= 10)) throw new PhoneError(429, "Đã gửi mã nhiều lần trong 1 giờ qua, thử lại sau nhé.");
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await sms(phone, `${code} is your Skipli Content verification code. It expires in 10 minutes.`);
      byPhone.set(phone, [...recent(byPhone, phone, now), now]);
      if (ip) byIp.set(ip, [...recent(byIp, ip, now), now]);
      await store.updateUser(userId, { phoneOtp: { phone, hash: hash(userId, phone, code), exp: now + 10 * 60_000, tries: 0, sentAt: now, sends: [...sends, now] } });
      if (!tw.live) log(`[phone] test mode, code for ${maskPhone(phone)}: ${code}`);
      return { sentTo: maskPhone(phone), resendIn: 30 };
    },

    async verify(userId, raw) {
      const user = userOf(userId);
      const otp = user?.phoneOtp;
      const code = String(raw ?? "").replace(/\D/g, "");
      if (!otp || Date.now() > otp.exp) throw new PhoneError(400, "Mã đã hết hạn, bấm Gửi lại mã để nhận mã mới.");
      if (otp.tries >= 5) throw new PhoneError(429, "Nhập sai quá 5 lần, bấm Gửi lại mã để nhận mã mới.");
      const want = Buffer.from(otp.hash);
      const got = Buffer.from(hash(userId, otp.phone, code));
      if (code.length !== 6 || want.length !== got.length || !timingSafeEqual(want, got)) {
        await store.updateUser(userId, { phoneOtp: { ...otp, tries: otp.tries + 1 } });
        const left = 4 - otp.tries;
        throw new PhoneError(400, left > 0 ? `Mã chưa đúng, còn ${left} lần thử.` : "Mã chưa đúng. Bấm Gửi lại mã để nhận mã mới.");
      }
      await store.updateUser(userId, { phone: otp.phone, phoneVerifiedAt: new Date().toISOString(), phoneOtp: null });
      return { phone: maskPhone(otp.phone) };
    },

    async details(userId, body = {}, { lang = "vi" } = {}) {
      const user = userOf(userId);
      if (!user?.phone) throw new PhoneError(400, "Xác minh số điện thoại trước nhé.");
      const text = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
      const lead = {
        name: text(body.name, 80),
        email: text(body.email, 120).toLowerCase(),
        restaurant: text(body.restaurant, 120),
        city: text(body.city, 80),
        channels: [...new Set((Array.isArray(body.channels) ? body.channels : []).filter((c) => CHANNELS.includes(c)))],
        marketer: MARKETERS.includes(body.marketer) ? body.marketer : "",
        budget: BUDGETS.includes(body.budget) ? body.budget : "",
        at: new Date().toISOString(),
      };
      if (!lead.name) throw new PhoneError(400, "Nhập họ tên nhé.");
      if (!EMAIL.test(lead.email)) throw new PhoneError(400, "Email chưa đúng.");
      if (!lead.restaurant) throw new PhoneError(400, "Nhập tên quán nhé.");
      if (!lead.city) throw new PhoneError(400, "Nhập thành phố của quán nhé.");
      await store.updateUser(userId, { lead });
      // The sheet is for the sales team; a failure there never keeps the customer from their result.
      if (sheets?.enabled) {
        const row = [lead.at.replace("T", " ").slice(0, 19), lead.name, lead.email, user.phone, lead.restaurant, lead.city, lead.channels.join(", "), lead.marketer, lead.budget, user.email ?? "", user.id, lang];
        sheets.append(row).catch((e) => onError(e));
      }
      return { ok: true };
    },
  };
}
