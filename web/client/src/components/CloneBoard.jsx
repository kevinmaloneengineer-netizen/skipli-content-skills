import { useEffect, useMemo, useRef, useState } from "react";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PILLARS, splitClonePosts, toPlainText } from "../lib/text.js";
import { CopyIcon, SaveIcon } from "./Icons.jsx";
import Markdown from "./Markdown.jsx";

const PILLAR_NAME = Object.fromEntries([...PILLARS.map((p) => [p.id, p.name]), ["other", "Khác"]]);

// Edits live in this browser only (per job); "Lưu" is what persists a post.
function useEdits(jobId) {
  const key = `clone-edits:${jobId}`;
  const [edits, setEdits] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(edits));
    } catch {
      // storage blocked: edits just won't survive a reload
    }
  }, [key, edits]);
  return [edits, setEdits];
}

/** Plausible preview numbers, stable per post (seeded by the text, so they don't jump while typing a little). */
function fakeStats(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = (n) => ((h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0) % n);
  const likes = 180 + r(2400);
  return { likes, comments: Math.round(likes * (0.04 + r(9) / 100)), shares: Math.round(likes * (0.01 + r(5) / 100)) };
}
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K` : String(n));

const Like = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#1877f2" /><path d="M4.5 7.2h1.6v4.3H4.5zM6.8 11.5V7.3l1.9-2.6c.3-.4 1-.2 1 .3v1.6h1.6c.6 0 1 .5.9 1.1l-.5 2.6c-.1.7-.7 1.2-1.4 1.2z" fill="#fff" /></svg>
);
const Love = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#f33e58" /><path d="M8 11.8S4.3 9.6 4.3 7.1A1.9 1.9 0 0 1 8 6.2a1.9 1.9 0 0 1 3.7.9c0 2.5-3.7 4.7-3.7 4.7z" fill="#fff" /></svg>
);
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);

/** Post as it looks in the Facebook phone app: long text is cut after ~6 lines with "Xem thêm". */
function PostPreview({ name, text }) {
  const [more, setMore] = useState(false);
  const long = text.length > 280 || text.split("\n").length > 6;
  const shown = !long || more ? text : `${text.slice(0, 260).replace(/\s+\S*$/, "")}…`;
  const now = new Date();
  const st = fakeStats(name + text.slice(0, 40));
  return (
    <div className="cb-phone" aria-label="Xem trước trên điện thoại">
      <div className="cb-phone-screen">
        <div className="cb-phone-status">
          <b>{`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`}</b>
          <span className="cb-phone-notch" />
          <span className="cb-phone-icons"><i /><i /><i /></span>
        </div>
        <div className="cb-fb-bar">
          <b>facebook</b>
          <span><i /><i /></span>
        </div>
        <div className="cb-fb-feed">
          <article className="cb-fb-post">
            <div className="cb-preview-head">
              <span className="cb-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>{name}</b>
                <small>Vừa xong · 🌐</small>
              </span>
              <em className="cb-fb-dots">···</em>
            </div>
            <p className="cb-preview-text">
              {text ? shown : "Bài viết trống"}
              {long && !more && <button type="button" className="cb-more" onClick={() => setMore(true)}> Xem thêm</button>}
            </p>
            <div className="cb-fb-counts">
              <span className="cb-reacts"><Like /><Love />{fmt(st.likes)}</span>
              <span>{fmt(st.comments)} bình luận · {fmt(st.shares)} lượt chia sẻ</span>
            </div>
            <div className="cb-preview-actions" aria-hidden="true">
              <span><Icon d="M7 10v10H4V10zM7 10l4-7c1.2 0 2 .9 2 2v3h5.5c1 0 1.7.9 1.5 1.9l-1.3 6.8c-.2.8-.9 1.3-1.7 1.3H7" />Thích</span>
              <span><Icon d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-3.9A8 8 0 1 1 20 11.5z" />Bình luận</span>
              <span><Icon d="M14 5l7 6.5-7 6.5v-4c-5 0-8 1.5-10 5 .7-5.5 3.5-9.5 10-10z" />Chia sẻ</span>
            </div>
          </article>
          <div className="cb-fb-ghost" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </div>
    </div>
  );
}

function Editor({ post, index, total, text, edited, channel, onChange, onReset, onSave, onNav, onClose }) {
  const ref = useRef(null);
  const copy = useCopy();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog ref={ref} className="cb-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="cb-dialog-inner" data-pillar={post.pillar}>
        <header className="cb-dialog-head">
          <div>
            <span className="cb-pill">{PILLAR_NAME[post.pillar]}</span>
            <h2>{post.title}</h2>
            {post.source && <p className="cb-source">Học từ: {post.source}</p>}
          </div>
          <button className="btn ghost small" onClick={() => ref.current.close()} aria-label="Đóng">✕</button>
        </header>
        <div className="cb-dialog-body">
          <label className="cb-edit">
            <span className="field-label">Nội dung {edited && <em className="cb-edited">đã sửa</em>}</span>
            <textarea value={text} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
          </label>
          <div>
            <span className="field-label">Xem trước</span>
            <PostPreview name={channel} text={text} />
          </div>
        </div>
        <footer className="cb-dialog-foot">
          <div className="actions">
            <button className="btn small" disabled={index === 0} onClick={() => onNav(-1)}>← Bài trước</button>
            <span className="cb-pos">{index + 1}/{total}</span>
            <button className="btn small" disabled={index === total - 1} onClick={() => onNav(1)}>Bài sau →</button>
          </div>
          <div className="actions">
            {edited && <button className="btn ghost small" onClick={onReset}>Khôi phục bản AI</button>}
            <button className="btn small" onClick={() => copy(text)}><CopyIcon />Sao chép</button>
            <button className="btn primary small" onClick={() => onSave(post, text)}><SaveIcon />Lưu</button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}

export default function CloneBoard({ job }) {
  const toast = useToast();
  const { intro, posts, notes } = useMemo(() => splitClonePosts(job.result), [job.result]);
  const [edits, setEdits] = useEdits(job.id);
  const [open, setOpen] = useState(null);
  const [saved, setSaved] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  if (!posts.length) return <Markdown className="card md">{job.result}</Markdown>;

  const channel = job.input?.topic?.split(/[,.]/)[0]?.trim() || "Kênh của bạn";
  const textOf = (p) => edits[p.id] ?? toPlainText(p.body);
  const columns = [...PILLARS.map((p) => p.id), "other"]
    .map((id) => ({ id, posts: posts.filter((p) => p.pillar === id) }))
    .filter((c) => c.posts.length || job.input?.pillars?.includes(c.id));

  async function save(list) {
    setSaving(true);
    try {
      for (const p of list) {
        await api("/library", {
          method: "POST",
          body: { kind: "saved", title: `${p.title} · ${PILLAR_NAME[p.pillar]}`.slice(0, 200), body: textOf(p), platform: job.input?.platform ?? "facebook", tags: ["Nhân bản kênh", PILLAR_NAME[p.pillar]], sourceJobId: job.id },
        });
        setSaved((s) => new Set(s).add(p.id));
      }
      toast(list.length > 1 ? `Đã lưu ${list.length} bài vào thư viện` : "Đã lưu vào thư viện", { to: "/library?kind=saved" });
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  const current = open === null ? null : posts[open];
  const unsaved = posts.filter((p) => !saved.has(p.id));

  return (
    <>
      <div className="cb-bar">
        <p>{intro ? toPlainText(intro) : `${posts.length} bài mới cho kênh của bạn.`} Bấm vào một bài để sửa và xem trước.</p>
        <button className="btn primary" disabled={saving || !unsaved.length} onClick={() => save(unsaved)}>
          <SaveIcon />
          {unsaved.length ? `Lưu tất cả (${unsaved.length})` : "Đã lưu hết"}
        </button>
      </div>
      <div className="cb-board" style={{ "--cols": columns.length }}>
        {columns.map((c) => (
          <section key={c.id} className="cb-col" data-pillar={c.id}>
            <h2>
              {PILLAR_NAME[c.id]}
              <span>{c.posts.length}</span>
            </h2>
            {c.posts.length === 0 && <div className="cb-empty">Chưa có bài</div>}
            {c.posts.map((p) => (
              <button key={p.id} className="cb-card" onClick={() => setOpen(posts.indexOf(p))}>
                <strong>{p.title}</strong>
                <span className="cb-snippet">{textOf(p)}</span>
                <span className="cb-flags">
                  {edits[p.id] !== undefined && <em>Đã sửa</em>}
                  {saved.has(p.id) && <em className="ok">Đã lưu</em>}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
      {notes && <Markdown className="card md notes">{notes}</Markdown>}
      {current && (
        <Editor
          key={current.id}
          post={current}
          index={open}
          total={posts.length}
          text={textOf(current)}
          edited={edits[current.id] !== undefined}
          channel={channel}
          onChange={(v) => setEdits((e) => ({ ...e, [current.id]: v }))}
          onReset={() =>
            setEdits((e) => {
              const { [current.id]: _, ...rest } = e;
              return rest;
            })
          }
          onSave={(p) => save([p])}
          onNav={(d) => setOpen((i) => Math.min(posts.length - 1, Math.max(0, i + d)))}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
