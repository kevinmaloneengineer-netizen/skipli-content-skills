import Markdown from "./Markdown.jsx";
import { Link } from "react-router-dom";
import { DoDont, parseTable, toNumber } from "./FanpageResult.jsx";
import { CountUp } from "./CountUp.jsx";

/** Link to the review replier with this review filled in. */
const replyLink = (text, stars, business) => `/review?${new URLSearchParams({ review: text, ...(stars ? { stars: String(stars) } : {}), ...(business ? { business } : {}) })}`;

const STAR = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";

/** Five stars filled to the rating (4,3 → four full stars and a 30% one). */
function Stars({ value, size = 22 }) {
  return (
    <span className="mp-stars" style={{ "--s": `${size}px` }} aria-label={`${value} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="mp-star">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} /></svg>
          <span style={{ width: `${Math.max(0, Math.min(1, value - i)) * 100}%` }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} /></svg>
          </span>
        </span>
      ))}
    </span>
  );
}

const sections = (md) =>
  Object.fromEntries(
    String(md ?? "")
      .replace(/\r\n?/g, "\n")
      .split(/^(?=## )/m)
      .map((s) => {
        const [first, ...rest] = s.split("\n");
        return /^## /.test(first) ? [first.replace(/^##\s*/, "").trim(), rest.join("\n").trim()] : ["", s.trim()];
      }),
  );
const find = (secs, re) => Object.entries(secs).find(([k]) => re.test(k))?.[1] ?? "";

/** "| Điểm khen | Số bài |" rows + `- "quote" (5 sao)` bullets. */
function themesOf(body) {
  const table = parseTable(body.split(/\n\s*\n/).find((p) => /^\s*\|/.test(p)) ?? "");
  const themes = table ? table.body.map((r) => ({ label: r[0].replace(/\*\*/g, ""), n: toNumber(r[table.valueCol]) ?? 0 })) : [];
  const quotes = [...body.matchAll(/^\s*[-*]\s*["“](.+?)["”]\s*\(?(\d)?\s*sao?\)?\s*$/gm)].map((m) => ({ text: m[1].replace(/\*\*|__/g, ""), stars: Number(m[2]) || null })); // quotes show as plain text: drop bold markers
  return { themes, quotes };
}

/** Scorecard numbers: from the job (collected by the server), else read back from the report. */
function placeOf(job, secs) {
  if (job.place) return job.place;
  const overview = find(secs, /tổng quan/i);
  const [, name, rating, total] = overview.match(/^(.+?) được ([\d,.]+) sao trên ([\d.,]+)/) ?? [];
  const table = parseTable(find(secs, /phân bố/i));
  const starCounts = table ? Object.fromEntries(table.body.map((r) => [parseInt(r[0], 10), toNumber(r[table.valueCol])])) : {};
  return { name: name ?? job.input?.place ?? "", rating: rating ?? "", total: total ?? "", starCounts };
}

function Scorecard({ place, summary, site }) {
  const rating = toNumber(place.rating) ?? 0;
  const counts = [5, 4, 3, 2, 1].map((n) => Number(place.starCounts?.[n]) || 0);
  const hasCounts = counts.some(Boolean); // the histogram comes from the Maps page; it can be missing
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(1, ...counts);
  const pos = (counts[0] + counts[1]) / sum;
  const mid = counts[2] / sum;
  const neg = (counts[3] + counts[4]) / sum;
  const pct = (x) => `${Math.round(x * 100)}%`;
  return (
    <section className="card mp-score">
      <div className="mp-rating">
        <span className="mp-kicker">Điểm {site}</span>
        <b className="mp-big">{rating ? <CountUp value={rating} decimals={String(place.rating).includes(",") || String(place.rating).includes(".") ? 1 : 0} /> : "?"}</b>
        <Stars value={rating} />
        <span className="mp-total">
          {place.total ? `${place.total} đánh giá` : ""}
          {place.readLow != null ? ` · đã đọc ${place.readLow} bài ít sao nhất và ${place.readHigh} bài nhiều sao nhất` : place.read ? ` · đã đọc ${place.read} bài gần nhất` : ""}
        </span>
        <h2 className="mp-name">{place.name}</h2>
        {place.address && <p className="mp-addr">{place.address.replace(/[\ue000-\uf8ff]/g, "").trim()}</p>}
        {place.url && <a className="mp-link" href={place.url} target="_blank" rel="noopener noreferrer">Mở trên {site} ↗</a>}
        {place.url && site === "Yelp" && <small className="mp-hint">Yelp có thể chặn truy cập từ Việt Nam (lỗi 403): bật VPN đặt ở Mỹ để mở.</small>}
      </div>
      {!hasCounts && (
        <div className="mp-sides">
          <div data-k="neg"><b>{place.readLow ?? 0}</b><span>bài ít sao nhất</span><small>AI đọc để tìm điều khách chê</small></div>
          <div data-k="pos"><b>{place.readHigh ?? 0}</b><span>bài nhiều sao nhất</span><small>AI đọc để tìm điều khách khen</small></div>
        </div>
      )}
      {hasCounts && <div className="mp-hist" aria-label="Phân bố số sao">
        {counts.map((c, i) => (
          <div key={i} className="mp-hist-row" data-star={5 - i}>
            <span>{5 - i}</span>
            <i><em style={{ width: `${(c / max) * 100}%` }} /></i>
            <small>{c.toLocaleString("vi-VN")}</small>
          </div>
        ))}
      </div>}
      {hasCounts && <div className="mp-mood">
        <div className="mp-donut" style={{ "--pos": `${pos * 360}deg`, "--mid": `${(pos + mid) * 360}deg` }}>
          <span><b><CountUp value={Math.round(pos * 100)} suffix="%" /></b><small>hài lòng</small></span>
        </div>
        <ul className="mp-legend">
          <li data-k="pos"><i /><span>Hài lòng<small>4 đến 5 sao</small></span><b>{pct(pos)}</b></li>
          <li data-k="mid"><i /><span>Bình thường<small>3 sao</small></span><b>{pct(mid)}</b></li>
          <li data-k="neg"><i /><span>Chưa hài lòng<small>1 đến 2 sao</small></span><b>{pct(neg)}</b></li>
        </ul>
      </div>}
      {summary && <p className="mp-summary">{summary}</p>}
    </section>
  );
}

function ThemeColumn({ kind, title, data, business }) {
  const max = Math.max(1, ...data.themes.map((t) => t.n));
  return (
    <section className="card mp-col" data-kind={kind}>
      <header>
        <span className="mp-col-icon" aria-hidden="true">{kind === "good" ? "👍" : "👎"}</span>
        <h2>{title}</h2>
        <small>{data.themes.reduce((a, t) => a + t.n, 0)} lượt nhắc</small>
      </header>
      <ol className="mp-themes">
        {data.themes.map((t, i) => (
          <li key={i}>
            <span className="mp-theme-label">{t.label}</span>
            <b>{t.n}</b>
            <span className="mp-theme-bar"><em style={{ width: `${(t.n / max) * 100}%` }} /></span>
          </li>
        ))}
      </ol>
      {data.quotes.length > 0 && (
        <div className="mp-quotes">
          {data.quotes.map((q, i) => (
            <blockquote key={i} className="mp-quote">
              {q.stars && <Stars value={q.stars} size={13} />}
              <p>{q.text}</p>
              {kind === "bad" && <Link className="mp-reply" to={replyLink(q.text, q.stars, business)}>Soạn trả lời →</Link>}
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}

/** "- Nên: …" / "- Tránh: …" bullets → the "**Nên:** … **Tránh:** …" shape DoDont splits into two columns. */
function toDoDont(body) {
  if (/\*\*Nên/.test(body)) return body;
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const pick = (re) => lines.filter((l) => re.test(l)).map((l) => `- ${l.replace(/^[-*]\s*/, "").replace(re, "").trim()}`);
  const dos = pick(/^(?:[-*]\s*)?Nên(?: học)?\s*:\s*/i);
  const donts = pick(/^(?:[-*]\s*)?(?:Tránh|Nên tránh)\s*:\s*/i);
  return dos.length || donts.length ? `**Nên:**\n${dos.join("\n")}\n\n**Tránh:**\n${donts.join("\n")}` : body;
}

/** Google Maps review analysis: scorecard, praise vs complaints side by side, opportunities, do and don't. */
export default function MapsResult({ job }) {
  const secs = sections(job.result);
  const place = placeOf(job, secs);
  const overview = find(secs, /tổng quan/i);
  const summary = overview.split(/(?<=\.)\s+/).slice(2).join(" ").trim() || overview.split(/(?<=\.)\s+/).slice(1).join(" ").trim();
  const good = themesOf(find(secs, /khen/i));
  const bad = themesOf(find(secs, /chê/i));
  const chances = [...find(secs, /cơ hội/i).matchAll(/^\s*(?:[-*]|\d+\.)\s+(.+)$/gm)].map((m) => m[1]);
  const doDont = find(secs, /nên học|nên tránh/i);
  const known = /tổng quan|phân bố|khen|chê|cơ hội|nên học|nên tránh/i;
  const extra = Object.entries(secs).filter(([k, v]) => k && !known.test(k) && v);

  if (!good.themes.length && !bad.themes.length) return <Markdown className="card md">{job.result}</Markdown>;
  return (
    <div className="mp">
      {place.read > 0 && place.read < 15 && (
        <p className="mp-warn">Google chỉ cho xem {place.read} đánh giá gần đây nên phân tích khen/chê chưa đầy đủ. Phân bố số sao vẫn tính trên toàn bộ {place.total} đánh giá.</p>
      )}
      <Scorecard place={place} summary={summary} site={place.site ?? (job.type === "yelp" ? "Yelp" : "Google Maps")} />
      <div className="mp-cols">
        <ThemeColumn kind="good" title="Khách khen gì" data={good} business={place.name} />
        <ThemeColumn kind="bad" title="Khách chê gì" data={bad} business={place.name} />
      </div>
      {job.lowReviews?.length > 0 && (
        <section className="card mp-replies">
          <header>
            <h2>Trả lời các đánh giá chưa hài lòng</h2>
            <p>Trả lời khéo review xấu giúp khách mới tin quán hơn. Bấm một bài để AI soạn sẵn 3 cách trả lời.</p>
          </header>
          <ul>
            {job.lowReviews.map((r, i) => (
              <li key={i}>
                <div className="mp-reply-meta">
                  {r.stars && <Stars value={r.stars} size={13} />}
                  {r.when && <small>{r.when.split("-").reverse().join("/")}</small>}
                  {r.ownerReplied && <small className="mp-replied">Quán đã trả lời</small>}
                </div>
                <p>{r.text}</p>
                <Link className="btn small" to={replyLink(r.text, r.stars, place.name)}>Soạn trả lời</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {chances.length > 0 && (
        <section className="card mp-chances">
          <h2>Cơ hội cho quán của bạn</h2>
          <ol>
            {chances.map((c, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <Markdown>{c}</Markdown>
              </li>
            ))}
          </ol>
        </section>
      )}
      {doDont && (
        <section className="card md fp-section">
          <h2 className="fp-title">Nên học và nên tránh</h2>
          <DoDont body={toDoDont(doDont)} />
        </section>
      )}
      {extra.map(([k, v]) => (
        <section key={k} className="card md fp-section">
          <h2 className="fp-title">{k}</h2>
          <Markdown>{v}</Markdown>
        </section>
      ))}
    </div>
  );
}
