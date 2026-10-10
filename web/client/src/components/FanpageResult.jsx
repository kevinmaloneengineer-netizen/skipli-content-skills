import { useState } from "react";
import Markdown from "./Markdown.jsx";
import ReelsResult, { IgPostsContext, REEL_URL, ReelPlayer } from "./ReelsResult.jsx";

const REEL_URL_G = new RegExp(REEL_URL.source, "g");

/** "1.300" / "4,6" / "562K" → number (Vietnamese thousands dots, decimal comma). */
export function toNumber(raw) {
  const s = String(raw).replace(/\*|\s|^[~≈<>]+|^(khoảng|gần|hơn)/gi, "");
  const m = s.match(/^([\d.,]+)([KkMm]?)$/);
  if (!m) return null;
  const n = Number(m[1].replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n * (m[2] ? (/[Kk]/.test(m[2]) ? 1e3 : 1e6) : 1) : null;
}

export function parseTable(block) {
  const rows = block.trim().split("\n").filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*:?-{2,}/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const [head, ...body] = rows;
  if (!head || body.length < 2) return null;
  const valueCol = [...head.keys()].reverse().find((i) => i > 0 && body.every((r) => toNumber(r[i]) !== null));
  if (valueCol === undefined) return null;
  return { head, body, valueCol };
}

/** One-series horizontal bars: the table's last numeric column, max bar in full tone. */
function BarTable({ block }) {
  const [asTable, setAsTable] = useState(false);
  const t = parseTable(block);
  if (!t) return <Markdown>{block}</Markdown>;
  const values = t.body.map((r) => toNumber(r[t.valueCol]));
  const max = Math.max(...values, 1);
  const others = t.head.map((_, i) => i).filter((i) => i !== 0 && i !== t.valueCol);
  return (
    <figure className="fp-chart">
      <figcaption>
        <span>
          <b>{t.head[0]}</b> theo {t.head[t.valueCol].toLowerCase()}
        </span>
        <button type="button" className="fp-toggle" onClick={() => setAsTable((v) => !v)}>{asTable ? "Xem biểu đồ" : "Xem bảng"}</button>
      </figcaption>
      {asTable ? (
        <Markdown>{block}</Markdown>
      ) : (
        <div className="fp-bars" role="list">
          {t.body.map((r, k) => {
            const v = values[k];
            const top = v === max;
            const unit = (h) => h.toLowerCase().replace(/^số\s+/, "");
            const extra = others.map((i) => `${r[i].replace(/\*/g, "")} ${unit(t.head[i])}`).join(" · ");
            return (
              <div key={k} className={top ? "fp-bar top" : "fp-bar"} role="listitem" title={`${r[0].replace(/\*/g, "")}: ${r[t.valueCol].replace(/\*/g, "")} ${t.head[t.valueCol].toLowerCase()}${extra ? ` (${extra})` : ""}`}>
                <span className="fp-label">
                  {r[0].replace(/\*/g, "")}
                  {extra && <small>{extra}</small>}
                </span>
                <span className="fp-track"><i style={{ width: `${Math.max(2, (v / max) * 100)}%` }} /></span>
                <b className="fp-value">{r[t.valueCol].replace(/\*/g, "")}</b>
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}

/** Numbered items that link reels → cards with a click-to-play reel. */
function ReelCards({ items }) {
  return (
    <ol className="fp-cards">
      {items.map((it, k) => {
        const urls = it.match(REEL_URL_G) ?? [];
        const text = it.replace(/^\s*\d+\.\s*/, "").replace(REEL_URL_G, "").replace(/\n\s*\n/g, "\n").trim();
        return (
          <li key={k} className="fp-card">
            <span className="fp-rank">{k + 1}</span>
            <div className="fp-card-text">
              <Markdown>{text}</Markdown>
              {urls.length > 1 && (
                <div className="fp-more">
                  {urls.slice(1).map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">Reel khác ↗</a>)}
                </div>
              )}
            </div>
            {urls[0] && <ReelPlayer url={urls[0]} compact />}
          </li>
        );
      })}
    </ol>
  );
}

function Overview({ body }) {
  const plain = body.replace(/\*\*/g, "");
  const pick = (re) => plain.match(re)?.[1];
  const unit = (re) => (plain.match(re)?.[1] ?? "reel").toLowerCase(); // Instagram reports say "bài"
  const tiles = [
    [pick(/phân tích\s+([\d.,]+)\s+(reel|bài)/i), `${unit(/phân tích\s+[\d.,]+\s+(reel|bài)/i)} đã phân tích`],
    [pick(/([\d.,]+)\s+(?:reel|bài) mỗi tuần/i), `${unit(/[\d.,]+\s+(reel|bài) mỗi tuần/i)} mỗi tuần`],
    [pick(/trung vị(?:\s+là)?\s+([\d.,]+)/i), "tương tác trung vị"],
    [pick(/([\d.,]+)\s+(?:reel|bài)\s+(?:đạt|vượt)/i), `${unit(/[\d.,]+\s+(reel|bài)\s+(?:đạt|vượt)/i)} viral (gấp 3 trung vị)`],
    [pick(/chia sẻ(?:\s+là)?\s+([\d.,]+)/i), "tổng lượt chia sẻ"],
  ].filter(([v]) => v);
  const period = plain.match(/từ\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+đến\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
  const rest = body.split(/\n\s*\n/).slice(tiles.length ? 1 : 0).join("\n\n");
  return (
    <>
      {tiles.length > 0 && (
        <div className="fp-kpis">
          {tiles.map(([v, label]) => (
            <div key={label} className="fp-kpi">
              <b>{v.replace(/[.,]$/, "")}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
      {period && <p className="fp-period">Dữ liệu từ <b>{period[1]}</b> đến <b>{period[2]}</b></p>}
      {rest && <Markdown>{rest}</Markdown>}
    </>
  );
}

export function DoDont({ body }) {
  const [, dos = "", donts = ""] = body.match(/\*\*Nên:?\*\*:?([\s\S]*?)\*\*Tránh:?\*\*:?([\s\S]*)/) ?? [];
  if (!dos && !donts) return <Markdown>{body}</Markdown>;
  return (
    <div className="fp-dodont">
      <div className="fp-do">
        <h4>Nên làm</h4>
        <Markdown>{dos.trim()}</Markdown>
      </div>
      <div className="fp-dont">
        <h4>Nên tránh</h4>
        <Markdown>{donts.trim()}</Markdown>
      </div>
    </div>
  );
}

/** Section body → tables as bar charts, numbered reel lists as cards, "### N." reels as player rows, the rest as Markdown. */
function Body({ body }) {
  if (/^###\s/m.test(body) && REEL_URL.test(body)) return <ReelsResult markdown={body} bare />;
  const paras = body.split(/\n\s*\n/);
  const out = [];
  let text = [];
  let items = [];
  const flush = () => {
    if (items.length) out.push(<ReelCards key={out.length} items={items} />), (items = []);
    if (text.length) out.push(<Markdown key={out.length}>{text.join("\n\n")}</Markdown>), (text = []);
  };
  for (const p of paras) {
    if (/^\s*\|/.test(p)) {
      flush();
      out.push(<BarTable key={out.length} block={p} />);
    } else if (/^\s*\d+\.\s/.test(p) && REEL_URL.test(p)) {
      if (text.length) out.push(<Markdown key={out.length}>{text.join("\n\n")}</Markdown>), (text = []);
      items.push(p);
    } else if (items.length && /^\s*\d+\.\s/.test(p)) {
      items.push(p); // numbered item without a link inside a reel list keeps its place
    } else {
      if (items.length) out.push(<ReelCards key={out.length} items={items} />), (items = []);
      text.push(p);
    }
  }
  flush();
  return out;
}

/** Fanpage analysis as a dashboard: one card per "## " section. */
export default function FanpageResult({ markdown, posts }) {
  const sections = String(markdown ?? "").replace(/\r\n?/g, "\n").split(/^(?=## )/m).filter((s) => s.trim());
  const byCode = posts?.length ? Object.fromEntries(posts.map((p) => [p.code, p])) : null; // Instagram cards
  return (
    <IgPostsContext.Provider value={byCode}>
    <div className="fp-dash">
      {sections.map((sec, i) => {
        const [first, ...lines] = sec.split("\n");
        const title = /^## /.test(first) ? first.replace(/^##\s*/, "") : null;
        const body = (title ? lines : [first, ...lines]).join("\n").trim();
        return (
          <section key={i} className="card fp-section md">
            {title && <h2 className="fp-title">{title}</h2>}
            {/tổng quan/i.test(title ?? "") ? <Overview body={body} /> : /nên học|nên tránh/i.test(title ?? "") ? <DoDont body={body} /> : <Body body={body} />}
          </section>
        );
      })}
    </div>
    </IgPostsContext.Provider>
  );
}
