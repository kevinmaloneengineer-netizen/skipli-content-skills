import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const PLATFORMS = ["Facebook", "TikTok", "Instagram", "Threads"];

export default function HashtagPage() {
  const [form, setForm] = useState({ business: "", area: "", audience: "" });
  const [platforms, setPlatforms] = useState(["Facebook", "TikTok"]);
  const [submit, busy, error] = useSubmitJob("hashtag");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const toggle = (p) => setPlatforms((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  return (
    <SkillShell id="hashtag">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit({ ...form, platforms }); }} noValidate>
        <Field label="Quán / sản phẩm của bạn">
          <input className="input-lg" value={form.business} onChange={set("business")} placeholder="Quán lẩu bò bình dân" autoComplete="off" required autoFocus />
        </Field>
        <div className="row">
          <Field label="Khu vực (tuỳ chọn)">
            <input value={form.area} onChange={set("area")} placeholder="Quận 3, TP.HCM" autoComplete="off" />
          </Field>
          <Field label="Khách hàng (tuỳ chọn)">
            <input value={form.audience} onChange={set("audience")} placeholder="Dân văn phòng, nhóm bạn trẻ" autoComplete="off" />
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Nền tảng</span>
          <div className="chip-picks">
            {PLATFORMS.map((p) => (
              <label key={p} className={platforms.includes(p) ? "chip-pick on" : "chip-pick"}>
                <input type="checkbox" checked={platforms.includes(p)} onChange={() => toggle(p)} />
                {p}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Gợi ý hashtag" eta="dưới 1 phút" />
        <Notes items={["4 bộ hashtag: tiếp cận rộng, khách quanh khu vực, ngách dễ lên top, thương hiệu riêng.", "Khung giờ đăng là điểm khởi đầu để thử, xem bài nào chạy tốt rồi điều chỉnh."]} />
      </form>
    </SkillShell>
  );
}
