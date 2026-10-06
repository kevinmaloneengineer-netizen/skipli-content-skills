import { useEffect, useState } from "react";
import { useCopy, useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { CopyIcon, SaveIcon } from "./Icons.jsx";

const LAYOUTS = { top: "Trên", center: "Giữa", bottom: "Dưới" };
const THEMES = { light: "Chữ trắng", dark: "Chữ đen", brand: "Nền màu" };
const ACCENT = "#e25d33";

// Text edits live in this browser only (per job); "Tải ảnh" bakes them into the PNG.
function useEdits(jobId, items) {
  const key = `image-edits:${jobId}`;
  const [edits, setEdits] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") ?? items.map((x) => ({ headline: x.headline, sub: x.sub, cta: x.cta, layout: x.layout, theme: "light" }));
    } catch {
      return items.map((x) => ({ headline: x.headline, sub: x.sub, cta: x.cta, layout: x.layout, theme: "light" }));
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(edits));
    } catch {
      /* storage blocked */
    }
  }, [key, edits]);
  return [edits, (i, patch) => setEdits((all) => all.map((e, k) => (k === i ? { ...e, ...patch } : e)))];
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw the picture + overlay text at full resolution and download it as PNG. */
async function download(src, e, w, h, name) {
  await document.fonts?.ready;
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const pad = Math.round(w * 0.07);
  const hSize = Math.round(w * (h > w ? 0.085 : 0.07));
  const sSize = Math.round(hSize * 0.46);
  const ink = e.theme === "dark" ? "#1c1a16" : "#fffaf3";

  ctx.font = `700 ${hSize}px "Be Vietnam Pro", sans-serif`;
  const hLines = e.headline ? wrap(ctx, e.headline, w - pad * 2) : [];
  ctx.font = `500 ${sSize}px "Be Vietnam Pro", sans-serif`;
  const sLines = e.sub ? wrap(ctx, e.sub, w - pad * 2) : [];
  const ctaH = e.cta ? Math.round(sSize * 2.2) : 0;
  const blockH = hLines.length * hSize * 1.15 + (sLines.length ? sSize * 0.6 + sLines.length * sSize * 1.35 : 0) + (ctaH ? sSize * 0.9 + ctaH : 0);
  let y = e.layout === "top" ? pad : e.layout === "center" ? (h - blockH) / 2 : h - pad - blockH;

  if (e.theme === "brand") {
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, y - pad * 0.6, w, blockH + pad * 1.2);
  } else {
    const g = e.layout === "top" ? ctx.createLinearGradient(0, 0, 0, y + blockH + pad) : ctx.createLinearGradient(0, h, 0, y - pad);
    const shade = e.theme === "dark" ? "255,250,243" : "0,0,0";
    g.addColorStop(0, `rgba(${shade},.62)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = g;
    if (e.layout === "top") ctx.fillRect(0, 0, w, y + blockH + pad);
    else if (e.layout === "bottom") ctx.fillRect(0, y - pad, w, h - y + pad);
    else {
      ctx.fillStyle = `rgba(${shade},.4)`;
      ctx.fillRect(0, y - pad * 0.6, w, blockH + pad * 1.2);
    }
  }

  ctx.fillStyle = e.theme === "brand" ? "#fffaf3" : ink;
  ctx.textBaseline = "top";
  ctx.font = `700 ${hSize}px "Be Vietnam Pro", sans-serif`;
  for (const l of hLines) {
    ctx.fillText(l, pad, y);
    y += hSize * 1.15;
  }
  if (sLines.length) {
    y += sSize * 0.6;
    ctx.font = `500 ${sSize}px "Be Vietnam Pro", sans-serif`;
    for (const l of sLines) {
      ctx.fillText(l, pad, y);
      y += sSize * 1.35;
    }
  }
  if (ctaH) {
    y += sSize * 0.9;
    ctx.font = `700 ${sSize}px "Be Vietnam Pro", sans-serif`;
    const tw = ctx.measureText(e.cta).width + sSize * 2;
    ctx.fillStyle = e.theme === "brand" ? "#1c1a16" : ACCENT;
    ctx.beginPath();
    ctx.roundRect(pad, y, tw, ctaH, ctaH / 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    ctx.textBaseline = "middle";
    ctx.fillText(e.cta, pad + sSize, y + ctaH / 2);
  }

  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = name;
  a.click();
}

export default function ImageBoard({ job }) {
  const copy = useCopy();
  const toast = useToast();
  const { items, width, height, size } = job.images;
  const [edits, setEdit] = useEdits(job.id, items);
  const [busy, setBusy] = useState(-1);

  async function save(i) {
    try {
      const e = edits[i];
      await api("/library", {
        method: "POST",
        body: { kind: "saved", title: (e.headline || `Ảnh ${i + 1}`).slice(0, 200), body: [e.headline, e.sub, e.cta && `[${e.cta}]`, "", items[i].caption].filter((x) => x !== undefined && x !== null).join("\n").trim(), platform: "facebook", tags: ["Ảnh AI"], sourceJobId: job.id },
      });
      toast("Đã lưu caption vào thư viện", { to: "/library?kind=saved" });
    } catch (err) {
      toast(err.message, { kind: "error" });
    }
  }

  async function dl(i) {
    setBusy(i);
    try {
      await download(`/media/images/${items[i].file}`, edits[i], width, height, `${(edits[i].headline || job.title).slice(0, 40)}.png`);
    } catch (err) {
      toast(`Không tải được ảnh: ${err.message}`, { kind: "error" });
    } finally {
      setBusy(-1);
    }
  }

  return (
    <div className="ib-grid" data-size={size}>
      {items.map((x, i) => {
        const e = edits[i];
        return (
          <section key={x.file} className="card ib-card">
            <div className="ib-frame" style={{ aspectRatio: `${width} / ${height}` }} data-layout={e.layout} data-theme={e.theme}>
              <img src={`/media/images/${x.file}`} alt={x.prompt} loading="lazy" />
              {(e.headline || e.sub || e.cta) && (
                <div className="ib-text">
                  {e.headline && <b>{e.headline}</b>}
                  {e.sub && <span>{e.sub}</span>}
                  {e.cta && <em>{e.cta}</em>}
                </div>
              )}
            </div>
            <div className="ib-edit">
              <input value={e.headline} onChange={(ev) => setEdit(i, { headline: ev.target.value })} placeholder="Tiêu đề" aria-label="Tiêu đề" maxLength={80} />
              <input value={e.sub} onChange={(ev) => setEdit(i, { sub: ev.target.value })} placeholder="Dòng phụ" aria-label="Dòng phụ" maxLength={140} />
              <input value={e.cta} onChange={(ev) => setEdit(i, { cta: ev.target.value })} placeholder="Nút kêu gọi" aria-label="Nút kêu gọi" maxLength={40} />
              <div className="ib-opts">
                <div className="ib-seg" role="group" aria-label="Vị trí chữ">
                  {Object.entries(LAYOUTS).map(([v, t]) => (
                    <button key={v} type="button" className={e.layout === v ? "on" : undefined} onClick={() => setEdit(i, { layout: v })}>{t}</button>
                  ))}
                </div>
                <div className="ib-seg" role="group" aria-label="Kiểu chữ">
                  {Object.entries(THEMES).map(([v, t]) => (
                    <button key={v} type="button" className={e.theme === v ? "on" : undefined} onClick={() => setEdit(i, { theme: v })}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            {x.caption && (
              <details className="ib-caption">
                <summary>Caption đăng kèm</summary>
                <p>{x.caption}</p>
              </details>
            )}
            <div className="actions ib-actions">
              <button className="btn primary small" onClick={() => dl(i)} disabled={busy === i}>{busy === i ? "Đang xuất…" : "Tải ảnh PNG"}</button>
              {x.caption && <button className="btn small" onClick={() => copy(x.caption)}><CopyIcon />Caption</button>}
              <button className="btn small" onClick={() => save(i)}><SaveIcon />Lưu</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
