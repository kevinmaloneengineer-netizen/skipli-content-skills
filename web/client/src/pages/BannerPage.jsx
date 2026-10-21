import { useEffect, useRef, useState } from "react";
import { Field } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import FilePick from "../components/FilePick.jsx";
import { loadImage } from "../lib/image.js";
import { getLang } from "../lib/i18n.js";
import { LAYOUTS, OCCASIONS, SIZES, drawBanner } from "../lib/banner.js";

const words = (id) => {
  const occ = OCCASIONS.find((x) => x.id === id) ?? OCCASIONS[0];
  return getLang() === "en" ? occ.en : occ.vi;
};

/** "Banner sự kiện và lễ": the occasion's colours and ornaments around the shop's dish photo and words. Free, in the browser. */
export default function BannerPage() {
  const [occasion, setOccasion] = useState("tet");
  const [size, setSize] = useState("post");
  const [layout, setLayout] = useState("frame");
  const [photoFile, setPhotoFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [logo, setLogo] = useState(null);
  const [form, setForm] = useState(() => {
    const [headline, sub] = words("tet");
    return { headline, sub, offer: "", footer: "" };
  });
  const [seed, setSeed] = useState(7);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sizeRow = SIZES.find((s) => s[0] === size) ?? SIZES[0];

  // The canvas uses the page fonts: wait for them once, or the first drawing falls back to Georgia.
  useEffect(() => {
    Promise.all(["600 80px Fraunces", '500 40px "Be Vietnam Pro"', '700 40px "Be Vietnam Pro"'].map((f) => document.fonts?.load(f))).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!photoFile) return setPhoto(null);
    loadImage(photoFile).then(setPhoto, (e) => setError(e.message));
  }, [photoFile]);
  useEffect(() => {
    if (!logoFile) return setLogo(null);
    loadImage(logoFile).then(setLogo, (e) => setError(e.message));
  }, [logoFile]);

  useEffect(() => {
    if (!ready || !canvas.current) return;
    drawBanner(canvas.current, { occasion, size: [sizeRow[2], sizeRow[3]], layout, photo, logo, seed, ...form });
  }, [ready, occasion, size, layout, photo, logo, form, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(id) {
    // Swap the suggested words only if the user has not written their own.
    const [oldHead, oldSub] = words(occasion);
    const [headline, sub] = words(id);
    setForm((f) => ({ ...f, headline: !f.headline || f.headline === oldHead ? headline : f.headline, sub: !f.sub || f.sub === oldSub ? sub : f.sub }));
    setOccasion(id);
  }

  function download() {
    const a = document.createElement("a");
    a.href = canvas.current.toDataURL("image/png");
    a.download = `banner-${occasion}-${size}.png`;
    a.click();
  }

  return (
    <SkillShell id="event-banner" wide>
      <div className="bn-layout">
        <div className="form-card">
          <Field label="Dịp">
            <div className="bn-occasions" role="radiogroup">
              {OCCASIONS.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={occasion === o.id} className={occasion === o.id ? "bn-occ on" : "bn-occ"} style={{ "--bn-a": o.bg[0], "--bn-b": o.bg[1], "--bn-c": o.accent }} onClick={() => pick(o.id)}>
                  <span aria-hidden="true" />
                  {o.name}
                </button>
              ))}
            </div>
          </Field>
          <div className="field">
            <span className="field-label">Ảnh món (tuỳ chọn)</span>
            <FilePick accept="image/png,image/jpeg,image/webp" file={photoFile} onChange={setPhotoFile} placeholder="Chọn ảnh món hoặc ảnh quán" kind="image" />
          </div>
          <Field label="Bố cục">
            <div className="pf-options is-qr-kind" role="radiogroup">
              {LAYOUTS.map(([id, name, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={layout === id} disabled={id !== "text" && !photo} className={layout === id || (!photo && id === "text") ? "pf-option on" : "pf-option"} onClick={() => setLayout(id)}>
                  <b>{name}</b>
                  <small>{id !== "text" && !photo ? "Cần ảnh món" : hint}</small>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Câu chính"><input className="input-lg" value={form.headline} onChange={set("headline")} maxLength={60} autoComplete="off" /></Field>
          <Field label="Dòng phụ"><input value={form.sub} onChange={set("sub")} maxLength={100} autoComplete="off" /></Field>
          <div className="row">
            <Field label="Ưu đãi (tuỳ chọn)" hint="Chỉ ghi ưu đãi có thật."><input value={form.offer} onChange={set("offer")} placeholder="Giảm 10% hoá đơn từ 28/1 đến 5/2" maxLength={80} autoComplete="off" /></Field>
            <Field label="Chân banner (tuỳ chọn)"><input value={form.footer} onChange={set("footer")} placeholder="Phở Cali · 12 Lê Thánh Tôn, Q.1" maxLength={100} autoComplete="off" /></Field>
          </div>
          <div className="field">
            <span className="field-label">Logo (tuỳ chọn)</span>
            <FilePick accept="image/png,image/jpeg,image/webp" file={logoFile} onChange={setLogoFile} placeholder="Chọn logo quán" kind="image" />
          </div>
          <Notes items={["Miễn phí, không trừ credit. Banner vẽ ngay trên trình duyệt của bạn.", "Không thích vị trí hoạ tiết thì bấm Đổi hoạ tiết.", "Ảnh bìa Facebook để chữ bên trái, ảnh bên phải, tránh ảnh đại diện che chữ trên điện thoại."]} />
        </div>
        <aside className="bn-preview">
          <div className="bn-sizes" role="radiogroup" aria-label="Khổ ảnh">
            {SIZES.map(([id, name]) => (
              <button key={id} type="button" role="radio" aria-checked={size === id} className={size === id ? "on" : undefined} onClick={() => setSize(id)}>{name}</button>
            ))}
          </div>
          <div className="bn-canvas">
            <canvas ref={canvas} aria-label="Xem trước banner" />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="bn-actions">
            <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}>Đổi hoạ tiết</button>
            <button type="button" className="btn primary" onClick={download}>Tải PNG {sizeRow[2]}×{sizeRow[3]}</button>
          </div>
        </aside>
      </div>
    </SkillShell>
  );
}
