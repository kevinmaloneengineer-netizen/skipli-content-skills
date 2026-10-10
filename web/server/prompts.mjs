// Validate job input from the UI and turn it into the agent prompt.
// Prompts are written so the right skill triggers; the skill owns the method.

import { instagramUser, yelpUrl } from "./sources/socialApify.mjs";

export class InputError extends Error {}

/** Channel-scan prompt when the server already has the reel list: the skill skips browser collection (step 1a). */
export function channelPromptWithIds({ url, topic, top }, ids) {
  return (
    `Quét kênh Facebook ${url} và chọn ${top} reel tốt nhất` +
    (topic ? ` về chủ đề "${topic}"` : "") +
    `. Danh sách ${ids.length} reel gần nhất của kênh đã được lấy sẵn - KHÔNG dùng trình duyệt (bỏ bước 1a), ` +
    `chạy thẳng bước 1b với các ID này (dùng --limit 30):\n${ids.join(",")}\n` +
    "Khi báo cáo, ghi rõ đã quét " + ids.length + " reel gần nhất. Chạy lại script từ đầu, không dùng kết quả cũ. Trả lời bằng tiếng Việt."
  );
}

const SHORT = { facebook: "Facebook", threads: "Threads", tiktok: "video ngắn", ads: "quảng cáo" };
const PLATFORMS = { facebook: "Facebook", threads: "Threads", tiktok: "TikTok/Reels (kịch bản video + caption)", ads: "quảng cáo Facebook" };
const MAX_REFERENCE = 20_000;
const CLONE_PLATFORMS = { facebook: "Facebook", threads: "Threads", tiktok: "video ngắn (kịch bản + caption)" };
const VIDEO_RATIOS = ["9:16", "16:9", "1:1"];
export const VIDEO_MODES = { topic: "Kịch bản tự do", storyboard: "Story Board", story: "Kể chuyện", slideshow: "Trình chiếu ảnh" };
export const VIDEO_STYLES = { real: "chân thực như quay thật (photorealistic)", cinematic: "điện ảnh (cinematic film still)", anime: "anime Nhật Bản (anime style)", pixar: "hoạt hình 3D (3D animation, Pixar style)", clay: "đất sét (claymation)", cyberpunk: "cyberpunk (neon cyberpunk)" };
export const VIDEO_TONES = { warm: "nhẹ nhàng, ấm áp", fun: "vui nhộn", emotional: "cảm động", dramatic: "kịch tính", inspiring: "truyền cảm hứng" };
const MAX_STORY_WORDS = 350;
const IMAGE_SIZES = ["1:1", "4:5", "9:16", "16:9"];
const IMAGE_SIZE_NAMES = { "1:1": "bài đăng vuông", "4:5": "bài đăng dọc", "9:16": "story, reels", "16:9": "ảnh bìa, YouTube" };
const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const weekday = (ymd) => WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
export const PILLARS = { entertain: "Giải trí", educate: "Giáo dục", engage: "Tương tác", sell: "Bán hàng" };

function str(v, field, { required = false, max = 500 } = {}) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new InputError(`Thiếu ${field}`);
  if (s.length > max) throw new InputError(`${field} dài quá ${max} ký tự`);
  return s;
}

function num(v, field, min, max, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new InputError(`${field} phải từ ${min} đến ${max}`);
  return n;
}

function list(v, field, maxItems) {
  const items = (Array.isArray(v) ? v : String(v ?? "").split(/[\n,]/))
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (items.length > maxItems) throw new InputError(`Tối đa ${maxItems} ${field}`);
  for (const x of items) if (x.length > 100) throw new InputError(`${field} quá dài: ${x.slice(0, 30)}…`);
  return [...new Set(items)];
}

function facebookUrl(raw) {
  const s = str(raw, "link Facebook", { required: true, max: 300 });
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new InputError("Link Facebook không hợp lệ");
  }
  if (!/(^|\.)(facebook\.com|fb\.watch)$/i.test(u.hostname)) throw new InputError("Link phải thuộc facebook.com hoặc fb.watch");
  u.hash = "";
  return u.toString();
}

/** Where the page posts from: its posting hours are read in this zone (default Vietnam). */
export const TIME_ZONES = { "Asia/Ho_Chi_Minh": "giờ Việt Nam", "America/New_York": "giờ miền Đông Mỹ (ET)", "America/Chicago": "giờ miền Trung Mỹ (CT)", "America/Denver": "giờ miền Núi Mỹ (MT)", "America/Los_Angeles": "giờ miền Tây Mỹ (PT)" };
const timeZone = (v) => (TIME_ZONES[v] ? v : "Asia/Ho_Chi_Minh");

const isSingleVideo = (url) => /fb\.watch|\/reel\/\d|\/videos\/|\/watch\/?\?v=|\/share\/(r|v)\//i.test(url);

/**
 * @param {{ template?: object, refJob?: object }} refs  library item / job looked up from
 *   raw.templateId / raw.referenceJobId by the caller (undefined = not found)
 * @returns {{ agent: "scout"|"writer", title: string, input: object, prompt: string }}
 */
export function buildJob(type, raw, refs = {}) {
  const spec = buildSpec(type, raw ?? {}, refs);
  // English input (a US restaurant): what gets posted or sent to customers is written in English.
  if (CONTENT_TYPES.has(type) && isEnglish(userText(raw)) && !spec.prompt.includes(ENGLISH_RULE)) {
    spec.prompt = `${spec.prompt.replace(/,? bằng tiếng Việt/g, " (ngôn ngữ theo mục NGÔN NGỮ cuối tin nhắn)").replace(/Trả lời bằng tiếng Việt\./g, "").replace(/Lời thoại tiếng Việt\./g, "Lời thoại (narration) và tiêu đề viết bằng tiếng Anh kiểu Mỹ.")}\n\n${ENGLISH_RULE}`;
    spec.input = { ...spec.input, lang: "en" };
  }
  return spec;
}

