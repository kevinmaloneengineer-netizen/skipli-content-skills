import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import FilePick from "../components/FilePick.jsx";
import { crop, loadImage, upload } from "../lib/image.js";

const LOOKS = [
  ["natural", "Tự nhiên", "Sáng và rõ hơn, màu thật"],
  ["warm", "Ấm áp", "Tông vàng ấm, hợp món nóng, nướng"],
  ["bright", "Tươi sáng", "Sáng nhiều, hợp đồ uống, salad, tráng miệng"],
  ["moody", "Sang trọng", "Tương phản sâu, hợp bít tết, rượu, quán tối"],
];
const AI_LEVELS = [
  ["off", "Tắt", "Chỉ chỉnh màu tự động, vài giây"],
  ["light", "AI nhẹ", "Ánh sáng và màu đẹp hơn, giữ sát ảnh gốc"],
  ["medium", "AI vừa", "Đẹp như ảnh studio, có thể mềm vài chi tiết nhỏ"],
];
const RATIOS = [
  ["1:1", "Vuông 1:1", "Facebook, Instagram"],
  ["4:5", "Dọc 4:5", "Instagram feed"],
  ["9:16", "Dọc 9:16", "Reels, TikTok, Story"],
  ["16:9", "Ngang 16:9", "Google, website"],
];

/** "Chỉnh ảnh món": one photo, a look, the frames wanted; graded on the server, the food untouched. */
export default function PhotoFixPage() {
  const [submit, busy, error] = useSubmitJob("photo-fix");
  const [photo, setPhoto] = useState(null);
  const [look, setLook] = useState("natural");
  const [ratios, setRatios] = useState(["1:1", "9:16"]);
  const [label, setLabel] = useState("");
  const [ai, setAi] = useState("off");
  const [gpu, setGpu] = useState(null); // null while checking; "AI làm đẹp" needs the GPU worker
  useEffect(() => {
    api("/video/worker").then((s) => setGpu(!!s.ok), () => setGpu(false));
  }, []);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const toggle = (r) => setRatios((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]));

  async function onSubmit(e) {
    e.preventDefault();
    setPhotoError("");
    if (!photo) return setPhotoError("Chọn ảnh món cần chỉnh.");
    if (!ratios.length) return setPhotoError("Chọn ít nhất một khung ảnh.");
    setUploading(true);
    let photoId;
    try {
      const img = await loadImage(photo);
      photoId = await upload(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 2048));
    } catch (err) {
      setPhotoError(err.message || "Không tải được ảnh. Thử ảnh khác nhé.");
      return;
    } finally {
      setUploading(false);
    }
    submit({ photoId, look, ratios, label, ai });
  }

  return (
    <SkillShell id="photo-fix">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Ảnh món</span>
          <FilePick accept="image/png,image/jpeg,image/webp" file={photo} onChange={(f) => { setPhoto(f); setPhotoError(""); }} placeholder="Chọn ảnh món từ máy" kind="image" disabled={busy || uploading} />
        </div>
        <Field label="Kiểu màu">
          <div className="pf-options" role="radiogroup">
            {LOOKS.map(([id, name, hint]) => (
              <button key={id} type="button" role="radio" aria-checked={look === id} className={look === id ? "pf-option on" : "pf-option"} data-look={id} onClick={() => setLook(id)}>
                <i aria-hidden="true" />
                <b>{name}</b>
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </Field>
        <Field label="AI làm đẹp" hint={gpu === false ? "AI làm đẹp chạy trên GPU, mà GPU đang tắt. Nhờ quản trị viên bật GPU để dùng." : "AI vẽ lại rất nhẹ trên chính ảnh của bạn để ánh sáng và màu đẹp hơn. Bố cục, đĩa và món giữ nguyên."}>
          <div className="pf-options is-ai" role="radiogroup">
            {AI_LEVELS.map(([id, name, hint]) => {
              const off = id !== "off" && gpu === false;
              return (
                <button key={id} type="button" role="radio" aria-checked={ai === id} disabled={off} className={ai === id ? "pf-option on" : "pf-option"} data-ai={id} onClick={() => setAi(id)}>
                  <b>{id === "off" ? name : `✨ ${name}`}</b>
                  <small>{off ? "Cần GPU" : hint}</small>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Khung ảnh (chọn nhiều)">
          <div className="pf-options is-ratios">
            {RATIOS.map(([id, name, hint]) => (
              <button key={id} type="button" aria-pressed={ratios.includes(id)} className={ratios.includes(id) ? "pf-option on" : "pf-option"} onClick={() => toggle(id)}>
                <span className="pf-frame" data-ratio={id} aria-hidden="true" />
                <b>{name}</b>
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tên món (tuỳ chọn)" hint="Để đặt tên file và tìm lại trong Lịch sử.">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bò lúc lắc" autoComplete="off" />
        </Field>
        {(photoError || error) && <p className="form-error" role="alert">{photoError || error}</p>}
        <SubmitRow busy={busy || uploading} label={uploading ? "Đang tải ảnh…" : "Chỉnh ảnh"} eta={ai === "off" ? "vài giây" : "khoảng 20 giây (lần đầu GPU tải mô hình có thể lâu hơn)"} />
        <Notes items={["Ảnh được chỉnh sáng, cân màu, làm rõ chi tiết và đặt vào khung bạn chọn. Món ăn giữ nguyên, AI không vẽ lại món.", "AI làm đẹp: AI vẽ lại nhẹ trên chính ảnh của bạn rồi chỉnh màu thêm một chút. Chọn AI nhẹ nếu cần ảnh sát thực tế nhất.", "Ảnh ngang đặt vào khung dọc chỉ cắt bớt tối đa 30% hai bên, phần còn lại nằm trên nền mờ của chính ảnh, nên không mất món."]} />
      </form>
    </SkillShell>
  );
}
