// "Ghép ảnh kiểu Canva" slideshow: a search-box intro, then scenes that lay 1 to 3 photos out with white
// gutters (tiles slide in one after the other, the brand band fades in), joined by slide / wipe
// transitions, ending on the address card. Everything is ffmpeg + the PNGs from overlay/make_title.py.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { mapTiles } from "./sources/osm.mjs";

const run = promisify(execFile);
const TITLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "overlay", "make_title.py");
const SIZES = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [1080, 1080] };
const FPS = 30;
const FADE = 0.5; // transition length
const GAP = 10; // white gutter between tiles

// Layouts in portrait fractions [x, y, w, h]; landscape swaps the axes. "band" = the logo + name strip.
const LAYOUTS = {
  hero: [[0, 0, 0.5, 0.4], [0.5, 0, 0.5, 0.4], "band:0.4:0.15", [0, 0.55, 1, 0.45]], // 2 on top, band, 1 below
  split: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]], // 2 stacked
  trio: [[0, 0, 1, 0.58], [0, 0.58, 0.5, 0.42], [0.5, 0.58, 0.5, 0.42]], // 1 big, 2 small
};
// Canva-like transitions that exist in every ffmpeg since 4.4 (the Docker image may be older than ours).
const TRANSITIONS = ["slideup", "slideleft", "circleopen", "wipeleft", "smoothup", "hlslice", "radial", "slideright"];

/**
 * Which photo goes where: by role (ext / int / table / medium / close / side; real photos are "food").
 * Each photo is used once per round; when every photo has been shown, a new round starts.
 */
function picker(slides) {
  const used = new Set();
  const food = ["close", "medium", "side", "table", "food", "dish1", "dish2", "dish3", "dish4"];
  const pick = (role) => {
    for (const r of [role, ...food, "int", "ext"]) {
      const s = slides.find((x) => x.role === r && !used.has(x));
      if (s) return s;
    }
    return null;
  };
  return (role) => {
    let s = pick(role);
    if (!s) {
      used.clear(); // all shown: start again, still by role
      s = pick(role) ?? slides[0];
    }
    used.add(s);
    return s;
  };
}

/** Pixel rect of a fraction rect, with gutters only between tiles (not on the frame edge). */
function rect([fx, fy, fw, fh], w, h, landscape) {
  if (landscape) [fx, fy, fw, fh] = [fy, fx, fh, fw];
  const x0 = Math.round(fx * w) + (fx > 0 ? GAP / 2 : 0);
  const y0 = Math.round(fy * h) + (fy > 0 ? GAP / 2 : 0);
  const x1 = Math.round((fx + fw) * w) - (fx + fw < 1 ? GAP / 2 : 0);
  const y1 = Math.round((fy + fh) * h) - (fy + fh < 1 ? GAP / 2 : 0);
  return { x: x0, y: y0, w: (x1 - x0) & ~1, h: (y1 - y0) & ~1 };
}

const ffmpeg = (args) => run("ffmpeg", ["-y", "-loglevel", "error", ...args], { maxBuffer: 1 << 24 });
const encode = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS)];

