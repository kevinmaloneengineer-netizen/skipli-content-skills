/** Markdown → plain text for pasting into Facebook/Threads (no ** or # markers). */
export function toPlainText(md) {
  return String(md ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
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
