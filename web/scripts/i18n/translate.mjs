// Translate the extracted Vietnamese UI strings to English with Groq, in batches; resumable.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const env = Object.fromEntries(readFileSync(process.argv[2], "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const src = JSON.parse(readFileSync(process.argv[3], "utf8"));
const outFile = process.argv[4];
const done = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
const all = [...src.exact, ...src.patterns].filter((s) => !(s in done));
const MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
const SYSTEM = `You translate the user interface of "Skipli Content", a web app with AI tools for restaurants and small sellers (social media content, competitor research, reviews, videos), from Vietnamese to natural, concise US English UI copy.
Rules: return ONLY a JSON object mapping each Vietnamese input string (exactly as given, as the key) to its English translation.
Keep: brand and product names (Skipli Content, Facebook, Threads, TikTok, Instagram, Google Maps, Yelp, Groq, Gemini, Apify, Kaggle, GPU, Reels), emoji, numbers, punctuation style, leading/trailing spaces, line breaks, and every \${...} placeholder exactly as written (you may move it to fit English word order).
Placeholders in brackets: [GIÁ]→[PRICE], [ƯU ĐÃI]→[DEAL], [GIỜ]→[HOURS], [LINK]→[LINK], [SĐT]→[PHONE], [KHU VỰC]→[AREA].
Use "post" for bài/bài viết, "run" for lượt chạy, "reel" for reel, "dish" for món, "restaurant" for quán, "fanpage" stays "Facebook page". Do not translate Vietnamese dish names (phở, bánh mì) inside examples, but translate the sentence around them.`;
async function ask(batch) {
  for (let pass = 0; pass < 4; pass++) {
    for (const model of MODELS) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 6000, response_format: { type: "json_object" }, ...(model.startsWith("openai/") ? { reasoning_effort: "low" } : model.startsWith("qwen/") ? { reasoning_effort: "none" } : {}),
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(batch) }] }),
      });
      if (r.status === 429 || r.status === 413) continue;
      const d = await r.json();
      if (!r.ok) { console.error("HTTP", r.status, JSON.stringify(d).slice(0, 200)); continue; }
      try { return JSON.parse(d.choices[0].message.content); } catch { console.error("bad json from", model); }
    }
    await new Promise((res) => setTimeout(res, 20000));
  }
  throw new Error("gave up");
}
const SIZE = Number(process.env.SIZE) || 60;
for (let i = 0; i < all.length; i += SIZE) {
  const batch = all.slice(i, i + SIZE);
  const got = await ask(batch);
  let n = 0;
  for (const k of batch) if (typeof got[k] === "string" && got[k].trim()) { done[k] = got[k]; n++; }
  writeFileSync(outFile, JSON.stringify(done, null, 1));
  console.log(`${Math.min(i + SIZE, all.length)}/${all.length} (+${n})`);
}
console.log("missing:", [...src.exact, ...src.patterns].filter((s) => !(s in done)).length);
