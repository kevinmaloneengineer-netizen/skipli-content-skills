import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Link, useSearchParams } from "react-router-dom";
import { Segmented } from "../components/Form.jsx";
import { StatusBadge } from "../components/JobBits.jsx";
import SkillArt from "../components/SkillArt.jsx";
import { CountUp } from "../components/CountUp.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { ACTIVE, SKILLS, skillByType } from "../lib/constants.js";
import { duration } from "../lib/format.js";
import { BackLink } from "../components/SkillShell.jsx";
import { businessOf } from "../lib/handoff.js";
import { safeHref } from "../lib/safeUrl.js";

/** A picture the run made (photo fix, AI image, video still), for the row thumbnail (the list sends it as `thumb`). */
const thumbOf = (j) => j.thumb ?? j.photos?.items?.[0]?.file ?? j.images?.items?.[0]?.file ?? j.video?.shots?.find((s) => s.image)?.image ?? j.slides?.find((s) => s.image)?.image ?? null;
/** The restaurant a run was about, tidied for grouping ("Phở Cali " and "phở cali" are one). */
const shopOf = (j) => businessOf(j).trim().replace(/\s+/g, " ").slice(0, 60);
const shopKey = (name) => name.toLowerCase();


/** How the free AI pipeline is holding up: how reels were analysed, how often Groq had to retry. */
function AiHealth() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api("/ai-stats").then(setStats, () => {});
  }, []);
  if (!stats || (!stats.watched.total && !stats.groq.jobs)) return null;
  const pct = (n, total) => (total ? `${Math.round((n / total) * 100)}%` : "0%");
  const w = stats.watched;
  return (
    <section className="ai-health aside-card">
      <h2>Tình trạng AI</h2>
      <div className="ai-health-grid">
        {w.total > 0 && (
          <div>
            <b>{pct(w.video, w.total)}</b>
            <span>reel/video AI xem được cả hình và tiếng</span>
            <small>{w.video} video · {w.speech} chỉ nghe lời thoại · {w.caption} chỉ có caption · trung bình {w.avgSeconds}s mỗi video</small>
          </div>
        )}
        {stats.groq.jobs > 0 && (
          <div>
            <b>{pct(stats.groq.jobs - stats.groq.retried, stats.groq.jobs)}</b>
            <span>lần gọi AI trả lời ngay lần đầu</span>
            <small>{stats.groq.retried}/{stats.groq.jobs} lần phải đổi model vì hết lượt, {stats.groq.waited} lần phải chờ</small>
          </div>
        )}
        <div>
          <b>{stats.failed.total}</b>
          <span>lần chạy lỗi</span>
          <small>{stats.failed.rateLimit} lần do hết lượt miễn phí</small>
        </div>
      </div>
    </section>
  );
}

/** Competitor channels being followed, with a manual re-check. */
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)));

