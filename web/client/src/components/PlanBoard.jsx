import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { addDays, at, dayLabel, fromYmd } from "../lib/dates.js";
import { PILLARS, splitPlan, toPlainText } from "../lib/text.js";
import { CopyIcon } from "./Icons.jsx";
import Markdown from "./Markdown.jsx";

const PILLAR_NAME = Object.fromEntries([...PILLARS.map((p) => [p.id, p.name]), ["other", "Khác"]]);

/** AI posting plan: slots grouped by day, add one or all of them to the calendar. */
export default function PlanBoard({ job }) {
  const copy = useCopy();
  const toast = useToast();
  const { intro, slots, notes } = useMemo(() => splitPlan(job.result), [job.result]);
  const [added, setAdded] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const start = fromYmd(job.input.start);

  if (!slots.length) return <Markdown className="card md">{job.result}</Markdown>;

  const toSlot = (s) => ({ title: s.title, body: toPlainText(s.body), platform: job.input.platform === "tiktok" ? "tiktok" : job.input.platform, pillar: s.pillar === "other" ? undefined : s.pillar, at: at(addDays(start, s.day - 1), s.time), sourceJobId: job.id });
  const keyOf = (s) => `${s.day}-${s.time}-${s.title}`;

  async function add(list) {
    setBusy(true);
    try {
      await api("/schedule", { method: "POST", body: { slots: list.map(toSlot) } });
      setAdded((a) => new Set([...a, ...list.map(keyOf)]));
      toast(list.length > 1 ? `Đã thêm ${list.length} bài vào lịch` : "Đã thêm vào lịch", { to: `/schedule?week=${job.input.start}` });
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const days = [...new Set(slots.map((s) => s.day))].sort((a, b) => a - b);
  const left = slots.filter((s) => !added.has(keyOf(s)));

  return (
    <>
      <div className="cb-bar">
        <p>{intro ? toPlainText(intro) : `${slots.length} bài cho ${days.length} ngày.`}</p>
        <div className="actions">
          <Link className="btn" to={`/schedule?week=${job.input.start}`}>Mở lịch</Link>
          <button className="btn primary" disabled={busy || !left.length} onClick={() => add(left)}>{left.length ? `Thêm tất cả vào lịch (${left.length})` : "Đã thêm hết"}</button>
        </div>
      </div>
      <ol className="plan-days">
        {days.map((d) => (
          <li key={d} className="plan-day">
            <div className="plan-date">
              <b>Ngày {d}</b>
              <span>{dayLabel(addDays(start, d - 1))}</span>
            </div>
            <div className="plan-slots">
              {slots.filter((s) => s.day === d).map((s) => (
                <section key={keyOf(s)} className="card plan-slot" data-pillar={s.pillar}>
                  <div className="plan-slot-head">
                    <span className="plan-time">{s.time}</span>
                    <span className="cb-pill">{PILLAR_NAME[s.pillar]}</span>
                    <h3>{s.title}</h3>
                    <div className="actions">
                      <button className="btn small" onClick={() => copy(toPlainText(s.body))}><CopyIcon />Sao chép</button>
                      <button className="btn small" disabled={busy || added.has(keyOf(s))} onClick={() => add([s])}>{added.has(keyOf(s)) ? "Đã thêm ✓" : "Thêm vào lịch"}</button>
                    </div>
                  </div>
                  <Markdown>{s.body}</Markdown>
                </section>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {notes && <Markdown className="card md notes">{notes}</Markdown>}
    </>
  );
}
