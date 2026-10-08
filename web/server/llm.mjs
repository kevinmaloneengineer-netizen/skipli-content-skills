// Direct calls to an OpenAI-compatible API (Groq) when GROQ_API_KEY is set: the in-app assistant
// and the jobs that need no tools. Going through GoClaw adds ~13k tokens of agent prompt and tool
// schemas per call, over Groq's free 8k tokens/minute; a skill's SKILL.md alone is ~1k.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { WEB_ROOT } from "./config.mjs";

const MODELS = (process.env.ASSISTANT_MODELS ?? "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b").split(",");
const TPM = Number(process.env.LLM_TOKENS_PER_MINUTE) || 8000;
export const SKILLS_DIR = process.env.SKILLS_DIR ?? path.resolve(WEB_ROOT, "../skills");

export const directEnabled = () => !!process.env.GROQ_API_KEY;

/** Rough token count for Vietnamese text (it tokenizes at ~2.5 characters per token). */
export const estimateTokens = (text) => Math.ceil(text.length / 2.5);

/**
 * One chat completion. Each model has its own per-minute cap, so a rate-limited model hands over
 * to the next one; when all are capped, wait for the minute window to refill and try once more.
 * @returns the assistant message ({ content, tool_calls? })
 */
export async function complete(body, { signal, maxTokens = 1200, timeoutMs = 90_000, waitMs = 15_000 } = {}) {
  const key = process.env.GROQ_API_KEY;
  let lastError;
  let tries = 0;
  for (const pass of [0, 1]) {
    for (const model of MODELS) {
      tries++;
      // Reasoning tokens count as output: keep thinking short so the answer fits.
      const reasoning = model.startsWith("openai/") ? { reasoning_effort: "low" } : model.startsWith("qwen/") ? { reasoning_effort: "none" } : {};
      const res = await fetch(`${process.env.ASSISTANT_API_BASE ?? "https://api.groq.com/openai/v1"}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.6, ...reasoning, ...body }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ...(data.choices?.[0]?.message ?? {}), usage: data.usage ?? null, meta: { model, tries, waited: pass > 0 } };
      lastError = new Error(`HTTP ${res.status}: ${data.error?.message ?? res.statusText}`);
      // 429 = per-minute cap, 413 = this model's single-request cap: both may pass on another model.
      if (res.status !== 429 && res.status !== 413) throw lastError;
    }
    if (!pass) await new Promise((r) => setTimeout(r, waitMs));
  }
  throw lastError;
}

const skillCache = new Map();

/**
 * SKILL.md without its frontmatter: the same method the GoClaw agent would follow.
 * `from` (a heading regex) keeps only the part from that heading on, e.g. a scan skill's report
 * steps when the server already ran its collection scripts.
 */
export async function skillInstructions(name, from) {
  const key = `${name}|${from ?? ""}`;
  if (!skillCache.has(key)) {
    let text = (await readFile(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8")).replace(/^---[\s\S]*?\n---\s*/, "").trim();
    if (from) {
      const m = text.match(new RegExp(`^#{2,3} .*${from.source}.*$`, "mi"));
      if (m) text = text.slice(m.index);
    }
    skillCache.set(key, text);
  }
  return skillCache.get(key);
}

/** The UI avoids dashes joining ideas: ranges ("Thứ 2 – Thứ 6", "16h–23h") become "đến", other dashes ": ". */
export const fixDashes = (t) =>
  t
    .replace(/(\d+[hg]?|\d{1,2}:\d{2}|thứ \w+|chủ nhật)[ \t]*[–—][ \t]*(?=\d|thứ|chủ nhật)/gi, "$1 đến ")
    .replace(/(\b\d{1,2}[hg]|\b\d{1,2}:\d{2})[ \t]*[‑-][ \t]*(?=\d{1,2}(?:[hg:]|\b))/gi, "$1 đến ") // "16h‑23h", "10:30-11:30"; dates like 2026‑07‑05 stay
    .replace(/[ \t]+[–—][ \t]+/g, ": ");

/** Run a no-tools skill: SKILL.md as the system prompt, the job prompt as the user turn. */
export async function runSkill({ skill, from, prompt, signal }) {
  const system = `${await skillInstructions(skill, from)}\n\nYou cannot run tools or scripts here: the data is already collected and given in the request. Answer directly in the output format above.`;
  const room = TPM - estimateTokens(system + prompt) - 200;
  if (room < 1200) throw new Error("Nội dung gửi cho AI quá dài, hãy rút gọn bớt thông tin.");
  const msg = await complete({ messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }, { signal, maxTokens: Math.min(6000, room) });
  // Same rule as the UI copy: no dashes joining ideas ("Món A – mô tả" becomes "Món A: mô tả").
  const content = fixDashes(msg.content ?? "").trim();
  if (!content) throw new Error("AI không trả về nội dung, hãy chạy lại.");
  return { content: tidyMarkdown(content), usage: msg.usage, meta: msg.meta };
}

/**
 * Small models copy template placeholders and skip blank lines, which glues a list onto the line
 * above in Markdown: drop "<link>" style tags, start every list with a blank line, "*" bullets → "-".
 */
export function tidyMarkdown(md) {
  const lines = md
    .replace(/<(?:link|url)>\s*/gi, "")
    .split("\n")
    // "Nội dung chính: • a • b" on one line → a nested list (only lines where a colon opens the bullets)
    .flatMap((l) => (/:\s*•/.test(l) ? l.replace(/\s*•\s*/g, "\n  - ").split("\n") : [l]));
  const out = [];
  const isItem = (l) => /^\s*(?:[-*+]|\d+\.)\s/.test(l);
  for (const raw of lines) {
    const line = raw.replace(/^(\s*)[*•]\s/, (m, sp) => `${sp}- `);
    const prev = out.at(-1) ?? "";
    if (isItem(line) && prev.trim() && !isItem(prev) && !/^\s*\|/.test(prev)) out.push("");
    out.push(line);
  }
  return out.join("\n");
}
