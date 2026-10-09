import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const COUNTS = { 3: "3 video", 6: "6 video", 10: "10 video" };

export default function TiktokPage() {
  const [keywords, setKeywords] = useState("");
  const [profiles, setProfiles] = useState("");
  const [business, setBusiness] = useState("");
  const [top, setTop] = useState("6");
  const [submit, busy, error] = useSubmitJob("tiktok");

  function onSubmit(e) {
    e.preventDefault();
    submit({ keywords: keywords.split("\n"), profiles: profiles.split(/[,\s]+/), top: Number(top), business });
  }

  return (
    <SkillShell id="tiktok">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Từ khoá" hint="Mỗi dòng một từ khoá, tối đa 3.">
          <textarea className="input-lg" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"lẩu bò\nreview quán ăn quận 3"} autoFocus />
        </Field>
        <Field label="Tài khoản TikTok (tuỳ chọn)" hint="Tối đa 3 tài khoản đối thủ.">
          <input value={profiles} onChange={(e) => setProfiles(e.target.value)} placeholder="@doithu1, @doithu2" autoComplete="off" />
        </Field>
        <div className="row">
          <Field label="Kinh doanh của bạn (tuỳ chọn)" hint="Để AI gợi ý ý tưởng quay hợp với bạn.">
            <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Quán lẩu bò Quận 3" autoComplete="off" />
          </Field>
          <div className="field">
            <span className="field-label">Lấy bao nhiêu video</span>
            <Segmented name="top" label="Số video" options={COUNTS} value={top} onChange={setTop} />
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Tìm video viral" eta="1 đến 2 phút" />
        <Notes items={["Không cần đăng nhập TikTok. Số liệu lượt xem, thích, bình luận, chia sẻ lấy trực tiếp từ từng video.", "Xếp hạng theo thích + 2×bình luận + 3×chia sẻ + 2×lưu.", "Kèm 5 ý tưởng quay cho kênh của bạn."]} />
      </form>
    </SkillShell>
  );
}
