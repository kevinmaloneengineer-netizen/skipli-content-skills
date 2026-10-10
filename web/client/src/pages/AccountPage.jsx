import { useState } from "react";
import { BackLink } from "../components/SkillShell.jsx";
import { useAuth } from "../components/AuthGate.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";

export default function AccountPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.next !== form.again) return setError("Hai lần nhập mật khẩu mới không khớp");
    try {
      await api("/me/password", { method: "PUT", body: { current: form.current, next: form.next } });
      setForm({ current: "", next: "", again: "" });
      toast("Đã đổi mật khẩu. Các thiết bị khác sẽ phải đăng nhập lại.");
    } catch (err) {
      setError(err.message);
    }
  }
  if (!user) return <div className="narrow"><BackLink /><p className="empty">Web chưa bật tài khoản riêng.</p></div>;
  return (
    <div className="narrow">
      <BackLink />
      <header className="plain-head">
        <h1>Tài khoản</h1>
        <p>{user.name ? `${user.name} · ` : ""}{user.email}</p>
      </header>
      <form className="form-card" onSubmit={submit}>
        <h2>Đổi mật khẩu</h2>
        <label className="field"><span className="field-label">Mật khẩu hiện tại</span><input type="password" value={form.current} onChange={set("current")} autoComplete="current-password" required /></label>
        <div className="row">
          <label className="field"><span className="field-label">Mật khẩu mới (ít nhất 8 ký tự)</span><input type="password" value={form.next} onChange={set("next")} autoComplete="new-password" minLength={8} required /></label>
          <label className="field"><span className="field-label">Nhập lại mật khẩu mới</span><input type="password" value={form.again} onChange={set("again")} autoComplete="new-password" required /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary">Đổi mật khẩu</button>
      </form>
    </div>
  );
}
