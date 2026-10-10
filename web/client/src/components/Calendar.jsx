import { useEffect, useMemo, useRef, useState } from "react";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { addDays, at, dayLabel, fromYmd, GOOD_TIMES, hm, sameDay, startOfMonth, startOfWeek, WEEKDAY_SHORT, ymd } from "../lib/dates.js";
import { PILLARS } from "../lib/text.js";
import { CopyIcon } from "./Icons.jsx";

const PLATFORMS = { facebook: "Facebook", instagram: "Instagram", threads: "Threads", tiktok: "TikTok" };
const PILLAR_NAME = Object.fromEntries([...PILLARS.map((p) => [p.id, p.name]), ["other", "Khác"]]);

function SlotDialog({ slot, day, onClose, onSaved, onDeleted }) {
  const ref = useRef(null);
  const copy = useCopy();
  const toast = useToast();
  const when = slot ? new Date(slot.at) : null;
  const [form, setForm] = useState({
    title: slot?.title ?? "",
    body: slot?.body ?? "",
    date: ymd(when ?? day),
    time: when ? hm(when) : "19:30",
    platform: slot?.platform ?? "facebook",
    pillar: slot?.pillar ?? "",
    status: slot?.status ?? "planned",
    note: slot?.note ?? "",
  });
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const [fbReady, setFbReady] = useState(false); // FB_PAGE_ID + FB_PAGE_TOKEN set on the server
  const [publishing, setPublishing] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    api("/library?kind=saved").then(({ items }) => setSaved(items), () => setSaved([]));
    api("/facebook").then(({ configured }) => setFbReady(configured), () => {});
  }, []);

  /** Send this slot to the Facebook Page: now, or handed to Facebook's scheduler when it is 11+ minutes ahead. */
  async function publish() {
    const ahead = new Date(at(fromYmd(form.date), form.time)).getTime() - Date.now();
    const when = ahead > 11 * 60_000 ? `lên lịch đăng lúc ${form.time} ngày ${form.date.split("-").reverse().join("/")}` : "đăng ngay bây giờ";
    if (!window.confirm(`Gửi bài này lên Facebook Page và ${when}?`)) return;
    setPublishing(true);
    setError("");
    try {
      // Save the form first so Facebook gets the text and time shown here.
      await api(`/schedule/${slot.id}`, { method: "PUT", body: { title: form.title, body: form.body, at: at(fromYmd(form.date), form.time) } });
      const res = await api(`/schedule/${slot.id}/publish`, { method: "POST" });
      onSaved(res.slot);
      toast(res.scheduled ? "Đã lên lịch trên Facebook. Tới giờ Facebook tự đăng." : "Đã đăng lên Facebook Page");
      ref.current.close();
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { title: form.title, body: form.body, note: form.note, platform: form.platform, status: form.status, at: at(fromYmd(form.date), form.time), pillar: form.pillar || undefined };
      const res = slot ? await api(`/schedule/${slot.id}`, { method: "PUT", body }) : await api("/schedule", { method: "POST", body });
      onSaved(res.slot ?? res.slots[0]);
      ref.current.close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Xoá bài này khỏi lịch?")) return;
    try {
      await api(`/schedule/${slot.id}`, { method: "DELETE" });
      onDeleted(slot.id);
      ref.current.close();
    } catch (err) {
      toast(err.message, { kind: "error" });
    }
  }

  return (
    <dialog ref={ref} className="cal-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <form className="cal-dialog-inner" onSubmit={submit}>
        <header>
          <h2>{slot ? "Sửa bài trong lịch" : "Thêm bài vào lịch"}</h2>
          <button type="button" className="btn ghost small" onClick={() => ref.current.close()} aria-label="Đóng">✕</button>
        </header>
        <div className="cal-dialog-body">
          {!slot && saved.length > 0 && (
            <label className="field">
              <span className="field-label">Lấy từ thư viện (tuỳ chọn)</span>
              <select defaultValue="" onChange={(e) => { const x = saved.find((s) => s.id === e.target.value); if (x) setForm((f) => ({ ...f, title: x.title, body: x.body, platform: PLATFORMS[x.platform] ? x.platform : f.platform })); }}>
                <option value="">Chọn bài đã lưu…</option>
                {saved.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="field-label">Tiêu đề</span>
            <input value={form.title} onChange={set("title")} placeholder="Bài giới thiệu món mới" required autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Nội dung bài</span>
            <textarea rows={6} value={form.body} onChange={set("body")} placeholder="Dán hoặc viết nội dung sẽ đăng" />
          </label>
          <div className="row">
            <label className="field">
              <span className="field-label">Ngày</span>
              <input type="date" value={form.date} onChange={set("date")} required />
            </label>
            <label className="field">
              <span className="field-label">Giờ</span>
              <input type="time" value={form.time} onChange={set("time")} required />
            </label>
          </div>
          <div className="cal-times">
            <span>Giờ khách hay online:</span>
            {GOOD_TIMES.map((t) => (
              <button key={t} type="button" className={form.time === t ? "on" : undefined} onClick={() => set("time")(t)}>{t}</button>
            ))}
          </div>
          <div className="row">
            <label className="field">
              <span className="field-label">Nền tảng</span>
              <select value={form.platform} onChange={set("platform")}>{Object.entries(PLATFORMS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </label>
            <label className="field">
              <span className="field-label">Nhóm nội dung</span>
              <select value={form.pillar} onChange={set("pillar")}>
                <option value="">Không chọn</option>
                {PILLARS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          {slot?.fbPostId ? (
            <p className="cal-fb-done">{slot.status === "scheduled" ? "✓ Đã gửi lên Facebook, Facebook sẽ tự đăng đúng giờ. Sửa ở đây không đổi bài trên Facebook." : "✓ Đã đăng lên Facebook Page."}</p>
          ) : (
            <label className="check-row">
              <input type="checkbox" checked={form.status === "posted"} onChange={(e) => set("status")(e.target.checked ? "posted" : "planned")} />
              <span>Đã đăng</span>
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <footer>
          <div className="actions">
            {slot && <button type="button" className="btn danger small" onClick={remove}>Xoá</button>}
            {form.body && <button type="button" className="btn small" onClick={() => copy(form.body)}><CopyIcon />Sao chép bài</button>}
            {slot && fbReady && !slot.fbPostId && form.platform === "facebook" && (
              <button type="button" className="btn small fb-publish" disabled={publishing || !form.body.trim()} onClick={publish} title={form.body.trim() ? "Đăng lên Facebook Page đã kết nối" : "Thêm nội dung bài trước"}>
                {publishing ? "Đang gửi…" : "Đăng lên Facebook"}
              </button>
            )}
          </div>
          <button className="btn primary" disabled={busy}>{busy ? "Đang lưu…" : slot ? "Lưu thay đổi" : "Thêm vào lịch"}</button>
        </footer>
      </form>
    </dialog>
  );
}

function SlotChip({ s, onOpen, compact }) {
  const t = hm(new Date(s.at));
  return (
    <button type="button" className="cal-slot" data-pillar={s.pillar ?? "other"} data-status={s.status} draggable onDragStart={(e) => { e.dataTransfer.setData("text/slot", s.id); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onOpen(s)} title={s.title}>
      <span className="cal-slot-time">{t}</span>
      <span className="cal-slot-title">{s.title}</span>
      {!compact && <span className="cal-slot-meta">{PLATFORMS[s.platform] ?? s.platform}{s.pillar ? ` · ${PILLAR_NAME[s.pillar]}` : ""}</span>}
      {s.status === "posted" && <i className="cal-done" aria-label="Đã đăng">✓</i>}
      {s.status === "scheduled" && <i className="cal-done is-fb" aria-label="Đã lên lịch trên Facebook">f</i>}
    </button>
  );
}

/** Week / month posting calendar with drag-and-drop between days. `version` bumps force a reload. */
export default function Calendar({ initial, version = 0 }) {
  const toast = useToast();
  const [view, setView] = useState("week");
  const [cursor, setCursor] = useState(() => (initial ? fromYmd(initial) : new Date()));
  const [slots, setSlots] = useState([]);
  const [dialog, setDialog] = useState(null); // { slot } | { day }
  const [over, setOver] = useState("");
  const today = new Date();

  const days = useMemo(() => {
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
    const first = startOfWeek(startOfMonth(cursor));
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [view, cursor]);
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);

  useEffect(() => {
    api(`/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`).then(({ slots: s }) => setSlots(s), (e) => toast(e.message, { kind: "error" }));
  }, [from.getTime(), to.getTime(), version]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = (d) => slots.filter((s) => sameDay(new Date(s.at), d)).sort((a, b) => a.at.localeCompare(b.at));
  const posted = slots.filter((s) => s.status === "posted").length;

  async function drop(e, d) {
    e.preventDefault();
    setOver("");
    const id = e.dataTransfer.getData("text/slot");
    const s = slots.find((x) => x.id === id);
    if (!s || sameDay(new Date(s.at), d)) return;
    const moved = at(d, hm(new Date(s.at)));
    setSlots((all) => all.map((x) => (x.id === id ? { ...x, at: moved } : x)));
    try {
      await api(`/schedule/${id}`, { method: "PUT", body: { at: moved } });
      toast(`Đã chuyển sang ${dayLabel(d)}`);
    } catch (err) {
      setSlots((all) => all.map((x) => (x.id === id ? s : x)));
      toast(err.message, { kind: "error" });
    }
  }

  const move = (n) => setCursor((c) => (view === "week" ? addDays(c, 7 * n) : new Date(c.getFullYear(), c.getMonth() + n, 1)));
  const title = view === "week" ? `${days[0].getDate()}/${days[0].getMonth() + 1} đến ${days[6].getDate()}/${days[6].getMonth() + 1}/${days[6].getFullYear()}` : `Tháng ${cursor.getMonth() + 1}, ${cursor.getFullYear()}`;

  return (
    <section className="cal card" data-view={view}>
      <header className="cal-head">
        <div className="cal-nav">
          <button type="button" className="btn small" onClick={() => move(-1)} aria-label="Trước">←</button>
          <button type="button" className="btn small" onClick={() => setCursor(new Date())}>Hôm nay</button>
          <button type="button" className="btn small" onClick={() => move(1)} aria-label="Sau">→</button>
          <h2>{title}</h2>
        </div>
        <div className="cal-tools">
          <span className="cal-count">{slots.length} bài · {posted} đã đăng</span>
          <div className="ib-seg" role="group" aria-label="Chế độ xem">
            <button type="button" className={view === "week" ? "on" : undefined} onClick={() => setView("week")}>Tuần</button>
            <button type="button" className={view === "month" ? "on" : undefined} onClick={() => setView("month")}>Tháng</button>
          </div>
          <button type="button" className="btn primary small" onClick={() => setDialog({ day: view === "week" && !days.some((d) => sameDay(d, today)) ? days[0] : today })}>+ Thêm bài</button>
        </div>
      </header>
      <div className="cal-grid">
        {view === "month" && WEEKDAY_SHORT.slice(1).concat("CN").map((w) => <div key={w} className="cal-wd">{w}</div>)}
        {days.map((d) => {
          const list = byDay(d);
          const key = ymd(d);
          const out = view === "month" && d.getMonth() !== cursor.getMonth();
          return (
            <div key={key} className={["cal-day", sameDay(d, today) && "is-today", out && "is-out", over === key && "is-over", d < addDays(today, -1) && !sameDay(d, today) && "is-past"].filter(Boolean).join(" ")}
              onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver((o) => (o === key ? "" : o))} onDrop={(e) => drop(e, d)}>
              <div className="cal-day-head">
                {view === "week" ? <><span>{WEEKDAY_SHORT[d.getDay()]}</span><b>{d.getDate()}</b></> : <b>{d.getDate()}</b>}
                <button type="button" className="cal-add" onClick={() => setDialog({ day: d })} aria-label={`Thêm bài ${dayLabel(d)}`}>+</button>
              </div>
              <div className="cal-day-list">
                {(view === "month" ? list.slice(0, 3) : list).map((s) => <SlotChip key={s.id} s={s} compact={view === "month"} onOpen={(slot) => setDialog({ slot })} />)}
                {view === "month" && list.length > 3 && <button type="button" className="cal-more" onClick={() => { setCursor(d); setView("week"); }}>+{list.length - 3} bài</button>}
                {view === "week" && list.length === 0 && <span className="cal-empty">Trống</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="cal-hint">Kéo một bài sang ngày khác để đổi lịch. Bấm vào bài để sửa, sao chép nội dung hoặc đánh dấu đã đăng.</p>
      {dialog && (
        <SlotDialog
          slot={dialog.slot}
          day={dialog.day}
          onClose={() => setDialog(null)}
          onSaved={(s) => setSlots((all) => (all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? s : x)) : [...all, s]))}
          onDeleted={(id) => setSlots((all) => all.filter((x) => x.id !== id))}
        />
      )}
    </section>
  );
}
