import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ago } from "../lib/format.js";
import { useToast } from "../context/ToastContext.jsx";

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
      await api("/admin/settings", { method: "PUT", body: { signupPerIp: Number(form.signupPerIp), trialCredits: Number(form.trialCredits), creditPacks: form.creditPacks } });
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
        <label className="field"><span className="field-label">Tài khoản dùng thử mỗi IP</span><input type="number" min="0" max="1000" value={form.signupPerIp} onChange={set("signupPerIp")} /><small className="hint">0 = không giới hạn (chỉ nên dùng khi test)</small></label>
        <label className="field"><span className="field-label">Credit tặng khi đăng ký</span><input type="number" min="0" max="10000" value={form.trialCredits} onChange={set("trialCredits")} /></label>
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

export default function AdminOps() {
  return (
    <>
      <Settings />
      <Errors />
      <Backups />
    </>
  );
}
