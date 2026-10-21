import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ago } from "../lib/format.js";
import { useToast } from "../context/ToastContext.jsx";
import { skillByType } from "../lib/constants.js";

const kb = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SOURCE = { server: "Máy chủ", job: "Tác vụ", browser: "Trình duyệt", backup: "Sao lưu", billing: "Thanh toán" };

/** Sign-up and credit settings, saved in the database: they apply at once, no restart. */
function Settings() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const load = () => api("/admin/settings").then((d) => {
    setData(d);
    setForm({ ...d.settings });
  }, (e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/settings", { method: "PUT", body: { signupPerIp: Number(form.signupPerIp), trialCredits: Number(form.trialCredits), heavyPerUser: Number(form.heavyPerUser), creditPacks: form.creditPacks } });
      toast("Đã lưu cài đặt, áp dụng ngay");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  if (!form) return <section className="card admin-ops"><h2>Cài đặt đăng ký và credit</h2>{error ? <p className="form-error">{error}</p> : <p className="hint">Đang tải…</p>}</section>;
  return (
    <form className="card admin-ops" onSubmit={save}>
      <h2>Cài đặt đăng ký và credit</h2>
      <p className="hint">{data.signupOpen ? "Áp dụng ngay cho người đăng ký và nạp tiền tiếp theo." : "Tự đăng ký đang tắt (SIGNUP=1 trong deploy/.env để bật)."}</p>
      <div className="row">
        <label className="field"><span className="field-label">Tài khoản dùng thử mỗi IP</span><input type="number" min="0" max="1000" value={form.signupPerIp} onChange={set("signupPerIp")} /><small className="hint">0 = không giới hạn</small></label>
        <label className="field"><span className="field-label">Credit tặng khi đăng ký</span><input type="number" min="0" max="10000" value={form.trialCredits} onChange={set("trialCredits")} /></label>
        <label className="field"><span className="field-label">Tác vụ nặng cùng lúc mỗi tài khoản</span><input type="number" min="0" max="20" value={form.heavyPerUser} onChange={set("heavyPerUser")} /><small className="hint">Video, ảnh AI, chỉnh ảnh, cắt reels, lồng tiếng. 0 = không giới hạn. Mặc định {data.defaults.heavyPerUser}.</small></label>
      </div>
      <label className="field">
        <span className="field-label">Gói nạp (credit:giá theo cent, cách nhau bằng dấu phẩy)</span>
        <input value={form.creditPacks} onChange={set("creditPacks")} placeholder={data.defaults.creditPacks} />
        <small className="hint">Ví dụ 100:900 là 100 credit giá $9.00. Mặc định: {data.defaults.creditPacks}</small>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-ops-foot">
        <button className="btn primary">Lưu cài đặt</button>
        {data.updatedAt && <small className="hint">Sửa lần cuối {ago(data.updatedAt)}</small>}
      </div>
    </form>
  );
}

/** Server crashes, failed jobs and browser errors, newest first. */
function Errors() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api("/admin/errors").then(setData, () => setData({ errors: [] }));
  useEffect(() => {
    load();
  }, []);
  async function clear() {
    await api("/admin/errors", { method: "DELETE" });
    toast("Đã xoá nhật ký lỗi");
    load();
  }
  return (
    <section className="card admin-ops">
      <div className="admin-ops-head">
        <h2>Lỗi gần đây <small>{data?.errors.length ?? 0}</small></h2>
        <div>
          <button type="button" className="btn small" onClick={load}>Tải lại</button>
          {data?.errors.length > 0 && <button type="button" className="btn small" onClick={clear}>Xoá hết</button>}
        </div>
      </div>
      <p className="hint">{data?.webhook ? "Lỗi mới cũng được báo về kênh chat (ERROR_WEBHOOK_URL)." : "Muốn nhận báo lỗi qua Slack hoặc Discord: đặt ERROR_WEBHOOK_URL trong deploy/.env."}</p>
      {data && data.errors.length === 0 && <p className="empty">Chưa có lỗi nào. 🎉</p>}
      <ul className="admin-errors">
        {data?.errors.map((e) => (
          <li key={e.id} data-source={e.source}>
            <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span className="admin-error-tag">{SOURCE[e.source] ?? e.source}{e.type ? ` · ${e.type}` : ""}</span>
              <b>{e.message}</b>
              <small>{ago(e.createdAt)}{e.path ? ` · ${e.path}` : ""}</small>
            </button>
            {open === e.id && (
              <div className="admin-error-more">
                {e.jobId && <a href={`/jobs/${e.jobId}`}>Mở tác vụ →</a>}
                {e.stack && <pre>{e.stack}</pre>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Daily database backups in the storage bucket; one can be made now. */
function Backups() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api("/admin/backups").then(setData, () => setData({ enabled: false, backups: [] }));
  useEffect(() => {
    load();
  }, []);
  async function now() {
    setBusy(true);
    try {
      const out = await api("/admin/backups", { method: "POST" });
      toast(`Đã sao lưu ${out.key} (${kb(out.bytes)})`);
      load();
    } catch (err) {
      toast(err.message, { kind: "error" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card admin-ops">
      <div className="admin-ops-head">
        <h2>Sao lưu dữ liệu</h2>
        {data?.enabled && <button type="button" className="btn small" onClick={now} disabled={busy}>{busy ? "Đang sao lưu…" : "Sao lưu ngay"}</button>}
      </div>
      <p className="hint">{data?.enabled ? `Tự sao lưu toàn bộ dữ liệu mỗi ngày lên bucket lưu trữ, giữ ${data.keepDays} ngày gần nhất. Khôi phục: node scripts/restore-backup.mjs <tên file> --confirm` : "Chưa cấu hình lưu trữ (STORAGE_* trong deploy/.env) nên chưa sao lưu được."}</p>
      {data?.enabled && data.backups.length === 0 && <p className="empty">Chưa có bản sao lưu nào.</p>}
      <ul className="admin-backups">
        {data?.backups.map((b) => (
          <li key={b.key}><code>{b.key}</code><span>{kb(b.size)}</span><small>{b.at ? ago(b.at) : ""}</small></li>
        ))}
      </ul>
    </section>
  );
}

const money = (cents, currency = "usd") => (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });

/** Money: top-ups, refunds through the bank, credits spent per tool and a rough running cost. */
function Revenue() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/admin/stats").then(setD, (e) => setError(e.message));
  }, []);
  if (!d) return <section className="card admin-ops"><h2>Doanh thu và chi phí</h2>{error ? <p className="form-error">{error}</p> : <p className="hint">Đang tải…</p>}</section>;
  const cur = d.currency;
  const max = Math.max(1, ...d.daily.map((x) => x.amount));
  const earned = d.tools.reduce((a, t) => a + t.earnedCents, 0);
  const label = (type) => skillByType(type)?.short ?? (type === "video-restyle" ? "Đổi mẫu video" : type);
  return (
    <section className="card admin-ops revenue">
      <h2>Doanh thu và chi phí</h2>
      <div className="rev-stats">
        <div><b>{money(d.revenue.net, cur)}</b><span>doanh thu thực</span><small>{money(d.revenue.gross, cur)} đã thu{d.revenue.disputed ? ` · ${money(d.revenue.disputed, cur)} bị đòi lại` : ""}</small></div>
        <div><b>{d.revenue.payers}</b><span>khách đã nạp</span><small>trên {d.revenue.members} tài khoản · {d.revenue.payments} lần nạp</small></div>
        <div><b>{d.credits.sold.toLocaleString("vi-VN")}</b><span>credit đã bán</span><small>{d.credits.centsPerCredit ? `${money(d.credits.centsPerCredit, cur)} mỗi credit · ` : ""}khách còn {d.credits.balance.toLocaleString("vi-VN")} credit</small></div>
        <div><b>${d.cost.usd.toFixed(2)}</b><span>chi phí ước tính</span><small>model + GPU trên {d.cost.jobs} tác vụ gần nhất</small></div>
      </div>
      <div className="rev-chart" aria-label="Doanh thu 30 ngày">
        {d.daily.map((x) => (
          <span key={x.day} title={`${x.day.slice(8)}/${x.day.slice(5, 7)}: ${money(x.amount, cur)} (${x.count} lần nạp)`}>
            <i style={{ height: `${(x.amount / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <small className="hint">Doanh thu từng ngày, 30 ngày qua (rê chuột để xem số).</small>
      <div className="table-wrap">
        <table className="admin-table rev-table">
          <thead>
            <tr><th>Công cụ</th><th>Lượt chạy</th><th>Credit đã trừ</th><th>Thu ước tính</th><th>Chi phí ước tính</th><th>Token</th></tr>
          </thead>
          <tbody>
            {d.tools.slice(0, 20).map((t) => (
              <tr key={t.type}>
                <td>{label(t.type)}</td>
                <td>{t.runs}{t.failed ? <small className="hint"> · {t.failed} lỗi</small> : null}</td>
                <td>{t.credits}</td>
                <td>{money(t.earnedCents, cur)}</td>
                <td>${t.costUsd.toFixed(3)}</td>
                <td>{t.tokens.toLocaleString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="hint">
        Thu ước tính = credit đã trừ × giá trung bình một credit ({money(earned, cur)} tổng). Chi phí ước tính: model ${d.cost.tokenUsdPerM}/1 triệu token, GPU khoảng ${d.cost.gpuUsd.video} mỗi video và ${d.cost.gpuUsd.image} mỗi ảnh AI; số thật xem trên hoá đơn Groq và GPU.
      </small>
      {d.recent.length > 0 && (
        <>
          <h3 className="rev-sub">Lần nạp gần nhất</h3>
          <ul className="rev-recent">
            {d.recent.map((p, i) => (
              <li key={i}>
                <span>{p.email || "?"}</span>
                <b>{money(p.amount, p.currency)}</b>
                <small>{p.credits} credit · {ago(p.at)}{p.disputed ? (p.disputeClosed === "won" ? " · đòi lại, quán thắng" : " · khách đòi lại qua ngân hàng") : ""}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function AdminOps() {
  return (
    <>
      <Revenue />
      <Settings />
      <Errors />
      <Backups />
    </>
  );
}
