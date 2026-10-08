// Google Maps reviews through the headless Chrome sidecar (CDP on :9222, no login):
// search the place, open the first result, switch to the reviews tab and scroll the list.

import { setTimeout as sleep } from "node:timers/promises";

const CDP = process.env.CHROME_CDP_URL ?? "http://127.0.0.1:9222";

/**
 * Chrome's DevTools endpoint only answers when the Host header is an IP or "localhost", so a Docker
 * service name (http://chrome:9222) is resolved to its IP first.
 */
async function cdpBase() {
  const u = new URL(CDP);
  if (u.hostname !== "localhost" && !/^[\d.]+$|^\[/.test(u.hostname)) {
    const { lookup } = await import("node:dns/promises");
    u.hostname = (await lookup(u.hostname)).address;
  }
  return u.origin;
}

async function openTab() {
  const target = await (await fetch(`${await cdpBase()}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("Không mở được trình duyệt")), { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const close = async () => {
    try {
      ws.close();
    } finally {
      await fetch(`${await cdpBase()}/json/close/${target.id}`).catch(() => {});
    }
  };
  return { send, js, close };
}

const withVi = (u) => (/[?&]hl=/.test(u) ? u.replace(/([?&]hl=)[^&]*/, "$1vi") : u + (u.includes("?") ? "&" : "?") + "hl=vi");

/** Poll a page condition; true once it holds, false after the timeout. */
async function waitFor(tab, expression, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await tab.js(`!!(${expression})`)) return true;
    await sleep(500);
  }
  return false;
}

const isMapsUrl = (s) => /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(s);

/**
 * @param {string} place  a Google Maps link or a place name with area ("Lẩu bò Ba Toa Quận 3")
 * @returns {{ name, rating, total, address, url, reviews: { stars, when, text }[] }}
 */
export async function fetchReviews(place, { max = 80, signal, onProgress } = {}) {
  const tab = await openTab();
  const abort = () => tab.close();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const url = isMapsUrl(place) ? place : `https://www.google.com/maps/search/${encodeURIComponent(place)}`;
    await tab.send("Page.enable");
    await tab.send("Page.navigate", { url: withVi(url) });
    // A search lists several places (open the first one); a place link (also after a short-link redirect) opens it directly.
    await waitFor(tab, "document.querySelector('a.hfpxzc') || document.querySelector('button[role=tab]')", 15_000);
    const first = await tab.js("document.querySelector('a.hfpxzc')?.href");
    if (first) await tab.send("Page.navigate", { url: withVi(first) });
    else if (!/[?&]hl=vi\b/.test(await tab.js("location.href"))) {
      // maps.app.goo.gl drops hl=vi on redirect: reload in Vietnamese so reviews are not machine-translated to English.
      await tab.send("Page.navigate", { url: withVi(await tab.js("location.href")) });
    }
    await waitFor(tab, "document.querySelector('button[role=tab]')", 15_000);
    const name = await tab.js("document.querySelector('h1')?.innerText?.trim()");
    if (!name || name === "Kết quả" || name === "Results") throw new Error("Không tìm thấy quán trên Google Maps, hãy dán link Google Maps của quán.");
    const head = await tab.js("document.querySelector('div.F7nice')?.innerText ?? ''");
    // The address button starts with an icon-font glyph (private use area) on its own line.
    const address = String(await tab.js("document.querySelector('button[data-item-id=address]')?.innerText ?? ''")).replace(/[\ue000-\uf8ff]/g, "").trim();
    const href = await tab.js("location.href");
    onProgress?.(`Đã mở ${name}, đang đọc bài đánh giá…`);
    await tab.js("[...document.querySelectorAll('button[role=tab]')].find(b => /Bài đánh giá|Đánh giá|Reviews/i.test(b.innerText + ' ' + b.getAttribute('aria-label')))?.click()");
    // The review list loads a few seconds after the tab switch.
    if (!(await waitFor(tab, "document.querySelector('div.jftiEf')", 15_000))) throw new Error(`Google Maps không hiện bài đánh giá nào của ${name}.`);
    // Star histogram for all reviews ("5 sao, 176 bài đánh giá" / "5 stars, 176 reviews").
    const histogram = await tab.js("[...document.querySelectorAll('tr[role=img][aria-label], .BHOKXe[aria-label]')].map(e => e.getAttribute('aria-label'))");
    // Scroll the review list: bring the last review into view (works whichever panel scrolls) and also push
    // the scrollable panel down. Stop after 4 rounds in a row without new reviews (slow loads happen).
    let count = 0;
    let idle = 0;
    for (let k = 0; k < 40 && count < max && idle < 4; k++) {
      await tab.js(`(() => {
        const items = document.querySelectorAll('div.jftiEf');
        items[items.length - 1]?.scrollIntoView({ block: 'end' });
        const f = [...document.querySelectorAll('div.m6QErb')].find(d => d.scrollHeight > d.clientHeight + 50 && d.querySelector('div.jftiEf'));
        if (f) f.scrollTop = f.scrollHeight;
      })()`);
      await sleep(1500);
      const now = await tab.js("document.querySelectorAll('div.jftiEf').length");
      idle = now === count ? idle + 1 : 0;
      count = now;
    }
    await tab.js("document.querySelectorAll('button.w8nwRe').forEach(b => b.click())"); // "Thêm" expands long reviews
    await sleep(500);
    const reviews = await tab.js(`[...document.querySelectorAll('div.jftiEf')].slice(0, ${max}).map(r => ({
      stars: parseInt(r.querySelector('span.kvMYJc')?.getAttribute('aria-label') ?? '') || null,
      when: r.querySelector('span.rsqaWe')?.innerText ?? '',
      text: (r.querySelector('span.wiI7pd')?.innerText ?? '').replace(/\\s+/g, ' ').trim(),
    }))`);
    const starCounts = {};
    for (const label of histogram ?? []) {
      const m = label.match(/^(\d)\D+([\d.,]+)/);
      if (m) starCounts[m[1]] = Number(m[2].replace(/[.,]/g, ""));
    }
    const [, rating, total] = head.match(/([\d.,]+)\s*\(([\d.,]+)\)/) ?? [];
    return { name, rating: rating ?? "", total: total ?? "", address, url: href, starCounts, reviews: reviews ?? [] };
  } finally {
    signal?.removeEventListener("abort", abort);
    await tab.close();
  }
}
