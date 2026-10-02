import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyIcon, PenIcon, RetryIcon, SaveIcon } from "../components/Icons.jsx";
import { BackLink } from "../components/SkillShell.jsx";
import { Elapsed, StatusBadge } from "../components/JobBits.jsx";
import Markdown from "../components/Markdown.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { ACTIVE, PLATFORMS, skillByType } from "../lib/constants.js";
import { ago, duration } from "../lib/format.js";
import { splitVariants, toPlainText } from "../lib/text.js";

function inputRows(job) {
  const i = job.input ?? {};
  const rows = {
    "fb-reels": [["Link", i.url], ["Phạm vi", i.mode === "channel" ? (i.depth === 100 ? "100 reel gần nhất" : "~10 reel mới nhất") : null], ["Chủ đề", i.topic], ["Số reel", i.top > 1 ? i.top : null]],
    threads: [["Từ khoá", i.keywords?.join(", ")], ["Tài khoản", i.profiles?.join(", ")], ["Thời gian", i.days ? `${i.days} ngày` : "Tất cả"], ["Số bài", i.top]],
    write: [
      ["Nền tảng", PLATFORMS[i.platform]],
      ["Chủ đề", i.topic],
      ["Thông tin thêm", i.brief],
      ["Giọng văn", i.tone],
      ["Số phương án", i.variants],
      ["Mẫu", i.templateTitle],
      ["Tham khảo", [i.referenceJobId && "Kết quả quét trước đó", i.reference && (i.reference.length > 160 ? `${i.reference.slice(0, 160)}…` : i.reference)].filter(Boolean).join(" + ")],
    ],
  }[job.type] ?? [];
  return rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
}

function Waiting({ job }) {
  return (
    <section className="card waiting">
      <div className="spinner" aria-hidden="true" />
      <div>
        <strong>
          {job.status === "running" ? (
            <>Đang chạy… <Elapsed since={job.startedAt} /></>
          ) : (
            `Đang chờ${job.queuePosition ? ` (thứ ${job.queuePosition} trong hàng)` : ""}…`
          )}
        </strong>
        {job.phase && <div className="phase">{job.phase}</div>}
        <div className="hint">{skillByType(job.type)?.etaLong} Bạn có thể rời trang này, kết quả sẽ được lưu lại.</div>
      </div>
    </section>
  );
}

function Variants({ job, onSave }) {
  const copy = useCopy();
  const { variants, rest } = splitVariants(job.result);
  if (!variants.length) return <Markdown className="card md">{job.result}</Markdown>;
  return (
    <>
      <div className="variants">
        {variants.map((v, i) => (
          <section key={i} className="card variant">
            <div className="variant-head">
              <h2>{v.title}</h2>
              <div className="actions">
                <button className="btn small" onClick={() => copy(toPlainText(v.body))}><CopyIcon />Sao chép</button>
                <button className="btn small" onClick={() => onSave(`${job.input?.topic ?? job.title} · ${v.title}`, toPlainText(v.body))}><SaveIcon />Lưu</button>
              </div>
            </div>
            <Markdown>{v.body}</Markdown>
          </section>
        ))}
      </div>
      {rest && <Markdown className="card md notes">{rest}</Markdown>}
    </>
  );
}

function Result({ job, onSave }) {
  if (ACTIVE.has(job.status)) return <Waiting job={job} />;
  if (job.status === "failed") {
    return (
      <section className="card">
        <h2>Không chạy được</h2>
        <div className="error-box">{job.error ?? "Lỗi không rõ"}</div>
      </section>
    );
  }
  if (job.status === "canceled") return <section className="card empty">Tác vụ đã bị huỷ.</section>;
  if (job.type === "write") return <Variants job={job} onSave={onSave} />;
  return <Markdown className="card md">{job.result}</Markdown>;
}

export default function JobPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const copy = useCopy();
  const { jobs, refresh, track } = useJobs();
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");

  // Summary from the polled list; refetch the full job whenever its state changes.
  const live = jobs.find((j) => j.id === id);
  const version = live ? `${live.status}:${live.queuePosition}` : "";
  useEffect(() => {
    let alive = true;
    api(`/jobs/${encodeURIComponent(id)}`).then(
      ({ job: j }) => alive && (setJob(j), setError("")),
      (e) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [id, version]);

  if (error) {
    return (
      <div className="card error-page">
        <h1>Không mở được trang</h1>
        <div className="error-box">{error}</div>
      </div>
    );
  }
  if (!job || job.id !== id) return null;

  const skill = skillByType(job.type);

  async function act(fn) {
    try {
      await fn();
    } catch (e) {
      toast(e.message, { kind: "error" });
    }
  }

  const saveToLibrary = (title, body) =>
    act(async () => {
      await api("/library", {
        method: "POST",
        body: { kind: "saved", title, body, platform: job.input?.platform ?? (job.type === "threads" ? "threads" : "facebook"), tags: [skill?.short ?? ""], sourceJobId: job.id },
      });
      toast("Đã lưu vào thư viện", { to: "/library?kind=saved" });
    });

  const cancel = () => act(async () => {
    await api(`/jobs/${job.id}/cancel`, { method: "POST" });
    refresh();
  });
  const retry = () => act(async () => {
    const { job: fresh } = await api(`/jobs/${job.id}/retry`, { method: "POST" });
    track(fresh);
    navigate(`/jobs/${fresh.id}`);
  });
  const remove = () => act(async () => {
    if (!window.confirm("Xoá kết quả này?")) return;
    await api(`/jobs/${job.id}`, { method: "DELETE" });
    refresh();
    navigate(skill?.path ?? "/");
  });

  const rows = inputRows(job);

  return (
    <div className="narrow" data-tone={skill?.tone}>
      <BackLink to={skill?.path ?? "/"}>{skill?.title ?? "Quay lại"}</BackLink>
      <div className="page-head detail-head">
        <div>
          <h1>{job.title}</h1>
          <div className="detail-meta">
            <StatusBadge status={job.status} />
            <span>Tạo {ago(job.createdAt)}</span>
            {job.finishedAt && job.startedAt && <span>Thời gian chạy {duration(job.startedAt, job.finishedAt)}</span>}
            {job.usage?.total_tokens > 0 && <span>{job.usage.total_tokens.toLocaleString("vi-VN")} token</span>}
          </div>
        </div>
        <div className="actions">
          {job.status === "done" && (
            <>
              <button className="btn" onClick={() => copy(toPlainText(job.result))}><CopyIcon />Sao chép</button>
              {job.type !== "write" && (
                <Link className="btn primary" to={`/write?ref=${job.id}`}><PenIcon />Viết content từ kết quả này</Link>
              )}
              <button className="btn" onClick={() => saveToLibrary(job.title, job.result)}><SaveIcon />Lưu vào thư viện</button>
            </>
          )}
          {ACTIVE.has(job.status) ? (
            <button className="btn danger" onClick={cancel}>Huỷ</button>
          ) : (
            <>
              <button className="btn" onClick={retry}><RetryIcon />Chạy lại</button>
              <button className="btn danger" onClick={remove}>Xoá</button>
            </>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <details className="card inputs-card">
          <summary>Thông tin đã nhập</summary>
          <dl className="inputs">
            {rows.map(([k, v]) => (
              <div key={k} className="inputs-row">
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {job.notice && <div className="notice" role="status">{job.notice}</div>}
      <Result job={job} onSave={saveToLibrary} />
    </div>
  );
}
