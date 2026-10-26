// Numbers of the market research reports (nearby competitors, review compare, search trends). They are
// counted here and shown as tables the code writes; the model only reads them and gives advice, the same
// split as the promotion and sales reports.

import { sameName } from "./sources/places.mjs";

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const signed = (n) => (n == null ? "–" : `${n > 0 ? "+" : ""}${n}%`);
const one = (n) => (n == null ? "–" : n.toFixed(1).replace(".", ","));
const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const link = (name, url) => (url ? `[${cell(name)}](${url})` : cell(name));

// ---- nearby competitors ----

/** Closing time in minutes after midnight from "11 AM to 9:30 PM" / "11:00–21:00" (after midnight → past 24 h); null when closed or unknown. */
export function closingMinutes(hours) {
  const text = String(hours ?? "");
  if (/24 hours|24 giờ|mở cả ngày/i.test(text)) return 24 * 60;
  const parts = text.split(/\s(?:to|đến)\s|–|-/i);
  if (parts.length < 2) return null;
  const m = parts.at(-1).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|SA|CH)?/i);
  if (!m) return null;
  let h = Number(m[1]) % 12 + (/PM|CH/i.test(m[3] ?? "") ? 12 : 0);
  if (!m[3]) h = Number(m[1]);
  const mins = h * 60 + Number(m[2] ?? 0);
  return mins < 6 * 60 ? mins + 24 * 60 : mins; // "to 2 AM" closes after midnight
}
const friday = (p) => p.hours?.find((h) => /friday|thứ sáu|thứ 6/i.test(h.day))?.hours ?? "";
const clock = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Which listed place is the user's own shop (by name), or -1. */
export function findMine(places, mine) {
  const want = fold(mine);
  if (!want) return -1;
  const exact = places.findIndex((p) => fold(p.name) === want);
  if (exact >= 0) return exact;
  // Otherwise the same telling words ("Pho Cali" is "Phở Cali Restaurant"), and only when one shop fits.
  const like = places.map((p, i) => (sameName(mine, p.name) ? i : -1)).filter((i) => i >= 0);
  return like.length === 1 ? like[0] : -1;
}

/**
 * Table and checked facts of the shops of one kind in one area.
 * @returns {{ table: string, facts: string, stats: object }}
 */
