import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BackLink } from "../components/SkillShell.jsx";
import { useAuth } from "../components/AuthGate.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { skillByType } from "../lib/constants.js";
import { ago } from "../lib/format.js";

const money = (cents, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/**
 * /billing: credits left, the packs to buy through Stripe Checkout, what each tool costs, past top-ups.
 * Stripe sends the buyer back to /billing?paid=<session id>; the page asks the server to confirm it, so
 * the credits show up even before Stripe's webhook arrives.
 */
export default function BillingPage() {
  const { user, reload } = useAuth();
  const { refresh } = useJobs();
  const toast = useToast();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState("");
  const confirmed = useRef("");

  const load = () => api("/billing").then(setData, (e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  // Back from Stripe: add the paid credits (once), then clean the address bar.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const paid = params.get("paid");
    if (params.has("canceled")) {
      toast("Đã huỷ thanh toán, chưa trừ tiền.");
      navigate("/billing", { replace: true });
    }
    if (!paid || confirmed.current === paid) return;
    confirmed.current = paid;
    api("/billing/confirm", { method: "POST", body: { sessionId: paid } })
      .then((out) => {
        toast(!out.paid ? "Thanh toán đang xử lý, credit sẽ được cộng khi Stripe xác nhận." : out.added ? `Đã nạp ${out.added} credit. Số dư: ${out.credits}` : `Thanh toán đã được ghi nhận. Số dư: ${out.credits}`);
        load();
        refresh();
        reload();
      }, (e) => setError(e.message))
      .finally(() => navigate("/billing", { replace: true }));
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buy(pack) {
    setBuying(pack.id);
    setError("");
    try {
      const { url } = await api("/billing/checkout", { method: "POST", body: { pack: pack.id } });
      window.location.assign(url); // Stripe's own page takes the card
    } catch (e) {
      setError(e.message);
      setBuying("");
    }
  }

  if (!user) return <div className="narrow"><BackLink /><p className="empty">Web chưa bật tài khoản riêng.</p></div>;
  if (!data) return <div className="narrow"><BackLink />{error ? <p className="form-error">{error}</p> : <p className="hint">Đang tải…</p>}</div>;

  // Tools grouped by price: "1 credit: Viết bài, Hashtag…"
  const tiers = Object.entries(data.costs).reduce((acc, [type, cost]) => ({ ...acc, [cost]: [...(acc[cost] ?? []), skillByType(type)?.short].filter(Boolean) }), {});
  const best = data.packs.length > 2 ? data.packs[1].id : null;

  return (
    <div className="billing">
      <BackLink />
      <section className="billing-hero">
        <div>
          <span className="dash-kicker">Credit</span>
          <h1>{data.metered ? <><b>{data.credits}</b> credit còn lại</> : "Tài khoản không tính credit"}</h1>
          <p>{data.metered ? "Mỗi lần chạy công cụ trừ credit theo loại việc. Lượt chạy lỗi hoặc bị huỷ được hoàn lại credit." : "Tài khoản quản trị (hoặc do quản trị viên tạo) dùng không giới hạn credit."}</p>
        </div>
        {data.metered && data.credits < 3 && <p className="billing-low">Sắp hết credit. Nạp thêm để chạy tiếp.</p>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {data.metered && (
        <section className="billing-buy">
          <div className="billing-packs">
          {data.packs.map((p) => (
            <article key={p.id} className={p.id === best ? "billing-pack is-best" : "billing-pack"}>
              {p.id === best && <span className="billing-tag">Phổ biến</span>}
              <h2><b>{p.credits}</b> credit</h2>
              <p className="billing-price">{money(p.cents, data.currency)}</p>
              <small>{money(p.cents / p.credits, data.currency)} mỗi credit</small>
              <button type="button" className={p.id === best ? "btn primary" : "btn"} disabled={!data.enabled || !!buying} onClick={() => buy(p)}>
                {buying === p.id ? "Đang mở Stripe…" : "Nạp gói này"}
              </button>
            </article>
          ))}
          </div>
          {!data.enabled && <p className="hint billing-off">Thanh toán chưa được bật trên máy chủ (thiếu STRIPE_SECRET_KEY).</p>}
          <p className="billing-secure">Thanh toán bằng thẻ qua Stripe. Web không lưu số thẻ của bạn.</p>
        </section>
      )}

      <section className="billing-grid">
        <div className="dash-panel">
          <header><h3>Mỗi lượt chạy tốn bao nhiêu</h3></header>
          <ul className="billing-costs">
            <li><b>1</b><span>Các công cụ viết bài còn lại (bài đăng, trả lời review, hashtag, menu…)</span></li>
            {Object.entries(tiers).sort(([a], [b]) => a - b).map(([cost, names]) => (
              <li key={cost}><b>{cost}</b><span>{names.join(", ")}</span></li>
            ))}
          </ul>
        </div>
        {data.metered && (
          <div className="dash-panel">
            <header><h3>Lịch sử nạp</h3></header>
            {data.payments.length === 0 && <p className="hint">Chưa nạp lần nào.</p>}
            <ul className="billing-history">
              {data.payments.map((p) => (
                <li key={p.id}>
                  <span><b>+{p.credits} credit</b><small>{ago(p.at)}</small></span>
                  <span>{p.amount != null ? money(p.amount, p.currency || data.currency) : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
