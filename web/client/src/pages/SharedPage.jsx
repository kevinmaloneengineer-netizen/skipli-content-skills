import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { skillByType } from "../lib/constants.js";
import { SharedView } from "../lib/sharedView.jsx";
import { Result } from "./JobPage.jsx";

/** A result opened from a share link: read only, no login, no navbar. */
export default function SharedPage() {
  const { token } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/public/shared/${encodeURIComponent(token)}`).then(({ job: j }) => setJob(j), (e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    if (job?.title) document.title = `${job.title} · Skipli Content`;
  }, [job]);
  const skill = job && skillByType(job.type);
  return (
    <div className="shared" data-tone={skill?.tone}>
      <header className="shared-bar">
        <Link className="brand" to="/">
          <img className="brand-logo" src="/logo.jpg" alt="" width="28" height="28" />
          <span>Skipli <em>Content</em></span>
        </Link>
        <span className="shared-note">Kết quả được chia sẻ · chỉ xem</span>
      </header>
      <main className="shared-main">
        {error ? (
          <section className="card shared-gone">
            <h1>Không mở được link</h1>
            <p>{error}</p>
            <Link className="btn primary" to="/">Xem Skipli Content</Link>
          </section>
        ) : !job ? (
          <div className="page-loading" aria-label="Đang tải" />
        ) : (
          <>
            <header className="shared-head">
              {skill && <span className="skill-tag">{skill.title}</span>}
              <h1>{job.title}</h1>
              <small>Tạo ngày {new Date(job.createdAt).toLocaleDateString("vi-VN")}</small>
            </header>
            <SharedView.Provider value={true}>
              <Result job={job} />
            </SharedView.Provider>
            <aside className="shared-cta">
              <div>
                <b>Kết quả này được tạo bằng Skipli Content</b>
                <span>Công cụ AI cho nhà hàng: phân tích đối thủ, viết bài, làm video món ăn.</span>
              </div>
              <Link className="btn primary" to="/">Dùng thử miễn phí</Link>
            </aside>
          </>
        )}
      </main>
    </div>
  );
}
