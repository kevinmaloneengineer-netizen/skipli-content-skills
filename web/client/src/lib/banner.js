// Holiday / event banners drawn on a canvas in the browser: the shop's dish photo, the occasion's colours
// and ornaments (lanterns, hearts, snow…), the shop's own words. No server, no credit.

export const OCCASIONS = [
  { id: "tet", name: "Tết Nguyên đán", bg: ["#b3121c", "#6e0a10"], accent: "#f6c453", ink: "#fff6e0", deco: ["lantern", "blossom"], vi: ["Chúc Mừng Năm Mới", "An khang thịnh vượng"], en: ["Happy Lunar New Year", "Wishing you luck and plenty"] },
  { id: "valentine", name: "Valentine 14/2", bg: ["#e23f6b", "#9c1043"], accent: "#ffd1dc", ink: "#fff5f8", deco: ["heart"], vi: ["Valentine Ngọt Ngào", "Hẹn hò ấm áp bên món ngon"], en: ["Happy Valentine's Day", "A table for two is waiting"] },
  { id: "women83", name: "Quốc tế Phụ nữ 8/3", bg: ["#9b3fb5", "#5d1d73"], accent: "#ffd166", ink: "#fff7fd", deco: ["flower", "heart"], vi: ["Mừng Ngày 8/3", "Gửi yêu thương đến những người phụ nữ"], en: ["Happy Women's Day", "Celebrating the women we love"] },
  { id: "women2010", name: "Phụ nữ Việt Nam 20/10", bg: ["#d6436f", "#8a1d45"], accent: "#ffe1a8", ink: "#fff6f9", deco: ["flower"], vi: ["Mừng Ngày 20/10", "Chúc một nửa thế giới luôn rạng rỡ"], en: ["Happy Vietnamese Women's Day", "For every woman who makes us smile"] },
  { id: "midautumn", name: "Trung thu", bg: ["#13245a", "#081233"], accent: "#ffcf5c", ink: "#fff8e6", deco: ["moon", "lantern", "star"], vi: ["Trung Thu Đoàn Viên", "Quây quần bên mâm cỗ"], en: ["Happy Mid-Autumn Festival", "Gather round, share the moon"] },
  { id: "christmas", name: "Giáng sinh", bg: ["#0f5a3a", "#06331f"], accent: "#e8413a", ink: "#fffaf0", deco: ["snow", "star"], vi: ["Giáng Sinh An Lành", "Ấm áp cùng món ngon mùa lễ"], en: ["Merry Christmas", "Warm plates for the holidays"] },
  { id: "newyear", name: "Năm mới", bg: ["#141b33", "#05070f"], accent: "#f2c94c", ink: "#fffaf0", deco: ["star", "confetti"], vi: ["Chào Năm Mới", "Cảm ơn bạn đã đồng hành cùng quán"], en: ["Happy New Year", "Thank you for a delicious year"] },
  { id: "opening", name: "Khai trương", bg: ["#c8102e", "#7c0718"], accent: "#ffd34d", ink: "#fffaf0", deco: ["confetti", "star"], vi: ["Khai Trương", "Hân hạnh đón tiếp quý khách"], en: ["Grand Opening", "Come celebrate with us"] },
  { id: "birthday", name: "Sinh nhật quán", bg: ["#f4a340", "#c8641a"], accent: "#ffffff", ink: "#2a1606", deco: ["confetti"], vi: ["Sinh Nhật Quán", "Cảm ơn bạn đã ghé quán suốt thời gian qua"], en: ["Our Birthday", "Thank you for every visit"] },
  { id: "mother", name: "Ngày của Mẹ", bg: ["#f2a7b8", "#c96b86"], accent: "#ffffff", ink: "#3b1020", deco: ["flower", "heart"], vi: ["Ngày Của Mẹ", "Đưa mẹ đi ăn món mẹ thích"], en: ["Happy Mother's Day", "Treat mom to her favorite"] },
  { id: "july4", name: "Quốc khánh Mỹ 4/7", bg: ["#1d2f6f", "#0b1640"], accent: "#e63946", ink: "#ffffff", deco: ["star", "confetti"], vi: ["Happy 4th of July", "Mừng Quốc khánh Mỹ"], en: ["Happy 4th of July", "Celebrate with good food"] },
  { id: "halloween", name: "Halloween", bg: ["#1b1424", "#0a0710"], accent: "#ff7a1a", ink: "#fff3e6", deco: ["pumpkin", "star"], vi: ["Happy Halloween", "Ghé quán nếu bạn dám"], en: ["Happy Halloween", "Trick or treat yourself"] },
  { id: "thanksgiving", name: "Lễ Tạ ơn", bg: ["#9a4a1c", "#5a250b"], accent: "#f6b042", ink: "#fff6ea", deco: ["leaf"], vi: ["Happy Thanksgiving", "Cảm ơn bạn đã luôn ủng hộ quán"], en: ["Happy Thanksgiving", "Grateful for every guest"] },
  { id: "blackfriday", name: "Black Friday", bg: ["#111111", "#000000"], accent: "#ffd60a", ink: "#ffffff", deco: ["confetti"], vi: ["BLACK FRIDAY", "Chỉ trong hôm nay"], en: ["BLACK FRIDAY", "Today only"] },
];

