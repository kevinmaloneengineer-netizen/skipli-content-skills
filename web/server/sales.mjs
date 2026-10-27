// "Đọc file bán hàng": an Excel export from the shop's POS (one row per dish sold, or per order line).
// The server reads the first sheet, finds the header row, guesses which column is the dish, the quantity,
// the amount and the time, and works out the numbers (what sells, what does not, busy and quiet hours).
// The model only turns those numbers into content ideas; it never adds up or invents a figure.

import * as XLSX from "xlsx";

export const MAX_SALES_BYTES = 5 * 1024 * 1024;

const FIELDS = {
  dish: /(tên\s*món|mon|món|item|product|sản\s*phẩm|san\s*pham|dish|name|tên)/i,
  qty: /(số\s*lượng|so\s*luong|sl|qty|quantity|sold|số\s*suất|suất)/i,
  amount: /(thành\s*tiền|thanh\s*tien|doanh\s*thu|revenue|amount|total|sales|tiền|tien|giá\s*trị|gia\s*tri)/i,
  time: /(giờ|gio|hour|time|thời\s*gian|thoi\s*gian|datetime|ngày\s*giờ)/i,
  date: /(ngày|ngay|date)/i,
};

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

/** A number from a cell: "780.000", "780,000", "780000đ", 780000 → 780000 (VND has no decimals here). */
export function numberOf(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").trim();
  if (!/\d/.test(s)) return null;
  // "780.000" or "1.234.567": dots as thousands separators; "12.5" is a decimal.
  const dotsAsThousands = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s.replace(/[^\d.,]/g, ""));
  const cleaned = dotsAsThousands ? s.replace(/[^\d,]/g, "").replace(",", ".") : s.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** The hour of day (0–23) from "11:30", "11h", "2026-10-22 11:30:00", or an Excel time fraction (0.479…). */
export function hourOf(v) {
  if (typeof v === "number" && v >= 0 && v < 1) return Math.floor(v * 24) % 24;
  const m = String(v ?? "").match(/(\d{1,2})\s*[:hH]\s*\d{0,2}/);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

// An .xlsx is a zip: a few MB can unpack to gigabytes. Its table of contents gives the unpacked size
// before anything is unpacked, so an oversized file is refused up front.
const MAX_UNPACKED = 60 * 1024 * 1024;
const MAX_ENTRIES = 5000;
export const MAX_ROWS = 50_000;

/** Total unpacked size of a zip from its central directory; Infinity when it cannot be read safely. */
export function zipUnpackedSize(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return Infinity;
  const entries = buf.readUInt16LE(eocd + 10);
  if (entries > MAX_ENTRIES) return Infinity;
  let pos = buf.readUInt32LE(eocd + 16);
  let total = 0;
  for (let k = 0; k < entries; k++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) return Infinity;
    const size = buf.readUInt32LE(pos + 24);
    if (size === 0xffffffff) return Infinity; // zip64: never needed by a sales export
    total += size;
    pos += 46 + buf.readUInt16LE(pos + 28) + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32);
  }
  return total;
}

/** Read the first sheet: the header is the first row with at least two filled cells. */
export function readSheet(buffer) {
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50 && zipUnpackedSize(buffer) > MAX_UNPACKED) {
    throw new Error("File Excel quá lớn khi giải nén. Hãy xuất ít dòng hơn (ví dụ theo tháng).");
  }
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, sheetRows: MAX_ROWS + 50 });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("File không có sheet nào.");
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false });
  const top = grid.findIndex((r) => r.filter((c) => String(c).trim() !== "").length >= 2);
  if (top < 0) throw new Error("Không thấy dòng tiêu đề (cần ít nhất 2 cột có chữ).");
  const headers = grid[top].map((h, i) => String(h).trim() || `Cột ${i + 1}`);
  const rows = grid.slice(top + 1).filter((r) => r.some((c) => String(c).trim() !== ""));
  return { sheet: name, headers, rows, sheets: wb.SheetNames.length };
}

