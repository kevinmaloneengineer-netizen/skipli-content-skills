import { Link } from "react-router-dom";
import { SKILLS } from "../lib/constants.js";
import SkillArt from "./SkillArt.jsx";

export function BackLink({ to = "/", children = "Tất cả công cụ" }) {
  return (
    <Link className="back" to={to}>
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

/** Page frame for one skill: back link, coloured header with its art, then the content. */
export default function SkillShell({ id, actions, children }) {
  const skill = SKILLS.find((s) => s.id === id);
  return (
    <div className="narrow" data-tone={skill.tone}>
      <BackLink />
      <header className="skill-head">
        <div className="skill-head-text">
          <h1>{skill.title}</h1>
          <p>{skill.pitch}</p>
          {actions && <div className="skill-head-actions">{actions}</div>}
        </div>
        <SkillArt id={skill.id} />
      </header>
      {children}
    </div>
  );
}

/** Small print under a form: how long it takes, what to expect. */
export function Notes({ items }) {
  return (
    <ul className="notes-list">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}
