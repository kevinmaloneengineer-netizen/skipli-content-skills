import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { api } from "../lib/api.js";
import { PLATFORMS, TONES } from "../lib/constants.js";

const VARIANTS = { 1: "1", 2: "2", 3: "3", 5: "5" };

/**
 * Query params (all optional): ?ref=<jobId> to write from a scan result,
 * ?template=<libraryId>, ?platform=, ?topic=.
 */
export default function WritePage() {
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [refJob, setRefJob] = useState(null);
  const [form, setForm] = useState({
    platform: params.get("platform") ?? "facebook",
    topic: params.get("topic") ?? "",
    brief: "",
    tone: "",
    variants: "3",
    templateId: params.get("template") ?? "",
    reference: "",
  });
  const [submit, busy, error] = useSubmitJob("write");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));

  useEffect(() => {
    api("/library?kind=template").then(({ items }) => setTemplates(items), () => setTemplates([]));
  }, []);

  // Prefill from a finished scan: its platform and topic/keywords.
  useEffect(() => {
    const id = params.get("ref");
    if (!id) return setRefJob(null);
    api(`/jobs/${encodeURIComponent(id)}`).then(
      ({ job }) => {
        setRefJob(job);
        setForm((f) => ({
          ...f,
          platform: params.get("platform") ?? (job.type === "threads" ? "threads" : "facebook"),
          topic: f.topic || job.input?.topic || job.input?.keywords?.join(", ") || "",
        }));
      },
      () => setRefJob(null),
    );
  }, [params]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, variants: Number(form.variants), templateId: form.templateId || null, referenceJobId: refJob?.id ?? null });
  }

  return (
    <SkillShell id="write">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Viết cho</span>
          <Segmented name="platform" label="Nền tảng" options={PLATFORMS} value={form.platform} onChange={set("platform")} />
        </div>
        <Field label="Chủ đề / sản phẩm">
          <input className="input-lg" value={form.topic} onChange={set("topic")} placeholder="Khoá học SEO cho chủ shop online" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Thông tin thêm (tuỳ chọn)">
          <textarea rows={3} value={form.brief} onChange={set("brief")} placeholder="Thương hiệu, khách hàng mục tiêu, ưu đãi có thật, CTA mong muốn…" />
        </Field>
        <div className="row">
          <Field label="Giọng văn">
            <select value={form.tone} onChange={set("tone")}>
              <option value="">Thân thiện, tự nhiên</option>
              {TONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <div className="field">
            <span className="field-label">Số phương án</span>
            <Segmented name="variants" label="Số phương án" options={VARIANTS} value={form.variants} onChange={set("variants")} />
          </div>
        </div>
        <Field label="Theo mẫu (tuỳ chọn)">
          <select value={form.templateId} onChange={set("templateId")}>
            <option value="">AI tự chọn cấu trúc</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.platform ? ` · ${PLATFORMS[t.platform] ?? t.platform}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="field">
          <span className="field-label">Lấy cảm hứng từ (tuỳ chọn)</span>
          {refJob && (
            <div>
              <span className="chip">
                <span>Kết quả: {refJob.title}</span>
                <button type="button" aria-label="Bỏ tham khảo" onClick={() => setRefJob(null)}>×</button>
              </span>
            </div>
          )}
          <textarea rows={3} value={form.reference} onChange={set("reference")} placeholder="Dán bài đối thủ / bài viral để AI học cách viết (không chép lại)." aria-label="Nội dung tham khảo" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Viết content" eta="dưới 1 phút" />
        <Notes
          items={[
            "Thông tin chưa có (giá, link, SĐT) sẽ để dạng [GIÁ], [LINK] để bạn điền.",
            "Nội dung tham khảo chỉ để học cách viết. AI không chép câu chữ, câu chuyện hay số liệu.",
            "Không viết đánh giá giả, lời khách hàng bịa hay cam kết sai sự thật.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
