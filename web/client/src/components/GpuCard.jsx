import { useState } from "react";
import { useAuth } from "./AuthGate.jsx";
import { api } from "../lib/api.js";
import { crop, loadImage } from "../lib/image.js";
import { Field } from "./Form.jsx";

/** GPU worker status + connect form (the Kaggle URL and token change every session). */
export function GpuCard({ status, onChange }) {
  const { mode, user } = useAuth();
  const canConnect = mode !== "accounts" || user?.role === "admin"; // customers use the admin's GPU
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
        {canConnect && <button type="button" className="btn small" onClick={() => setOpen((v) => !v)}>{status.ok ? "Đổi GPU" : "Kết nối GPU"}</button>}
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
/** Several photos in order (real photos of the restaurant for a slideshow). */
export function PhotosPick({ label, hint, value, onChange, max = 6 }) {
  const [error, setError] = useState("");
  async function pick(e) {
    const files = [...(e.target.files ?? [])].slice(0, max - value.length);
    e.target.value = "";
    setError("");
    try {
      const added = [];
      for (const f of files) {
        const img = await loadImage(f);
        added.push(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 1920));
      }
      onChange([...value, ...added]);
    } catch (err) {
      setError(err.message);
    }
  }
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="field">
      <span className="field-label">{label} ({value.length}/{max})</span>
      <div className="photos-pick">
        {value.map((src, i) => (
          <figure key={i}>
            <img src={src} alt={`Ảnh ${i + 1}`} />
            <span className="photos-num">{i + 1}</span>
            <span className="photos-tools">
              {i > 0 && <button type="button" onClick={() => move(i, -1)} aria-label="Lên trước">←</button>}
              {i < value.length - 1 && <button type="button" onClick={() => move(i, 1)} aria-label="Ra sau">→</button>}
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Bỏ ảnh">✕</button>
            </span>
          </figure>
        ))}
        {value.length < max && (
          <label className="drop photos-add">
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={pick} />
            <span>+ Thêm ảnh</span>
          </label>
        )}
      </div>
      {hint && <small>{hint}</small>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

export function PhotoPick({ label, hint, value, onChange, png = false }) {
  const [error, setError] = useState("");
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const img = await loadImage(file);
      onChange(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, png ? 600 : 1280, png ? "image/png" : "image/jpeg"));
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

