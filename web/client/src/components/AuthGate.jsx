import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import LoginShowcase from "./LoginShowcase.jsx";

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
    // Session ended while using the app: log in again and come back here.
    const out = () => {
      setSession((s) => (s && s.mode !== "open" ? { ...s, signedIn: false, user: null } : s));
      const here = window.location.pathname + window.location.search;
      if (!here.startsWith("/login")) navigate(loginPath(here), { replace: true });
    };
    window.addEventListener("auth-required", out);
    return () => window.removeEventListener("auth-required", out);
  }, [load, navigate]);

  if (!session) return null;
  // Signed up but the email code is not entered yet: still a guest everywhere, the login page asks for the code.
  const pendingVerify = !!session.signedIn && session.user?.emailVerified === false;
  const guest = session.mode !== "open" && (!session.signedIn || pendingVerify);
  const value = { mode: session.mode, user: session.user ?? null, signedIn: !guest, guest, setup: !!session.setup, signup: !!session.signup, billing: !!session.billing, trial: session.trial ?? null, pendingVerify, reload: load };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Route wrapper: a guest is sent to the login page, then back here once signed in. */
export function RequireAuth() {
  const { guest } = useAuth();
  const { pathname, search } = useLocation();
  if (guest) return <Navigate to={loginPath(pathname + search)} replace />;
  return <Outlet />;
}

/**
 * /login: one shared password (APP_PASSWORD) or an account (ACCOUNTS=1); the first account is the admin.
 * With SIGNUP=1 a customer can create their own account here (/login?signup=1 opens that tab).
 */
