import { Link } from "react-router-dom";
import { CATEGORIES, SKILLS } from "../lib/constants.js";
import { GUIDE } from "../lib/skillGuide.js";
import { tutorialFor } from "../lib/tutorials.js";
import { JobHistory } from "./JobBits.jsx";
import SkillArt from "./SkillArt.jsx";

// Skills with a canned result (server/mock.mjs); image and video results are media files.
const SAMPLE_TYPES = new Set(["fb-reels", "threads", "write", "clone", "tiktok", "compare", "maps", "fanpage", "plan", "livestream", "campaign", "menu", "review", "inbox", "hashtag", "yelp", "instagram", "gbp-post", "zalo-message", "promo-plan", "delivery-menu", "us-occasions", "nextdoor-post", "shop-about"]);

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

/** The tool's YouTube tutorial (privacy-enhanced player: no YouTube cookies until it is played). */
function Tutorial({ id, title }) {
  const video = tutorialFor(id);
  if (!video) return null;
  return (
    <section className="aside-card tutorial-card">
      <h2>Video hướng dẫn</h2>
      <div className="tutorial-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video}?rel=0`}
          title={`Video hướng dẫn: ${title}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </section>
  );
}

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
          {(actions || (guide && SAMPLE_TYPES.has(skill.type))) && (
            <div className="skill-head-actions">
              {actions}
              {guide && SAMPLE_TYPES.has(skill.type) && <Link className="sample-link" to={`/samples/${skill.type}`}>Xem kết quả mẫu →</Link>}
            </div>
          )}
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
            <Tutorial id={id} title={skill.title} />
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
        <>
          {tutorialFor(id) && (
            <div className="tutorial-solo">
              <Tutorial id={id} title={skill.title} />
            </div>
          )}
          {children}
        </>
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
