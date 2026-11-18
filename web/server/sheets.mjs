// Google Sheets: one row per lead (the details a customer gives when unlocking a first result).
// Signs in with the same Google service account as Firestore (FIREBASE_SERVICE_ACCOUNT); the sheet in
// GOOGLE_SHEET_ID has to be shared with that account's email as an editor.
import { sign } from "node:crypto";

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

/**
 * @param {{ serviceAccount?: string, sheetId?: string, range?: string, header?: string[], fetchFn?: typeof fetch }} opts
 * @returns {{ enabled: boolean, append(row: (string|number)[]): Promise<void> }}
 */
export function createSheets({ serviceAccount = "", sheetId = "", range = "A1", header = [], fetchFn = fetch } = {}) {
  let account = null;
  try {
    account = serviceAccount ? JSON.parse(serviceAccount) : null;
  } catch {
    account = null;
  }
  const enabled = !!(sheetId && account?.client_email && account?.private_key);
  let token = null; // { value, exp }
  let headerDone = false;

  async function accessToken() {
    if (token && Date.now() < token.exp - 60_000) return token.value;
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: account.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
    const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(claims)}`;
    const assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url")}`;
    const r = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(`Google sign-in failed (${r.status}): ${j.error_description ?? j.error ?? ""}`);
    token = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return token.value;
  }

  async function call(path, init = {}) {
    const r = await fetchFn(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...init.headers },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Google Sheets ${r.status}: ${j.error?.message ?? ""}`);
    return j;
  }

  const appendRows = (rows) => call(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: rows }) });

  return {
    enabled,
    async append(row) {
      if (!enabled) return;
      // An empty sheet gets the column names first, once per server start.
      if (!headerDone && header.length) {
        const first = await call(`/values/${encodeURIComponent(range)}`);
        if (!first.values?.length) await appendRows([header]);
        headerDone = true;
      }
      await appendRows([row]);
    },
  };
}
