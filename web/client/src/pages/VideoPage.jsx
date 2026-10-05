import { useEffect, useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { api } from "../lib/api.js";
import { crop, cutGrid, loadImage, upload } from "../lib/image.js";

const MODES = { topic: "Kịch bản tự do", storyboard: "Story Board", story: "Kể chuyện" };
const STYLES = { real: "Chân thực", cinematic: "Điện ảnh", anime: "Anime", pixar: "Hoạt hình 3D", clay: "Đất sét", cyberpunk: "Cyberpunk" };
const TONES = { warm: "Nhẹ nhàng", fun: "Vui nhộn", emotional: "Cảm động", dramatic: "Kịch tính", inspiring: "Truyền cảm hứng" };
const RATIOS = { "9:16": "Dọc 9:16", "16:9": "Ngang 16:9", "1:1": "Vuông 1:1" };
const VOICES = { female: "Giọng nữ", male: "Giọng nam" };
const SECONDS = { 15: "15 giây", 30: "30 giây", 45: "45 giây", 60: "60 giây" };
const NARRATOR = { 0: "0%", 20: "20%", 40: "40%", 60: "60%", 100: "100%" };
const MAX_WORDS = 350;

/** GPU worker status + connect form (the Kaggle URL and token change every session). */
function GpuCard({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await api("/video/worker", { method: "PUT", body: { url, token } });
      onChange(s);
      if (s.ok) setOpen(false);
      else setError(s.error ?? "Chưa kết nối được");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  const label = status.mock
    ? "Chế độ demo: tạo video mẫu, không dùng GPU"
    : status.ok
      ? `GPU đã kết nối${status.gpu?.length ? ` (${status.gpu.join(", ")})` : ""} · model ${status.models === "ready" ? "sẵn sàng" : status.models === "loading" ? "đang tải, lần đầu mất vài phút" : status.models}`
      : status.configured
        ? `GPU mất kết nối: ${status.error ?? "không rõ"}`
        : "Chưa kết nối GPU";
  const state = status.ok ? (status.models === "error" ? "bad" : "ok") : "bad";

  return (
    <section className="gpu-card" data-state={state}>
      <div className="gpu-row">
        <span className="gpu-dot" aria-hidden="true" />
        <span className="gpu-label">{label}</span>
        <button type="button" className="btn small" onClick={() => setOpen((v) => !v)}>{status.ok ? "Đổi GPU" : "Kết nối GPU"}</button>
      </div>
      {status.modelError && <p className="form-error">Lỗi model: {status.modelError}</p>}
      {open && (
        <form className="gpu-form" onSubmit={connect}>
          <ol className="gpu-steps">
            <li>Mở <b>kaggle.com</b> → Create → New Notebook → File → Import notebook, chọn file <code>video-worker/skipli_video_worker.ipynb</code>.</li>
            <li>Cột phải: Accelerator <b>GPU T4 x2</b>, Internet <b>On</b>. Bấm <b>Run All</b>.</li>
            <li>Ô cuối hiện URL và Token, dán vào đây. Giữ tab Kaggle mở khi tạo video.</li>
          </ol>
          <div className="row">
            <Field label="URL">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.trycloudflare.com" autoComplete="off" required />
            </Field>
            <Field label="Token">
              <input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />
            </Field>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? "Đang kiểm tra…" : "Kết nối"}</button>
        </form>
      )}
    </section>
  );
}

/** One optional photo (character / product / narrator), resized in the browser. */
function PhotoPick({ label, hint, value, onChange }) {
  const [error, setError] = useState("");
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const img = await loadImage(file);
      onChange(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 1280));
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {value ? (
        <div className="photo-pick">
          <img src={value} alt="" />
          <button type="button" className="btn small" onClick={() => onChange(null)}>Bỏ ảnh</button>
        </div>
      ) : (
        <label className="drop">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
          <span>Chọn ảnh</span>
        </label>
      )}
      {hint && <small>{hint}</small>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

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
  const [form, setForm] = useState({ topic: "", narration: "", brief: "", seconds: "30", style: "real", tone: "warm", ratio: "9:16", voice: "female", narratorPct: "20" });
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
        <SubmitRow busy={busy || uploading} label="Tạo video" eta="15 đến 40 phút trên GPU miễn phí" />
        <Notes
          items={[
            "Chạy bằng model mã nguồn mở trên GPU miễn phí (Kaggle), không tốn phí API.",
            "Giọng đọc tiếng Việt và phụ đề được thêm tự động, các cảnh ghép thành một file MP4.",
            "Cảnh người kể chưa nhép môi theo lời, chỉ cử động tự nhiên.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