export function LoginPage() {
  const { mode, guest, setup, signup, trial, pendingVerify, user, reload } = useAuth();
  const { search } = useLocation();
  const next = new URLSearchParams(search).get("next");
  const back = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [form, setForm] = useState({ email: "", password: "", again: "", name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(() => new URLSearchParams(search).has("signup"));
  const [mailError, setMailError] = useState(null); // the sign-up could not send the code
  const goHome = useRef(false);

  // A brand-new account (signed up, or just confirmed its email) starts at the home page, not at the
  // page an earlier session left in ?next.
  if (pendingVerify) goHome.current = true;
  if (!guest) return <Navigate to={goHome.current ? "/" : back} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const accounts = mode === "accounts";
  const creating = accounts && !setup && signup && joining; // the "Tạo tài khoản" tab
  const newAccount = setup || creating; // a new password is typed twice
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (newAccount && form.password !== form.again) return setError("Hai lần nhập mật khẩu không khớp");
    setBusy(true);
    const { again, ...body } = form; // eslint-disable-line no-unused-vars
    try {
      let out;
      if (accounts && setup) out = await api("/setup", { method: "POST", body });
      else if (creating) out = await api("/signup", { method: "POST", body });
      else if (accounts) out = await api("/login", { method: "POST", body: { email: form.email, password: form.password } });
      else out = await api("/login", { method: "POST", body: { password: form.password } });
      setForm({ email: "", password: "", again: "", name: "" });
      setMailError(out?.mailError ?? null);
      if (creating || setup) goHome.current = true;
      // The session reload re-renders this page: a new account first types its email code (shown
      // here), everyone else is sent on by the redirect above.
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <LoginShowcase signup={signup} trial={trial} />
      <div className="login-side">
      {pendingVerify ? <VerifyCard email={user?.email} trial={trial} mailError={mailError} onDone={reload} /> : (
      <form className="login-card" onSubmit={submit}>
        <img src="/assistant/wave.png" alt="" className="login-mascot" onError={(e) => (e.currentTarget.hidden = true)} />
        <h1>{setup ? "Tạo tài khoản quản trị" : creating ? "Tạo tài khoản" : "Chào mừng trở lại"}</h1>
        {accounts && !setup && signup && (
          <div className="login-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!joining} className={joining ? undefined : "on"} onClick={() => { setJoining(false); setError(""); }}>Đăng nhập</button>
            <button type="button" role="tab" aria-selected={joining} className={joining ? "on" : undefined} onClick={() => { setJoining(true); setError(""); }}>Tạo tài khoản</button>
          </div>
        )}
        <p>{setup ? "Lần đầu sử dụng: tạo tài khoản quản trị. Tài khoản này tạo và quản lý tài khoản cho khách." : creating ? "Tạo tài khoản miễn phí, nhận credit dùng thử ngay. Hết credit thì nạp thêm bằng thẻ." : accounts ? "Đăng nhập để dùng các công cụ AI." : "Nhập mật khẩu để dùng các công cụ AI viết content cho quán."}</p>
        {(setup || creating) && (
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
          <span className="field-label">Mật khẩu{setup || creating ? " (ít nhất 8 ký tự)" : ""}</span>
          <input type="password" value={form.password} onChange={set("password")} autoComplete={setup || creating ? "new-password" : "current-password"} autoFocus={!accounts} minLength={setup || creating ? 8 : undefined} required />
        </label>
        {newAccount && (
          <label className="field">
            <span className="field-label">Nhập lại mật khẩu</span>
            <input type="password" value={form.again} onChange={set("again")} autoComplete="new-password" required aria-invalid={form.again !== "" && form.again !== form.password} />
            {form.again !== "" && form.again !== form.password && <small className="field-warn">Chưa khớp với mật khẩu ở trên</small>}
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !form.password || (accounts && !form.email) || (newAccount && !form.again)}>{busy ? (creating ? "Đang tạo tài khoản và gửi mã…" : "Đang xử lý…") : setup ? "Tạo tài khoản quản trị" : creating ? "Tạo tài khoản" : "Đăng nhập"}</button>
        <small>{creating ? "Phiên đăng nhập giữ trong 30 ngày trên trình duyệt này." : accounts && !setup ? (signup ? "Quên mật khẩu? Liên hệ quản trị viên." : "Chưa có tài khoản hoặc quên mật khẩu? Liên hệ quản trị viên.") : "Phiên đăng nhập giữ trong 30 ngày trên trình duyệt này."}</small>
      </form>
      )}
      </div>
    </div>
  );
}

/** After sign-up: the 6-digit code from the email (resend once a minute, or start over with another email). */
function VerifyCard({ email, trial, mailError, onDone }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(mailError ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(mailError ? 0 : 60); // seconds until "Gửi lại mã"
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/verify", { method: "POST", body: { code } });
      await onDone();
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setError("");
    setNote("");
    try {
      await api("/verify/resend", { method: "POST" });
      setNote("Đã gửi mã mới, kiểm tra hộp thư nhé.");
      setWait(60);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <img src="/assistant/wave.png" alt="" className="login-mascot" onError={(e) => (e.currentTarget.hidden = true)} />
      <h1>Xác nhận email</h1>
      <p>Mã 6 số đã gửi tới <b className="verify-email">{email}</b>. Nhập mã để kích hoạt tài khoản{trial ? ` và nhận ${trial} credit dùng thử` : ""}.</p>
      <label className="field">
        <span className="field-label">Mã xác nhận</span>
        <input className="otp-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" autoFocus aria-label="Mã xác nhận 6 số" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {note && <p className="verify-note">{note}</p>}
      <button className="btn primary" disabled={busy || code.length < 6}>{busy ? "Đang xác nhận…" : "Xác nhận"}</button>
      <div className="verify-actions">
        <button type="button" className="verify-link" onClick={resend} disabled={wait > 0}>{wait > 0 ? `Gửi lại mã sau ${wait}s` : "Gửi lại mã"}</button>
        <button type="button" className="verify-link" onClick={logout}>Dùng email khác</button>
      </div>
      <small>Không thấy mail? Xem thêm mục Spam hoặc Quảng cáo.</small>
    </form>
  );
}

/** Signing out on purpose: a fresh load of the plain login page, so nothing of this session (or its page) carries over. */
export async function logout() {
  await api("/logout", { method: "POST" }).catch(() => {});
  window.location.assign("/login");
}
