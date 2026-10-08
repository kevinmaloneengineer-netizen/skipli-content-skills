import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";

const USES = { "": "Tất cả", "in menu": "Menu in", "app giao đồ ăn": "GrabFood, ShopeeFood", "mạng xã hội": "Mạng xã hội" };

export default function MenuPage() {
  const [form, setForm] = useState({ dishes: "", business: "", use: "" });
  const [submit, busy, error] = useSubmitJob("menu");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  const count = form.dishes.split("\n").filter((l) => l.trim()).length;

  return (
    <SkillShell id="menu">
      <form className="form-card" onSubmit={(e) => { e.preventDefault(); submit(form); }} noValidate>
        <Field label={`Danh sách món (${count}/12)`} hint="Mỗi dòng một món: tên, giá nếu có, nguyên liệu hoặc điểm đặc biệt.">
          <textarea className="input-lg" rows={5} value={form.dishes} onChange={set("dishes")} placeholder={"Lẩu bò nhúng giấm, 299k, cho 2 người\nGỏi bò bóp thấu, 89k\nBò nướng lá lốt, 79k"} required autoFocus />
        </Field>
        <Field label="Quán của bạn (tuỳ chọn)" hint="Tên và phong cách: bình dân, sang trọng, quán trẻ…">
          <input value={form.business} onChange={set("business")} placeholder="Quán lẩu bò bình dân ở Quận 3" autoComplete="off" />
        </Field>
        <div className="field">
          <span className="field-label">Dùng chủ yếu cho</span>
          <Segmented name="use" label="Dùng cho" options={USES} value={form.use} onChange={set("use")} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Viết menu" eta="dưới 1 phút" />
        <Notes items={["Mỗi món có dòng menu in, mô tả cho app giao đồ ăn và caption đăng mạng xã hội.", "Không bịa giá, xuất xứ hay công dụng: thiếu giá thì để [GIÁ]."]} />
      </form>
    </SkillShell>
  );
}
