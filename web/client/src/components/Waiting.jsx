import { useEffect, useState } from "react";
import { skillByType } from "../lib/constants.js";
import { GUIDE } from "../lib/skillGuide.js";
import SkillArt from "./SkillArt.jsx";

const TIPS = [
  "Bạn có thể rời trang này. Kết quả tự lưu vào Lịch sử, xong sẽ có thông báo.",
  "Kết quả nào ưng ý, bấm Lưu vào thư viện để dùng lại khi viết bài.",
  "Từ kết quả quét đối thủ, bấm Viết content để AI viết bài theo đúng những gì đang hiệu quả.",
  "Nhân bản kênh biến những bài hay nhất của đối thủ thành bài mới cho kênh của bạn.",
  "Chỗ nào AI chưa biết (giá, link, số điện thoại) sẽ để dạng [GIÁ], [LINK] cho bạn điền.",
];

/** Upper bound of a skill's usual duration in seconds, from labels like "3 đến 10 phút" or "khoảng 1 phút". */
function expectedSeconds(eta = "") {
  const nums = (eta.match(/\d+/g) ?? []).map(Number);
  return Math.max(60, (nums.length ? Math.max(...nums) : 2) * 60);
}

function useSecondsSince(iso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000)) : 0;
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Waiting({ job }) {
  const skill = skillByType(job.type);
  const steps = GUIDE[skill?.id]?.steps ?? [];
  const running = job.status === "running";
  const elapsed = useSecondsSince(running ? job.startedAt : null);
  const expected = expectedSeconds(skill?.eta);
  // Estimated, never reaches the end on its own: the result replaces this panel when it lands.
  const progress = running ? Math.min(0.94, 0.06 + elapsed / expected) : 0.02;
  // Step 1 is the user's input, so it is already done; then "working" until ~70%, then "finishing".
  const done = running && progress >= 0.7 ? 2 : 1;
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 7000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <section className="wait-hero" data-state={job.status}>
        <div className="wait-art" aria-hidden="true">
          <span className="wait-pulse" />
          <SkillArt id={skill?.id} />
        </div>
        <div className="wait-body">
          <span className="wait-label">{running ? "Đang chạy" : "Đang chờ đến lượt"}</span>
          <div className="wait-clock" aria-live="off">
            {running ? clock(elapsed) : job.queuePosition ? `Thứ ${job.queuePosition}` : "Sắp chạy"}
          </div>
          <div className="wait-bar" role="progressbar" aria-label="Tiến độ ước tính" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="wait-hint">
            {job.phase ?? (running ? `Thường mất ${skill?.eta ?? "vài phút"}.` : "Một tác vụ khác đang chạy, của bạn sẽ bắt đầu ngay sau đó.")}
          </p>
        </div>
      </section>

      {running && job.phases?.length > 0 ? (
        <ol className="wait-steps wait-live" aria-live="polite">
          {job.phases.map((p, i) => {
            const last = i === job.phases.length - 1;
            const at = Math.max(0, Math.round((Date.parse(p.at) - Date.parse(job.startedAt)) / 1000));
            return (
              <li key={`${i}-${p.at}`} data-state={last ? "active" : "done"}>
                <span className="wait-step-dot" aria-hidden="true">{last ? <i className="wait-spin" /> : "✓"}</span>
                <div>
                  <strong>{p.text.replace(/…$/, "")}</strong>
                  <span>{last ? `Đang làm · bắt đầu ở ${clock(at)}` : `Xong · ${clock(at)}`}</span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : steps.length > 0 && (
        <ol className="wait-steps">
          {steps.map(([title, text], i) => (
            <li key={title} data-state={i < done ? "done" : i === done && running ? "active" : "todo"}>
              <span className="wait-step-dot" aria-hidden="true">{i < done ? "✓" : i + 1}</span>
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="wait-tip" key={tip}>
        <span className="wait-tip-label">Mẹo</span>
        <p>{TIPS[tip]}</p>
      </div>

      <section className="card wait-skeleton" aria-hidden="true">
        <span className="sk sk-title" />
        <span className="sk" />
        <span className="sk" />
        <span className="sk sk-short" />
        <div className="sk-row">
          <span className="sk sk-box" />
          <span className="sk sk-box" />
          <span className="sk sk-box" />
        </div>
      </section>
    </>
  );
}
