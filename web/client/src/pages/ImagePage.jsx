import { useEffect, useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import { GpuCard, PhotoPick } from "../components/GpuCard.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { api } from "../lib/api.js";
import { upload } from "../lib/image.js";

const SIZES = { "1:1": "Vuông 1:1", "4:5": "Dọc 4:5", "9:16": "Story 9:16", "16:9": "Ngang 16:9" };
const STYLES = { real: "Chân thực", cinematic: "Điện ảnh", pixar: "Hoạt hình 3D", anime: "Anime", clay: "Đất sét", cyberpunk: "Cyberpunk" };
const COUNTS = { 1: "1 ảnh", 2: "2 ảnh", 4: "4 ảnh" };

export default function ImagePage() {
  const [gpu, setGpu] = useState(null);
  const [form, setForm] = useState({ topic: "", brief: "", size: "1:1", style: "real", count: "4", withText: true });
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [submit, busy, error] = useSubmitJob("image");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

  useEffect(() => {
    api("/video/worker").then(setGpu, () => setGpu({ ok: false, configured: false, error: "Không gọi được máy chủ" }));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLocalError("");
    setUploading(true);
    try {
      const input = { ...form, count: Number(form.count) };
      if (photo) input.referenceImageId = await upload(photo);
      await submit(input);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SkillShell id="image">
      <GpuCard status={gpu} onChange={setGpu} />
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Sản phẩm hoặc chủ đề ảnh" hint="Càng cụ thể càng đẹp: món gì, màu gì, dùng ở đâu.">
          <input className="input-lg" value={form.topic} onChange={set("topic")} placeholder="Cà phê muối, ly nhựa trong, quán phong cách vintage" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Thông tin thêm (tuỳ chọn)">
          <textarea rows={2} value={form.brief} onChange={set("brief")} placeholder="Khách hàng, ưu đãi có thật, màu thương hiệu, dịp (khai trương, 8/3…)" />
        </Field>
        <div className="field">
          <span className="field-label">Khung ảnh</span>
          <Segmented name="size" label="Khung ảnh" options={SIZES} value={form.size} onChange={set("size")} />
        </div>
        <div className="row">
          <Field label="Phong cách">
            <select value={form.style} onChange={set("style")}>{Object.entries(STYLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </Field>
          <div className="field">
            <span className="field-label">Số ảnh</span>
            <Segmented name="count" label="Số ảnh" options={COUNTS} value={form.count} onChange={set("count")} />
          </div>
        </div>
        <PhotoPick label="Ảnh sản phẩm thật (tuỳ chọn)" hint="AI giữ dáng sản phẩm và vẽ bối cảnh mới xung quanh." value={photo} onChange={setPhoto} />
        <label className="check-row">
          <input type="checkbox" checked={form.withText} onChange={set("withText")} />
          <span>Có chữ trên ảnh (tiêu đề, dòng phụ, nút kêu gọi)</span>
        </label>
        {(error || localError) && <p className="form-error" role="alert">{localError || error}</p>}
        <SubmitRow busy={busy || uploading} label="Tạo ảnh" eta="1 đến 3 phút" />
        <Notes
          items={[
            "Ảnh vẽ bằng model mã nguồn mở trên GPU miễn phí (Kaggle), không tốn phí API.",
            "Chữ được đặt lên ảnh trong trình duyệt nên luôn đúng dấu tiếng Việt, sửa được trước khi tải về.",
            "Không dùng logo, hình người nổi tiếng hay thương hiệu của người khác.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
