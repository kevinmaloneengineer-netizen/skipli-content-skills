import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BackLink } from "../components/SkillShell.jsx";
import { useAuth } from "../components/AuthGate.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { SKILLS, skillByType } from "../lib/constants.js";
import SkillArt from "../components/SkillArt.jsx";
import { ago } from "../lib/format.js";

/** What a balance or a pack buys, in the two things people buy most. */
const worth = (credits, costs) => [
  [Math.floor(credits / 1), "bài viết"],
  [Math.floor(credits / (costs.video ?? 5)), "video"],
];
const FAQ = [
  ["Credit có hết hạn không?", "Không. Credit đã nạp hay được tặng dùng đến khi hết, không giới hạn thời gian."],
  ["Lượt chạy bị lỗi có mất credit không?", "Không. Lượt lỗi hoặc bạn bấm huỷ được hoàn credit tự động ngay khi kết thúc."],
  ["Thanh toán có an toàn không?", "Thẻ được nhập trên trang của Stripe, web không thấy và không lưu số thẻ của bạn."],
  ["Nạp xong bao lâu thì có credit?", "Ngay khi quay lại trang này sau khi thanh toán. Nếu chưa thấy, tải lại trang sau vài giây."],
];
const money = (cents, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/**
 * /billing: credits left, the packs to buy through Stripe Checkout, what each tool costs, past top-ups.
 * Stripe sends the buyer back to /billing?paid=<session id>; the page asks the server to confirm it, so
 * the credits show up even before Stripe's webhook arrives.
 */
export default function BillingPage() {
  const { user, reload } = useAuth();
  const { refresh, jobs } = useJobs();
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

  const best = data.packs.length > 2 ? data.packs[1].id : null;
  // Tools by price, with their art: 1 credit for every writing tool not in the table.
  const priced = new Set(Object.keys(data.costs));
  const tiers = Object.entries(data.costs).filter(([, cost]) => cost > 0).reduce((acc, [type, cost]) => {
    const skill = skillByType(type);
    if (skill) (acc[cost] ??= []).push(skill);
    return acc;
  }, {});
  tiers[1] = [...(tiers[1] ?? []), ...SKILLS.filter((s) => s.type && !priced.has(s.type) && s.status !== "soon" && !["library", "schedule", "qr", "combos"].includes(s.id))];
  // Credit activity: top-ups (+) and runs that took credits (−, or refunded), newest first.
  const runs = (jobs ?? []).filter((j) => j.credits).map((j) => ({ id: j.id, at: j.createdAt, delta: j.refunded ? 0 : -j.credits, label: j.title, refunded: !!j.refunded, credits: j.credits }));
  const tops = (data.payments ?? []).map((p) => ({ id: p.id, at: p.at, delta: p.credits, label: p.disputed ? "Nạp credit · đang hoàn tiền qua ngân hàng" : "Nạp credit", amount: p.amount != null ? money(p.amount, p.currency || data.currency) : "" }));
  const activity = [...runs, ...tops].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12);
  const month = Date.now() - 30 * 86_400_000;
  const spent = runs.filter((r) => Date.parse(r.at) > month).reduce((n, r) => n - r.delta, 0);

  return (
    <div className="billing">
      <BackLink />
      <section className="billing-hero">
        <div className="billing-hero-text">
          <span className="dash-kicker">Credit</span>
          <h1>{data.metered ? <><b>{data.credits}</b> credit còn lại</> : "Tài khoản không tính credit"}</h1>
          <p>{data.metered ? "Mỗi lần chạy công cụ trừ credit theo loại việc. Lượt chạy lỗi hoặc bị huỷ được hoàn lại credit." : "Tài khoản quản trị (hoặc do quản trị viên tạo) dùng không giới hạn credit."}</p>
          {data.metered && data.credits < 3 && <p className="billing-low">Sắp hết credit. Nạp thêm để chạy tiếp.</p>}
        </div>
        {data.metered && (
          <div className="billing-wallet" aria-hidden="true">
            <div className="billing-card">
              <span className="billing-card-brand">Skipli Content</span>
              <span className="billing-card-chip" />
              <b>{data.credits}</b>
              <small>{user.contact}</small>
            </div>
            <div className="billing-stats">
              {worth(data.credits, data.costs).map(([n, label]) => <div key={label}><b>≈ {n}</b><span>{label}</span></div>)}
              <div><b>{spent}</b><span>đã dùng 30 ngày</span></div>
            </div>
          </div>
        )}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {data.metered && (
        <section className="billing-buy">
          <h2 className="billing-title">Chọn gói nạp</h2>
          <div className="billing-packs">
            {data.packs.map((p) => (
              <article key={p.id} className={p.id === best ? "billing-pack is-best" : "billing-pack"}>
                {p.id === best && <span className="billing-tag">Phổ biến</span>}
                <h3><b>{p.credits}</b> credit</h3>
                <p className="billing-price">{money(p.cents, data.currency)}</p>
                <small>{money(p.cents / p.credits, data.currency)} mỗi credit</small>
                <ul className="billing-gets">
                  {worth(p.credits, data.costs).map(([n, label]) => <li key={label}>Khoảng {n} {label}</li>)}
                  <li>Không hết hạn</li>
                </ul>
                <button type="button" className={p.id === best ? "btn primary" : "btn"} disabled={!data.enabled || !!buying} onClick={() => buy(p)}>
                  {buying === p.id ? "Đang mở Stripe…" : "Nạp gói này"}
                </button>
              </article>
            ))}
          </div>
          {!data.enabled && <p className="hint billing-off">Thanh toán chưa được bật trên máy chủ (thiếu STRIPE_SECRET_KEY).</p>}
          <p className="billing-secure"><span aria-hidden="true">🔒</span> Thanh toán bằng thẻ qua Stripe. Web không lưu số thẻ của bạn.</p>
        </section>
      )}

      <section className="billing-grid">
        <div className="dash-panel billing-prices">
          <header><h3>Mỗi lượt chạy tốn bao nhiêu</h3></header>
          {Object.entries(tiers).sort(([a], [b]) => a - b).map(([cost, skills]) => (
            <div key={cost} className="billing-tier">
              <span className="billing-tier-cost"><b>{cost}</b> credit</span>
              <div className="billing-tier-tools">
                {skills.map((s) => (
                  <span key={s.id} className="billing-tool" data-tone={s.tone} title={s.title}>
                    <i aria-hidden="true"><SkillArt id={s.id} /></i>
                    {s.short}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {data.metered && (
          <div className="dash-panel billing-activity">
            <header><h3>Hoạt động credit</h3></header>
            {activity.length === 0 && <p className="hint">Chưa có hoạt động nào. Chạy một công cụ hoặc nạp credit, lịch sử sẽ hiện ở đây.</p>}
            <ul className="billing-history">
              {activity.map((x) => (
                <li key={x.id} className={x.delta > 0 ? "is-in" : x.refunded ? "is-refund" : "is-out"}>
                  <span className="billing-dot" aria-hidden="true">{x.delta > 0 ? "+" : x.refunded ? "↺" : "−"}</span>
                  <span className="billing-what"><b>{x.label}</b><small>{ago(x.at)}{x.amount ? ` · ${x.amount}` : ""}{x.refunded ? " · đã hoàn credit" : ""}</small></span>
                  <span className="billing-delta">{x.delta > 0 ? `+${x.delta}` : x.refunded ? `±${x.credits}` : x.delta}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="billing-faq">
        <h2 className="billing-title">Câu hỏi thường gặp</h2>
        <div className="billing-faq-grid">
          {FAQ.map(([q, a]) => (
            <div key={q} className="billing-faq-item">
              <b>{q}</b>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