/** One collage scene: tiles slide in from the nearest edge, staggered; the band fades in. */
async function layoutScene({ layout, photos, band, w, h, seconds, out }) {
  const landscape = w > h;
  const inputs = [];
  const parts = [`color=c=white:s=${w}x${h}:d=${seconds}:r=${FPS}[c0]`];
  let last = "c0";
  let k = 0;
  for (const cell of LAYOUTS[layout]) {
    if (typeof cell === "string") {
      if (!band) continue;
      const [, fy, fh] = cell.split(":").map(Number);
      const r = rect([0, fy, 1, fh], w, h, landscape);
      inputs.push("-loop", "1", "-t", String(seconds), "-i", band);
      const i = inputs.filter((x) => x === "-i").length - 1;
      parts.push(`[${i}:v]scale=${r.w}:${r.h},format=rgba,fade=in:st=0.45:d=0.5:alpha=1[b${i}]`, `[${last}][b${i}]overlay=${r.x}:${r.y}:shortest=1[o${i}]`);
      last = `o${i}`;
      continue;
    }
    const r = rect(cell, w, h, landscape);
    const photo = photos[k];
    inputs.push("-loop", "1", "-t", String(seconds), "-i", photo);
    const i = inputs.filter((x) => x === "-i").length - 1;
    // Slide in from the closest edge, ease-out, 0.18 s after the previous tile.
    const cx = r.x + r.w / 2 - w / 2;
    const cy = r.y + r.h / 2 - h / 2;
    const [sx, sy] = Math.abs(cx) / w > Math.abs(cy) / h ? [cx < 0 ? -(r.x + r.w) : w - r.x, 0] : [0, cy < 0 ? -(r.y + r.h) : h - r.y];
    const ease = `pow(1-min(max((t-${(0.18 * k).toFixed(2)})/0.7,0),1),3)`;
    // Still photos: only the tile moves (slides in), the picture inside never zooms.
    parts.push(`[${i}:v]scale=${r.w}:${r.h}:force_original_aspect_ratio=increase,crop=${r.w}:${r.h},setsar=1[t${i}]`);
    parts.push(`[${last}][t${i}]overlay=x='${r.x}+(${sx})*${ease}':y='${r.y}+(${sy})*${ease}':shortest=1[o${i}]`);
    last = `o${i}`;
    k++;
  }
  await ffmpeg([...inputs, "-filter_complex", parts.join(";"), "-map", `[${last}]`, "-t", String(seconds), ...encode, out]);
}

/** Full-frame photo with a gentle zoom, optionally the title card (name, city) fading in on top. */
async function fullScene({ photo, card, w, h, seconds, out }) {
  const parts = [`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[bg]`]; // a still photo
  const inputs = ["-loop", "1", "-t", String(seconds), "-i", photo];
  let last = "bg";
  if (card) {
    inputs.push("-loop", "1", "-t", String(seconds), "-i", card);
    parts.push(`[1:v]format=rgba,fade=in:st=0.3:d=0.7:alpha=1[cd]`, `[bg][cd]overlay=0:0:shortest=1[v]`);
    last = "v";
  }
  await ffmpeg([...inputs, "-filter_complex", parts.join(";"), "-map", `[${last}]`, "-t", String(seconds), ...encode, out]);
}

/**
 * A scene drawn as layers by make_title.py (landing page, tilted card): each layer fades or slides in
 * at its own delay over a white canvas; the pictures themselves stay still.
 */
async function layerScene({ spec, w, h, seconds, out, dir, name }) {
  const layerDir = path.join(dir, name);
  await png({ ...spec, width: w, height: h, seconds }, layerDir, dir);
  const items = JSON.parse(await readFile(path.join(layerDir, "layers.json"), "utf8"));
  const inputs = [];
  const parts = [`color=c=white:s=${w}x${h}:d=${seconds}:r=${FPS}[c0]`];
  let last = "c0";
  items.forEach((it, i) => {
    inputs.push("-loop", "1", "-t", String(seconds), "-i", it.file);
    const d = it.delay;
    const ease = `pow(1-min(max((t-${d})/0.6,0),1),3)`;
    let x = String(it.x);
    let y = String(it.y);
    let src = `[${i}:v]format=rgba`;
    if (it.anim === "left") x = `${it.x}-(${it.x + 800})*${ease}`;
    else if (it.anim === "right") x = `${it.x}+(${w - it.x + 40})*${ease}`;
    else if (it.anim === "up") y = `${it.y}+(${Math.round(h * 0.08)})*${ease}`;
    else if (it.anim === "down") y = `${it.y}-(${Math.round(h * 0.05)})*${ease}`;
    else if (it.anim === "rise") y = `${it.y}+(${h - it.y + 40})*${ease}`; // up from below the frame
    else if (it.anim === "drop") y = `${it.y}-(${it.y + Math.round(h * 0.35)})*${ease}`; // down from above the frame (map pin)
    else if (it.anim === "pan") {
      // Moves steadily the whole scene (film strip, running words): it.vx / it.vy px per second.
      x = `${it.x}+(${it.vx ?? 0})*t`;
      y = `${it.y}+(${it.vy ?? 0})*t`;
    }
    if (it.anim !== "none" && it.anim !== "pan") src += `,fade=in:st=${d}:d=0.45:alpha=1`;
    parts.push(`${src}[l${i}]`, `[${last}][l${i}]overlay=x='${x}':y='${y}':shortest=1[o${i}]`);
    last = `o${i}`;
  });
  await ffmpeg([...inputs, "-filter_complex", parts.join(";"), "-map", `[${last}]`, "-t", String(seconds), ...encode, out]);
}

