import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

export default function YelpPage() {
  const [url, setUrl] = useState("");
  const [focus, setFocus] = useState("");
  const [submit, busy, error] = useSubmitJob("yelp");

  return (
    <SkillShell id="yelp">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit({ url, focus }); }} noValidate>
        <Field label="Link quán trên Yelp" hint="Mở trang quán trên yelp.com rồi sao chép link trên thanh địa chỉ.">
          <input className="input-lg" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.yelp.com/biz/franklin-barbecue-austin" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Muốn chú ý điều gì? (tuỳ chọn)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Khách nói gì về thời gian chờ và giá" autoComplete="off" />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Phân tích review" eta="1 đến 2 phút" />
        <Notes items={["Đọc 30 review ít sao và 30 review nhiều sao nhất qua Apify, khoảng $0,06 mỗi lần.", "Trích dẫn giữ nguyên tiếng Anh, phần phân tích bằng tiếng Việt.", "Review ít sao có nút soạn trả lời bằng skill Trả lời review."]} />
      </form>
    </SkillShell>
  );
}