export const SIZES = [
  ["post", "Bài đăng vuông", 1080, 1080],
  ["portrait", "Bài đăng dọc 4:5", 1080, 1350],
  ["story", "Story / Reels 9:16", 1080, 1920],
  ["cover", "Ảnh bìa Facebook", 1640, 624],
  ["gbp", "Google Business 4:3", 1200, 900],
];

export const LAYOUTS = [
  ["photo", "Ảnh nền", "Ảnh món phủ kín, chữ trên lớp màu"],
  ["frame", "Khung ảnh", "Nền màu lễ, ảnh món trong khung bo tròn"],
  ["text", "Chỉ chữ", "Không cần ảnh, chữ lớn và hoạ tiết"],
];

/** Deterministic random numbers, so the ornaments stay put while the text is edited. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function cover(ctx, img, x, y, w, h) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxW || !cur) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

/** The largest font size (down to min) at which the text fits in maxLines lines of maxW. */
function fit(ctx, text, font, size, min, maxW, maxLines) {
  for (let s = size; s >= min; s -= 2) {
    ctx.font = font(s);
    const lines = wrap(ctx, text, maxW, 99);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size: s, lines };
  }
  ctx.font = font(min);
  return { size: min, lines: wrap(ctx, text, maxW, maxLines) };
}

// ---- ornaments ----
const ORN = {
  lantern(ctx, x, y, s, o) {
    ctx.strokeStyle = o.accent;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.2);
    ctx.lineTo(x, y - s * 0.55);
    ctx.stroke();
    ctx.fillStyle = "#e3262f";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.5, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = s * 0.03;
    for (const k of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.5 * Math.abs(k) * 2 || 1, s * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = o.accent;
    ctx.fillRect(x - s * 0.28, y - s * 0.66, s * 0.56, s * 0.14);
    ctx.fillRect(x - s * 0.28, y + s * 0.52, s * 0.56, s * 0.14);
    ctx.strokeStyle = o.accent;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.66);
    ctx.lineTo(x, y + s * 1.05);
    ctx.stroke();
  },
  blossom(ctx, x, y, s, o) {
    ctx.fillStyle = "#ffd23f";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + o.r * 6;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s * 0.32, y + Math.sin(a) * s * 0.32, s * 0.28, s * 0.22, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#d9480f";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  },
  flower(ctx, x, y, s, o) {
    ctx.fillStyle = o.r > 0.5 ? "#ffffff" : o.accent;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + o.r * 4;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3, s * 0.3, s * 0.18, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffb703";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  },
  heart(ctx, x, y, s, o) {
    ctx.fillStyle = o.r > 0.5 ? "#ffffff" : o.accent;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.45);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.15, x - s * 0.4, y - s * 0.75, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.4, y - s * 0.75, x + s * 0.9, y - s * 0.15, x, y + s * 0.45);
    ctx.fill();
  },
  star(ctx, x, y, s, o) {
    ctx.fillStyle = o.accent;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? s * 0.22 : s * 0.5;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  },
  snow(ctx, x, y, s) {
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * s * 0.5, y - Math.sin(a) * s * 0.5);
      ctx.lineTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5);
      ctx.stroke();
    }
  },
  moon(ctx, x, y, s, o) {
    const g = ctx.createRadialGradient(x, y, s * 0.3, x, y, s * 1.4);
    g.addColorStop(0, "rgba(255,220,120,.45)");
    g.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.accent;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
    ctx.fill();
  },
  leaf(ctx, x, y, s, o) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.r * Math.PI * 2);
    ctx.fillStyle = ["#f6b042", "#e2682c", "#c0392b"][Math.floor(o.r * 3) % 3];
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, 0);
    ctx.lineTo(s * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  },
  pumpkin(ctx, x, y, s) {
    ctx.fillStyle = "#ff7a1a";
    for (const dx of [-0.28, 0.28, 0]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y, s * 0.36, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3a5a1f";
    ctx.fillRect(x - s * 0.05, y - s * 0.6, s * 0.1, s * 0.2);
  },
  confetti(ctx, x, y, s, o) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.r * Math.PI);
    ctx.fillStyle = ["#ffd34d", "#ffffff", o.accent, "#4cc9f0", "#f72585"][Math.floor(o.r * 5) % 5];
    ctx.fillRect(-s * 0.3, -s * 0.12, s * 0.6, s * 0.24);
    ctx.restore();
  },
};

