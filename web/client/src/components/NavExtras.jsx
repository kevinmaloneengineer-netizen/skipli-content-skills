import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { skillByType, STATUS } from "../lib/constants.js";
import { ago } from "../lib/format.js";

const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

/** Light/dark toggle. "system" until the user picks; the choice lives in localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? "system");
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    setTheme(next);
  }
  return { dark, toggle };
}

export function ThemeButton({ dark, onToggle }) {
  return (
    <button type="button" className="icon-btn" onClick={onToggle} aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} title={dark ? "Giao diện sáng" : "Giao diện tối"}>
      {dark ? (
        <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
      ) : (
        <Svg><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Svg>
      )}
    </button>
  );
}

export function SearchButton({ onOpen }) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button type="button" className="search-btn" onClick={onOpen} aria-label="Tìm nhanh">
      <Svg><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
      <span>Tìm nhanh</span>
      <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}

/** Bell with the runs that finished while the app was open. */
export function Bell() {
  const { notices, markRead, clearNotices } = useJobs();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const unread = notices.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const close = (e) => (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    if (!open && unread) markRead();
  }

  return (
    <div className="bell" ref={box}>
      <button type="button" className="icon-btn" onClick={toggle} aria-label={unread ? `${unread} thông báo mới` : "Thông báo"} aria-expanded={open}>
        <Svg><path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label="Thông báo">
          <div className="bell-head">
            <b>Thông báo</b>
            {notices.length > 0 && <button type="button" onClick={clearNotices}>Xoá hết</button>}
          </div>
          {notices.length === 0 ? (
            <p className="bell-empty">Chưa có gì. Khi một tác vụ chạy xong, thông báo sẽ hiện ở đây.</p>
          ) : (
            <div className="bell-list">
              {notices.map((n) => (
                <Link key={n.id} to={`/jobs/${n.id}`} className="bell-item" data-tone={skillByType(n.type)?.tone} data-status={n.status} onClick={() => setOpen(false)}>
                  <span className="bell-dot" aria-hidden="true" />
                  <span>
                    <b>{n.title}</b>
                    <small>{STATUS[n.status]} · {ago(n.at)}</small>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
