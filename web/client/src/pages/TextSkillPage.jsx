import { useState } from "react";
import { Field, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { crop, loadImage, upload } from "../lib/image.js";

/** A form with a few text fields that submits one job; the page is set by its config (lib/textSkills.js). */
export default function TextSkillPage({ config }) {
  const [values, setValues] = useState(() => Object.fromEntries(config.fields.map((f) => [f.name, ""])));
  const [submit, busy, error] = useSubmitJob(config.type);
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setPhotoError("");
    let photoId;
    if (photo) {
      setUploading(true);
      try {
        const img = await loadImage(photo);
        photoId = await upload(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 1280));
      } catch (err) {
        setPhotoError(err.message || "Không tải được ảnh. Thử ảnh khác nhé.");
        return;
      } finally {
        setUploading(false);
      }
    }
    submit({ ...values, ...(photoId ? { photoId } : {}) });
  }

  return (
    <SkillShell id={config.type}>
      <form className="form-card" onSubmit={onSubmit} noValidate>
        {config.fields.map((f, i) => (
          <Field key={f.name} label={f.label} hint={f.hint}>
            {f.kind === "area" ? (
              <textarea rows={4} value={values[f.name]} onChange={set(f.name)} placeholder={f.placeholder} required={f.required} autoFocus={i === 0} />
            ) : (
              <input className={i === 0 ? "input-lg" : undefined} value={values[f.name]} onChange={set(f.name)} placeholder={f.placeholder} autoComplete="off" required={f.required} autoFocus={i === 0} />
            )}
          </Field>
        ))}
        {config.photo && (
          <div className="field">
            <span className="field-label">Ảnh món (tuỳ chọn)</span>
            <label className="file-pick">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); setPhotoError(""); }} disabled={busy || uploading} />
              <span>{photo ? photo.name : "Chọn ảnh món từ máy"}</span>
            </label>
          </div>
        )}
        {(photoError || error) && <p className="form-error" role="alert">{photoError || error}</p>}
        <SubmitRow busy={busy || uploading} label={uploading ? "Đang tải ảnh…" : config.label} eta={config.eta} />
        <Notes items={config.notes} />
      </form>
    </SkillShell>
  );
}
