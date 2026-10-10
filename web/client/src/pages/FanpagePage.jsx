import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import TimeZoneField from "../components/TimeZoneField.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

/** Query param (optional): ?url= to prefill the page link. */
export default function FanpagePage() {
  const [params] = useSearchParams();
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [focus, setFocus] = useState("");
  const [tz, setTz] = useState("Asia/Ho_Chi_Minh");
  const [submit, busy, error] = useSubmitJob("fanpage");

  function onSubmit(e) {
    e.preventDefault();
    submit({ url, focus, tz });
  }

  return (
    <SkillShell id="fanpage">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Link fanpage đối thủ" hint="Trang hoặc trang cá nhân công khai có đăng reels.">
          <input className="input-lg" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="facebook.com/tenkenh" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Muốn tìm hiểu thêm điều gì (tuỳ chọn)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Họ bán khoá học thế nào, bài nào kéo inbox…" autoComplete="off" />
        </Field>
        <TimeZoneField value={tz} onChange={setTz} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Phân tích fanpage" eta="2 đến 4 phút" />
        <Notes
          items={[
            "Đọc 100 reel gần nhất, không cần đăng nhập Facebook.",
            "Số liệu (ngày, giờ, độ dài video, caption) được tính tự động, AI chỉ viết nhận xét dựa trên đó.",
            "Giờ đăng tính theo giờ Việt Nam.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
