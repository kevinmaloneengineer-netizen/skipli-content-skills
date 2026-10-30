import { useState } from "react";
import QRCode from "qrcode";
import { BackLink } from "../components/SkillShell.jsx";
import { useAuth } from "../components/AuthGate.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { copyText } from "../lib/text.js";

export default function AccountPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false); // the "sign out everywhere" question
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
  async function logoutAll() {
    try {
      await api("/me/logout-all", { method: "POST" });
      toast("Đã đăng xuất mọi thiết bị khác. Trình duyệt này vẫn đăng nhập.");
    } catch (err) {
      toast(err.message);
    }
  }
  if (!user) return <div className="narrow"><BackLink /><p className="empty">Web chưa bật tài khoản riêng.</p></div>;
  return (
    <div className="narrow">
      <BackLink />
      <header className="plain-head">
        <h1>Tài khoản</h1>
        <p>{user.name ? `${user.name} · ` : ""}{user.contact}</p>
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
      {user.role === "admin" && <TwoStep />}
      <section className="form-card account-card">
        <h2>Thiết bị đang đăng nhập</h2>
        <p className="account-note">Quên đăng xuất ở máy dùng chung, hoặc nghi có người khác vào tài khoản? Bấm nút dưới để mọi trình duyệt khác phải đăng nhập lại. Trình duyệt bạn đang dùng vẫn giữ đăng nhập.</p>
        <button type="button" className="btn" onClick={() => setAsking(true)}>Đăng xuất khỏi mọi thiết bị khác</button>
      </section>
      {asking && (
        <ConfirmDialog
          title="Đăng xuất mọi thiết bị khác?"
          body="Mọi trình duyệt và điện thoại khác đang đăng nhập tài khoản này sẽ phải đăng nhập lại. Việc đang chạy và dữ liệu vẫn giữ nguyên."
          okLabel="Đăng xuất"
          cancelLabel="Thôi"
          onOk={logoutAll}
          onClose={() => setAsking(false)}
        />
      )}
    </div>
  );
}

/** Admin: 2-step login with an authenticator app (scan the QR, type a code), and the backup codes shown once. */
function TwoStep() {
  const { user, reload } = useAuth();
  const toast = useToast();
  const [setup, setSetup] = useState(null); // { secret, qr } while turning it on
  const [codes, setCodes] = useState(null); // backup codes, shown once right after
  const [form, setForm] = useState({ password: "", code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const on = !!user.mfa;

  async function call(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const start = () => call(async () => {
    const out = await api("/me/mfa/setup", { method: "POST" });
    const qr = await QRCode.toDataURL(out.uri, { errorCorrectionLevel: "M", margin: 2, width: 220 });
    setSetup({ secret: out.secret, qr });
    setForm({ password: "", code: "" });
  });
  const enable = (e) => {
    e.preventDefault();
    call(async () => {
      const out = await api("/me/mfa/enable", { method: "POST", body: form });
      setSetup(null);
      setCodes(out.codes);
      setForm({ password: "", code: "" });
      await reload();
    });
  };
  const disable = (e) => {
    e.preventDefault();
    call(async () => {
      await api("/me/mfa/disable", { method: "POST", body: form });
      setForm({ password: "", code: "" });
      toast("Đã tắt xác thực 2 lớp.");
      await reload();
    });
  };

  return (
    <section className="form-card account-card">
      <h2>Xác thực 2 lớp {on && <span className="badge-on">Đang bật</span>}</h2>
      {codes ? (
        <>
          <p className="account-note">Đã bật. Lưu 8 mã dự phòng này ở chỗ an toàn (password manager hoặc in ra giấy). Mất điện thoại thì dùng một mã để đăng nhập, mỗi mã chỉ dùng được một lần. <b>Mã chỉ hiện một lần này.</b></p>
          <ul className="backup-codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="verify-actions">
            <button type="button" className="btn" onClick={async () => toast((await copyText(codes.join("\n"))) ? "Đã chép mã dự phòng" : "Chưa chép được, hãy chép tay")}>Chép mã</button>
            <button type="button" className="btn primary" onClick={() => setCodes(null)}>Đã lưu xong</button>
          </div>
        </>
      ) : on ? (
        <form onSubmit={disable}>
          <p className="account-note">Mỗi lần đăng nhập, sau mật khẩu sẽ hỏi thêm mã 6 số trong ứng dụng xác thực. Còn {user.mfa.backupLeft} mã dự phòng chưa dùng.{user.mfa.backupLeft <= 2 ? " Sắp hết mã dự phòng: tắt rồi bật lại để nhận bộ mã mới." : ""}</p>
          <div className="row">
            <label className="field"><span className="field-label">Mật khẩu hiện tại</span><input type="password" value={form.password} onChange={set("password")} autoComplete="current-password" required /></label>
            <label className="field"><span className="field-label">Mã trong ứng dụng (hoặc mã dự phòng)</span><input value={form.code} onChange={set("code")} autoComplete="one-time-code" required /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn danger" disabled={busy || !form.password || !form.code}>Tắt xác thực 2 lớp</button>
        </form>
      ) : setup ? (
        <form onSubmit={enable}>
          <p className="account-note">1. Mở ứng dụng xác thực (Google Authenticator, Authy, 1Password...) và quét mã QR này. 2. Nhập mã 6 số ứng dụng hiện ra cùng mật khẩu để bật.</p>
          <div className="mfa-setup">
            <img src={setup.qr} alt="Mã QR để thêm Skipli Content vào ứng dụng xác thực" width="220" height="220" />
            <p className="account-note">Không quét được? Nhập tay khoá này vào ứng dụng:<br /><code className="mfa-secret">{setup.secret.match(/.{1,4}/g).join(" ")}</code></p>
          </div>
          <div className="row">
            <label className="field"><span className="field-label">Mã 6 số trong ứng dụng</span><input className="otp-input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" required /></label>
            <label className="field"><span className="field-label">Mật khẩu hiện tại</span><input type="password" value={form.password} onChange={set("password")} autoComplete="current-password" required /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="verify-actions">
            <button type="button" className="btn ghost" onClick={() => { setSetup(null); setError(""); }}>Huỷ</button>
            <button className="btn primary" disabled={busy || form.code.length < 6 || !form.password}>{busy ? "Đang bật…" : "Bật xác thực 2 lớp"}</button>
          </div>
        </form>
      ) : (
        <>
          <p className="account-note">Tài khoản quản trị đổi được giá, credit và mọi tài khoản khách. Bật xác thực 2 lớp để dù lộ mật khẩu, người khác vẫn không đăng nhập được nếu không có điện thoại của bạn.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="btn primary" onClick={start} disabled={busy}>{busy ? "Đang tạo mã…" : "Bật xác thực 2 lớp"}</button>
        </>
      )}
    </section>
  );
}
