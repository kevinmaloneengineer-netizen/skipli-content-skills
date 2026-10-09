import { useState } from "react";
import Markdown from "./Markdown.jsx";
import { ReelPlayer } from "./ReelsResult.jsx";

const COLORS = ["#e25d33", "#2f5bd3", "#2e8f5b"];
const MEDALS = ["🥇", "🥈", "🥉"];
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n * 10) / 10));

/** Five axes, each scored against the best page (1 = best). viralRate = share of reels that went viral. */
const AXES = [
  ["perWeek", "Đăng đều"],
  ["median", "Tương tác thường"],
  ["viral", "Số reel viral"],
  ["viralRate", "Tỉ lệ viral"],
  ["max", "Reel đỉnh"],
];
const METRICS = [
  ["perWeek", "Reel mỗi tuần", "đăng đều tay"],
  ["median", "Tương tác trung vị", "một reel bình thường đạt"],
  ["viral", "Reel viral", "vượt 3 lần mức trung vị"],
  ["max", "Reel tốt nhất", "tương tác cao nhất"],
];

function scored(pages) {
  const withRate = pages.map((p) => ({ ...p, viralRate: p.reels ? p.viral / p.reels : 0 }));
  const max = Object.fromEntries(AXES.map(([k]) => [k, Math.max(1e-9, ...withRate.map((p) => p[k] ?? 0))]));
  return withRate
    .map((p, i) => {
      const axes = AXES.map(([k]) => (p[k] ?? 0) / max[k]);
      return { ...p, color: COLORS[i], axes, score: Math.round((axes.reduce((a, b) => a + b, 0) / axes.length) * 100), wins: AXES.filter(([k]) => (p[k] ?? 0) === max[k] && max[k] > 1e-9).map(([, label]) => label) };
    })
    .map((p, _, all) => ({ ...p, rank: [...all].sort((a, b) => b.score - a.score).indexOf(p) }));
}

/** Pentagon radar: one translucent shape per page. */
function Radar({ pages }) {
  const size = 300;
  const c = size / 2;
  const r = 88;
  const point = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const ring = (v) => AXES.map((_, i) => point(i, v).join(",")).join(" ");
  return (
    <svg className="cmp-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ radar so sánh các kênh">
      {[0.25, 0.5, 0.75, 1].map((v) => <polygon key={v} points={ring(v)} className="cmp-radar-ring" />)}
      {AXES.map(([, label], i) => {
        const [x, y] = point(i, 1);
        const [lx, ly] = point(i, 1.22);
        return (
          <g key={label}>
            <line x1={c} y1={c} x2={x} y2={y} className="cmp-radar-axis" />
            <text x={lx} y={ly} textAnchor={Math.abs(lx - c) < 8 ? "middle" : lx > c ? "start" : "end"} dominantBaseline="middle" className="cmp-radar-label">{label}</text>
          </g>
        );
      })}
      {pages.map((p) => (
        <polygon key={p.url} points={p.axes.map((v, i) => point(i, Math.max(0.04, v)).join(",")).join(" ")} style={{ fill: p.color, stroke: p.color }} className="cmp-radar-shape" />
      ))}
    </svg>
  );
}

/**
 * A page's best reels, one at a time. Facebook refuses to embed some reels (owner turned embedding
 * off, often for licensed music) and the page cannot tell from outside, so the user can switch.
 */
function TopReels({ reels }) {
  const [i, setI] = useState(0);
  const r = reels[i];
  if (!r) return <div className="cmp-top" />;
  return (
    <div className="cmp-top">
      <div className="cmp-top-head">
        <small>Reel tốt nhất #{i + 1} · {fmt(r.engagement)} tương tác</small>
        {reels.length > 1 && (
          <span className="cmp-top-tabs" role="tablist" aria-label="Chọn reel">
            {reels.map((x, k) => (
              <button key={x.url} type="button" role="tab" aria-selected={k === i} className={k === i ? "on" : undefined} onClick={() => setI(k)}>{k + 1}</button>
            ))}
          </span>
        )}
      </div>
      <ReelPlayer key={r.url} url={r.url} compact />
      <p>{r.caption}</p>
      {reels.length > 1 && <small className="cmp-top-hint">Video báo “Không khả dụng” là do chủ reel tắt nhúng: bấm số khác để xem reel tiếp theo.</small>}
    </div>
  );
}

