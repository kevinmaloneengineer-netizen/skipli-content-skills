import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Field, Segmented } from "../components/Form.jsx";
import SkillShell from "../components/SkillShell.jsx";
import { CopyIcon, PenIcon } from "../components/Icons.jsx";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PLATFORMS } from "../lib/constants.js";

const KINDS = { "": "Tất cả", template: "Mẫu", saved: "Đã lưu" };
const EMPTY = { kind: "template", title: "", body: "", platform: "facebook", tags: "" };

function ItemDialog({ item, onClose, onSaved }) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => (item ? { ...item, tags: (item.tags ?? []).join(", ") } : EMPTY));
  const [error, setError] = useState("");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const body = { kind: form.kind, platform: form.platform, title: form.title, body: form.body, tags: form.tags };
    try {
      if (item) await api(`/library/${item.id}`, { method: "PUT", body });
      else await api("/library", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <h2>{item ? "Sửa" : "Thêm mẫu content"}</h2>
        <div className="row">
          <Field label="Loại">
            <select value={form.kind} onChange={set("kind")}>
              <option value="template">Mẫu (cấu trúc)</option>
              <option value="saved">Bài đã lưu</option>
            </select>
          </Field>
          <Field label="Nền tảng">
            <select value={form.platform ?? ""} onChange={set("platform")}>
              <option value="">Mọi nền tảng</option>
              {Object.entries(PLATFORMS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Tiêu đề">
          <input name="title" value={form.title} onChange={set("title")} required />
        </Field>
        <Field label="Nội dung" hint="Với mẫu: mô tả cấu trúc từng phần, AI sẽ viết theo cấu trúc này.">
          <textarea name="body" rows={9} value={form.body} onChange={set("body")} required />
        </Field>
        <Field label="Thẻ (cách nhau bằng dấu phẩy)">
          <input name="tags" value={form.tags} onChange={set("tags")} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Huỷ</button>
          <button type="submit" className="btn primary">Lưu</button>
        </div>
      </form>
    </dialog>
  );
}

function ItemCard({ item, onEdit, onDelete }) {
  const copy = useCopy();
  return (
    <article className="card lib-item">
      <div className="tags">
        <span className="tag kind">{item.kind === "template" ? "Mẫu" : "Đã lưu"}</span>
        {item.platform && <span className="tag">{PLATFORMS[item.platform] ?? item.platform}</span>}
        {(item.tags ?? []).map((t) => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
      <h3>{item.title}</h3>
      <div className="body">{item.body}</div>
      <div className="actions">
        {item.kind === "template" && (
          <Link className="btn small primary" to={`/write?template=${item.id}${item.platform ? `&platform=${item.platform}` : ""}`}>
            <PenIcon />Dùng mẫu
          </Link>
        )}
        <button className="btn small" title="Sao chép" aria-label="Sao chép" onClick={() => copy(item.body)}><CopyIcon /></button>
        {item.sourceJobId && <Link className="btn small ghost" to={`/jobs/${item.sourceJobId}`}>Nguồn</Link>}
        <button className="btn small ghost" onClick={onEdit}>Sửa</button>
        <button className="btn small ghost danger" onClick={onDelete}>Xoá</button>
      </div>
    </article>
  );
}

export default function LibraryPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") ?? "";
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, item = edit

  const load = () => api("/library").then(({ items: list }) => setItems(list), (e) => toast(e.message, { kind: "error" }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const q = query.toLowerCase();
    return (items ?? []).filter((x) => (!kind || x.kind === kind) && (!q || `${x.title}\n${x.body}\n${(x.tags ?? []).join(" ")}`.toLowerCase().includes(q)));
  }, [items, kind, query]);

  async function remove(item) {
    if (!window.confirm(`Xoá "${item.title}"?`)) return;
    try {
      await api(`/library/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((x) => x.id !== item.id));
    } catch (e) {
      toast(e.message, { kind: "error" });
    }
  }

  return (
    <SkillShell id="library" actions={<button className="btn primary" onClick={() => setEditing(null)}>+ Thêm mẫu</button>}>
      <div className="toolbar">
        <Segmented name="kind" label="Lọc" options={KINDS} value={kind} onChange={(v) => setParams(v ? { kind: v } : {})} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm trong thư viện…" aria-label="Tìm kiếm" />
      </div>
      <div className="lib-grid">
        {items && shown.length === 0 && <div className="empty full">Không có mục nào.</div>}
        {shown.map((item) => (
          <ItemCard key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => remove(item)} />
        ))}
      </div>
      {editing !== undefined && (
        <ItemDialog
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
            toast("Đã lưu");
          }}
        />
      )}
    </SkillShell>
  );
}