/** Guess which column is which, from the header names. Only columns that exist are returned. */
export function detectMapping(headers) {
  const used = new Set();
  const out = {};
  for (const [field, re] of Object.entries(FIELDS)) {
    const i = headers.findIndex((h, k) => !used.has(k) && re.test(norm(h)));
    if (i >= 0) {
      out[field] = i;
      used.add(i);
    }
  }
  return out;
}

const top = (map, n, by) => [...map.values()].sort((a, b) => b[by] - a[by]).slice(0, n);

/**
 * The numbers the owner needs: total, best and worst sellers, busy and quiet hours.
 * mapping: { dish, qty, amount, time } as column indexes (what the owner confirmed).
 */
export function salesStats(rows, mapping) {
  if (mapping.dish == null) throw new Error("Chọn cột tên món.");
  const dishes = new Map();
  const hours = new Map();
  let total = 0;
  let count = 0;
  let amountSum = 0;
  let skipped = 0;
  for (const r of rows) {
    const name = String(r[mapping.dish] ?? "").trim().replace(/\s+/g, " ");
    if (!name) {
      skipped++;
      continue;
    }
    const qty = mapping.qty != null ? numberOf(r[mapping.qty]) ?? 0 : 1;
    const amount = mapping.amount != null ? numberOf(r[mapping.amount]) ?? 0 : 0;
    if (qty <= 0 && amount <= 0) {
      skipped++;
      continue;
    }
    count++;
    total += qty;
    amountSum += amount;
    const d = dishes.get(norm(name)) ?? { name, qty: 0, amount: 0 };
    d.qty += qty;
    d.amount += amount;
    dishes.set(norm(name), d);
    const h = mapping.time != null ? hourOf(r[mapping.time]) : null;
    if (h != null) {
      const hr = hours.get(h) ?? { hour: h, qty: 0 };
      hr.qty += qty;
      hours.set(h, hr);
    }
  }
  if (!dishes.size) throw new Error("Không đọc được dòng bán nào. Kiểm tra lại cột tên món và số lượng.");
  const list = [...dishes.values()];
  const byQty = top(dishes, list.length, "qty");
  // The worst sellers only count when there are enough dishes to compare with the best ones.
  const slow = list.length >= 6 ? [...byQty].reverse().slice(0, 3) : [];
  const hourList = [...hours.values()];
  // The share of the best three is worked out here, so the model never does the arithmetic.
  const topShare = total ? byQty.slice(0, 3).reduce((a, d) => a + d.qty, 0) / total : null;
  return {
    topShare,
    lines: count,
    skipped,
    dishCount: list.length,
    totalQty: total,
    totalAmount: mapping.amount != null ? amountSum : null,
    topDishes: byQty.slice(0, 5),
    slowDishes: slow,
    peakHours: hourList.length ? [...hourList].sort((a, b) => b.qty - a.qty).slice(0, 3) : [],
    quietHours: hourList.length >= 6 ? [...hourList].sort((a, b) => a.qty - b.qty).slice(0, 3) : [],
  };
}

const vnd = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;

/** The numbers as plain text for the model and for the result page (every figure comes from salesStats). */
export function statsText(s) {
  const lines = [
    `Tổng: ${s.totalQty} phần bán ra từ ${s.lines} dòng, ${s.dishCount} món khác nhau.`,
    s.totalAmount != null ? `Doanh thu: ${vnd(s.totalAmount)}.` : "",
    `Bán chạy nhất: ${s.topDishes.map((d) => `${d.name} (${d.qty} phần)`).join("; ")}.`,
    s.topShare != null ? `Ba món bán chạy nhất chiếm ${Math.round(s.topShare * 100)}% tổng số phần bán ra.` : "",
    s.slowDishes.length ? `Bán chậm nhất: ${s.slowDishes.map((d) => `${d.name} (${d.qty} phần)`).join("; ")}.` : "",
    s.peakHours.length ? `Giờ đông nhất: ${s.peakHours.map((h) => `${String(h.hour).padStart(2, "0")}h (${h.qty} phần)`).join("; ")}.` : "",
    s.quietHours.length ? `Giờ vắng nhất: ${s.quietHours.map((h) => `${String(h.hour).padStart(2, "0")}h (${h.qty} phần)`).join("; ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
