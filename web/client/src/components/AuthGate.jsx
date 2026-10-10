import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext({ mode: "open", user: null });

/** Who is signed in: { mode: "open" | "password" | "accounts", user: { id, email, name, role } | null }. */
export const useAuth = () => useContext(AuthContext);

/**
 * Login before the app: one shared password (APP_PASSWORD), or one account per customer (ACCOUNTS=1,
 * with a one-time screen that creates the admin). The app renders only once signed in.
 */
export default function AuthGate({ children }) {
  const [session, setSession] = useState(null); // null while checking
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api("/session").then(setSession, () => setSession({ mode: "open", signedIn: true }));
  useEffect(() => {
    load();
    const out = () => load();
    window.addEventListener("auth-required", out);
    return () => window.removeEventListener("auth-required", out);
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (session.mode === "accounts" && session.setup) await api("/setup", { method: "POST", body: form });
      else if (session.mode === "accounts") await api("/login", { method: "POST", body: { email: form.email, password: form.password } });
      else await api("/login", { method: "POST", body: { password: form.password } });
      setForm({ email: "", password: "", name: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;
  if (session.signedIn) return <AuthContext.Provider value={{ mode: session.mode, user: session.user ?? null }}>{children}</AuthContext.Provider>;

  const accounts = session.mode === "accounts";
  const setup = accounts && session.setup;
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/assistant/wave.png" alt="" className="login-mascot" onError={(e) => (e.currentTarget.hidden = true)} />
        <h1>Skipli Content</h1>
        <p>{setup ? "Lần đầu sử dụng: tạo tài khoản quản trị. Tài khoản này tạo và quản lý tài khoản cho khách." : accounts ? "Đăng nhập bằng tài khoản được cấp." : "Nhập mật khẩu để dùng các công cụ AI viết content cho quán."}</p>
        {setup && (
          <label className="field">
            <span className="field-label">Tên của bạn</span>
            <input value={form.name} onChange={set("name")} autoComplete="name" />
          </label>
        )}
        {accounts && (
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" value={form.email} onChange={set("email")} autoComplete="username" autoFocus required />
          </label>
        )}
        <label className="field">
          <span className="field-label">Mật khẩu{setup ? " (ít nhất 8 ký tự)" : ""}</span>
          <input type="password" value={form.password} onChange={set("password")} autoComplete={setup ? "new-password" : "current-password"} autoFocus={!accounts} minLength={setup ? 8 : undefined} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !form.password || (accounts && !form.email)}>{busy ? "Đang xử lý…" : setup ? "Tạo tài khoản quản trị" : "Đăng nhập"}</button>
        <small>{accounts && !setup ? "Quên mật khẩu? Liên hệ quản trị viên để đặt lại." : "Phiên đăng nhập giữ trong 30 ngày trên trình duyệt này."}</small>
      </form>
    </main>
  );
}

export async function logout() {
  await api("/logout", { method: "POST" }).catch(() => {});
  window.dispatchEvent(new Event("auth-required"));
}
