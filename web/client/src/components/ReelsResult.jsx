import Markdown from "./Markdown.jsx";

const THREADS_URL = /https:\/\/(?:www\.)?threads\.(?:com|net)\/@[\w.]+\/post\/[\w-]+/;
export const REEL_URL = /https:\/\/(?:www\.|m\.)?facebook\.com\/(?:reel\/\d{6,25}|[^\s/)]+\/videos\/\d{6,25}|watch\/?\?v=\d{6,25})[^\s)]*/;

/** Facebook's own video embed, shown right away (the browser only loads it when scrolled near: loading="lazy"). */
export function ReelPlayer({ url, compact = false }) {
  const src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=320`;
  return (
    <div className={compact ? "reel-player compact" : "reel-player"}>
      <iframe src={src} title="Reel Facebook" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen />
      <a className="reel-open" href={url} target="_blank" rel="noopener noreferrer">Mở trên Facebook ↗</a>
    </div>
  );
}

const num = (v) => (v ? v.trim() : "");

/** A Threads-style post card built from the report itself (no request to Threads, so it never gets blocked). */
function ThreadsCard({ section, url }) {
  const author = section.match(/@([\w.]+)/)?.[1] ?? url.match(/@([\w.]+)/)?.[1] ?? "threads";
  const likes = num(section.match(/❤️?\s*([\d.,]+[KkMm]?)/)?.[1]);
  const replies = num(section.match(/💬\s*([\d.,]+[KkMm]?)/)?.[1]);
  const reposts = num(section.match(/🔁\s*([\d.,]+[KkMm]?)/)?.[1]);
  const date = section.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  const text = section
    .split("\n")
    .filter((l) => /^\s*>/.test(l))
    .map((l) => l.replace(/^\s*>\s?/, "").trim().replace(/^[“"]+|[”"]+$/g, "").trim())
    .filter(Boolean)
    .join("\n");
  const hue = [...author].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div className="reel-player thread-player">
      <a className="thread-card" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Bài của @${author} trên Threads`}>
        <div className="thread-top">
          <span className="thread-avatar" style={{ background: `hsl(${hue} 55% 52%)` }}>{author[0].toUpperCase()}</span>
          <span className="thread-who">
            <b>{author}</b>
            <small>{date}</small>
          </span>
          <svg className="thread-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 11.2c-.1-.1-.2-.1-.3-.2-.2-3.3-2-5.2-5-5.2-1.8 0-3.3.8-4.2 2.2l1.6 1.1c.7-1 1.7-1.3 2.6-1.3 1.1 0 1.9.3 2.4.9.4.4.6 1 .7 1.7-.9-.2-1.9-.2-2.9-.2-2.9.2-4.8 1.9-4.7 4.2.1 1.2.7 2.2 1.7 2.8.8.6 1.9.8 3.1.8 1.5-.1 2.7-.7 3.5-1.7.6-.8 1-1.8 1.1-3.1.7.4 1.3 1 1.6 1.7.5 1.2.6 3.2-1.1 4.9-1.5 1.5-3.2 2.1-5.9 2.1-3-.1-5.2-1-6.7-2.9-1.4-1.8-2.1-4.3-2.1-7.5s.7-5.7 2.1-7.5c1.5-1.9 3.7-2.9 6.7-2.9 3 0 5.3 1 6.8 2.9.8.9 1.3 2.1 1.7 3.4l1.9-.5c-.4-1.6-1.1-3-2.1-4.2C17.9 1.3 15.1.1 11.6 0 8 .1 5.3 1.3 3.5 3.6 1.9 5.7 1 8.6 1 12.1s.9 6.4 2.5 8.5c1.8 2.3 4.5 3.5 8 3.6 3.2 0 5.4-.9 7.3-2.7 2.4-2.4 2.3-5.5 1.5-7.3-.6-1.3-1.6-2.3-2.8-3zm-5.3 5c-1.3.1-2.6-.5-2.7-1.6-.1-.8.6-1.8 2.8-1.9h.7c.8 0 1.5.1 2.2.2-.2 2.6-1.6 3.2-3 3.3z" /></svg>
        </div>
        {text ? <p className="thread-text">{text}</p> : <p className="thread-text muted">Bấm để xem nội dung bài trên Threads.</p>}
        <div className="thread-stats">
          {likes && <span><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>{likes}</span>}
          {replies && <span><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" /></svg>{replies}</span>}
          {reposts && <span><svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>{reposts}</span>}
        </div>
      </a>
      <a className="reel-open" href={url} target="_blank" rel="noopener noreferrer">Mở trên Threads ↗</a>
    </div>
  );
}

/** The card already shows the post, its numbers and link: keep only the heading and the "why viral" notes. */
const reasonOnly = (section) =>
  section
    .split("\n")
    .filter((l) => !/^\s*>/.test(l) && !THREADS_URL.test(l) && !/❤|💬|🔁/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

const linkOf = (p) => (/^###\s/.test(p) ? p.match(REEL_URL)?.[0] ?? p.match(THREADS_URL)?.[0] : null);

/** Scan reports: every "### N." section that links a reel or a Threads post gets an embed beside it. */
export default function ReelsResult({ markdown, bare = false }) {
  const parts = String(markdown ?? "").split(/^(?=###? )/m);
  if (!parts.some(linkOf)) return <Markdown className={bare ? "md" : "card md"}>{markdown}</Markdown>;
  return (
    <section className={bare ? "md reels-result" : "card md reels-result"}>
      {parts.map((p, i) => {
        const url = linkOf(p);
        return url ? (
          <div key={i} className="reel-row">
            <Markdown className="md reel-text">{THREADS_URL.test(url) ? reasonOnly(p) : p}</Markdown>
            {THREADS_URL.test(url) ? <ThreadsCard section={p} url={url} /> : <ReelPlayer url={url} />}
          </div>
        ) : (
          <Markdown key={i}>{p}</Markdown>
        );
      })}
    </section>
  );
}
