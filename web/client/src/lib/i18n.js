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
  [/^(\d+) phút trước(.*)$/s, "$1 min ago$2"], [/^(\d+) giờ trước(.*)$/s, "$1 h ago$2"], [/^(\d+) ngày trước(.*)$/s, "$1 days ago$2"], [/^vừa xong(.*)$/s, "just now$1"], [/^Tin (\d+):(.*)$/s, "Message $1:$2"],
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
  "Pattern chung": "Common patterns", "Ý tưởng cho bạn": "Ideas for you",
  "Câu đố": "Riddle", "Đáp án gợi ý": "Suggested answer", "Đáp án": "Answer", "Chú thích cho admin": "Notes for the page admin", "Tiêu chí": "Criteria", "Nhận xét": "Comments",
  "Câu mở đầu": "Opening line", "Lời kêu gọi": "Call to action", "Hashtag và emoji": "Hashtags and emoji", "Sửa nhanh": "Quick fixes", "Bản đã sửa": "Revised version", "Điểm": "Score",
  "Tiêu đề": "Title", "Gửi thế nào": "How to send", "Nút": "Button", "Có hợp với quán không": "Is it a fit", "Bài đăng": "Post", "Khuyến mãi gợi ý": "Suggested promotion",
  "Mẫu video nên dùng": "Video template to use", "Đăng lúc nào": "When to post", "Gợi ý sắp xếp": "Layout tips", "Ảnh nên dùng": "Photo to use", "Hỏi đáp gợi ý": "Suggested Q&A",
  "Bài đăng hôm nay": "Today's post", "Món gợi ý": "Suggested dishes", "Ghi chú cho chủ quán": "Notes for the owner", "Lời kể cho video": "Video narration", "Vì sao": "Why",
  "Khách nói": "Customer says", "Nhận xét nhanh": "Quick take", "Nên đăng về": "Post about", "Nên làm khuyến mãi": "Run a promotion on", "Bài đăng mẫu": "Sample post",
  "Gồm": "Includes", "Áp dụng": "When", "Câu quảng bá": "Promo line", "Tặng": "Free gift", "Điểm yếu": "Weak spot", "Điểm mạnh": "Strong point", "Loại bài": "Post type",
  "Độ dài caption": "Caption length", "Thời gian đăng": "Posting times", "Vì sao hiệu quả": "Why it works", "Bài viết": "Post", "Lời thoại video": "Video script",
  "Nên": "Do", "Tránh": "Avoid", "Nên làm": "Do", "Nên tránh": "Avoid", "Nội dung chính": "What happens", "Vì sao chọn": "Why it was picked",
};
// Numbered headings: "Phương án 2 · Chân thành", "Bộ 1 · Tiếp cận rộng", "Ngày 3 · 19:30 · Bán hàng: …".
const NUMBERED = [
  [/^Phương án (\d+)/, "Option $1"], [/^Tin (\d+)/, "Message $1"], [/^Dịp (\d+)/, "Occasion $1"], [/^Đoạn (\d+)/, "Clip $1"], [/^Điểm: (\d+)\/(\d+)/, "Score: $1/$2"], [/^Kế hoạch (\d+) ngày cho /, "$1-day plan for "], [/^Bộ (\d+)/, "Set $1"], [/^Ngày (\d+)/, "Day $1"], [/^Bài (\d+)/, "Post $1"], [/^Món:/, "Dish:"], [/^Tình huống:/, "Scenario:"],
];
const PILLAR_WORDS = { "Giáo dục": "Educate", "Bán hàng": "Sell", "Tương tác": "Engage", "Giải trí": "Entertain" };
// Fixed names inside numbered headings (review reply styles, hashtag sets).
const LABELS = {
  "Chân thành, xin lỗi": "Sincere apology", "Xin lỗi chân thành": "Sincere apology", "Nói rõ quán sẽ cải thiện": "How we will improve", "Cầu thị": "Open to feedback", "Chân thành": "Sincere", "Chuyên nghiệp": "Professional", "Gần gũi, vui vẻ": "Friendly and upbeat", "Gần gũi": "Friendly", "Ngắn gọn": "Short",
  "Tiếp cận rộng": "Broad reach", "Khách quanh khu vực": "Local customers", "Ngách, dễ lên top": "Niche, easy to rank", "Ngách": "Niche", "Thương hiệu riêng": "Your brand",
};
const TZ = { "giờ Việt Nam": "Vietnam time", "giờ miền Đông Mỹ": "US Eastern time", "giờ miền Trung Mỹ": "US Central time", "giờ miền Núi Mỹ": "US Mountain time", "giờ miền Tây Mỹ": "US Pacific time" };

