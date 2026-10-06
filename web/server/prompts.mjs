// Validate job input from the UI and turn it into the agent prompt.
// Prompts are written so the right skill triggers; the skill owns the method.

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
export const VIDEO_MODES = { topic: "Kịch bản tự do", storyboard: "Story Board", story: "Kể chuyện" };
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

const isSingleVideo = (url) => /fb\.watch|\/reel\/\d|\/videos\/|\/watch\/?\?v=|\/share\/(r|v)\//i.test(url);

/**
 * @param {{ template?: object, refJob?: object }} refs  library item / job looked up from
 *   raw.templateId / raw.referenceJobId by the caller (undefined = not found)
 * @returns {{ agent: "scout"|"writer", title: string, input: object, prompt: string }}
 */
export function buildJob(type, raw, refs = {}) {
  raw ??= {};
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
      const base = { mode, ratio, voice, style, tone, brief, engine };
      const head = "Viết kịch bản video ngắn theo định dạng JSON của skill video-scripter. Lời thoại tiếng Việt.";

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
        input: { url, focus },
        prompt:
          `Phân tích fanpage Facebook ${url} theo skill fanpage-analyzer: đọc 100 reel gần nhất kèm tương tác (list_reels.py --count 100 --stats --limit 200, không cần đăng nhập) rồi chạy analyze_reels.py để có số liệu.` +
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

    default:
      throw new InputError(`Loại tác vụ không hợp lệ: ${type}`);
  }
}
