import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyIcon, PenIcon, RetryIcon, SaveIcon } from "../components/Icons.jsx";
import CloneBoard from "../components/CloneBoard.jsx";
import ImageBoard from "../components/ImageBoard.jsx";
import PlanBoard from "../components/PlanBoard.jsx";
import FanpageResult from "../components/FanpageResult.jsx";
import MapsResult from "../components/MapsResult.jsx";
import ReelsResult from "../components/ReelsResult.jsx";
import { BackLink } from "../components/SkillShell.jsx";
import { JobHistory, StatusBadge } from "../components/JobBits.jsx";
import SkillArt from "../components/SkillArt.jsx";
import Markdown from "../components/Markdown.jsx";
import Waiting from "../components/Waiting.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { ACTIVE, CLONE_PLATFORMS, PLATFORMS, skillByType } from "../lib/constants.js";
import { ago, duration } from "../lib/format.js";
import { PILLARS, splitLivestream, splitVariants, toPlainText } from "../lib/text.js";

function inputRows(job) {
  const i = job.input ?? {};
  const rows = {
    "fb-reels": [["Link", i.url], ["Phạm vi", i.mode === "channel" ? (i.depth === 100 ? "100 reel mới nhất" : "~10 reel mới nhất") : null], ["Chủ đề", i.topic], ["Số reel", i.top > 1 ? i.top : null]],
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
    clone: [
      ["Kênh đối thủ", i.url],
      ["Bài gốc", i.posts && (i.posts.length > 160 ? `${i.posts.slice(0, 160)}…` : i.posts)],
      ["Kênh của bạn", i.topic],
      ["Thông tin thêm", i.brief],
      ["Viết cho", CLONE_PLATFORMS[i.platform]],
      ["Số bài", i.count],
      ["Nhóm nội dung", i.pillars?.map((p) => PILLARS.find((x) => x.id === p)?.name ?? p).join(", ")],
      ["Giọng văn", i.tone],
    ],
    fanpage: [["Fanpage", i.url], ["Tìm hiểu thêm", i.focus]],
    review: [["Đánh giá", i.review && (i.review.length > 200 ? `${i.review.slice(0, 200)}…` : i.review)], ["Số sao", i.stars ? `${i.stars} sao` : null], ["Quán", i.business], ["Giọng", i.style], ["Thông tin thêm", i.facts]],
    menu: [["Món", i.dishes], ["Quán", i.business], ["Dùng cho", i.use]],
    inbox: [["Kinh doanh", i.business], ["Loại", i.kind === "restaurant" ? "Nhà hàng, quán ăn" : "Bán hàng online"], ["Kênh", i.channel], ["Chính sách", i.policies], ["Giọng văn", i.tone]],
    maps: [["Quán", i.place], ["Chú ý thêm", i.focus]],
    image: [["Sản phẩm", i.topic], ["Thông tin thêm", i.brief], ["Khung ảnh", i.size], ["Số ảnh", i.count], ["Có chữ trên ảnh", i.withText ? "Có" : "Không"], ["Ảnh sản phẩm", i.referenceImageId ? "Có" : null]],
    plan: [["Kênh", i.topic], ["Bắt đầu", i.start], ["Thời gian", i.days && `${i.days} ngày, ${i.perDay} bài/ngày`], ["Nền tảng", CLONE_PLATFORMS[i.platform]], ["Thông tin thêm", i.brief], ["Giọng văn", i.tone]],
    livestream: [
      ["Sản phẩm", i.products],
      ["Thời lượng", i.minutes && `${i.minutes} phút`],
      ["Nền tảng", i.platform === "tiktok" ? "TikTok" : "Facebook"],
      ["Ưu đãi", i.offer],
      ["Khách hàng", i.audience],
      ["Phong cách", i.host],
    ],
    video: [
      ["Cách làm", { topic: "Kịch bản tự do", storyboard: "Story Board", story: "Kể chuyện" }[i.mode]],
      ["Chủ đề", i.topic],
      ["Lời kể", i.narration && (i.narration.length > 160 ? `${i.narration.slice(0, 160)}…` : i.narration)],
      ["Số ô storyboard", i.panelIds?.length],
      ["Độ dài", i.mode === "topic" ? `${i.seconds} giây` : null],
      ["Khung hình", i.ratio],
      ["Chất lượng", { wan: "Đẹp nhất (Wan 2.2)", wan5b: "Đẹp (Wan 5B)", ltx: "Nhanh (LTX)" }[i.engine] ?? "Nhanh (LTX)"],
      ["Giọng đọc", i.voice === "male" ? "Nam" : "Nữ"],
      ["Tỉ lệ cảnh có người kể", i.mode === "story" ? `${i.narratorPct}%` : null],
    ],
  }[job.type] ?? [];
  return rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
}

