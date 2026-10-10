#!/usr/bin/env python3
"""Restaurant title card for the first slide of a slideshow video: a transparent PNG laid over the photo.

Logo (top left), the name in big letters, the city underneath, and the address in a dark card at the
bottom. Text is drawn here, never by the image model (it misspells words).

  echo '{"width":720,"height":1280,"name":"Phở Cali","city":"Milwaukee, Wisconsin",
         "address":"4756 S 27th St\\nMilwaukee, WI 53221","logo":"logo.png"}' | python3 make_title.py out.png
  python3 make_title.py out.png spec.json
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = Path(__file__).parent / "fonts"


def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"Montserrat-{weight}.ttf"), int(size))


def text_w(draw, text, f):
    box = draw.textbbox((0, 0), text, font=f)
    return box[2] - box[0]


def fit_lines(draw, text, weight, size, min_size, max_w):
    """One line shrunk to fit; if it still does not fit at min_size, two lines at min_size."""
    while size > min_size and text_w(draw, text, font(weight, size)) > max_w:
        size -= 2
    f = font(weight, size)
    if text_w(draw, text, f) <= max_w or " " not in text:
        return [text], f
    words = text.split()
    best = min(range(1, len(words)), key=lambda k: abs(len(" ".join(words[:k])) - len(" ".join(words[k:]))))
    return [" ".join(words[:best]), " ".join(words[best:])], f


def shadowed(base, xy, text, f, fill, blur):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((xy[0], xy[1] + blur // 2), text, font=f, fill=(0, 0, 0, 170))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    ImageDraw.Draw(base).text(xy, text, font=f, fill=fill)


def main():
    spec = json.load(open(sys.argv[2], encoding="utf-8") if len(sys.argv) > 2 else sys.stdin)
    out = sys.argv[1]
    w, h = int(spec.get("width", 720)), int(spec.get("height", 1280))
    u = w / 100  # layout unit: 1% of the width
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Darken the top so white text reads on any photo.
    top = int(h * (0.42 if h > w else 0.6))
    grad = Image.new("L", (1, top))
    grad.putdata([int(165 * (1 - y / top) ** 1.6) for y in range(top)])
    img.alpha_composite(Image.merge("RGBA", [Image.new("L", (w, top), 0)] * 3 + [grad.resize((w, top))]), (0, 0))

    margin = int(4.5 * u)
    y = margin
    logo_path = spec.get("logo")
    if logo_path and Path(logo_path).exists():
        side = int(21 * u)
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((side - int(2 * u), side - int(2 * u)), Image.LANCZOS)
        tile = Image.new("RGBA", (side, side), (255, 255, 255, 0))
        mask = Image.new("L", (side, side), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, side - 1, side - 1), radius=int(3 * u), fill=255)
        tile.paste(Image.new("RGBA", (side, side), (250, 248, 244, 255)), (0, 0), mask)
        tile.alpha_composite(logo, ((side - logo.width) // 2, (side - logo.height) // 2))
        shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 120), (margin, margin + int(u)), mask)
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(int(1.5 * u))))
        img.alpha_composite(tile, (margin, margin))
        y += side + int(5 * u)
    else:
        y += int(8 * u)

    draw = ImageDraw.Draw(img)
    name = str(spec.get("name", "")).strip().upper()
    if name:
        lines, f = fit_lines(draw, name, "Bold", 12.5 * u, 8 * u, w - 2 * margin)
        for line in lines:
            shadowed(img, (margin, y), line, f, (255, 255, 255, 255), int(1.2 * u))
            y += int(f.size * 1.12)
        y += int(1.2 * u)
    city = str(spec.get("city", "")).strip().upper()
    if city:
        lines, f = fit_lines(draw, city, "Bold", 4.6 * u, 3.4 * u, w - 2 * margin)
        for line in lines:
            shadowed(img, (margin, y), line, f, (242, 193, 78, 255), int(0.8 * u))
            y += int(f.size * 1.25)

    address = [l.strip() for l in str(spec.get("address", "")).splitlines() if l.strip()]
    extra = str(spec.get("phone", "")).strip()
    rows = [(a, "Bold" if i == 0 else "Medium", 5.0 * u if i == 0 else 4.2 * u) for i, a in enumerate(address)]
    if extra:
        rows.append((extra, "Medium", 4.2 * u))
    if rows:
        pad = int(5.5 * u)
        fonts = [fit_lines(draw, t, wt, sz, sz * 0.7, w - 2 * margin - 2 * pad)[1] for t, wt, sz in rows]
        heights = [int(f.size * 1.55) for f in fonts]
        card_h = sum(heights) + 2 * pad - int(fonts[-1].size * 0.55)
        x0, y1 = margin, h - margin
        y0 = y1 - card_h
        card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle((x0, y0, w - margin, y1), radius=int(3.2 * u), fill=(24, 16, 11, 228), outline=(255, 255, 255, 150), width=max(1, int(0.25 * u)))
        img.alpha_composite(card)
        ty = y0 + pad - int(fonts[0].size * 0.15)
        for (t, _, _), f, hh in zip(rows, fonts, heights):
            draw.text((x0 + pad, ty), t, font=f, fill=(255, 255, 255, 255) if f is fonts[0] else (226, 220, 210, 255))
            ty += hh
    img.save(out)
    print(out)


if __name__ == "__main__":
    main()
