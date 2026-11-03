// "Giới thiệu quán": each listing caps its about text (Google refuses a longer description, Facebook and
// Instagram cut it). The model cannot count characters reliably, so the count is worked out here and put
// in the section heading, with a warning when a text is over.

export const ABOUT_LIMITS = { "Google Business": 750, Facebook: 101, Instagram: 150 };

/** "## Google Business" → "## Google Business · 612/750 ký tự" (or "… · 812/750 ký tự, dài quá, cắt bớt trước khi dán"). */
export function aboutLengths(md) {
  return String(md ?? "")
    .split(/^(?=## )/m)
    .map((part) => {
      const m = part.match(/^## ([^\n]+)\n([\s\S]*)$/);
      const name = m && Object.keys(ABOUT_LIMITS).find((k) => m[1].trim().toLowerCase().startsWith(k.toLowerCase()));
      if (!name) return part;
      const limit = ABOUT_LIMITS[name];
      const n = [...m[2].trim()].length; // characters as the listing counts them (an emoji is one)
      return `## ${name} · ${n}/${limit} ký tự${n > limit ? ", dài quá, cắt bớt trước khi dán" : ""}\n${m[2]}`;
    })
    .join("");
}
