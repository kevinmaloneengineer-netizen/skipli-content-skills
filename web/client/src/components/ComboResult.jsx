import { Link } from "react-router-dom";
import { skillByType } from "../lib/constants.js";
import SkillArt from "./SkillArt.jsx";

const STATUS = { waiting: "Chờ", queued: "Đang chờ", running: "Đang chạy", review: "Chờ duyệt", done: "Xong", failed: "Lỗi", skipped: "Bỏ qua" };

/** A combo's steps: each one a run of its own, with its status and a link to its result. */
export default function ComboResult({ job }) {
  const steps = job.steps ?? [];
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <section className="combo-result">
      <header>
        <h2>{steps.length ? `${done}/${steps.length} bước xong` : "Đang chuẩn bị các bước…"}</h2>
        <p>Mỗi bước là một lần chạy riêng: bấm vào để xem, sao chép hoặc tải kết quả của bước đó.</p>
      </header>
      <ol className="combo-steps">
        {steps.map((s, i) => {
          const skill = skillByType(s.type);
          const body = (
            <>
              <span className="combo-art" data-tone={skill?.tone} aria-hidden="true"><SkillArt id={skill?.id} /></span>
              <span className="combo-text">
                <small>Bước {i + 1} · {skill?.short ?? s.type}{s.credits ? ` · ${s.credits} credit` : ""}</small>
                <b>{s.title}</b>
                {s.error && s.status !== "done" && <em>{s.error}</em>}
              </span>
              <span className={`combo-status is-${s.status}`}>{s.status === "running" && <i className="wait-spin" />}{STATUS[s.status] ?? s.status}</span>
            </>
          );
          return <li key={i}>{s.jobId ? <Link to={`/jobs/${s.jobId}`}>{body}<i className="combo-go" aria-hidden="true">→</i></Link> : <div>{body}</div>}</li>;
        })}
      </ol>
    </section>
  );
}