function Variants({ job, onSave, prefix }) {
  const copy = useCopy();
  const { variants, intro, rest } = splitVariants(job.result, prefix);
  if (!variants.length) return <Markdown className="card md">{job.result}</Markdown>;
  const name = job.input?.topic ?? job.input?.business ?? job.title;
  return (
    <>
      {intro && <Markdown className="card md notes lead">{intro}</Markdown>}
      <div className="variants">
        {variants.map((v, i) => (
          <section key={i} className="card variant">
            <div className="variant-head">
              <h2>{v.title}</h2>
              <div className="actions">
                <button className="btn small" onClick={() => copy(toPlainText(v.body))}><CopyIcon />Sao chép</button>
                <button className="btn small" onClick={() => onSave(`${name} · ${v.title}`, toPlainText(v.body))}><SaveIcon />Lưu</button>
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

function LivestreamResult({ job }) {
  const copy = useCopy();
  const { segments, rest } = splitLivestream(job.result);
  if (!segments.length) return <Markdown className="card md">{job.result}</Markdown>;
  return (
    <>
      <ol className="live-timeline">
        {segments.map((s, i) => (
          <li key={i} className="live-seg">
            <div className="live-time">
              <b>{s.start}</b>
              <span>{s.end}</span>
            </div>
            <section className="card live-card">
              <div className="variant-head">
                <h2>{s.title}</h2>
                <button className="btn small" onClick={() => copy(toPlainText(s.body))}><CopyIcon />Sao chép</button>
              </div>
              <Markdown>{s.body}</Markdown>
            </section>
          </li>
        ))}
      </ol>
      {rest && <Markdown className="card md">{rest}</Markdown>}
    </>
  );
}

function VideoResult({ job }) {
  const src = `/media/videos/${job.video.file}`;
  return (
    <>
      <section className="card video-card" data-ratio={job.video.ratio}>
        <video src={src} controls playsInline preload="metadata" />
        <div className="video-side">
          {job.video.title && <h2>{job.video.title}</h2>}
          <p className="hint">{job.video.shots.length} cảnh{job.video.duration ? ` · ${Math.round(job.video.duration)} giây` : ""}</p>
          <a className="btn primary" href={src} download={`${(job.video.title || "video").slice(0, 60)}.mp4`}>Tải MP4</a>
        </div>
      </section>
      <section className="card">
        <h2>Kịch bản</h2>
        <ol className="shot-list">
          {job.video.shots.map((s, i) => (
            <li key={i}>
              <p>{s.narration}</p>
              <small>{s.role === "narrator" ? "Người kể nói trước camera" : s.visual}{s.motion ? ` · ${s.motion}` : ""}</small>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/** What the fact check changed: invented numbers replaced, gift/free offers to double-check. */
function FactCheck({ check }) {
  if (!check || (!check.replaced && !check.warnings?.length)) return null;
  return (
    <div className="fact-check" role="status">
      <b>Đã kiểm tra thông tin</b>
      {check.replaced > 0 && <p>AI tự thêm {check.replaced} con số (giá, % giảm, giờ mở cửa) không có trong thông tin bạn nhập, đã đổi thành chỗ trống như [GIÁ], [ƯU ĐÃI], [GIỜ] để bạn tự điền.</p>}
      {check.warnings?.length > 0 && (
        <>
          <p>Kiểm tra lại các ưu đãi sau, bạn chưa nhập chúng (sửa hoặc xoá trước khi đăng):</p>
          <ul>{check.warnings.map((w) => <li key={w}>“{w}”</li>)}</ul>
        </>
      )}
      <p className="fact-tip">Lần sau ghi giá, giờ mở cửa và ưu đãi thật vào ô thông tin thêm để AI dùng đúng.</p>
    </div>
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
  if (job.type === "write" || job.type === "review") return <Variants job={job} onSave={onSave} />;
  if (job.type === "menu") return <Variants job={job} onSave={onSave} prefix="Món" />;
  if (job.type === "inbox") return <Variants job={job} onSave={onSave} prefix="Tình huống" />;
  if (job.type === "maps") return <MapsResult job={job} />;
  if (job.type === "clone") return <CloneBoard job={job} />;
  if (job.type === "livestream") return <LivestreamResult job={job} />;
  if (job.type === "image" && job.images) return <ImageBoard job={job} />;
  if (job.type === "plan") return <PlanBoard job={job} />;
  if (job.type === "fanpage") return <FanpageResult markdown={job.result} />;
  if (["fb-reels", "threads"].includes(job.type)) return <ReelsResult markdown={job.result} />;
  if (job.type === "video" && job.video) return <VideoResult job={job} />;
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
  const done = job.status === "done";
  const url = job.input?.url ? encodeURIComponent(job.input.url) : "";
  const channel = (job.type === "fb-reels" && job.input?.mode === "channel") || job.type === "fanpage";
  const next = done
    ? [
        ["fb-reels", "threads", "fanpage", "maps"].includes(job.type) && { to: `/write?ref=${job.id}`, label: "Viết content từ kết quả này", hint: "AI viết bài theo đúng những gì đang hiệu quả", primary: true },
        channel && { to: `/clone?url=${url}`, label: "Nhân bản kênh này", hint: "Viết hàng loạt bài mới học từ kênh này" },
        job.type === "fb-reels" && job.input?.mode === "channel" && { to: `/fanpage?url=${url}`, label: "Phân tích fanpage này", hint: "Ngày giờ đăng, độ dài video, chủ đề ăn khách" },
        job.type === "maps" && { to: "/review", label: "Trả lời review của quán bạn", hint: "Xử lý khéo những điểm khách hay chê" },
        job.type === "inbox" && { to: "/review", label: "Trả lời review khách", hint: "Giữ chân khách sau khi mua" },
        !["video", "review", "inbox"].includes(job.type) && { to: "/video", label: "Làm video từ ý tưởng này", hint: "Video ngắn có giọng đọc và phụ đề" },
      ].filter(Boolean)
    : [];
  const full = job.type === "clone" || job.type === "image";
  const canCopy = done && !["clone", "video", "image"].includes(job.type);

  return (
    <div className={full ? "job-page full" : "job-page"} data-tone={skill?.tone}>
      <BackLink to={skill?.path ?? "/"}>{skill?.title ?? "Quay lại"}</BackLink>
      <header className="job-hero detail-head">
        <div className="job-hero-text">
          {skill && <span className="skill-tag">{skill.title}</span>}
          <h1>{job.title}</h1>
          <div className="detail-meta">
            <StatusBadge status={job.status} />
            <span>Tạo {ago(job.createdAt)}</span>
            {job.finishedAt && job.startedAt && <span>Chạy trong {duration(job.startedAt, job.finishedAt)}</span>}
            {job.usage?.total_tokens > 0 && <span>{job.usage.total_tokens.toLocaleString("vi-VN")} token</span>}
          </div>
        </div>
        <div className="job-hero-art" aria-hidden="true">
          <SkillArt id={skill?.id} />
        </div>
      </header>
      {job.notice && <div className="notice" role="status">{job.notice}</div>}
      {job.status === "done" && <FactCheck check={job.factCheck} />}

      <div className="job-layout">
        <div className="job-main">
          <Result job={job} onSave={saveToLibrary} />
        </div>
        <aside className="job-aside">
          <section className="aside-card">
            <h2>Thao tác</h2>
            <div className="job-actions actions">
              {canCopy && <button className="btn" onClick={() => copy(toPlainText(job.result))}><CopyIcon />Sao chép</button>}
              {canCopy && <button className="btn" onClick={() => saveToLibrary(job.title, job.result)} title="Lưu vào thư viện"><SaveIcon />Lưu</button>}
              {ACTIVE.has(job.status) ? (
                <button className="btn danger" onClick={cancel}>Huỷ</button>
              ) : (
                <>
                  <button className="btn" onClick={retry}><RetryIcon />Chạy lại</button>
                  <button className="btn danger" onClick={remove}>Xoá</button>
                </>
              )}
            </div>
          </section>
          {next.length > 0 && (
            <section className="aside-card">
              <h2>Bước tiếp theo</h2>
              <div className="next-list">
                {next.map((n) => (
                  <Link key={n.to} className={n.primary ? "next-item primary" : "next-item"} to={n.to}>
                    {n.primary && <PenIcon />}
                    <span>
                      <b>{n.label}</b>
                      <small>{n.hint}</small>
                    </span>
                    <i aria-hidden="true">→</i>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {rows.length > 0 && (
            <section className="aside-card">
              <h2>Thông tin đã nhập</h2>
              <dl className="inputs aside-inputs">
                {rows.map(([k, v]) => (
                  <div key={k} className="inputs-row">
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {skill?.type && <JobHistory type={skill.type} limit={4} compact />}
        </aside>
      </div>
    </div>
  );
}
