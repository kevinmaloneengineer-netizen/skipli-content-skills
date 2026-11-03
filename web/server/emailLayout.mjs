// The look of the emails the app sends on its own (survey alerts, low credit): a card on a warm background,
// the brand on top, one button. Tables and inline styles only, the way Gmail and Outlook render HTML mail.

export const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const INK = "#1c1a16";
const MUTED = "#6e685d";
const LINE = "#e2dacb";
const BRAND = "#e0402a";

/** A coloured pill: "Cần chú ý", "Không quay lại". */
export const pill = (text, { bg = "#fbe3dc", fg = "#b3341c" } = {}) =>
  `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:700;letter-spacing:.02em">${esc(text)}</span>`;

/** ★★☆☆☆ in gold and grey, with the score after it. */
export const stars = (n, of = 5) =>
  `<span style="font-size:18px;letter-spacing:2px;color:#e0a21b">${"★".repeat(n)}</span><span style="font-size:18px;letter-spacing:2px;color:#d9d2c4">${"★".repeat(of - n)}</span> <b style="color:${INK};font-size:14px">${n}/${of}</b>`;

/** Label on the left, value on the right; for a short list of facts. */
export const rows = (list) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 18px">${list
    .map(([label, value], i) => `<tr><td style="padding:11px 0;${i ? `border-top:1px solid ${LINE};` : ""}color:${MUTED};font-size:14px;width:42%">${esc(label)}</td><td style="padding:11px 0;${i ? `border-top:1px solid ${LINE};` : ""}font-size:14px;color:${INK}">${value}</td></tr>`)
    .join("")}</table>`;

/** A guest's own words, set apart. */
export const quote = (text) =>
  `<div style="margin:0 0 18px;padding:14px 16px;background:#f7f2e8;border-left:4px solid ${BRAND};border-radius:0 12px 12px 0;font-size:15px;line-height:1.55;color:${INK};font-style:italic">“${esc(text)}”</div>`;

/**
 * The whole email. `body` is HTML built with the helpers above (callers escape what users typed).
 * @param {{ preheader?: string, kicker?: string, title: string, intro?: string, body?: string, button?: { href: string, label: string }, footer?: string }} o
 */
export function emailHtml({ preheader = "", kicker = "", title, intro = "", body = "", button, footer = "" }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3efe6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3efe6;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td style="padding:0 6px 14px"><span style="display:inline-block;width:26px;height:26px;border-radius:8px;background:${BRAND};color:#fff;font-weight:800;font-size:16px;line-height:26px;text-align:center;vertical-align:middle">S</span>
      <span style="font-size:16px;font-weight:700;color:${INK};vertical-align:middle;margin-left:6px">Skipli <span style="font-weight:400;font-style:italic">Content</span></span></td></tr>
    <tr><td style="background:#fffcf6;border:1px solid ${LINE};border-radius:18px;padding:28px 28px 24px">
      ${kicker ? `<div style="margin-bottom:12px">${kicker}</div>` : ""}
      <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:600;color:${INK}">${esc(title)}</h1>
      ${intro ? `<p style="margin:0 0 18px;font-size:14.5px;line-height:1.55;color:${MUTED}">${intro}</p>` : ""}
      ${body}
      ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td style="background:${INK};border-radius:999px"><a href="${esc(button.href)}" style="display:inline-block;padding:13px 24px;color:#f8f4ec;font-size:15px;font-weight:700;text-decoration:none">${esc(button.label)}</a></td></tr></table>` : ""}
    </td></tr>
    ${footer ? `<tr><td style="padding:16px 10px 0;font-size:12.5px;line-height:1.55;color:${MUTED};text-align:center">${footer}</td></tr>` : ""}
  </table>
</td></tr></table></body></html>`;
}
