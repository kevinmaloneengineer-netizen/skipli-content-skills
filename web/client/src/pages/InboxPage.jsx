import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const KINDS = { shop: "Bán hàng online", restaurant: "Nhà hàng, quán ăn" };
const CHANNELS = { Messenger: "Messenger", Zalo: "Zalo", TikTok: "TikTok" };
const TONES = ["Lễ phép, dạ thưa", "Thân thiện, gần gũi", "Ngắn gọn, nhanh"];

export default function InboxPage() {
  const [form, setForm] = useState({ business: "", kind: "shop", policies: "", channel: "Messenger", tone: "" });
  const [submit, busy, error] = useSubmitJob("inbox");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));

  return (
    <SkillShell id="inbox">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit(form); }} noValidate>
        <div className="row">
          <div className="field">
            <span className="field-label">Bạn kinh doanh</span>
            <Segmented name="kind" label="Loại kinh doanh" options={KINDS} value={form.kind} onChange={set("kind")} />
          </div>
          <div className="field">
            <span className="field-label">Kênh nhắn tin</span>
            <Segmented name="channel" label="Kênh" options={CHANNELS} value={form.channel} onChange={set("channel")} />
          </div>
        </div>
        <Field label="Cửa hàng / quán của bạn" hint="Bán gì, giá khoảng bao nhiêu, khách là ai.">
          <input className="input-lg" value={form.business} onChange={set("business")} placeholder={form.kind === "shop" ? "Shop áo thun nam basic, giá 199k" : "Quán lẩu bò Quận 3, 2 tầng, nhận đặt tiệc"} autoComplete="off" required autoFocus />
        </Field>
        <Field label="Chính sách có thật (tuỳ chọn)" hint="Phí ship, giờ mở cửa, đổi trả, đặt cọc… Để trống thì AI để chỗ trống cho bạn điền.">
          <textarea rows={3} value={form.policies} onChange={set("policies")} placeholder="Freeship đơn từ 2 áo, đổi size trong 7 ngày, giao 2 đến 3 ngày" />
        </Field>
        <Field label="Giọng văn">
          <select value={form.tone} onChange={set("tone")}>
            <option value="">Tự nhiên</option>
            {TONES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Viết kịch bản inbox" eta="dưới 1 phút" />
        <Notes items={["8 đến 12 tình huống khách hay nhắn, mỗi câu trả lời đều dẫn tới chốt đơn hoặc đặt bàn.", "Kèm tin nhắn gửi lại khi khách im lặng."]} />
      </form>
    </SkillShell>
  );
}
