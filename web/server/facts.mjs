// Fact check for AI-written posts: the free models add prices, discounts and opening hours that the
// user never gave. Numbers that are not in what the user typed into the form become placeholders;
// gifts / free offers cannot be rewritten safely, so they are listed as warnings for the user.

// Vietnamese placeholders the skills write, renamed inside English copy.
const EN_BLANKS = { "GIÁ": "PRICE", "ƯU ĐÃI": "DEAL", "GIỜ": "HOURS", "SỐ ĐIỆN THOẠI": "PHONE", "SĐT": "PHONE", "ĐỊA CHỈ": "ADDRESS", "TÊN QUÁN": "RESTAURANT NAME", "LINK MENU": "MENU LINK", "LINK ĐẶT BÀN": "BOOKING LINK" };

/** In English lines, [GIÁ] → [PRICE] and so on (the Vietnamese headings and notes keep theirs). */
export function englishBlanks(md) {
  return md
    .split("\n")
    .map((line) => (english(line.replace(/\[[^\]]*\]/g, "")) ? line.replace(/\[([^\]]+)\]/g, (all, name) => (EN_BLANKS[name] ? `[${EN_BLANKS[name]}]` : all)) : line))
    .join("\n");
}

/** Job types whose result is copy the user will post (scan reports quote real data, so they are skipped). */
export const CHECKED_TYPES = new Set(["write", "clone", "menu", "livestream", "plan", "campaign", "review", "inbox"]);

const MONEY = /(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|K|nghìn|ngàn|đ|đồng|vnđ|vnd|VNĐ|VND|triệu|tr)(?![\p{L}\d])/gu;
// US prices: "$12.99", "$1,200", "15 dollars", "20 USD".
const USD = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d])|(?<![\d.,$])(\d+(?:\.\d{1,2})?)\s?(?:USD|dollars?|bucks)\b/gi;
const PERCENT = /(?<![\d.,])(\d{1,2})\s*%/g;
const HOURS_CONTEXT = /(mở cửa|đóng cửa|giờ mở|giờ hoạt động|phục vụ từ|bán từ|mở từ|\bopen(?:s|ing)?\b|\bhours\b|\bclos(?:e|es|ing)\b|\bserving\b|\buntil\b)[^.\n]*$/i;
// 11h, 11h30, 11 giờ, 11:30, 11am, 9:30 pm (the minutes stay optional and never eat the following space).
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)(?![\p{L}])|\b(\d{1,2})\s*(?:h|giờ|g)(\d{2})?\b|\b(\d{1,2}):(\d{2})\b/giu;
const GIFT = /(?:[^.,!?\n]{0,30})\b(tặng kèm|tặng|miễn phí|free\s?ship|freeship|giảm giá|giảm ngay|mua \d+ tặng \d+|đồng giá|voucher|BOGO|buy one,? get one|giveaway|coupon|promo code|on the house|(?<![-\u2010-\u2015\w])free (?:drinks?|desserts?|delivery|sides?|appetizers?|meals?|refills?|shipping|fries))\b[^.,!?\n]{0,40}/gi; // with a little context on both sides
const STAT_LINE = /👍|💬|🔁|views|lượt xem|> Gốc/;

function moneyValue(num, unit) {
  const n = Number(num.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const u = unit.toLowerCase();
  if (u === "k" || u === "nghìn" || u === "ngàn") return Math.round(n * 1000);
  if (u === "triệu" || u === "tr") return Math.round(n * 1e6);
  return Math.round(n);
}

/** Hour of a TIME match on a 24-hour clock, so "9pm", "21h" and "21:00" all compare equal. */
const hourOf = (g) => {
  const [h12, , ampm, hVi, , hColon] = g;
  if (h12 !== undefined) return (Number(h12) % 12) + (/^p/i.test(ampm) ? 12 : 0);
  return Number(hVi ?? hColon);
};
const usdValue = (a, b) => Math.round(Number(String(a ?? b).replace(/,/g, "")) * 100);
// English copy gets English placeholders.
const english = (md) => !/[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(md);

/**
 * @param {string} md       the AI answer
 * @param {string} facts    everything the user typed into the form
 * @returns {{ text: string, replaced: number, warnings: string[] }}
 */
export function checkFacts(md, facts) {
  const factMoney = new Set([...facts.matchAll(MONEY)].map((m) => moneyValue(m[1], m[2])));
  const factPercent = new Set([...facts.matchAll(PERCENT)].map((m) => m[1]));
  const factHours = new Set([...facts.matchAll(TIME)].map((m) => hourOf(m.slice(1))));
  const factUsd = new Set([...facts.matchAll(USD)].map((m) => usdValue(m[1], m[2])));
  const placeholders = (line) => (english(line) ? { price: "[PRICE]", deal: "[DEAL]", hours: "[HOURS]" } : { price: "[GIÁ]", deal: "[ƯU ĐÃI]", hours: "[GIỜ]" }); // per line: English posts sit under Vietnamese headings
  const factsLower = facts.toLowerCase();
  let replaced = 0;
  const warnings = new Set();

  const text = md
    .split("\n")
    .map((line) => {
      if (STAT_LINE.test(line)) return line;
      const PH = placeholders(line);
      let out = line.replace(MONEY, (all, num, unit) => {
        const v = moneyValue(num, unit);
        if (v === null || factMoney.has(v)) return all;
        replaced++;
        return PH.price;
      });
      out = out.replace(USD, (all, a, b) => {
        if (factUsd.has(usdValue(a, b))) return all;
        replaced++;
        return PH.price;
      });
      out = out.replace(PERCENT, (all, n) => {
        if (factPercent.has(n)) return all;
        replaced++;
        return PH.deal;
      });
      // A time counts as opening hours when "mở cửa", "open", "until"… is in the 45 characters before it.
      out = out.replace(TIME, (all, ...g) => {
        const at = g.at(-2);
        if (!HOURS_CONTEXT.test(out.slice(Math.max(0, at - 45), at)) || factHours.has(hourOf(g))) return all;
        replaced++;
        return PH.hours;
      });
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
