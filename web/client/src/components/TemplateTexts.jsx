import { TEMPLATE_TEXTS } from "../../../shared/templateTexts.js";

/**
 * The words of a slideshow template the user may change: the template's own fields (its words shown as the
 * placeholder, empty = keep them) and the slogan (empty = the AI writes one).
 */
export default function TemplateTexts({ layout, texts, onTexts, tagline, onTagline }) {
  const fields = TEMPLATE_TEXTS[layout] ?? [];
  const set = (key) => (e) => onTexts({ ...texts, [key]: e.target.value });
  return (
    <fieldset className="slide-card-fields">
      <legend>Chữ trong video (tuỳ chọn)</legend>
      <p className="hint">Để trống thì dùng chữ có sẵn của mẫu (chữ mờ trong ô).</p>
      <div className="row">
        {fields.map(([key, label, own]) => (
          <label className="field" key={key}>
            <span className="field-label">{label}</span>
            <input value={texts[key] ?? ""} onChange={set(key)} placeholder={own} maxLength={key === "words" ? 100 : 40} autoComplete="off" />
          </label>
        ))}
        <label className="field">
          <span className="field-label">Slogan</span>
          <input value={tagline} onChange={(e) => onTagline(e.target.value)} placeholder="Để trống thì AI tự viết" maxLength={60} autoComplete="off" />
        </label>
      </div>
    </fieldset>
  );
}
