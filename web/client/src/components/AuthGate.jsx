import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

const AuthContext = createContext({ mode: "open", user: null, signedIn: true, guest: false });

/**
 * Who is signed in: { mode: "open" | "password" | "accounts", user, signedIn, guest, setup, reload }.
 * guest = a login is required (APP_PASSWORD or ACCOUNTS=1) and nobody is signed in yet.
 */
export const useAuth = () => useContext(AuthContext);

/** The login page, remembering where to come back to. */
export const loginPath = (next) => (next && next !== "/" && !next.startsWith("/login") ? `/login?next=${encodeURIComponent(next)}` : "/login");

/**
 * Reads the session once. A guest can see the home page and the sample results; the tools, history
 * and library ask for a login first (RequireAuth). When the session ends while using the app (an API
 * answers 401), the login page opens and comes back to the same page afterwards.
 */
export default function AuthGate({ children }) {
  const [session, setSession] = useState(null); // null while checking
  const navigate = useNavigate();
  const load = useCallback(() => api("/session").then(setSession, () => setSession({ mode: "open", signedIn: true })), []);

  useEffect(() => {
    load();
    const out = () => {
      setSession((s) => (s && s.mode !== "open" ? { ...s, signedIn: false, user: null } : s));
      const here = window.location.pathname + window.location.search;
      if (!here.startsWith("/login")) navigate(loginPath(here), { replace: true });
    };
    window.addEventListener("auth-required", out);
    return () => window.removeEventListener("auth-required", out);
  }, [load, navigate]);

  if (!session) return null;
  const guest = session.mode !== "open" && !session.signedIn;
  const value = { mode: session.mode, user: session.user ?? null, signedIn: !guest, guest, setup: !!session.setup, reload: load };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Route wrapper: a guest is sent to the login page, then back here once signed in. */
export function RequireAuth() {
  const { guest } = useAuth();
  const { pathname, search } = useLocation();
  if (guest) return <Navigate to={loginPath(pathname + search)} replace />;
  return <Outlet />;
}

/** /login: one shared password (APP_PASSWORD) or an account (ACCOUNTS=1); the first account is the admin. */
export function LoginPage() {
  const { mode, guest, setup, reload } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const next = new URLSearchParams(search).get("next");
  const back = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!guest) return <Navigate to={back} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const accounts = mode === "accounts";
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (accounts && setup) await api("/setup", { method: "POST", body: form });
      else if (accounts) await api("/login", { method: "POST", body: { email: form.email, password: form.password } });
      else await api("/login", { method: "POST", body: { password: form.password } });
      setForm({ email: "", password: "", name: "" });
      await reload();
      navigate(back, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/assistant/wave.png" alt="" className="login-mascot" onError={(e) => (e.currentTarget.hidden = true)} />
        <h1>Skipli Content</h1>
        <p>{setup ? "Lần đầu sử dụng: tạo tài khoản quản trị. Tài khoản này tạo và quản lý tài khoản cho khách." : accounts ? "Đăng nhập để dùng các công cụ AI." : "Nhập mật khẩu để dùng các công cụ AI viết content cho quán."}</p>
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
        <small>{accounts && !setup ? "Chưa có tài khoản hoặc quên mật khẩu? Liên hệ quản trị viên." : "Phiên đăng nhập giữ trong 30 ngày trên trình duyệt này."}</small>
      </form>
    </div>
  );
}

export async function logout() {
  await api("/logout", { method: "POST" }).catch(() => {});
  window.dispatchEvent(new Event("auth-required"));
}
