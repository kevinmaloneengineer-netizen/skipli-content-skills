import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import FilePick from "../components/FilePick.jsx";
import SkillArt from "../components/SkillArt.jsx";
import { crop, loadImage, upload } from "../lib/image.js";
import { skillByType } from "../lib/constants.js";

/** The combos, as the server runs them (server/combos.mjs); credits are the sum of the steps. */
const RECIPES = [
  {
    id: "launch",
    title: "Ra mắt món mới",
    pitch: "Một ảnh món mới thành ảnh đẹp, bài Facebook, bài Google Business và video trình chiếu.",
    steps: [["photo-fix", "Chỉnh ảnh món"], ["write", "Bài Facebook"], ["gbp-post", "Bài Google Business"], ["video", "Video trình chiếu"]],
    credits: 8,
    eta: "khoảng 3 đến 6 phút",
  },
  {
    id: "care",
    title: "Chăm khách tuần này",
    pitch: "Đọc review Google Maps của quán, trả lời các điểm khách chê và viết bài Google từ điểm được khen.",
    steps: [["maps", "Đọc review Google Maps"], ["review", "Trả lời điểm chê"], ["gbp-post", "Bài Google từ điểm khen"]],
    credits: 4,
    eta: "khoảng 2 đến 4 phút",
  },
  {
    id: "promo",
    title: "Đẩy khuyến mãi",
    pitch: "Lên 3 khuyến mãi có tính sẵn lãi lỗ, rồi viết bài Facebook, tin Zalo và bài Google cho phương án đầu tiên.",
    steps: [["promo-plan", "Lên khuyến mãi"], ["write", "Bài Facebook"], ["zalo-message", "Tin Zalo"], ["gbp-post", "Bài Google Business"]],
    credits: 4,
    eta: "khoảng 1 đến 3 phút",
  },
  {
    id: "us-launch",
    title: "Ra mắt quán ở Mỹ",
    pitch: "Menu cho DoorDash, Uber Eats, Grubhub, bài Nextdoor chào hàng xóm và lịch ngày lễ Mỹ 60 ngày tới.",
    steps: [["delivery-menu", "Menu app giao đồ ăn"], ["nextdoor-post", "Bài Nextdoor"], ["us-occasions", "Ngày lễ Mỹ"]],
    credits: 3,
    eta: "khoảng 1 đến 3 phút",
  },
];

const NOTE = {
  launch: "Bước video cần GPU. Nếu GPU đang tắt, bước video báo lỗi và được hoàn credit, các bước còn lại vẫn xong.",
  care: "Bước trả lời và bài Google bị bỏ qua (không trừ credit) nếu báo cáo không tìm thấy điểm chê hoặc điểm khen.",
  promo: "Bài Facebook, tin Zalo và bài Google dùng phương án khuyến mãi đầu tiên, với giá do hệ thống tính từ giá bạn nhập. Muốn đẩy phương án khác thì dùng từng công cụ riêng.",
  "us-launch": "Menu viết tiếng Anh theo kiểu app giao đồ ăn ở Mỹ; bài Nextdoor và lịch ngày lễ cũng cho khách Mỹ.",
};