/** Job types whose result is copy for customers (scan reports stay in Vietnamese for the owner). */
const CONTENT_TYPES = new Set(["write", "review", "menu", "inbox", "hashtag", "livestream", "plan", "clone", "campaign", "image", "video"]);
const ENGLISH_RULE = [
  "NGÔN NGỮ: thông tin được nhập bằng tiếng Anh, khách của quán nói tiếng Anh (thị trường Mỹ).",
  "Viết TOÀN BỘ nội dung dành cho khách (bài đăng, caption, câu trả lời, tin nhắn, mô tả món, lời thoại, chữ trên ảnh, hashtag) bằng tiếng Anh tự nhiên kiểu Mỹ. Tiền tệ là USD ($).",
  "GIỮ NGUYÊN các tiêu đề mục và nhãn theo mẫu của skill bằng tiếng Việt (ví dụ \"## Phương án 1: …\", \"## Món: …\", \"## Tình huống: …\", \"**Khách nhắn:**\", \"**Trả lời:**\", \"## Bộ 1 · …\", \"## Ngày 1 · 19:30 · …\") để ứng dụng hiển thị đúng; phần tên sau dấu \":\" được viết tiếng Anh.",
  "Ghi chú và giải thích cho chủ quán viết tiếng Việt. Chỗ chưa biết để dạng [PRICE], [LINK], [HOURS], [PHONE].",
].join("\n");
const VI_MARKS = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
// Vietnamese typed without accents ("quan lau bo ngon") must not count as English.
const VI_PLAIN = /\b(quan|lau|bo|pho|com|bun|ngon|gia|mon|khach|ban|cua|cho|nhe|nha hang|tiem|uu dai|giam)\b/gi;
function userText(raw = {}) {
  const skip = /^(url|urls|start|platform|platforms|tone|style|size|ratio|engine|voice|mode|kind|templateId|referenceJobId|referenceImageId|panelIds|pillars|source|lang)$/;
  return Object.entries(raw)
    .filter(([k, v]) => !skip.test(k) && (typeof v === "string" || Array.isArray(v)))
    .map(([, v]) => [v].flat().join(" "))
    .join(" ")
    .replace(/https?:\/\/\S+/g, " ");
}
export function isEnglish(text) {
  if (VI_MARKS.test(text)) return false;
  if ((text.match(VI_PLAIN) ?? []).length >= 2) return false;
  return (text.match(/\b[a-z]{3,}\b/gi) ?? []).length >= 3;
}

