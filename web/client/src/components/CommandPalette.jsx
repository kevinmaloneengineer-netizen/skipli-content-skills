import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { api } from "../lib/api.js";
import { SKILLS, skillByType, STATUS } from "../lib/constants.js";
import { ago } from "../lib/format.js";
import { FLOWS } from "../lib/workflows.js";

/** Lowercase, no Vietnamese accents: "Viết" matches "viet". */
export const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

/** Cmd/Ctrl+K: jump to a tool, a flow, a past run or a saved post. */
export default function CommandPalette({ open, onClose, onToggleTheme }) {
  const navigate = useNavigate();
  const { jobs } = useJobs();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState([]);
  const input = useRef(null);
  const list = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    requestAnimationFrame(() => input.current?.focus());
    api("/library?kind=saved").then(({ items }) => setSaved(items), () => setSaved([]));
  }, [open]);

  const items = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const all = [
      ...SKILLS.map((s) => ({ group: "Công cụ", key: `s-${s.id}`, label: s.title, hint: s.status === "soon" ? "Sắp có" : s.eta, tone: s.tone, to: s.path, words: `${s.short} ${s.pitch}` })),
      ...FLOWS.map((f) => ({ group: "Bắt đầu nhanh", key: `f-${f.id}`, label: f.title, hint: f.hint, to: f.to, words: f.hint })),
      ...jobs.slice(0, terms.length ? 30 : 5).map((j) => ({ group: "Kết quả đã chạy", key: `j-${j.id}`, label: j.title, hint: `${STATUS[j.status]} · ${ago(j.createdAt)}`, tone: skillByType(j.type)?.tone, to: `/jobs/${j.id}`, words: "" })),
      ...(terms.length ? saved.slice(0, 30) : []).map((x) => ({ group: "Bài đã lưu", key: `l-${x.id}`, label: x.title, hint: (x.tags ?? []).join(", "), to: `/library?kind=saved&q=${encodeURIComponent(x.title)}`, words: x.body?.slice(0, 300) })),
      { group: "Cài đặt", key: "theme", label: "Đổi giao diện sáng / tối", run: onToggleTheme, words: "giao dien sang toi dark light theme" },
      { group: "Cài đặt", key: "history", label: "Mở Lịch sử", to: "/history", words: "history" },
      { group: "Cài đặt", key: "library", label: "Mở Thư viện", to: "/library", words: "library mau" },
    ];
    return all.filter((it) => terms.every((t) => fold(`${it.label} ${it.words}`).includes(t))).slice(0, 40);
  }, [q, jobs, saved, onToggleTheme]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function pick(it) {
    onClose();
    if (it.run) it.run();
    else navigate(it.to);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";
  return (
    <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Tìm nhanh">
        <div className="cmdk-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Tìm công cụ, kết quả cũ, bài đã lưu…" aria-label="Tìm nhanh" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={items[active]?.key} />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {items.length === 0 && <div className="cmdk-empty">Không tìm thấy “{q}”.</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {head && <div className="cmdk-group">{it.group}</div>}
                <button type="button" id={it.key} role="option" aria-selected={i === active} data-active={i === active} className="cmdk-item" data-tone={it.tone} onMouseMove={() => setActive(i)} onClick={() => pick(it)}>
                  <span className="cmdk-dot" aria-hidden="true" />
                  <span className="cmdk-label">{it.label}</span>
                  {it.hint && <small>{it.hint}</small>}
                  <i aria-hidden="true">↵</i>
                </button>
              </div>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> chọn</span>
          <span><kbd>↵</kbd> mở</span>
          <span><kbd>⌘</kbd><kbd>K</kbd> mở lại bất cứ lúc nào</span>
        </div>
      </div>
    </div>
  );
}