// Job titles are written by the server in Vietnamese: translate their opening words.
const TITLE_PREFIXES = [
  ["Video trình chiếu", "Slideshow video"], ["Video storyboard", "Storyboard video"], ["Video kể chuyện", "Story video"], ["Viết Facebook", "Facebook post"], ["Viết Threads", "Threads post"],
  ["Review Google Maps", "Google Maps reviews"], ["Đối thủ quanh quán", "Nearby competitors"], ["So sánh review", "Review compare"], ["Xu hướng tìm kiếm", "Search trends"], ["Theo dõi sao", "Rating watch"], ["Review Yelp", "Yelp reviews"], ["Phân tích Instagram", "Instagram analysis"], ["Phân tích fanpage", "Facebook page analysis"],
  ["Phân tích reel", "Reel analysis"], ["So sánh", "Compare"], ["Kế hoạch", "Plan"], ["Kịch bản inbox", "Inbox scripts"], ["Kịch bản livestream", "Livestream script"],
  ["Hashtag & giờ đăng", "Hashtags & posting times"], ["Trả lời review", "Review replies"], ["Nhân bản", "Clone"], ["Chiến dịch", "Campaign"], ["Theo dõi", "Watch"],
  ["Chấm bài", "Post score"], ["Đoán món", "Dish riddle"], ["Câu chuyện", "Story"], ["Thời tiết", "Weather"], ["Zalo", "Zalo"], ["Giới thiệu quán", "Restaurant bio"],
  ["Đọc doanh số", "Sales insight"], ["Khuyến mãi", "Promotions"], ["Chỉnh ảnh", "Photo fix"], ["Cắt Reels", "Reels cut"], ["Tóm tắt livestream", "Livestream recap"],
  ["Clone bài đối thủ", "Competitor post clone"], ["Chăm khách tuần này", "This week's reviews"], ["Ra mắt món mới", "Launch a new dish"], ["Đẩy khuyến mãi", "Push a promotion"],
  ["Mở quán ở Mỹ", "Launch a US restaurant"], ["Bài Google Business", "Google Business post"], ["Bài Nextdoor", "Nextdoor post"], ["Menu giao hàng", "Delivery menu"], ["Dịp lễ Mỹ", "US occasions"],
  ["Banner", "Banner"], ["Lồng tiếng", "Dub"],
  ["Ảnh", "Image"], ["Menu", "Menu"], ["Livestream", "Livestream"], ["Reels", "Reels"], ["TikTok", "TikTok"], ["Threads", "Threads"], ["Campaign", "Campaign"],
];

