import { useEffect, useState } from "react";
import { BackLink } from "../components/SkillShell.jsx";
import { useAuth } from "../components/AuthGate.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { ago } from "../lib/format.js";

/** Admin: create customer accounts, see their usage, set daily limits, lock or reset a password. */
export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", dailyLimit: "" });
  const [error, setError] = useState("");
  const load = () => api("/admin/users").then(setData, (e) => setError(e.message));
  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/users", { method: "POST", body: { ...form, dailyLimit: form.dailyLimit || null } });
      toast(`Đã tạo tài khoản ${form.email}. Gửi email và mật khẩu cho khách để đăng nhập.`);
      setForm({ email: "", name: "", password: "", dailyLimit: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function update(u, patch, done) {
    try {
      await api(`/admin/users/${u.id}`, { method: "PUT", body: patch });
      if (done) toast(done);
      load();
    } catch (err) {
      toast(err.message, { kind: "error" });
    }
  }
  const suggest = () => setForm((f) => ({ ...f, password: Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("") }));

  if (user?.role !== "admin") return <div className="narrow"><BackLink /><p className="empty">Chỉ quản trị viên mới xem được trang này.</p></div>;
  return (
    <div className="admin">
      <BackLink />
      <header className="plain-head">
        <h1>Quản lý tài khoản</h1>
        <p>Mỗi khách có tài khoản riêng và chỉ thấy dữ liệu của mình. Giới hạn mặc định {data?.defaultLimit ?? "…"} lượt chạy mỗi ngày.</p>
      </header>

      <form className="form-card admin-create" onSubmit={create}>
        <h2>Tạo tài khoản cho khách</h2>
        <div className="admin-grid">
          <label className="field"><span className="field-label">Email</span><input type="email" value={form.email} onChange={set("email")} placeholder="owner@phocali.com" required /></label>
          <label className="field"><span className="field-label">Tên quán hoặc tên khách</span><input value={form.name} onChange={set("name")} placeholder="Phở Cali" /></label>
          <label className="field">
            <span className="field-label admin-pass-label">Mật khẩu (từ 8 ký tự)<button type="button" className="link-btn" onClick={suggest}>Tạo ngẫu nhiên</button></span>
            <input value={form.password} onChange={set("password")} minLength={8} required />
          </label>
          <label className="field"><span className="field-label">Lượt chạy mỗi ngày</span><input type="number" min="0" max="1000" value={form.dailyLimit} onChange={set("dailyLimit")} placeholder={`Mặc định ${data?.defaultLimit ?? 30}`} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary">Tạo tài khoản</button>
      </form>

      <section className="card admin-table-card">
        <h2>{data?.users.length ?? 0} tài khoản</h2>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Tài khoản</th><th>Hôm nay</th><th>Tổng lượt</th><th>Giới hạn/ngày</th><th>Đăng nhập gần nhất</th><th /></tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className={u.disabled ? "is-off" : undefined}>
                  <td><b>{u.name || u.email}</b><small>{u.email}{u.role === "admin" ? " · Quản trị" : ""}{u.disabled ? " · Đã khoá" : ""}</small></td>
                  <td>{u.today}</td>
                  <td>{u.jobs}</td>
                  <td>
                    {u.role === "admin" ? "Không giới hạn" : (
                      <input className="admin-limit" type="number" min="0" max="1000" defaultValue={u.dailyLimit ?? ""} placeholder={String(data.defaultLimit)} aria-label={`Giới hạn của ${u.email}`}
                        onBlur={(e) => String(u.dailyLimit ?? "") !== e.target.value && update(u, { dailyLimit: e.target.value === "" ? null : Number(e.target.value) }, "Đã lưu giới hạn")} />
                    )}
                  </td>
                  <td>{u.lastLoginAt ? ago(u.lastLoginAt) : "Chưa đăng nhập"}</td>
                  <td><div className="admin-actions">
                    <button type="button" className="btn small" onClick={() => { const p = window.prompt(`Mật khẩu mới cho ${u.email} (ít nhất 8 ký tự):`); if (p) update(u, { password: p }, "Đã đặt lại mật khẩu"); }}>Đặt lại mật khẩu</button>
                    {u.role !== "admin" && <button type="button" className={u.disabled ? "btn small" : "btn small danger"} onClick={() => update(u, { disabled: !u.disabled }, u.disabled ? "Đã mở khoá" : "Đã khoá tài khoản")}>{u.disabled ? "Mở khoá" : "Khoá"}</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
