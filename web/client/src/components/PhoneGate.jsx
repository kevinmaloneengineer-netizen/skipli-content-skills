import { useEffect, useState } from "react";
import { useAuth } from "./AuthGate.jsx";
import { api } from "../lib/api.js";
import { getLang } from "../lib/i18n.js";

const CHANNELS = [["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["google", "Google Maps"], ["yelp", "Yelp"], ["website", "Website"], ["none", "Chưa đăng ở đâu"]];
const MARKETERS = [["owner", "Chủ quán tự làm"], ["staff", "Nhân viên của quán"], ["agency", "Thuê agency / freelancer"], ["nobody", "Chưa có ai làm"]];
const BUDGETS = [["0", "Chưa chi"], ["under-200", "Dưới $200"], ["200-500", "$200 đến $500"], ["500-1000", "$500 đến $1.000"], ["over-1000", "Trên $1.000"]];

/** Whether this account still has to unlock its results ("Mở khoá kết quả", server/phone.mjs). */
export function usePhoneGate() {
  const { user, phoneGate } = useAuth();
  return !!phoneGate && !!user && !user.leadDone;
}

/**
 * The first full result is shown blurred until the customer confirms a US phone number by SMS code
 * and gives a few details about their restaurant (once per account). "Xem trước" folds the card
 * so the blurred result can be glanced at.
 */
export default function PhoneGate({ children }) {
  const locked = usePhoneGate();
  const { user, reload } = useAuth();
  const [step, setStep] = useState(user?.phoneVerified ? "details" : "phone");
  const [peek, setPeek] = useState(false);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(null); // { sentTo, resendIn }
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", restaurant: "", city: "", channels: [], marketer: "", budget: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (!locked) return children;

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const send = () =>
    run(async () => {
      const r = await api("/phone/send", { method: "POST", body: { phone } });
      setSent(r);
      setCode("");
      setWait(r.resendIn ?? 30);
      setStep("code");
    });
  const verify = () =>
    run(async () => {
      await api("/phone/verify", { method: "POST", body: { code } });
      setStep("details");
    });
  const finish = () =>
    run(async () => {
      await api("/phone/details", { method: "POST", body: { ...form, lang: getLang() } });
      await reload();
    });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (c) => setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] }));

  return (
    <div className={peek ? "phone-gate is-peek" : "phone-gate"}>
      <div className="phone-gate-content" aria-hidden="true" inert="">
        {children}
      </div>
      <div className="phone-gate-card" role="dialog" aria-modal="false" aria-labelledby="phone-gate-title">
        <h2 id="phone-gate-title">Mở khoá kết quả</h2>
        {peek ? (
          <button type="button" className="btn primary" onClick={() => setPeek(false)}>Mở khoá ngay</button>
        ) : (
          <>
            {step === "phone" && (
              <form onSubmit={(e) => { e.preventDefault(); send(); }}>
                <p className="hint">Xác minh số điện thoại để xem toàn bộ kết quả. Chỉ cần làm một lần.</p>
                <input className="input-lg" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại Mỹ, ví dụ (404) 555-0123" aria-label="Số điện thoại" autoFocus />
                <button className="btn primary" disabled={busy || phone.replace(/\D/g, "").length < 9}>{busy ? "Đang gửi…" : "Gửi mã xác minh"}</button>
              </form>
            )}
            {step === "code" && (
              <form onSubmit={(e) => { e.preventDefault(); verify(); }}>
                <p className="hint">Nhập mã 6 số đã gửi tới <b>{sent?.sentTo}</b>.</p>
                <input className="input-lg otp-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" aria-label="Mã xác minh" autoFocus />
                <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? "Đang xác minh…" : "Xác minh số"}</button>
                <div className="phone-gate-row">
                  <button type="button" className="link-btn" disabled={busy || wait > 0} onClick={send}>{wait > 0 ? `Gửi lại mã sau ${wait} giây` : "Gửi lại mã"}</button>
                  <button type="button" className="link-btn" onClick={() => { setStep("phone"); setError(""); }}>Đổi số</button>
                </div>
              </form>
            )}
            {step === "details" && (
              <form onSubmit={(e) => { e.preventDefault(); finish(); }}>
                <p className="phone-gate-ok" role="status">Đã xác minh số điện thoại. Điền thêm vài thông tin để mở kết quả.</p>
                <input value={form.name} onChange={set("name")} placeholder="Họ và tên" aria-label="Họ và tên" autoComplete="name" required />
                <input type="email" value={form.email} onChange={set("email")} placeholder="Email công việc" aria-label="Email công việc" autoComplete="email" required />
                <h3>Thông tin về quán</h3>
                <p className="hint">Vài thông tin nhanh để đội ngũ hỗ trợ bạn sát hơn.</p>
                <input value={form.restaurant} onChange={set("restaurant")} placeholder="Tên quán" aria-label="Tên quán" required />
                <input value={form.city} onChange={set("city")} placeholder="Thành phố, bang (ví dụ Houston, TX)" aria-label="Thành phố" required />
                <fieldset className="phone-gate-chips">
                  <legend>Quán đang đăng bài ở đâu?</legend>
                  {CHANNELS.map(([k, label]) => (
                    <button key={k} type="button" className={form.channels.includes(k) ? "pg-chip on" : "pg-chip"} aria-pressed={form.channels.includes(k)} onClick={() => toggle(k)}>{label}</button>
                  ))}
                </fieldset>
                <select value={form.marketer} onChange={set("marketer")} aria-label="Ai đang lo marketing cho quán?">
                  <option value="">Ai đang lo marketing cho quán?</option>
                  {MARKETERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <select value={form.budget} onChange={set("budget")} aria-label="Ngân sách marketing mỗi tháng">
                  <option value="">Ngân sách marketing mỗi tháng</option>
                  {BUDGETS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button className="btn primary" disabled={busy}>{busy ? "Đang lưu…" : "Mở toàn bộ kết quả"}</button>
              </form>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <small className="phone-gate-note">Chúng tôi chỉ dùng thông tin này để liên hệ với bạn về Skipli Content.</small>
            <button type="button" className="link-btn" onClick={() => setPeek(true)}>Xem trước kết quả</button>
          </>
        )}
      </div>
    </div>
  );
}
