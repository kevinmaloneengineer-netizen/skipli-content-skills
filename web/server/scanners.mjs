// Run a skill's own collection scripts on this server (Python, no login, no model tokens), so scan
// jobs can be reported by a direct model call instead of a GoClaw agent run.

import { spawn } from "node:child_process";
import path from "node:path";
import { SKILLS_DIR } from "./llm.mjs";

const PYTHON = process.env.PYTHON ?? "python3";

/**
 * Run skills/<skill>/scripts/<script> and parse the one JSON object it prints.
 * @returns the parsed object; throws with the script's own error message when it reports ok: false.
 */
export function runScript(skill, script, args, { signal, timeoutMs = 240_000, stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [path.join(SKILLS_DIR, skill, "scripts", script), ...args], { cwd: path.join(SKILLS_DIR, skill), signal, timeout: timeoutMs });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(e.name === "AbortError" ? e : new Error(`Không chạy được ${script}: ${e.message}`)));
    child.on("close", () => {
      // Whole stdout first (some scripts pretty-print), else the last line that looks like JSON (after log lines).
      let data;
      try {
        data = JSON.parse(out);
      } catch {
        data = null;
      }
      try {
        data ??= JSON.parse(out.trim().split("\n").reverse().find((l) => l.startsWith("{")) ?? "");
      } catch {
        return reject(new Error(`${script} không trả về kết quả${err ? `: ${err.trim().split("\n").at(-1)}` : ""}`));
      }
      if (data.ok === false) return reject(new Error(data.error || `${script} lỗi`));
      resolve(data);
    });
    if (stdin) child.stdin.end(stdin);
  });
}

const n = (v) => Number(v) || 0;
const fmt = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(v));

/** One reel as a compact line for the prompt (numbers already computed, caption trimmed). */
export const reelLine = (r, i, captionMax = 200) =>
  `${i + 1}. ${r.url}\n   👍 ${fmt(n(r.reactions))} · 💬 ${fmt(n(r.comments))} · 🔁 ${fmt(n(r.shares))} · ${r.plays_text ?? fmt(n(r.plays))} views · ${Math.round(n(r.duration))}s · ${r.created ?? ""}\n   caption: ${String(r.caption ?? "").replace(/\s+/g, " ").trim().slice(0, captionMax) || "(không có)"}`;

/** One Threads post as a compact line for the prompt. */
export const threadLine = (p, i) =>
  `${i + 1}. @${p.author} · ${p.url}\n   ❤️ ${fmt(n(p.likes))} · 💬 ${fmt(n(p.replies))} · 🔁 ${fmt(n(p.reposts) + n(p.quotes))} · ${p.created ?? ""}\n   text: ${String(p.text ?? "").replace(/\s+/g, " ").trim().slice(0, 260)}`;
