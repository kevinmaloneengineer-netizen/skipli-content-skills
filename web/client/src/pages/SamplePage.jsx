import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/SkillShell.jsx";
import SkillArt from "../components/SkillArt.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { skillByType } from "../lib/constants.js";
import { Result } from "./JobPage.jsx";

/** "Xem kết quả mẫu": a canned result in the real result view, so a new user knows what a skill makes. */
export default function SamplePage() {
  const { type } = useParams();
  const toast = useToast();
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const skill = skillByType(type);

  useEffect(() => {
    api(`/samples/${encodeURIComponent(type)}`).then(({ job: j }) => setJob(j), (e) => setError(e.message));
  }, [type]);

  if (error) return <div className="card error-page"><h1>Chưa có kết quả mẫu</h1><div className="error-box">{error}</div></div>;
  if (!job) return null;
  const saveHint = () => toast("Đây là kết quả mẫu. Chạy công cụ với thông tin của bạn để lưu bài.");

  return (
    <div className="job-page sample-page" data-tone={skill?.tone}>
      <BackLink to={skill?.path ?? "/"}>{skill?.title ?? "Quay lại"}</BackLink>
      <header className="job-hero detail-head">
        <div className="job-hero-text">
          {skill && <span className="skill-tag">{skill.title}</span>}
          <h1>Kết quả mẫu</h1>
          <p className="sample-lead">Dữ liệu minh hoạ cho một quán ăn giả định. Kết quả thật sẽ theo đúng thông tin bạn nhập.</p>
        </div>
        <div className="job-hero-art" aria-hidden="true"><SkillArt id={skill?.id} /></div>
      </header>
      <div className="sample-banner" role="note">
        <span>Đây là bản xem trước, không tốn lượt chạy.</span>
        {skill?.path && <Link className="btn primary small" to={skill.path}>Chạy với thông tin của bạn →</Link>}
      </div>
      <Result job={job} onSave={saveHint} />
    </div>
  );
}
