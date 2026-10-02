import { useSearchParams } from "react-router-dom";
import { Segmented } from "../components/Form.jsx";
import { JobRow } from "../components/JobBits.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { SKILLS } from "../lib/constants.js";
import { BackLink } from "../components/SkillShell.jsx";

const FILTERS = { "": "Tất cả", ...Object.fromEntries(SKILLS.filter((s) => s.type).map((s) => [s.type, s.short])) };

export default function HistoryPage() {
  const { jobs, loaded } = useJobs();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "";
  const list = jobs.filter((j) => !type || j.type === type);

  return (
    <div className="narrow">
      <BackLink />
      <header className="plain-head">
        <h1>Lịch sử</h1>
        <p>Mọi lần chạy, mới nhất trước. Kết quả được lưu lại, bấm vào để xem, chạy lại hoặc viết tiếp.</p>
      </header>
      <div className="toolbar">
        <Segmented name="type" label="Lọc theo công cụ" options={FILTERS} value={type} onChange={(v) => setParams(v ? { type: v } : {})} />
      </div>
      <div className="job-list">
        {loaded && list.length === 0 && <div className="empty">Chưa có lần chạy nào.</div>}
        {list.map((j) => (
          <JobRow key={j.id} job={j} showSkill={!type} />
        ))}
      </div>
    </div>
  );
}
