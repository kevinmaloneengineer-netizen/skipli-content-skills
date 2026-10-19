"""Make a phone photo of a dish look shot in a studio, without changing the food itself.

    python3 photo_fix.py <photo> <out dir> <job id> <look> <ratio,ratio,...> [<cutout.png> <background.png> | ai:<file>]

With ai:<file> (the photo touched up by the GPU worker's /enhance), that picture replaces the photo and
only a light version of the look is applied on top (it is already balanced).

With a cutout (the dish on a transparent layer, from the GPU worker's /cutout) and a new background, the
dish is first placed back on that background with a soft contact shadow; the dish's own pixels are kept.

Steps: white balance (gray world, partly), auto levels, exposure for dark photos, vibrance, the look's
warmth / contrast, clarity and sharpening, a soft vignette. Then one file per ratio: when the photo is
close to the ratio it is cropped around the center, otherwise at most 30% of the long side is trimmed
and the rest sits on a blurred, darker copy of itself (the dish is never cut off).

Prints JSON: {"original": file, "fixed": file (same frame as the original), "width", "height",
"items": [{"ratio", "file", "width", "height"}], "stats": {...}}.
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

LOOKS = {
    # warmth: red up / blue down; contrast: S-curve strength; vibrance; lift: shadows up
    "natural": {"warmth": 0.02, "contrast": 0.08, "vibrance": 0.14, "lift": 0.03},
    "warm": {"warmth": 0.06, "contrast": 0.10, "vibrance": 0.16, "lift": 0.04},
    "bright": {"warmth": 0.02, "contrast": 0.05, "vibrance": 0.18, "lift": 0.08},
    "moody": {"warmth": 0.04, "contrast": 0.20, "vibrance": 0.10, "lift": -0.02},
}
SIZES = {"1:1": (1080, 1080), "4:5": (1080, 1350), "9:16": (1080, 1920), "16:9": (1920, 1080)}


def enhance(img, look, soft=1.0):
    """soft < 1: a lighter touch (an AI-retouched picture): no auto levels or exposure, the look at that strength."""
    look = {k: v * soft for k, v in look.items()}
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    if soft >= 1:
        # White balance: move each channel part of the way to the gray-world average (keeps warm food warm).
        means = a.reshape(-1, 3).mean(axis=0)
        gray = means.mean()
        a = a * (1 + 0.6 * (gray / np.maximum(means, 1e-3) - 1))
        # Levels: stretch the 0.5 / 99.5 percentiles of brightness to the full range.
        lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        lo, hi = np.percentile(lum, [0.5, 99.5])
        if hi - lo > 0.05:
            a = (a - lo) / (hi - lo)
        a = np.clip(a, 0, 1)
    # Exposure: a dark photo gets a gamma lift toward a middle brightness.
    mean = float((a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)).mean())
    gamma = 1.0
    if mean < 0.42 and soft >= 1:
        gamma = max(0.55, np.log(0.47) / np.log(max(mean, 0.05)))
        a = np.power(a, gamma)
    # Shadows lift (or crush, for moody).
    a = a + look["lift"] * (1 - a) ** 2
    # S-curve contrast around the middle.
    c = look["contrast"]
    a = a + c * (a - 0.5) * (1 - np.abs(2 * a - 1))
    # Warmth.
    a[..., 0] *= 1 + look["warmth"]
    a[..., 2] *= 1 - look["warmth"] * 0.8
    a = np.clip(a, 0, 1)
    # Vibrance: dull colors gain more saturation than already strong ones (skin and reds stay natural).
    mx, mn = a.max(axis=2, keepdims=True), a.min(axis=2, keepdims=True)
    sat = mx - mn
    l = a.mean(axis=2, keepdims=True)
    a = l + (a - l) * (1 + look["vibrance"] * (1 - sat))
    a = np.clip(a, 0, 1)
    out = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    # Clarity (wide, light unsharp mask) then fine sharpening.
    # Kept gentle: strong sharpening makes meat and wood grain look crunchy.
    out = out.filter(ImageFilter.UnsharpMask(radius=24, percent=int(10 * soft), threshold=2))
    out = out.filter(ImageFilter.UnsharpMask(radius=1.4, percent=int(40 * soft), threshold=3))
    # Soft vignette pulls the eye to the plate.
    w, h = out.size
    y, x = np.ogrid[:h, :w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    mask = np.clip(1 - 0.16 * np.clip(d - 0.55, 0, None) ** 1.6, 0, 1)[..., None]
    b = np.asarray(out, dtype=np.float32) * mask
    out = Image.fromarray(np.clip(b, 0, 255).astype(np.uint8))
    return out, {"brightness_before": round(mean, 3), "gamma": round(float(gamma), 3)}


def composite(cutout_path, background_path, size):
    """The dish (RGBA, same frame as the photo) on the new surface, with a soft shadow under it."""
    cut = Image.open(cutout_path).convert("RGBA").resize(size, Image.LANCZOS)
    back = ImageOps.fit(Image.open(background_path).convert("RGB"), size, Image.LANCZOS)
    # Pull the edge in a pixel or two and soften it: the mask's outer edge still carries the old
    # background's color, which would show as a dark or gray rim on the new surface.
    alpha = cut.getchannel("A").filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(alpha, dtype=np.float32) / 255.0
    # Match the surface to the dish: same overall brightness, a touch of its warmth.
    dish = np.asarray(cut.convert("RGB"), dtype=np.float32)
    bg = np.asarray(back, dtype=np.float32)
    if a.sum() > 50:
        dish_mean = (dish * a[..., None]).sum(axis=(0, 1)) / a.sum()
        bg_mean = bg.reshape(-1, 3).mean(axis=0)
        target = 0.75 * bg_mean + 0.25 * dish_mean
        bg = bg * (target / np.maximum(bg_mean, 1))
    # Contact shadow: the mask, blurred and pushed down a little, darkens the surface.
    w, h = size
    blur = max(6, int(min(w, h) * 0.025))
    shadow = ImageChops_offset(alpha, 0, int(blur * 1.6)).filter(ImageFilter.GaussianBlur(blur))
    s = np.asarray(shadow, dtype=np.float32)[..., None] / 255.0
    bg = bg * (1 - 0.32 * s)
    out = bg * (1 - a[..., None]) + dish * a[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def ImageChops_offset(img, dx, dy):
    """Shift an L image, filling the edge with black (no wrap-around)."""
    out = Image.new("L", img.size, 0)
    out.paste(img, (dx, dy))
    return out


def frame(img, size):
    tw, th = size
    w, h = img.size
    if abs((w / h) - (tw / th)) / (tw / th) < 0.18:  # close enough: crop around the center
        return ImageOps.fit(img, size, Image.LANCZOS, centering=(0.5, 0.5))
    # Otherwise trim at most 30% off the long side (the plate is usually in the middle), then place it
    # on a blurred, darker copy of itself so nothing important is cut off.
    back = ImageOps.fit(img, size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(40))
    back = Image.eval(back, lambda v: int(v * 0.62))
    target = tw / th
    if w / h > target:
        nw = int(max(h * target, w * 0.7))
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(max(w / target, h * 0.7))
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    w, h = img.size
    scale = min(tw / w, th / h) * 0.96
    fg = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    back.paste(fg, ((tw - fg.width) // 2, (th - fg.height) // 2))
    return back


def main():
    src, out_dir, job, look_name, ratios = sys.argv[1:6]
    cutout, background = (sys.argv[6], sys.argv[7]) if len(sys.argv) > 7 else (None, None)
    ai = sys.argv[6][3:] if len(sys.argv) == 7 and sys.argv[6].startswith("ai:") else None
    look = LOOKS.get(look_name, LOOKS["natural"])
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if max(img.size) > 2400:
        img.thumbnail((2400, 2400), Image.LANCZOS)
    os.makedirs(out_dir, exist_ok=True)
    original = f"{job}-o0.jpg"
    img.save(os.path.join(out_dir, original), "JPEG", quality=88)
    if cutout == "mock":  # no GPU (demo / tests): an oval "dish" on a plain warm surface
        from PIL import ImageDraw
        mask = Image.new("L", img.size, 0)
        w, h = img.size
        ImageDraw.Draw(mask).ellipse((w * 0.2, h * 0.15, w * 0.8, h * 0.85), fill=255)
        cut = img.copy()
        cut.putalpha(mask.filter(ImageFilter.GaussianBlur(3)))
        cutout, background = os.path.join(out_dir, f".{job}-cut.png"), os.path.join(out_dir, f".{job}-bg.png")
        cut.save(cutout)
        Image.new("RGB", img.size, (150, 108, 70)).save(background)
    if ai:
        base = Image.open(ai).convert("RGB").resize(img.size, Image.LANCZOS)
        fixed, stats = enhance(base, look, soft=0.4)
    else:
        base = composite(cutout, background, img.size) if cutout else img
        fixed, stats = enhance(base, look)
    full = f"{job}-p0.jpg"  # the fixed photo in its own frame, for the before / after slider
    fixed.save(os.path.join(out_dir, full), "JPEG", quality=92)
    items = []
    for i, ratio in enumerate([r for r in ratios.split(",") if r in SIZES][:4], start=1):
        name = f"{job}-p{i}.jpg"
        pic = frame(fixed, SIZES[ratio])
        pic.save(os.path.join(out_dir, name), "JPEG", quality=92)
        items.append({"ratio": ratio, "file": name, "width": pic.width, "height": pic.height})
    for f in (cutout, background):
        if f and os.path.basename(f).startswith(f".{job}-"):
            os.remove(f)
    print(json.dumps({"original": original, "fixed": full, "width": img.width, "height": img.height, "items": items, "stats": stats}))


if __name__ == "__main__":
    main()
