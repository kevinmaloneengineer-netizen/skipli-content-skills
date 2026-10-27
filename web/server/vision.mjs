// Looks at a photo for the "Đoán món từ ảnh" skill: a short list of what is visible (colours, bowl, herbs,
// toppings). It never names the dish, so the riddle is still the owner's to write. Gemini reads images for free.

import { readFile } from "node:fs/promises";
import path from "node:path";

const MODELS = (process.env.GEMINI_IMAGE_MODELS ?? "gemini-flash-latest,gemini-3.8-flash").split(",");
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
export const ASK = "Mô tả bằng tiếng Việt, tối đa 60 chữ, chỉ những gì nhìn thấy trong ảnh: màu sắc, loại đồ đựng, rau hoặc topping, độ đậm nhạt, bố cục. Không gọi tên món ăn, không đoán tên quán, không mô tả người.";

/** @returns {Promise<string|null>} null when there is no key or no model answers */
export async function describePhoto(file, { fetchFn = fetch, signal } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) return null;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: (await readFile(file)).toString("base64") } }, { text: ASK }] }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } }, // a short description needs no thinking
  });
  for (const model of MODELS) {
    try {
      const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(60_000)]),
      });
      if (!res.ok) continue;
      const text = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return text;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return null;
}

// "Chụp menu giấy": Gemini reads a photo of a printed menu or price board into the menu tool's own text
// format, so the owner only checks it instead of typing every dish. Names and prices are copied as printed,
// nothing is added.
export const MENU_ASK = [
  "Đây là ảnh chụp menu hoặc bảng giá của một quán ăn. Chép lại TẤT CẢ món đọc được, đúng định dạng sau, không thêm gì khác:",
  "# Tên nhóm món (đúng như trên menu; menu không chia nhóm thì bỏ dòng này)",
  "Tên món - giá - mô tả",
  "Quy tắc: mỗi món một dòng. Tên món và giá chép y nguyên như in trên menu, giữ ngôn ngữ gốc. Mô tả chỉ ghi khi menu có in, nếu không thì bỏ phần mô tả (dòng chỉ còn: Tên món - giá).",
  "Món có nhiều cỡ hoặc nhiều giá thì ghi các giá cách nhau bằng dấu /, ví dụ: Phở bò - 50.000/65.000.",
  "Chữ nào mờ không đọc chắc chắn thì bỏ món đó, KHÔNG đoán. Không bịa món, giá hay mô tả. Không viết lời giải thích, không dùng ```.",
].join("\n");

/** Menu lines read from a photo ("# Nhóm", "Tên - giá - mô tả"); "" when a model answered but read no dish, null without a key or when no model answered. */
export async function readMenu({ data, mime }, { fetchFn = fetch, signal } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !Object.values(MIME).includes(mime)) return null;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: data.toString("base64") } }, { text: MENU_ASK }] }],
    generationConfig: { maxOutputTokens: 6000, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  });
  let answered = false;
  for (const model of MODELS) {
    try {
      const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(90_000)]),
      });
      if (!res.ok) continue;
      answered = true;
      const text = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const lines = cleanMenuText(text);
      if (lines) return lines;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return answered ? "" : null; // "" = read but no dish found; null = no model answered (busy or down)
}

/** The model's answer kept to menu lines only: no fences, no chatter, at most 150 dishes. */
export function cleanMenuText(text) {
  const out = [];
  let dishes = 0;
  for (const raw of String(text ?? "").replace(/```[a-z]*\n?/gi, "").split("\n")) {
    const line = raw.replace(/^\s*[-*•]\s+/, "").trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      out.push(`# ${line.replace(/^#+\s*/, "").slice(0, 60)}`);
      continue;
    }
    if (!/\s[-–|]\s/.test(line)) continue; // a dish line always has "name - price"
    if (++dishes > 150) break;
    out.push(line.slice(0, 300));
  }
  // A group heading with no dish under it is dropped.
  const kept = out.filter((l, i) => !l.startsWith("#") || (out[i + 1] && !out[i + 1].startsWith("#")));
  return dishes ? kept.join("\n") : "";
}
