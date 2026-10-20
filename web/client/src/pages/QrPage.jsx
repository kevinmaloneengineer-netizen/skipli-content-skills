import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Field } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import FilePick from "../components/FilePick.jsx";
import { loadImage } from "../lib/image.js";

const KINDS = [
  ["link", "Link", "Menu, Google Maps, fanpage, đặt bàn"],
  ["wifi", "Wi-Fi", "Khách quét là vào mạng, khỏi đọc mật khẩu"],
  ["text", "Văn bản", "Lời chào, mã giảm giá, số điện thoại"],
];
const COLORS = ["#1c1a16", "#c2451f", "#2e6b4f", "#2f5bd3", "#5b3fc4", "#8f2f17"];
const STYLES = [
  ["code", "Chỉ mã QR", "PNG vuông để dán vào ảnh, menu"],
  ["card", "Thẻ dựng bàn", "Tên quán + lời nhắc, in khổ A6"],
];

/** What the QR holds. Wi-Fi uses the format phone cameras understand (WIFI:T:WPA;S:…;P:…;;). */
function payload(kind, v) {
  if (kind === "link") {
    const url = v.url.trim();
    if (!url) return "";
    return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
  }
  if (kind === "wifi") {
    if (!v.ssid.trim()) return "";
    const esc = (s) => s.replace(/([\\;,:"])/g, "\\$1");
    return `WIFI:T:${v.password ? v.security : "nopass"};S:${esc(v.ssid.trim())};${v.password ? `P:${esc(v.password)};` : ""};`;
  }
  return v.text.trim();
}

/** The QR on a canvas (error correction H: a logo may cover the middle and it still scans). */
async function drawCode(text, color, logo, size = 1024) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, { errorCorrectionLevel: "H", margin: 2, width: size, color: { dark: color, light: "#ffffff" } });
  if (logo) {
    const ctx = canvas.getContext("2d");
    const box = size * 0.22;
    const x = (size - box) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x - box * 0.08, x - box * 0.08, box * 1.16, box * 1.16, box * 0.18);
    ctx.fill();
    const k = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
    const w = logo.naturalWidth * k;
    const h = logo.naturalHeight * k;
    ctx.drawImage(logo, (size - w) / 2, (size - h) / 2, w, h);
  }
  return canvas;
}

/** A table tent card (A6 ratio): the restaurant's name, the QR, a call to scan. */
function drawCard(code, { name, caption, color }) {
  const W = 1240;
  const H = 1748;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffcf6";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 26);
  ctx.fillRect(0, H - 26, W, 26);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1c1a16";
  ctx.font = "600 92px Fraunces, Georgia, serif";
  ctx.fillText(name || "Quán của bạn", W / 2, 230, W - 160);
  const qr = 860;
  const y = 330;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect((W - qr) / 2 - 30, y - 30, qr + 60, qr + 60, 40);
  ctx.fill();
  ctx.strokeStyle = "#e2dacb";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.drawImage(code, (W - qr) / 2, y, qr, qr);
  ctx.fillStyle = color;
  ctx.font = "700 72px 'Be Vietnam Pro', system-ui, sans-serif";
  ctx.fillText(caption || "Quét để xem menu", W / 2, y + qr + 170, W - 160);
  ctx.fillStyle = "#6e685d";
  ctx.font = "500 44px 'Be Vietnam Pro', system-ui, sans-serif";
  ctx.fillText("Mở camera điện thoại và hướng vào mã", W / 2, y + qr + 250, W - 160);
  return canvas;
}