/** Side-by-side comparison drawn from job.compare (numbers computed on the server), then the AI's notes. */
export default function CompareResult({ job }) {
  const raw = (job.compare ?? []).filter((p) => !p.error);
  if (raw.length < 2) return <Markdown className="card md">{job.result}</Markdown>;
  const pages = scored(raw);
  const podium = [...pages].sort((a, b) => a.rank - b.rank);
  const failed = (job.compare ?? []).filter((p) => p.error);

  return (
    <div className="cmp">
      <section className="card cmp-hero">
        <div className="cmp-podium">
          {podium.map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="cmp-rank" data-rank={p.rank} style={{ "--c": p.color }}>
              <span className="cmp-medal" aria-hidden="true">{MEDALS[p.rank]}</span>
              <span className="cmp-avatar" aria-hidden="true">{p.name[0].toUpperCase()}</span>
              <b>@{p.name}</b>
              <span className="cmp-score"><strong>{p.score}</strong>/100 điểm tổng hợp</span>
              {p.wins.length > 0 ? (
                <span className="cmp-wins">{p.wins.map((w) => <i key={w}>★ {w}</i>)}</span>
              ) : (
                <span className="cmp-wins muted">Chưa dẫn đầu chỉ số nào</span>
              )}
            </a>
          ))}
        </div>
        <div className="cmp-radar-box">
          <Radar pages={pages} />
          <ul className="cmp-radar-legend">
            {pages.map((p) => <li key={p.url} style={{ "--c": p.color }}><i />@{p.name}</li>)}
          </ul>
          <small>Mỗi trục so với kênh tốt nhất ở chỉ số đó. Hình càng to, kênh càng mạnh.</small>
        </div>
      </section>

      <section className="card cmp-board">
        <h2>Số liệu chi tiết</h2>
        <div className="cmp-metrics">
          {METRICS.map(([key, label, hint]) => {
            const max = Math.max(1, ...pages.map((p) => p[key] ?? 0));
            const best = pages.reduce((a, p) => ((p[key] ?? 0) > (a[key] ?? 0) ? p : a), pages[0]);
            return (
              <div key={key} className="cmp-metric">
                <h3>{label}<small>{hint}</small></h3>
                {pages.map((p) => (
                  <div key={p.url} className="cmp-bar" style={{ "--c": p.color }}>
                    <span>@{p.name}</span>
                    <i><em style={{ width: `${((p[key] ?? 0) / max) * 100}%` }} /></i>
                    <b>{fmt(p[key] ?? 0)}{p === best && (p[key] ?? 0) > 0 && <span className="cmp-crown" title="Cao nhất">★</span>}</b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="cmp-habits">
        {pages.map((p) => (
          <article key={p.url} className="card cmp-habit" style={{ "--c": p.color }}>
            <h3><span className="cmp-avatar small" aria-hidden="true">{p.name[0].toUpperCase()}</span>@{p.name}</h3>
            <ul>
              <li><span aria-hidden="true">📅</span><small>Ngày hiệu quả</small><b>{p.bestDay}</b></li>
              <li><span aria-hidden="true">🕐</span><small>Khung giờ</small><b>{p.bestTime}</b></li>
              <li><span aria-hidden="true">⏱</span><small>Độ dài video</small><b>{p.bestLength}</b></li>
            </ul>
            <p className="cmp-tags">{p.hashtags?.length ? p.hashtags.map((t) => <i key={t}>{t}</i>) : <span>Không dùng hashtag</span>}</p>
            <TopReels reels={p.top ?? []} />
          </article>
        ))}
      </section>
      {failed.length > 0 && <p className="cmp-failed">Không đọc được: {failed.map((p) => `@${p.name}`).join(", ")}.</p>}

      <Markdown className="card md cmp-notes">{job.result}</Markdown>
    </div>
  );
}
