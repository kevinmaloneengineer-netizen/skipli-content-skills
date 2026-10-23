// "US food days and holidays": the dates are worked out here, never by the model. US holidays follow their
// rules (Thanksgiving = 4th Thursday of November…); the "National … Day" food days are unofficial
// observances (National Day Calendar and the like), so only well-known, checked ones are listed.

const ymd = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
/** The n-th weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nth(y, m, weekday, n) {
  if (n === -1) {
    const last = ymd(y, m + 1, 0);
    return ymd(y, m, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7));
  }
  const first = ymd(y, m, 1);
  return ymd(y, m, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7);
}
/** Easter Sunday (anonymous Gregorian computus). */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return ymd(y, month, ((h + l - 7 * m + 114) % 31) + 1);
}
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);
// Lunar New Year follows the lunar calendar: listed per year.
const LUNAR_NEW_YEAR = { 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] };

/** Every dated occasion of year y: { date: Date, name, kind: "holiday" | "food", note? } */
export function occasionsOf(y) {
  const H = (date, name, note) => ({ date, name, kind: "holiday", ...(note ? { note } : {}) });
  const F = (date, name) => ({ date, name, kind: "food" });
  const thanksgiving = nth(y, 11, 4, 4);
  const list = [
    H(ymd(y, 1, 1), "New Year's Day"),
    H(nth(y, 1, 1, 3), "Martin Luther King Jr. Day"),
    H(nth(y, 2, 0, 2), "Super Bowl Sunday", "usually the 2nd Sunday of February: check the NFL schedule"),
    H(ymd(y, 2, 14), "Valentine's Day"),
    H(nth(y, 2, 1, 3), "Presidents' Day"),
    H(addDays(easter(y), -47), "Mardi Gras"),
    H(ymd(y, 3, 17), "St. Patrick's Day"),
    H(easter(y), "Easter"),
    H(ymd(y, 5, 5), "Cinco de Mayo"),
    H(nth(y, 5, 0, 2), "Mother's Day"),
    H(nth(y, 5, 1, -1), "Memorial Day"),
    H(nth(y, 6, 0, 3), "Father's Day"),
    H(ymd(y, 6, 19), "Juneteenth"),
    H(ymd(y, 7, 4), "Independence Day (4th of July)"),
    H(nth(y, 9, 1, 1), "Labor Day"),
    H(ymd(y, 10, 31), "Halloween"),
    H(ymd(y, 11, 11), "Veterans Day"),
    H(thanksgiving, "Thanksgiving"),
    H(addDays(thanksgiving, 1), "Black Friday"),
    H(addDays(thanksgiving, 2), "Small Business Saturday"),
    H(ymd(y, 12, 24), "Christmas Eve"),
    H(ymd(y, 12, 25), "Christmas Day"),
    H(ymd(y, 12, 31), "New Year's Eve"),
    F(ymd(y, 2, 9), "National Pizza Day"),
    F(ymd(y, 4, 4), "National Ramen Day"),
    F(ymd(y, 5, 28), "National Hamburger Day"),
    F(nth(y, 6, 5, 1), "National Donut Day"),
    F(ymd(y, 7, 6), "National Fried Chicken Day"),
    F(nth(y, 7, 0, 3), "National Ice Cream Day"),
    F(ymd(y, 7, 29), "National Chicken Wing Day"),
    F(ymd(y, 9, 18), "National Cheeseburger Day"),
    F(ymd(y, 9, 26), "National Dumpling Day"),
    F(ymd(y, 9, 29), "National Coffee Day"),
    F(ymd(y, 10, 4), "National Taco Day"),
    F(ymd(y, 11, 3), "National Sandwich Day"),
    F(ymd(y, 11, 6), "National Nachos Day"),
  ];
  if (LUNAR_NEW_YEAR[y]) list.push(H(ymd(y, ...LUNAR_NEW_YEAR[y]), "Lunar New Year"));
  return list;
}

/** The occasions from `from` (a Date) for `days` days, oldest first: [{ date: "YYYY-MM-DD", name, kind, note? }] */
export function upcoming(from, days) {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = start + days * 86_400_000;
  const years = [new Date(start).getUTCFullYear(), new Date(end).getUTCFullYear()];
  return [...new Set(years)]
    .flatMap(occasionsOf)
    .filter((o) => o.date.getTime() >= start && o.date.getTime() <= end)
    .sort((a, b) => a.date - b.date)
    .map((o) => ({ ...o, date: o.date.toISOString().slice(0, 10) }));
}

// The model is told not to, but still writes offers into the posts ("a free spring roll…") and describes
// dishes with ingredients nobody gave. A post with an offer the shop never decided is worse than a shorter
// post, so those sentences are dropped here; ingredients the owner did not list are flagged for a check.
const OFFER = /\b(free|on the house|on us|complimentary|discount\w*|\d+\s*% off|half off|bogo|buy one get one|giveaway|gift card|offer\w*|deal\w*|special (combo|price|deal|bowl|menu)|combo (deal|price|for))\b/i;
const INGREDIENTS = ["baguette", "pork", "chicken", "beef", "shrimp", "tofu", "pickled", "pickles", "sriracha", "mayo", "cilantro", "basil", "jalapeño", "jalapeno", "pâté", "pate", "lemongrass", "peanut", "egg", "cheese", "bacon"];

/** Posts without invented offers; a warning under a post that names ingredients missing from `serves`. */
export function cleanOccasions(md, serves = "") {
  const known = String(serves).toLowerCase();
  let dropped = 0;
  const out = String(md ?? "").split("\n").map((line) => {
    if (!/^\*\*Bài đăng:\*\*/.test(line.trim())) return line;
    const [, head, body] = line.match(/^(\s*\*\*Bài đăng:\*\*\s*)(.*)$/);
    const sentences = body.split(/(?<=[.!?])\s+(?=\S)/);
    const kept = sentences.filter((s) => !OFFER.test(s));
    dropped += sentences.length - kept.length;
    const text = kept.join(" ").trim() || "[Viết lại bài: bản AI có ưu đãi chưa được quán duyệt nên đã bị bỏ]";
    const odd = INGREDIENTS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(text) && !known.includes(w));
    return `${head}${text}${odd.length ? `\n_⚠ Kiểm tra lại: bài nhắc ${odd.join(", ")} mà bạn chưa ghi trong món của quán._` : ""}`;
  });
  return dropped ? `${out.join("\n")}\n\n_Đã bỏ ${dropped} câu có ưu đãi trong bài đăng (quán chưa chọn ưu đãi nào). Ý khuyến mãi nằm ở dòng "Khuyến mãi gợi ý"._` : out.join("\n");
}
