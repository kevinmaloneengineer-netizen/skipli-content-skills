import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const MINUTES = { 30: "30 phút", 60: "60 phút", 90: "90 phút" };
const PLATFORMS = { facebook: "Facebook", tiktok: "TikTok" };
const HOSTS = ["Thân thiện, gần gũi", "Hài hước, năng lượng", "Chuyên gia, tư vấn kỹ", "Nhanh gọn, chốt đơn liên tục"];

export default function LivestreamPage() {
  const [form, setForm] = useState({ products: "", minutes: "60", platform: "facebook", offer: "", audience: "", host: "" });
  const [submit, busy, error] = useSubmitJob("livestream");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, minutes: Number(form.minutes) });
  }

  return (
    <SkillShell id="livestream">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Sản phẩm sẽ bán" hint="Mỗi dòng một sản phẩm: tên, giá nếu có, vài điểm nổi bật.">
          <textarea className="input-lg" rows={4} value={form.products} onChange={set("products")} placeholder={"Áo khoác gió, 350k, chống nước nhẹ, 4 màu\nQuần jogger, 250k, co giãn 4 chiều"} required autoFocus />
        </Field>
        <div className="row">
          <div className="field">
            <span className="field-label">Thời lượng</span>
            <Segmented name="minutes" label="Thời lượng" options={MINUTES} value={form.minutes} onChange={set("minutes")} />
          </div>
          <div className="field">
            <span className="field-label">Nền tảng</span>
            <Segmented name="platform" label="Nền tảng" options={PLATFORMS} value={form.platform} onChange={set("platform")} />
          </div>
        </div>
        <Field label="Ưu đãi trong buổi live (tuỳ chọn)" hint="Chỉ ghi ưu đãi có thật. Để trống thì kịch bản để chỗ [ƯU ĐÃI] cho bạn điền.">
          <textarea rows={2} value={form.offer} onChange={set("offer")} placeholder="Mua 2 giảm 10%, freeship đơn từ 500k" />
        </Field>
        <div className="row">
          <Field label="Khách hàng (tuỳ chọn)">
            <input value={form.audience} onChange={set("audience")} placeholder="Nữ văn phòng 25 đến 35 tuổi" autoComplete="off" />
          </Field>
          <Field label="Phong cách người live">
            <select value={form.host} onChange={set("host")}>
              <option value="">Tự nhiên</option>
              {HOSTS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Viết kịch bản" eta="khoảng 1 phút" />
        <Notes
          items={[
            "Kịch bản theo từng mốc phút, kèm câu chốt đơn, xử lý từ chối và trả lời nhanh bình luận.",
            "Không bịa giá, giảm giá hay số lượng còn lại: chỗ chưa có sẽ để [GIÁ], [ƯU ĐÃI] cho bạn điền.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
