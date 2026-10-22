import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyIcon, PenIcon, RetryIcon, SaveIcon } from "../components/Icons.jsx";
import CloneBoard from "../components/CloneBoard.jsx";
import ImageBoard from "../components/ImageBoard.jsx";
import PlanBoard from "../components/PlanBoard.jsx";
import FanpageResult from "../components/FanpageResult.jsx";
import MapsResult from "../components/MapsResult.jsx";
import CompareResult from "../components/CompareResult.jsx";
import ReelsResult from "../components/ReelsResult.jsx";
import { BackLink } from "../components/SkillShell.jsx";
import { JobHistory, StatusBadge } from "../components/JobBits.jsx";
import SkillArt from "../components/SkillArt.jsx";
import Markdown from "../components/Markdown.jsx";
import Waiting from "../components/Waiting.jsx";
import { useJobs } from "../context/JobsContext.jsx";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { crop, loadImage, upload } from "../lib/image.js";
import { ACTIVE, CLONE_PLATFORMS, PLATFORMS, skillByType } from "../lib/constants.js";
import { ago, duration } from "../lib/format.js";
import { PILLARS, splitLivestream, splitVariants, toPlainText } from "../lib/text.js";
import PhotoResult from "../components/PhotoResult.jsx";
import { accepts } from "../lib/drop.js";
import ComboResult from "../components/ComboResult.jsx";
import MapLinkField, { MapPreview } from "../components/MapLinkField.jsx";
import TemplateTexts from "../components/TemplateTexts.jsx";
import { DISH_TEMPLATES, FEATURED, OFFER_TEMPLATES, SAMPLE_VERSION, TEMPLATES, sampleOf } from "../lib/videoTemplates.js";

import { blanksOf, fillBlanks, useJobEdits } from "../lib/edits.js";

/** Results that are a post, which the next tools can take on ("Làm tiếp với…"). */
const WRITTEN = new Set(["write", "gbp-post", "weather-post", "story-behind", "dish-riddle", "post-score", "menu"]);

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
    tiktok: [["Từ khoá", i.keywords?.join(", ")], ["Tài khoản", i.profiles?.join(", ")], ["Số video", i.top], ["Kinh doanh của bạn", i.business]],
    maps: [["Quán", i.place], ["Chú ý thêm", i.focus]],
    yelp: [["Trang Yelp", i.url], ["Chú ý thêm", i.focus]],
    instagram: [["Instagram", i.user && `@${i.user}`], ["Tìm hiểu thêm", i.focus]],
    compare: [["Fanpage", i.urls?.join("\n")], ["Chú ý thêm", i.focus]],
    watch: [["Kênh theo dõi", i.url]],
    campaign: [["Đối thủ", i.url], ["Kênh của bạn", i.topic], ["Thông tin thêm", i.brief], ["Bắt đầu", i.start], ["Thời gian", i.days && `${i.days} ngày, ${i.perDay} bài/ngày`], ["Nền tảng", CLONE_PLATFORMS[i.platform]]],
    review: [["Đánh giá", i.review && (i.review.length > 200 ? `${i.review.slice(0, 200)}…` : i.review)], ["Số sao", i.stars ? `${i.stars} sao` : null], ["Quán", i.business], ["Giọng", i.style], ["Thông tin thêm", i.facts]],
    menu: [["Món", i.dishes], ["Quán", i.business], ["Dùng cho", i.use]],
    inbox: [["Kinh doanh", i.business], ["Loại", i.kind === "restaurant" ? "Nhà hàng, quán ăn" : "Bán hàng online"], ["Kênh", i.channel], ["Chính sách", i.policies], ["Giọng văn", i.tone]],
    hashtag: [["Kinh doanh", i.business], ["Khu vực", i.area], ["Khách hàng", i.audience], ["Nền tảng", i.platforms?.join(", ")]],
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
    video: i.mode === "slideshow" ? [
      ["Cách làm", "Trình chiếu ảnh"],
      ["Mẫu", TEMPLATES.find(([id]) => id === (i.layout ?? "collage"))?.[1] ?? i.layout],
      ["Đổi mẫu từ video", i.restyledFrom ? "Có, dùng lại ảnh của video trước" : null],
      ["Quán và món", i.topic],
      ["Tên quán", i.name],
      ["Thành phố", i.city],
      ["Ảnh thật", i.photoIds?.length || null],
      ["Độ dài", i.seconds && `${i.seconds} giây`],
      ["Khung hình", i.ratio],
    ] : [
      ["Cách làm", { topic: "Kịch bản tự do", storyboard: "Story Board", story: "Kể chuyện" }[i.mode]],
      ["Chủ đề", i.topic],
      ["Lời kể", i.narration && (i.narration.length > 160 ? `${i.narration.slice(0, 160)}…` : i.narration)],
      ["Số ô storyboard", i.panelIds?.length],
      ["Độ dài", i.mode === "topic" ? `${i.seconds} giây` : null],
      ["Khung hình", i.ratio],
      ["Chất lượng", i.engine && { wan: "Đẹp nhất (Wan 2.2)", wan5b: "Đẹp (Wan 5B)", ltx: "Nhanh (LTX)" }[i.engine]], // only older jobs made moving clips
      ["Giọng đọc", i.voice === "male" ? "Nam" : "Nữ"],
      ["Tỉ lệ cảnh có người kể", i.mode === "story" ? `${i.narratorPct}%` : null],
    ],
  }[job.type] ?? [];
  return rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
}

