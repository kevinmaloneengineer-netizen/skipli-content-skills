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
