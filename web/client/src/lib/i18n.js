// English UI without touching every page: when the language is "en", every Vietnamese text node and
// placeholder / title / aria-label / alt on the page is swapped for its English version from the
// dictionary (lib/i18n-en.js, generated from the source strings). React keeps working because only a
// text node's value changes, never the nodes themselves; a MutationObserver translates what React
// renders later. AI results stay in the language they were written in.
let EN = {};
let patterns = [];

export function getLang() {
  try {
    return localStorage.getItem("lang") === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem("lang", lang);
  } catch {
    /* private mode: stays for this page only */
  }
  window.location.reload();
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "Đã đọc ${n} bài" → /^Đã đọc (.+?) bài$/ with "Read $1 posts". */
const compile = (list) => list.map(([raw, en]) => {
  const vi = raw.trim(); // matched against trimmed text
  en = en.trim();
  const tokens = vi.match(/\$\{[^}]*\}/g) ?? [];
  const re = new RegExp(`^${vi.split(/\$\{[^}]*\}/).map(escape).join("(.+?)")}$`, "s");
  let out = en;
  for (const [k, t] of tokens.entries()) out = out.split(t).join(`$${k + 1}`);
  return /\$\{/.test(out) ? null : { re, out };
}).filter(Boolean);

// Numbers with a unit, wherever they show up ("3 sao", "38 lần chạy", "· 12 bài").
const UNITS = [
  [/^(\S*?)(\d[\d.,]*) sao$/, "$1$2 stars"], [/^(\S*?)(\d[\d.,]*) bài$/, "$1$2 posts"], [/^(\S*?)(\d[\d.,]*) lần chạy$/, "$1$2 runs"],
  [/^(\S*?)(\d[\d.,]*) phút$/, "$1$2 min"], [/^(\S*?)(\d[\d.,]*) giây$/, "$1$2 s"], [/^(\S*?)(\d[\d.,]*) ảnh$/, "$1$2 photos"],
  [/^(\S*?)(\d[\d.,]*) cảnh$/, "$1$2 scenes"], [/^(\S*?)(\d[\d.,]*) đánh giá$/, "$1$2 reviews"], [/^(\S*?)(\d[\d.,]*) lượt nhắc$/, "$1$2 mentions"],
  [/^(\d+) phút trước$/, "$1 min ago"], [/^(\d+) giờ trước$/, "$1 h ago"], [/^vừa xong$/, "just now"],
];

/** English for one string, or null. Keeps the spaces around it. */
const DAYS = { 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat" };
// Section headings and labels of the skills' report templates (kept in Vietnamese by the AI so the
// result views can read them).
const HEADINGS = {
  "Tổng quan": "Overview", "Đăng khi nào": "When they post", "Video dài bao lâu, caption ra sao": "Video length and captions", "Chủ đề và kiểu bài ăn khách": "Topics and formats that work",
  "Top bài": "Top posts", "Top reel": "Top reels", "Top video": "Top videos", "Nên học và nên tránh": "What to copy and what to avoid", "Phân bố số sao": "Star distribution",
  "Khách khen gì": "What customers praise", "Khách chê gì": "What customers complain about", "Cơ hội cho quán của bạn": "Opportunities for your restaurant", "Khách đang nói gì": "What the customer is saying",
  "Mỗi kênh mạnh ở đâu": "Where each channel is strong", "Bài học cho bạn": "Lessons for you", "Ý tưởng quay cho bạn": "Video ideas for you", "Vì sao viral": "Why it went viral",
  "Caption mạng xã hội": "Social caption", "Mô tả app giao đồ ăn": "Delivery app description", "Gợi ý ăn kèm": "Pairs well with", "Gợi ý trình bày menu": "Menu layout tips", "Tên gợi ý": "Suggested name", "Menu in": "Printed menu",
  "Khách nhắn": "Customer says", "Trả lời": "Reply", "Nếu khách im lặng": "If they go quiet", "Mẹo chốt đơn qua inbox": "Tips to close in the inbox", "Xử lý từ chối": "Handling objections",
  "Mở màn": "Opening", "Mục tiêu": "Goal", "Lời thoại": "Script", "Hành động": "Action", "Câu chốt đơn": "Closing lines", "Chốt đơn và cảm ơn": "Close and thank", "Trả lời nhanh bình luận": "Quick comment replies",
  "Giờ đăng gợi ý": "Suggested posting times", "Ghi chú": "Notes", "Việc nên làm thêm": "Also worth doing", "Công thức chung": "The common formula", "Cách dùng": "How to use", "Thông tin": "Info",
  "Đối thủ đáng chú ý": "Competitors to watch", "Quán bạn đang ở đâu": "Where your restaurant stands", "Khoảng trống bạn có thể chiếm": "Gaps you can fill", "Việc nên làm tuần này": "To do this week",
  "Mỗi quán bị chê gì": "What each one is criticized for", "Mỗi quán được khen gì": "What each one is praised for", "Điểm yếu chung của khu vực": "Common weak spots in the area",
  "Mùa của từng món": "Each dish's season", "Khách đang tìm gì": "What people search for", "Nên làm gì": "What to do", "Đánh giá mới 1-3 sao": "New 1-3 star reviews", "Đánh giá mới 4-5 sao": "New 4-5 star reviews",
  "Nên": "Do", "Tránh": "Avoid", "Nên làm": "Do", "Nên tránh": "Avoid", "Nội dung chính": "What happens", "Vì sao chọn": "Why it was picked",
};
// Numbered headings: "Phương án 2 · Chân thành", "Bộ 1 · Tiếp cận rộng", "Ngày 3 · 19:30 · Bán hàng: …".
const NUMBERED = [
  [/^Phương án (\d+)/, "Option $1"], [/^Bộ (\d+)/, "Set $1"], [/^Ngày (\d+)/, "Day $1"], [/^Bài (\d+)/, "Post $1"], [/^Món:/, "Dish:"], [/^Tình huống:/, "Scenario:"],
];
const PILLAR_WORDS = { "Giáo dục": "Educate", "Bán hàng": "Sell", "Tương tác": "Engage", "Giải trí": "Entertain" };
// Fixed names inside numbered headings (review reply styles, hashtag sets).
const LABELS = {
  "Chân thành, xin lỗi": "Sincere apology", "Chân thành": "Sincere", "Chuyên nghiệp": "Professional", "Gần gũi, vui vẻ": "Friendly and upbeat", "Gần gũi": "Friendly", "Ngắn gọn": "Short",
  "Tiếp cận rộng": "Broad reach", "Khách quanh khu vực": "Local customers", "Ngách, dễ lên top": "Niche, easy to rank", "Ngách": "Niche", "Thương hiệu riêng": "Your brand",
};
const TZ = { "giờ Việt Nam": "Vietnam time", "giờ miền Đông Mỹ": "US Eastern time", "giờ miền Trung Mỹ": "US Central time", "giờ miền Núi Mỹ": "US Mountain time", "giờ miền Tây Mỹ": "US Pacific time" };

// Job titles are written by the server in Vietnamese: translate their opening words.
const TITLE_PREFIXES = [
  ["Video trình chiếu", "Slideshow video"], ["Video storyboard", "Storyboard video"], ["Video kể chuyện", "Story video"], ["Viết Facebook", "Facebook post"], ["Viết Threads", "Threads post"],
  ["Review Google Maps", "Google Maps reviews"], ["Đối thủ quanh quán", "Nearby competitors"], ["So sánh review", "Review compare"], ["Xu hướng tìm kiếm", "Search trends"], ["Theo dõi sao", "Rating watch"], ["Review Yelp", "Yelp reviews"], ["Phân tích Instagram", "Instagram analysis"], ["Phân tích fanpage", "Facebook page analysis"],
  ["Phân tích reel", "Reel analysis"], ["So sánh", "Compare"], ["Kế hoạch", "Plan"], ["Kịch bản inbox", "Inbox scripts"], ["Kịch bản livestream", "Livestream script"],
  ["Hashtag & giờ đăng", "Hashtags & posting times"], ["Trả lời review", "Review replies"], ["Nhân bản", "Clone"], ["Chiến dịch", "Campaign"], ["Theo dõi", "Watch"],
  ["Ảnh", "Image"], ["Menu", "Menu"], ["Livestream", "Livestream"], ["Reels", "Reels"], ["TikTok", "TikTok"], ["Threads", "Threads"], ["Campaign", "Campaign"],
];

export function translate(text) {
  const t = text.trim();
  if (!t) return null;
  if (/[^\x00-\x7F]/.test(t)) {
    const hit = EN[t];
    if (hit) return text.replace(t, hit);
    // "Đăng khi nào (giờ miền Đông Mỹ: ET)": heading + time zone note.
    const [, base = t, note = ""] = t.replace(/:$/, "").match(/^(.*?)\s*(\([^()]*\))?$/s) ?? [];
    if (HEADINGS[base]) return text.replace(t, `${HEADINGS[base]}${note ? ` ${note.replace(/giờ[^:)]*/, (z) => TZ[z.trim()] ?? z)}` : ""}${t.endsWith(":") ? ":" : ""}`);
    for (const [re, en] of NUMBERED) {
      if (re.test(t)) {
        let out = t.replace(re, en).replace(/(Giáo dục|Bán hàng|Tương tác|Giải trí)/, (w) => PILLAR_WORDS[w]);
        for (const [vi, enLabel] of Object.entries(LABELS)) if (out.includes(vi)) out = out.replace(vi, enLabel);
        return text.replace(t, out);
      }
    }
    for (const [vi, en] of TITLE_PREFIXES) if (t.startsWith(`${vi} `) && (t.includes(" · ") || t.includes(" @"))) return text.replace(vi, en).replace(/(\d+) ngày/, "$1 days").replace(/(\d+) món/, "$1 dishes").replace(/(\d+) phút/, "$1 min").replace(/(\d+) reel mới/, "$1 new reels").replace(/học từ /, "learning from ").replace(/(\d+) bài/, "$1 posts");
    // Weekdays first: "Thứ 7, 10/10" must not read as the queue's "Thứ ${n}".
    const day = t.match(/^(?:Thứ ([2-7])|Chủ nhật)(.*)$/);
    if (day) return text.replace(t, `${day[1] ? DAYS[day[1]] : "Sun"}${day[2]}`);
    for (const p of patterns) if (p.re.test(t)) return text.replace(t, t.replace(p.re, p.out));
  }
  for (const [re, out] of UNITS) if (re.test(t)) return text.replace(t, t.replace(re, out));
  return null;
}

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const OFF = "[translate='no'], .notranslate"; // marked as content: never translated
const SKIP = `script, style, textarea, code, pre, ${OFF}`; // text inside these stays as typed

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (root.parentElement?.closest(SKIP)) return;
    const v = translate(root.nodeValue);
    if (v !== null && v !== root.nodeValue) root.nodeValue = v;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest(OFF)) return;
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (el.closest(OFF)) continue;
    for (const a of ATTRS) {
      const val = el.getAttribute(a);
      if (val) {
        const v = translate(val);
        if (v !== null && v !== val) el.setAttribute(a, v);
      }
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest(SKIP)) continue;
    const v = translate(n.nodeValue);
    if (v !== null && v !== n.nodeValue) n.nodeValue = v;
  }
}

/** Call once at start-up: translates the page now and whatever renders later. */
export async function startTranslator() {
  if (getLang() !== "en") return;
  document.documentElement.lang = "en";
  // The dictionary (~110 KB) loads only for English readers.
  const dict = await import("./i18n-en.js");
  EN = dict.EN;
  patterns = compile(dict.EN_PATTERNS);
  translateTree(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") translateTree(r.target);
      else if (r.type === "attributes") translateTree(r.target);
      else r.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