const REWRITES = [["shorter", "Ngắn hơn"], ["fun", "Vui hơn"], ["emoji", "Thêm emoji"], ["formal", "Trang trọng"]];

/** "Ngắn hơn", "Vui hơn"…: rewrites one post in place; the original is one click away. */
function RewriteBar({ body, rewritten, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  async function rewrite(style) {
    setBusy(style);
    try {
      const { text } = await api("/rewrite", { method: "POST", body: { text: toPlainText(body), style } });
      onChange(text);
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="rewrite-bar" aria-label="Sửa nhanh bài này">
      <span>Sửa nhanh:</span>
      {REWRITES.map(([id, label]) => (
        <button key={id} type="button" className={busy === id ? "is-busy" : undefined} disabled={!!busy} onClick={() => rewrite(id)}>{busy === id ? "Đang viết…" : label}</button>
      ))}
      {rewritten && <button type="button" className="undo" disabled={!!busy} onClick={() => onChange(null)}>↺ Bản gốc</button>}
    </div>
  );
}

function Variants({ job, onSave, prefix, edits, setEdits }) {
  const copy = useCopy();
  const { variants, intro, rest } = splitVariants(job.result, prefix);
  if (!variants.length) return <Markdown className="card md">{job.result}</Markdown>;
  const name = job.input?.topic ?? job.input?.business ?? job.title;
  const rewritten = edits?.variants ?? {};
  const setVariant = (i, text) => setEdits?.((e) => {
    const next = { ...(e.variants ?? {}) };
    if (text === null) delete next[i];
    else next[i] = text;
    return { ...e, variants: next };
  });
  return (
    <>
      {intro && <Markdown className="card md notes lead">{intro}</Markdown>}
      <div className="variants">
        {variants.map((v, i) => {
          const body = rewritten[i] != null ? fillBlanks(rewritten[i], edits?.fills) : v.body;
          return (
            <section key={i} className={rewritten[i] != null ? "card variant is-rewritten" : "card variant"}>
              <div className="variant-head">
                <h2>{v.title}</h2>
                <div className="actions">
                  <button className="btn small" onClick={() => copy(toPlainText(body))}><CopyIcon />Sao chép</button>
                  <button className="btn small" onClick={() => onSave(`${name} · ${v.title}`, toPlainText(body))}><SaveIcon />Lưu</button>
                </div>
              </div>
              <Markdown key={body}>{body}</Markdown>
              {setEdits && !job.sample && <RewriteBar body={body} rewritten={rewritten[i] != null} onChange={(t) => setVariant(i, t)} />}
            </section>
          );
        })}
      </div>
      {rest && <Markdown className="card md notes">{rest}</Markdown>}
    </>
  );
}

/** Inputs for the [GIÁ], [LINK]… the AI left open: filled values replace them everywhere on the page and in copies. */
function FillBlanks({ blanks, fills, onChange }) {
  if (!blanks.length) return null;
  const left = blanks.filter((b) => !fills[b.name]?.trim()).length;
  return (
    <section className="fill-blanks" aria-label="Điền chỗ trống">
      <header>
        <b>Điền chỗ trống</b>
        <span>{left ? `Còn ${left} chỗ AI chưa biết. Điền một lần, tự thay ở mọi bài và khi sao chép.` : "Đã điền đủ, bài sẵn sàng để đăng."}</span>
      </header>
      <div className="fill-grid">
        {blanks.map((b) => (
          <label key={b.name} className={fills[b.name]?.trim() ? "is-filled" : undefined}>
            <span>[{b.name}]{b.count > 1 && <small> ×{b.count}</small>}</span>
            <input value={fills[b.name] ?? ""} onChange={(e) => onChange({ ...fills, [b.name]: e.target.value })} placeholder={HINTS[b.name] ?? "Nhập thông tin thật"} />
          </label>
        ))}
      </div>
    </section>
  );
}
const HINTS = { "GIÁ": "VD: 89.000đ", "ƯU ĐÃI": "VD: giảm 10% hoá đơn", "GIỜ": "VD: 9h", "LINK": "Link đặt hàng", "SĐT": "Số điện thoại", "ĐỊA CHỈ": "Địa chỉ quán", "TÊN QUÁN": "Tên quán" };

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

const ROLE_NAMES = { ext: "Bên ngoài quán", int: "Bên trong quán", table: "Bàn đầy món", medium: "Món, tầm trung", close: "Món, cận cảnh", side: "Món kèm, đồ uống", food: "Ảnh của bạn", narrator: "Người kể", scene: "Cảnh minh hoạ" };

/** Slideshow step between drawing and rendering: redraw, replace or reorder the photos, then render. */
function SlideReview({ job }) {
  const toast = useToast();
  const { refresh } = useJobs();
  const [slides, setSlides] = useState(job.slides);
  const [order, setOrder] = useState(() => job.slides.map((_, i) => i));
  const [busy, setBusy] = useState(null); // index being redrawn / replaced
  const [dropOn, setDropOn] = useState(null); // slide a photo is being dragged over
  // A photo dragged onto a slide replaces it, like "Thay ảnh".
  const dropProps = (i) => (busy !== null ? {} : {
    onDragOver: (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDropOn(i); } },
    onDragLeave: () => setDropOn((d) => (d === i ? null : d)),
    onDrop: (e) => {
      e.preventDefault();
      setDropOn(null);
      const f = [...e.dataTransfer.files].find((x) => accepts(x, "image/png,image/jpeg,image/webp"));
      if (f) replace(i, f);
      else toast("Chỉ nhận ảnh PNG, JPG hoặc WebP", { kind: "error" });
    },
  });
  const [editing, setEditing] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [rendering, setRendering] = useState(false);
  const [version, setVersion] = useState(0); // busts the browser cache of replaced pictures

  async function act(i, fn) {
    setBusy(i);
    try {
      setSlides((await fn()).slides);
      setVersion((v) => v + 1);
      setEditing(null);
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setBusy(null);
    }
  }
  const redraw = (i) => act(i, () => api(`/jobs/${job.id}/slides/${i}/redraw`, { method: "POST", body: { prompt: editing === i ? prompt : undefined } }));
  async function replace(i, file) {
    if (!file) return;
    const img = await loadImage(file).catch(() => null);
    if (!img) return toast("Không đọc được ảnh này", { kind: "error" });
    act(i, async () => api(`/jobs/${job.id}/slides/${i}/replace`, { method: "POST", body: { uploadId: await upload(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 1920)) } }));
  }
  const move = (k, d) => setOrder((o) => {
    const n = [...o];
    [n[k], n[k + d]] = [n[k + d], n[k]];
    return n;
  });
  async function render() {
    setRendering(true);
    try {
      await api(`/jobs/${job.id}/render`, { method: "POST", body: { order } });
      refresh();
    } catch (e) {
      toast(e.message, { kind: "error" });
      setRendering(false);
    }
  }

  return (
    <section className="card slide-review" data-ratio={job.input?.ratio}>
      <header>
        <h2>Duyệt ảnh trước khi dựng video</h2>
        <p>Ảnh nào chưa ưng thì bấm Vẽ lại (sửa mô tả nếu muốn) hoặc thay bằng ảnh của bạn. Dùng mũi tên để đổi thứ tự, xong bấm Dựng video.</p>
      </header>
      {job.input?.layout === "map" && job.input.mapLink && <MapPreview link={job.input.mapLink} />}
      <ol className="slide-grid">
        {order.map((i, k) => {
          const s = slides[i];
          return (
            <li key={i} className={busy === i ? "is-busy" : undefined}>
              <figure className={dropOn === i ? "is-over" : undefined} {...dropProps(i)}>
                <img src={`/media/images/${s.image}?v=${version}`} alt={s.prompt} />
                {dropOn === i && <span className="slide-drop">Thả ảnh để thay</span>}
                <span className="slide-num">{k + 1}</span>
                <span className="slide-role">{s.real ? "Ảnh của bạn" : ROLE_NAMES[s.role] ?? "Ảnh"}</span>
                {busy === i && <span className="slide-wait"><i className="wait-spin" />Đang vẽ…</span>}
              </figure>
              {s.narration && <p className="slide-line">{s.narration}</p>}
              {editing === i ? (
                <div className="slide-edit">
                  <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Mô tả ảnh (tiếng Anh)" />
                  <div className="actions">
                    <button type="button" className="btn small primary" disabled={busy !== null} onClick={() => redraw(i)}>Vẽ lại ảnh này</button>
                    <button type="button" className="btn small ghost" onClick={() => setEditing(null)}>Huỷ</button>
                  </div>
                </div>
              ) : (
                <div className="slide-tools">
                  <button type="button" className="btn small" disabled={busy !== null} onClick={() => redraw(i)} title="Vẽ lại với cùng mô tả">↻ Vẽ lại</button>
                  <button type="button" className="btn small ghost" disabled={busy !== null} onClick={() => { setEditing(i); setPrompt(s.prompt); }} title="Sửa mô tả rồi vẽ lại">Sửa mô tả</button>
                  <label className={busy !== null ? "btn small ghost is-disabled" : "btn small ghost"}>
                    Thay ảnh
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy !== null} onChange={(e) => { replace(i, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <span className="slide-move">
                    <button type="button" disabled={k === 0} onClick={() => move(k, -1)} aria-label="Lên trước">←</button>
                    <button type="button" disabled={k === order.length - 1} onClick={() => move(k, 1)} aria-label="Ra sau">→</button>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="slide-go">
        <small>{job.input?.layout === "collage" ? "Kiểu ghép ảnh tự xếp ảnh vào khung theo loại ảnh (mặt tiền, trong quán, món ăn)." : "Video chiếu ảnh theo đúng thứ tự trên."}</small>
        <button type="button" className="btn primary" disabled={rendering || busy !== null} onClick={render}>{rendering ? "Đang bắt đầu…" : "Dựng video →"}</button>
      </div>
    </section>
  );
}

/** Cắt Reels: one player per cut, with its title, its time range in the source video, and a download. */
function ClipsResult({ job }) {
  return (
    <section className="card clips-card">
      <header>
        <h2>{job.title}</h2>
        <p className="hint">{job.clips.length} đoạn, mỗi đoạn là một file MP4 riêng</p>
      </header>
      {job.recap && <Recap recap={job.recap} />}
      <div className="clips-grid">
        {job.clips.map((c, i) => (
          <article key={c.file} className="clip-card">
            <video src={`/media/videos/${c.file}`} controls playsInline preload="metadata" />
            <h3>{i + 1}. {c.title || "Đoạn " + (i + 1)}</h3>
            <p className="hint">{fmtTime(c.start)} → {fmtTime(c.end)} · {Math.round(c.duration)} giây</p>
            {c.why && <p className="clip-why">{c.why}</p>}
            <a className="btn small" href={`/media/videos/${c.file}`} download={`reel-${i + 1}.mp4`}>Tải MP4</a>
          </article>
        ))}
      </div>
    </section>
  );
}
/** Livestream recap: what happened, what was talked about, and the thank-you post ready to copy. */
function Recap({ recap }) {
  const copy = useCopy();
  return (
    <div className="recap">
      <h3>Tóm tắt buổi live</h3>
      <p>{recap.summary}</p>
      {recap.items?.length > 0 && (
        <>
          <h3>Món và sản phẩm được nhắc</h3>
          <ul>{recap.items.map((x) => <li key={x}>{x}</li>)}</ul>
        </>
      )}
      <h3>Bài cảm ơn</h3>
      <p className="recap-post">{recap.post}</p>
      <button type="button" className="btn small" onClick={() => copy(recap.post)}>Sao chép bài cảm ơn</button>
    </div>
  );
}

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Caption + hashtags written with a slideshow, ready to paste under the video. */
function PostCaption({ caption, hashtags = [] }) {
  const copy = useCopy();
  if (!caption && !hashtags.length) return null;
  const full = [caption, hashtags.join(" ")].filter(Boolean).join("\n\n");
  return (
    <section className="card post-caption">
      <div className="variant-head">
        <h2>Caption để đăng kèm video</h2>
        <button className="btn small" onClick={() => copy(full)}><CopyIcon />Sao chép</button>
      </div>
      {caption && <p className="post-caption-text">{caption}</p>}
      {hashtags.length > 0 && (
        <div className="post-tags">
          {hashtags.map((t) => <button key={t} type="button" onClick={() => copy(t)} title="Sao chép hashtag này">{t}</button>)}
        </div>
      )}
    </section>
  );
}

const RESTYLE_RATIOS = { "9:16": "Dọc 9:16", "1:1": "Vuông 1:1", "16:9": "Ngang 16:9" };
const dishLines = (dishes = []) => dishes.map((d) => [d.name, d.price].filter(Boolean).join(" - ")).join("\n");

/** "Đổi mẫu": the same photos laid out with another template, without drawing anything again (1 credit). */
function Restyle({ job }) {
  const navigate = useNavigate();
  const toast = useToast();
  const current = job.input?.layout ?? "collage";
  const [pick, setPick] = useState(null);
  const [ratio, setRatio] = useState(job.input?.ratio ?? "9:16");
  const [offer, setOffer] = useState(job.input?.offer ?? "");
  const [dishes, setDishes] = useState(dishLines(job.input?.dishes));
  // The words the user changed last time stay (a key shared by two templates carries over).
  const [texts, setTexts] = useState(() => Object.fromEntries(Object.entries(job.input?.texts ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])));
  const [tagline, setTagline] = useState(job.input?.tagline ?? "");
  const [mapLink, setMapLink] = useState(job.input?.mapLink ?? "");
  const [mapReady, setMapReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const chosen = TEMPLATES.find(([id]) => id === pick);

  async function go() {
    setBusy(true);
    try {
      const body = { layout: pick, ratio, texts, tagline, ...(pick === "map" ? { mapLink } : {}), ...(OFFER_TEMPLATES.has(pick) ? { offer } : {}), ...(DISH_TEMPLATES[pick] ? { dishes } : {}) };
      const { job: fresh } = await api(`/jobs/${job.id}/restyle`, { method: "POST", body });
      navigate(`/jobs/${fresh.id}`);
    } catch (e) {
      toast(e.message, { kind: "error" });
      setBusy(false);
    }
  }

  return (
    <section className="card restyle">
      <div className="restyle-head">
        <div>
          <h2>Đổi mẫu video</h2>
          <p className="hint">Dùng lại đúng các ảnh này với mẫu khác, không vẽ lại ảnh nên nhanh và chỉ 1 credit. Video cũ vẫn giữ nguyên.</p>
        </div>
      </div>
      <div className="restyle-grid" role="radiogroup" aria-label="Mẫu video">
        {TEMPLATES.map(([id, title]) => (
          <button key={id} type="button" role="radio" aria-checked={pick === id} disabled={id === current} className={["restyle-card", pick === id && "on", id === current && "is-current"].filter(Boolean).join(" ")} onClick={() => setPick(id)}>
            <img src={`${sampleOf(id)}.jpg?v=${SAMPLE_VERSION}`} alt="" loading="lazy" />
            <span>{title}</span>
            {id === current && <em>Đang dùng</em>}
            {FEATURED.has(id) && <em className="tpl-hot">Nổi bật</em>}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="restyle-form">
          <p className="restyle-pick"><b>{chosen[1]}</b> · {chosen[2]}</p>
          <div className="row">
            <label className="field">
              <span className="field-label">Khung hình</span>
              <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
                {Object.entries(RESTYLE_RATIOS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            {OFFER_TEMPLATES.has(pick) && (
              <label className="field">
                <span className="field-label">Câu ưu đãi (bắt buộc, chỉ ghi ưu đãi có thật)</span>
                <input value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={120} placeholder="Tặng gỏi cuốn khi gọi 2 tô phở" />
              </label>
            )}
          </div>
          {DISH_TEMPLATES[pick] && (
            <label className="field">
              <span className="field-label">{DISH_TEMPLATES[pick]}</span>
              <textarea rows={3} value={dishes} onChange={(e) => setDishes(e.target.value)} placeholder={"Phở bò - 65.000đ\nTrà sữa - 30.000đ"} />
            </label>
          )}
          {pick === "map" && <MapLinkField value={mapLink} onChange={setMapLink} onReady={setMapReady} />}
          {pick !== "single" && <TemplateTexts layout={pick} texts={texts} onTexts={setTexts} tagline={tagline} onTagline={setTagline} />}
          <button type="button" className="btn primary" disabled={busy || (OFFER_TEMPLATES.has(pick) && !offer.trim()) || (pick === "map" && !mapReady)} onClick={go}>{busy ? "Đang bắt đầu…" : `Dựng lại với mẫu ${chosen[1]} · 1 credit`}</button>
        </div>
      )}
    </section>
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
          <p className="hint">{job.video.shots.length} {job.video.slideshow ? "ảnh, nhạc nền không lời" : "cảnh"}{job.video.duration ? ` · ${Math.round(job.video.duration)} giây` : ""}</p>
          <a className="btn primary" href={src} download={`${(job.video.title || "video").slice(0, 60)}.mp4`}>Tải MP4</a>
        </div>
      </section>
      {job.video.slideshow && Array.isArray(job.slides) && job.slides.length > 1 && <Restyle job={job} />}
      <PostCaption caption={job.video.caption} hashtags={job.video.hashtags} />
      {job.video.slideshow ? (
        <section className="card">
          <h2>{job.video.shots.length} ảnh trong video</h2>
          <div className="slide-thumbs">
            {job.video.shots.map((s, i) => <img key={i} src={`/media/images/${s.image}`} alt={s.visual} title={s.visual} loading="lazy" />)}
          </div>
        </section>
      ) : (
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
      )}
    </>
  );
}

/** Follow a competitor channel: re-checked weekly, new or viral reels arrive as a notification. */
function FollowButton({ url }) {
  const toast = useToast();
  const [state, setState] = useState("idle");
  useEffect(() => {
    api("/watch").then(({ items }) => items.some((w) => w.url === url) && setState("on"), () => {});
  }, [url]);
  async function follow() {
    setState("busy");
    try {
      await api("/watch", { method: "POST", body: { url } });
      setState("on");
      toast("Đã theo dõi. Mỗi tuần hệ thống kiểm tra lại kênh, có reel mới hay viral sẽ báo ở chuông.", { to: "/history" });
    } catch (e) {
      setState("idle");
      toast(e.message, { kind: "error" });
    }
  }
  return (
    <button type="button" className={state === "on" ? "follow-btn on" : "follow-btn"} disabled={state !== "idle"} onClick={follow}>
      <span aria-hidden="true">{state === "on" ? "✓" : "🔔"}</span>
      <span>
        <b>{state === "on" ? "Đang theo dõi kênh này" : "Theo dõi kênh này mỗi tuần"}</b>
        <small>{state === "on" ? "Quản lý ở trang Lịch sử" : "Báo khi đối thủ có reel mới hoặc reel viral"}</small>
      </span>
    </button>
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

export function Result({ job, onSave, edits, setEdits }) {
  if (job.type === "combo") return <ComboResult job={job} />; // its steps show their own progress
  if (ACTIVE.has(job.status)) return <Waiting job={job} />;
  if (job.status === "review" && job.slides) return <SlideReview job={job} />;
  if (job.status === "failed") {
    return (
      <section className="card">
        <h2>Không chạy được</h2>
        <div className="error-box">{job.error ?? "Lỗi không rõ"}</div>
      </section>
    );
  }
  if (job.status === "canceled") return <section className="card empty">Tác vụ đã bị huỷ.</section>;
  if (job.type === "write" || job.type === "review") return <Variants job={job} onSave={onSave} edits={edits} setEdits={setEdits} />;
  if (job.type === "menu") return <Variants job={job} onSave={onSave} prefix="Món" edits={edits} setEdits={setEdits} />;
  if (job.type === "inbox") return <Variants job={job} onSave={onSave} prefix="Tình huống" edits={edits} setEdits={setEdits} />;
  if (job.type === "hashtag") return <Variants job={job} onSave={onSave} prefix="Bộ" edits={edits} setEdits={setEdits} />;
  if (job.type === "gbp-post") return <Variants job={job} onSave={onSave} prefix="Bài" edits={edits} setEdits={setEdits} />;
  if (job.type === "zalo-message") return <Variants job={job} onSave={onSave} prefix="Tin" edits={edits} setEdits={setEdits} />;
  if (job.type === "promo-plan") return <Variants job={job} onSave={onSave} edits={edits} />;
  if (job.type === "photo-fix" && job.photos) return <PhotoResult job={job} />;
  if (job.type === "maps" || job.type === "yelp") return <MapsResult job={job} />;
  if (job.type === "compare") return <CompareResult job={job} />;
  if (job.type === "clone") return <CloneBoard job={job} />;
  if (job.type === "livestream") return <LivestreamResult job={job} />;
  if (job.type === "image" && job.images) return <ImageBoard job={job} />;
  if (job.type === "plan") return <PlanBoard job={job} />;
  if (job.type === "campaign") {
    return (
      <>
        {job.learned?.length > 0 && (
          <section className="card learned">
            <h2>Học từ {job.learned.length} reel hiệu quả nhất của đối thủ</h2>
            <ol>
              {job.learned.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">{r.caption || "Xem reel"}</a>
                  <small>{r.engagement?.toLocaleString("vi-VN")} tương tác · {r.source === "video" ? "AI đã xem video" : r.source === "lời thoại" ? "AI đã nghe lời thoại" : "chỉ đọc caption"}</small>
                </li>
              ))}
            </ol>
          </section>
        )}
        <PlanBoard job={job} />
      </>
    );
  }
  if (job.type === "fanpage" || job.type === "instagram") return <FanpageResult markdown={job.result} posts={job.igPosts} />;
  if (["fb-reels", "threads", "tiktok", "watch"].includes(job.type)) {
    const clips = Object.fromEntries((job.watch ?? []).filter((w) => w.clip).map((w) => [w.url.match(/(\d{15,20})/)?.[1], w.clip]));
    return <ReelsResult markdown={job.result} clips={clips} />;
  }
  if (job.type === "video" && job.video) return <VideoResult job={job} />;
  if (["reel-cut", "dub", "live-recap"].includes(job.type) && job.clips) return <ClipsResult job={job} />;
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
  const [edits, setEdits] = useJobEdits(id);

  // Summary from the polled list; refetch the full job whenever its state changes.
  const live = jobs.find((j) => j.id === id);
  const version = live ? `${live.status}:${live.queuePosition}:${live.phase ?? ""}` : "";
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
  const blanks = done ? blanksOf(job.result) : [];
  const fills = edits.fills ?? {};
  const shown = blanks.length ? { ...job, result: fillBlanks(job.result, fills) } : job; // what the page shows and copies
  const url = job.input?.url ? encodeURIComponent(job.input.url) : "";
  const channel = (job.type === "fb-reels" && job.input?.mode === "channel") || job.type === "fanpage";
  const next = done
    ? [
        ["fb-reels", "threads", "fanpage", "tiktok", "maps", "yelp", "instagram", "compare", "watch"].includes(job.type) && { to: `/write?ref=${job.id}`, label: "Viết content từ kết quả này", hint: "AI viết bài theo đúng những gì đang hiệu quả", primary: true },
        channel && { to: `/clone?url=${url}`, label: "Nhân bản kênh này", hint: "Viết hàng loạt bài mới học từ kênh này" },
        job.type === "fb-reels" && job.input?.mode === "channel" && { to: `/fanpage?url=${url}`, label: "Phân tích fanpage này", hint: "Ngày giờ đăng, độ dài video, chủ đề ăn khách" },
        (job.type === "maps" || job.type === "yelp") && { to: `/review?from=${job.id}`, label: "Trả lời các điểm khách chê", hint: "Điền sẵn những điểm khách hay chê trong báo cáo" },
        (job.type === "maps" || job.type === "yelp") && { to: `/gbp-post?from=${job.id}`, label: "Bài Google Business từ điểm được khen", hint: "Khoe đúng những gì khách khen nhiều nhất" },
        // Writing results: carry the post on to a video, pictures, a score, the Google profile.
        WRITTEN.has(job.type) && { to: `/video?from=${job.id}`, label: "Dựng video từ bài này", hint: "Bài viết thành kịch bản có giọng đọc và phụ đề" },
        WRITTEN.has(job.type) && { to: `/image?from=${job.id}`, label: "Vẽ ảnh cho bài này", hint: "Ảnh quảng cáo theo đúng nội dung bài" },
        WRITTEN.has(job.type) && job.type !== "post-score" && { to: `/post-score?from=${job.id}`, label: "Chấm điểm bài này", hint: "Xem chỗ cần sửa trước khi đăng" },
        WRITTEN.has(job.type) && job.type !== "gbp-post" && { to: `/gbp-post?from=${job.id}`, label: "Đăng lên Google Business", hint: "Viết lại cho hồ sơ Google Maps của quán" },
        // A fixed dish photo: straight into a slideshow, a riddle, a Google post.
        job.type === "photo-fix" && { to: `/video?from=${job.id}`, label: "Làm video trình chiếu với ảnh này", hint: "Ảnh đã chỉnh vào thẳng video", primary: true },
        job.type === "photo-fix" && { to: `/dish-riddle?from=${job.id}`, label: "Làm bài đố đoán món", hint: "Dùng ảnh đã chỉnh, khách bình luận đoán món" },
        job.type === "photo-fix" && { to: `/gbp-post?from=${job.id}`, label: "Bài Google Business cho món này", hint: "Gắn kèm ảnh vừa chỉnh khi đăng" },
        job.type === "instagram" && { to: "/hashtag", label: "Gợi ý hashtag cho kênh của bạn", hint: "Bộ hashtag theo khu vực và giờ đăng" },
        job.type === "menu" && { to: "/hashtag", label: "Gợi ý hashtag cho các món", hint: "Bộ hashtag theo khu vực và giờ đăng" },
        job.type === "inbox" && { to: "/review", label: "Trả lời review khách", hint: "Giữ chân khách sau khi mua" },
        !["video", "review", "inbox", "hashtag", "photo-fix", "combo", ...WRITTEN].includes(job.type) && { to: "/video", label: "Làm video từ ý tưởng này", hint: "Video ngắn có giọng đọc và phụ đề" },
      ].filter(Boolean)
    : [];
  const full = job.type === "clone" || job.type === "image" || job.type === "photo-fix";
  const canCopy = done && !["clone", "video", "image", "photo-fix", "combo"].includes(job.type);

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
          <FillBlanks blanks={blanks} fills={fills} onChange={(f) => setEdits((e) => ({ ...e, fills: f }))} />
          <Result job={shown} onSave={saveToLibrary} edits={edits} setEdits={setEdits} />
        </div>
        <aside className="job-aside">
          <section className="aside-card">
            <h2>Thao tác</h2>
            <div className="job-actions actions">
              {canCopy && <button className="btn" onClick={() => copy(toPlainText(shown.result))}><CopyIcon />Sao chép</button>}
              {canCopy && <button className="btn" onClick={() => saveToLibrary(job.title, shown.result)} title="Lưu vào thư viện"><SaveIcon />Lưu</button>}
              {done && job.type !== "combo" && <button className="btn" onClick={() => window.print()} title="Lưu báo cáo thành PDF hoặc in ra">⤓ Tải PDF</button>}
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
              {channel && <FollowButton url={job.input.url} />}
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
