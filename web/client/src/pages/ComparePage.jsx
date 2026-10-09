import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

export default function ComparePage() {
  const [urls, setUrls] = useState(["", "", ""]);
  const [focus, setFocus] = useState("");
  const [submit, busy, error] = useSubmitJob("compare");
  const setUrl = (i) => (e) => setUrls((u) => u.map((x, k) => (k === i ? e.target.value : x)));

  return (
    <SkillShell id="compare">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit({ urls: urls.filter((u) => u.trim()), focus }); }} noValidate>
        {urls.map((u, i) => (
          <Field key={i} label={`Fanpage ${i + 1}${i === 2 ? " (tuỳ chọn)" : ""}`}>
            <input className={i === 0 ? "input-lg" : undefined} value={u} onChange={setUrl(i)} placeholder={`facebook.com/doithu${i + 1}`} autoComplete="off" autoFocus={i === 0} />
          </Field>
        ))}
        <Field label="Muốn so sánh điều gì? (tuỳ chọn)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Kênh nào bán hàng qua video tốt hơn" autoComplete="off" />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="So sánh" eta="2 đến 4 phút" />
        <Notes items={["Đọc 50 reel gần nhất của mỗi kênh, không cần đăng nhập.", "Số liệu tính trực tiếp từ dữ liệu: reel mỗi tuần, tương tác trung vị, reel viral, ngày giờ và độ dài video hiệu quả.", "AI nhận xét điểm mạnh, điểm yếu từng kênh và bài học cho bạn."]} />
      </form>
    </SkillShell>
  );
}
