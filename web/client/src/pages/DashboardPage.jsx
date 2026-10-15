import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { CATEGORIES, SKILLS, skillById, skillByType } from "../lib/constants.js";
import { ago } from "../lib/format.js";
import { GUIDE } from "../lib/skillGuide.js";
import { CountUp } from "../components/CountUp.jsx";
import SkillArt from "../components/SkillArt.jsx";
import { useAuth } from "../components/AuthGate.jsx";
import { fold } from "../components/CommandPalette.jsx";
import { StatusBadge } from "../components/JobBits.jsx";

const EMPTY = { totals: { runs: 0, today: 0, done: 0, failed: 0, live: 0, tokens: 0 }, byType: {}, days: [], recent: [] };

/**
 * Tile sizes of a group's bento: the first is big (2x2), then wide (2x1) and small (1x1) in turn. Small
 * tiles are widened from the end until the cells fill whole rows of 4, so no row ends with a hole.
 */
export function tileSizes(n) {
  const sizes = Array.from({ length: n }, (_, i) => (i === 0 ? "big" : i % 3 === 1 ? "wide" : "small"));
  const cells = (x) => ({ big: 4, wide: 2, small: 1 })[x];
  let total = sizes.reduce((a, x) => a + cells(x), 0);
  for (let i = n - 1; i > 0 && total % 4; i--) {
    if (sizes[i] === "small") {
      sizes[i] = "wide";
      total++;
    }
  }
  return sizes;
}

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} triệu` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} nghìn` : String(n));

/** Every skill on one page: runs, results, tokens and the last run, grouped the way the home page groups them. */
export default function DashboardPage() {
  const { guest } = useAuth();
  const [data, setData] = useState(guest ? EMPTY : null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  // A guest sees every tool and what it does; the numbers are per account, so they come after a login.
  useEffect(() => {
    if (!guest) api("/dashboard").then(setData, () => setFailed(true));
  }, [guest]);

  if (failed) return <main className="dash"><p className="form-error">Chưa tải được số liệu. Thử tải lại trang.</p></main>;
  if (!data) return <main className="dash"><p className="hint">Đang tải…</p></main>;

  const { totals, byType } = data;
  const statsOf = (skill) => byType[skill.type] ?? { runs: 0, done: 0, failed: 0, live: 0, tokens: 0, last: null };
  const ids = new Set(CATEGORIES.flatMap((c) => c.skills));
  const loose = SKILLS.filter((s) => !ids.has(s.id));
  const ok = totals.runs ? Math.round((totals.done / totals.runs) * 100) : 0;
  const groups = [...CATEGORIES.map((c) => ({ id: c.id, title: c.title, desc: c.desc, skills: c.skills.map(skillById).filter(Boolean) })), ...(loose.length ? [{ id: "other", title: "Khác", skills: loose }] : [])];
  // The featured tile of a group: the tool used most (signed in), else the group's first tool.
  const orderFor = (skills) => {
    if (guest || !skills.length) return skills;
    const best = skills.reduce((a, b) => (statsOf(b).runs > statsOf(a).runs ? b : a), skills[0]);
    return statsOf(best).runs ? [best, ...skills.filter((x) => x !== best)] : skills;
  };
  const doesOf = (skill) => GUIDE[skill.id]?.output?.[0] ?? skill.pitch;
  const needle = fold(q.trim());
  const match = (skill) => !needle || fold(`${skill.title} ${skill.short} ${skill.pitch} ${doesOf(skill)}`).includes(needle);
  const shown = groups.filter((g) => tab === "all" || g.id === tab).map((g) => ({ ...g, skills: g.skills.filter(match) })).filter((g) => g.skills.length);

  return (
    <main className="dash">
      <section className="dash-hero">
        <div className="dash-hero-text">
          <span className="dash-kicker">Tổng quan</span>
          <h1>{SKILLS.length} công cụ, và cách chúng đang làm việc cho bạn</h1>
          <p>{guest ? "Mỗi thẻ là một công cụ và việc nó làm được. Đăng nhập để dùng công cụ và xem số lần chạy của bạn." : "Mỗi thẻ là một công cụ: số lần chạy, tỉ lệ xong và lượng token đã dùng. Bấm vào thẻ để mở công cụ."}</p>
        </div>
        {guest ? (
          <div className="dash-guest">
            <Link className="btn primary" to="/login?next=%2Fdashboard">Đăng nhập</Link>
          </div>
        ) : (
        <>
        <div className="dash-stats">
          <div><b><CountUp value={totals.runs} /></b><span>lần chạy</span></div>
          <div><b><CountUp value={totals.today} /></b><span>hôm nay</span></div>
          <div><b><CountUp value={ok} suffix="%" /></b><span>thành công</span></div>
          <div className={totals.failed ? "is-bad" : undefined}><b><CountUp value={totals.failed} /></b><span>lỗi</span></div>
        </div>
        <small className="dash-tokens">Đã dùng {compact(totals.tokens)} token của AI miễn phí.</small>
        </>
        )}
      </section>

      {!guest && <Activity data={data} />}

      <div className="dash-tools-head">
        <div className="dash-tabs" role="tablist" aria-label="Nhóm công cụ">
          {[{ id: "all", title: "Tất cả" }, ...groups].map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={tab === g.id} className={tab === g.id ? "on" : undefined} onClick={() => setTab(g.id)}>
              {g.title}
              <small>{g.id === "all" ? SKILLS.length : g.skills.length}</small>
            </button>
          ))}
        </div>
        <label className="dash-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm công cụ: video, review, hashtag…" aria-label="Tìm công cụ" />
        </label>
      </div>
      {shown.length === 0 && <p className="dash-empty">Không có công cụ nào khớp “{q}”.</p>}

      {shown.map((group) => (
        <section key={group.id} className="dash-group">
          <h2><span>{group.title}</span><small>{group.skills.length} công cụ</small></h2>
          {group.desc && <p className="dash-group-desc">{group.desc}</p>}
          <div className="dash-bento">
            {(() => { const list = orderFor(group.skills); const sizes = tileSizes(list.length); return list.map((skill, i) => {
              const s = statsOf(skill);
              const size = sizes[i];
              const guide = GUIDE[skill.id];
              return (
                <Link key={skill.id} to={skill.path} className={`dash-tile is-${size}`} data-tone={skill.tone}>
                  <span className="dash-tile-art" aria-hidden="true"><SkillArt id={skill.id} /></span>
                  <div className="dash-tile-body">
                    <div className="dash-card-head">
                      <b>{skill.title}</b>
                      {s.live > 0 && <span className="dash-live">{s.live} đang chạy</span>}
                    </div>
                    <p className="dash-does">{size === "big" ? skill.pitch : doesOf(skill)}</p>
                    {size !== "small" && guide?.perks && (
                      <div className="dash-perks">{guide.perks.map((x) => <span key={x}>{x}</span>)}</div>
                    )}
                    {size === "big" && guide?.output && (
                      <ul className="dash-gets">{guide.output.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>
                    )}
                    {size !== "small" && (
                      <div className="dash-tile-foot">
                        <small>{guest ? skill.eta && `Thường ${skill.eta}` : s.last ? `Gần nhất ${ago(s.last)}` : "Chưa chạy lần nào"}</small>
                        {size === "big" && <span className="dash-open">Mở công cụ →</span>}
                      </div>
                    )}
                  </div>
                </Link>
              );
            }); })()}
          </div>
        </section>
      ))}
    </main>
  );
}

