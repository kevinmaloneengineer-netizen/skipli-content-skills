import { api } from "./api.js";

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh này"));
    };
    img.src = url;
  });
}

/** Crop (sx, sy, sw, sh) of an image, scale so the long side ≤ max, as a JPEG (or PNG, keeps transparency) data URL. */
export function crop(img, sx, sy, sw, sh, max = 1280, type = "image/jpeg") {
  const k = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * k);
  canvas.height = Math.round(sh * k);
  canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, 0.9);
}

/** Cut a storyboard sheet into rows × cols panels, left to right, top to bottom. trim = share of each cell's bottom to drop (caption strip). */
export function cutGrid(img, rows, cols, trim = 0) {
  const w = img.naturalWidth / cols;
  const h = img.naturalHeight / rows;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(crop(img, c * w, r * h, w, h * (1 - trim), 832));
  return out;
}

export async function upload(dataUrl) {
  const { id } = await api("/uploads", { method: "POST", body: { dataUrl } });
  return id;
}
