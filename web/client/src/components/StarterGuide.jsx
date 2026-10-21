import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { useAuth } from "./AuthGate.jsx";

const KEY = "starter-guide-hidden";
// Three first runs that show what the app does, well inside the trial credits, and the free tools.
const PICKS = [
  { to: "/write", title: "Viết bài Facebook cho món mới", cost: "1 credit" },
  { to: "/photo-fix", title: "Chỉnh ảnh món cho sáng và ngon hơn", cost: "1 credit" },
  { to: "/video", title: "Làm video trình chiếu 15 giây", cost: "5 credit" },
];
const FREE = [
  { to: "/qr", title: "Mã QR" },
  { to: "/menu-board", title: "Menu in & QR" },
  { to: "/banner", title: "Banner lễ" },
];
const hidden = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** For a new shop on trial credits: three good first things to try, until it has a few runs or closes the card. */
export default function StarterGuide() {
  const { guest } = useAuth();
  const { jobs, loaded, credits } = useJobs();
  const { pathname } = useLocation();
  const [closed, setClosed] = useState(hidden);
  const [open, setOpen] = useState(true);
  const done = new Set(jobs.map((j) => j.type));
  if (guest || closed || !loaded || credits === null || jobs.length >= 3 || pathname.startsWith("/login") || pathname.startsWith("/billing")) return null;
  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked: hidden until reload */
    }
    setClosed(true);
  }
  return (
    <aside className={open ? "starter" : "starter is-min"} aria-label="Gợi ý bắt đầu">
      <header>
        <button type="button" className="starter-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <b>Bắt đầu với {credits} credit dùng thử</b>
          <small>{open ? "Thu gọn" : "3 việc nên thử"}</small>
        </button>
        <button type="button" className="starter-close" onClick={close} aria-label="Ẩn gợi ý">×</button>
      </header>
      {open && (
        <>
          <ol>
            {PICKS.map((p) => {
              const type = p.to.slice(1);
              return (
                <li key={p.to} className={done.has(type) ? "is-done" : undefined}>
                  <Link to={p.to}>
                    <span>{p.title}</span>
                    <em>{done.has(type) ? "Đã thử" : p.cost}</em>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="starter-free">
            Miễn phí, không trừ credit: {FREE.map((f, i) => <span key={f.to}>{i > 0 && " · "}<Link to={f.to}>{f.title}</Link></span>)}
          </p>
        </>
      )}
    </aside>
  );
}