/** "Mã QR": made in the browser (no server, no credit), never expires since the content is in the code. */
export default function QrPage() {
  const [kind, setKind] = useState("link");
  const [v, setV] = useState({ url: "", ssid: "", password: "", security: "WPA", text: "" });
  const [color, setColor] = useState(COLORS[0]);
  const [logoFile, setLogoFile] = useState(null);
  const [logo, setLogo] = useState(null);
  const [style, setStyle] = useState("code");
  const [card, setCard] = useState({ name: "", caption: "Quét để xem menu" });
  const [error, setError] = useState("");
  const preview = useRef(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const text = payload(kind, v);

  useEffect(() => {
    if (!logoFile) return setLogo(null);
    loadImage(logoFile).then(setLogo, (e) => setError(e.message));
  }, [logoFile]);

  // Redraw the preview as the form changes.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const box = preview.current;
      if (!box) return;
      box.replaceChildren();
      if (!text) return;
      try {
        const code = await drawCode(text, color, logo, 1024);
        const out = style === "card" ? drawCard(code, { ...card, color }) : code;
        if (live) {
          setError("");
          box.append(out);
        }
      } catch (e) {
        if (live) setError(/too big|amount of data/i.test(e.message) ? "Nội dung quá dài cho một mã QR, hãy rút gọn." : e.message);
      }
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, color, logo, style, card]);

  function download() {
    const canvas = preview.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${style === "card" ? "the-ban" : "ma-qr"}-${kind}.png`;
    a.click();
  }

  return (
    <SkillShell id="qr" wide>
      <div className="qr-layout">
        <div className="form-card">
          <Field label="Mã QR dẫn tới">
            <div className="pf-options is-qr-kind" role="radiogroup">
              {KINDS.map(([id, name, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={kind === id} className={kind === id ? "pf-option on" : "pf-option"} onClick={() => setKind(id)}>
                  <b>{name}</b>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
          </Field>
          {kind === "link" && (
            <Field label="Link" hint="Ví dụ link menu, link Google Maps của quán, fanpage, trang đặt bàn.">
              <input className="input-lg" value={v.url} onChange={set("url")} placeholder="phocali.com/menu" autoComplete="off" autoFocus />
            </Field>
          )}
          {kind === "wifi" && (
            <div className="row">
              <Field label="Tên Wi-Fi"><input value={v.ssid} onChange={set("ssid")} placeholder="PhoCali_Guest" autoComplete="off" /></Field>
              <Field label="Mật khẩu (bỏ trống nếu không có)"><input value={v.password} onChange={set("password")} autoComplete="off" /></Field>
              <Field label="Bảo mật">
                <select value={v.security} onChange={set("security")}><option value="WPA">WPA / WPA2</option><option value="WEP">WEP</option></select>
              </Field>
            </div>
          )}
          {kind === "text" && (
            <Field label="Nội dung">
              <textarea rows={3} value={v.text} onChange={set("text")} placeholder="Giảm 10% cho hoá đơn hôm nay với mã PHO10" />
            </Field>
          )}
          <Field label="Màu mã">
            <div className="qr-colors">
              {COLORS.map((c) => (
                <button key={c} type="button" className={c === color ? "on" : undefined} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Màu ${c}`} />
              ))}
              <label className="qr-color-pick" title="Màu khác"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} />+</label>
            </div>
          </Field>
          <div className="field">
            <span className="field-label">Logo ở giữa (tuỳ chọn)</span>
            <FilePick accept="image/png,image/jpeg,image/webp" file={logoFile} onChange={setLogoFile} placeholder="Chọn logo quán" kind="image" />
          </div>
          <Field label="Kiểu tải về">
            <div className="pf-options is-qr-kind" role="radiogroup">
              {STYLES.map(([id, name, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={style === id} className={style === id ? "pf-option on" : "pf-option"} onClick={() => setStyle(id)}>
                  <b>{name}</b>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
          </Field>
          {style === "card" && (
            <div className="row">
              <Field label="Tên quán"><input value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} placeholder="Phở Cali" autoComplete="off" /></Field>
              <Field label="Lời nhắc"><input value={card.caption} onChange={(e) => setCard((c) => ({ ...c, caption: e.target.value }))} autoComplete="off" /></Field>
            </div>
          )}
          <Notes items={["Miễn phí, không trừ credit. Mã tạo ngay trên trình duyệt của bạn.", "Mã QR không bao giờ hết hạn vì nội dung nằm sẵn trong mã. Đổi link thì tạo mã mới.", "In ra nên thử quét bằng điện thoại trước. Logo quá to hoặc màu quá nhạt có thể làm khó quét."]} />
        </div>
        <aside className="qr-preview">
          <div className={style === "card" ? "qr-canvas is-card" : "qr-canvas"} ref={preview} aria-label="Xem trước mã QR" />
          {!text && <p className="qr-empty">Nhập nội dung để xem trước mã QR.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="btn primary" disabled={!text || !!error} onClick={download}>Tải PNG</button>
          {text && <small className="qr-payload" title={text}>{kind === "wifi" ? `Wi-Fi: ${v.ssid}` : text}</small>}
        </aside>
      </div>
    </SkillShell>
  );
}
