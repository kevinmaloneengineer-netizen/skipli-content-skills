// Error log: server crashes (500s), failed jobs, unhandled rejections and browser errors go to the store
// (the admin reads them under "Lỗi gần đây") and, with ERROR_WEBHOOK_URL, to a Slack or Discord channel.
// Capped so a loop of the same error cannot flood the database or the channel.

const HOUR = 3600_000;

/**
 * @param {{ store, env?: object, fetchFn?: typeof fetch, log?: Console }} opts
 * @returns {{ record(e: { source: string, message: string, stack?: string, path?: string, jobId?: string, type?: string, userId?: string }): Promise<void> }}
 */
export function createErrorLog({ store, env = process.env, fetchFn = fetch, log = console }) {
  const webhook = env.ERROR_WEBHOOK_URL ?? "";
  const perHour = Number(env.ERROR_LOG_PER_HOUR) || 120;
  const written = []; // timestamps of the records this hour
  const alerted = new Map(); // message → last alert time

  async function alert(e) {
    if (!webhook) return;
    const key = `${e.source}:${e.message}`;
    if (Date.now() - (alerted.get(key) ?? 0) < 10 * 60_000) return; // the same error alerts once per 10 minutes
    alerted.set(key, Date.now());
    const text = `⚠️ Skipli Content · ${e.source}${e.type ? ` · ${e.type}` : ""}: ${e.message}${e.path ? `\n${e.path}` : ""}`;
    // Slack reads "text", Discord reads "content".
    await fetchFn(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text.slice(0, 1900) }) }).catch((err) => log.error(`error alert failed: ${err.message}`));
  }

  return {
    async record(raw) {
      const now = Date.now();
      while (written.length && now - written[0] > HOUR) written.shift();
      if (written.length >= perHour) return;
      written.push(now);
      const e = {
        source: String(raw.source ?? "server").slice(0, 20),
        message: String(raw.message ?? "Lỗi không rõ").slice(0, 500),
        ...(raw.stack ? { stack: String(raw.stack).slice(0, 4000) } : {}),
        ...(raw.path ? { path: String(raw.path).slice(0, 300) } : {}),
        ...(raw.jobId ? { jobId: String(raw.jobId) } : {}),
        ...(raw.type ? { type: String(raw.type).slice(0, 40) } : {}),
        ...(raw.userId ? { userId: String(raw.userId) } : {}),
      };
      try {
        await store.addError(e);
      } catch (err) {
        log.error(`error log: could not save: ${err.message}`);
      }
      await alert(e);
    },
  };
}
