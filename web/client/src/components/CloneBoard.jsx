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

function PostPreview({ name, text }) {
  return (
    <div className="cb-preview" aria-label="Xem trước">
      <div className="cb-preview-head">
        <span className="cb-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <span>
          <b>{name}</b>
          <small>Vừa xong · 🌐</small>
        </span>
      </div>
      <p className="cb-preview-text">{text || "Bài viết trống"}</p>
      <div className="cb-preview-actions" aria-hidden="true">
        <span>👍 Thích</span>
        <span>💬 Bình luận</span>
        <span>↗ Chia sẻ</span>
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