/** Signed in: the last 14 days of runs, the most used tools, and the newest runs. */
function Activity({ data }) {
  const { days = [], recent = [], byType } = data;
  const peak = Math.max(1, ...days.map((d) => d.done + d.failed));
  const top = useMemo(
    () => Object.entries(byType).map(([type, x]) => ({ skill: skillByType(type), runs: x.runs })).filter((x) => x.skill).sort((a, b) => b.runs - a.runs).slice(0, 5),
    [byType],
  );
  const most = Math.max(1, ...top.map((x) => x.runs));
  const week = days.slice(-7).reduce((a, d) => a + d.done + d.failed, 0);
  const label = (day) => `${Number(day.slice(8, 10))}/${Number(day.slice(5, 7))}`;
  return (
    <section className="dash-activity">
      <div className="dash-panel dash-chart">
        <header>
          <h3>Hoạt động 14 ngày</h3>
          <small>{week} lần chạy trong 7 ngày qua</small>
        </header>
        <div className="dash-bars" role="img" aria-label="Số lần chạy mỗi ngày trong 14 ngày qua">
          {days.map((d, i) => {
            const total = d.done + d.failed;
            return (
              <div key={d.day} className={i === days.length - 1 ? "dash-bar-col is-today" : "dash-bar-col"} title={`${label(d.day)}: ${d.done} xong, ${d.failed} lỗi`}>
                <span className="dash-bar-n">{total || ""}</span>
                <span className="dash-bar-stack" style={{ height: `${(total / peak) * 100}%` }}>
                  {d.failed > 0 && <i className="is-failed" style={{ flexGrow: d.failed }} />}
                  {d.done > 0 && <i style={{ flexGrow: d.done }} />}
                </span>
                <span className="dash-bar-day">{i % 2 === days.length % 2 ? label(d.day) : ""}</span>
              </div>
            );
          })}
        </div>
        <div className="dash-legend"><span><i />Hoàn tất</span><span><i className="is-failed" />Lỗi</span></div>
      </div>

      <div className="dash-panel">
        <header><h3>Dùng nhiều nhất</h3></header>
        {top.length === 0 && <p className="hint">Chưa có lần chạy nào.</p>}
        <ol className="dash-top">
          {top.map(({ skill, runs }) => (
            <li key={skill.id} data-tone={skill.tone}>
              <Link to={skill.path}>{skill.title}</Link>
              <b>{runs}</b>
              <span className="dash-top-bar"><i style={{ width: `${(runs / most) * 100}%` }} /></span>
            </li>
          ))}
        </ol>
      </div>

      <div className="dash-panel">
        <header>
          <h3>Gần đây</h3>
          <Link to="/history">Tất cả →</Link>
        </header>
        {recent.length === 0 && <p className="hint">Chưa có lần chạy nào.</p>}
        <ul className="dash-recent">
          {recent.map((j) => (
            <li key={j.id} data-tone={skillByType(j.type)?.tone}>
              <Link to={`/jobs/${j.id}`}>
                <span className="dash-recent-dot" aria-hidden="true" />
                <span className="dash-recent-text"><b>{j.title || skillByType(j.type)?.title}</b><small>{ago(j.createdAt)}</small></span>
                <StatusBadge status={j.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
