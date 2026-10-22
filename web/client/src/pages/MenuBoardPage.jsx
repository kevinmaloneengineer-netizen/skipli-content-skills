import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Field } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import FilePick from "../components/FilePick.jsx";
import MenuView, { menuText, parseMenu } from "../components/MenuView.jsx";
import { api } from "../lib/api.js";
import { crop, loadImage } from "../lib/image.js";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { getLang } from "../lib/i18n.js";

const THEMES = [
  ["cream", "Kem cổ điển", "#c2451f"],
  ["noir", "Đen sang trọng", "#d4a64a"],
  ["garden", "Xanh vườn", "#2e6b4f"],
  ["street", "Phố đỏ", "#d23a2a"],
];
const COLORS = ["#c2451f", "#d4a64a", "#2e6b4f", "#d23a2a", "#2f5bd3", "#7d3a6c", "#1c1a16"];
const SAMPLE = `# Món chính
Phở bò tái - 65.000đ - Nước dùng hầm xương 12 tiếng, bánh phở tươi *
Phở gà ta - 60.000đ
Bún bò Huế - 65.000đ - Cay nhẹ, có chả cua

# Món thêm
Quẩy - 10.000đ
Trứng chần - 8.000đ

# Đồ uống
Trà đá - 5.000đ
Cà phê sữa đá - 25.000đ`;
const LOGO_MAX = 120_000; // characters of the data URL, the same cap as the server
const EMPTY = { name: "", tagline: "", note: "", contact: "", theme: "cream", color: "#c2451f", logo: "" };
const link = (id) => `${window.location.origin}/m/${id}`;

