// Fact check for AI-written posts: the free models add prices, discounts and opening hours that the
// user never gave. Numbers that are not in what the user typed into the form become placeholders;
// gifts / free offers cannot be rewritten safely, so they are listed as warnings for the user.

/** Job types whose result is copy the user will post (scan reports quote real data, so they are skipped). */
export const CHECKED_TYPES = new Set(["write", "clone", "menu", "livestream", "plan", "campaign", "review", "inbox"]);

const MONEY = /(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|K|nghìn|ngàn|đ|đồng|vnđ|vnd|VNĐ|VND|triệu|tr)(?![\p{L}\d])/gu;
const PERCENT = /(?<![\d.,])(\d{1,2})\s*%/g;
const HOURS_CONTEXT = /(mở cửa|đóng cửa|giờ mở|giờ hoạt động|phục vụ từ|bán từ|mở từ)[^.\n]{0,40}/gi;
const TIME = /\b(\d{1,2})\s*(?:h|giờ|g)\s*(\d{2})?\b|\b(\d{1,2}):(\d{2})\b/gi;
const GIFT = /(?:[^.,!?\n]{0,30})\b(tặng kèm|tặng|miễn phí|free\s?ship|freeship|giảm giá|giảm ngay|mua \d+ tặng \d+|đồng giá|voucher)\b[^.,!?\n]{0,40}/gi; // with a little context on both sides
const STAT_LINE = /👍|💬|🔁|views|lượt xem|> Gốc/;

function moneyValue(num, unit) {
  const n = Number(num.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const u = unit.toLowerCase();
  if (u === "k" || u === "nghìn" || u === "ngàn") return Math.round(n * 1000);
  if (u === "triệu" || u === "tr") return Math.round(n * 1e6);
  return Math.round(n);
}

const hourOf = (m) => Number(m[1] ?? m[3]);

/**
 * @param {string} md       the AI answer
 * @param {string} facts    everything the user typed into the form
 * @returns {{ text: string, replaced: number, warnings: string[] }}
 */
export function checkFacts(md, facts) {
  const factMoney = new Set([...facts.matchAll(MONEY)].map((m) => moneyValue(m[1], m[2])));
  const factPercent = new Set([...facts.matchAll(PERCENT)].map((m) => m[1]));
  const factHours = new Set([...facts.matchAll(TIME)].map(hourOf));
  const factsLower = facts.toLowerCase();
  let replaced = 0;
  const warnings = new Set();

  const text = md
    .split("\n")
    .map((line) => {
      if (STAT_LINE.test(line)) return line;
      let out = line.replace(MONEY, (all, num, unit) => {
        const v = moneyValue(num, unit);
        if (v === null || factMoney.has(v)) return all;
        replaced++;
        return "[GIÁ]";
      });
      out = out.replace(PERCENT, (all, n) => {
        if (factPercent.has(n)) return all;
        replaced++;
        return "[ƯU ĐÃI]";
      });
      out = out.replace(HOURS_CONTEXT, (part) =>
        part.replace(TIME, (all, ...g) => {
          if (factHours.has(Number(g[0] ?? g[2]))) return all;
          replaced++;
          return "[GIỜ]";
        }),
      );
      for (const m of out.matchAll(GIFT)) {
        const word = m[1].toLowerCase().replace(/\s+/g, "");
        if (!factsLower.replace(/\s+/g, "").includes(word)) {
          // Show whole words: the context window may start or end mid-word.
          const start = m.index > 0 && /[\p{L}\d]/u.test(out[m.index - 1]) ? m[0].replace(/^[\p{L}\d]+/u, "") : m[0];
          const end = /[\p{L}\d]/u.test(out[m.index + m[0].length] ?? "") ? start.replace(/[\p{L}\d]+$/u, "") : start;
          warnings.add(end.trim().replace(/[*_"“”]/g, "").replace(/^[^\p{L}\d]+/u, "").slice(0, 100));
        }
      }
      return out;
    })
    .join("\n");
  return { text, replaced, warnings: [...warnings].slice(0, 6) };
}
