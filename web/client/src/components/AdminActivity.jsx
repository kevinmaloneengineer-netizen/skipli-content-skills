import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { STATUS, skillByType } from "../lib/constants.js";
import { ago, duration } from "../lib/format.js";

const seconds = (ms) => (ms == null ? "—" : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`);

const label = (type) => (type === "combo" ? "Gói chạy liền" : type === "menu-scan" ? "Chụp menu giấy" : skillByType(type)?.title ?? type);

/**
 * Admin: who ran which tool, when, and how it went (credits, time, kind of failure), to help a customer who
 * says a run broke and to spot abuse. What the customer typed and the results are never shown.
 */
export default function AdminActivity({ users }) {
  const [filter, setFilter] = useState({ user: "", type: "", status: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams({ limit: "200", ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) });
    api(`/admin/activity?${q}`).then((d) => (setData(d), setError("")), (e) => setError(e.message));
  }, [filter]);
  const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));
  const who = Object.fromEntries((users ?? []).map((u) => [u.id, u.name || u.contact]));
  const rows = data?.rows ?? [];
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <>
    <SkillStats />
    <section className="card admin-table-card admin-activity">
      <h2>Hoạt động gần đây</h2>
      <p className="admin-activity-note">Công cụ khách đã chạy, lúc nào và kết quả ra sao. Không hiện nội dung khách nhập hay kết quả họ nhận.</p>
      <div className="admin-filters">
        <label className="field"><span className="field-label">Tài khoản</span>
          <select value={filter.user} onChange={set("user")}>
            <option value="">Tất cả</option>
            {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name || u.contact}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Công cụ</span>
          <select value={filter.type} onChange={set("type")}>
            <option value="">Tất cả</option>
            {(data?.types ?? []).map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Trạng thái</span>
          <select value={filter.status} onChange={set("status")}>
            <option value="">Tất cả</option>
            {["done", "failed", "canceled", "running", "queued"].map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {data && (
        <p className="admin-activity-sum">
          {rows.length >= 200 ? "200 lần chạy mới nhất" : `${rows.length} lần chạy`}{failed ? ` · ${failed} lỗi` : ""}{data.oldest ? ` · dữ liệu từ ${new Date(data.oldest).toLocaleDateString("vi-VN")}` : ""}
        </p>
      )}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Lúc</th><th>Tài khoản</th><th>Công cụ</th><th>Trạng thái</th><th>Credit</th><th>Thời gian chạy</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td title={new Date(r.createdAt).toLocaleString("vi-VN")}>{ago(r.createdAt)}</td>
                <td>{who[r.userId] ?? "Tài khoản đã xoá"}</td>
                <td>{label(r.type)}</td>
                <td><span className={`act-status act-${r.status}`}>{STATUS[r.status] ?? r.status}</span>{r.error && <small>{r.error}</small>}</td>
                <td>{r.credits ? `${r.credits}${r.refunded ? " · đã hoàn" : ""}` : "—"}</td>
                <td>{r.startedAt ? duration(r.startedAt, r.finishedAt) : "—"}</td>
              </tr>
            ))}
            {data && !rows.length && <tr><td colSpan={6} className="admin-activity-empty">Chưa có lần chạy nào khớp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    </>
  );
}

/** Per tool, 7 or 30 days: which ones people use, which ones break, what they bring in. */
function SkillStats() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/admin/skill-stats?days=${days}`).then((d) => (setData(d), setError("")), (e) => setError(e.message));
  }, [days]);
  const rows = data?.rows ?? [];
  const total = rows.reduce((a, r) => ({ runs: a.runs + r.runs, failed: a.failed + r.failed, credits: a.credits + r.credits }), { runs: 0, failed: 0, credits: 0 });
  return (
    <section className="card admin-table-card admin-activity">
      <div className="skill-stats-head">
        <h2>Thống kê theo công cụ</h2>
        <div className="seg" role="radiogroup" aria-label="Khoảng thời gian">
          {[7, 30].map((d) => <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? "on" : undefined} onClick={() => setDays(d)}>{`${d} ngày`}</button>)}
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {data && (
        <p className="admin-activity-sum">
          {`${total.runs} lần chạy · ${total.runs ? Math.round((total.failed / total.runs) * 100) : 0}% lỗi · ${total.credits} credit đã thu`}{data.partial ? ` · chỉ tính từ ${new Date(data.oldest).toLocaleDateString("vi-VN")} (1000 lần chạy gần nhất)` : ""}
        </p>
      )}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Công cụ</th><th>Lần chạy</th><th>Tỉ lệ lỗi</th><th>Người dùng</th><th>Credit đã thu</th><th>Thời gian thường</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = r.runs ? Math.round((r.failed / r.runs) * 100) : 0;
              return (
                <tr key={r.type}>
                  <td>{label(r.type)}</td>
                  <td>{r.runs}</td>
                  <td className={rate >= 20 ? "act-failed" : undefined}>{rate}%{r.failed ? <small>{`${r.failed} lần lỗi`}</small> : null}</td>
                  <td>{r.users}</td>
                  <td>{r.credits || "—"}</td>
                  <td>{seconds(r.medianMs)}</td>
                </tr>
              );
            })}
            {data && !rows.length && <tr><td colSpan={6} className="admin-activity-empty">{`Chưa có lần chạy nào trong ${days} ngày qua.`}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
