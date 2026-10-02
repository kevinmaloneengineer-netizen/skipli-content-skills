import { Link, Navigate, useParams } from "react-router-dom";
import SkillShell from "../components/SkillShell.jsx";
import { SKILLS } from "../lib/constants.js";

/** Placeholder for skills listed on the home screen but not built yet. */
export default function ComingSoonPage() {
  const { id } = useParams();
  const skill = SKILLS.find((s) => s.id === id && s.status === "soon");
  if (!skill) return <Navigate to="/" replace />;

  const ready = SKILLS.filter((s) => s.status !== "soon");

  return (
    <SkillShell id={skill.id}>
      <section className="form-card soon-card">
        <span className="soon-badge">Đang phát triển</span>
        <h2>Tính năng này sắp có</h2>
        <p className="soon-lead">Chúng tôi đang hoàn thiện công cụ này. Khi ra mắt, bạn sẽ có thể:</p>
        <ul className="soon-plan">
          {skill.plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <div className="soon-try">
          <span>Trong lúc chờ, thử các công cụ đã sẵn sàng:</span>
          <div className="actions">
            {ready.map((s) => (
              <Link key={s.id} className="btn" to={s.path} data-tone={s.tone}>
                <span className="tone-dot" aria-hidden="true" />
                {s.short}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SkillShell>
  );
}
