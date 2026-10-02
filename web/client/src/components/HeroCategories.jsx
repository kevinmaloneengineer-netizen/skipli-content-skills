import { useState } from "react";
import { CATEGORIES, skillById } from "../lib/constants.js";
import { shortCount, useInterval, useTypewriter } from "../lib/live.js";

// The three skill types as floating preview cards around the phone at the end
// of the opening scene. Each mini illustration keeps running while on screen
// (`live`): a leaderboard that re-ranks, a caption being typed, a posting calendar.

/** Live leaderboard: values climb, bars grow, rows slide when ranks change. */
function RankingViz({ live }) {
  const [rows, setRows] = useState([
    { t: "Lỗi SEO khiến web không lên top", v: 5500 },
    { t: "3 công cụ AI viết content", v: 3700 },
    { t: "Audit website trong 60 giây", v: 2300 },
  ]);
  const [beat, setBeat] = useState(0);
  useInterval(
    () => {
      setBeat((b) => b + 1);
      setRows((rs) => {
        const grown = rs.map((r) => ({ ...r, v: Math.round(r.v + 40 + Math.random() * 260) }));
        // Every third beat a lower row overtakes the one above it, so the ranking keeps moving.
        if ((beat + 1) % 3 === 0) {
          const order = [...grown].sort((a, b) => b.v - a.v);
          const climber = order[1 + Math.floor(Math.random() * (order.length - 1))];
          const above = order[order.indexOf(climber) - 1];
          climber.v = above.v + 120 + Math.round(Math.random() * 380);
        }
        return grown;
      });
    },
    1600,
    live,
  );
  const max = Math.max(...rows.map((r) => r.v));
  const rank = [...rows].sort((a, b) => b.v - a.v);
  return (
    <div className="hc-rank" style={{ height: rows.length * 26 }}>
      {rows.map((r) => {
        const pos = rank.indexOf(r);
        return (
          <div key={r.t} className="hc-rank-row" style={{ transform: `translateY(${pos * 26}px)` }}>
            <span className="hc-rank-n">{pos + 1}</span>
            <span className="hc-rank-t">{r.t}</span>
            <span className="hc-rank-bar"><i style={{ width: `${(r.v / max) * 100}%` }} /></span>
            <span key={shortCount(r.v)} className="hc-rank-v tick">{shortCount(r.v)}</span>
          </div>
        );
      })}
    </div>
  );
}

const CAPTIONS = [
  "Bạn chạy quảng cáo mỗi tháng nhưng đơn vẫn lèo tèo?",
  "5 cách viết dòng đầu khiến khách dừng lướt 👇",
  "Tháng trước, một shop nhỏ nhờ mình xem lại fanpage…",
];

/** A caption typed out, erased and replaced; the variant pills follow along. */
function TypingViz({ live }) {
  const [text, i] = useTypewriter(CAPTIONS, { active: live });
  return (
    <div className="hc-type">
      <p>
        {text}
        <span className="caret" />
      </p>
      <div className="hc-variants">
        {CAPTIONS.map((_, k) => (
          <span key={k} className={k === i ? "on" : undefined}>
            {k === 0 ? "Phương án 1" : k + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const SLOTS = { 1: "8:00", 3: "20:00", 5: "11:30" };

/** A cursor walks the week; scheduled days flip to "posted" as it passes. */
function CalendarViz({ live }) {
  const [day, setDay] = useState(3);
  useInterval(() => setDay((d) => (d + 1) % (DAYS.length + 2)), 900, live); // two idle beats before restarting
  const at = SLOTS[day];
  const status = day >= DAYS.length ? "Đã lên lịch cả tuần ✓" : at ? `Đang đăng bài ${DAYS[day]} · ${at}…` : `${DAYS[day]}: không có lịch`;
  return (
    <>
      <div className="hc-cal">
        {DAYS.map((d, i) => {
          const cls = ["hc-day", SLOTS[i] && "has", i === day && "cursor", SLOTS[i] && i < day && "posted"].filter(Boolean).join(" ");
          return (
            <div key={d} className={cls}>
              <span>{d}</span>
              {SLOTS[i] && <em>{SLOTS[i] && i < day ? "✓" : SLOTS[i]}</em>}
            </div>
          );
        })}
      </div>
      <div key={status} className="hc-cal-status">{status}</div>
    </>
  );
}

const VIZ = { research: RankingViz, create: TypingViz, organize: CalendarViz };

const INSIGHTS = [
  "Bài này viral nhờ hook 3 giây đầu + câu hỏi kéo bình luận.",
  "Đối thủ A hay đăng review thật, thử góc “trước / sau” của bạn.",
  "Caption ngắn, một ý, kết bằng câu hỏi đang ăn tương tác tốt.",
  "Video dưới 1 phút đang được xem hết nhiều nhất tuần này.",
];

function AiNote({ live }) {
  const [text] = useTypewriter(INSIGHTS, { active: live, typeMs: 28, holdMs: 2600 });
  return (
    <div className="hc-ai">
      <span className="hc-ai-badge">AI</span>
      <span>
        {text}
        <span className="caret light" />
      </span>
    </div>
  );
}

export default function HeroCategories({ live }) {
  return (
    <div className="hero-cats" aria-hidden="true">
      {CATEGORIES.map((c) => {
        const Viz = VIZ[c.id];
        return (
          <div key={c.id} className="hc" data-cat={c.id}>
            <div className="hc-head">
              <span className="hc-tag">{c.tag}</span>
              {c.id === "research" ? <span className="hc-live">LIVE</span> : <span className="hc-count">{c.skills.length} công cụ</span>}
            </div>
            <div className="hc-title">{c.title}</div>
            <Viz live={live} />
            <div className="hc-chips">
              {c.skills.map((id) => {
                const s = skillById(id);
                return (
                  <span key={id} data-tone={s.tone}>
                    <i />
                    {s.short}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <AiNote live={live} />
    </div>
  );
}
