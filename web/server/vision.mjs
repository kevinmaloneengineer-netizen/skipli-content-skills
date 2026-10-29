// Looks at a photo for the "Đoán món từ ảnh" skill: a short list of what is visible (colours, bowl, herbs,
// toppings). It never names the dish, so the riddle is still the owner's to write. Gemini reads images for free;
// when it is busy, over quota or silent, a vision model on Groq (the key the posts are written with) answers instead.

import { readFile } from "node:fs/promises";
import path from "node:path";

const MODELS = (process.env.GEMINI_IMAGE_MODELS ?? "gemini-flash-latest,gemini-3.8-flash").split(",");
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";
const GROQ_MAX_BASE64 = 4_000_000; // Groq refuses base64 images over 4 MB
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
export const ASK = "Mô tả bằng tiếng Việt, tối đa 60 chữ, chỉ những gì nhìn thấy trong ảnh: màu sắc, loại đồ đựng, rau hoặc topping, độ đậm nhạt, bố cục. Không gọi tên món ăn, không đoán tên quán, không mô tả người.";

/** @returns {Promise<string|null>} null when there is no key or no model answers */
export async function describePhoto(file, { fetchFn = fetch, signal } = {}) {
  const key = process.env.GEMINI_API_KEY;
  const mime = MIME[path.extname(file).toLowerCase()];
  if ((!key && !process.env.GROQ_API_KEY) || !mime) return null;
  const data = (await readFile(file)).toString("base64");
  if (!key) return groqVision({ mime, data, ask: ASK, maxTokens: 800 }, { fetchFn, signal });
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data } }, { text: ASK }] }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } }, // a short description needs no thinking
  });
  for (const model of MODELS) {
    try {
      const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "x-goog-api-key": key }, // in a header: the newer "AQ." keys are refused as ?key=
        body,
        signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(25_000)]), // a short description comes back in seconds; a silent model hands over
      });
      if (!res.ok) continue;
      const text = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return text;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return groqVision({ mime, data, ask: ASK, maxTokens: 800 }, { fetchFn, signal });
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
  if ((!key && !process.env.GROQ_API_KEY) || !Object.values(MIME).includes(mime)) return null;
  const base64 = data.toString("base64");
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: MENU_ASK }] }],
    generationConfig: { maxOutputTokens: 6000, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  });
  let answered = false;
  for (const model of key ? MODELS : []) {
    try {
      const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "x-goog-api-key": key }, // in a header: the newer "AQ." keys are refused as ?key=
        body,
        signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(60_000)]),
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
  if (!answered) {
    const text = await groqVision({ mime, data: base64, ask: MENU_ASK, maxTokens: 6000 }, { fetchFn, signal });
    if (text !== null) return cleanMenuText(text);
  }
  return answered ? "" : null; // "" = read but no dish found; null = no model answered (busy or down)
}

/** The same question to the vision model on Groq; null without a key, for a photo over Groq's size cap, or when it fails. */
async function groqVision({ mime, data, ask, maxTokens }, { fetchFn, signal }) {
  const key = process.env.GROQ_API_KEY;
  if (!key || data.length > GROQ_MAX_BASE64) return null;
  try {
    const res = await fetchFn(`${process.env.ASSISTANT_API_BASE ?? "https://api.groq.com/openai/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        max_tokens: maxTokens,
        temperature: 0.2,
        reasoning_effort: "none",
        messages: [{ role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: `data:${mime};base64,${data}` } }] }],
      }),
      signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(60_000)]),
    });
    if (!res.ok) return null;
    const text = String((await res.json()).choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return text || null;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
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
