// Two-step login for the admin: 6-digit codes from an authenticator app (Google Authenticator, Authy,
// 1Password...), RFC 6238 with the usual settings (SHA-1, 30 seconds, 6 digits), plus one-time backup
// codes for a lost phone.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;

export function base32(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function unbase32(text) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of String(text).toUpperCase().replace(/[\s=]/g, "")) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("not base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret for the authenticator app (160 bits, base32 as the apps expect). */
export const newSecret = () => base32(randomBytes(20));

/** The code an app shows for `step` (one 30-second window). */
export function totpCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", unbase32(secret)).update(counter).digest();
  const at = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/**
 * The window a typed code belongs to: this one or one either side (a phone clock a little off), and only
 * after `lastStep`, so a code that was already used (or seen over a shoulder) does not sign in again.
 * @returns {number|null} the step to remember as used, or null when the code is wrong
 */
export function checkTotp(secret, raw, { now = Date.now(), lastStep = -1 } = {}) {
  const code = String(raw ?? "").replace(/\D/g, "");
  if (code.length !== 6) return null;
  const step = Math.floor(now / STEP_MS);
  for (const s of [step - 1, step, step + 1]) {
    if (s <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, s)), Buffer.from(code))) return s;
  }
  return null;
}

/** otpauth:// link: the QR code the app scans. */
export const otpauthUri = ({ secret, account, issuer = "Skipli Content" }) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// Backup codes: 8 of "xxxx-xxxx" (no 0/o/1/l to misread), each works once. Only a hash is kept; it does not
// use the session secret, so changing SESSION_SECRET never voids them.
const BACKUP_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
export function newBackupCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const s = Array.from(randomBytes(8), (b) => BACKUP_CHARS[b % BACKUP_CHARS.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const backupHash = (userId, raw) => createHash("sha256").update(`backup:${userId}:${String(raw ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}`).digest("hex");