/** Closing card: the photo blurred and darkened behind the name, city and address. */
async function endScene({ photo, card, w, h, seconds, out }) {
  const parts = [`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=18:2,eq=brightness=-0.12,setsar=1[bg]`, `[1:v]format=rgba,fade=in:st=0.2:d=0.6:alpha=1[cd]`, `[bg][cd]overlay=0:0:shortest=1[v]`];
  await ffmpeg(["-loop", "1", "-t", String(seconds), "-i", photo, "-loop", "1", "-t", String(seconds), "-i", card, "-filter_complex", parts.join(";"), "-map", "[v]", "-t", String(seconds), ...encode, out]);
}

async function png(spec, file, dir) {
  const json = path.join(dir, `${path.basename(file)}.json`);
  await writeFile(json, JSON.stringify(spec));
  await run("python3", [TITLE, file, json]);
  return file;
}

/** "4756 S 27th St\nMilwaukee, WI 53221" → "Milwaukee, WI" (else the city field). */
export function searchPlace({ address = "", city = "" }) {
  const lastLine = String(address).split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
  const m = lastLine.match(/^([^,]+),\s*([A-Z]{2})\b/);
  return m ? `${m[1]}, ${m[2]}` : city;
}

/**
 * @param {{ file: string, role: string }[]} slides  photos with their role
 * @param {{ ratio, seconds, name, city, address, phone, logo }} opts
 */
const LABELS = {
  en: { top3: "Top 3 must-try", at: "at", menu: "Our menu", deal: "DEAL", onlyAt: "Only at", seeMore: "See More >" },
  vi: { top3: "Top 3 món phải thử", at: "tại", menu: "Thực đơn", deal: "ƯU ĐÃI", onlyAt: "Chỉ có tại", seeMore: "Xem thêm >" },
};
Object.assign(LABELS.en, { showing: "Now showing", issue: "Special issue", from: "Greetings from", receipt: "Receipt", thanks: "Thank you!", now: "now", spotlight: "Signature dishes" });
Object.assign(LABELS.vi, { showing: "Đang chiếu", issue: "Số đặc biệt", from: "Gửi từ", receipt: "Hoá đơn", thanks: "Cảm ơn quý khách!", now: "vừa xong", spotlight: "Món nổi bật" });
Object.assign(LABELS.en, { breaking: "Breaking", live: "Live", mustTry: "Must try", today: "Today's specials", findUs: "Find us here", coupon: "Coupon" });
Object.assign(LABELS.vi, { breaking: "Tin nóng", live: "Trực tiếp", mustTry: "Món nên thử", today: "Hôm nay có", findUs: "Quán ở đây", coupon: "Phiếu ưu đãi" });
/** Templates that open on their own hook instead of the search bar (all but the Canva-like collage). */
const OWN_HOOK = new Set(["top3", "menu", "promo", "polaroid", "bold", "film", "magazine", "grid", "story", "receipt", "neon", "postcard", "spotlight", "marquee", "news", "chalk", "map", "coupon"]);

/**
 * Scene list of a template (durations are rough; they are scaled to the requested length).
 * "layers" scenes are drawn by make_title.py (spec.kind) with the photos of their roles.
 */
