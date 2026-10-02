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

    default:
      throw new InputError(`Loại tác vụ không hợp lệ: ${type}`);
  }
}
