// Review quotes in the Google Maps / Yelp reports must be word for word. The model sometimes trims the
// middle of a review ("Seasoning has nil… price is a little high") or rewords it. Every quoted line is
// checked against the reviews the model was given; one that is not verbatim is replaced by the opening
// sentence(s) of the review it came from.

const norm = (t) => String(t).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = (t) => new Set(norm(t).split(" ").filter((w) => w.length > 2));

/** Review texts from the prompt lines "- (1 sao, 2025-04-29…) text". */
export function reviewsIn(prompt) {
  return [...String(prompt ?? "").matchAll(/^- \(\d sao[^)]*\) (.+)$/gm)].map((m) => m[1].trim());
}

/** Opening of a review, cut at a sentence end, about `max` characters. */
function opening(review, max = 150) {
  if (review.length <= max) return review;
  const cut = review.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 40 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * @param {string} md       the report
 * @param {string[]} reviews the review texts the model saw
 * @returns {{ text: string, fixed: number }}
 */
export function verifyQuotes(md, reviews) {
  if (!reviews.length) return { text: md, fixed: 0 };
  const source = reviews.map((r) => ({ r, n: norm(r), w: words(r) }));
  let fixed = 0;
  const text = String(md).replace(/^(\s*[-*]\s*)["“](.+?)["”](.*)$/gm, (line, lead, quote, tail) => {
    const q = norm(quote.replace(/\*\*|__/g, "").replace(/…|\.\.\./g, " "));
    if (!q) return line;
    // Verbatim when every piece between "…" is inside one review, in order.
    const pieces = norm(quote).length && quote.split(/…|\.\.\./).map(norm).filter(Boolean);
    const exact = source.find((s) => s.n.includes(norm(quote)));
    if (exact && !/…|\.\.\./.test(quote)) return line;
    // Closest review by shared words.
    const qw = words(quote);
    let best = null;
    let score = 0;
    for (const s of source) {
      const shared = [...qw].filter((w) => s.w.has(w)).length / Math.max(1, qw.size);
      if (shared > score) [best, score] = [s, shared];
    }
    if (!best || score < 0.5) return line; // not from these reviews (a summary bullet): leave it
    // One unbroken piece of the review (only trimmed at its ends) is still word for word.
    if (pieces.length === 1 && best.n.includes(pieces[0])) return line;
    fixed++;
    return `${lead}"${opening(best.r)}"${tail}`;
  });
  return { text, fixed };
}
