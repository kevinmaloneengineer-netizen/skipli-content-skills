// Each customer connects their own Facebook Pages (Facebook Login with pages_show_list,
// pages_read_engagement, pages_manage_posts) and posts a result straight to one of them.
// The app (FB_APP_ID, FB_APP_SECRET) is made once on Meta for Developers; while it is in Development mode
// only people with a role in the app can connect.
//
// Page tokens never reach the browser: they are kept on the account encrypted (AES-256-GCM, key derived
// from the app secret, so changing SESSION_SECRET does not void them; a new app secret means connecting again).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"];
const MIN_AHEAD = 11 * 60_000; // Facebook schedules 10 minutes to 30 days ahead
const MAX_AHEAD = 29 * 86_400_000;

export class FacebookError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** What Graph API errors mean for the person posting. */
function explain(err, fallback) {
  const code = err?.code;
  if (code === 190 || code === 102) return new FacebookError("Kết nối Facebook đã hết hạn hoặc bị thu hồi. Vào Tài khoản, ngắt kết nối rồi kết nối lại Facebook.", 401);
  if (code === 10 || code === 200 || (code >= 200 && code < 300)) return new FacebookError("Facebook chưa cho phép đăng lên Trang này. Kết nối lại và bấm cho phép quyền đăng bài (pages_manage_posts), hoặc kiểm tra bạn còn là quản trị viên Trang.", 403);
  if (code === 368) return new FacebookError("Facebook đang tạm chặn đăng bài từ Trang này vì nghi spam. Thử lại sau.", 429);
  if (code === 4 || code === 17 || code === 32 || code === 613) return new FacebookError("Đăng quá nhiều trong thời gian ngắn, Facebook tạm giới hạn. Thử lại sau ít phút.", 429);
  return new FacebookError(`Facebook từ chối: ${err?.message ?? fallback}`, 502);
}

export function createFacebookConnect({ store, env = process.env, fetchFn = fetch }) {
  const appId = env.FB_APP_ID ?? "";
  const appSecret = env.FB_APP_SECRET ?? "";
  const version = env.FB_GRAPH_VERSION || "v23.0";
  const graph = `https://graph.facebook.com/${version}`;
  const enabled = !!(appId && appSecret);
  const key = createHash("sha256").update(`skipli-fb-token:${appSecret}`).digest();

  const seal = (text) => {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
    return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
  };
  const open = (sealed) => {
    try {
      const [iv, tag, ct] = String(sealed).split(".").map((s) => Buffer.from(s, "base64url"));
      const d = createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    } catch {
      throw new FacebookError("Không đọc được kết nối Facebook đã lưu (khoá ứng dụng đã đổi). Ngắt kết nối rồi kết nối lại Facebook.", 401);
    }
  };

  async function call(path, params, { method = "GET", body } = {}) {
    const url = new URL(`${graph}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    const res = await fetchFn(url, { method, body, signal: AbortSignal.timeout(60_000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw explain(data.error, res.statusText);
    return data;
  }

  // Login states: the random value Facebook hands back, tied to the account that started, 10 minutes.
  const states = new Map();

  return {
    enabled,
    /** Where the "Kết nối Facebook" button sends the browser. */
    loginUrl(user, redirectUri) {
      if (!enabled) throw new FacebookError("Web chưa cấu hình ứng dụng Facebook (FB_APP_ID, FB_APP_SECRET).", 503);
      for (const [k, v] of states) if (v.exp < Date.now()) states.delete(k);
      const state = randomBytes(18).toString("base64url");
      states.set(state, { userId: user.id, exp: Date.now() + 10 * 60_000 });
      const u = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
      u.search = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, scope: SCOPES.join(","), response_type: "code" }).toString();
      return u.toString();
    },

    /** Facebook came back: the code becomes a long-lived token, and the Pages this person manages are kept. */
    async finish(user, { code, state, redirectUri }) {
      const s = states.get(String(state ?? ""));
      states.delete(String(state ?? ""));
      if (!s || s.userId !== user.id || s.exp < Date.now()) throw new FacebookError("Phiên kết nối Facebook đã hết hạn, bấm Kết nối lại nhé.");
      if (!code) throw new FacebookError("Bạn chưa cho phép ứng dụng truy cập Facebook.");
      const short = await call("oauth/access_token", { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
      // A long-lived user token: the Page tokens read with it do not expire.
      const long = await call("oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token });
      const list = await call("me/accounts", { access_token: long.access_token, fields: "id,name,access_token,tasks,picture{url}", limit: "100" });
      const pages = (list.data ?? [])
        .filter((p) => p.access_token && (!p.tasks || p.tasks.includes("CREATE_CONTENT") || p.tasks.includes("MANAGE")))
        .map((p) => ({ id: String(p.id), name: String(p.name ?? "").slice(0, 120), picture: p.picture?.data?.url ?? null, token: seal(p.access_token), connectedAt: new Date().toISOString() }));
      if (!pages.length) throw new FacebookError("Không tìm thấy Fanpage nào bạn có quyền đăng bài. Khi Facebook hỏi, hãy chọn ít nhất một Trang.");
      await store.updateUser(user.id, { fbPages: pages });
      return pages.map(({ token, ...p }) => p);
    },

    async disconnect(user, pageId) {
      const left = (user.fbPages ?? []).filter((p) => p.id !== String(pageId));
      await store.updateUser(user.id, { fbPages: left });
      return left.length;
    },

    /**
     * Post to one of the account's Pages: text, or a photo with the text as its caption. More than
     * 10 minutes ahead (up to 29 days) Facebook schedules it.
     * @param {{ pageId: string, message: string, image?: { data: Buffer, mime: string } | null, at?: string }} p
     * @returns {{ id: string, url: string, scheduled: boolean, pageName: string }}
     */
    async post(user, { pageId, message, image = null, at }) {
      const page = (user.fbPages ?? []).find((p) => p.id === String(pageId ?? ""));
      if (!page) throw new FacebookError("Chọn một Fanpage đã kết nối.", 404);
      const text = String(message ?? "").trim().slice(0, 60_000);
      if (!text && !image) throw new FacebookError("Bài viết đang trống.");
      const token = open(page.token);
      const ahead = at ? Date.parse(at) - Date.now() : 0;
      const schedule = ahead > MIN_AHEAD && ahead < MAX_AHEAD;
      const when = schedule ? { published: "false", scheduled_publish_time: String(Math.floor(Date.parse(at) / 1000)) } : {};
      let id;
      if (image) {
        const form = new FormData();
        for (const [k, v] of Object.entries({ caption: text, access_token: token, ...when })) form.append(k, v);
        form.append("source", new Blob([image.data], { type: image.mime }), `photo.${image.mime.split("/")[1] ?? "jpg"}`);
        const out = await call(`${page.id}/photos`, {}, { method: "POST", body: form });
        id = out.post_id ?? out.id;
      } else {
        const out = await call(`${page.id}/feed`, {}, { method: "POST", body: new URLSearchParams({ message: text, access_token: token, ...when }) });
        id = out.id;
      }
      return { id, url: `https://www.facebook.com/${id}`, scheduled: schedule, pageName: page.name };
    },
  };
}

/** What the browser may see of the connected Pages. */
export const publicPages = (user) => (user?.fbPages ?? []).map(({ id, name, picture, connectedAt }) => ({ id, name, picture, connectedAt }));
