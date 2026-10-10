import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const STARS = { 0: "Không rõ", 1: "1★", 2: "2★", 3: "3★", 4: "4★", 5: "5★" };
const STYLES = ["Chân thành, xin lỗi", "Chuyên nghiệp", "Gần gũi, vui vẻ", "Ngắn gọn"];

export default function ReviewPage() {
  const [params] = useSearchParams(); // ?review=&stars=&business= from the Google Maps report
  const [form, setForm] = useState(() => ({ review: params.get("review") ?? "", stars: /^[1-5]$/.test(params.get("stars") ?? "") ? params.get("stars") : "0", business: params.get("business") ?? "", style: "", facts: "" }));
  const [submit, busy, error] = useSubmitJob("review");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, stars: Number(form.stars) });
  }

  return (
    <SkillShell id="review">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Đánh giá của khách" hint="Dán nguyên văn từ Google Maps, Facebook, Foody…">
          <textarea className="input-lg" rows={5} value={form.review} onChange={set("review")} placeholder="Nước lẩu ngon nhưng chờ món hơn 30 phút, nhân viên không xin lỗi câu nào." required autoFocus />
        </Field>
        <div className="field">
          <span className="field-label">Số sao</span>
          <Segmented name="stars" label="Số sao" options={STARS} value={form.stars} onChange={set("stars")} />
        </div>
        <div className="row">
          <Field label="Tên quán (tuỳ chọn)">
            <input value={form.business} onChange={set("business")} placeholder="Lẩu Bò Cô Ba" autoComplete="off" />
          </Field>
          <Field label="Giọng trả lời">
            <select value={form.style} onChange={set("style")}>
              <option value="">Để AI chọn 3 giọng</option>
              {STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Quán đã làm gì, có ưu đãi gì không? (tuỳ chọn)" hint="Chỉ ghi điều có thật. Để trống thì AI để chỗ [ƯU ĐÃI] cho bạn điền.">
          <textarea rows={2} value={form.facts} onChange={set("facts")} placeholder="Đã thêm 1 bạn phục vụ giờ cao điểm. Tặng nước cho lần ghé sau." />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Viết câu trả lời" eta="dưới 1 phút" />
        <Notes items={["3 phương án khác giọng, đều lịch sự và an toàn để đăng công khai.", "Review chê: xin lỗi đúng chỗ khách phàn nàn, không cãi, mời khách liên hệ riêng.", "Kèm vài việc nên làm thêm để khách quay lại."]} />
      </form>
    </SkillShell>
  );
}
