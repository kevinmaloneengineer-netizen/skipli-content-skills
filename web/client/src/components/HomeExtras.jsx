import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { SKILLS } from "../lib/constants.js";
import { FAQ, GUIDE_STEPS } from "../lib/workflows.js";
import { openSupport } from "./Footer.jsx";

/** True once the element has scrolled into view (stays true). */
function useSeen() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

function CountUp({ value, run }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setN(value);
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 1200);
      setN(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return <>{n.toLocaleString("vi-VN")}</>;
}

const SvgIcon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);
const STAT_ICONS = {
  runs: "M5 12.5l4.5 4.5L19 7.5",
  reels: "M4 5h16v14H4zM10 9l5 3-5 3z",
  saved: "M6 3h12v18l-6-4-6 4z",
  tools: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
};

/** Home page only, above the footer: usage numbers, how to use it, FAQ. */
export default function HomeExtras() {
  const [stats, setStats] = useState(null);
  const [ref, seen] = useSeen();
  useEffect(() => {
    api("/stats").then(setStats, () => setStats(null));
  }, []);
  const ready = SKILLS.filter((s) => s.status !== "soon");
  const rows = [
    ["runs", stats?.runs, "Lần chạy hoàn tất", "Bài viết, báo cáo, video AI đã làm xong"],
    ["reels", stats?.reels, "Reel đối thủ đã quét", "Đọc kèm cảm xúc, bình luận, chia sẻ"],
    ["saved", stats?.saved, "Bài đã lưu", "Sẵn sàng dùng lại trong thư viện"],
    ["tools", ready.length, "Công cụ sẵn sàng", `Thêm ${SKILLS.length - ready.length} công cụ đang phát triển`],
  ];
  const byTool = ready
    .filter((s) => s.type)
    .map((s) => ({ ...s, n: stats?.byType?.[s.type] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...byTool.map((t) => t.n));
  const topics = [...new Set(FAQ.map(([t]) => t))];
  const [topic, setTopic] = useState("");

  return (
    <section className="home-extras">
      <div className="hx-band hx-dark">
        <div className="hx-wrap">
          <div className="hx-stats-wrap">
            <div className="hx-head">
              <span className="hx-tag">Tổng quan</span>
              <h2>Thành quả của bạn</h2>
              <p className="hx-lead">Tổng hợp mọi lần chạy đã lưu: bao nhiêu bài đã viết, bao nhiêu reel đối thủ đã đọc. Số liệu tự cập nhật mỗi khi có kết quả mới.</p>
            </div>
            <div className="hx-stats" ref={ref}>
              {rows.map(([key, v, label, hint]) => (
                <div key={key} className="hx-stat" data-k={key}>
                  <span className="hx-stat-icon"><SvgIcon d={STAT_ICONS[key]} /></span>
                  <b>{v === undefined ? "0" : <CountUp value={v} run={seen} />}</b>
                  <span className="hx-stat-label">{label}</span>
                  <small>{hint}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="hx-bytool">
            <span className="hx-bytool-title">Theo công cụ</span>
            <div className="hx-bytool-list">
              {byTool.map((t) => (
                <Link key={t.id} to={t.path} className="hx-tool" data-tone={t.tone}>
                  <span className="hx-tool-name">{t.short}</span>
                  <span className="hx-tool-bar"><i style={{ width: `${(t.n / maxN) * 100}%` }} /></span>
                  <span className="hx-tool-n">{t.n}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hx-band hx-warm">
        <div className="hx-wrap hx-guide">
          <div className="hx-head hx-head-row">
            <div>
              <span className="hx-tag">Cách dùng</span>
              <h2>3 bước cho một tuần content</h2>
            </div>
            <p className="hx-lead">Không cần biết hết 11 công cụ. Đi theo đúng thứ tự này, mỗi tuần bạn có đủ bài để đăng mà vẫn bám sát những gì khách đang thích.</p>
          </div>
          <ol>
            {GUIDE_STEPS.map((s) => (
              <li key={s.n}>
                <div className="hx-step-top">
                  <span className="hx-n">{s.n}</span>
                  <span className="hx-step-icon"><SvgIcon d={s.icon} /></span>
                  <span className="hx-time">{s.time}</span>
                </div>
                <b>{s.title}</b>
                <p>{s.text}</p>
                <div className="hx-tools">
                  {s.tools.map((id) => {
                    const t = SKILLS.find((x) => x.id === id);
                    return t ? (
                      <Link key={id} to={t.path} data-tone={t.tone} className={t.status === "soon" ? "is-soon" : undefined}>
                        <i aria-hidden="true" />
                        {t.short}
                      </Link>
                    ) : null;
                  })}
                </div>
                <p className="hx-tip"><span>Mẹo</span>{s.tip}</p>
                <Link className="hx-cta" to={s.to}>{s.cta} →</Link>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="hx-band hx-light">
        <div className="hx-wrap hx-faq" id="faq">
          <div className="hx-faq-side">
            <span className="hx-tag">Hỏi đáp</span>
            <h2>Câu hỏi thường gặp</h2>
            <p className="hx-lead">Những điều người dùng hay hỏi khi mới bắt đầu: cách công cụ hoạt động, AI có chép bài không, kết quả nằm ở đâu.</p>
            <div className="hx-topics" role="group" aria-label="Lọc theo chủ đề">
              {["", ...topics].map((t) => (
                <button key={t || "all"} type="button" className={topic === t ? "on" : undefined} onClick={() => setTopic(t)}>
                  {t || "Tất cả"}
                </button>
              ))}
            </div>
            <div className="hx-ask">
              <b>Không thấy câu trả lời?</b>
              <p>Nhắn cho đội ngũ, mỗi góp ý đều được đọc và trả lời.</p>
              <button type="button" className="btn primary" onClick={openSupport}>Hỏi đội ngũ</button>
            </div>
          </div>
          <div className="hx-faq-list">
            {FAQ.filter(([t]) => !topic || t === topic).map(([t, q, a]) => (
              <details key={q}>
                <summary>
                  <span className="hx-q-topic">{t}</span>
                  <span className="hx-q">{q}</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