/** Scatter ornaments along the edges of the frame (the middle stays clear for the words). */
function ornaments(ctx, w, h, occ, { density = 1, seed = 7, small = false } = {}) {
  const r = rng(seed);
  const unit = Math.min(w, h);
  const n = Math.round((small ? 10 : 18) * density);
  for (let i = 0; i < n; i++) {
    const kind = occ.deco[i % occ.deco.length];
    const s = unit * (kind === "moon" ? 0.12 : kind === "lantern" ? 0.07 : 0.035 + r() * 0.03) * (small ? 0.8 : 1);
    // A spot in the outer band: left/right strips, or top/bottom strips.
    const edge = r();
    const band = 0.13;
    let x;
    let y;
    if (edge < 0.5) {
      x = (r() < 0.5 ? r() * band : 1 - r() * band) * w;
      y = r() * h;
    } else {
      x = r() * w;
      y = (r() < 0.5 ? r() * band : 1 - r() * band) * h;
    }
    if (kind === "moon") {
      if (i > 0) continue;
      x = w * 0.82;
      y = h * 0.16;
    }
    if (kind === "lantern") y = Math.max(y, s * 1.3);
    ctx.globalAlpha = small ? 0.9 : 1;
    ORN[kind](ctx, x, y, s, { accent: occ.accent, r: r() });
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Draw a banner. o = { occasion, size: [w, h], layout, photo (Image|null), logo (Image|null), headline, sub, offer, footer }.
 */
export function drawBanner(canvas, o) {
  const occ = OCCASIONS.find((x) => x.id === o.occasion) ?? OCCASIONS[0];
  const [w, h] = o.size;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const wide = w / h > 1.6;
  const unit = Math.min(w, h);
  const layout = o.photo ? o.layout : "text";
  const grad = ctx.createLinearGradient(0, 0, w * 0.4, h);
  grad.addColorStop(0, occ.bg[0]);
  grad.addColorStop(1, occ.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Where the words go (x, y top, width, align).
  let box;
  if (layout === "photo") {
    cover(ctx, o.photo, 0, 0, w, h);
    const shade = wide ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, wide ? `${occ.bg[1]}f0` : `${occ.bg[1]}00`);
    shade.addColorStop(wide ? 0.55 : 0.42, wide ? `${occ.bg[1]}b0` : `${occ.bg[1]}30`);
    shade.addColorStop(1, wide ? `${occ.bg[1]}00` : `${occ.bg[1]}f2`);
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    ornaments(ctx, w, h, occ, { small: true, density: 0.6, seed: o.seed });
    box = wide ? { x: w * 0.06, top: h * 0.16, width: w * 0.48, align: "left", bottom: h * 0.86 } : { x: w / 2, top: h * 0.56, width: w * 0.84, align: "center", bottom: h * 0.95 };
  } else if (layout === "frame") {
    ornaments(ctx, w, h, occ, { seed: o.seed });
    if (wide) {
      const ph = h * 0.78;
      const pw = Math.min(w * 0.42, ph * 1.25);
      const px = w - pw - w * 0.06;
      const py = (h - ph) / 2;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = unit * 0.05;
      ctx.fillStyle = occ.accent;
      roundRect(ctx, px - unit * 0.015, py - unit * 0.015, pw + unit * 0.03, ph + unit * 0.03, unit * 0.06);
      ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, px, py, pw, ph, unit * 0.05);
      ctx.clip();
      cover(ctx, o.photo, px, py, pw, ph);
      ctx.restore();
      box = { x: w * 0.07, top: h * 0.16, width: px - w * 0.12, align: "left", bottom: h * 0.86 };
    } else {
      const pw = w * 0.74;
      const ph = Math.min(h * (h > w * 1.2 ? 0.5 : 0.44), pw * (h > w * 1.4 ? 1.15 : 0.8));
      const px = (w - pw) / 2;
      const py = h * 0.08;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = unit * 0.05;
      ctx.fillStyle = occ.accent;
      // An arch: rounded top, square-ish bottom.
      ctx.beginPath();
      ctx.roundRect(px - unit * 0.016, py - unit * 0.016, pw + unit * 0.032, ph + unit * 0.032, [pw / 2, pw / 2, unit * 0.04, unit * 0.04]);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, [pw / 2, pw / 2, unit * 0.03, unit * 0.03]);
      ctx.clip();
      cover(ctx, o.photo, px, py, pw, ph);
      ctx.restore();
      box = { x: w / 2, top: py + ph + h * 0.045, width: w * 0.84, align: "center", bottom: h * 0.95 };
    }
  } else {
    ornaments(ctx, w, h, occ, { density: 1.4, seed: o.seed });
    box = wide ? { x: w / 2, top: h * 0.2, width: w * 0.7, align: "center", bottom: h * 0.88 } : { x: w / 2, top: h * 0.3, width: w * 0.8, align: "center", bottom: h * 0.9 };
  }

  // Logo chip at the top corner.
  if (o.logo) {
    const lh = unit * 0.11;
    const lw = Math.min(lh * (o.logo.naturalWidth / o.logo.naturalHeight), unit * 0.3);
    const pad = unit * 0.02;
    const lx = layout === "frame" && !wide ? unit * 0.04 : box.align === "left" ? box.x : w / 2 - (lw + 2 * pad) / 2;
    const ly = layout === "frame" && !wide ? unit * 0.04 : layout === "photo" && !wide ? h * 0.04 : box.top - lh - pad * 2 - unit * 0.03;
    ctx.fillStyle = "rgba(255,255,255,.95)";
    roundRect(ctx, lx, ly, lw + 2 * pad, lh + 2 * pad, unit * 0.025);
    ctx.fill();
    ctx.drawImage(o.logo, lx + pad, ly + pad, lw, lh);
  }

  // Words: the headline big, the line under it, the offer in a pill, the footer at the bottom. Measured first
  // and shrunk together until everything fits between the top of the text box and its bottom.
  ctx.textAlign = box.align;
  ctx.textBaseline = "top";
  const display = (s) => `600 ${s}px Fraunces, Georgia, serif`;
  const text = (wgt) => (s) => `${wgt} ${s}px "Be Vietnam Pro", system-ui, sans-serif`;
  const shadow = layout === "photo";
  const words = (k, draw) => {
    let y = box.top;
    const put = (line, size) => {
      if (!draw) return;
      if (shadow) {
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = size * 0.25;
      }
      ctx.fillText(line, box.x, y);
      ctx.shadowBlur = 0;
    };
    if (o.headline) {
      const head = fit(ctx, o.headline, display, Math.round(unit * (wide ? 0.17 : 0.13) * k), Math.round(unit * 0.05 * k), box.width, 3);
      ctx.font = display(head.size);
      ctx.fillStyle = layout === "photo" ? "#ffffff" : occ.ink;
      for (const line of head.lines) {
        put(line, head.size);
        y += head.size * 1.08;
      }
      y += unit * 0.02 * k;
    }
    if (o.sub) {
      const sub = fit(ctx, o.sub, text(500), Math.round(unit * 0.045 * k), Math.round(unit * 0.026 * k), box.width, 3);
      ctx.font = text(500)(sub.size);
      ctx.fillStyle = layout === "photo" ? "rgba(255,255,255,.94)" : occ.ink;
      for (const line of sub.lines) {
        put(line, sub.size);
        y += sub.size * 1.35;
      }
      y += unit * 0.025 * k;
    }
    if (o.offer) {
      const size = Math.round(unit * 0.042 * k);
      ctx.font = text(700)(size);
      const lines = wrap(ctx, o.offer, box.width - size * 1.6, 2);
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const pw = tw + size * 1.6;
      const ph = lines.length * size * 1.3 + size * 0.8;
      const px = box.align === "left" ? box.x : box.x - pw / 2;
      if (draw) {
        ctx.fillStyle = occ.accent;
        roundRect(ctx, px, y, pw, ph, Math.min(ph / 2, size * 0.9));
        ctx.fill();
        ctx.fillStyle = luminance(occ.accent) > 0.6 ? "#1c1a16" : "#ffffff";
        lines.forEach((l, i) => ctx.fillText(l, box.align === "left" ? px + size * 0.8 : box.x, y + size * 0.4 + i * size * 1.3));
      }
      y += ph + unit * 0.02 * k;
    }
    if (o.footer) {
      const size = Math.round(unit * 0.03 * Math.max(k, 0.8));
      ctx.font = text(600)(size);
      ctx.fillStyle = layout === "photo" ? "rgba(255,255,255,.9)" : occ.ink;
      const lines = wrap(ctx, o.footer, box.width, 2);
      const fh = lines.length * size * 1.35;
      let fy = Math.max(y + unit * 0.01, box.bottom - fh);
      if (draw) {
        for (const l of lines) {
          if (shadow) {
            ctx.shadowColor = "rgba(0,0,0,.5)";
            ctx.shadowBlur = size * 0.3;
          }
          ctx.fillText(l, box.x, fy);
          ctx.shadowBlur = 0;
          fy += size * 1.35;
        }
      }
      y += unit * 0.01 + fh;
    }
    return y;
  };
  let k = 1;
  while (k > 0.5 && words(k, false) > box.bottom) k -= 0.05;
  words(k, true);
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