function buildSpec(type, raw, refs) {
  switch (type) {
    case "fb-reels": {
      const url = facebookUrl(raw.url);
      const topic = str(raw.topic, "chủ đề", { max: 120 });
      const top = num(raw.top, "số reel", 1, 10, 5);
      if (isSingleVideo(url)) {
        return {
          agent: "scout",
          title: `Phân tích reel ${url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}`,
          input: { url, mode: "reel", topic: "", top: 1 },
          prompt: `Phân tích nội dung reel Facebook này: ${url}\nTrả lời bằng tiếng Việt.`,
        };
      }
      // depth = how many latest reels the skill scans (free, logged-out paging); with APIFY_TOKEN the server prefetches the list instead (prepare.mjs)
      const depth = num(raw.depth, "phạm vi quét", 10, 100, 100) >= 100 ? 100 : 10;
      const name = new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
      const input = { url, mode: "channel", depth, topic, top };
      return {
        agent: "scout",
        title: `Reels @${name}${topic ? ` · ${topic}` : ""}${depth === 100 ? " · 100 reel" : ""}`,
        input,
        prompt:
          `Quét ${depth} reel gần nhất của kênh Facebook ${url} (list_reels.py --count ${depth} --stats, không cần đăng nhập) và chọn ${top} reel tốt nhất` +
          (topic ? ` về chủ đề "${topic}"` : "") +
          ". Chạy lại script từ đầu, không dùng kết quả cũ. Trả lời bằng tiếng Việt.",
      };
    }

    case "threads": {
      const keywords = list(raw.keywords, "từ khoá", 4);
      const profiles = list(raw.profiles, "tài khoản", 5).map((p) => {
        const m = p.match(/threads\.(?:net|com)\/@([\w.]+)/i) ?? p.match(/^@?([\w.]+)$/);
        if (!m) throw new InputError(`Tài khoản Threads không hợp lệ: ${p}`);
        return `@${m[1]}`;
      });
      if (!keywords.length && !profiles.length) throw new InputError("Nhập ít nhất một từ khoá hoặc tài khoản");
      const days = num(raw.days, "số ngày", 0, 365, 30);
      const top = num(raw.top, "số bài", 3, 30, 10);
      const parts = [];
      if (keywords.length) parts.push(`từ khoá ${keywords.map((k) => `"${k}"`).join(", ")}`);
      if (profiles.length) parts.push(`tài khoản ${profiles.join(", ")}`);
      return {
        agent: "scout",
        title: `Threads · ${[...keywords, ...profiles].join(", ").slice(0, 70)}`,
        input: { keywords, profiles, days, top },
        prompt:
          `Tìm ${top} bài Threads viral nhất theo ${parts.join(" và ")}` +
          (days ? ` trong ${days} ngày gần đây` : "") +
          ". Với từ khoá, tự thêm 1–2 biến thể đồng nghĩa để quét rộng hơn. Chạy lại script từ đầu, không dùng kết quả cũ. Trả lời bằng tiếng Việt.",
      };
    }

    case "write": {
      const platform = str(raw.platform, "nền tảng", { max: 20 }) || "facebook";
      if (!PLATFORMS[platform]) throw new InputError("Nền tảng không hợp lệ");
      const topic = str(raw.topic, "chủ đề / sản phẩm", { required: true, max: 300 });
      const brief = str(raw.brief, "thông tin thêm", { max: 3000 });
      const tone = str(raw.tone, "giọng văn", { max: 100 });
      const variants = num(raw.variants, "số phương án", 1, 5, 3);

      let template = null;
      if (raw.templateId) {
        const t = refs.template;
        if (!t) throw new InputError("Không tìm thấy mẫu content đã chọn");
        template = { id: t.id, title: t.title, body: t.body };
      }

      const typedReference = str(raw.reference, "nội dung tham khảo", { max: MAX_REFERENCE });
      let reference = typedReference;
      let referenceJobId = null;
      if (raw.referenceJobId) {
        const j = refs.refJob;
        if (!j || j.status !== "done") throw new InputError("Kết quả tham khảo không tồn tại hoặc chưa xong");
        referenceJobId = j.id;
        reference = (reference ? `${reference}\n\n` : "") + j.result.slice(0, MAX_REFERENCE);
      }

      const sections = [
        `Viết ${variants} phương án content ${PLATFORMS[platform]} bằng tiếng Việt.`,
        `Chủ đề / sản phẩm: ${topic}`,
      ];
      if (brief) sections.push(`Thông tin thêm (thương hiệu, khách hàng, ưu đãi…):\n${brief}`);
      if (tone) sections.push(`Giọng văn: ${tone}`);
      if (template) sections.push(`Theo cấu trúc mẫu "${template.title}":\n${template.body}`);
      if (reference) {
        sections.push(
          "Nội dung tham khảo (chỉ lấy cảm hứng về hook, cấu trúc, góc tiếp cận - KHÔNG chép câu chữ, câu chuyện hay số liệu):\n" +
            "<<<THAM KHẢO\n" + reference + "\nTHAM KHẢO>>>",
        );
      }
      return {
        agent: "writer",
        title: `Viết ${SHORT[platform]} · ${topic.slice(0, 60)}`,
        input: { platform, topic, brief, tone, variants, templateId: template?.id ?? null, templateTitle: template?.title ?? null, reference: typedReference, referenceJobId },
        prompt: sections.join("\n\n"),
      };
    }

    case "clone": {
      const platform = str(raw.platform, "nền tảng", { max: 20 }) || "facebook";
      if (!CLONE_PLATFORMS[platform]) throw new InputError("Nền tảng không hợp lệ");
      const topic = str(raw.topic, "chủ đề / sản phẩm của bạn", { required: true, max: 300 });
      const brief = str(raw.brief, "thông tin thêm", { max: 3000 });
      const tone = str(raw.tone, "giọng văn", { max: 100 });
      const count = num(raw.count, "số bài", 3, 15, 9);
      const pillars = (Array.isArray(raw.pillars) && raw.pillars.length ? raw.pillars : Object.keys(PILLARS)).map(String);
      for (const p of pillars) if (!PILLARS[p]) throw new InputError(`Nhóm nội dung không hợp lệ: ${p}`);
      const pillarNames = [...new Set(pillars)].map((p) => PILLARS[p]);

      const source = raw.source === "posts" ? "posts" : "url";
      const url = source === "url" ? facebookUrl(raw.url) : "";
      const posts = source === "posts" ? str(raw.posts, "bài viết của đối thủ", { required: true, max: MAX_REFERENCE }) : "";
      if (url && isSingleVideo(url)) throw new InputError("Hãy dán link trang/kênh, không phải link một reel");
      const name = url ? new URL(url).pathname.split("/").filter(Boolean)[0] ?? url : "";

      const sections = [
        `Nhân bản kênh: viết ${count} bài ${CLONE_PLATFORMS[platform]} MỚI cho kênh của tôi, học từ content gốc của đối thủ. Trả lời bằng tiếng Việt.`,
        url
          ? `Content gốc: kênh Facebook ${url}. Đọc 30 reel gần nhất kèm tương tác (list_reels.py --count 30 --stats --limit ${Math.min(count + 5, 20)}, không cần đăng nhập, KHÔNG xem video), lấy những bài nhiều tương tác nhất làm gốc. Chạy lại script từ đầu, không dùng kết quả cũ.`
          : "Content gốc của đối thủ (mỗi bài cách nhau bởi dòng trống hoặc ---):\n<<<BÀI GỐC\n" + posts + "\nBÀI GỐC>>>",
        `Kênh của tôi: ${topic}`,
      ];
      if (brief) sections.push(`Thông tin thêm (thương hiệu, khách hàng, ưu đãi…):\n${brief}`);
      if (tone) sections.push(`Giọng văn: ${tone}`);
      sections.push(`Chia đều các bài vào các nhóm: ${pillarNames.join(", ")}.`);
      return {
        agent: url ? "scout" : "writer",
        title: `Nhân bản ${name ? `@${name}` : "bài đối thủ"} · ${topic.slice(0, 50)}`,
        input: { source, url, posts, platform, topic, brief, tone, count, pillars: [...new Set(pillars)] },
        prompt: sections.join("\n\n"),
      };
    }

    case "video": {
      const mode = VIDEO_MODES[raw.mode] ? raw.mode : "topic";
      const ratio = VIDEO_RATIOS.includes(raw.ratio) ? raw.ratio : "9:16";
      const voice = raw.voice === "male" ? "male" : "female";
      const style = VIDEO_STYLES[raw.style] ? raw.style : "real";
      const tone = VIDEO_TONES[raw.tone] ? raw.tone : "warm";
      const brief = str(raw.brief, "thông tin thêm", { max: 2000 });
      const upload = (id, label) => {
        if (!id) return null;
        if (!refs.hasUpload?.(String(id))) throw new InputError(`${label} không còn, hãy tải lại ảnh`);
        return String(id);
      };
      const common = [`Phong cách hình ảnh: ${VIDEO_STYLES[style]}`, `Tone cảm xúc: ${VIDEO_TONES[tone]}`, `Khung hình: ${ratio}`];
      if (brief) common.push(`Thông tin thêm:\n${brief}`);
      const engine = ["wan", "wan5b", "ltx"].includes(raw.engine) ? raw.engine : "wan";
      const audio = raw.audio === "music" ? "music" : "voice";
      const base = { mode, ratio, voice, style, tone, brief, engine, audio };
      const kind = raw.kind === "showcase" ? "showcase" : "story";
      base.kind = kind;
      if (kind === "showcase") common.push("LOẠI VIDEO: Showcase (food and place) theo skill: không có nhân vật chính, không có cảnh người kể, món ăn và không gian quán là chủ thể của mọi cảnh.");
      if (audio === "music") common.push('ÂM THANH: video KHÔNG có giọng đọc, chỉ có nhạc nền vui không lời. Mỗi cảnh khoảng 3 giây. "narration" là dòng chữ ngắn hiện trên màn hình (tối đa 6 từ, ví dụ tên món hoặc một lời mời), KHÔNG phải câu để đọc. Cảnh cuối là lời mời ghé quán (tên quán).');
      const head = "Viết kịch bản video ngắn theo định dạng JSON của skill video-scripter. Lời thoại tiếng Việt.";

      if (mode === "slideshow") {
        // AI-drawn photos of the dishes and the place, shown with slow zoom/pan and crossfades over soft music.
        const topic = str(raw.topic, "quán / món ăn", { required: true, max: 300 });
        const seconds = Number(raw.seconds) === 30 ? 30 : 15;
        const count = seconds === 30 ? 6 : 5;
        // Title card on the first photo (drawn by the server, not by the image model).
        const card = { name: str(raw.name, "tên quán", { max: 60 }), city: str(raw.city, "thành phố", { max: 60 }), address: str(raw.address, "địa chỉ", { max: 160 }), phone: str(raw.phone, "số điện thoại", { max: 30 }), logoId: upload(raw.logoId, "Logo") };
        // Real photos of the restaurant come first; the image model only fills the remaining slots.
        const photoIds = (Array.isArray(raw.photoIds) ? raw.photoIds : []).slice(0, count).map((id) => upload(id, "Ảnh của quán"));
        const ai = count - photoIds.length;
        const want = Math.max(1, ai); // with every slot filled the model's answer is not drawn
        const plan = photoIds.length
          ? [
              `Người dùng đã có ${photoIds.length} ảnh thật (thường là món ăn), dùng làm các ảnh đầu video. Viết đúng ${want} ý tưởng ảnh VẼ THÊM theo định dạng JSON của skill image-prompter, cho một video TRÌNH CHIẾU ảnh quảng bá quán (ảnh nối nhau, có nhạc nền, không chữ).`,
              `Ưu tiên theo thứ tự cho ${want} ảnh: bên trong quán (phòng ăn ấm cúng, bàn ghế, đèn, không có khách); bên ngoài quán (mặt tiền lúc chạng vạng, cửa kính sáng đèn vàng ấm, cây xanh, không biển hiệu, không chữ); món đặc trưng (suy từ tên quán) ở góc khác; cả bàn đầy món nhìn từ trên xuống; bếp đang nấu món đặc trưng (chỉ thấy nồi). Nếu có ảnh bên ngoài quán thì để nó ở CUỐI.`,
            ]
          : [
              `Viết đúng ${count} ý tưởng ảnh theo định dạng JSON của skill image-prompter, dùng làm ${count} khung hình cho một video TRÌNH CHIẾU ảnh quảng bá quán (ảnh nối nhau, có nhạc nền, không chữ).`,
              `MÓN ĐẶC TRƯNG: suy ra từ tên quán và mô tả (quán "Phở …" → phở bò; quán BBQ → brisket). Video xoay quanh món này: ít nhất ${count - 2} ảnh có món đặc trưng, mỗi ảnh một góc khác nhau (tô món nhìn chéo 45 độ có khói bốc lên, cận cảnh gắp sợi/miếng thịt, rót nước dùng hoặc nước sốt, nhìn từ trên xuống cùng rau và món ăn kèm${count >= 6 ? ", đầu bếp đang nấu món này trong bếp (chỉ thấy nồi, không thấy người)" : ""}).`,
              `BẮT BUỘC có 2 ảnh về quán: ảnh ${count - 1} là bên trong quán (phòng ăn ấm cúng, bàn ghế, đèn, không có khách), ảnh ${count} là bên ngoài quán (mặt tiền lúc chạng vạng, cửa kính sáng đèn vàng ấm, cây xanh, vỉa hè, không có biển hiệu, không có chữ). Ảnh 1 là món đặc trưng đẹp nhất (thông tin quán sẽ đè lên ảnh này).`,
            ];
        return {
          agent: "writer",
          direct: "image-prompter",
          title: `Video trình chiếu ${seconds}s · ${topic.slice(0, 60)}`,
          input: { mode, ratio, style, brief, seconds, count, topic, audio: "music", ...card, photoIds, ai },
          prompt: [
            ...plan,
            "Mỗi \"prompt\" (tiếng Anh, dưới 60 từ) tả một bức ảnh chụp thật như của nhiếp ảnh gia: món ăn thật, chi tiết bề mặt, ánh sáng tự nhiên ấm, độ sâu trường ảnh nông, đúng kiểu quán và vùng miền (quán Việt ở Mỹ thì bát đĩa, bàn gỗ kiểu quán Việt). TUYỆT ĐỐI không có người, mặt, tay, chữ, logo, biển hiệu. KHÔNG ghi tên quán hay bất kỳ chữ nào trong prompt (model vẽ ảnh sẽ cố viết chữ đó lên ảnh và bị méo).",
            '"headline", "sub", "cta", "caption" để chuỗi rỗng "".',
            card.name ? `Tên quán (chỉ để biết món đặc trưng, KHÔNG đưa vào prompt): ${card.name}` : "",
            card.city ? `Khu vực: ${card.city}` : "",
            `Quán / món: ${topic}`,
            brief ? `Thông tin thêm:\n${brief}` : "",
          ].filter(Boolean).join("\n\n"),
        };
      }

      if (mode === "storyboard") {
        const topic = str(raw.topic, "nội dung câu chuyện", { required: true, max: 300 });
        const panelIds = Array.isArray(raw.panelIds) ? raw.panelIds.map((id) => upload(id, "Ô storyboard")) : [];
        if (panelIds.length < 2 || panelIds.length > 12) throw new InputError("Storyboard cần từ 2 đến 12 ô");
        return {
          agent: "writer",
          title: `Video storyboard ${panelIds.length} cảnh · ${topic.slice(0, 50)}`,
          input: { ...base, topic, panelIds },
          prompt: [head, `Có sẵn ${panelIds.length} khung hình storyboard theo thứ tự (đã vẽ, KHÔNG cần mô tả lại nhân vật). Viết đúng ${panelIds.length} cảnh, cảnh thứ i ứng với khung thứ i, mỗi cảnh khoảng 8 giây: lời thoại tiếp nối thành một câu chuyện, "motion" tả chuyển động trong khung đó.`, `Câu chuyện: ${topic}`, ...common].join("\n\n"),
        };
      }

      if (mode === "story") {
        const narration = str(raw.narration, "lời kể", { required: true, max: 4000 });
        const words = narration.split(/\s+/).filter(Boolean).length;
        if (words > MAX_STORY_WORDS) throw new InputError(`Lời kể tối đa ${MAX_STORY_WORDS} từ (đang có ${words})`);
        const narratorPct = Math.round(Math.min(100, Math.max(0, Number(raw.narratorPct) || 0)) / 10) * 10;
        const referenceImageId = upload(raw.referenceImageId, "Ảnh người kể");
        const shots = Math.min(14, Math.max(3, Math.round(words / 10)));
        return {
          agent: "writer",
          title: `Video kể chuyện · ${narration.slice(0, 50)}`,
          input: { ...base, narration, narratorPct, referenceImageId },
          prompt: [
            head,
            `Chia lời kể dưới đây thành khoảng ${shots} cảnh. GIỮ NGUYÊN từng chữ của lời kể (không thêm, không bớt), chỉ cắt thành các đoạn nối tiếp.`,
            `Khoảng ${narratorPct}% số cảnh là người kể chuyện nói trước camera (role "narrator"${referenceImageId ? ", có ảnh người kể" : ""}), các cảnh còn lại là hình minh hoạ cho đoạn lời đó (role "scene").`,
            "<<<LỜI KỂ\n" + narration + "\nLỜI KỂ>>>",
            ...common,
          ].join("\n\n"),
        };
      }

      const topic = str(raw.topic, "chủ đề", { required: true, max: 300 });
      const seconds = [15, 30, 45, 60].includes(Number(raw.seconds)) ? Number(raw.seconds) : 30;
      const referenceImageId = upload(raw.referenceImageId, "Ảnh tham chiếu");
      const sections = [head, `Video khoảng ${seconds} giây, ${Math.min(14, Math.round(seconds / 3))} cảnh, mỗi cảnh khoảng 3 giây và chỉ MỘT ý.`, `Chủ đề: ${topic}`, ...common];
      if (referenceImageId) sections.push('Có ảnh tham chiếu của nhân vật/sản phẩm chính: mọi cảnh có nó thì gọi đúng một cách mô tả cố định (ví dụ "the product from the reference photo").');
      return {
        agent: "writer",
        title: `Video ${seconds}s · ${topic.slice(0, 60)}`,
        input: { ...base, topic, seconds, referenceImageId },
        prompt: sections.join("\n\n"),
      };
    }

    case "fanpage": {
      const url = facebookUrl(raw.url);
      if (isSingleVideo(url)) throw new InputError("Hãy dán link trang/kênh, không phải link một reel");
      const focus = str(raw.focus, "điều muốn tìm hiểu", { max: 300 });
      const name = new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
      return {
        agent: "scout",
        title: `Phân tích fanpage @${name}`,
        input: { url, focus, tz: timeZone(raw.tz) },
        prompt:
          `Phân tích fanpage Facebook ${url} theo skill fanpage-analyzer: đọc 100 reel gần nhất kèm tương tác (list_reels.py --count 100 --stats --limit 200, không cần đăng nhập) rồi chạy analyze_reels.py --tz ${timeZone(raw.tz)} để có số liệu (giờ đăng tính theo ${TIME_ZONES[timeZone(raw.tz)]}).` +
          (focus ? ` Chú ý thêm: ${focus}.` : "") +
          " Chạy lại script từ đầu, không dùng kết quả cũ. Trả lời bằng tiếng Việt.",
      };
    }

    case "livestream": {
      const products = str(raw.products, "sản phẩm", { required: true, max: 3000 });
      const minutes = [30, 60, 90].includes(Number(raw.minutes)) ? Number(raw.minutes) : 60;
      const platform = raw.platform === "tiktok" ? "tiktok" : "facebook";
      const offer = str(raw.offer, "ưu đãi", { max: 1000 });
      const audience = str(raw.audience, "khách hàng", { max: 300 });
      const host = str(raw.host, "phong cách người live", { max: 100 });
      const sections = [
        `Viết kịch bản livestream bán hàng ${minutes} phút trên ${platform === "tiktok" ? "TikTok" : "Facebook"} theo skill livestream-scripter, bằng tiếng Việt.`,
        `Sản phẩm (mỗi dòng một sản phẩm):\n${products}`,
      ];
      if (offer) sections.push(`Ưu đãi có thật trong buổi live:\n${offer}`);
      else sections.push("Chưa có ưu đãi cụ thể: dùng chỗ trống [ƯU ĐÃI], không tự bịa giảm giá hay quà tặng.");
      if (audience) sections.push(`Khách hàng: ${audience}`);
      if (host) sections.push(`Phong cách người live: ${host}`);
      const first = products.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
      return {
        agent: "writer",
        title: `Livestream ${minutes} phút · ${first.slice(0, 60)}`,
        input: { products, minutes, platform, offer, audience, host },
        prompt: sections.join("\n\n"),
      };
    }

    case "image": {
      const topic = str(raw.topic, "sản phẩm / chủ đề", { required: true, max: 300 });
      const brief = str(raw.brief, "thông tin thêm", { max: 2000 });
      const size = IMAGE_SIZES.includes(raw.size) ? raw.size : "1:1";
      const style = VIDEO_STYLES[raw.style] ? raw.style : "real";
      const count = [1, 2, 4].includes(Number(raw.count)) ? Number(raw.count) : 4;
      const withText = raw.withText !== false;
      let referenceImageId = null;
      if (raw.referenceImageId) {
        if (!refs.hasUpload?.(String(raw.referenceImageId))) throw new InputError("Ảnh sản phẩm không còn, hãy tải lại ảnh");
        referenceImageId = String(raw.referenceImageId);
      }
      const sections = [
        `Lên ý tưởng ${count} ảnh quảng cáo khác nhau theo định dạng JSON của skill image-prompter. Câu chữ tiếng Việt.`,
        `Sản phẩm / chủ đề: ${topic}`,
        `Khung ảnh: ${size} (${IMAGE_SIZE_NAMES[size]})`,
        `Phong cách hình ảnh: ${VIDEO_STYLES[style]}`,
        withText ? "Mỗi ảnh có headline, sub và cta để đặt chữ lên ảnh." : "Ảnh không cần chữ: để headline, sub, cta rỗng, chỉ viết caption.",
      ];
      if (brief) sections.push(`Thông tin thêm:\n${brief}`);
      if (referenceImageId) sections.push('Có ảnh sản phẩm thật làm mẫu: prompt mô tả bối cảnh quanh "the product from the reference photo", không mô tả lại sản phẩm khác.');
      return {
        agent: "writer",
        title: `Ảnh ${size} · ${topic.slice(0, 60)}`,
        input: { topic, brief, size, style, count, withText, referenceImageId },
        prompt: sections.join("\n\n"),
      };
    }

    case "plan": {
      const topic = str(raw.topic, "kênh / sản phẩm", { required: true, max: 300 });
      const brief = str(raw.brief, "thông tin thêm", { max: 2000 });
      const tone = str(raw.tone, "giọng văn", { max: 100 });
      const days = [7, 14].includes(Number(raw.days)) ? Number(raw.days) : 7;
      const perDay = [1, 2].includes(Number(raw.perDay)) ? Number(raw.perDay) : 1;
      const platform = CLONE_PLATFORMS[raw.platform] ? raw.platform : "facebook";
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.start ?? "")) ? raw.start : null;
      if (!start) throw new InputError("Chọn ngày bắt đầu");
      const pillars = (Array.isArray(raw.pillars) && raw.pillars.length ? raw.pillars : Object.keys(PILLARS)).map(String);
      for (const p of pillars) if (!PILLARS[p]) throw new InputError(`Nhóm nội dung không hợp lệ: ${p}`);
      const sections = [
        `Lên kế hoạch content ${days} ngày, mỗi ngày ${perDay} bài ${CLONE_PLATFORMS[platform]}, theo định dạng của skill content-planner. Viết sẵn từng bài, tiếng Việt.`,
        `Kênh / sản phẩm: ${topic}`,
        `Ngày 1 là ${start} (${weekday(start)}). Chọn khung giờ đăng hợp lý cho từng ngày.`,
        `Xen kẽ các nhóm: ${[...new Set(pillars)].map((p) => PILLARS[p]).join(", ")}.`,
      ];
      if (brief) sections.push(`Thông tin thêm (khách hàng, ưu đãi có thật, sự kiện trong tuần…):\n${brief}`);
      if (tone) sections.push(`Giọng văn: ${tone}`);
      return {
        agent: "writer",
        title: `Kế hoạch ${days} ngày · ${topic.slice(0, 60)}`,
        input: { topic, brief, tone, days, perDay, platform, start, pillars: [...new Set(pillars)] },
        prompt: sections.join("\n\n"),
      };
    }

    case "review": {
      const review = str(raw.review, "nội dung đánh giá", { required: true, max: 3000 });
      const stars = num(raw.stars, "số sao", 0, 5, 0);
      const business = str(raw.business, "tên quán", { max: 120 });
      const style = str(raw.style, "giọng trả lời", { max: 100 });
      const facts = str(raw.facts, "thông tin thêm", { max: 1000 });
      const sections = ["Viết 3 phương án trả lời công khai cho đánh giá dưới đây, theo skill review-replier, bằng tiếng Việt."];
      sections.push(`Đánh giá của khách${stars ? ` (${stars} sao)` : ""}:\n<<<ĐÁNH GIÁ\n${review}\nĐÁNH GIÁ>>>`);
      if (business) sections.push(`Tên quán / cửa hàng: ${business}`);
      if (style) sections.push(`Giọng trả lời ưu tiên: ${style}`);
      if (facts) sections.push(`Thông tin có thật từ chủ quán (đã xử lý gì, ưu đãi mời quay lại…):\n${facts}`);
      return {
        agent: "writer",
        direct: "review-replier",
        title: `Trả lời review${stars ? ` ${stars}★` : ""} · ${review.replace(/\s+/g, " ").slice(0, 50)}`,
        input: { review, stars, business, style, facts },
        prompt: sections.join("\n\n"),
      };
    }

    case "maps": {
      const place = str(raw.place, "quán cần phân tích", { required: true, max: 300 });
      const focus = str(raw.focus, "điều muốn tìm hiểu", { max: 300 });
      const isLink = /^https?:\/\//i.test(place);
      if (isLink && !/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\./i.test(place)) throw new InputError("Link phải là link Google Maps của quán");
      return {
        agent: "scout",
        direct: "review-analyzer",
        title: `Review Google Maps · ${isLink ? "quán đối thủ" : place.slice(0, 60)}`,
        input: { place, focus },
        prompt: "", // filled by prepare.mjs once the reviews are collected
      };
    }

    case "yelp": {
      const url = yelpUrl(raw.url);
      if (!url) throw new InputError("Dán link trang quán trên Yelp, dạng yelp.com/biz/ten-quan");
      const focus = str(raw.focus, "điều muốn tìm hiểu", { max: 300 });
      return {
        agent: "scout",
        direct: "review-analyzer",
        title: `Review Yelp · ${url.split("/biz/")[1].replace(/-/g, " ").slice(0, 60)}`,
        input: { url, focus },
        prompt: "", // filled by prepare.mjs once the reviews are collected
      };
    }

    case "instagram": {
      const user = instagramUser(raw.url ?? raw.user);
      if (!user) throw new InputError("Nhập tên tài khoản Instagram (ví dụ @franklinbbq) hoặc link trang cá nhân");
      const focus = str(raw.focus, "điều muốn tìm hiểu", { max: 300 });
      return {
        agent: "scout",
        direct: "fanpage-analyzer",
        title: `Phân tích Instagram @${user}`,
        input: { user, url: `https://www.instagram.com/${user}/`, focus, tz: timeZone(raw.tz) },
        prompt: "", // filled by prepare.mjs once the posts are read
      };
    }

    case "menu": {
      const dishes = str(raw.dishes, "danh sách món", { required: true, max: 3000 });
      const lines = dishes.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 12) throw new InputError("Tối đa 12 món mỗi lần");
      const business = str(raw.business, "tên và phong cách quán", { max: 200 });
      const use = str(raw.use, "nơi dùng", { max: 100 });
      const sections = [`Viết nội dung menu cho ${lines.length} món dưới đây theo skill menu-writer, bằng tiếng Việt.`, `Danh sách món (mỗi dòng một món):\n${dishes}`];
      if (business) sections.push(`Quán: ${business}`);
      if (use) sections.push(`Dùng chủ yếu cho: ${use}`);
      return {
        agent: "writer",
        direct: "menu-writer",
        title: `Menu ${lines.length} món · ${(business || lines[0]).slice(0, 50)}`,
        input: { dishes, business, use },
        prompt: sections.join("\n\n"),
      };
    }

    case "inbox": {
      const business = str(raw.business, "cửa hàng / quán", { required: true, max: 300 });
      const kind = raw.kind === "restaurant" ? "restaurant" : "shop";
      const policies = str(raw.policies, "chính sách", { max: 2000 });
      const channel = str(raw.channel, "kênh", { max: 40 }) || "Messenger";
      const tone = str(raw.tone, "giọng văn", { max: 100 });
      const sections = [
        `Viết kịch bản trả lời inbox cho ${kind === "restaurant" ? "nhà hàng / quán ăn" : "cửa hàng bán hàng online"} theo skill inbox-scripter, bằng tiếng Việt.`,
        `Kinh doanh: ${business}`,
        `Kênh nhắn tin: ${channel}`,
      ];
      if (policies) sections.push(`Thông tin có thật (giá, ship, giờ mở cửa, đổi trả, đặt cọc…):\n${policies}`);
      if (!/\d+\s*(k|đ|vnd|nghìn|ngàn|triệu)\b/i.test(`${business} ${policies}`)) sections.push("Người dùng KHÔNG cho giá: mọi chỗ nói về giá đều ghi [GIÁ], không tự đặt con số.");
      else sections.push("Chưa có chính sách cụ thể: dùng chỗ trống như [GIÁ], [PHÍ SHIP], không tự bịa.");
      if (tone) sections.push(`Giọng văn: ${tone}`);
      return {
        agent: "writer",
        direct: "inbox-scripter",
        title: `Kịch bản inbox · ${business.slice(0, 60)}`,
        input: { business, kind, policies, channel, tone },
        prompt: sections.join("\n\n"),
      };
    }

    case "hashtag": {
      const business = str(raw.business, "quán / sản phẩm", { required: true, max: 300 });
      const area = str(raw.area, "khu vực", { max: 100 });
      const audience = str(raw.audience, "khách hàng", { max: 200 });
      const platforms = list(raw.platforms, "nền tảng", 4);
      const sections = ["Gợi ý bộ hashtag và khung giờ đăng theo skill hashtag-planner, bằng tiếng Việt.", `Kinh doanh: ${business}`];
      const en = isEnglish(userText(raw));
      sections.push(`Tag chắc chắn đúng, dùng làm gốc (có thể thêm tag khác nhưng phải đúng món, đúng khu vực): ${(en ? usHashtags(business, area) : baseHashtags(business, area)).join(" ")}`);
      if (area) sections.push(`Khu vực: ${area}`);
      sections.push(`Nền tảng: ${(platforms.length ? platforms : ["Facebook", "TikTok", "Instagram"]).join(", ")}`);
      if (audience) sections.push(`Khách hàng: ${audience}`);
      return {
        agent: "writer",
        direct: "hashtag-planner",
        title: `Hashtag & giờ đăng · ${business.slice(0, 60)}`,
        input: { business, area, audience, platforms },
        prompt: sections.join("\n\n"),
      };
    }

    case "tiktok": {
      const keywords = list(raw.keywords, "từ khoá", 3);
      const profiles = list(raw.profiles, "tài khoản", 3).map((p) => {
        const m = p.match(/tiktok\.com\/@([\w.-]+)/i) ?? p.match(/^@?([\w.-]+)$/);
        if (!m) throw new InputError(`Tài khoản TikTok không hợp lệ: ${p}`);
        return `@${m[1]}`;
      });
      if (!keywords.length && !profiles.length) throw new InputError("Nhập ít nhất một từ khoá hoặc tài khoản");
      const top = num(raw.top, "số video", 3, 10, 6);
      const business = str(raw.business, "kinh doanh của bạn", { max: 200 });
      return {
        agent: "scout",
        direct: "tiktok-viral-finder",
        title: `TikTok · ${[...keywords, ...profiles].join(", ").slice(0, 70)}`,
        input: { keywords, profiles, top, business },
        prompt: "", // filled by prepare.mjs once the videos are collected
      };
    }

    case "campaign": {
      // One click: scan a competitor, watch its best reels, then plan a week of posts that learns from them.
      const url = facebookUrl(raw.url);
      if (isSingleVideo(url)) throw new InputError("Hãy dán link trang/kênh đối thủ, không phải link một reel");
      const plan = buildJob("plan", { ...raw, days: raw.days ?? 7, perDay: raw.perDay ?? 1 });
      const name = new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
      return {
        agent: "writer",
        direct: "content-planner",
        title: `Chiến dịch ${plan.input.days} ngày · học từ @${name}`.slice(0, 120),
        input: { ...plan.input, url },
        prompt: plan.prompt, // prepare.mjs adds what the competitor's best reels did
      };
    }

    case "compare": {
      const urls = [...new Set((Array.isArray(raw.urls) ? raw.urls : String(raw.urls ?? "").split(/[\n,\s]+/)).map((u) => String(u).trim()).filter(Boolean))].map(facebookUrl);
      if (urls.length < 2 || urls.length > 3) throw new InputError("Nhập 2 hoặc 3 link fanpage để so sánh");
      if (urls.some(isSingleVideo)) throw new InputError("Hãy dán link trang/kênh, không phải link một reel");
      const focus = str(raw.focus, "điều muốn tìm hiểu", { max: 300 });
      const names = urls.map((u) => new URL(u).pathname.split("/").filter(Boolean)[0] ?? u);
      return {
        agent: "scout",
        direct: "competitor-compare",
        title: `So sánh ${names.map((n) => `@${n}`).join(" · ")}`.slice(0, 120),
        input: { urls, focus, tz: timeZone(raw.tz) },
        prompt: "", // filled by prepare.mjs once every page is read
      };
    }

    default:
      throw new InputError(`Loại tác vụ không hợp lệ: ${type}`);
  }
}

