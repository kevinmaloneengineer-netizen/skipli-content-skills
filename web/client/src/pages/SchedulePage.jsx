import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Calendar from "../components/Calendar.jsx";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { CLONE_PLATFORMS, TONES } from "../lib/constants.js";
import { nextMonday, ymd } from "../lib/dates.js";
import { PILLARS } from "../lib/text.js";

const DAYS = { 7: "7 ngày", 14: "14 ngày" };
const PER_DAY = { 1: "1 bài/ngày", 2: "2 bài/ngày" };

/** Query param (optional): ?week=YYYY-MM-DD opens the calendar on that week. */
export default function SchedulePage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ topic: "", brief: "", tone: "", days: "7", perDay: "1", platform: "facebook", start: ymd(nextMonday()), pillars: PILLARS.map((p) => p.id) });
  const [submit, busy, error] = useSubmitJob("plan");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const toggle = (id) => setForm((f) => (f.pillars.includes(id) && f.pillars.length === 1 ? f : { ...f, pillars: f.pillars.includes(id) ? f.pillars.filter((p) => p !== id) : PILLARS.map((p) => p.id).filter((p) => p === id || f.pillars.includes(p)) }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, days: Number(form.days), perDay: Number(form.perDay) });
  }

  return (
    <SkillShell id="schedule" wide>
      <Calendar initial={params.get("week") ?? undefined} />
      <form className="form-card plan-form" onSubmit={onSubmit} noValidate>
        <div className="plan-form-head">
          <span className="plan-badge">AI</span>
          <div>
            <h2>Chưa biết đăng gì? Để AI lên kế hoạch</h2>
            <p>AI viết sẵn bài cho từng ngày kèm giờ đăng. Xem lại rồi bấm một nút để đưa hết vào lịch.</p>
          </div>
        </div>
        <div className="row">
          <Field label="Kênh của bạn bán gì / nói về gì">
            <input value={form.topic} onChange={set("topic")} placeholder="Quán cà phê nhỏ ở Đà Nẵng" autoComplete="off" required />
          </Field>
          <Field label="Bắt đầu từ ngày">
            <input type="date" value={form.start} onChange={set("start")} required />
          </Field>
        </div>
        <Field label="Thông tin thêm (tuỳ chọn)">
          <textarea rows={2} value={form.brief} onChange={set("brief")} placeholder="Món mới, ưu đãi có thật, sự kiện trong tuần, khách hàng chính…" />
        </Field>
        <div className="row">
          <div className="field">
            <span className="field-label">Thời gian</span>
            <Segmented name="days" label="Số ngày" options={DAYS} value={form.days} onChange={set("days")} />
          </div>
          <div className="field">
            <span className="field-label">Số bài</span>
            <Segmented name="perDay" label="Số bài mỗi ngày" options={PER_DAY} value={form.perDay} onChange={set("perDay")} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <span className="field-label">Nền tảng</span>
            <Segmented name="platform" label="Nền tảng" options={CLONE_PLATFORMS} value={form.platform} onChange={set("platform")} />
          </div>
          <Field label="Giọng văn">
            <select value={form.tone} onChange={set("tone")}>
              <option value="">Thân thiện, tự nhiên</option>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Nhóm nội dung xen kẽ</span>
          <div className="segmented" role="group" aria-label="Nhóm nội dung">
            {PILLARS.map((p) => (
              <label key={p.id}>
                <input type="checkbox" checked={form.pillars.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Lên kế hoạch" eta="1 phút" />
        <Notes
          items={[
            "Lịch lưu trên máy chủ, mở ở máy nào cũng thấy.",
            "Đã kết nối Facebook Page thì mở bài trong lịch và bấm Đăng lên Facebook (đăng ngay hoặc để Facebook tự đăng đúng giờ). Chưa kết nối thì sao chép bài, tự đăng rồi bấm Đã đăng.",
            "Giờ gợi ý dựa trên khung giờ khách Việt hay online; chạy Phân tích fanpage để biết giờ hợp với kênh của bạn.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
