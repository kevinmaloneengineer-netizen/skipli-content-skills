// Weekly charts of a followed competitor (the "Đối thủ" page): a Facebook channel or a Google Maps place.
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)));

/** Weekly trend of a watched channel: usual engagement per reel (line) and new reels per check (bars). */
export function Trend({ history = [] }) {
  if (history.length < 2) return <p className="trend-empty">Biểu đồ xu hướng hiện sau lần kiểm tra thứ 2.</p>;
  const W = 280, H = 70, pad = 6;
  const max = Math.max(1, ...history.map((h) => h.median ?? 0));
  const maxNew = Math.max(1, ...history.map((h) => h.fresh ?? 0));
  const x = (i) => pad + (i * (W - 2 * pad)) / (history.length - 1);
  const y = (v) => H - pad - ((v ?? 0) / max) * (H - 2 * pad - 10);
  const line = history.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h.median).toFixed(1)}`).join(" ");
  const last = history.at(-1).median ?? 0;
  const prev = history.at(-2).median ?? 0;
  const change = prev ? Math.round(((last - prev) / prev) * 100) : 0;
  const day = (iso) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tương tác trung vị qua ${history.length} lần kiểm tra`}>
        {history.map((h, i) => {
          const bh = ((h.fresh ?? 0) / maxNew) * 22;
          return <rect key={`b${i}`} className="trend-bar" x={x(i) - 4} y={H - pad - bh} width="8" height={bh} rx="2"><title>{`${day(h.at)}: ${h.fresh ?? 0} reel mới`}</title></rect>;
        })}
        <path className="trend-line" d={line} pathLength="1" />
        {history.map((h, i) => (
          <circle key={`d${i}`} className="trend-dot" cx={x(i)} cy={y(h.median)} r="3"><title>{`${day(h.at)}: tương tác trung vị ${short(h.median ?? 0)}${h.viral ? `, ${h.viral} reel viral` : ""}`}</title></circle>
        ))}
      </svg>
      <figcaption>
        <span>Tương tác thường gặp mỗi reel: <b>{short(last)}</b></span>
        {change !== 0 && <span className={change > 0 ? "up" : "down"}>{change > 0 ? "▲" : "▼"} {Math.abs(change)}% so với lần trước</span>}
        <span className="trend-key"><i className="k-line" />trung vị <i className="k-bar" />reel mới</span>
      </figcaption>
    </figure>
  );
}

/** Weekly trend of a watched Google Maps place: its stars (line) and new reviews per check (bars). */
export function RatingTrend({ history = [] }) {
  const points = history.filter((h) => h.rating != null);
  if (points.length < 2) return <p className="trend-empty">Biểu đồ số sao hiện sau lần kiểm tra thứ 2.</p>;
  const W = 280, H = 70, pad = 6;
  // Stars move by tenths: the scale is the range seen, not 0 to 5, or the line would look flat.
  const lo = Math.min(...points.map((h) => h.rating)) - 0.1;
  const hi = Math.max(...points.map((h) => h.rating)) + 0.1;
  const maxNew = Math.max(1, ...points.map((h) => h.fresh ?? 0));
  const x = (i) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad - 10);
  const line = points.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h.rating).toFixed(1)}`).join(" ");
  const last = points.at(-1);
  const change = Math.round((last.rating - points.at(-2).rating) * 10) / 10;
  const day = (iso) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const star = (n) => n.toFixed(1).replace(".", ",");
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Số sao qua ${points.length} lần kiểm tra`}>
        {points.map((h, i) => {
          const bh = ((h.fresh ?? 0) / maxNew) * 22;
          return <rect key={`b${i}`} className="trend-bar" x={x(i) - 4} y={H - pad - bh} width="8" height={bh} rx="2"><title>{`${day(h.at)}: ${h.fresh ?? 0} đánh giá mới${h.low ? `, ${h.low} bài 1-3 sao` : ""}`}</title></rect>;
        })}
        <path className="trend-line" d={line} pathLength="1" />
        {points.map((h, i) => (
          <circle key={`d${i}`} className="trend-dot" cx={x(i)} cy={y(h.rating)} r="3"><title>{`${day(h.at)}: ${star(h.rating)} sao, ${h.reviews} đánh giá`}</title></circle>
        ))}
      </svg>
      <figcaption>
        <span>Số sao: <b>{star(last.rating)}</b> · {last.reviews.toLocaleString("vi-VN")} đánh giá</span>
        {change !== 0 && <span className={change > 0 ? "up" : "down"}>{change > 0 ? "▲" : "▼"} {star(Math.abs(change))} so với lần trước</span>}
        <span className="trend-key"><i className="k-line" />số sao <i className="k-bar" />đánh giá mới</span>
      </figcaption>
    </figure>
  );
}

