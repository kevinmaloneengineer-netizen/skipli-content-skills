import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { skillByType } from "../lib/constants.js";
import { safeHref } from "../lib/safeUrl.js";
import { useJobs } from "../context/JobsContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { BackLink } from "../components/SkillShell.jsx";
import { RatingTrend, Trend } from "../components/WatchTrend.jsx";

const KINDS = { facebook: "Facebook", maps: "Google Maps", instagram: "Instagram", yelp: "Yelp" };
const FILTERS = [["all", "Tất cả"], ["watch", "Đang theo dõi"], ["facebook", "Facebook"], ["maps", "Google Maps"], ["other", "Instagram, Yelp"]];
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");

/** What can be run next on a competitor, by where it lives. */
function nextRuns(c) {
  const url = encodeURIComponent(c.url ?? "");
  if (c.kind === "facebook") return [[`/fanpage?url=${url}`, "Phân tích fanpage"], [`/fb?url=${url}`, "Quét reel"], [`/clone?url=${url}`, "Nhân bản kênh"]];
  if (c.kind === "maps") return [[`/maps?place=${c.url ? url : encodeURIComponent(c.name)}`, "Phân tích review"], ["/review-compare", "So sánh với quán khác"]];
  if (c.kind === "instagram") return [["/instagram", "Phân tích lại"]];
  return [["/yelp", "Phân tích lại"]];
}

function RivalCard({ c, onChange, canFollow }) {
  const toast = useToast();
  const { refresh } = useJobs();
  const [busy, setBusy] = useState("");
  const w = c.watch;
  const followable = !w && (c.kind === "facebook" || (c.kind === "maps" && /^https:\/\//.test(c.url ?? "")));
  async function act(name, fn, done) {
    setBusy(name);
    try {
      await fn();
      if (done) toast(done);
      await onChange();
      refresh?.();
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setBusy("");
    }
  }
  const follow = () => act("follow", () => api("/watch", { method: "POST", body: { url: c.url, ...(c.kind === "maps" ? { name: c.name } : {}) } }), "Đã theo dõi. Hệ thống đọc lại mỗi tuần và báo ở chuông.");
  const check = () => act("check", () => api(`/watch/${w.id}/check`, { method: "POST" }));
  const unfollow = () => act("unfollow", () => api(`/watch/${w.id}`, { method: "DELETE" }), "Đã bỏ theo dõi.");
  return (
    <article className={w ? "rival is-watched" : "rival"} data-kind={c.kind}>
      <header className="rival-head">
        <span className="rival-kind">{KINDS[c.kind]}</span>
        {w && <span className="rival-live">● Theo dõi mỗi tuần</span>}
        <h2>{c.url ? <a href={safeHref(c.url)} target="_blank" rel="noopener noreferrer">{c.name}</a> : c.name}</h2>
        <small>
          {w ? (w.lastCheckedAt ? `Kiểm tra lần cuối ${day(w.lastCheckedAt)}` : "Đang đọc lần đầu…") : `Phân tích gần nhất ${day(c.lastAt)}`}
          {w?.lastError ? ` · lỗi: ${w.lastError}` : ""}
        </small>
      </header>

      {w && (w.kind === "maps" ? <RatingTrend history={w.history} /> : <Trend history={w.history} />)}

      {c.events.length > 0 && (
        <div className="rival-block">
          <h3>Mới phát hiện</h3>
          <ol className="rival-events">
            {c.events.map((e) => (
              <li key={e.id}><Link to={`/jobs/${e.id}`}><time>{day(e.createdAt)}</time>{e.title.replace(/^Theo dõi (sao )?·?\s*/, "")}</Link></li>
            ))}
          </ol>
        </div>
      )}

      {c.runs.length > 0 && (
        <div className="rival-block">
          <h3>Đã phân tích {c.runs.length} lần</h3>
          <ul className="rival-runs">
            {c.runs.map((r) => (
              <li key={r.id}><Link to={`/jobs/${r.id}`}><span>{skillByType(r.type)?.short ?? r.type}</span><time>{day(r.createdAt)}</time></Link></li>
            ))}
          </ul>
        </div>
      )}

      <footer className="rival-actions">
        {nextRuns(c).map(([to, label]) => <Link key={to} className="btn small" to={to}>{label}</Link>)}
        {followable && <button type="button" className="btn small primary" disabled={!!busy || !canFollow} title={canFollow ? undefined : "Đã đủ số đối thủ theo dõi"} onClick={follow}>{busy === "follow" ? "Đang thêm…" : "🔔 Theo dõi mỗi tuần"}</button>}
        {w && <button type="button" className="btn small" disabled={!!busy} onClick={check}>{busy === "check" ? "Đang kiểm tra…" : "Kiểm tra ngay"}</button>}
        {w && <button type="button" className="btn small ghost" disabled={!!busy} onClick={unfollow}>Bỏ theo dõi</button>}
      </footer>
    </article>
  );
}

/** Every competitor the user looked at, one card each: followed ones first, with their weekly charts. */
export default function CompetitorsPage() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const load = () => api("/competitors").then(setData, () => setData({ competitors: [], maxWatch: 0 }));
  useEffect(() => {
    load();
  }, []);
  const list = data?.competitors ?? [];
  const watched = list.filter((c) => c.watch).length;
  const shown = list.filter((c) => filter === "all" || (filter === "watch" ? c.watch : filter === "other" ? c.kind === "instagram" || c.kind === "yelp" : c.kind === filter));
  const news = list.reduce((a, c) => a + c.events.filter((e) => Date.parse(e.createdAt) > Date.now() - 7 * 86_400_000).length, 0);
  return (
    <div className="rivals">
      <BackLink />
      <section className="hist-hero rivals-hero">
        <div className="hist-hero-text">
          <span className="hist-kicker">Đối thủ</span>
          <h1>Mọi đối thủ bạn đang để mắt tới</h1>
          <p>Gom từ các lần quét reel, phân tích fanpage, review Google Maps, Yelp, Instagram và các kênh đang theo dõi.</p>
        </div>
        <div className="hist-stats">
          <div><b>{list.length}</b><span>đối thủ</span></div>
          <div><b>{watched}{data?.maxWatch ? <small>/{data.maxWatch}</small> : null}</b><span>theo dõi mỗi tuần</span></div>
          <div><b>{news}</b><span>tin mới 7 ngày qua</span></div>
          <div><b>{list.reduce((a, c) => a + c.runs.length, 0)}</b><span>lần phân tích</span></div>
        </div>
      </section>

      <div className="hist-chips rivals-filter" role="group" aria-label="Lọc đối thủ">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? "on" : undefined} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {!data ? (
        <p className="rivals-empty">Đang tải…</p>
      ) : !list.length ? (
        <section className="card rivals-empty">
          <h2>Chưa có đối thủ nào</h2>
          <p>Phân tích một fanpage, quét reel hoặc đọc review Google Maps của quán đối thủ: họ sẽ hiện ở đây, kèm nút theo dõi mỗi tuần.</p>
          <div className="actions">
            <Link className="btn primary" to="/fanpage">Phân tích fanpage</Link>
            <Link className="btn" to="/maps">Review Google Maps</Link>
            <Link className="btn" to="/nearby">Đối thủ quanh quán</Link>
          </div>
        </section>
      ) : (
        <div className="rivals-grid">
          {shown.map((c) => <RivalCard key={c.key} c={c} onChange={load} canFollow={watched < (data.maxWatch || Infinity)} />)}
          {!shown.length && <p className="rivals-empty">Không có đối thủ nào trong mục này.</p>}
        </div>
      )}
    </div>
  );
}
