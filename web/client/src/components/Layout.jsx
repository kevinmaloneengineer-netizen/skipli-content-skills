import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { ACTIVE, CATEGORIES, skillById, skillByType, STATUS } from "../lib/constants.js";
import { ago } from "../lib/format.js";
import { useParallax } from "../lib/motion.js";
import { FLOWS } from "../lib/workflows.js";
import Backdrop from "./Backdrop.jsx";
import ChatWidget from "./ChatWidget.jsx";
import UserMenu from "./UserMenu.jsx";
import CommandPalette, { fold } from "./CommandPalette.jsx";
import Footer from "./Footer.jsx";
import HealthStatus from "./HealthStatus.jsx";
import { Bell, SearchButton, ThemeButton, useTheme } from "./NavExtras.jsx";

const GROUPS = CATEGORIES.map((c) => ({ ...c, items: c.skills.map(skillById).filter(Boolean) }));

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);
const I = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM17 20h2V6",
  plus: "M12 5v14M5 12h14",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
};

/** Typing in a field: global single-key shortcuts must not fire. */
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

function ToolMenu({ onPick }) {
  const { jobs } = useJobs();
  const [q, setQ] = useState("");
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const terms = fold(q).split(/\s+/).filter(Boolean);
  const match = (s) => terms.every((t) => fold(`${s.title} ${s.short} ${s.pitch}`).includes(t));
  const count = (s) => (s.type ? jobs.filter((j) => j.type === s.type) : []);
  const recent = jobs.slice(0, 3);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length);

  return (
    <>
      <label className="mega-search">
        <Icon d={I.search} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm công cụ: video, livestream, đối thủ…" aria-label="Tìm công cụ" />
        <kbd>/</kbd>
      </label>
      <div className="mega-body">
        <div className="mega-grid">
          {groups.length === 0 && <p className="mega-empty">Không có công cụ nào khớp “{q}”.</p>}
          {groups.map((g) => (
            <section key={g.id} className="mega-col">
              <h3>{g.title}</h3>
              {g.items.map((s) => {
                const runs = count(s);
                const active = runs.filter((j) => ACTIVE.has(j.status)).length;
                return (
                  <Link key={s.id} className={s.status === "soon" ? "mega-item is-soon" : "mega-item"} to={s.path} data-tone={s.tone} onClick={onPick}>
                    <span className="mega-dot" aria-hidden="true" />
                    <span className="mega-text">
                      <b>
                        {s.title}
                        {s.status === "soon" && <em>Sắp có</em>}
                        {active > 0 && <em className="live">{active} đang chạy</em>}
                        {!active && runs.length > 0 && <em className="count">{runs.length} lần</em>}
                      </b>
                      <small>{s.pitch}</small>
                    </span>
                  </Link>
                );
              })}
            </section>
          ))}
        </div>
        {!terms.length && (
          <aside className="mega-side">
            <h3><Icon d={I.bolt} />Bắt đầu nhanh</h3>
            {FLOWS.map((f) => (
              <Link key={f.id} to={f.to} className="mega-flow" onClick={onPick}>
                <span className="flow-steps" aria-hidden="true">
                  {f.steps.map((id) => (
                    <i key={id} data-tone={skillById(id)?.tone} />
                  ))}
                </span>
                <b>{f.title}</b>
                <small>{f.hint}</small>
              </Link>
            ))}
            {recent.length > 0 && (
              <>
                <h3><Icon d={I.clock} />Gần đây</h3>
                {recent.map((j) => (
                  <Link key={j.id} to={`/jobs/${j.id}`} className="mega-recent" data-tone={skillByType(j.type)?.tone} onClick={onPick}>
                    <span className="mega-recent-dot" aria-hidden="true" />
                    <span>
                      <b>{j.title}</b>
                      <small>{STATUS[j.status]} · {ago(j.createdAt)}</small>
                    </span>
                  </Link>
                ))}
              </>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

/**
 * After a deploy the open tab keeps running the old bundle (the app never reloads itself). Check the
 * served index every 2 minutes; when its script changed, the next page change reloads the app.
 */
function useFreshBundle(pathname) {
  const stale = useRef(false);
  useEffect(() => {
    const mine = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute("src");
    if (!mine) return; // dev server
    const check = () =>
      fetch("/", { cache: "no-store" })
        .then((r) => r.text())
        .then((html) => {
          const served = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
          if (served && served !== mine) stale.current = true;
        })
        .catch(() => {});
    const t = setInterval(check, 120_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  useEffect(() => {
    if (stale.current) window.location.reload();
  }, [pathname]);
}

export default function Layout() {
  const { jobs } = useJobs();
  const running = jobs.filter((j) => ACTIVE.has(j.status)).length;
  const { pathname, search } = useLocation();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { dark, toggle } = useTheme();
  const barRef = useRef(null);
  const closePalette = useCallback(() => setPalette(false), []);
  useParallax();

  useEffect(() => setMenu(false), [pathname, search]);
  // A new page starts at the top (the browser keeps the old scroll offset on client-side navigation).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⌘K / Ctrl+K: palette anywhere. "/": tools menu with search, unless typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMenu(false);
        setPalette((v) => !v);
      } else if (e.key === "/" && !typing(e) && !palette) {
        e.preventDefault();
        setMenu(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette]);

  useFreshBundle(pathname);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    const onDown = (e) => barRef.current && !barRef.current.contains(e.target) && setMenu(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [menu]);

  return (
    <div className="app">
      <Backdrop />
      <header ref={barRef} className={["topbar", scrolled && "is-scrolled", menu && "menu-open"].filter(Boolean).join(" ")}>
        <Link className="brand" to="/" onClick={() => pathname === "/" && window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img className="brand-logo" src="/logo.jpg" alt="" width="32" height="32" />
          <span>
            Skipli <em>Content</em>
          </span>
        </Link>
        <nav className="topnav" aria-label="Điều hướng">
          <button type="button" className={menu ? "nav-tools open" : "nav-tools"} aria-expanded={menu} aria-controls="tool-menu" onClick={() => setMenu((v) => !v)}>
            <Icon d={I.grid} />
            Công cụ
            <span className="nav-caret" aria-hidden="true" />
          </button>
          <NavLink to="/history"><Icon d={I.clock} />Lịch sử</NavLink>
          <NavLink to="/library"><Icon d={I.book} />Thư viện</NavLink>
        </nav>
        <div className="topbar-right">
          {running > 0 && (
            <Link className="running-pill" to="/history">
              <span className="pulse" aria-hidden="true" />
              {running} đang chạy
            </Link>
          )}
          <SearchButton onOpen={() => setPalette(true)} />
          <div className="icon-group">
            <Bell />
            <ThemeButton dark={dark} onToggle={toggle} />
          </div>
          <HealthStatus />
          <UserMenu />
          <span className="nav-sep" aria-hidden="true" />
          <Link className="btn primary nav-cta" to="/write"><Icon d={I.plus} />Tạo content</Link>
          <button type="button" className="nav-burger" aria-label={menu ? "Đóng menu" : "Mở menu"} aria-expanded={menu} aria-controls="tool-menu" onClick={() => setMenu((v) => !v)}>
            <Icon d={menu ? I.close : I.menu} />
          </button>
        </div>
        {menu && (
          <div className="mega" id="tool-menu">
            <ToolMenu onPick={() => setMenu(false)} />
            <div className="mega-foot">
              <Link to="/history" onClick={() => setMenu(false)}><Icon d={I.clock} />Lịch sử chạy</Link>
              <Link to="/library" onClick={() => setMenu(false)}><Icon d={I.book} />Thư viện</Link>
              <span><kbd>⌘</kbd><kbd>K</kbd> tìm cả kết quả cũ và bài đã lưu</span>
            </div>
          </div>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
      <CommandPalette open={palette} onClose={closePalette} onToggleTheme={toggle} />
    </div>
  );
}