/** "Menu in & menu điện tử": one menu, printed on A4 (PDF) and as a phone page guests open from a QR code. Free. */
export default function MenuBoardPage() {
  const toast = useToast();
  const copy = useCopy();
  const [info, setInfo] = useState(EMPTY);
  const [text, setText] = useState(SAMPLE);
  const [logoFile, setLogoFile] = useState(null);
  const [view, setView] = useState("print");
  const [saved, setSaved] = useState([]); // the account's menus
  const [id, setId] = useState(null); // the menu being edited (null = new)
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  // "Chụp menu giấy": the photo is read on the server (1 credit); the old text stays one click away.
  const scanRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [beforeScan, setBeforeScan] = useState(null);
  async function scanMenu(file) {
    if (!file) return;
    setScanning(true);
    try {
      const img = await loadImage(file);
      const dataUrl = crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 2000, "image/jpeg"); // big enough for small print
      const { text: read } = await api("/menus/scan", { method: "POST", body: { dataUrl } });
      setBeforeScan(text);
      setText(read);
      toast(`Đã đọc ${parseMenu(read).reduce((a, s) => a + s.items.length, 0)} món từ ảnh. Kiểm tra lại tên và giá trước khi lưu.`);
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setScanning(false);
      if (scanRef.current) scanRef.current.value = "";
    }
  }
  const set = (k) => (e) => setInfo((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const sections = parseMenu(text, getLang() === "en" ? "Must try" : "Nên thử");
  const menu = { ...info, sections };
  const count = sections.reduce((a, s) => a + s.items.length, 0);
  const sheet = useRef(null);

  useEffect(() => {
    api("/menus").then(({ menus }) => setSaved(menus), () => {});
  }, []);

  // The logo is kept inside the menu (small picture), so the online page needs no upload that expires. It must
  // fit the server's cap (LOGO_MAX): a photo-like logo is too big as a 256 px PNG, so smaller sizes and WebP
  // (keeps transparency) are tried until one fits.
  useEffect(() => {
    if (!logoFile) return;
    loadImage(logoFile).then(
      (img) => {
        const tries = [[256, "image/png"], [256, "image/webp"], [192, "image/png"], [192, "image/webp"], [160, "image/jpeg"]];
        const logo = tries.map(([size, type]) => crop(img, 0, 0, img.naturalWidth, img.naturalHeight, size, type)).find((d) => d.length <= LOGO_MAX);
        if (!logo) return toast("Logo quá chi tiết, hãy dùng ảnh logo đơn giản hơn (PNG nền trong suốt).", { kind: "error" });
        setInfo((f) => ({ ...f, logo }));
      },
      (e) => toast(e.message, { kind: "error" }),
    );
  }, [logoFile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return setQr("");
    QRCode.toDataURL(link(id), { errorCorrectionLevel: "M", margin: 2, width: 600, color: { dark: "#1c1a16", light: "#ffffff" } }).then(setQr, () => setQr(""));
  }, [id]);

  function open(m) {
    setId(m.id);
    setInfo({ ...EMPTY, ...m.menu, sections: undefined });
    setText(menuText(m.menu.sections));
    setLogoFile(null);
  }
  function startNew() {
    setId(null);
    setInfo(EMPTY);
    setText("");
    setLogoFile(null);
  }

  async function save() {
    if (!count) return toast("Nhập ít nhất một món", { kind: "error" });
    setBusy(true);
    try {
      const body = { ...info, sections };
      const out = id ? await api(`/menus/${id}`, { method: "PUT", body }) : await api("/menus", { method: "POST", body });
      setId(out.menu.id);
      setSaved((list) => [out.menu, ...list.filter((m) => m.id !== out.menu.id)]);
      setView("web");
      toast(id ? "Đã cập nhật menu điện tử. Mã QR cũ vẫn dùng được." : "Đã tạo menu điện tử");
    } catch (e) {
      toast(e.message, { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !window.confirm("Xoá menu này? Link và mã QR của nó sẽ không mở được nữa.")) return;
    try {
      await api(`/menus/${id}`, { method: "DELETE" });
      setSaved((list) => list.filter((m) => m.id !== id));
      startNew();
      toast("Đã xoá menu");
    } catch (e) {
      toast(e.message, { kind: "error" });
    }
  }

  function print() {
    if (!count) return toast("Nhập ít nhất một món", { kind: "error" });
    document.documentElement.classList.add("printing-menu");
    const done = () => {
      document.documentElement.classList.remove("printing-menu");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  function downloadQr() {
    const a = document.createElement("a");
    a.href = qr;
    a.download = "qr-menu.png";
    a.click();
  }

  return (
    <SkillShell id="menu-board" wide>
      <div className="mb-layout">
        <div className="form-card">
          {saved.length > 0 && (
            <div className="mb-saved">
              <span className="field-label">Menu đã lưu</span>
              <div className="mb-saved-list">
                {saved.map((m) => (
                  <button key={m.id} type="button" className={m.id === id ? "mb-chip on" : "mb-chip"} onClick={() => open(m)}>{m.title}</button>
                ))}
                <button type="button" className={id ? "mb-chip add" : "mb-chip add on"} onClick={startNew}>+ Menu mới</button>
              </div>
            </div>
          )}
          <div className="row">
            <Field label="Tên quán"><input className="input-lg" value={info.name} onChange={set("name")} placeholder="Phở Cali" maxLength={60} autoComplete="off" /></Field>
            <Field label="Dòng giới thiệu (tuỳ chọn)"><input value={info.tagline} onChange={set("tagline")} placeholder="Phở nấu chậm, tươi mỗi ngày" maxLength={120} autoComplete="off" /></Field>
          </div>
          <div className="mb-scan">
            <button type="button" className="btn small" onClick={() => scanRef.current?.click()} disabled={scanning}>{scanning ? "Đang đọc menu…" : "Chụp menu giấy"}</button>
            <small>AI đọc tên món và giá từ ảnh menu hoặc bảng giá, điền sẵn vào ô bên dưới. 1 credit, không đọc được thì không trừ.</small>
            {beforeScan != null && !scanning && <button type="button" className="btn small ghost" onClick={() => { setText(beforeScan); setBeforeScan(null); }}>Hoàn tác</button>}
            <input ref={scanRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden onChange={(e) => scanMenu(e.target.files?.[0])} />
          </div>
          <Field label={`Món (${count})`} hint='Dòng bắt đầu bằng # là tên nhóm. Mỗi món một dòng: Tên món - giá - mô tả. Thêm " *" ở cuối để gắn nhãn Nên thử.'>
            <textarea className="mb-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} spellCheck={false} />
          </Field>
          <div className="row">
            <Field label="Ghi chú cuối menu (tuỳ chọn)"><input value={info.note} onChange={set("note")} placeholder="Giá đã gồm VAT" maxLength={200} autoComplete="off" /></Field>
            <Field label="Địa chỉ, điện thoại (tuỳ chọn)"><input value={info.contact} onChange={set("contact")} placeholder="12 Lê Thánh Tôn, Q.1 · 0909 123 456" maxLength={160} autoComplete="off" /></Field>
          </div>
          <Field label="Kiểu menu">
            <div className="mb-themes" role="radiogroup">
              {THEMES.map(([tid, name, accent]) => (
                <button key={tid} type="button" role="radio" aria-checked={info.theme === tid} className={info.theme === tid ? `mb-theme theme-${tid} on` : `mb-theme theme-${tid}`} onClick={() => setInfo((f) => ({ ...f, theme: tid, color: accent }))}>
                  <span className="mb-swatch" style={{ "--menu-accent": accent }}><i /><i /><i /></span>
                  <b>{name}</b>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Màu nhấn">
            <div className="qr-colors">
              {COLORS.map((c) => (
                <button key={c} type="button" className={c === info.color ? "on" : undefined} style={{ background: c }} onClick={() => setInfo((f) => ({ ...f, color: c }))} aria-label={`Màu ${c}`} />
              ))}
              <label className="qr-color-pick" title="Màu khác"><input type="color" value={info.color} onChange={set("color")} />+</label>
            </div>
          </Field>
          <div className="field">
            <span className="field-label">Logo (tuỳ chọn)</span>
            <FilePick accept="image/png,image/jpeg,image/webp" file={logoFile} onChange={(f) => { setLogoFile(f); if (!f) setInfo((x) => ({ ...x, logo: "" })); }} placeholder={info.logo ? "Đang dùng logo đã lưu, chọn để đổi" : "Chọn logo quán"} kind="image" />
          </div>
          <Notes items={["Miễn phí, không trừ credit.", "Menu điện tử có link cố định: sửa giá hay thêm món rồi bấm Cập nhật, mã QR đã in vẫn mở đúng menu mới.", "Bản in: bấm In / Lưu PDF, chọn khổ A4. Menu dài tự sang trang thứ hai."]} />
        </div>

        <aside className="mb-preview">
          <div className="mb-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={view === "print"} className={view === "print" ? "on" : undefined} onClick={() => setView("print")}>Menu in (A4)</button>
            <button type="button" role="tab" aria-selected={view === "web"} className={view === "web" ? "on" : undefined} onClick={() => setView("web")}>Menu điện tử</button>
          </div>
          {view === "print" ? (
            <>
              <div className="mb-paper" ref={sheet}>
                <div className="mb-paper-scale">
                  <MenuView menu={menu} mode="print" />
                </div>
              </div>
              <button type="button" className="btn primary" onClick={print}>In / Lưu PDF</button>
            </>
          ) : (
            <>
              <div className="mb-phone">
                <div className="mb-phone-screen">
                  <MenuView menu={menu} mode="web" />
                </div>
              </div>
              <button type="button" className="btn primary" onClick={save} disabled={busy}>{busy ? "Đang lưu…" : id ? "Cập nhật menu điện tử" : "Lưu và tạo link menu"}</button>
              {id && (
                <div className="mb-share">
                  {qr && <img src={qr} alt="Mã QR mở menu" />}
                  <div>
                    <a className="mb-link" href={link(id)} target="_blank" rel="noreferrer">{link(id).replace(/^https?:\/\//, "")}</a>
                    <div className="mb-share-actions">
                      <button type="button" className="btn small" onClick={() => copy(link(id))}>Sao chép link</button>
                      <button type="button" className="btn small" onClick={downloadQr} disabled={!qr}>Tải mã QR</button>
                      <button type="button" className="btn small mb-del" onClick={remove}>Xoá</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
      {/* What the printer gets: the A4 menu alone, full size (see .printing-menu in the CSS). */}
      {createPortal(
        <div className="mb-print-only" aria-hidden="true">
          <MenuView menu={menu} mode="print" />
        </div>,
        document.body,
      )}
    </SkillShell>
  );
}
