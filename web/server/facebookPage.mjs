// Publish a scheduled post to the user's Facebook Page through the Graph API.
// Needs FB_PAGE_ID and a Page access token (FB_PAGE_TOKEN, with pages_manage_posts) in deploy/.env.
// A post more than 10 minutes ahead is handed to Facebook's own scheduler; otherwise it goes out now.

const GRAPH = `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION ?? "v21.0"}`;
const MIN_AHEAD = 11 * 60_000; // Facebook accepts 10 minutes to 30 days ahead
const MAX_AHEAD = 29 * 86_400_000;

export const pageConfigured = () => !!(process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN);

/** @returns {{ id: string, scheduled: boolean, at: string | null }} */
export async function publishToPage({ message, at }) {
  if (!pageConfigured()) throw new Error("Chưa kết nối Facebook Page (thiếu FB_PAGE_ID, FB_PAGE_TOKEN).");
  const text = String(message ?? "").trim();
  if (!text) throw new Error("Bài viết đang trống.");
  const ahead = Date.parse(at) - Date.now();
  const schedule = ahead > MIN_AHEAD && ahead < MAX_AHEAD;
  const body = new URLSearchParams({ message: text, access_token: process.env.FB_PAGE_TOKEN });
  if (schedule) {
    body.set("published", "false");
    body.set("scheduled_publish_time", String(Math.floor(Date.parse(at) / 1000)));
  }
  const res = await fetch(`${GRAPH}/${process.env.FB_PAGE_ID}/feed`, { method: "POST", body, signal: AbortSignal.timeout(30_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(`Facebook từ chối: ${data.error?.message ?? res.statusText}`);
  return { id: data.id, scheduled: schedule, at: schedule ? new Date(Date.parse(at)).toISOString() : null };
}
