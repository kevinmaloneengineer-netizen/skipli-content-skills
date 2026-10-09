import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { CLONE_PLATFORMS } from "../lib/constants.js";
import { nextMonday, ymd } from "../lib/dates.js";

const DAYS = { 7: "7 ngày", 14: "14 ngày" };
const PER_DAY = { 1: "1 bài/ngày", 2: "2 bài/ngày" };

export default function CampaignPage() {
  const [form, setForm] = useState({ url: "", topic: "", brief: "", days: "7", perDay: "1", platform: "facebook", start: ymd(nextMonday()) });
  const [submit, busy, error] = useSubmitJob("campaign");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));

  return (
    <SkillShell id="campaign">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit({ ...form, days: Number(form.days), perDay: Number(form.perDay) }); }} noValidate>
        <Field label="Kênh đối thủ muốn học" hint="Link fanpage Facebook. Hệ thống quét kênh rồi AI xem 3 reel hiệu quả nhất.">
          <input className="input-lg" value={form.url} onChange={set("url")} placeholder="facebook.com/doithu" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Kênh của bạn" hint="Bán gì, cho ai. AI viết bài cho kênh này.">
          <input value={form.topic} onChange={set("topic")} placeholder="Quán lẩu bò bình dân ở Quận 3" autoComplete="off" required />
        </Field>
        <Field label="Thông tin thêm (tuỳ chọn)" hint="Giá, giờ mở cửa, ưu đãi có thật. Không có thì AI để chỗ trống cho bạn điền.">
          <textarea rows={2} value={form.brief} onChange={set("brief")} placeholder="Combo 2 người 299k, mở cửa 16h đến 23h" />
        </Field>
        <div className="row">
          <Field label="Bắt đầu từ">
            <input type="date" value={form.start} onChange={set("start")} required />
          </Field>
          <div className="field">
            <span className="field-label">Nền tảng</span>
            <Segmented name="platform" label="Nền tảng" options={CLONE_PLATFORMS} value={form.platform} onChange={set("platform")} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <span className="field-label">Thời gian</span>
            <Segmented name="days" label="Thời gian" options={DAYS} value={form.days} onChange={set("days")} />
          </div>
          <div className="field">
            <span className="field-label">Số bài</span>
            <Segmented name="perDay" label="Số bài" options={PER_DAY} value={form.perDay} onChange={set("perDay")} />
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Chạy chiến dịch" eta="2 đến 4 phút" />
        <Notes items={["Làm liền 3 bước: quét kênh đối thủ, AI xem 3 reel hiệu quả nhất, lên kế hoạch và viết sẵn từng bài.", "Kết quả là kế hoạch như công cụ Lên lịch: bấm một lần để thêm cả tuần vào lịch đăng.", "Chỉ học cách làm (hook, định dạng, góc tiếp cận), không chép bài của đối thủ."]} />
      </form>
    </SkillShell>
  );
}
