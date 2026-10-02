// How a backend calls a GoClaw agent (OpenAI-compatible endpoint).
// Run: GOCLAW_GATEWAY_TOKEN=... npx tsx examples/call-agent.ts "https://www.facebook.com/tony.g.jung/reels/" "SEO"
//
// The full client with a job queue is web/server/goclaw.mjs. Two things matter:
// - Use node:http, not fetch. GoClaw sends no headers until the run finishes
//   (minutes for a channel scan), and fetch/undici gives up after 300 s.
// - Send only the new message. Every call is a fresh GoClaw session, so the
//   agent cannot answer from stale results of an earlier scan.
import http from "node:http";

const GOCLAW_URL = process.env.GOCLAW_URL ?? "http://localhost:18790";
const TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;
const AGENT_KEY = process.env.GOCLAW_AGENT_KEY ?? "content-scout";

export function runAgent(prompt: string, userId: string, timeoutMs = 20 * 60_000): Promise<string> {
  if (!TOKEN) throw new Error("GOCLAW_GATEWAY_TOKEN is not set");
  const body = JSON.stringify({ model: `goclaw:${AGENT_KEY}`, messages: [{ role: "user", content: prompt }] });
  return new Promise((resolve, reject) => {
    const req = http.request(new URL("/v1/chat/completions", GOCLAW_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${TOKEN}`,
        // Required. Browser cookies are scoped per (agent UUID, user), so this
        // must be the user whose Facebook cookies were synced.
        "X-GoClaw-User-Id": userId,
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`GoClaw ${res.statusCode}: ${text.slice(0, 500)}`));
        resolve(JSON.parse(text).choices[0].message.content);
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("GoClaw timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

if (process.argv[1]?.endsWith("call-agent.ts")) {
  const [channelUrl, topic] = process.argv.slice(2);
  if (!channelUrl) {
    console.error("usage: call-agent.ts <channel_reels_url> [topic]");
    process.exit(1);
  }
  const prompt = `Quét kênh Facebook ${channelUrl} và chọn 5 reel tốt nhất${topic ? ` về chủ đề "${topic}"` : ""}. Trả lời bằng tiếng Việt.`;
  runAgent(prompt, process.env.GOCLAW_USER_ID ?? "system").then(console.log, (e) => {
    console.error(e);
    process.exit(1);
  });
}