export function nearbyReport(places, { mine = "" } = {}) {
  const lowShare = (p) => {
    const total = Object.values(p.stars ?? {}).reduce((a, b) => a + b, 0);
    return total ? Math.round(((p.stars[1] + p.stars[2]) / total) * 100) : null;
  };
  const rated = places.filter((p) => p.rating != null);
  const reviews = places.map((p) => p.reviews);
  const mid = median(reviews);
  const mineIdx = findMine(places, mine);
  const byRating = [...rated].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  const byReviews = [...places].sort((a, b) => b.reviews - a.reviews);
  const late = places.filter((p) => (closingMinutes(friday(p)) ?? 0) >= 22 * 60);
  const pastMidnight = late.filter((p) => closingMinutes(friday(p)) > 24 * 60);
  const prices = {};
  for (const p of places) if (p.price) prices[p.price] = (prices[p.price] ?? 0) + 1;
  // What customers mention, over every listed place: how many places have the word among their top tags.
  const tags = {};
  for (const p of places) for (const t of p.tags ?? []) {
    const k = String(t.title).toLowerCase();
    tags[k] ??= { title: k, places: 0, count: 0 };
    tags[k].places += 1;
    tags[k].count += Number(t.count) || 0;
  }
  const topTags = Object.values(tags).sort((a, b) => b.places - a.places || b.count - a.count).slice(0, 10);
  const strong = byRating.find((p) => p.reviews >= mid) ?? byRating[0];
  const weakest = [...places].filter((p) => lowShare(p) != null).sort((a, b) => lowShare(b) - lowShare(a))[0];

  const rows = places.map((p, i) => {
    const close = closingMinutes(friday(p));
    return `| ${i + 1} | ${link(p.name, p.url)}${i === mineIdx ? " **(quán bạn)**" : ""} | ${one(p.rating)} | ${p.reviews.toLocaleString("vi-VN")} | ${lowShare(p) == null ? "–" : `${lowShare(p)}%`} | ${cell(p.price) || "–"} | ${close == null ? "–" : `đến ${clock(close)}`} |`;
  });
  const table = ["| # | Quán | Sao | Lượt đánh giá | Đánh giá 1-2 sao | Giá | Thứ 6 mở |", "|---|---|---|---|---|---|---|", ...rows].join("\n");

  const stats = {
    count: places.length,
    avgRating: rated.length ? Math.round(mean(rated.map((p) => p.rating)) * 10) / 10 : null,
    medianReviews: Math.round(mid),
    mostReviewed: byReviews[0] && { name: byReviews[0].name, reviews: byReviews[0].reviews },
    strongest: strong && { name: strong.name, rating: strong.rating, reviews: strong.reviews },
    mostComplaints: weakest && { name: weakest.name, lowShare: lowShare(weakest) },
    openLate: { count: late.length, names: late.map((p) => p.name) },
    pastMidnight: { count: pastMidnight.length, names: pastMidnight.map((p) => p.name) },
    prices,
    topTags,
  };
  if (mineIdx >= 0) {
    const me = places[mineIdx];
    stats.mine = { name: me.name, rating: me.rating, reviews: me.reviews, rankByRating: byRating.indexOf(me) + 1, rankByReviews: byReviews.indexOf(me) + 1, lowShare: lowShare(me) };
  }
  const facts = [
    `Số quán: ${stats.count}. Sao trung bình: ${one(stats.avgRating)}. Lượt đánh giá trung vị: ${stats.medianReviews}.`,
    stats.mostReviewed && `Nhiều đánh giá nhất: ${stats.mostReviewed.name} (${stats.mostReviewed.reviews}).`,
    stats.strongest && `Mạnh nhất (sao cao nhất trong các quán có từ ${stats.medianReviews} đánh giá trở lên): ${stats.strongest.name} (${one(stats.strongest.rating)} sao, ${stats.strongest.reviews} đánh giá).`,
    stats.mostComplaints && `Nhiều đánh giá 1-2 sao nhất: ${stats.mostComplaints.name} (${stats.mostComplaints.lowShare}% đánh giá là 1-2 sao).`,
    `Mở đến 22:00 trở đi vào thứ 6: ${late.length}/${places.length} quán${late.length ? ` (${late.map((p) => p.name).join(", ")})` : ""}. Trong đó mở qua nửa đêm: ${pastMidnight.length} quán${pastMidnight.length ? ` (${pastMidnight.map((p) => p.name).join(", ")})` : ""}. Hai con số này khác nhau, ghi đúng con số nào cho ý nào.`,
    Object.keys(prices).length ? `Mức giá trên Google: ${Object.entries(prices).map(([k, v]) => `${k}: ${v} quán`).join(", ")}.` : "Google không ghi mức giá của các quán này.",
    topTags.length ? `Từ khách hay nhắc trong đánh giá (số quán có từ đó): ${topTags.map((t) => `${t.title} (${t.places})`).join(", ")}.` : "",
    stats.mine
      ? `Quán của người dùng: ${stats.mine.name}, ${one(stats.mine.rating)} sao, ${stats.mine.reviews} đánh giá; đứng thứ ${stats.mine.rankByRating}/${rated.length} về số sao và thứ ${stats.mine.rankByReviews}/${places.length} về lượt đánh giá.`
      : mine ? `Không thấy quán "${mine}" trong danh sách: nói rõ điều này, và vẫn so quán đó với mặt bằng chung.` : "",
  ].filter(Boolean).join("\n");
  return { table, facts, stats };
}

// ---- review compare ----

/** One row per place: its score, how many low-star reviews were read and how many of them got an owner reply. */
export function compareTable(places) {
  const rows = places.map((p) => {
    const low = p.low.filter((r) => (r.stars ?? 5) <= 3);
    const replied = low.filter((r) => r.ownerReplied).length;
    return { name: p.name, url: p.url, address: p.address ?? "", mine: !!p.mine, rating: p.rating, total: p.total, readLow: low.length, readHigh: p.high.length, replied: low.length ? Math.round((replied / low.length) * 100) : null };
  });
  const table = [
    "| Quán | Địa chỉ | Sao | Lượt đánh giá | Bài 1-3 sao đã đọc | Chủ quán trả lời bài 1-3 sao |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${link(r.name, r.url)}${r.mine ? " **(quán bạn)**" : ""} | ${cell(r.address) || "–"} | ${cell(r.rating) || "–"} | ${cell(r.total) || "–"} | ${r.readLow} | ${r.replied == null ? "–" : `${r.replied}%`} |`),
  ].join("\n");
  return { table, rows };
}

// ---- search trends ----

const MONTHS = ["tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6", "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"];

/** Searches that really are about the term ("pho near me" for "pho", not "what is php"). */
export function aboutTerm(query, term) {
  const words = fold(term).split(" ").filter((w) => w.length >= 3);
  const q = ` ${fold(query)} `;
  return words.length > 0 && words.some((w) => q.includes(` ${w} `));
}

/**
 * Per term: the 12-month level, the last 4 weeks against it and against a year ago, the best and worst
 * months; the leading US states; the related searches about the term.
 * @param {{ series: object, states: object[], related: object }} data  from sources/trends.mjs
 */
