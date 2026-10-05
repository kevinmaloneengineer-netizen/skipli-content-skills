import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { CLONE_PLATFORMS, TONES } from "../lib/constants.js";
import { PILLARS } from "../lib/text.js";

const SOURCES = { url: "Link kênh Facebook", posts: "Dán bài viết" };
const COUNTS = { 6: "6 bài", 9: "9 bài", 12: "12 bài" };

/** Query params (optional): ?url= to prefill the competitor channel, e.g. from a Reels scan result. */
export default function ClonePage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    source: "url",
    url: params.get("url") ?? "",
    posts: "",
    topic: "",
    brief: "",
    platform: "facebook",
    tone: "",
    count: "9",
    pillars: PILLARS.map((p) => p.id),
  });
  const [submit, busy, error] = useSubmitJob("clone");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  const togglePillar = (id) =>
    setForm((f) => {
      const on = f.pillars.includes(id);
      if (on && f.pillars.length === 1) return f;
      return { ...f, pillars: on ? f.pillars.filter((p) => p !== id) : PILLARS.map((p) => p.id).filter((p) => p === id || f.pillars.includes(p)) };
    });

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, count: Number(form.count) });
  }

  return (
    <SkillShell id="clone">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Content gốc của đối thủ</span>
          <Segmented name="source" label="Nguồn content" options={SOURCES} value={form.source} onChange={set("source")} />
        </div>
        {form.source === "url" ? (
          <Field label="Link kênh đối thủ" hint="AI đọc 30 reel gần nhất, lấy những bài nhiều tương tác nhất làm gốc.">
            <input className="input-lg" value={form.url} onChange={set("url")} placeholder="facebook.com/tenkenh" autoComplete="off" required autoFocus />
          </Field>
        ) : (
          <Field label="Bài viết của đối thủ" hint="Mỗi bài cách nhau bằng một dòng trống hoặc dòng ---.">
            <textarea rows={6} value={form.posts} onChange={set("posts")} placeholder={"Bài 1…\n\n---\n\nBài 2…"} required autoFocus />
          </Field>
        )}
        <Field label="Kênh của bạn bán gì / nói về gì">
          <input value={form.topic} onChange={set("topic")} placeholder="Shop quà tặng handmade ở Đà Nẵng" autoComplete="off" required />
        </Field>
        <Field label="Thông tin thêm (tuỳ chọn)">
          <textarea rows={2} value={form.brief} onChange={set("brief")} placeholder="Khách hàng mục tiêu, ưu đãi có thật, CTA mong muốn…" />
        </Field>
        <div className="field">
          <span className="field-label">Nhóm nội dung</span>
          <div className="segmented" role="group" aria-label="Nhóm nội dung">
            {PILLARS.map((p) => (
              <label key={p.id}>
                <input type="checkbox" checked={form.pillars.includes(p.id)} onChange={() => togglePillar(p.id)} />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="field">
            <span className="field-label">Viết cho</span>
            <Segmented name="platform" label="Nền tảng" options={CLONE_PLATFORMS} value={form.platform} onChange={set("platform")} />
          </div>
          <div className="field">
            <span className="field-label">Số bài</span>
            <Segmented name="count" label="Số bài" options={COUNTS} value={form.count} onChange={set("count")} />
          </div>
        </div>
        <Field label="Giọng văn">
          <select value={form.tone} onChange={set("tone")}>
            <option value="">Thân thiện, tự nhiên</option>
            {TONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Nhân bản kênh" eta="2 đến 5 phút" />
        <Notes
          items={[
            "Không cần đăng nhập Facebook.",
            "AI học cách viết (hook, cấu trúc, góc tiếp cận), không chép câu chữ, câu chuyện hay số liệu của đối thủ.",
            "Mỗi bài sửa được trực tiếp, xem trước như trên mạng xã hội rồi lưu vào thư viện.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