/** "Gói chạy liền": pick a combo, fill one form, the steps run one after another. */
export default function CombosPage() {
  const [recipe, setRecipe] = useState("launch");
  const [submit, busy, error] = useSubmitJob("combo");
  const [form, setForm] = useState({ dish: "", business: "", details: "", place: "", dishes: "", goal: "slow", limits: "", neighborhood: "", app: "all", notes: "" });
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const r = RECIPES.find((x) => x.id === recipe);

  async function onSubmit(e) {
    e.preventDefault();
    setLocalError("");
    if (recipe === "launch") {
      if (!photo) return setLocalError("Chọn ảnh món mới.");
      setUploading(true);
      try {
        const img = await loadImage(photo);
        const photoId = await upload(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 2048));
        submit({ recipe, photoId, dish: form.dish, business: form.business, details: form.details });
      } catch (err) {
        setLocalError(err.message || "Không tải được ảnh, thử ảnh khác nhé.");
      } finally {
        setUploading(false);
      }
    } else if (recipe === "care") submit({ recipe, place: form.place, business: form.business });
    else if (recipe === "promo") submit({ recipe, business: form.business, dishes: form.dishes, goal: form.goal, limits: form.limits });
    else submit({ recipe, business: form.business, neighborhood: form.neighborhood, dishes: form.dishes, app: form.app, notes: form.notes });
  }

  return (
    <SkillShell id="combos" wide>
      <div className="combo-pick" role="radiogroup">
        {RECIPES.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={recipe === x.id} className={recipe === x.id ? "combo-card on" : "combo-card"} onClick={() => setRecipe(x.id)}>
            <span className="combo-card-head"><b>{x.title}</b><small>{x.credits} credit</small></span>
            <span className="combo-card-pitch">{x.pitch}</span>
            <span className="combo-flow">
              {x.steps.map(([type, label], i) => {
                const skill = skillByType(type);
                return (
                  <span key={i} className="combo-flow-step" data-tone={skill?.tone}>
                    <i aria-hidden="true"><SkillArt id={skill?.id} /></i>
                    {label}
                  </span>
                );
              })}
            </span>
          </button>
        ))}
      </div>
      <form className="form-card" onSubmit={onSubmit} noValidate>
        {recipe === "launch" ? (
          <>
            <div className="field">
              <span className="field-label">Ảnh món mới</span>
              <FilePick accept="image/png,image/jpeg,image/webp" file={photo} onChange={(f) => { setPhoto(f); setLocalError(""); }} placeholder="Chọn ảnh món từ máy" kind="image" disabled={busy || uploading} />
            </div>
            <div className="row">
              <Field label="Tên món"><input className="input-lg" value={form.dish} onChange={set("dish")} placeholder="Phở bò cay" autoComplete="off" required /></Field>
              <Field label="Tên quán"><input className="input-lg" value={form.business} onChange={set("business")} placeholder="Phở Cali" autoComplete="off" required /></Field>
            </div>
            <Field label="Thông tin thật (tuỳ chọn)" hint="Giá, ưu đãi, ngày bắt đầu bán. AI chỉ dùng những gì bạn ghi.">
              <textarea rows={3} value={form.details} onChange={set("details")} placeholder="Giá 89.000đ, có từ thứ Hai, tặng trà đá tuần đầu" />
            </Field>
          </>
        ) : recipe === "promo" ? (
          <>
            <Field label="Tên quán"><input className="input-lg" value={form.business} onChange={set("business")} placeholder="Phở Cali" autoComplete="off" required /></Field>
            <Field label="Món" hint="Mỗi dòng một món: Tên món - giá bán - giá vốn. Có giá vốn thì hệ thống tính được lãi mỗi đơn.">
              <textarea rows={5} value={form.dishes} onChange={set("dishes")} placeholder={"Phở bò - 65.000 - 28.000\nBún chả - 55.000 - 24.000\nTrà đá - 5.000 - 1.000"} required />
            </Field>
            <div className="row">
              <Field label="Mục tiêu">
                <select value={form.goal} onChange={set("goal")}>
                  <option value="slow">Kéo khách giờ vắng</option>
                  <option value="bill">Tăng giá trị mỗi đơn</option>
                  <option value="launch">Đẩy món mới</option>
                  <option value="return">Kéo khách cũ quay lại</option>
                </select>
              </Field>
              <Field label="Giới hạn của bạn (tuỳ chọn)"><input value={form.limits} onChange={set("limits")} placeholder="Không giảm quá 15%" /></Field>
            </div>
          </>
        ) : recipe === "us-launch" ? (
          <>
            <div className="row">
              <Field label="Tên quán"><input className="input-lg" value={form.business} onChange={set("business")} placeholder="Pho Cali" autoComplete="off" required /></Field>
              <Field label="Khu phố hoặc thành phố"><input className="input-lg" value={form.neighborhood} onChange={set("neighborhood")} placeholder="Bay View, Milwaukee" autoComplete="off" required /></Field>
            </div>
            <Field label="Món" hint="Mỗi dòng một món: Tên món - giá - chi tiết (nguyên liệu, cỡ, độ cay…). AI chỉ dùng chi tiết bạn ghi.">
              <textarea rows={5} value={form.dishes} onChange={set("dishes")} placeholder={"Phở Tái - $14.95 - rare beef, 12-hour broth\nGỏi Cuốn - $7 - shrimp, pork, peanut sauce"} required />
            </Field>
            <div className="row">
              <Field label="App">
                <select value={form.app} onChange={set("app")}>
                  <option value="all">DoorDash, Uber Eats và Grubhub</option>
                  <option value="doordash">DoorDash</option>
                  <option value="ubereats">Uber Eats</option>
                  <option value="grubhub">Grubhub</option>
                </select>
              </Field>
              <Field label="Thông tin thật (tuỳ chọn)"><input value={form.notes} onChange={set("notes")} placeholder="Family-owned since 2015, open 11am to 9pm" /></Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Quán trên Google Maps" hint="Tên quán và khu vực, hoặc dán link Google Maps của quán.">
              <input className="input-lg" value={form.place} onChange={set("place")} placeholder="Phở Cali, Quận 1 hoặc https://maps.app.goo.gl/…" autoComplete="off" required />
            </Field>
            <Field label="Tên quán (để ký tên trong câu trả lời)">
              <input value={form.business} onChange={set("business")} placeholder="Phở Cali" autoComplete="off" />
            </Field>
          </>
        )}
        {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
        <SubmitRow busy={busy || uploading} label={uploading ? "Đang tải ảnh…" : `Chạy gói · ${r.credits} credit`} eta={r.eta} />
        <Notes items={["Các bước chạy lần lượt, mỗi bước là một kết quả riêng trong Lịch sử để xem, sửa và sao chép.", "Credit trừ theo từng bước khi bước đó bắt đầu. Bước lỗi được hoàn credit; các bước không cần đến nó vẫn chạy tiếp.", NOTE[recipe]]} />
      </form>
    </SkillShell>
  );
}