function planFor(template, { seconds, hasCard, portrait, top, name, city, address, phone, map, dishes, offer, words, tagline, blurb, query, logo, L }) {
  const long = seconds >= 30;
  const plan = [];
  // Only the Canva-like collage opens on the search bar; the marketing templates open on their own hook.
  if (hasCard && !OWN_HOOK.has(template)) plan.push({ kind: "search", d: 2.4 });
  const place = [name, city].filter(Boolean).join(", ");
  const dish = (k) => dishes[k] ?? { name: "", price: "" };
  const dishNames = dishes.map((x) => x.name).filter(Boolean);
  if (template === "top3") {
    plan.push({ kind: "layers", spec: { kind: "title", style: "photo", kicker: name ? `${L.at} ${name}` : "", headline: L.top3, sub: city }, roles: ["table"], d: 2.4 });
    for (const k of [2, 1, 0]) plan.push({ kind: "layers", spec: { kind: "countdown", number: k + 1, dish: dish(k).name, price: dish(k).price }, roles: [`dish${k + 1}`], d: long ? 5 : 3 });
    plan.push({ kind: long ? "tilted" : "full", roles: ["ext", "table"], role: "ext", card: top, d: 3 });
    if (long) plan.push({ kind: "layout", layout: "split", roles: ["int", "table"], d: 4 });
  } else if (template === "menu") {
    plan.push({ kind: "layers", spec: { kind: "title", style: "light", kicker: name, headline: L.menu, sub: city }, roles: [], d: 2.4 });
    plan.push({ kind: "layers", spec: { kind: "menu", heading: name || L.menu, dishes: [dish(0), dish(1)] }, roles: ["dish1", "dish2"], d: long ? 6 : 4 });
    plan.push({ kind: "layers", spec: { kind: "menu", heading: name || L.menu, dishes: [dish(2), dish(3)] }, roles: ["dish3", "dish4"], d: long ? 6 : 4 });
    plan.push({ kind: "tilted", roles: ["ext", "int"], d: 3.2 });
    if (long) plan.push({ kind: "layout", layout: "split", roles: ["int", "dish1"], d: 4 });
  } else if (template === "promo") {
    plan.push({ kind: "layers", spec: { kind: "offer", offer, kicker: name ? `${L.onlyAt} ${name}` : "", sticker: L.deal, place: city }, roles: [], d: 3.4 });
    plan.push({ kind: "layers", spec: { kind: "ribbon", offer }, roles: ["medium"], d: 3.4 });
    plan.push({ kind: "layout", layout: "trio", roles: ["close", "table", "int"], d: 3.8 });
    if (long) {
      plan.push({ kind: "tilted", roles: ["ext", "side"], d: 4 });
      plan.push({ kind: "layers", spec: { kind: "ribbon", offer }, roles: ["table"], d: 4 });
    }
  } else if (template === "polaroid") {
    plan.push({ kind: "layers", spec: { kind: "polaroids" }, roles: ["medium", "int", "close"], d: long ? 6 : 4.4 });
    plan.push({ kind: "layers", spec: { kind: "polaroids" }, roles: ["table", "side", "ext"], d: long ? 6 : 4.4 });
    plan.push({ kind: "full", role: "ext", card: top, d: 3.2 });
    if (long) plan.push({ kind: "layout", layout: "trio", roles: ["medium", "close", "side"], d: 4.6 });
  } else if (template === "bold") {
    const ws = (words.length ? words : [tagline || name || "Fresh.", "Taste it.", "See you soon."]).slice(0, 3);
    const shots = ["medium", "int", "close"];
    ws.forEach((word, k) => {
      plan.push({ kind: "layers", spec: { kind: "word", word, dark: k % 2 === 0 }, roles: [], d: 1.6 });
      plan.push({ kind: "full", role: shots[k] ?? "table", d: long ? 4 : 2.2 });
    });
    if (long) plan.push({ kind: "layout", layout: "hero", roles: ["close", "side", "table"], d: 4 });
  } else if (template === "film") {
    plan.push({ kind: "layers", spec: { kind: "film", label: L.showing, title: name || tagline }, roles: ["medium", "close", "side", "table"], d: long ? 7 : 5.6 });
    plan.push({ kind: "full", role: "ext", card: top, d: 3.4 });
    if (long) {
      plan.push({ kind: "layers", spec: { kind: "film", label: city, title: tagline || name }, roles: ["int", "table", "close", "medium"], d: 6 });
      plan.push({ kind: "layout", layout: "split", roles: ["int", "medium"], d: 4 });
    }
  } else if (template === "magazine") {
    const issue = [L.issue, city].filter(Boolean).join(" · ");
    const masthead = name || tagline;
    plan.push({ kind: "layers", spec: { kind: "cover", masthead, issue, headline: name ? tagline : "", items: dishNames.slice(0, 3) }, roles: ["medium"], d: 4.6 });
    plan.push({ kind: "layers", spec: { kind: "cover", masthead, issue, blurb }, roles: ["int"], d: 4.2 });
    plan.push({ kind: "layout", layout: "trio", roles: ["close", "table", "side"], d: 4 });
    if (long) {
      plan.push({ kind: "full", role: "ext", card: top, d: 4 });
      plan.push({ kind: "layers", spec: { kind: "cover", masthead, issue, headline: words.join(" ") }, roles: ["table"], d: 4.4 });
    }
  } else if (template === "grid") {
    plan.push({ kind: "layers", spec: { kind: "grid9", title: name || tagline, sub: name ? tagline : city }, roles: ["medium", "close", "side", "table", "int", "ext"], d: long ? 6.5 : 5.6 });
    plan.push({ kind: "full", role: "medium", card: top, d: 3.2 });
    if (long) {
      plan.push({ kind: "layout", layout: "hero", roles: ["close", "side", "table"], d: 4.4 });
      plan.push({ kind: "layers", spec: { kind: "grid9", title: name || tagline, sub: blurb ? "" : city }, roles: ["int", "table", "close", "medium", "ext", "side"], d: 5.6 });
    }
  } else if (template === "story") {
    const n = long ? 6 : 4;
    const stickers = [tagline || name, ...dishNames, ...words].filter(Boolean);
    const shots = ["int", "medium", "close", "table", "side", "ext"];
    for (let k = 0; k < n; k++) plan.push({ kind: "layers", spec: { kind: "story", index: k, total: n, name, now: L.now, sticker: stickers[k] ?? "" }, roles: [shots[k]], d: long ? 4.2 : 3 });
  } else if (template === "receipt") {
    const rows = dishes.length ? dishes : words.map((x) => ({ name: x, price: "" }));
    plan.push({ kind: "layers", spec: { kind: "receipt", name, city, label: L.receipt, thanks: L.thanks, rows }, roles: [], d: long ? 5.4 : 4.6 });
    plan.push({ kind: "full", role: "close", d: 3 });
    plan.push({ kind: "layout", layout: "trio", roles: ["medium", "table", "side"], d: 3.8 });
    if (long) {
      plan.push({ kind: "full", role: "ext", card: top, d: 4 });
      plan.push({ kind: "layout", layout: "split", roles: ["int", "medium"], d: 4 });
    }
  } else if (template === "neon") {
    plan.push({ kind: "layers", spec: { kind: "neon", mode: "title", title: name || tagline, sub: name ? tagline : city }, roles: [], d: 3.4 });
    plan.push({ kind: "layers", spec: { kind: "neon", mode: "photo", caption: dishNames[0] ?? words[0] ?? "" }, roles: ["medium"], d: long ? 4.6 : 3.6 });
    plan.push({ kind: "layers", spec: { kind: "neon", mode: "photo", caption: dishNames[1] ?? words[1] ?? "" }, roles: ["close"], d: long ? 4.6 : 3.6 });
    if (long) {
      plan.push({ kind: "layers", spec: { kind: "neon", mode: "photo", caption: dishNames[2] ?? words[2] ?? "" }, roles: ["side"], d: 4.6 });
      plan.push({ kind: "full", role: "ext", card: top, d: 4 });
    }
  } else if (template === "postcard") {
    plan.push({ kind: "layers", spec: { kind: "postcard", from: L.from, name: name || tagline, city }, roles: ["ext"], d: 4.6 });
    plan.push({ kind: "layers", spec: { kind: "postcard", from: L.from, name: name || tagline, city, note: blurb }, roles: ["medium"], d: 4.4 });
    plan.push({ kind: "layout", layout: "split", roles: ["close", "table"], d: 3.6 });
    if (long) {
      plan.push({ kind: "layers", spec: { kind: "postcard", from: L.from, name: name || tagline, city }, roles: ["int"], d: 4.6 });
      plan.push({ kind: "layout", layout: "trio", roles: ["side", "close", "table"], d: 4.4 });
    }
  } else if (template === "spotlight") {
    plan.push({ kind: "layers", spec: { kind: "title", style: "light", kicker: name, headline: L.spotlight, sub: city }, roles: [], d: 2.4 });
    for (const k of [0, 1, 2]) plan.push({ kind: "layers", spec: { kind: "circle", index: k + 1, total: 3, dish: dish(k).name, price: dish(k).price }, roles: [`dish${k + 1}`], d: long ? 5 : 3 });
    plan.push({ kind: long ? "tilted" : "full", roles: ["ext", "table"], role: "ext", card: top, d: 3 });
    if (long) plan.push({ kind: "layout", layout: "split", roles: ["int", "table"], d: 4 });
  } else if (template === "marquee") {
    const items = [name, tagline, ...words].filter(Boolean);
    for (const role of long ? ["medium", "close", "table", "int", "side"] : ["medium", "close", "table"]) plan.push({ kind: "layers", spec: { kind: "marquee", items }, roles: [role], d: 4.4 });
  } else if (template === "news") {
    // Each scene is a "breaking news" frame on a new photo; the ticker runs everything we know.
    const items = [name, tagline, ...dishNames, ...words, city].filter(Boolean);
    const heads = [
      { headline: name || tagline, sub: name ? tagline || city : city, role: "ext" },
      // The AI's food photos: the signature dish (medium, then close-up), then a side dish or drink (side).
      { headline: dishNames[0] ?? words[0], sub: L.mustTry, role: "medium" },
      { headline: dishNames[1] ?? words[1], sub: city, role: "side" },
      ...(long ? [{ headline: tagline || name, sub: city, role: "int" }, { headline: dishNames[0] ?? words[2], sub: L.mustTry, role: "close" }] : []),
    ].filter((x) => x.headline);
    for (const x of heads) plan.push({ kind: "layers", spec: { kind: "news", tag: L.breaking, live: L.live, headline: x.headline, sub: x.sub, items }, roles: [x.role], d: long ? 4.6 : 3.6 });
    if (heads.length < 3) plan.push({ kind: "layout", layout: "trio", roles: ["medium", "close", "table"], d: 3.8 });
  } else if (template === "chalk") {
    // No dish at all: the slogan is written on the board instead of a list.
    plan.push({ kind: "layers", spec: { kind: "chalk", title: L.today, name, rows: dishes, note: dishes.length ? "" : tagline || words.join(" ") }, roles: [], d: long ? 5.6 : 4.6 });
    for (let k = 0; k < (long ? 3 : 2); k++) plan.push({ kind: "layers", spec: { kind: "chalk", mode: "photo", dish: dish(k).name, price: dish(k).price }, roles: [`dish${k + 1}`], d: long ? 4.4 : 3.4 });
    plan.push({ kind: "full", role: "ext", card: top, d: 3 });
    if (long) plan.push({ kind: "layout", layout: "split", roles: ["int", "table"], d: 4 });
  } else if (template === "map") {
    // The real map only when the address was found precisely (see sources/osm.mjs); never a made-up one.
    if (map) plan.push({ kind: "layers", spec: { kind: "map", map, label: L.findUs, name: name || tagline, address, city, phone }, roles: [], d: long ? 5 : 4.4 });
    plan.push({ kind: "full", role: "ext", card: top, d: 3.2 });
    plan.push({ kind: "layout", layout: "trio", roles: ["close", "table", "int"], d: 3.8 });
    if (long) {
      plan.push({ kind: "tilted", roles: ["int", "medium"], d: 4 });
      plan.push({ kind: "layout", layout: "split", roles: ["side", "close"], d: 4 });
    }
  } else if (template === "coupon") {
    plan.push({ kind: "layers", spec: { kind: "coupon", label: L.coupon, offer, kicker: name ? `${L.onlyAt} ${name}` : "", place: city, sub: tagline }, roles: [], d: 3.8 });
    plan.push({ kind: "layers", spec: { kind: "coupon", mode: "photo", label: L.coupon, offer, place: name || city }, roles: ["medium"], d: 3.6 });
    plan.push({ kind: "layout", layout: "trio", roles: ["close", "table", "int"], d: 3.8 });
    if (long) {
      plan.push({ kind: "tilted", roles: ["ext", "side"], d: 4 });
      plan.push({ kind: "layers", spec: { kind: "coupon", mode: "photo", label: L.coupon, offer, place: name || city }, roles: ["table"], d: 4 });
    }
  } else {
    // "collage": the Canva-like layouts.
    if (hasCard && portrait) plan.push({ kind: "landing", roles: ["close", "int", "medium", "table"], d: 4.8 });
    plan.push({ kind: "layout", layout: "hero", roles: ["close", "side", "table"], d: 4 });
    plan.push({ kind: "tilted", roles: ["ext", "medium"], d: 3.6 });
    if (long) {
      plan.push({ kind: "full", role: "int", card: top, d: 4 });
      plan.push({ kind: "layout", layout: "trio", roles: ["medium", "close", "side"], d: 4.6 });
      plan.push({ kind: "full", role: "table", d: 3.8 });
      plan.push({ kind: "layout", layout: "split", roles: ["int", "medium"], d: 4.2 });
    } else if (!hasCard || !portrait) {
      plan.push({ kind: "layout", layout: "split", roles: ["int", "medium"], d: 4 });
    }
  }
  return plan;
}

