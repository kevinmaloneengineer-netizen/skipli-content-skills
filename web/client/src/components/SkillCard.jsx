import { Link } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { ACTIVE } from "../lib/constants.js";
import { tilt } from "../lib/motion.js";
import SkillArt from "./SkillArt.jsx";

export default function SkillCard({ skill, number }) {
  const { jobs } = useJobs();
  const running = skill.type ? jobs.filter((j) => j.type === skill.type && ACTIVE.has(j.status)).length : 0;
  const soon = skill.status === "soon";

  return (
    <Link className={soon ? "skill-card is-soon" : "skill-card"} to={skill.path} data-tone={skill.tone} {...tilt}>
      <SkillArt id={skill.id} />
      <div className="skill-body">
        <div className="skill-index">
          <span>{number}</span>
          {running > 0 && <span className="skill-running">{running} đang chạy</span>}
        </div>
        <h3>{skill.title}</h3>
        <p>{skill.pitch}</p>
        <div className="skill-foot">
          {soon ? <span className="skill-soon">Đang phát triển</span> : <span className="skill-eta">{skill.eta}</span>}
          <span className="skill-go" aria-hidden="true">
            <span className="go-label">{soon ? "Xem trước" : "Mở công cụ"}</span>→
          </span>
        </div>
      </div>
    </Link>
  );
}
