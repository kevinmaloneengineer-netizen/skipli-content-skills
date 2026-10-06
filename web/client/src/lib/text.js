/** Markdown → plain text for pasting into Facebook/Threads (no ** or # markers). */
export function toPlainText(md) {
  return String(md ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__([^_\s][^_]*?)__/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split a content-writer answer into "## Phương án …" sections + everything else (notes). */
export function splitVariants(md) {
  const variants = [];
  const rest = [];
  for (const part of String(md ?? "").split(/^(?=## )/m)) {
    const m = part.match(/^## (Phương án[^\n]*)\n([\s\S]*)$/i);
    if (!m) {
      rest.push(part);
      continue;
    }
    const [body, ...tail] = m[2].split(/^---\s*$/m); // notes after a rule are not part of the post
    variants.push({ title: m[1].trim(), body: body.trim() });
    if (tail.length) rest.push(tail.join("---"));
  }
  return { variants, rest: rest.join("\n").trim() };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // navigator.clipboard only exists on https/localhost; plain-http deployments need the legacy path.
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  return ok;
}

export const PILLARS = [
  { id: "entertain", name: "Giải trí" },
  { id: "educate", name: "Giáo dục" },
  { id: "engage", name: "Tương tác" },
  { id: "sell", name: "Bán hàng" },
];

const norm = (s) => s.normalize("NFC").toLowerCase().trim();

/** Split a channel-cloner answer into "## Bài N · <pillar>: <title>" posts + intro + notes. */
export function splitClonePosts(md) {
  const posts = [];
  const intro = [];
  const notes = [];
  for (const part of String(md ?? "").replace(/\r\n?/g, "\n").split(/^(?=## )/m)) {
    const m = part.match(/^## Bài\s*\d*\s*[·•|:-]\s*([^:\n]+?)\s*:\s*([^\n]*)\n([\s\S]*)$/i);
    if (!m) {
      (posts.length ? notes : intro).push(part);
      continue;
    }
    const pillar = PILLARS.find((p) => norm(p.name) === norm(m[1]))?.id ?? "other";
    const [rawBody, ...tail] = m[3].split(/^---\s*$/m);
    let body = rawBody.trim();
    let source = "";
    const src = body.match(/^>\s*Gốc:\s*(.*)\n?/i);
    if (src) {
      source = src[1].trim();
      body = body.slice(src[0].length).trim();
    }
    posts.push({ id: `p${posts.length + 1}`, pillar, title: m[2].trim() || m[1].trim(), source, body });
    if (tail.length) notes.push(tail.join("---"));
  }
  return { intro: intro.join("\n").trim(), posts, notes: notes.join("\n").trim() };
}

const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
const SEGMENT = new RegExp(String.raw`^## (${TIME})\s*(?:đến|-|–|—)\s*(${TIME})\s*[·•|:-]\s*(.+)$`);

/** Split a livestream script into "## MM:SS đến MM:SS · Title" segments + everything after them (closing lines, tables). */
export function splitLivestream(md) {
  const segments = [];
  const rest = [];
  for (const part of String(md ?? "").replace(/\r\n?/g, "\n").split(/^(?=## )/m)) {
    const [head, ...body] = part.split("\n");
    const m = head.match(SEGMENT);
    if (m) segments.push({ start: m[1], end: m[2], title: m[3].trim(), body: body.join("\n").trim() });
    else rest.push(part);
  }
  return { segments, rest: rest.join("\n").trim() };
}

const PLAN_HEAD = /^## Ngày\s*(\d{1,2})\s*[·•|-]\s*(\d{1,2})[:h](\d{2})\s*[·•|-]\s*([^:\n]+?)\s*:\s*(.*)$/i;

/** Split a content-planner answer into "## Ngày N · HH:MM · Pillar: Title" slots + intro + notes. */
export function splitPlan(md) {
  const slots = [];
  const intro = [];
  const notes = [];
  for (const part of String(md ?? "").replace(/\r\n?/g, "\n").split(/^(?=## )/m)) {
    const [head, ...rest] = part.split("\n");
    const m = head.match(PLAN_HEAD);
    if (!m) {
      (slots.length ? notes : intro).push(part);
      continue;
    }
    const [body, ...tail] = rest.join("\n").split(/^---\s*$/m);
    const pillar = PILLARS.find((p) => norm(p.name) === norm(m[4]))?.id ?? "other";
    slots.push({ day: Number(m[1]), time: `${m[2].padStart(2, "0")}:${m[3]}`, pillar, title: m[5].trim() || m[4].trim(), body: body.trim() });
    if (tail.length) notes.push(tail.join("---"));
  }
  return { intro: intro.join("\n").trim(), slots, notes: notes.join("\n").trim() };
}