/** Skill for older writer jobs that need no tools, so they can run straight on the model (llm.mjs). */
export function directSkill(job) {
  if (job.direct) return job.direct;
  if (job.agent !== "writer") return null;
  return { write: "content-writer", livestream: "livestream-scripter", plan: "content-planner", image: "image-prompter", video: "video-scripter", clone: "channel-cloner" }[job.type] ?? null;
}

// ---- hashtags: the free models invent tags (#lauchay for a beef hotpot shop, other cities): seed safe
// tags built from the user's own words, then drop wrong ones from the answer.

const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "");
const STOP = /^(quan|tiem|nha|hang|shop|cua|binh|dan|ngon|re|cho|va|cac|cua hang)$/;
const CITIES = { saigon: /sai\s*g|hcm|hồ chí minh|ho chi minh|quận|quan \d/i, hanoi: /hà nội|ha noi|hanoi/i, danang: /đà nẵng|da nang/i, dalat: /đà lạt|da lat/i, cantho: /cần thơ|can tho/i, haiphong: /hải phòng|hai phong/i, nhatrang: /nha trang/i, hue: /\bhuế\b|\bhue\b/i, hoian: /hội an|hoi an/i, vungtau: /vũng tàu|vung tau/i, phuquoc: /phú quốc|phu quoc/i };
// Districts people tag by name: a tag for a district the user did not give is wrong.
const DISTRICTS = ["phunhuan", "binhthanh", "govap", "tanbinh", "tanphu", "thuduc", "binhtan", "nhabe", "cuchi", "hoankiem", "caugiay", "dongda", "badinh", "haibatrung", "tayho"];

