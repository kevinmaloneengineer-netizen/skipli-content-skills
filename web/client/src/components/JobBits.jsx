import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { STATUS, skillByType } from "../lib/constants.js";
import { ago, duration } from "../lib/format.js";

export function StatusBadge({ status }) {
  return (
    <span className="badge" data-status={status}>
      {STATUS[status] ?? status}
    </span>
  );
}

/** Live "1m 05s" counter since an ISO timestamp. */
export function Elapsed({ since }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{duration(since)}</span>;
}

function JobTime({ job }) {
  if (job.status === "running") return <>đang chạy <Elapsed since={job.startedAt} /></>;
  if (job.status === "queued") return job.queuePosition ? `thứ ${job.queuePosition} trong hàng chờ` : "đang chờ";
  if (job.finishedAt && job.startedAt) return `${ago(job.finishedAt)} · ${duration(job.startedAt, job.finishedAt)}`;
  return ago(job.createdAt);
}

export function JobRow({ job, showSkill = false }) {
  const skill = skillByType(job.type);
  return (
    <Link className="job-row" to={`/jobs/${job.id}`} data-tone={skill?.tone}>
      <span className="job-dot" aria-hidden="true" />
      <span className="job-main">
        <span className="job-title">{job.title}</span>
        <span className="job-meta">
          {showSkill && skill && <>{skill.short} · </>}
          <JobTime job={job} />
        </span>
      </span>
      <StatusBadge status={job.status} />
    </Link>
  );
}

/** Latest runs of one job type, kept fresh by JobsContext polling. */
export function JobHistory({ type, limit = 5, compact = false }) {
  const { jobs, loaded } = useJobs();
  const all = jobs.filter((j) => j.type === type);

  return (
    <section className={compact ? "recent compact" : "recent"}>
      <div className="section-head">
        <h2>Lần chạy gần đây</h2>
        {all.length > limit && <Link to={`/history?type=${type}`}>{compact ? `Tất cả (${all.length})` : `Xem tất cả (${all.length})`} →</Link>}
      </div>
      <div className="job-list">
        {loaded && all.length === 0 && <div className="empty">Chưa có lần chạy nào. Kết quả sẽ hiện ở đây.</div>}
        {all.slice(0, limit).map((j) => (
          <JobRow key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}
