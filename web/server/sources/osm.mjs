// Real map for the "Chỉ đường" video template. The user pastes the restaurant's Google Maps link: its exact
// pin (the "!3d…!4d…" part of a place link, or coordinates written in the link) is where the video's pin
// goes; a short maps.app.goo.gl link is followed to the full one. The map itself is OpenStreetMap tiles
// (usage policy: an identifying User-Agent, tiles cached on disk, "© OpenStreetMap contributors" shown).
// The "@lat,lng" of a link is only where the map view was centred, so it is never used.

import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const TILES = "https://tile.openstreetmap.org";
const TILE_DAYS = 7;
const userAgent = () => `SkipliContent/1.0${process.env.PUBLIC_URL ? ` (+${process.env.PUBLIC_URL})` : ""}`;

export class MapLinkError extends Error {}

// Google's own hosts only: google.com, google.com.vn, google.co.uk… (a look-alike such as
// maps.google.com.evil.io must not pass, the server follows these links).
const GOOGLE = /^(www\.|maps\.|consent\.)?google\.(com|[a-z]{2}|com?\.[a-z]{2})$/;
/** A link on one of Google's map hosts (full or short). */
function googleUrl(s) {
  let u;
  try {
    u = new URL(String(s ?? "").trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const ok = host === "maps.app.goo.gl" || (host === "goo.gl" && u.pathname.startsWith("/maps")) || (GOOGLE.test(host) && (host.startsWith("maps.") || host.startsWith("consent.") || u.pathname.startsWith("/maps")));
  return ok ? u : null;
}
/** A Google Maps link (full or short). */
export const isMapsLink = (s) => !!googleUrl(s) && !googleUrl(s).hostname.startsWith("consent.");

const valid = (lat, lon) => (Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon } : null);
/** The exact spot written in a link: a place's pin (!3d…!4d…) or coordinates (?q=lat,lng, /place/lat,lng, /search/lat,lng). */
export function coordsIn(link) {
  const s = decodeURIComponent(String(link ?? "")).replace(/\+/g, " ");
  const pin = [...s.matchAll(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/g)].at(-1); // the last one is the place itself
  if (pin) return valid(Number(pin[1]), Number(pin[2]));
  const typed = s.match(/(?:[?&](?:q|query|ll|destination)=|\/(?:place|search|dir)\/)\s*(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  return typed ? valid(Number(typed[1]), Number(typed[2])) : null;
}

/**
 * The restaurant's exact spot { lat, lon } from its Google Maps link; a MapLinkError (said for the user)
 * when the link has no exact spot.
 */
export async function placeFromLink(link, { fetchFn = fetch, signal } = {}) {
  link = String(link ?? "").trim();
  if (!isMapsLink(link)) throw new MapLinkError("Đây không phải link Google Maps. Mở quán trên Google Maps, bấm Chia sẻ rồi Sao chép đường liên kết.");
  const direct = coordsIn(link);
  if (direct) return direct;
  // A short link (or a link without the pin): follow it, the full address carries the pin. Not as a
  // browser: to a browser Google answers with a script page instead of the redirect. Each hop is checked
  // by hand and must stay on Google (never follow a redirect into another host, or our own network).
  // Google may stop at its consent page, whose address keeps the full link in "continue=".
  let url = link;
  for (let hop = 0; hop < 5; hop++) {
    const found = coordsIn(url);
    if (found) return found;
    const res = await fetchFn(url, { redirect: "manual", headers: { "User-Agent": userAgent(), "Accept-Language": "vi,en" }, signal }).catch(() => null);
    const next = res && res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!next) break;
    url = new URL(next, url).href;
    if (!googleUrl(url)) break;
  }
  throw new MapLinkError("Link này chưa có vị trí cụ thể (chỉ là một vùng bản đồ). Trên Google Maps, bấm vào quán hoặc đặt ghim đúng chỗ quán, rồi bấm Chia sẻ và Sao chép đường liên kết.");
}

/** fetch, tried again twice on a network error (some networks drop connections to OpenStreetMap now and then). */
async function patient(fetchFn, url, init) {
  for (let k = 0; ; k++) {
    try {
      return await fetchFn(url, init);
    } catch (e) {
      if (k >= 2 || init?.signal?.aborted) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
    }
  }
}

/** World pixel of a coordinate at zoom z (256 px tiles). */
export function worldPx({ lat, lon }, z) {
  const size = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * size, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size];
}

/**
 * The tiles covering a w × h frame with the spot at pixel `pin`, each one downloaded (or taken from the
 * cache): { z, scale, world: [x, y], pin, tiles: [{ file, tx, ty }] }.
 */
export async function mapTiles(spot, { w, h, pin, zoom = 17, cacheDir, fetchFn = fetch, signal }) {
  const scale = Math.min(1.6, Math.min(w, h) / 480); // street names readable on a phone
  const [wx, wy] = worldPx(spot, zoom);
  const x0 = Math.floor((wx - pin[0] / scale) / 256);
  const x1 = Math.floor((wx + (w - pin[0]) / scale) / 256);
  const y0 = Math.floor((wy - pin[1] / scale) / 256);
  const y1 = Math.floor((wy + (h - pin[1]) / scale) / 256);
  const n = 2 ** zoom;
  const list = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (ty >= 0 && ty < n) list.push({ tx, ty, file: path.join(cacheDir, String(zoom), String((tx + n) % n), `${ty}.png`) });
  const fresh = async (t) => existsSync(t.file) && Date.now() - (await stat(t.file)).mtimeMs < TILE_DAYS * 86_400_000;
  const missing = [];
  for (const t of list) if (!(await fresh(t))) missing.push(t);
  // Two downloads at a time (the most OSM's tile policy allows), not one after another.
  const next = async () => {
    for (let t = missing.shift(); t; t = missing.shift()) {
      const res = await patient(fetchFn, `${TILES}/${zoom}/${(t.tx + n) % n}/${t.ty}.png`, { headers: { "User-Agent": userAgent() }, signal });
      if (!res.ok) throw new Error(`OpenStreetMap tile ${res.status}`);
      await mkdir(path.dirname(t.file), { recursive: true });
      await writeFile(t.file, Buffer.from(await res.arrayBuffer()));
    }
  };
  await Promise.all([next(), next()]);
  return { z: zoom, scale, world: [wx, wy], pin, tiles: list };
}
