// Direct calls to an OpenAI-compatible API (Groq) when GROQ_API_KEY is set, for the in-app assistant. Going through GoClaw adds ~13k tokens of agent prompt and tool
// schemas per call, over Groq's free 8k tokens/minute; the assistant's own prompt is ~3k.

const MODELS = (process.env.ASSISTANT_MODELS ?? "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b").split(",");

export const directEnabled = () => !!process.env.GROQ_API_KEY;

/**
 * One chat completion. Each model has its own per-minute cap, so a rate-limited model hands over
 * to the next one; when all are capped, wait for the minute window to refill and try once more.
 * @returns the assistant message ({ content, tool_calls? })
 */
export async function complete(body, { signal, maxTokens = 1200, timeoutMs = 90_000, waitMs = 15_000 } = {}) {
  const key = process.env.GROQ_API_KEY;
  let lastError;
  for (const pass of [0, 1]) {
    for (const model of MODELS) {
      // Reasoning tokens count as output: keep thinking short so the answer fits.
      const reasoning = model.startsWith("openai/") ? { reasoning_effort: "low" } : model.startsWith("qwen/") ? { reasoning_effort: "none" } : {};
      const res = await fetch(`${process.env.ASSISTANT_API_BASE ?? "https://api.groq.com/openai/v1"}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.6, ...reasoning, ...body }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ...(data.choices?.[0]?.message ?? {}), usage: data.usage ?? null };
      lastError = new Error(`HTTP ${res.status}: ${data.error?.message ?? res.statusText}`);
      // 429 = per-minute cap, 413 = this model's single-request cap: both may pass on another model.
      if (res.status !== 429 && res.status !== 413) throw lastError;
    }
    if (!pass) await new Promise((r) => setTimeout(r, waitMs));
  }
  throw lastError;
}
