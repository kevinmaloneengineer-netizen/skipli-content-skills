import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useSearchParams } from "react-router-dom";
import { Segmented } from "../components/Form.jsx";
import { JobRow } from "../components/JobBits.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { SKILLS } from "../lib/constants.js";
import { BackLink } from "../components/SkillShell.jsx";

const FILTERS = { "": "Tất cả", ...Object.fromEntries(SKILLS.filter((s) => s.type).map((s) => [s.type, s.short])) };

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
    <section className="ai-health card">
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
function Watchlist() {
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
    } finally {
      setBusy(null);
    }
  }
  async function remove(id) {
    await api(`/watch/${id}`, { method: "DELETE" });
    load();
  }
  return (
    <section className="watchlist card">
      <h2>Đang theo dõi đối thủ</h2>
      <p className="hint">Mỗi tuần hệ thống đọc lại các kênh này. Có reel mới thì báo ở chuông và thêm vào lịch sử.</p>
      <ul>
        {items.map((w) => (
          <li key={w.id}>
            <a href={w.url} target="_blank" rel="noopener noreferrer"><b>@{w.name}</b></a>
            <small>
              {w.lastCheckedAt ? `Kiểm tra lần cuối ${new Date(w.lastCheckedAt).toLocaleString("vi-VN")}` : "Đang đọc lần đầu…"}
              {w.lastError ? ` · lỗi: ${w.lastError}` : typeof w.lastNew === "number" && w.lastCheckedAt ? ` · lần trước có ${w.lastNew} reel mới` : ""}
            </small>
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

export default function HistoryPage() {
  const { jobs, loaded } = useJobs();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "";
  const list = jobs.filter((j) => !type || j.type === type);

  return (
    <div className="narrow">
      <BackLink />
      <header className="plain-head">
        <h1>Lịch sử</h1>
        <p>Mọi lần chạy, mới nhất trước. Kết quả được lưu lại, bấm vào để xem, chạy lại hoặc viết tiếp.</p>
      </header>
      <AiHealth />
      <Watchlist />
      <div className="toolbar">
        <Segmented name="type" label="Lọc theo công cụ" options={FILTERS} value={type} onChange={(v) => setParams(v ? { type: v } : {})} />
      </div>
      <div className="job-list">
        {loaded && list.length === 0 && <div className="empty">Chưa có lần chạy nào.</div>}
        {list.map((j) => (
          <JobRow key={j.id} job={j} showSkill={!type} />
        ))}
      </div>
    </div>
  );
}
