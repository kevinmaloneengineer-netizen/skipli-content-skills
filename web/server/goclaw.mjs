import http from "node:http";
import https from "node:https";
import { mockReply } from "./mock.mjs";

/**
 * Minimal GoClaw client.
 *
 * Uses node:http rather than fetch: an agent run (e.g. a full channel scan)
 * takes several minutes before GoClaw sends response headers, and fetch
 * (undici) aborts after its 300 s headersTimeout.
 */
export function createGoclawClient({ url, token, userId, mock, mockDelayMs }) {
  const base = new URL(url);
  const transport = base.protocol === "https:" ? https : http;

  function request(method, pathname, { body, timeoutMs = 10_000, signal } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
      const req = transport.request(
        new URL(pathname, base),
        {
          method,
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
            "X-GoClaw-User-Id": userId,
            Accept: "application/json",
            ...(payload && { "Content-Type": "application/json", "Content-Length": payload.length }),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let json;
            try {
              json = text ? JSON.parse(text) : undefined;
            } catch {
              json = undefined;
            }
            resolve({ status: res.statusCode ?? 0, text, json });
          });
          res.on("error", reject);
        },
      );
      // Idle-socket timeout: GoClaw sends nothing until the run finishes.
      req.setTimeout(timeoutMs, () => req.destroy(new Error(`GoClaw did not answer within ${Math.round(timeoutMs / 60000)} min`)));
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    mock,

    async health() {
      if (mock) return { ok: true, mock: true };
      try {
        const res = await request("GET", "/health", { timeoutMs: 3000 });
        return { ok: res.status >= 200 && res.status < 300, status: res.status };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    /** Multi-turn chat (the web assistant): system + history in, one answer out. */
    async chat({ agent, messages, timeoutMs = 120_000, signal }) {
      if (mock) return mockReply({ kind: "chat", prompt: messages.at(-1)?.content ?? "", delayMs: Math.min(mockDelayMs, 800), signal });
      const res = await request("POST", "/v1/chat/completions", { body: { model: `goclaw:${agent}`, messages, stream: false }, timeoutMs, signal });
      if (res.status !== 200) {
        const msg = res.json?.error?.message ?? res.json?.error ?? res.text.slice(0, 500);
        throw new Error(`GoClaw ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
      }
      const content = res.json?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("GoClaw returned an empty answer");
      return { content, usage: res.json.usage ?? null };
    },

    /**
     * Run one agent turn in a fresh GoClaw session (each call gets its own
     * session key server-side, so earlier results never leak into a new run).
     */
    async run({ agent, prompt, kind, timeoutMs, signal }) {
      if (mock) return mockReply({ kind, prompt, delayMs: mockDelayMs, signal });
      const res = await request("POST", "/v1/chat/completions", {
        body: { model: `goclaw:${agent}`, messages: [{ role: "user", content: prompt }], stream: false },
        timeoutMs,
        signal,
      });
      if (res.status !== 200) {
        const msg = res.json?.error?.message ?? res.json?.error ?? res.text.slice(0, 500);
        throw new Error(`GoClaw ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
      }
      const content = res.json?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("GoClaw returned an empty answer");
      return { content, usage: res.json.usage ?? null };
    },
  };
}