/** Base tags for a US business: brand ("Smokey Joe's BBQ, a family…" → #smokeyjoesbbq) and city ("Austin, TX" → #austin #austinfood #austineats). */
export function usHashtags(business, area) {
  const brand = business.split(/[,(]| - /)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const city = area.split(",")[0].toLowerCase().replace(/[^a-z]/g, "");
  const tags = [brand, ...(city ? [city, `${city}food`, `${city}eats`] : []), "foodie"];
  return [...new Set(tags.filter((t) => t.length > 2 && t.length < 30))].map((t) => `#${t}`);
}

export function baseHashtags(business, area) {
  const words = business.split(/[\s,.;:()]+/).map(slug).filter((w) => w && !STOP.test(w));
  const dish = words.slice(0, 2).join(""); // "Quán lẩu bò bình dân" → "laubo"
  const district = area.match(/quận\s*(\d+|[\p{L}]+)/iu)?.[1];
  const tags = [dish, ...words.slice(0, 3)].filter((t) => t.length > 2);
  if (district) tags.push(`quan${slug(district)}`, `${dish}quan${slug(district)}`, `anngonquan${slug(district)}`);
  for (const [city, re] of Object.entries(CITIES)) if (re.test(area)) tags.push(city, `${city}food`, `${dish}${city}`);
  tags.push("amthuc", "reviewanngon", "anngon");
  return [...new Set(tags)].map((t) => `#${t}`);
}

/** Remove tags that contradict the business or area, plus spam tags; drop empty lines it leaves. */
export function cleanHashtags(md, { business = "", area = "", lang = "" } = {}) {
  const facts = `${business} ${area}`;
  const viOnly = /^(amthuc|anngon|reviewanngon|monngon|quanngon|ancungtiktok|xuhuong)/;
  const vegetarian = /chay/i.test(slug(business));
  const bad = (tag) => {
    const t = slug(tag);
    if (/follow|like4like|f4f|instagood|viral$|xuhuong$|^spam|^tag$|^hashtag$/.test(t)) return true;
    if (lang === "en" && viOnly.test(t)) return true; // a US audience does not search Vietnamese tags
    if (!vegetarian && /chay/.test(t)) return true;
    if (/quang\d/.test(t)) return true; // "quang3": misspelt "quận 3"
    if (DISTRICTS.some((d) => t.includes(d) && !slug(facts).includes(d))) return true;
    const q = t.match(/quan(\d+)/)?.[1]; // "#anngonquan5" when the user is in Quận 3
    if (q && !new RegExp(`quan${q}(?!\\d)`).test(slug(facts))) return true;
    if (/^lobo|^vietlau|^vietl/.test(t)) return true; // seen typos of "laubo"
    return Object.entries(CITIES).some(([city, re]) => t.includes(city) && !re.test(facts) && !(city === "saigon" && /hcm/.test(t)));
  };
  return md
    .split("\n")
    .map((line) => {
      const seen = new Set(); // one tag once per set
      return line.replace(/#[\p{L}\p{N}_]+/gu, (tag) => (bad(tag) || seen.has(slug(tag)) || !seen.add(slug(tag)) ? "" : tag));
    })
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+$/gm, "");
}
