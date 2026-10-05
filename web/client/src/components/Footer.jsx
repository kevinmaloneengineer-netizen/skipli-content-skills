import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import { CATEGORIES, skillById } from "../lib/constants.js";
import { FAQ } from "../lib/workflows.js";
import HealthStatus from "./HealthStatus.jsx";

const GROUPS = CATEGORIES.map((c) => ({ ...c, items: c.skills.map(skillById).filter(Boolean) }));

/** "Hỗ trợ & góp ý": FAQ + a feedback form, in a dialog reachable from every page. */
function SupportDialog({ onClose }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function send(e) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await api("/feedback", { method: "POST", body: { message, contact, page: pathname } });
      setState("sent");
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <dialog ref={ref} className="support" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="support-inner">
        <header>
          <h2>Hỗ trợ và góp ý</h2>
          <button type="button" className="btn ghost small" onClick={() => ref.current.close()} aria-label="Đóng">✕</button>
        </header>
        <div className="support-body">
          <section>
            <h3>Câu hỏi thường gặp</h3>
            {FAQ.map(([, q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
          <section>
            <h3>Gửi góp ý</h3>
            {state === "sent" ? (
              <p className="support-thanks">Cảm ơn bạn! Góp ý đã được gửi tới đội ngũ.</p>
            ) : (
              <form onSubmit={send}>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bạn muốn thêm tính năng gì, chỗ nào chưa tiện?" aria-label="Nội dung góp ý" required />
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email hoặc SĐT để phản hồi (tuỳ chọn)" aria-label="Liên hệ" />
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="btn primary" disabled={state === "sending"}>{state === "sending" ? "Đang gửi…" : "Gửi góp ý"}</button>
              </form>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}

export const openSupport = () => window.dispatchEvent(new Event("open-support"));

export default function Footer() {
  const [support, setSupport] = useState(false);
  useEffect(() => {
    const open = () => setSupport(true);
    window.addEventListener("open-support", open);
    return () => window.removeEventListener("open-support", open);
  }, []);
  return (
    <footer className="site-foot">
      <div className="foot-inner">
        <div className="foot-brand">
          <Link className="brand" to="/">
            <img className="brand-logo" src="/logo.jpg" alt="" width="32" height="32" />
            <span>
              Skipli <em>Content</em>
            </span>
          </Link>
          <p>Nghiên cứu đối thủ, viết bài, dựng video và lên kịch bản bán hàng. Một chỗ cho mọi việc content của nhà bán hàng Việt.</p>
          <HealthStatus />
        </div>
        {GROUPS.map((g) => (
          <nav key={g.id} className="foot-col" aria-label={g.title}>
            <h3>{g.title}</h3>
            {g.items.map((s) => (
              <Link key={s.id} to={s.path} className={s.status === "soon" ? "is-soon" : undefined}>
                {s.short}
                {s.status === "soon" && <em>Sắp có</em>}
              </Link>
            ))}
          </nav>
        ))}
        <nav className="foot-col" aria-label="Của bạn">
          <h3>Của bạn</h3>
          <Link to="/history">Lịch sử chạy</Link>
          <Link to="/library?kind=saved">Bài đã lưu</Link>
          <Link to="/library?kind=template">Mẫu content</Link>
          <button type="button" className="foot-link" onClick={() => setSupport(true)}>Hỗ trợ và góp ý</button>
        </nav>
      </div>
      <div className="foot-bottom">
        <span>© {new Date().getFullYear()} Skipli. Nội dung AI chỉ để tham khảo, hãy kiểm tra trước khi đăng.</span>
        <span className="foot-made">Làm cho nhà bán hàng Việt</span>
      </div>
      <div className="foot-word" aria-hidden="true">Skipli</div>
      {support && <SupportDialog onClose={() => setSupport(false)} />}
    </footer>
  );
}