// Leftover words in computed cells and times ("14:00 đến 18:00", "tháng 12, tháng 5", "(giảm 18%)").
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FRAGMENTS = [
  [/(\d{1,2}(?::\d{2})?h?) đến (\d)/g, "$1 to $2"], [/^đến (\d)/, "until $1"], [/tháng (\d{1,2})\b/g, (m, n) => MONTHS[+n] ?? m], [/\(giảm (\d+)%\)/g, "($1% off)"],
  [/\((\d+)% giá bán\)/g, "($1% of price)"], [/\(không kèm quà\)/g, "(no gift)"], [/reel mỗi tuần/g, "reels per week"], [/(\d) bài\b/g, "$1 posts"], [/(\d) reel\b/g, "$1 reels"],
  [/dưới (\d+) giây/g, "under $1 s"], [/trên (\d+) giây/g, "over $1 s"], [/(\d+)[‑-](\d+) giây/g, "$1-$2 s"], [/(\d+) giây/g, "$1 s"], [/ký tự/g, "chars"],
  [/^ngắn \(/, "short ("], [/^vừa \(/, "medium ("], [/^dài \(/, "long ("], [/^sáng \(/, "morning ("], [/^trưa \(/, "midday ("], [/^chiều \(/, "afternoon ("], [/^tối \(/, "evening ("], [/^đêm \(/, "night ("],
  [/ đến (Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, " to $1"], [/\(dưới (\d+)/g, "(under $1"], [/\(trên (\d+)/g, "(over $1"], [/ \(tiếng Việt\)/g, ""], [/\bBộ (\d)/g, "Set $1"],
  [/(\d+) đoạn\b/g, "$1 clips"], [/^Mức tìm kiếm 12 tháng qua/, "Search interest, past 12 months"], [/^GPU đã kết nối/, "GPU connected"], [/^góp ý (\d+) days$/, "feedback $1 days"],
  [/· Giải trí/g, "· Entertain"], [/· Giáo dục/g, "· Educate"], [/· Tương tác/g, "· Engage"], [/· Bán hàng/g, "· Sell"], [/· Video ngắn/g, "· Short video"],
  [/^Đã quét (\d+) (?:bài|posts) cho (.+), giữ lại (\d+) (?:bài|posts) nổi bật nhất\.?/, "Scanned $1 posts for $2, kept the top $3."], [/^Đã đọc (\d+) video cho ([^.]+)\./, "Read $1 videos for $2."],
  [/^Đã đọc (\d+) (?:bài|posts) của kênh, chọn (\d+) (?:bài|posts) nhiều tương tác nhất làm gốc\./, "Read $1 posts from the channel, picked the $2 most engaging as the base."],
  [/^Đã bỏ (\d+) câu có ưu đãi trong bài đăng \(quán chưa chọn ưu đãi nào\)\. Ý khuyến mãi nằm ở dòng "Khuyến mãi gợi ý"\./, "Removed $1 sentence(s) with an offer from the post (no offer was chosen). The promotion idea is in \"Suggested promotion\"."],
  [/\[ƯU ĐÃI\]/g, "[OFFER]"], [/\[NGÀY\]/g, "[DATE]"], [/\bBài (?=[a-z])/g, "Posts "], [/(Giải trí|Giáo dục|Tương tác|Bán hàng)/g, (w) => PILLAR_WORDS[w]],
  [/không có caption/g, "no caption"], [/gấp (\d+) trung vị/g, "$1x the median"], [/Chủ nhật/g, "Sun"], [/[Tt]hứ ([2-7])/g, (m, d) => DAYS[d]], [/ mở$/, " open"], [/^ảnh$/, "photo"],
];

const frag = (s) => FRAGMENTS.reduce((out, [re, en]) => out.replace(re, en), s);

export function translate(text) {
  const t = text.trim();
  if (!t) return null;
  // Vietnamese without accents ("AI xem video") is only found by the exact dictionary entry.
  if (!/[^\x00-\x7F]/.test(t) && Object.hasOwn(EN, t)) return text.replace(t, EN[t]);
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
    for (const [vi, en] of TITLE_PREFIXES) if (t.startsWith(`${vi} `) && (t.includes(" · ") || t.includes(" @"))) return frag(text.replace(vi, en)).replace(/(\d+) ngày/, "$1 days").replace(/(\d+) món/, "$1 dishes").replace(/(\d+) phút/, "$1 min").replace(/(\d+) reel mới/, "$1 new reels").replace(/học từ /, "learning from ").replace(/(\d+) bài/, "$1 posts");
    // A known label opening a line of the result: "Vì sao chọn: Highlights a celebrity cameo…".
    const lead = t.match(/^([^:\n]{2,40}):\s/);
    if (lead && HEADINGS[lead[1]]) return text.replace(lead[1], HEADINGS[lead[1]]);
    // Weekdays first: "Thứ 7, 10/10" must not read as the queue's "Thứ ${n}".
    const day = t.match(/^(?:Thứ ([2-7])|Chủ nhật)(.*)$/);
    if (day) return text.replace(t, `${day[1] ? DAYS[day[1]] : "Sun"}${day[2]}`);
    for (const p of patterns) if (p.re.test(t)) return text.replace(t, t.replace(p.re, p.out));
    // Progress steps show the server's phase without its trailing "…".
    if (!t.endsWith("…")) {
      const dotted = `${t}…`;
      const p = patterns.find((x) => x.re.test(dotted));
      const hit2 = EN[dotted] ?? (p ? dotted.replace(p.re, p.out) : null);
      if (hit2) return text.replace(t, hit2.replace(/…$/, ""));
    }
  }
  for (const [re, out] of UNITS) if (re.test(t)) return text.replace(t, t.replace(re, out));
  if (/[^\x00-\x7F]/.test(t)) {
    let out = t;
    for (const [re, en] of FRAGMENTS) out = out.replace(re, en);
    if (out !== t) return text.replace(t, out);
  }
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
