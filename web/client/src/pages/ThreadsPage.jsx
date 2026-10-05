import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const DAYS = { 7: "7 ngày", 30: "30 ngày", 90: "90 ngày", 0: "Tất cả" };
const COUNTS = { 5: "5 bài", 10: "10 bài", 20: "20 bài" };

export default function ThreadsPage() {
  const [keywords, setKeywords] = useState("");
  const [profiles, setProfiles] = useState("");
  const [days, setDays] = useState("30");
  const [top, setTop] = useState("10");
  const [submit, busy, error] = useSubmitJob("threads");

  function onSubmit(e) {
    e.preventDefault();
    submit({ keywords: keywords.split("\n"), profiles: profiles.split(/[,\s]+/), days: Number(days), top: Number(top) });
  }

  return (
    <SkillShell id="threads">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Từ khoá" hint="Mỗi dòng một từ khoá, tối đa 4. AI tự thêm vài biến thể đồng nghĩa.">
          <textarea className="input-lg" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"bán hàng online\nkinh doanh nhỏ"} autoFocus />
        </Field>
        <Field label="Tài khoản đối thủ (tuỳ chọn)" hint="Mỗi tài khoản cho ~10 bài gần nhất. Tối đa 5.">
          <input value={profiles} onChange={(e) => setProfiles(e.target.value)} placeholder="@doithu1, @doithu2" autoComplete="off" />
        </Field>
        <div className="row">
          <div className="field">
            <span className="field-label">Trong khoảng</span>
            <Segmented name="days" label="Khoảng thời gian" options={DAYS} value={days} onChange={setDays} />
          </div>
          <div className="field">
            <span className="field-label">Lấy bao nhiêu bài</span>
            <Segmented name="top" label="Số bài" options={COUNTS} value={top} onChange={setTop} />
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Tìm bài viral" eta="1 đến 3 phút" />
        <Notes
          items={[
            'Không cần đăng nhập. Mỗi từ khoá lấy khoảng 20 đến 30 bài nổi bật từ tab "Hàng đầu".',
            "Xếp hạng theo thích + 2×trả lời + 3×(đăng lại + trích dẫn).",
            "Ý tưởng gợi ý là góc viết mới, không phải chép lại bài của người khác.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