/**
 * place: the restaurant's exact { lat, lon } for the "map" template (null: the video has no map scene);
 * tileDir: where OpenStreetMap tiles are cached; labels: the user's words for the template's own (see shared/templateTexts.js).
 */
export async function collage(slides, out, { template = "collage", ratio = "9:16", seconds = 15, name = "", city = "", address = "", phone = "", logo = null, tagline = "", blurb = "", lang = "", dishes = [], offer = "", words = [], labels = {}, place = null, tileDir = path.join(tmpdir(), "osm-tiles") } = {}) {
  const [w, h] = SIZES[ratio] ?? SIZES["9:16"];
  // A Google Maps link or coordinates in the address only locate the place; they are never shown.
  address = String(address).split("\n").filter((l) => !/https?:\/\/|^\s*-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+\s*$/.test(l)).join("\n");
  const dir = await mkdtemp(path.join(tmpdir(), "collage-"));
  try {
    const take = picker(slides);
    const hasCard = !!name;
    const bandH = rect([0, 0.4, 1, 0.15], w, h, w > h);
    const band = hasCard ? await png({ kind: "banner", width: bandH.w, height: bandH.h, name, city, logo }, path.join(dir, "band.png"), dir) : null;
    const top = hasCard ? await png({ width: w, height: h, name, city }, path.join(dir, "top.png"), dir) : null;
    const end = hasCard ? await png({ width: w, height: h, name, city, address, phone, logo }, path.join(dir, "end.png"), dir) : null;

    // Scene plan (durations include the transition overlap).
    const query = `${name} - ${searchPlace({ address, city })}`.replace(/ - $/, "");
    const portrait = h > w; // the landing page and the tall layouts are made for vertical video
    const L = { ...LABELS[lang === "en" ? "en" : "vi"], ...labels }; // the user's words replace the template's
    let map = null;
    if (template === "map" && place) {
      // The pin sits where scene_map draws it; a failed download only drops the map scene.
      map = await mapTiles(place, { w, h, pin: [Math.round(w / 2), Math.round(h * (portrait ? 0.4 : 0.38))], cacheDir: tileDir }).catch((e) => {
        console.warn(`map: ${e.message}`);
        return null;
      });
    }
    const plan = planFor(template, { seconds, hasCard, portrait, top, name, city, address, phone, map, dishes, offer, words, tagline, blurb, query, logo, L });
    if (end) plan.push({ kind: "end", role: "table", d: 3.2 });
    // Stretch or squeeze evenly so the whole video lasts `seconds`.
    // total = Σd − (scenes − 1) × FADE; the search intro keeps its length.
    const fixed = plan.filter((p) => p.kind === "search").reduce((a, p) => a + p.d, 0);
    const flexible = plan.reduce((a, p) => a + p.d, 0) - fixed;
    const k = (seconds + (plan.length - 1) * FADE - fixed) / flexible;
    for (const p of plan) if (p.kind !== "search") p.d = Math.max(p.spec?.kind === "word" ? 1.1 : 2, +(p.d * k).toFixed(2)); // big words can flash by

    const segs = [];
    for (const [i, p] of plan.entries()) {
      const file = path.join(dir, `s${i}.mp4`);
      if (p.kind === "search") {
        const frames = path.join(dir, "search");
        await png({ kind: "search", width: w, height: h, fps: FPS, seconds: p.d, query, logo }, frames, dir);
        await ffmpeg(["-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"), ...encode, file]);
      } else if (p.kind === "layout") {
        // Each scene picks fresh photos; the hero band shows the logo + name.
        const photos = p.roles.map((r) => take(r).file);
        await layoutScene({ layout: p.layout, photos, band: p.layout === "hero" ? band : null, w, h, seconds: p.d, out: file });
      } else if (p.kind === "landing") {
        const photos = p.roles.map((r) => take(r).file);
        await layerScene({ spec: { kind: "landing", query, logo, name, tagline, blurb, cta: L.seeMore, photos }, w, h, seconds: p.d, out: file, dir, name: `l${i}` });
      } else if (p.kind === "layers") {
        const photos = p.roles.map((r) => take(r).file);
        await layerScene({ spec: { ...p.spec, logo, photos }, w, h, seconds: p.d, out: file, dir, name: `l${i}` });
      } else if (p.kind === "tilted") {
        const photos = p.roles.map((r) => take(r).file);
        await layerScene({ spec: { kind: "tilted", logo, photos }, w, h, seconds: p.d, out: file, dir, name: `l${i}` });
      } else if (p.kind === "full") {
        await fullScene({ photo: take(p.role).file, card: p.card, w, h, seconds: p.d, out: file });
      } else {
        // The closing card may reuse a photo: blurred behind the text.
        await endScene({ photo: (slides.find((s) => s.role === p.role) ?? slides[0]).file, card: end, w, h, seconds: p.d, out: file });
      }
      segs.push({ file, d: p.d });
    }

    // Join with alternating transitions.
    const parts = [];
    let last = "0:v";
    let at = 0;
    for (let i = 1; i < segs.length; i++) {
      at += segs[i - 1].d - FADE;
      parts.push(`[${last}][${i}:v]xfade=transition=${TRANSITIONS[(i - 1) % TRANSITIONS.length]}:duration=${FADE}:offset=${at.toFixed(3)}[x${i}]`);
      last = `x${i}`;
    }
    await ffmpeg([...segs.flatMap((s) => ["-i", s.file]), ...(parts.length ? ["-filter_complex", parts.join(";"), "-map", `[${last}]`] : []), ...encode, "-movflags", "+faststart", out]);
    return { map: !!map };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
