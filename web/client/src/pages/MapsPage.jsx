import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

export default function MapsPage() {
  const [place, setPlace] = useState("");
  const [focus, setFocus] = useState("");
  const [submit, busy, error] = useSubmitJob("maps");

  function onSubmit(e) {
    e.preventDefault();
    submit({ place, focus });
  }

  return (
    <SkillShell id="maps">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Quán đối thủ" hint="Dán link Google Maps của quán (chắc chắn đúng quán), hoặc gõ tên kèm khu vực.">
          <input className="input-lg" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="https://maps.app.goo.gl/… hoặc Lẩu bò Ba Toa Quận 3" autoComplete="off" required autoFocus />
        </Field>
        <Field label="Muốn chú ý điều gì? (tuỳ chọn)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Khách nói gì về giá và khẩu phần" autoComplete="off" />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Phân tích review" eta="1 đến 2 phút" />
        <Notes items={["Đọc khoảng 80 đánh giá gần nhất trên Google Maps, không cần đăng nhập.", "Gõ tên thì hệ thống mở quán đầu tiên Google tìm thấy: dán link để chắc đúng quán.", "Trích dẫn ngắn, không kèm tên người đánh giá."]} />
      </form>
    </SkillShell>
  );
}
