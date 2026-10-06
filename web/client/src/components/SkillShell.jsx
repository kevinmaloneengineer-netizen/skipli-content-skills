import { Link } from "react-router-dom";
import { CATEGORIES, SKILLS } from "../lib/constants.js";
import { GUIDE } from "../lib/skillGuide.js";
import { JobHistory } from "./JobBits.jsx";
import SkillArt from "./SkillArt.jsx";

export function BackLink({ to = "/", children = "Tất cả công cụ" }) {
  return (
    <Link className="back" to={to}>
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

const Clock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

/**
 * Page frame for one skill: coloured hero (category, chips, art), the 3-step
 * "how it works" strip, then the form beside a sticky panel with what the
 * result contains and the latest runs. Skills without a guide (library,
 * coming soon) get the hero and a single column.
 */
export default function SkillShell({ id, actions, children, wide = false }) {
  const skill = SKILLS.find((s) => s.id === id);
  const guide = skill.status === "soon" ? null : GUIDE[id];
  const category = CATEGORIES.find((c) => c.skills.includes(id));

  return (
    <div className={guide ? "skill-page" : "skill-page single"} data-tone={skill.tone}>
      <BackLink />
      <header className="skill-hero">
        <div className="skill-hero-text">
          {category && <span className="skill-tag">{category.title}</span>}
          <h1>{skill.title}</h1>
          <p>{skill.pitch}</p>
          {guide && (
            <ul className="skill-chips">
              {skill.eta && (
                <li><Clock />{skill.eta}</li>
              )}
              {guide.perks.map((p) => (
                <li key={p}><Check />{p}</li>
              ))}
            </ul>
          )}
          {actions && <div className="skill-head-actions">{actions}</div>}
        </div>
        <div className="skill-hero-art" aria-hidden="true">
          <span className="hero-ring a" />
          <span className="hero-ring b" />
          <SkillArt id={skill.id} />
        </div>
      </header>

      {guide && (
        <ol className="skill-steps">
          {guide.steps.map(([title, text], i) => (
            <li key={title}>
              <span className="step-num">{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {guide ? (
        <div className={wide ? "skill-layout wide" : "skill-layout"}>
          <div className="skill-main">{children}</div>
          <aside className="skill-aside">
            <section className="aside-card">
              <h2>Bạn sẽ nhận được</h2>
              <ul className="aside-list">
                {guide.output.map((o) => (
                  <li key={o}><Check />{o}</li>
                ))}
              </ul>
            </section>
            {skill.type && <JobHistory type={skill.type} limit={4} compact />}
          </aside>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Small print under a form: what to expect, what the tool will not do. */
export function Notes({ items }) {
  return (
    <div className="notes-box">
      <span className="notes-title">Lưu ý</span>
      <ul className="notes-list">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
