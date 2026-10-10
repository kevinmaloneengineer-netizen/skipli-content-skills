import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import TimeZoneField from "../components/TimeZoneField.jsx";

export default function InstagramPage() {
  const [url, setUrl] = useState("");
  const [focus, setFocus] = useState("");
  const [tz, setTz] = useState("America/Chicago");
  const [submit, busy, error] = useSubmitJob("instagram");

  return (
    <SkillShell id="instagram">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit({ url, focus, tz }); }} noValidate>
        <Field label="Tài khoản Instagram đối thủ" hint="Tên tài khoản công khai, hoặc link trang cá nhân.">
          <input className="input-lg" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="@franklinbbq hoặc instagram.com/franklinbbq" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Muốn tìm hiểu thêm điều gì (tuỳ chọn)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Họ quảng bá món mới thế nào" autoComplete="off" />
        </Field>
        <TimeZoneField value={tz} onChange={setTz} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Phân tích Instagram" eta="1 đến 3 phút" />
        <Notes items={["Đọc 40 bài gần nhất (bỏ bài ghim) qua Apify, khoảng $0,07 mỗi lần.", "Tương tác = lượt thích + 2 x bình luận; Instagram không cho xem lượt chia sẻ.", "Tài khoản riêng tư thì không đọc được."]} />
      </form>
    </SkillShell>
  );
}