/** Weekly trend of a watched channel: usual engagement per reel (line) and new reels per check (bars). */
function Trend({ history = [] }) {
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
function RatingTrend({ history = [] }) {
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

function Watchlist() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);
  const { refresh } = useJobs();
  const load = () => api("/watch").then(({ items }) => setItems(items), () => setItems([]));
  useEffect(() => {
    load();
  }, []);
  if (!items?.length) return null;
  async function check(id) {
    setBusy(id);
    try {
      await api(`/watch/${id}/check`, { method: "POST" });
      await load();
      refresh?.();
    } catch (e) {
      toast(e.message, { kind: "error" });
      load(); // the error is shown on the item too
    } finally {
      setBusy(null);
    }
  }
  async function remove(id) {
    await api(`/watch/${id}`, { method: "DELETE" });
    load();
  }
  return (
    <section className="watchlist aside-card">
      <h2>Đang theo dõi đối thủ</h2>
      <p className="hint">Mỗi tuần hệ thống đọc lại các kênh và quán này. Có reel mới hay đánh giá mới thì báo ở chuông và thêm vào lịch sử.</p>
      <ul>
        {items.map((w) => (
          <li key={w.id}>
            <a href={safeHref(w.url)} target="_blank" rel="noopener noreferrer"><b>{w.kind === "maps" ? `★ ${w.name}` : `@${w.name}`}</b></a>
            <small>
              {w.lastCheckedAt ? `Kiểm tra lần cuối ${new Date(w.lastCheckedAt).toLocaleString("vi-VN")}` : "Đang đọc lần đầu…"}
              {w.lastError ? ` · lỗi: ${w.lastError}` : typeof w.lastNew === "number" && w.lastCheckedAt ? ` · lần trước có ${w.lastNew} ${w.kind === "maps" ? "đánh giá" : "reel"} mới` : ""}
            </small>
            {w.kind === "maps" ? <RatingTrend history={w.history} /> : <Trend history={w.history} />}
            <span className="watch-actions">
              <button type="button" className="btn small" disabled={busy === w.id} onClick={() => check(w.id)}>{busy === w.id ? "Đang kiểm tra…" : "Kiểm tra ngay"}</button>
              <button type="button" className="btn small ghost" onClick={() => remove(w.id)}>Bỏ theo dõi</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Jobs the weekly watch records ("watch": new reels, "rating-watch": a place's stars), counted under their skill.
const WATCH_TYPES = new Set(["watch", "rating-watch"]);
const ofSkill = (j, type) => j.type === type || (type === "fb-reels" && j.type === "watch") || (type === "maps" && j.type === "rating-watch");

const DAY = 86_400_000;
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const secondsOf = (j) => (j.startedAt && j.finishedAt ? Math.max(0, (Date.parse(j.finishedAt) - Date.parse(j.startedAt)) / 1000) : 0);

function dayTitle(ts, today) {
  const diff = Math.round((today - ts) / DAY);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  const d = new Date(ts);
  const wd = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][d.getDay()];
  return `${wd}, ${d.getDate()}/${d.getMonth() + 1}${d.getFullYear() !== new Date(today).getFullYear() ? `/${d.getFullYear()}` : ""}`;
}

/** Dark summary band: totals and the last 14 days as bars (done vs failed). */
function Overview({ jobs }) {
  const today = dayStart(new Date());
  const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);
  const [hover, setHover] = useState(-1);
  const per = days.map((d) => {
    const list = jobs.filter((j) => dayStart(new Date(j.createdAt)) === d);
    const count = (st) => list.filter((j) => j.status === st).length;
    const bySkill = {};
    for (const j of list) {
      const name = WATCH_TYPES.has(j.type) ? "Theo dõi đối thủ" : skillByType(j.type)?.short ?? j.type;
      bySkill[name] = (bySkill[name] ?? 0) + 1;
    }
    return {
      d, total: list.length, done: count("done"), failed: count("failed"), canceled: count("canceled"), other: list.length - count("done"),
      top: Object.entries(bySkill).sort((a, b) => b[1] - a[1]).slice(0, 3),
      minutes: Math.round(list.reduce((a, j) => a + secondsOf(j), 0) / 60),
    };
  });
  /** Bar click: scroll the list to that day. */
  const goTo = (d) => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const max = Math.max(1, ...per.map((p) => p.done + p.other));
  const finished = jobs.filter((j) => j.status === "done" || j.status === "failed");
  const ok = finished.length ? Math.round((finished.filter((j) => j.status === "done").length / finished.length) * 100) : 0;
  const week = jobs.filter((j) => Date.parse(j.createdAt) >= today - 6 * DAY).length;
  const minutes = Math.round(jobs.reduce((a, j) => a + secondsOf(j), 0) / 60);
  return (
    <section className="hist-hero">
      <div className="hist-hero-text">
        <span className="hist-kicker">Lịch sử</span>
        <h1>Mọi việc AI đã làm cho bạn</h1>
        <p>Kết quả được lưu lại. Bấm vào để xem, chạy lại hoặc viết tiếp.</p>
      </div>
      <div className="hist-stats">
        <div><b><CountUp value={jobs.length} /></b><span>lần chạy</span></div>
        <div><b><CountUp value={week} /></b><span>trong 7 ngày</span></div>
        <div><b><CountUp value={ok} suffix="%" /></b><span>thành công</span></div>
        <div><b><CountUp value={minutes} /></b><span>phút AI làm việc</span></div>
      </div>
      <div className="hist-legend" aria-hidden="true">
        <span>Số lần chạy mỗi ngày, 14 ngày qua</span>
        <span><i className="k-done" />Hoàn tất</span>
        <span><i className="k-fail" />Lỗi hoặc huỷ</span>
        <span><i className="k-today" />Hôm nay</span>
      </div>
      <div className={hover >= 0 ? "hist-chart is-hovering" : "hist-chart"} aria-label="Số lần chạy 14 ngày qua" onMouseLeave={() => setHover(-1)}>
        {per.map((p, i) => (
          <button
            type="button"
            key={p.d}
            className={[p.d === today && "is-today", hover === i && "is-hover"].filter(Boolean).join(" ") || undefined}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(-1)}
            onClick={() => p.total && goTo(p.d)}
            aria-label={`${dayTitle(p.d, today)}: ${p.done} xong, ${p.other} lỗi hoặc huỷ`}
          >
            <b>{p.total || ""}</b>
            <span className="hist-bar" style={{ "--h": p.total / max, "--f": p.total ? `${(p.other / p.total) * 100}%` : "0%", animationDelay: `${i * 30}ms` }} />
            <small>{i % 2 === 1 || p.d === today ? new Date(p.d).getDate() : ""}</small>
            {hover === i && (
              <span className={["hist-tip", i < 3 && "at-left", i > 10 && "at-right"].filter(Boolean).join(" ")} role="tooltip">
                <strong>{dayTitle(p.d, today)}{dayTitle(p.d, today).startsWith("Hôm") ? `, ${new Date(p.d).getDate()}/${new Date(p.d).getMonth() + 1}` : ""}</strong>
                {p.total ? (
                  <>
                    <span className="hist-tip-big"><em>{p.total}</em> lần chạy{p.minutes ? ` · ${p.minutes} phút` : ""}</span>
                    <span className="hist-tip-bar" aria-hidden="true">
                      <i style={{ flex: p.done }} className="k-done" />
                      {p.failed > 0 && <i style={{ flex: p.failed }} className="k-fail" />}
                      {p.canceled > 0 && <i style={{ flex: p.canceled }} className="k-cancel" />}
                    </span>
                    <span className="hist-tip-rows">
                      <span><i className="k-done" />Hoàn tất<b>{p.done}</b></span>
                      {p.failed > 0 && <span><i className="k-fail" />Lỗi<b>{p.failed}</b></span>}
                      {p.canceled > 0 && <span><i className="k-cancel" />Huỷ<b>{p.canceled}</b></span>}
                    </span>
                    {p.top.length > 0 && <span className="hist-tip-top">Dùng nhiều: {p.top.map(([n, c]) => `${n} (${c})`).join(", ")}</span>}
                    <small className="hist-tip-hint">Bấm để xem danh sách ngày này</small>
                  </>
                ) : (
                  <span className="hist-tip-empty">Không có lần chạy nào</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Skills used the most, as a clickable ranking (sets the skill filter). */
function TopSkills({ jobs, onPick, active }) {
  const counts = SKILLS.filter((s) => s.type)
    .map((s) => ({ s, n: jobs.filter((j) => ofSkill(j, s.type)).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  if (!counts.length) return null;
  const max = counts[0].n;
  return (
    <section className="aside-card hist-top">
      <h2>Dùng nhiều nhất</h2>
      <ol>
        {counts.map(({ s, n }) => (
          <li key={s.type} data-tone={s.tone}>
            <button type="button" className={active === s.type ? "on" : undefined} onClick={() => onPick(active === s.type ? "" : s.type)}>
              <span className="hist-top-name">{s.short}</span>
              <b>{n}</b>
              <i><em style={{ width: `${(n / max) * 100}%` }} /></i>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HistoryRow({ job }) {
  const { refresh } = useJobs();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const skill = skillByType(job.type);
  const time = new Date(job.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const secs = secondsOf(job);
  // The server refuses to delete a run that is still going; watch rows belong to the watchlist.
  const deletable = !WATCH_TYPES.has(job.type) && !["queued", "running"].includes(job.status);
  async function remove() {
    setBusy(true);
    try {
      await api(`/jobs/${job.id}`, { method: "DELETE" });
      refresh?.();
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
    <div className={deletable ? "hist-row has-del" : "hist-row"} data-tone={skill?.tone} data-status={job.status}>
      <Link className="hist-open" to={`/jobs/${job.id}`}>
        {thumbOf(job) ? (
          <span className="hist-thumb is-photo" aria-hidden="true"><img src={`/media/images/${thumbOf(job)}`} alt="" loading="lazy" /></span>
        ) : (
          <span className="hist-thumb" aria-hidden="true"><SkillArt id={skill?.id} /></span>
        )}
        <span className="hist-row-main">
          <span className="hist-row-skill">{WATCH_TYPES.has(job.type) ? "Theo dõi đối thủ" : skill?.short}{shopOf(job) && <em className="hist-row-shop">{shopOf(job)}</em>}</span>
          <span className="hist-row-title">{job.title}</span>
          {job.status === "failed" && job.error && <span className="hist-row-err">{job.error.slice(0, 120)}</span>}
        </span>
        <span className="hist-row-side">
          <StatusBadge status={job.status} />
          <small>{time}{secs ? ` · ${duration(job.startedAt, job.finishedAt)}` : ""}</small>
        </span>
        <i className="hist-go" aria-hidden="true">→</i>
      </Link>
      {deletable && (
        <button type="button" className="hist-del" onClick={() => setAsking(true)} disabled={busy} aria-label="Xoá lần chạy này" title="Xoá lần chạy này">{busy ? "…" : "×"}</button>
      )}
    </div>
    {asking && (
      <ConfirmDialog
        title="Xoá lần chạy này?"
        body="Video đã dựng (nếu có) cũng sẽ bị xoá."
        okLabel="Xoá"
        onOk={remove}
        onClose={() => setAsking(false)}
      />
    )}
    </>
  );
}

const STATUS_FILTERS = { "": "Tất cả", done: "Hoàn tất", active: "Đang chạy", failed: "Lỗi" };

export default function HistoryPage() {
  const { jobs, loaded } = useJobs();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "";
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [shop, setShop] = useState("");
  const setType = (v) => setParams(v ? { type: v } : {});

  const used = SKILLS.filter((s) => s.type && jobs.some((j) => ofSkill(j, s.type)));
  // Restaurants named in the runs (the business / name / place typed in each form), most used first.
  const shops = Object.values(
    jobs.reduce((acc, j) => {
      const name = shopOf(j);
      if (name) (acc[shopKey(name)] ??= { key: shopKey(name), name, n: 0 }).n++;
      return acc;
    }, {}),
  ).sort((a, b) => b.n - a.n);
  const q = query.trim().toLowerCase();
  const list = jobs.filter(
    (j) =>
      (!type || ofSkill(j, type)) &&
      (!status || (status === "active" ? ACTIVE.has(j.status) : status === "failed" ? j.status === "failed" || j.status === "canceled" : j.status === status)) &&
      (!shop || shopKey(shopOf(j)) === shop) &&
      (!q || j.title.toLowerCase().includes(q)),
  );
  const today = dayStart(new Date());
  const groups = [];
  for (const j of list) {
    const d = dayStart(new Date(j.createdAt));
    if (groups.at(-1)?.d !== d) groups.push({ d, jobs: [] });
    groups.at(-1).jobs.push(j);
  }

  return (
    <div className="hist">
      <BackLink />
      <Overview jobs={jobs} />
      <div className="hist-layout">
        <div className="hist-main">
          <div className="hist-tools">
            <label className="hist-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên quán, chủ đề, link…" aria-label="Tìm trong lịch sử" />
            </label>
            {shops.length > 0 && (
              <select className="hist-shop" value={shop} onChange={(e) => setShop(e.target.value)} aria-label="Lọc theo quán">
                <option value="">Mọi quán</option>
                {shops.map((x) => <option key={x.key} value={x.key}>{x.name} ({x.n})</option>)}
              </select>
            )}
            <Segmented name="status" label="Lọc theo trạng thái" options={STATUS_FILTERS} value={status} onChange={setStatus} />
          </div>
          <div className="hist-chips" role="group" aria-label="Lọc theo công cụ">
            <button type="button" className={!type ? "on" : undefined} onClick={() => setType("")}>Tất cả <small>{jobs.length}</small></button>
            {used.map((s) => (
              <button key={s.type} type="button" data-tone={s.tone} className={type === s.type ? "on" : undefined} onClick={() => setType(type === s.type ? "" : s.type)}>
                <i aria-hidden="true" />{s.short} <small>{jobs.filter((j) => ofSkill(j, s.type)).length}</small>
              </button>
            ))}
          </div>

          {loaded && list.length === 0 && (
            <div className="hist-empty">
              <b>{jobs.length ? "Không có lần chạy nào khớp bộ lọc" : "Chưa có lần chạy nào"}</b>
              <span>{jobs.length ? "Thử bỏ bớt bộ lọc hoặc đổi từ khoá." : "Chọn một công cụ ở trang chủ để bắt đầu."}</span>
              {jobs.length > 0 ? <button type="button" className="btn small" onClick={() => { setStatus(""); setQuery(""); setShop(""); setType(""); }}>Xoá bộ lọc</button> : <Link className="btn primary small" to="/">Xem các công cụ</Link>}
            </div>
          )}
          {groups.map((g) => (
            <section key={g.d} id={`day-${g.d}`} className="hist-day">
              <h2><span>{dayTitle(g.d, today)}</span><small>{g.jobs.length} lần chạy</small></h2>
              <div className="hist-rows">
                {g.jobs.map((j) => <HistoryRow key={j.id} job={j} />)}
              </div>
            </section>
          ))}
        </div>
        <aside className="hist-aside">
          <TopSkills jobs={jobs} onPick={setType} active={type} />
          <AiHealth />
          <Watchlist />
        </aside>
      </div>
    </div>
  );
}
