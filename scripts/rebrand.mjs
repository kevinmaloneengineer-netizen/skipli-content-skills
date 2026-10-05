#!/usr/bin/env node
// Rebrand a copy of this project: product name, logo, and a slight colour shift.
//
//   node scripts/rebrand.mjs --name "Acme" --suffix "Studio" --logo ~/acme.png --hue 18
//   node scripts/rebrand.mjs --hue 18 --dry      # only report what would change
//
// --name/--suffix  replace "Skipli" / "Content" in the visible brand ("Skipli Content")
// --logo           image copied to web/client/public/ and used for navbar, footer, favicon
// --hue            degrees to rotate every saturated colour (neutrals untouched); 10 to 30 = "a bit different"
// --sat            optional saturation multiplier, e.g. 0.9 for slightly calmer colours
//
// Run it on the COPY in the new project, then `cd web && npm run build` and look at it.

import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]]] : acc), []),
);
const dry = Boolean(args.dry);
const hue = Number(args.hue ?? 0);
const sat = Number(args.sat ?? 1);

const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const changed = [];
function write(f, before, after) {
  if (before === after) return;
  changed.push(f);
  if (!dry) writeFileSync(path.join(ROOT, f), after);
}

// ---- colour shift ----
function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function toRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
// Neutrals (paper, ink, greys) keep the look; only real colours move.
function shift(r, g, b) {
  const [h, s, l] = toHsl(r, g, b);
  if (s < 0.22 || l < 0.08 || l > 0.97) return [r, g, b];
  return toRgb((h + hue + 360) % 360, Math.min(1, s * sat), l);
}
const hex2 = (n) => n.toString(16).padStart(2, "0");
function recolor(css) {
  return css
    .replace(/#([0-9a-fA-F]{6})\b/g, (m, h) => {
      const [r, g, b] = shift(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
      return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    })
    .replace(/(rgba?\(\s*)(\d{1,3})([\s,]+)(\d{1,3})([\s,]+)(\d{1,3})/g, (m, p, r, s1, g, s2, b) => {
      const [R, G, B] = shift(+r, +g, +b);
      return `${p}${R}${s1}${G}${s2}${B}`;
    });
}
function walk(dir, out = []) {
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
if (hue || sat !== 1) {
  for (const f of walk("web/client/src")) write(f, read(f), recolor(read(f)));
}

// ---- name ----
const BRAND_FILES = ["web/client/index.html", "web/client/src/components/Layout.jsx", "web/client/src/components/Footer.jsx", "web/server/app.mjs"];
if (args.name || args.suffix) {
  const name = args.name ?? "Skipli";
  const suffix = args.suffix ?? "Content";
  for (const f of BRAND_FILES) {
    const before = read(f);
    const after = before
      .replaceAll("Skipli Content", `${name} ${suffix}`)
      .replaceAll("Skipli <em>Content</em>", `${name} <em>${suffix}</em>`)
      .replaceAll("© {new Date().getFullYear()} Skipli.", `© {new Date().getFullYear()} ${name}.`)
      .replace(/(className="foot-word"[^>]*>)Skipli</, `$1${name}<`);
    write(f, before, after);
  }
}

// ---- logo ----
if (args.logo) {
  const src = path.resolve(String(args.logo).replace(/^~/, process.env.HOME));
  if (!existsSync(src)) throw new Error(`logo not found: ${src}`);
  const name = `logo${path.extname(src).toLowerCase()}`;
  if (!dry) copyFileSync(src, path.join(ROOT, "web/client/public", name));
  const type = { ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" }[path.extname(name)] ?? "image/jpeg";
  for (const f of BRAND_FILES) {
    const before = read(f);
    write(f, before, before.replaceAll("/logo.jpg", `/${name}`).replace('type="image/jpeg"', `type="${type}"`));
  }
}

console.log(`${dry ? "Would change" : "Changed"} ${new Set(changed).size} file(s):`);
for (const f of [...new Set(changed)]) console.log("  " + f);
if (!changed.length) console.log("  (nothing: pass --name, --suffix, --logo, --hue or --sat)");