export function trendsReport(terms, data, { now = Date.now(), area = "" } = {}) {
  const per = terms.map((term) => {
    // The running week is not finished: leave it out.
    const weeks = (data.series[term] ?? data.series[term.toLowerCase()] ?? []).filter((w) => w.start + 7 * 86_400_000 <= now);
    const values = weeks.map((w) => w.value);
    const months = {};
    for (const w of weeks) (months[new Date(w.start).getUTCMonth()] ??= []).push(w.value);
    const monthAvg = Object.entries(months).map(([m, xs]) => ({ month: Number(m), avg: mean(xs) })).sort((a, b) => b.avg - a.avg);
    const recent = mean(values.slice(-4));
    const yearAgo = weeks.length >= 50 ? mean(values.slice(0, 4)) : null;
    const rel = data.related?.[term] ?? data.related?.[term.toLowerCase()] ?? { top: [], rising: [] };
    return {
      term,
      // Too few searches: Google Trends gives no points (or only zeros) for the term.
      noData: values.every((v) => !v),
      avg: Math.round(mean(values)),
      recent: Math.round(recent),
      vsAvg: pct(recent, mean(values)),
      vsYearAgo: yearAgo == null ? null : pct(recent, yearAgo),
      best: monthAvg.slice(0, 2).map((m) => MONTHS[m.month]),
      worst: monthAvg.length ? MONTHS[monthAvg.at(-1).month] : "",
      top: rel.top.filter((q) => aboutTerm(q, term)).slice(0, 5),
      rising: rel.rising.filter((q) => aboutTerm(q.query, term)).slice(0, 5),
      states: [],
    };
  });
  if (terms.length > 1 && data.states?.length) {
    // Each state's split between the terms: the states where a term takes the biggest share.
    per.forEach((p, k) => {
      p.states = [...data.states].filter((s) => Number(s.values?.[k]) > 0).sort((a, b) => b.values[k] - a.values[k]).slice(0, 5).map((s) => `${s.name} (${s.values[k]}%)`);
    });
  }
  const tables = [
    `**Mức tìm kiếm 12 tháng qua${area ? ` (${area})` : ""}** (thang 0 đến 100 chung cho các từ khoá, 100 là tuần được tìm nhiều nhất)`,
    "| Từ khoá | Trung bình 12 tháng | 4 tuần gần nhất | So với trung bình | So với cùng kỳ năm trước | Tháng tìm nhiều | Tháng tìm ít |",
    "|---|---|---|---|---|---|---|",
    ...per.map((p) => p.noData ? `| ${cell(p.term)} | Quá ít người tìm, Google chưa có số liệu | – | – | – | – | – |` : `| ${cell(p.term)} | ${p.avg} | ${p.recent} | ${signed(p.vsAvg)} | ${signed(p.vsYearAgo)} | ${p.best.join(", ") || "–"} | ${p.worst || "–"} |`),
    "",
    "**Người ta tìm kèm**",
    "| Từ khoá | Hay tìm cùng | Đang tăng nhanh |",
    "|---|---|---|",
    ...per.map((p) => `| ${cell(p.term)} | ${p.top.map(cell).join(", ") || "–"} | ${p.rising.map((q) => `${cell(q.query)} (${cell(q.growth)})`).join(", ") || "–"} |`),
  ];
  if (per.some((p) => p.states.length)) {
    tables.push("", "**Bang nghiêng về từ khoá nào nhất** (phần trăm của từ khoá đó trong các từ khoá đã nhập, tại bang đó)", "| Từ khoá | Bang |", "|---|---|", ...per.map((p) => `| ${cell(p.term)} | ${p.states.map(cell).join(", ") || "–"} |`));
  }
  const lead = [...per].sort((a, b) => b.avg - a.avg)[0];
  if (per.every((p) => p.noData)) throw new Error("Google Trends không có số liệu cho các từ khoá này ở khu vực đã chọn (quá ít người tìm). Thử từ khoá phổ biến hơn hoặc khu vực rộng hơn.");
  const facts = [
    terms.length > 1 ? `Được tìm nhiều nhất trong 12 tháng: "${lead.term}" (trung bình ${lead.avg}).` : "",
    ...per.map((p) => p.noData ? `"${p.term}": Google Trends không có số liệu (quá ít người tìm ở khu vực này); không nhận xét xu hướng của từ này, chỉ nói rằng ít người tìm.` : `"${p.term}": trung bình ${p.avg}, 4 tuần gần nhất ${p.recent} (${signed(p.vsAvg)} so với trung bình${p.vsYearAgo == null ? "" : `, ${signed(p.vsYearAgo)} so với cùng kỳ năm trước`}); tìm nhiều vào ${p.best.join(" và ") || "không rõ"}, ít nhất vào ${p.worst || "không rõ"}.${p.top.length ? ` Hay tìm cùng: ${p.top.join(", ")}.` : ""}${p.rising.length ? ` Đang tăng nhanh: ${p.rising.map((q) => `${q.query} (${q.growth})`).join(", ")}.` : ""}${p.states.length ? ` Bang nghiêng về từ này nhất: ${p.states.join(", ")}.` : ""}`),
  ].filter(Boolean).join("\n");
  return { table: tables.join("\n"), facts, per };
}
