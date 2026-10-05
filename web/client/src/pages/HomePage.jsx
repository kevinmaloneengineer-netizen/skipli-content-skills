import HomeExtras from "../components/HomeExtras.jsx";
import { useRef } from "react";
import { Link } from "react-router-dom";
import CategoryDeco from "../components/CategoryDeco.jsx";
import HeroCategories from "../components/HeroCategories.jsx";
import HeroStickers from "../components/HeroStickers.jsx";
import { JobRow } from "../components/JobBits.jsx";
import PhoneFeed from "../components/PhoneFeed.jsx";
import SkillCard from "../components/SkillCard.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { CATEGORIES, SKILLS, skillById } from "../lib/constants.js";
import { useLive } from "../lib/live.js";
import { useScenes } from "../lib/motion.js";

/**
 * Home = a scroll-driven film in five scenes:
 *   1. opening - title shrinks away, stickers burst out, a phone feed rises
 *   2–4. one pinned scene per category - cards slide sideways as you scroll
 *   5. outro - quick start + recent runs
 * All motion is CSS driven by --p (see useScenes); small screens get a static layout.
 */
export default function HomePage() {
  const root = useRef(null);
  const hero = useRef(null);
  useScenes(root);
  const live = useLive(hero); // the phone and preview cards only animate while the opening is on screen
  const { jobs } = useJobs();
  const recent = jobs.slice(0, 5);
  const ready = SKILLS.filter((s) => s.status !== "soon");

  return (
    <div className="home" ref={root}>
      <section className="scene scene-hero" ref={hero}>
        <div className="stage">
          <HeroStickers />
          <div className="hero-copy">
            <p className="eyebrow">Bộ công cụ content cho nhà bán hàng</p>
            <h1>
              Hôm nay bạn muốn <span className="hl">làm gì</span>?
            </h1>
            <p className="hero-sub">Nghiên cứu đối thủ, viết bài, lên lịch: gói gọn trong {SKILLS.length} công cụ.</p>
          </div>
          <PhoneFeed live={live} />
          <HeroCategories live={live} />
          <div className="scroll-hint" aria-hidden="true">
            Cuộn để khám phá <span>↓</span>
          </div>
        </div>
      </section>

      {CATEGORIES.map((c) => (
        <section
          key={c.id}
          className="scene scene-cat"
          data-cat={c.id}
          data-lead="0.45"
          data-dark={c.dark ? "" : undefined}
          aria-labelledby={`cat-${c.id}`}
        >
          <div className="stage">
            <div className="cat-glow" aria-hidden="true" />
            <div className="cat-word" aria-hidden="true">
              {c.word}
            </div>
            <CategoryDeco icons={c.deco} />
            <header className="cat-head">
              <div>
                <p className="cat-step">
                  {c.tag} <span className="cat-rule" />
                </p>
                <h2 id={`cat-${c.id}`}>{c.title}</h2>
                <p className="cat-desc">{c.desc}</p>
                <div className="cat-chips">
                  {c.skills.map((id) => {
                    const s = skillById(id);
                    return (
                      <span key={id} data-tone={s.tone} className={s.status === "soon" ? "soon" : undefined}>
                        <i />
                        {s.short}
                        {s.status === "soon" && <small>sắp có</small>}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="cat-meta">
                <strong>{c.skills.length}</strong> công cụ
                <span className="cat-progress">
                  <span />
                </span>
              </div>
            </header>
            <div className="track">
              {c.skills.map((id, i) => (
                <SkillCard key={id} skill={skillById(id)} number={String(i + 1).padStart(2, "0")} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="outro">
        <h2>
          Bắt đầu từ <span className="hl">đâu cũng được</span>.
        </h2>
        <p>Mọi kết quả đều được lưu. Quét xong có thể viết tiếp ngay từ kết quả đó.</p>
        <div className="outro-actions">
          {ready.map((s) => (
            <Link key={s.id} className="btn big outro-btn" to={s.path} data-tone={s.tone}>
              <span className="tone-dot" aria-hidden="true" />
              {s.title}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="recent">
            <div className="section-head">
              <h2>Gần đây</h2>
              <Link to="/history">Xem tất cả →</Link>
            </div>
            <div className="job-list">
              {recent.map((j) => (
                <JobRow key={j.id} job={j} showSkill />
              ))}
            </div>
          </div>
        )}
      </section>
      <HomeExtras />
    </div>
  );
}
