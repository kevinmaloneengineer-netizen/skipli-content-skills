import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { CATEGORIES, SKILLS, skillById } from "../lib/constants.js";
import { ago } from "../lib/format.js";
import { GUIDE } from "../lib/skillGuide.js";
import { CountUp } from "../components/CountUp.jsx";
import SkillArt from "../components/SkillArt.jsx";

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} triệu` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} nghìn` : String(n));

/** Every skill on one page: runs, results, tokens and the last run, grouped the way the home page groups them. */
export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api("/dashboard").then(setData, () => setFailed(true));
  }, []);

  if (failed) return <main className="dash"><p className="form-error">Chưa tải được số liệu. Thử tải lại trang.</p></main>;
  if (!data) return <main className="dash"><p className="hint">Đang tải…</p></main>;

  const { totals, byType } = data;
  const statsOf = (skill) => byType[skill.type] ?? { runs: 0, done: 0, failed: 0, live: 0, tokens: 0, last: null };
  const ids = new Set(CATEGORIES.flatMap((c) => c.skills));
  const loose = SKILLS.filter((s) => !ids.has(s.id));
  const ok = totals.runs ? Math.round((totals.done / totals.runs) * 100) : 0;
  const groups = [...CATEGORIES.map((c) => ({ id: c.id, title: c.title, desc: c.desc, skills: c.skills.map(skillById).filter(Boolean) })), ...(loose.length ? [{ id: "other", title: "Khác", skills: loose }] : [])];

  return (
    <main className="dash">
      <section className="dash-hero">
        <div className="dash-hero-text">
          <span className="dash-kicker">Tổng quan</span>
          <h1>{SKILLS.length} công cụ, và cách chúng đang làm việc cho bạn</h1>
          <p>Mỗi thẻ là một công cụ: số lần chạy, tỉ lệ xong và lượng token đã dùng. Bấm vào thẻ để mở công cụ.</p>
        </div>
        <div className="dash-stats">
          <div><b><CountUp value={totals.runs} /></b><span>lần chạy</span></div>
          <div><b><CountUp value={totals.today} /></b><span>hôm nay</span></div>
          <div><b><CountUp value={ok} suffix="%" /></b><span>thành công</span></div>
          <div className={totals.failed ? "is-bad" : undefined}><b><CountUp value={totals.failed} /></b><span>lỗi</span></div>
        </div>
        <small className="dash-tokens">Đã dùng {compact(totals.tokens)} token của AI miễn phí.</small>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="dash-group">
          <h2><span>{group.title}</span><small>{group.skills.length} công cụ</small></h2>
          {group.desc && <p className="dash-group-desc">{group.desc}</p>}
          <div className="dash-grid">
            {group.skills.map((skill) => {
              const s = statsOf(skill);
              return (
                <Link key={skill.id} to={skill.path} className="dash-card" data-tone={skill.tone}>
                  <span className="dash-art" aria-hidden="true"><SkillArt id={skill.id} /></span>
                  <div className="dash-card-body">
                    <div className="dash-card-head">
                      <b>{skill.title}</b>
                      {s.live > 0 && <span className="dash-live">{s.live} đang chạy</span>}
                    </div>
                    <p className="dash-does">{GUIDE[skill.id]?.output?.[0] ?? skill.pitch}</p>
                    <small>{s.last ? `Gần nhất ${ago(s.last)}` : "Chưa chạy lần nào"}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
