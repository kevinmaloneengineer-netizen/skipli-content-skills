import { Link } from "react-router-dom";

/** "Điền sẵn từ kết quả: …" above a form opened with ?from=<job id>. */
export default function FromBanner({ job }) {
  if (!job) return null;
  return (
    <p className="from-banner">
      <span aria-hidden="true">↪</span>
      Đã điền sẵn từ kết quả <Link to={`/jobs/${job.id}`}>{job.title}</Link>. Sửa lại nếu cần rồi bấm chạy.
    </p>
  );
}
