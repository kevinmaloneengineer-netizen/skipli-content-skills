import { useEffect, useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import { GpuCard, PhotoPick } from "../components/GpuCard.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { api } from "../lib/api.js";
import { cutGrid, loadImage, upload } from "../lib/image.js";

const MODES = { topic: "Kịch bản tự do", storyboard: "Story Board", story: "Kể chuyện" };
const STYLES = { real: "Chân thực", cinematic: "Điện ảnh", anime: "Anime", pixar: "Hoạt hình 3D", clay: "Đất sét", cyberpunk: "Cyberpunk" };
const TONES = { warm: "Nhẹ nhàng", fun: "Vui nhộn", emotional: "Cảm động", dramatic: "Kịch tính", inspiring: "Truyền cảm hứng" };
const RATIOS = { "9:16": "Dọc 9:16", "16:9": "Ngang 16:9", "1:1": "Vuông 1:1" };
const VOICES = { female: "Giọng nữ", male: "Giọng nam" };
const SECONDS = { 15: "15 giây", 30: "30 giây", 45: "45 giây", 60: "60 giây" };
const NARRATOR = { 0: "0%", 20: "20%", 40: "40%", 60: "60%", 100: "100%" };
const MAX_WORDS = 350;
const ENGINES = { wan: "Đẹp (Wan 2.2)", ltx: "Nhanh (LTX)" };
const ENGINE_HINT = {
  wan: "Wan 2.2 trên Hugging Face: đẹp nhất, khoảng 1 phút mỗi cảnh. Mỗi ngày chỉ đủ khoảng 1 video; hết lượt thì các cảnh còn lại tự dựng bằng LTX.",
  wan5b: "Wan 2.2 bản 5B trên GPU Kaggle: không lo hết lượt, đẹp hơn LTX nhiều nhưng chậm hơn (vài phút mỗi cảnh).",
  ltx: "LTX trên GPU Kaggle: nhanh nhất, hình kém hơn.",
};

function StoryboardPick({ panels, onChange }) {
  const [img, setImg] = useState(null);
  const [grid, setGrid] = useState({ rows: "2", cols: "5", trim: true });
  const [error, setError] = useState("");

  useEffect(() => {
    if (img) onChange(cutGrid(img, Number(grid.rows), Number(grid.cols), grid.trim ? 0.14 : 0));
  }, [img, grid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      setImg(await loadImage(file));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="field">
      <span className="field-label">Ảnh storyboard</span>
      <label className="drop">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
        <span>{img ? "Chọn ảnh khác" : "Chọn ảnh storyboard (một ảnh gồm nhiều ô)"}</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {img && (
        <>
          <div className="sb-grid-opts">
            <label>Số hàng <select value={grid.rows} onChange={(e) => setGrid((g) => ({ ...g, rows: e.target.value }))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label>Số cột <select value={grid.cols} onChange={(e) => setGrid((g) => ({ ...g, cols: e.target.value }))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="check"><input type="checkbox" checked={grid.trim} onChange={(e) => setGrid((g) => ({ ...g, trim: e.target.checked }))} /> Bỏ dòng chữ dưới mỗi ô</label>
          </div>
          <div className="sb-panels">
            {panels.map((p, i) => (
              <figure key={i}>
                <img src={p} alt={`Cảnh ${i + 1}`} />
                <figcaption>{i + 1}</figcaption>
                <button type="button" aria-label={`Bỏ cảnh ${i + 1}`} onClick={() => onChange(panels.filter((_, k) => k !== i))}>×</button>
              </figure>
            ))}
          </div>
          <small>{panels.length} cảnh, mỗi cảnh khoảng 8 giây. Bấm × để bỏ ô không dùng.</small>
        </>
      )}
    </div>
  );
}

export default function VideoPage() {
  const [gpu, setGpu] = useState(null);
  const [mode, setMode] = useState("topic");
  const [form, setForm] = useState({ topic: "", narration: "", brief: "", seconds: "30", style: "real", tone: "warm", ratio: "9:16", voice: "female", narratorPct: "20", engine: "wan" });
  const [photo, setPhoto] = useState(null);
  const [panels, setPanels] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [submit, busy, error] = useSubmitJob("video");
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  const words = form.narration.split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    api("/video/worker").then(setGpu, () => setGpu({ ok: false, configured: false, error: "Không gọi được máy chủ" }));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLocalError("");
    if (mode === "storyboard" && panels.length < 2) return setLocalError("Chọn ảnh storyboard có ít nhất 2 ô");
    setUploading(true);
    try {
      const input = { mode, ...form, seconds: Number(form.seconds), narratorPct: Number(form.narratorPct) };
      if (mode === "storyboard") input.panelIds = await Promise.all(panels.map(upload));
      else if (photo) input.referenceImageId = await upload(photo);
      await submit(input);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SkillShell id="video">
      <GpuCard status={gpu} onChange={setGpu} />
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Cách làm video</span>
          <Segmented name="mode" label="Cách làm video" options={MODES} value={mode} onChange={setMode} />
        </div>

        {mode === "topic" && (
          <>
            <Field label="Chủ đề video" hint="Viết ngắn gọn, AI tự viết từng cảnh.">
              <input className="input-lg" value={form.topic} onChange={set("topic")} placeholder="3 mẹo giúp quán ăn đông khách hơn" autoComplete="off" required autoFocus />
            </Field>
            <div className="field">
              <span className="field-label">Độ dài</span>
              <Segmented name="seconds" label="Độ dài" options={SECONDS} value={form.seconds} onChange={set("seconds")} />
            </div>
            <PhotoPick label="Ảnh nhân vật hoặc sản phẩm (tuỳ chọn)" hint="Giúp nhân vật/sản phẩm giống nhau ở các cảnh." value={photo} onChange={setPhoto} />
          </>
        )}

        {mode === "storyboard" && (
          <>
            <StoryboardPick panels={panels} onChange={setPanels} />
            <Field label="Câu chuyện nói về gì" hint="AI viết lời thoại cho từng ô theo đúng thứ tự.">
              <input value={form.topic} onChange={set("topic")} placeholder="Người cha lặng lẽ hy sinh để con được đi học" autoComplete="off" required />
            </Field>
          </>
        )}

        {mode === "story" && (
          <>
            <Field label={`Lời kể (${words}/${MAX_WORDS} từ)`} hint="Chỉ dán lời kể, không mô tả cảnh. AI giữ nguyên từng chữ và tự chia cảnh.">
              <textarea rows={7} value={form.narration} onChange={set("narration")} placeholder="Sau đây tôi xin kể cho bạn câu chuyện về cô bạn hàng xóm dễ mến…" required autoFocus />
            </Field>
            <PhotoPick label="Ảnh người kể chuyện (tuỳ chọn)" hint="Ảnh chân dung rõ mặt, nhìn thẳng." value={photo} onChange={setPhoto} />
            <div className="field">
              <span className="field-label">Tỉ lệ cảnh có người kể</span>
              <Segmented name="narratorPct" label="Tỉ lệ cảnh có người kể" options={NARRATOR} value={form.narratorPct} onChange={set("narratorPct")} />
            </div>
          </>
        )}

        <div className="field">
          <span className="field-label">Chất lượng</span>
          <Segmented name="engine" label="Chất lượng" options={ENGINES} value={form.engine} onChange={set("engine")} />
          <small>{ENGINE_HINT[form.engine]}</small>
        </div>
        <div className="row">
          <Field label="Phong cách">
            <select value={form.style} onChange={set("style")}>{Object.entries(STYLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </Field>
          <Field label="Tone cảm xúc">
            <select value={form.tone} onChange={set("tone")}>{Object.entries(TONES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </Field>
        </div>
        <div className="row">
          <div className="field">
            <span className="field-label">Khung hình</span>
            <Segmented name="ratio" label="Khung hình" options={RATIOS} value={form.ratio} onChange={set("ratio")} />
          </div>
          <div className="field">
            <span className="field-label">Giọng đọc</span>
            <Segmented name="voice" label="Giọng đọc" options={VOICES} value={form.voice} onChange={set("voice")} />
          </div>
        </div>
        {(error || localError) && <p className="form-error" role="alert">{localError || error}</p>}
        <SubmitRow busy={busy || uploading} label="Tạo video" eta={{ wan: "5 đến 15 phút", wan5b: "20 đến 50 phút", ltx: "15 đến 40 phút" }[form.engine]} />
        <Notes
          items={[
            "Chạy bằng model mã nguồn mở trên GPU miễn phí (Kaggle, Hugging Face), không tốn phí API. Vẫn cần kết nối GPU Kaggle để vẽ ảnh, đọc giọng và ghép video.",
            "Giọng đọc tiếng Việt và phụ đề được thêm tự động, các cảnh ghép thành một file MP4.",
            "Cảnh người kể chưa nhép môi theo lời, chỉ cử động tự nhiên.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
