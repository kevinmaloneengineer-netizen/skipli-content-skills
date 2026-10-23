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

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

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


def brand_color(logo):
    """Main colour of a logo (most common saturated pixel), for the banner text; dark ink without one."""
    if logo is None:
        return (28, 26, 22, 255)
    small = logo.convert("RGBA").resize((48, 48))
    counts = {}
    for r, g, b, a in small.getdata():
        if a < 200 or max(r, g, b) - min(r, g, b) < 60 or max(r, g, b) < 60:
            continue  # skip transparent, grey, white and black pixels
        key = (r // 24 * 24, g // 24 * 24, b // 24 * 24)
        counts[key] = counts.get(key, 0) + 1
    if not counts:
        return (28, 26, 22, 255)
    r, g, b = max(counts, key=counts.get)
    k = min(1, 150 / max(1, 0.3 * r + 0.59 * g + 0.11 * b))  # dark enough to read on white
    return (int(r * k), int(g * k), int(b * k), 255)


def banner(spec, out):
    """White band with the logo and the name in the logo's colour (the collage's middle strip)."""
    w, h = int(spec["width"]), int(spec["height"])
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    logo_path = spec.get("logo")
    logo = Image.open(logo_path).convert("RGBA") if logo_path and Path(logo_path).exists() else None
    color = brand_color(logo)
    pad = int(h * 0.12)
    x = pad
    if logo is not None:
        side = h - 2 * pad
        logo.thumbnail((side, side), Image.LANCZOS)
        img.alpha_composite(logo, (x, (h - logo.height) // 2))
        x += logo.width + pad
    name = str(spec.get("name", "")).strip().upper()
    city = str(spec.get("city", "")).strip().upper()
    room = w - x - pad
    lines, f = fit_lines(draw, name, "Bold", h * (0.36 if city else 0.42), h * 0.18, room)
    fc = font("SemiBold", max(12, h * 0.12))
    block = len(lines) * f.size * 1.08 + (fc.size * 1.5 if city else 0)
    y = (h - block) / 2
    for line in lines:
        draw.text((x, y), line, font=f, fill=color)
        y += f.size * 1.08
    if city:
        draw.text((x, y + fc.size * 0.3), city, font=fc, fill=(110, 104, 93, 255))
    img.save(out)
    print(out)


def search(spec, out_dir):
    """Intro frames: a search box types "<name> - <city>", then a cursor clicks the magnifier."""
    w, h, fps = int(spec["width"]), int(spec["height"]), int(spec.get("fps", 30))
    seconds = float(spec.get("seconds", 2.6))
    logo_path = spec.get("logo")
    color = brand_color(Image.open(logo_path) if logo_path and Path(logo_path).exists() else None)
    if color == (28, 26, 22, 255):
        color = (200, 52, 34, 255)  # no logo: a warm red outline
    text = str(spec.get("query", "")).strip()
    u = w / 100
    bx0, bx1 = int(7 * u), int(w - 7 * u)
    bh = int(11 * u)
    by0 = (h - bh) // 2
    f = font("SemiBold", 4.4 * u)
    mag = (bx1 - int(7 * u), by0 + bh // 2)  # magnifier centre
    n = int(seconds * fps)
    type_end = 0.55 * n
    move_end = 0.78 * n
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    def cursor(draw, x, y, scale):
        pts = [(0, 0), (0, 17), (4.5, 13), (8, 21), (11, 19.5), (7.5, 12), (13, 12)]
        k = scale * u * 0.55
        poly = [(x + px * k, y + py * k) for px, py in pts]
        draw.polygon(poly, fill=(255, 255, 255, 255), outline=(28, 26, 22, 255))
        draw.line(poly + [poly[0]], fill=(28, 26, 22, 255), width=max(2, int(0.45 * u)))

    for i in range(n):
        img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((bx0, by0, bx1, by0 + bh), radius=bh // 2, outline=color, width=max(3, int(0.8 * u)))
        shown = text[: int(len(text) * min(1, i / type_end))] if type_end else text
        d.text((bx0 + int(5 * u), by0 + bh // 2), shown, font=f, fill=(28, 26, 22, 255), anchor="lm")
        if i < type_end and (i // 8) % 2 == 0:  # blinking caret while typing
            tx = bx0 + int(5 * u) + text_w(d, shown, f) + int(0.6 * u)
            d.line((tx, by0 + bh * 0.28, tx, by0 + bh * 0.72), fill=(28, 26, 22, 255), width=max(2, int(0.4 * u)))
        r = int(2.2 * u)
        clicked = i >= move_end
        d.ellipse((mag[0] - r, mag[1] - r - int(0.8 * u), mag[0] + r, mag[1] + r - int(0.8 * u)), outline=color, width=max(3, int(0.7 * u)))
        d.line((mag[0] + r * 0.7, mag[1] + r * 0.7 - int(0.8 * u), mag[0] + r * 1.5, mag[1] + r * 1.5 - int(0.8 * u)), fill=color, width=max(3, int(0.7 * u)))
        if clicked:  # click ripple
            k = min(1, (i - move_end) / (0.12 * n))
            rr = int(r + 4 * u * k)
            d.ellipse((mag[0] - rr, mag[1] - rr, mag[0] + rr, mag[1] + rr), outline=(color[0], color[1], color[2], int(255 * (1 - k))), width=max(2, int(0.5 * u)))
        # cursor: waits bottom right, glides to the magnifier after typing, presses (shrinks) on click
        p = 0 if i < type_end else min(1, (i - type_end) / max(1, move_end - type_end))
        e = 1 - (1 - p) ** 3
        sx, sy = w * 0.78, h * 0.68
        cx = sx + (mag[0] - sx) * e
        cy = sy + (mag[1] - sy) * e
        cursor(d, cx, cy, 0.9 if clicked and i - move_end < 0.06 * n else 1.0)
        img.convert("RGB").save(Path(out_dir) / f"f{i:04d}.png")
    print(out_dir)


def cover(img, w, h):
    """Crop-to-fill a photo into w x h."""
    img = img.convert("RGB")
    k = max(w / img.width, h / img.height)
    img = img.resize((max(w, round(img.width * k)), max(h, round(img.height * k))), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def rounded(img, r):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=r, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def wrap(draw, text, f, max_w, max_lines):
    words, lines, cur = str(text).split(), [], ""
    for wd in words:
        test = f"{cur} {wd}".strip()
        if text_w(draw, test, f) <= max_w:
            cur = test
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(".,;") + "…"
    return lines


def search_bar(w, u, color, query):
    """The search box in its final state (text typed, black magnifier button)."""
    bh = int(11 * u)
    bar = Image.new("RGBA", (w - int(12 * u), bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(bar)
    d.rounded_rectangle((0, 0, bar.width - 1, bh - 1), radius=bh // 2, fill=(255, 255, 255, 255), outline=color, width=max(3, int(0.8 * u)))
    d.text((int(5 * u), bh // 2), query, font=font("SemiBold", 4.4 * u), fill=(28, 26, 22, 255), anchor="lm")
    r = int(3.6 * u)
    cx, cy = bar.width - int(2 * u) - r, bh // 2
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(20, 20, 20, 255))
    rr = int(1.4 * u)
    d.ellipse((cx - rr - int(0.4 * u), cy - rr - int(0.4 * u), cx + rr - int(0.4 * u), cy + rr - int(0.4 * u)), outline=(255, 255, 255, 255), width=max(2, int(0.45 * u)))
    d.line((cx + rr * 0.5, cy + rr * 0.5, cx + rr * 1.5, cy + rr * 1.5), fill=(255, 255, 255, 255), width=max(2, int(0.5 * u)))
    return bar


def layers(spec, out_dir):
    """Static layers of one animated scene + their places: out_dir/layers.json lists {file, x, y, anim, delay}."""
    w, h = int(spec["width"]), int(spec["height"])
    # Layout unit: 1% of the width of a 9:16 frame of this height. A portrait frame keeps 1% of its width;
    # a wide or square frame gets smaller type, so the words do not cover the photo.
    u = min(w, h * 9 / 16) / 100
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    logo_path = spec.get("logo")
    logo = Image.open(logo_path).convert("RGBA") if logo_path and Path(logo_path).exists() else None
    color = brand_color(logo)
    accent = color if logo is not None else (200, 52, 34, 255)
    items = []

    def add(img, name, x, y, anim="fade", delay=0.0, **move):
        img.save(out / f"{name}.png")
        items.append({"file": str(out / f"{name}.png"), "x": int(x), "y": int(y), "anim": anim, "delay": round(delay, 2), **move})

    photos = [Image.open(p) for p in spec.get("photos", [])]
    if spec["kind"] == "landing":
        y = int(4 * u)
        bar = search_bar(w, u, accent, spec.get("query", ""))
        add(bar, "bar", (w - bar.width) // 2, y, "none")
        y += bar.height + int(4 * u)
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        if logo is not None:
            lg = logo.copy()
            lg.thumbnail((int(48 * u), int(24 * u)), Image.LANCZOS)
            add(lg, "logo", (w - lg.width) // 2, y, "down", 0.15)
            y += lg.height + int(3 * u)
        else:
            name = str(spec.get("name", "")).upper()
            lines, f = fit_lines(probe, name, "Bold", 11 * u, 7 * u, w - 16 * u)
            img = Image.new("RGBA", (w, int(len(lines) * f.size * 1.15) + 4), (0, 0, 0, 0))
            for i, line in enumerate(lines):
                ImageDraw.Draw(img).text((w // 2, int(i * f.size * 1.15)), line, font=f, fill=color, anchor="ma")
            add(img, "logo", 0, y, "down", 0.15)
            y += img.height + int(2 * u)
        margin = int(9 * u)
        tagline = str(spec.get("tagline", "")).strip()
        if tagline:
            lines, f = fit_lines(probe, tagline, "Bold", 6.6 * u, 4.6 * u, w - 2 * margin)
            img = Image.new("RGBA", (w - 2 * margin, int(len(lines) * f.size * 1.2) + 4), (0, 0, 0, 0))
            for i, line in enumerate(lines):
                ImageDraw.Draw(img).text((0, int(i * f.size * 1.2)), line, font=f, fill=accent)
            add(img, "tagline", margin, y, "fade", 0.45)
            y += img.height + int(1.5 * u)
        blurb = str(spec.get("blurb", "")).strip()
        if blurb:
            f = font("Medium", 4.1 * u)
            lines = wrap(probe, blurb, f, w - 2 * margin, 5)
            img = Image.new("RGBA", (w - 2 * margin, int(len(lines) * f.size * 1.38) + 4), (0, 0, 0, 0))
            for i, line in enumerate(lines):
                ImageDraw.Draw(img).text((0, int(i * f.size * 1.38)), line, font=f, fill=(40, 37, 32, 255))
            add(img, "blurb", margin, y, "fade", 0.7)
            y += img.height + int(3 * u)
        # 2 x 2 photo grid, rounded, a round logo badge in the middle.
        gx, gap = int(4 * u), int(1.2 * u)
        gbottom = h - int(10 * u)
        gh = max(int(30 * u), gbottom - y)
        tw, th = (w - 2 * gx - gap) // 2, (gh - gap) // 2
        dirs = ["left", "right", "left", "right"]
        for i in range(4):
            if not photos:
                break
            tile = rounded(cover(photos[i % len(photos)], tw, th), int(2.6 * u))
            add(tile, f"tile{i}", gx + (i % 2) * (tw + gap), y + (i // 2) * (th + gap), dirs[i], 0.9 + 0.15 * i)
        if logo is not None:
            dia = int(min(tw, th) * 0.62)
            badge = Image.new("RGBA", (dia, dia), (0, 0, 0, 0))
            bd = ImageDraw.Draw(badge)
            bd.ellipse((0, 0, dia - 1, dia - 1), fill=(255, 255, 255, 255), outline=color, width=max(3, int(0.6 * u)))
            lg = logo.copy()
            lg.thumbnail((int(dia * 0.72), int(dia * 0.72)), Image.LANCZOS)
            badge.alpha_composite(lg, ((dia - lg.width) // 2, (dia - lg.height) // 2))
            add(badge, "badge", gx + tw + gap // 2 - dia // 2, y + th + gap // 2 - dia // 2, "fade", 1.6)
        cta = str(spec.get("cta", "")).strip()
        if cta:
            f = font("Bold", 5.2 * u)
            img = Image.new("RGBA", (int(text_w(probe, cta, f) + 4), int(f.size * 1.3)), (0, 0, 0, 0))
            ImageDraw.Draw(img).text((0, 0), cta, font=f, fill=accent)
            add(img, "cta", w - margin - img.width, h - int(8 * u), "fade", 1.9)
    elif spec["kind"] == "tilted":
        # Full photo behind, a second photo as a tilted white-framed card sliding in.
        add(cover(photos[0], w, h).convert("RGBA"), "bg", 0, 0, "none")
        cw = int(w * (0.66 if h > w else 0.42))
        ch = int(cw * 1.15)
        border = int(1.8 * u)
        card = Image.new("RGBA", (cw + 2 * border, ch + 2 * border), (255, 255, 255, 255))
        card.paste(cover(photos[1 % len(photos)], cw, ch), (border, border))
        card = card.rotate(-6, resample=Image.BICUBIC, expand=True)
        shadow = Image.new("RGBA", (card.width + 40, card.height + 40), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 110), (20, 28), card.getchannel("A"))
        shadow = shadow.filter(ImageFilter.GaussianBlur(14))
        shadow.alpha_composite(card, (20, 20))
        add(shadow, "card", w - shadow.width + int(2 * u), h - shadow.height - int(6 * u), "right", 0.3)
    elif spec["kind"] in MARKETING:
        MARKETING[spec["kind"]](spec, w, h, u, color, accent, logo, photos, add)
    (out / "layers.json").write_text(json.dumps(items), encoding="utf-8")
    print(out)


def tint(color, k):
    """Mix a colour with white (k = share of white)."""
    return tuple(int(c + (255 - c) * k) for c in color[:3]) + (255,)


def text_block(lines, f, fill, width, align="center", gap=1.12):
    width = int(width)
    img = Image.new("RGBA", (width, int(len(lines) * f.size * gap) + int(f.size * 0.3)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        x = width // 2 if align == "center" else 0
        d.text((x, int(i * f.size * gap)), line, font=f, fill=fill, anchor="ma" if align == "center" else "la")
    return img


def solid(w, h, color):
    return Image.new("RGBA", (w, h), color)


def scene_title(spec, w, h, u, color, accent, logo, photos, add):
    """Opening card: small kicker, a huge headline, a line under it (e.g. TOP 3 / must-try at …).
    style "photo": white type on a darkened photo; "light": brand-colour type on a pale tint; else white on the brand colour."""
    style = spec.get("style", "")
    if style == "photo" and photos:
        bg = cover(photos[0], w, h).convert("RGBA")
        bg.alpha_composite(solid(w, h, (0, 0, 0, 120)))
        add(bg, "bg", 0, 0, "none")
    else:
        style = "light" if style == "light" else ""
        add(solid(w, h, tint(accent, 0.9) if style == "light" else accent), "bg", 0, 0, "none")
    ink = accent if style == "light" else (255, 255, 255, 255)
    soft = (60, 56, 50, 255) if style == "light" else (255, 255, 255, 230)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    y = int(h * 0.30)
    if spec.get("kicker"):
        f = font("Bold", 5.6 * u)
        img = text_block([spec["kicker"].upper()], f, soft, w)
        add(img, "kicker", 0, y, "fade", 0.1)
        y += img.height + int(2 * u)
    # Big: rather two lines at a large size than one small line.
    lines, f = fit_lines(probe, spec.get("headline", "").upper(), "Bold", 20 * u, 15 * u, w - 12 * u)
    img = text_block(lines, f, ink, w, gap=1.0)
    add(img, "headline", 0, y, "up", 0.25)
    y += img.height + int(3 * u)
    if spec.get("sub"):
        lines, f = fit_lines(probe, spec["sub"], "SemiBold", 6 * u, 4 * u, w - 14 * u)
        add(text_block(lines, f, soft, w), "sub", 0, y, "fade", 0.55)
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int(30 * u), int(16 * u)), Image.LANCZOS)
        pad = int(2.4 * u)
        chip = Image.new("RGBA", (lg.width + 2 * pad, lg.height + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(chip).rounded_rectangle((0, 0, chip.width - 1, chip.height - 1), radius=int(3 * u), fill=(255, 255, 255, 255))
        chip.alpha_composite(lg, (pad, pad))
        add(chip, "logo", (w - chip.width) // 2, int(h * 0.12), "down", 0.0)


def scene_countdown(spec, w, h, u, color, accent, logo, photos, add):
    """One dish of a Top 3: full photo, a big #N badge, the dish name and price on a dark band."""
    add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    band_h = int(h * 0.30)
    grad = Image.new("L", (1, band_h))
    grad.putdata([int(215 * (y / band_h) ** 0.8) for y in range(band_h)])
    add(Image.merge("RGBA", [Image.new("L", (w, band_h), 0)] * 3 + [grad.resize((w, band_h))]), "shade", 0, h - band_h, "none")
    dia = int(26 * u)
    badge = Image.new("RGBA", (dia, dia), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.ellipse((0, 0, dia - 1, dia - 1), fill=accent, outline=(255, 255, 255, 255), width=max(3, int(0.8 * u)))
    bd.text((dia // 2, dia // 2), f"#{spec.get('number', 1)}", font=font("Bold", dia * 0.42), fill=(255, 255, 255, 255), anchor="mm")
    add(badge, "badge", int(6 * u), int(8 * u), "left", 0.15)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    lines, f = fit_lines(probe, spec.get("dish", "").upper(), "Bold", 9.5 * u, 6 * u, w - 12 * u)
    name = text_block(lines, f, (255, 255, 255, 255), w - 12 * u, align="left", gap=1.05)
    y = h - int(9 * u) - name.height - (int(9 * u) if spec.get("price") else 0)
    add(name, "name", int(6 * u), y, "up", 0.35)
    if spec.get("price"):
        fp = font("Bold", 6 * u)
        tw = int(text_w(probe, spec["price"], fp))
        pill = Image.new("RGBA", (tw + int(6 * u), int(fp.size * 1.6)), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pill)
        pd.rounded_rectangle((0, 0, pill.width - 1, pill.height - 1), radius=pill.height // 2, fill=(255, 255, 255, 255))
        pd.text((pill.width // 2, pill.height // 2), spec["price"], font=fp, fill=accent, anchor="mm")
        add(pill, "price", int(6 * u), y + name.height + int(1.5 * u), "fade", 0.6)


def scene_menu(spec, w, h, u, color, accent, logo, photos, add):
    """Two dish cards (photo, name, price) on a light brand tint, like a digital menu board."""
    add(solid(w, h, tint(accent, 0.9)), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    if spec.get("heading"):
        f = font("Bold", 7 * u)
        add(text_block([spec["heading"].upper()], f, accent, w), "heading", 0, int(5 * u), "down", 0.0)
    top = int(16 * u)
    gap = int(4 * u)
    ch = (h - top - int(5 * u) - gap) // 2
    cw = w - int(10 * u)
    for k, dish in enumerate(spec.get("dishes", [])[:2]):
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        mask = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=int(3.5 * u), fill=255)
        body = Image.new("RGBA", (cw, ch), (255, 255, 255, 255))
        ph = int(ch * 0.72)
        if k < len(photos):
            body.paste(cover(photos[k], cw, ph), (0, 0))
        d = ImageDraw.Draw(body)
        lines, f = fit_lines(probe, dish.get("name", ""), "Bold", 6.2 * u, 4.2 * u, cw - int(30 * u) if dish.get("price") else cw - int(8 * u))
        d.text((int(4 * u), ph + (ch - ph) // 2), lines[0], font=f, fill=(28, 26, 22, 255), anchor="lm")
        if dish.get("price"):
            fp = font("Bold", 6.4 * u)
            d.text((cw - int(4 * u), ph + (ch - ph) // 2), dish["price"], font=fp, fill=accent, anchor="rm")
        card.paste(body, (0, 0), mask)
        add(card, f"card{k}", int(5 * u), top + k * (ch + gap), "left" if k == 0 else "right", 0.2 + 0.25 * k)


def scene_offer(spec, w, h, u, color, accent, logo, photos, add):
    """The deal in huge letters on the brand colour, a round sticker, the place underneath."""
    add(solid(w, h, accent), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    f = font("SemiBold", 4.8 * u)
    add(text_block([spec.get("kicker", "").upper()], f, (255, 255, 255, 220), w), "kicker", 0, int(h * 0.26), "fade", 0.1)
    words = str(spec.get("offer", "")).upper()
    fb = font("Bold", 13 * u)
    lines = wrap(probe, words, fb, w - 14 * u, 4)
    while len(lines) > 3 and fb.size > 7 * u:
        fb = font("Bold", fb.size - 4)
        lines = wrap(probe, words, fb, w - 14 * u, 4)
    block = text_block(lines, fb, (255, 255, 255, 255), w, gap=1.02)
    add(block, "offer", 0, int(h * 0.33), "up", 0.3)
    dia = int(30 * u)
    st = Image.new("RGBA", (dia, dia), (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    sd.ellipse((0, 0, dia - 1, dia - 1), fill=(255, 214, 64, 255))
    sd.text((dia // 2, dia // 2), spec.get("sticker", "DEAL"), font=font("Bold", dia * 0.2), fill=(28, 26, 22, 255), anchor="mm")
    st = st.rotate(14, resample=Image.BICUBIC, expand=True)
    add(st, "sticker", w - st.width - int(5 * u), int(h * 0.33) + block.height - int(4 * u), "right", 0.7)
    if spec.get("place"):
        f2 = font("Bold", 5.2 * u)
        add(text_block([spec["place"].upper()], f2, (255, 255, 255, 255), w), "place", 0, int(h * 0.82), "fade", 0.9)


def scene_ribbon(spec, w, h, u, color, accent, logo, photos, add):
    """Full photo with a slanted band across it carrying the deal."""
    add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    f = font("Bold", 6.4 * u)
    text = str(spec.get("offer", "")).upper()
    lines = wrap(probe, text, f, int(w * 1.0), 2)
    bh = int(len(lines) * f.size * 1.2 + 5 * u)
    band = Image.new("RGBA", (int(w * 1.4), bh), accent)
    bd = ImageDraw.Draw(band)
    for i, line in enumerate(lines):
        bd.text((band.width // 2, int(2.5 * u + i * f.size * 1.2)), line, font=f, fill=(255, 255, 255, 255), anchor="ma")
    band = band.rotate(-7, resample=Image.BICUBIC, expand=True)
    add(band, "ribbon", (w - band.width) // 2, int(h * 0.64), "left", 0.25)


def scene_polaroids(spec, w, h, u, color, accent, logo, photos, add):
    """Up to three photos as white-framed polaroids dropping onto a tinted backdrop, slightly tilted."""
    add(solid(w, h, tint(accent, 0.82)), "bg", 0, 0, "none")
    pw = int(w * (0.62 if h > w else 0.34))
    spots = [(0.08, 0.06, -8), (0.32, 0.36, 6), (0.12, 0.62, -4)] if h > w else [(0.06, 0.12, -7), (0.36, 0.2, 5), (0.64, 0.1, -3)]
    for k, ph in enumerate(photos[:3]):
        border = int(2.2 * u)
        inner = pw - 2 * border
        frame = Image.new("RGBA", (pw, inner + border + int(9 * u)), (255, 255, 255, 255))
        frame.paste(cover(ph, inner, inner), (border, border))
        frame = frame.rotate(spots[k][2], resample=Image.BICUBIC, expand=True)
        shadow = Image.new("RGBA", (frame.width + 36, frame.height + 36), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 90), (18, 26), frame.getchannel("A"))
        shadow = shadow.filter(ImageFilter.GaussianBlur(12))
        shadow.alpha_composite(frame, (18, 18))
        add(shadow, f"pol{k}", int(spots[k][0] * w), int(spots[k][1] * h), "down", 0.15 + 0.45 * k)


def scene_word(spec, w, h, u, color, accent, logo, photos, add):
    """One big word on a solid colour (kinetic type between photos)."""
    bg = accent if spec.get("dark", True) else tint(accent, 0.9)
    fg = (255, 255, 255, 255) if spec.get("dark", True) else accent
    add(solid(w, h, bg), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    lines, f = fit_lines(probe, str(spec.get("word", "")).upper(), "Bold", 24 * u, 10 * u, w - 10 * u)
    block = text_block(lines, f, fg, w, gap=1.0)
    add(block, "word", 0, (h - block.height) // 2, "up", 0.08)


def gradient(w, gh, top, bottom, rgb=(0, 0, 0)):
    """A w x gh band whose alpha goes from `top` to `bottom` (0..255)."""
    grad = Image.new("L", (1, gh))
    grad.putdata([int(top + (bottom - top) * (y / max(1, gh - 1))) for y in range(gh)])
    return Image.merge("RGBA", [Image.new("L", (w, gh), c) for c in rgb] + [grad.resize((w, gh))])


def bright(color):
    """The brand colour pushed to full brightness (for neon and dark backgrounds)."""
    import colorsys

    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in color[:3]))
    r, g, b = colorsys.hsv_to_rgb(h, max(s, 0.65), 1.0)
    return (int(r * 255), int(g * 255), int(b * 255), 255)


def with_shadow(img, blur=12, alpha=100, drop=8):
    """The picture on a transparent canvas with a soft shadow under it."""
    pad = blur * 3
    out = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    out.paste((0, 0, 0, alpha), (pad, pad + drop), img.getchannel("A"))
    out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(img, (pad, pad))
    return out, pad


def barcode(bw, bh, seed="skipli"):
    img = Image.new("RGBA", (bw, bh), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    x, k = int(bw * 0.06), 0
    while x < bw * 0.94:
        bar = 1 + (ord(seed[k % len(seed)]) + k * 7) % 3
        d.rectangle((x, int(bh * 0.12), x + bar * max(1, bw // 90), int(bh * 0.88)), fill=(20, 20, 20, 255))
        x += (bar + 1 + (k * 5) % 3) * max(1, bw // 90)
        k += 1
    return img


def dashed(d, x0, x1, y, color, u):
    x = x0
    while x < x1:
        d.line((x, y, min(x1, x + 1.6 * u), y), fill=color, width=max(2, int(0.35 * u)))
        x += 2.8 * u


def scene_film(spec, w, h, u, color, accent, logo, photos, add):
    """Photos on a film strip gliding through a dark frame; "now showing" and the name above it."""
    add(solid(w, h, (18, 16, 14, 255)), "bg", 0, 0, "none")
    portrait = h >= w
    seconds = float(spec.get("seconds", 5))
    across = w if portrait else h  # the strip's width, across its direction of travel
    sw = int(across * (0.8 if portrait else 0.56))
    side = int(sw * 0.11)
    fw = sw - 2 * side
    fh = int(fw * 0.74)
    gap = int(fh * 0.08)
    speed = (fh + gap) * 0.5  # px per second
    length = (h if portrait else w) + speed * seconds + 2 * (fh + gap)
    n = max(len(photos), int(length / (fh + gap)) + 1)
    strip = Image.new("RGBA", (sw, n * (fh + gap) + gap), (10, 10, 10, 255))
    d = ImageDraw.Draw(strip)
    for k in range(n):
        if photos:
            strip.paste(cover(photos[k % len(photos)], fw, fh), (side, gap + k * (fh + gap)))
    hw, hh = int(side * 0.46), int(side * 0.34)
    for y in range(int(hh * 0.6), strip.height, int(hh * 2.1)):
        for x in ((side - hw) // 2, sw - side + (side - hw) // 2):
            d.rounded_rectangle((x, y, x + hw, y + hh), radius=max(2, hh // 4), fill=(236, 230, 218, 255))
    top = int(h * (0.26 if portrait else 0.3))
    if portrait:
        add(strip, "strip", (w - sw) // 2, top, "pan", 0, vx=0, vy=-round(speed, 2))
    else:
        strip = strip.rotate(90, expand=True)
        add(strip, "strip", 0, top + (h - top - sw) // 2, "pan", 0, vx=-round(speed, 2), vy=0)
    # A dark head band over the strip, then the words.
    add(gradient(w, top + int(6 * u), 255, 0, (18, 16, 14)), "head", 0, 0, "none")
    add(gradient(w, int(h * 0.1), 0, 230, (18, 16, 14)), "foot", 0, h - int(h * 0.1), "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    y = int(top * 0.2)
    if spec.get("label"):
        img = text_block([spec["label"].upper()], font("Bold", 4.2 * u), (242, 193, 78, 255), w)
        add(img, "label", 0, y, "fade", 0.1)
        y += img.height + int(1.2 * u)
    if spec.get("title"):
        lines, f = fit_lines(probe, spec["title"].upper(), "Bold", 11 * u, 6.5 * u, w - 12 * u)
        add(text_block(lines, f, (255, 255, 255, 255), w, gap=1.02), "title", 0, y, "down", 0.25)


def scene_cover(spec, w, h, u, color, accent, logo, photos, add):
    """A magazine cover: the photo, the name as the masthead, cover lines and a barcode."""
    add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    add(gradient(w, int(h * 0.34), 175, 0), "top", 0, 0, "none")
    add(gradient(w, int(h * 0.5), 0, 215), "bottom", 0, h - int(h * 0.5), "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    m = int(6 * u)
    y = int(5 * u)
    lines, f = fit_lines(probe, str(spec.get("masthead", "")).upper(), "Bold", 22 * u, 11 * u, w - 2 * m)
    mast = text_block(lines, f, (255, 255, 255, 255), w, gap=0.98)
    add(mast, "mast", 0, y, "down", 0.05)
    y += mast.height
    if spec.get("issue"):
        add(text_block([spec["issue"].upper()], font("SemiBold", 3.6 * u), (255, 255, 255, 225), w), "issue", 0, y, "fade", 0.35)
    width = int(w * (0.74 if h > w else 0.5))
    y = int(h * 0.6)
    if spec.get("headline"):
        f = font("Bold", 8 * u)
        hl = text_block(wrap(probe, spec["headline"].upper(), f, width, 3), f, (255, 255, 255, 255), width, align="left", gap=1.04)
        y = min(y, h - int(30 * u) - hl.height)
        add(hl, "headline", m, y, "left", 0.45)
        y += hl.height + int(2.5 * u)
    if spec.get("blurb"):
        f = font("Medium", 4.4 * u)
        bl = text_block(wrap(probe, spec["blurb"], f, width, 4), f, (255, 255, 255, 235), width, align="left", gap=1.3)
        add(bl, "blurb", m, min(y, h - int(8 * u) - bl.height), "fade", 0.7)
    for k, dish in enumerate([x for x in spec.get("items", []) if x][:3]):
        f = font("Bold", 5 * u)
        row = Image.new("RGBA", (width, int(f.size * 1.5)), (0, 0, 0, 0))
        rd = ImageDraw.Draw(row)
        rd.rectangle((0, int(f.size * 0.25), int(1.1 * u), int(f.size * 1.2)), fill=bright(accent))
        rd.text((int(3 * u), 0), dish.upper(), font=f, fill=(255, 255, 255, 255))
        add(row, f"item{k}", m, y, "left", 0.7 + 0.18 * k)
        y += row.height + int(0.6 * u)
    bw, bh = int(17 * u), int(9 * u)
    add(barcode(bw, bh, str(spec.get("masthead", "x")) or "x"), "barcode", w - m - bw, h - m - bh, "fade", 1.1)


def scene_grid9(spec, w, h, u, color, accent, logo, photos, add):
    """Nine squares filling in one by one like a profile grid; the middle one carries the logo or the name."""
    add(solid(w, h, (255, 255, 255, 255)), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    portrait = h >= w
    m, gap = int(4 * u), max(4, int(1 * u))
    gw = (w - 2 * m) if portrait else (h - 2 * m)
    cell = (gw - 2 * gap) // 3
    gw = 3 * cell + 2 * gap
    gx, gy = (m, (h - gw) // 2 + int(3 * u)) if portrait else (int(6 * u), (h - gw) // 2)
    order = [0, 8, 2, 6, 1, 7, 3, 5]
    k = 0
    for i in range(9):
        x, y = gx + (i % 3) * (cell + gap), gy + (i // 3) * (cell + gap)
        if i == 4:
            tile = Image.new("RGBA", (cell, cell), accent)
            td = ImageDraw.Draw(tile)
            if logo is not None:
                badge = Image.new("RGBA", (int(cell * 0.78), int(cell * 0.78)), (0, 0, 0, 0))
                ImageDraw.Draw(badge).ellipse((0, 0, badge.width - 1, badge.height - 1), fill=(255, 255, 255, 255))
                lg = logo.copy()
                lg.thumbnail((int(badge.width * 0.7), int(badge.height * 0.7)), Image.LANCZOS)
                badge.alpha_composite(lg, ((badge.width - lg.width) // 2, (badge.height - lg.height) // 2))
                tile.alpha_composite(badge, ((cell - badge.width) // 2, (cell - badge.height) // 2))
            else:
                lines, f = fit_lines(probe, str(spec.get("title", "")).upper() or "•", "Bold", cell * 0.2, cell * 0.11, cell * 0.86)
                blk = text_block(lines, f, (255, 255, 255, 255), cell, gap=1.0)
                tile.alpha_composite(blk, (0, (cell - blk.height) // 2))
            add(tile, "center", x, y, "fade", 0.0)
            continue
        if not photos:
            continue
        add(cover(photos[k % len(photos)], cell, cell).convert("RGBA"), f"cell{i}", x, y, "down" if k % 2 else "fade", 0.2 + 0.16 * order.index(i))
        k += 1
    if portrait:
        if spec.get("title"):
            lines, f = fit_lines(probe, spec["title"].upper(), "Bold", 8 * u, 5 * u, w - 2 * m)
            t = text_block(lines, f, accent, w, gap=1.0)
            add(t, "title", 0, max(int(3 * u), gy - t.height - int(3 * u)), "down", 1.2)
        if spec.get("sub"):
            lines, f = fit_lines(probe, spec["sub"], "SemiBold", 5 * u, 3.6 * u, w - 2 * m)
            add(text_block(lines, f, (60, 56, 50, 255), w), "sub", 0, gy + gw + int(3 * u), "fade", 1.45)
    else:
        rx = gx + gw + int(5 * u)
        rw = w - rx - int(5 * u)
        y = int(h * 0.36)
        if spec.get("title"):
            lines, f = fit_lines(probe, spec["title"].upper(), "Bold", 9 * u, 5 * u, rw)
            t = text_block(lines, f, accent, rw, align="left", gap=1.0)
            add(t, "title", rx, y, "right", 1.2)
            y += t.height + int(2 * u)
        if spec.get("sub"):
            f = font("SemiBold", 4.4 * u)
            add(text_block(wrap(probe, spec["sub"], f, rw, 3), f, (60, 56, 50, 255), rw, align="left"), "sub", rx, y, "fade", 1.45)


def scene_story(spec, w, h, u, color, accent, logo, photos, add):
    """An Instagram story frame: progress bars, the avatar and name on top, a sticker with a few words."""
    add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    add(gradient(w, int(h * 0.2), 150, 0), "shade", 0, 0, "none")
    m = int(3 * u)
    total, index = max(1, int(spec.get("total", 4))), int(spec.get("index", 0))
    bars = Image.new("RGBA", (w - 2 * m, int(0.9 * u) + 2), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bars)
    seg = (bars.width - (total - 1) * int(u)) / total
    for i in range(total):
        x0 = int(i * (seg + u))
        bd.rounded_rectangle((x0, 0, int(x0 + seg), bars.height - 1), radius=bars.height // 2, fill=(255, 255, 255, 255 if i <= index else 95))
    add(bars, "bars", m, int(2.5 * u), "none")
    dia = int(9 * u)
    av = Image.new("RGBA", (dia, dia), (0, 0, 0, 0))
    ad = ImageDraw.Draw(av)
    ad.ellipse((0, 0, dia - 1, dia - 1), fill=(255, 255, 255, 255), outline=bright(accent), width=max(2, int(0.5 * u)))
    name = str(spec.get("name", "")).strip()
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int(dia * 0.66), int(dia * 0.66)), Image.LANCZOS)
        av.alpha_composite(lg, ((dia - lg.width) // 2, (dia - lg.height) // 2))
    else:
        ad.text((dia // 2, dia // 2), (name[:1] or "•").upper(), font=font("Bold", dia * 0.45), fill=accent, anchor="mm")
    head = Image.new("RGBA", (w - 2 * m, dia), (0, 0, 0, 0))
    head.alpha_composite(av, (0, 0))
    hd = ImageDraw.Draw(head)
    fn = font("Bold", 3.8 * u)
    hd.text((dia + int(2 * u), dia // 2), name, font=fn, fill=(255, 255, 255, 255), anchor="lm")
    if spec.get("now"):
        hd.text((dia + int(3.5 * u) + text_w(hd, name, fn), dia // 2), spec["now"], font=font("Medium", 3.4 * u), fill=(255, 255, 255, 190), anchor="lm")
    add(head, "head", m, int(5.5 * u), "none")
    sticker = str(spec.get("sticker", "")).strip()
    if sticker:
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        f = font("Bold", 6.4 * u)
        lines = wrap(probe, sticker, f, w - 26 * u, 2)
        tw = max(text_w(probe, l, f) for l in lines)
        pad = int(3.2 * u)
        chip = Image.new("RGBA", (int(tw + 2 * pad), int(len(lines) * f.size * 1.2 + 1.6 * pad)), (0, 0, 0, 0))
        cd = ImageDraw.Draw(chip)
        cd.rounded_rectangle((0, 0, chip.width - 1, chip.height - 1), radius=int(2.6 * u), fill=(255, 255, 255, 255))
        for i, line in enumerate(lines):
            cd.text((chip.width // 2, int(pad * 0.8 + i * f.size * 1.2)), line, font=f, fill=accent, anchor="ma")
        chip = chip.rotate(-4 if index % 2 == 0 else 4, resample=Image.BICUBIC, expand=True)
        chip, pad2 = with_shadow(chip, blur=10, alpha=90, drop=6)
        add(chip, "sticker", (w - chip.width) // 2, int(h * 0.64), "up", 0.3)


def scene_receipt(spec, w, h, u, color, accent, logo, photos, add):
    """A till receipt printing out: the restaurant, the dishes (with the prices the user typed), thanks."""
    add(solid(w, h, tint(accent, 0.86)), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    pw = int(min(w * 0.8, h * 0.5))
    pad = int(pw * 0.08)
    ink = (34, 31, 27, 255)
    parts = []  # (height, draw function)
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int(pw * 0.3), int(pw * 0.18)), Image.LANCZOS)
        parts.append((lg.height + int(2 * u), lambda d, img, y, lg=lg: img.alpha_composite(lg, ((pw - lg.width) // 2, y))))
    name = str(spec.get("name", "")).upper()
    if name:
        lines, fname = fit_lines(probe, name, "Bold", pw * 0.1, pw * 0.06, pw - 2 * pad)
        for line in lines:
            parts.append((int(fname.size * 1.15), lambda d, img, y, t=line, f=fname: d.text((pw // 2, y), t, font=f, fill=ink, anchor="ma")))
    if spec.get("city"):
        fc = font("Medium", pw * 0.042)
        parts.append((int(fc.size * 1.6), lambda d, img, y, f=fc: d.text((pw // 2, y), spec["city"], font=f, fill=(110, 104, 93, 255), anchor="ma")))
    parts.append((int(3 * u), lambda d, img, y: dashed(d, pad, pw - pad, y + int(1.2 * u), (150, 144, 133, 255), u)))
    fl = font("SemiBold", pw * 0.042)
    parts.append((int(fl.size * 2), lambda d, img, y, f=fl: d.text((pw // 2, y + int(0.4 * u)), str(spec.get("label", "")).upper(), font=f, fill=accent, anchor="ma")))
    fr = font("Medium", pw * 0.055)
    fp = font("Bold", pw * 0.055)
    for row in [r for r in spec.get("rows", []) if r.get("name")][:5]:
        price = str(row.get("price", ""))
        room = pw - 2 * pad - (text_w(probe, price, fp) + int(3 * u) if price else 0)
        label = row["name"]
        while text_w(probe, label, fr) > room and len(label) > 3:
            label = label[:-2].rstrip() + "…"

        def draw_row(d, img, y, t=label, pr=price):
            d.text((pad, y), t, font=fr, fill=ink)
            if pr:
                d.text((pw - pad, y), pr, font=fp, fill=ink, anchor="ra")

        parts.append((int(fr.size * 1.75), draw_row))
    parts.append((int(3 * u), lambda d, img, y: dashed(d, pad, pw - pad, y + int(1.2 * u), (150, 144, 133, 255), u)))
    ft = font("Bold", pw * 0.06)
    parts.append((int(ft.size * 1.9), lambda d, img, y, f=ft: d.text((pw // 2, y + int(0.6 * u)), str(spec.get("thanks", "")).upper(), font=f, fill=ink, anchor="ma")))
    bh = int(pw * 0.14)
    parts.append((bh + int(2 * u), lambda d, img, y: img.alpha_composite(barcode(pw - 4 * pad, bh, name or "x"), (2 * pad, y))))
    zig = int(2.2 * u)
    ph = pad + sum(p[0] for p in parts) + pad + zig
    paper = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    pd = ImageDraw.Draw(paper)
    teeth = 14
    pts = [(0, 0), (pw, 0), (pw, ph - zig)]
    for i in range(teeth, -1, -1):
        pts.append((pw * i / teeth, ph - (zig if i % 2 == 0 else 0)))
    pd.polygon(pts, fill=(255, 253, 248, 255))
    y = pad
    for hgt, fn in parts:
        fn(pd, paper, y)
        y += hgt
    paper, sp = with_shadow(paper, blur=14, alpha=80, drop=10)
    add(paper, "paper", (w - paper.width) // 2, max(int(2 * u), (h - paper.height) // 2), "rise", 0.1)


def glow_text(lines, f, color, width, blur):
    core = text_block(lines, f, (255, 255, 255, 255), width, gap=1.06)
    tinted = text_block(lines, f, color, width, gap=1.06)
    pad = blur * 3
    out = Image.new("RGBA", (core.width + 2 * pad, core.height + 2 * pad), (0, 0, 0, 0))
    halo = Image.new("RGBA", out.size, (0, 0, 0, 0))
    halo.alpha_composite(tinted, (pad, pad))
    out.alpha_composite(halo.filter(ImageFilter.GaussianBlur(blur * 1.6)))
    out.alpha_composite(halo.filter(ImageFilter.GaussianBlur(blur * 0.6)))
    out.alpha_composite(tinted, (pad, pad))
    soft = Image.new("RGBA", out.size, (0, 0, 0, 0))
    soft.alpha_composite(core, (pad, pad))
    soft.putalpha(soft.getchannel("A").point(lambda a: int(a * 0.55)))
    out.alpha_composite(soft)
    return out, pad


def scene_neon(spec, w, h, u, color, accent, logo, photos, add):
    """A neon sign on a dark wall: the name glowing (mode "title"), or a photo in a glowing frame ("photo")."""
    bg = Image.new("RGBA", (w, h), (17, 14, 22, 255))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    neon = bright(accent)
    ImageDraw.Draw(glow).ellipse((-w * 0.2, h * 0.2, w * 1.2, h * 0.8), fill=neon[:3] + (40,))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(int(18 * u))))
    add(bg, "bg", 0, 0, "none")
    second = (90, 225, 255, 255) if abs(neon[0] - neon[2]) > 60 or neon[0] > 200 else (255, 90, 180, 255)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    if spec.get("mode") == "photo" and photos:
        portrait = h >= w
        fw = int(w * 0.74) if portrait else int(h * 0.62)
        fh = int(fw * 1.12) if portrait else fw
        frame = Image.new("RGBA", (fw + int(16 * u), fh + int(16 * u)), (0, 0, 0, 0))
        fd = ImageDraw.Draw(frame)
        o = int(8 * u)
        fd.rounded_rectangle((o - int(1.4 * u), o - int(1.4 * u), o + fw + int(1.4 * u), o + fh + int(1.4 * u)), radius=int(4 * u), outline=neon, width=max(3, int(0.9 * u)))
        lit = frame.filter(ImageFilter.GaussianBlur(int(2.4 * u)))
        lit.alpha_composite(frame.filter(ImageFilter.GaussianBlur(int(0.8 * u))))
        lit.alpha_composite(frame)
        lit.alpha_composite(rounded(cover(photos[0], fw, fh), int(3 * u)), (o, o))
        fy = int(h * 0.1) if portrait else (h - lit.height) // 2
        add(lit, "frame", (w - lit.width) // 2 if portrait else int(4 * u), fy, "fade", 0.05)
        cap = str(spec.get("caption", "")).strip()
        if cap:
            if portrait:
                lines, f = fit_lines(probe, cap.upper(), "Bold", 9 * u, 5.5 * u, w - 14 * u)
                img, pad = glow_text(lines, f, second, w, int(1.4 * u))
                add(img, "caption", -pad, fy + lit.height + int(1 * u), "fade", 0.55)
            else:
                rx = int(4 * u) + lit.width
                lines, f = fit_lines(probe, cap.upper(), "Bold", 8 * u, 5 * u, w - rx - 6 * u)
                img, pad = glow_text(lines, f, second, w - rx, int(1.4 * u))
                add(img, "caption", rx - pad, (h - img.height) // 2, "fade", 0.55)
        return
    y = int(h * 0.3)
    title = str(spec.get("title", "")).upper()
    if title:
        lines, f = fit_lines(probe, title, "Bold", 17 * u, 9 * u, w - 14 * u)
        img, pad = glow_text(lines, f, neon, w, int(1.8 * u))
        add(img, "title", -pad, y - pad, "fade", 0.15)
        y += img.height - 2 * pad + int(4 * u)
    if spec.get("sub"):
        lines, f = fit_lines(probe, spec["sub"].upper(), "Bold", 6.4 * u, 4.2 * u, w - 16 * u)
        img, pad = glow_text(lines, f, second, w, int(1.3 * u))
        add(img, "sub", -pad, y - pad, "fade", 0.7)
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int(22 * u), int(14 * u)), Image.LANCZOS)
        add(lg, "logo", (w - lg.width) // 2, int(h * 0.12), "down", 0.0)


def scene_postcard(spec, w, h, u, color, accent, logo, photos, add):
    """A postcard on kraft paper: the photo on top, "greetings from <name>" (or a short note), a stamp and a postmark."""
    add(solid(w, h, (228, 214, 190, 255)), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    cw = int(min(w * 0.86, (h - 14 * u) / 1.2))
    ch = int(cw * 1.2)
    card = Image.new("RGBA", (cw, ch), (252, 249, 242, 255))
    cd = ImageDraw.Draw(card)
    b = int(cw * 0.05)
    phh = int(ch * 0.6)
    if photos:
        card.paste(cover(photos[0], cw - 2 * b, phh), (b, b))
    ty = b + phh + int(cw * 0.05)
    half = int(cw * 0.56)
    note = str(spec.get("note", "")).strip()
    if note:
        f = font("Medium", cw * 0.042)
        for i, line in enumerate(wrap(probe, note, f, half - b, 5)):
            cd.text((b, ty + int(i * f.size * 1.35)), line, font=f, fill=(60, 55, 48, 255))
    else:
        f1 = font("Medium", cw * 0.045)
        cd.text((b, ty), str(spec.get("from", "")), font=f1, fill=(110, 104, 93, 255))
        lines, f2 = fit_lines(probe, str(spec.get("name", "")).upper(), "Bold", cw * 0.1, cw * 0.06, half - b)
        for i, line in enumerate(lines):
            cd.text((b, ty + int(f1.size * 1.6) + int(i * f2.size * 1.05)), line, font=f2, fill=accent)
    cd.line((half, ty, half, ch - b), fill=(205, 196, 180, 255), width=max(2, int(0.3 * u)))
    for k in range(3):
        ly = ch - b - int(k * cw * 0.07) - int(cw * 0.02)
        cd.line((half + int(cw * 0.04), ly, cw - b, ly), fill=(205, 196, 180, 255), width=max(2, int(0.3 * u)))
    if spec.get("city"):
        fc = font("SemiBold", cw * 0.04)
        cd.text((half + int(cw * 0.05), ch - b - int(cw * 0.02) - int(fc.size * 1.25)), str(spec["city"]), font=fc, fill=(80, 74, 66, 255))
    card = card.rotate(-2, resample=Image.BICUBIC, expand=True)
    card, sp = with_shadow(card, blur=16, alpha=90, drop=12)
    cx, cy = (w - card.width) // 2, (h - card.height) // 2
    add(card, "card", cx, cy, "rise", 0.05)
    # The stamp: a scalloped white edge around the logo (or a crop of the photo).
    sw_ = int(cw * 0.2)
    sh_ = int(sw_ * 1.2)
    stamp = Image.new("RGBA", (sw_, sh_), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stamp)
    sd.rectangle((0, 0, sw_ - 1, sh_ - 1), fill=(255, 255, 255, 255))
    r = max(3, sw_ // 18)
    for x in range(0, sw_ + 1, r * 3):
        sd.ellipse((x - r, -r, x + r, r), fill=(0, 0, 0, 0))
        sd.ellipse((x - r, sh_ - r, x + r, sh_ + r), fill=(0, 0, 0, 0))
    for y in range(0, sh_ + 1, r * 3):
        sd.ellipse((-r, y - r, r, y + r), fill=(0, 0, 0, 0))
        sd.ellipse((sw_ - r, y - r, sw_ + r, y + r), fill=(0, 0, 0, 0))
    inner = (int(r * 1.8), int(r * 1.8), sw_ - int(r * 1.8), sh_ - int(r * 1.8))
    sd.rectangle(inner, fill=tint(accent, 0.8))
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int((inner[2] - inner[0]) * 0.8), int((inner[3] - inner[1]) * 0.8)), Image.LANCZOS)
        stamp.alpha_composite(lg, ((sw_ - lg.width) // 2, (sh_ - lg.height) // 2))
    elif photos:
        stamp.paste(cover(photos[-1], inner[2] - inner[0], inner[3] - inner[1]), inner[:2])
    stamp = stamp.rotate(5, resample=Image.BICUBIC, expand=True)
    stamp, _ = with_shadow(stamp, blur=6, alpha=70, drop=3)
    sx = cx + sp + cw - int(cw * 0.05) - stamp.width + int(cw * 0.02)
    sy = cy + sp + int(ch * 0.6) + int(cw * 0.06)
    add(stamp, "stamp", sx, sy, "down", 0.6)
    # Postmark rings over the stamp's corner.
    pm = int(cw * 0.22)
    mark = Image.new("RGBA", (pm * 2, pm), (0, 0, 0, 0))
    md = ImageDraw.Draw(mark)
    ink = (60, 56, 50, 150)
    md.ellipse((0, 0, pm - 1, pm - 1), outline=ink, width=max(2, int(0.4 * u)))
    md.ellipse((pm * 0.14, pm * 0.14, pm * 0.86, pm * 0.86), outline=ink, width=max(1, int(0.25 * u)))
    for k in range(3):
        yy = pm * (0.35 + 0.15 * k)
        md.arc((pm * 0.9, yy - pm * 0.08, pm * 1.4, yy + pm * 0.08), 180, 360, fill=ink, width=max(2, int(0.35 * u)))
        md.arc((pm * 1.4, yy - pm * 0.08, pm * 1.9, yy + pm * 0.08), 0, 180, fill=ink, width=max(2, int(0.35 * u)))
    add(mark, "postmark", sx - int(pm * 0.75), sy - int(pm * 0.2), "fade", 0.95)


def scene_circle(spec, w, h, u, color, accent, logo, photos, add):
    """One dish in a big round frame on the brand colour, its number, name and price."""
    bg = Image.new("RGBA", (w, h), accent)
    bd = ImageDraw.Draw(bg)
    for k, rr in enumerate((0.95, 0.75, 0.55)):
        R = int(min(w, h) * rr)
        cx, cy = w // 2, int(h * 0.4)
        bd.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 255, 255, 26 + 10 * k), width=max(2, int(0.4 * u)))
    add(bg, "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    total = int(spec.get("total", 3))
    add(text_block([f"{int(spec.get('index', 1)):02d} / {total:02d}"], font("SemiBold", 4.4 * u), (255, 255, 255, 210), w), "index", 0, int(h * 0.07), "fade", 0.05)
    dia = int(min(w * 0.74, h * 0.48))
    ring = int(1.8 * u)
    disc = Image.new("RGBA", (dia + 2 * ring, dia + 2 * ring), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse((0, 0, disc.width - 1, disc.height - 1), fill=(255, 255, 255, 255))
    if photos:
        ph = cover(photos[0], dia, dia).convert("RGBA")
        mask = Image.new("L", (dia, dia), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, dia - 1, dia - 1), fill=255)
        ph.putalpha(mask)
        disc.alpha_composite(ph, (ring, ring))
    disc, pad = with_shadow(disc, blur=16, alpha=110, drop=12)
    top = int(h * 0.4) - disc.height // 2
    add(disc, "disc", (w - disc.width) // 2, top, "down", 0.1)
    y = top + disc.height - pad + int(3 * u)
    if spec.get("dish"):
        lines, f = fit_lines(probe, spec["dish"].upper(), "Bold", 10 * u, 6 * u, w - 12 * u)
        blk = text_block(lines, f, (255, 255, 255, 255), w, gap=1.02)
        add(blk, "dish", 0, y, "up", 0.4)
        y += blk.height + int(1.5 * u)
    if spec.get("price"):
        fp = font("Bold", 6 * u)
        tw = int(text_w(probe, spec["price"], fp))
        pill = Image.new("RGBA", (tw + int(7 * u), int(fp.size * 1.6)), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pill)
        pd.rounded_rectangle((0, 0, pill.width - 1, pill.height - 1), radius=pill.height // 2, fill=(255, 255, 255, 255))
        pd.text((pill.width // 2, pill.height // 2), spec["price"], font=fp, fill=accent, anchor="mm")
        add(pill, "price", (w - pill.width) // 2, y, "fade", 0.65)


def scene_marquee(spec, w, h, u, color, accent, logo, photos, add):
    """A full photo with two bands of words running across it in opposite directions."""
    add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    add(gradient(w, int(h * 0.5), 0, 120), "shade", 0, h - int(h * 0.5), "none")
    text = "   •   ".join(x.upper() for x in spec.get("items", []) if x) or "•"
    seconds = float(spec.get("seconds", 5))
    f = font("Bold", 6.6 * u)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    unit = text_w(probe, text + "   •   ", f)
    speed = 14 * u  # px per second
    need = w * 1.5 + speed * seconds + unit
    reps = int(need / max(1, unit)) + 1
    line = (text + "   •   ") * reps
    bh = int(f.size * 1.9)
    for k, (fill, ink, angle, direction, at) in enumerate([(accent, (255, 255, 255, 255), -6, -1, 0.6), ((255, 255, 255, 255), accent, 5, 1, 0.75)]):
        band = Image.new("RGBA", (int(unit * reps), bh), fill)
        ImageDraw.Draw(band).text((0, bh // 2), line, font=f, fill=ink, anchor="lm")
        band = band.rotate(angle, resample=Image.BICUBIC, expand=True)
        x0 = -int(w * 0.25) if direction < 0 else w + int(w * 0.25) - band.width
        add(band, f"band{k}", x0, int(h * at) - band.height // 2, "pan", 0.1 * k, vx=round(direction * speed, 2), vy=0)
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int(20 * u), int(12 * u)), Image.LANCZOS)
        pad = int(2 * u)
        chip = Image.new("RGBA", (lg.width + 2 * pad, lg.height + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(chip).rounded_rectangle((0, 0, chip.width - 1, chip.height - 1), radius=int(2.4 * u), fill=(255, 255, 255, 255))
        chip.alpha_composite(lg, (pad, pad))
        add(chip, "logo", int(5 * u), int(5 * u), "down", 0.2)


def chip_logo(logo, u, max_w, max_h):
    """The logo on a small white rounded tile (for corners of photo scenes)."""
    lg = logo.copy()
    lg.thumbnail((int(max_w), int(max_h)), Image.LANCZOS)
    pad = int(2 * u)
    chip = Image.new("RGBA", (lg.width + 2 * pad, lg.height + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(chip).rounded_rectangle((0, 0, chip.width - 1, chip.height - 1), radius=int(2.4 * u), fill=(255, 255, 255, 255))
    chip.alpha_composite(lg, (pad, pad))
    return chip


def roomy(u, w, h):
    """Layout unit for scenes with a lot of small type: wide and square frames get bigger type than the default."""
    return max(u, min(w, h) * 0.0075)


def scene_news(spec, w, h, u, color, accent, logo, photos, add):
    """A TV news frame: full photo, LIVE chip, a "breaking" lower third (tag, headline, sub) and a running ticker."""
    u = roomy(u, w, h)
    add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    add(gradient(w, int(h * 0.45), 0, 190), "shade", 0, h - int(h * 0.45), "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    red, white, ink = (212, 34, 38, 255), (255, 255, 255, 255), (24, 22, 20, 255)
    m = int(5 * u)
    # LIVE chip, top left
    live = str(spec.get("live", "")).upper()
    if live:
        f = font("Bold", 3.8 * u)
        dot = int(2 * u)
        chip = Image.new("RGBA", (int(text_w(probe, live, f) + dot + 6 * u), int(7 * u)), (0, 0, 0, 0))
        cd = ImageDraw.Draw(chip)
        cd.rounded_rectangle((0, 0, chip.width - 1, chip.height - 1), radius=int(1.2 * u), fill=red)
        cd.ellipse((int(2 * u), chip.height // 2 - dot // 2, int(2 * u) + dot, chip.height // 2 + dot // 2), fill=white)
        cd.text((int(2 * u) + dot + int(1.6 * u), chip.height // 2), live, font=f, fill=white, anchor="lm")
        add(chip, "live", m, m, "fade", 0.05)
    if logo is not None:
        chip = chip_logo(logo, u, 18 * u, 10 * u)
        add(chip, "logo", w - m - chip.width, m, "down", 0.1)
    # Lower third: red tag, white headline bar, brand-colour sub bar; all slide in from the left.
    ticker_h = int(7.5 * u)
    bw = (w - 2 * m) if h >= w else int(w * 0.62)
    lines, fh = fit_lines(probe, str(spec.get("headline", "")).upper(), "Bold", 7.4 * u, 5 * u, bw - 6 * u)
    head = Image.new("RGBA", (bw, int(len(lines) * fh.size * 1.12 + 3.6 * u)), white)
    for i, line in enumerate(lines):
        ImageDraw.Draw(head).text((int(3 * u), int(1.8 * u + i * fh.size * 1.12)), line, font=fh, fill=ink)
    y = h - ticker_h - int(5 * u)
    sub = str(spec.get("sub", "")).strip()
    if sub:
        fs = font("SemiBold", 4.2 * u)
        bar = Image.new("RGBA", (bw, int(fs.size * 1.9)), accent)
        label = sub
        while text_w(probe, label, fs) > bw - 6 * u and len(label) > 3:
            label = label[:-2].rstrip() + "…"
        ImageDraw.Draw(bar).text((int(3 * u), bar.height // 2), label, font=fs, fill=white, anchor="lm")
        y -= bar.height
        add(bar, "sub", m, y, "left", 0.45)
    y -= head.height
    add(head, "headline", m, y, "left", 0.3)
    tag = str(spec.get("tag", "")).upper()
    if tag:
        ft = font("Bold", 4.4 * u)
        box = Image.new("RGBA", (int(text_w(probe, tag, ft) + 5 * u), int(ft.size * 1.8)), red)
        ImageDraw.Draw(box).text((box.width // 2, box.height // 2), tag, font=ft, fill=white, anchor="mm")
        add(box, "tag", m, y - box.height, "left", 0.15)
    # Ticker: dark band, the words running right to left, a yellow block at the start.
    add(solid(w, ticker_h, (16, 16, 20, 238)), "tickerbg", 0, h - ticker_h, "none")
    text = "   •   ".join(str(x).upper() for x in spec.get("items", []) if x) or "•"
    fk = font("SemiBold", 3.8 * u)
    unit = text_w(probe, text + "   •   ", fk)
    speed = 12 * u
    reps = int((w * 1.2 + speed * float(spec.get("seconds", 5)) + unit) / max(1, unit)) + 1
    strip = Image.new("RGBA", (int(unit * reps), ticker_h), (0, 0, 0, 0))
    ImageDraw.Draw(strip).text((0, ticker_h // 2), (text + "   •   ") * reps, font=fk, fill=white, anchor="lm")
    add(strip, "ticker", int(12 * u), h - ticker_h, "pan", 0, vx=-round(speed, 2), vy=0)
    block = solid(int(9 * u), ticker_h, (255, 204, 0, 255))
    ImageDraw.Draw(block).polygon([(int(3.4 * u), ticker_h * 0.3), (int(3.4 * u), ticker_h * 0.7), (int(6 * u), ticker_h * 0.5)], fill=ink)
    add(block, "tickerhead", 0, h - ticker_h, "none")


def chalkboard(w, h, u):
    """A dark green chalkboard with faint erased smudges and a wooden frame."""
    bg = Image.new("RGBA", (w, h), (36, 52, 44, 255))
    smudge = Image.effect_noise((max(1, w // 10), max(1, h // 10)), 34).resize((w, h), Image.BICUBIC)
    haze = Image.merge("RGBA", [Image.new("L", (w, h), 255)] * 3 + [smudge.point(lambda v: max(0, v - 104) // 3)])
    bg.alpha_composite(haze)
    d = ImageDraw.Draw(bg)
    fw = int(3 * u)
    d.rectangle((0, 0, w - 1, h - 1), outline=(126, 86, 52, 255), width=fw)
    d.rectangle((fw, fw, w - 1 - fw, h - 1 - fw), outline=(84, 56, 34, 255), width=max(2, int(0.6 * u)))
    return bg


def chalky(img, seed=0):
    """Rough chalk strokes: random specks knocked out of the drawing's alpha."""
    noise = Image.effect_noise(img.size, 80).point(lambda v: 255 if v > 64 else 110)
    img.putalpha(ImageChops.multiply(img.getchannel("A"), noise))
    return img


def scene_chalk(spec, w, h, u, color, accent, logo, photos, add):
    """Today's specials written in chalk (dishes, dotted leaders, prices), or one dish photo taped to the board."""
    u = roomy(u, w, h)
    add(chalkboard(w, h, u), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    white, yellow = (244, 241, 230, 255), (246, 222, 140, 255)
    pastel = tint(bright(accent), 0.35)
    portrait = h >= w
    if spec.get("mode") == "photo" and photos:
        pw = int(w * 0.72) if portrait else int(w * 0.42)
        ph = int(min(pw * 1.05, h * (0.56 if portrait else 0.72)))
        border = int(1.6 * u)
        card = Image.new("RGBA", (pw + 2 * border, ph + 2 * border), (250, 248, 240, 255))
        card.paste(cover(photos[0], pw, ph), (border, border))
        tape = Image.new("RGBA", (int(16 * u), int(4.6 * u)), (236, 224, 190, 200))
        for x in (int(-4 * u), card.width - int(12 * u)):
            card.alpha_composite(tape, (max(0, x), 0))
        card = card.rotate(-3, resample=Image.BICUBIC, expand=True)
        card, pad = with_shadow(card, blur=12, alpha=110, drop=8)
        cx = (w - card.width) // 2 if portrait else int(6 * u)
        cy = int(h * 0.15) if portrait else (h - card.height) // 2
        add(card, "photo", cx, cy, "down", 0.05)
        rows = [str(spec.get("dish", "")).upper(), str(spec.get("price", ""))]
        tw = w - 14 * u if portrait else w - (cx + card.width) - 10 * u
        x0 = 0 if portrait else cx + card.width
        y = cy + card.height - pad + int(3 * u) if portrait else int(h * 0.38)
        if rows[0]:
            lines, f = fit_lines(probe, rows[0], "Bold", 8.5 * u, 5.5 * u, tw)
            blk = chalky(text_block(lines, f, white, w - x0 if not portrait else w, gap=1.04))
            add(blk, "dish", x0, y, "fade", 0.5)
            y += blk.height + int(1 * u)
        if rows[1]:
            add(chalky(text_block([rows[1]], font("Bold", 7 * u), yellow, w - x0 if not portrait else w)), "price", x0, y, "fade", 0.8)
        return
    # The list: a title with a wavy underline, then one dish per row, written one after another.
    title = str(spec.get("title", "")).upper()
    y = int(h * (0.12 if portrait else 0.1))
    if title:
        lines, f = fit_lines(probe, title, "Bold", 10 * u, 6.5 * u, w - 16 * u)
        blk = text_block(lines, f, white, w, gap=1.02)
        line_w = int(min(w - 20 * u, max(text_w(probe, l, f) for l in lines)))
        under = Image.new("RGBA", (w, int(3 * u)), (0, 0, 0, 0))
        pts = [((w - line_w) / 2 + line_w * k / 40, u * 1.4 + u * 0.9 * (1 if k % 2 else -1) * (0.5 + (k % 3) / 4)) for k in range(41)]
        ImageDraw.Draw(under).line(pts, fill=pastel, width=max(3, int(0.7 * u)), joint="curve")
        out = Image.new("RGBA", (w, blk.height + under.height), (0, 0, 0, 0))
        out.alpha_composite(blk)
        out.alpha_composite(under, (0, blk.height))
        add(chalky(out.rotate(-2, resample=Image.BICUBIC)), "title", 0, y, "fade", 0.1)
        y += out.height + int(6 * u)
    note = str(spec.get("note", "")).strip()
    if note:
        f = font("Bold", 8 * u)
        lines = wrap(probe, note.upper(), f, w - 20 * u, 4)
        add(chalky(text_block(lines, f, (246, 222, 140, 255), w, gap=1.15)), "note", 0, y + int(4 * u), "fade", 0.55)
    rows = [r for r in spec.get("rows", []) if r.get("name")][:4]
    rw = int(w - 18 * u) if portrait else int(w * 0.62)
    rx = (w - rw) // 2
    fn, fp = font("SemiBold", 6.2 * u), font("Bold", 6.2 * u)
    step = int(fn.size * 2.3)
    if not portrait:
        step = int(min(step, (h * 0.86 - y) / max(1, len(rows))))
    for k, r in enumerate(rows):
        price = str(r.get("price", ""))
        room = rw - (text_w(probe, price, fp) + int(6 * u) if price else 0)
        label = str(r["name"])
        while text_w(probe, label, fn) > room and len(label) > 3:
            label = label[:-2].rstrip() + "…"
        row = Image.new("RGBA", (rw, int(fn.size * 1.5)), (0, 0, 0, 0))
        rd = ImageDraw.Draw(row)
        rd.text((0, row.height // 2), label, font=fn, fill=white, anchor="lm")
        if price:
            rd.text((rw, row.height // 2), price, font=fp, fill=yellow, anchor="rm")
            x = text_w(probe, label, fn) + int(2 * u)
            end = rw - text_w(probe, price, fp) - int(2 * u)
            while x < end:
                rd.ellipse((x, row.height * 0.62, x + 0.7 * u, row.height * 0.62 + 0.7 * u), fill=(244, 241, 230, 170))
                x += 2.2 * u
        add(chalky(row), f"row{k}", rx, y, "fade", 0.55 + 0.32 * k)
        y += step
    name = str(spec.get("name", "")).upper()
    if name:
        lines, f = fit_lines(probe, name, "Bold", 5 * u, 3.6 * u, w - 20 * u)
        add(chalky(text_block(lines, f, pastel, w)), "name", 0, h - int(8 * u) - int(len(lines) * f.size * 1.12), "fade", 0.55 + 0.32 * len(rows))
    if logo is not None and portrait:
        chip = chip_logo(logo, u, 14 * u, 9 * u)
        add(chip, "logo", w - int(6 * u) - chip.width, h - int(6 * u) - chip.height, "fade", 0.3)


def scene_map(spec, w, h, u, color, accent, logo, photos, add):
    """The real OpenStreetMap around the restaurant (tiles fetched by the server), a pin dropping on its exact
    spot, its address card and the OpenStreetMap credit."""
    u = roomy(u, w, h)
    m = spec["map"]
    scale, (wx, wy), (px, py) = float(m["scale"]), m["world"], m["pin"]
    base = Image.new("RGBA", (w, h), (242, 239, 233, 255))
    side = round(256 * scale)
    for t in m["tiles"]:
        tile = Image.open(t["file"]).convert("RGBA").resize((side, side), Image.LANCZOS)
        base.alpha_composite(tile, (round(px + (t["tx"] * 256 - wx) * scale), round(py + (t["ty"] * 256 - wy) * scale)))
    add(base, "map", 0, 0, "none")
    credit = "© OpenStreetMap contributors"
    fcr = font("Medium", max(11, 2.4 * u))
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    tag = Image.new("RGBA", (int(text_w(probe, credit, fcr) + 2 * u), int(fcr.size * 1.6)), (255, 255, 255, 210))
    ImageDraw.Draw(tag).text((int(u), tag.height // 2), credit, font=fcr, fill=(60, 56, 50, 255), anchor="lm")
    add(tag, "credit", w - tag.width, 0, "none")
    px, py = int(px), int(py)
    portrait = h >= w
    label = str(spec.get("label", "")).upper()
    if label:
        f = font("Bold", 4.4 * u)
        chip = Image.new("RGBA", (int(text_w(probe, label, f) + 7 * u), int(f.size * 2.1)), (0, 0, 0, 0))
        ImageDraw.Draw(chip).rounded_rectangle((0, 0, chip.width - 1, chip.height - 1), radius=chip.height // 2, fill=accent)
        ImageDraw.Draw(chip).text((chip.width // 2, chip.height // 2), label, font=f, fill=(255, 255, 255, 255), anchor="mm")
        chip, _ = with_shadow(chip, blur=8, alpha=70, drop=4)
        add(chip, "label", (w - chip.width) // 2, int(5 * u), "down", 0.05)
    # Pulse ring and shadow on the spot, then the pin dropping onto it.
    rr = int(9 * u)
    ring = Image.new("RGBA", (2 * rr, rr), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, 2 * rr - 1, rr - 1), fill=accent[:3] + (60,), outline=accent[:3] + (150,), width=max(2, int(0.5 * u)))
    add(ring, "ring", px - rr, py - rr // 2, "fade", 0.75)
    R = int(8.5 * u)
    k = 4  # drawn 4x then scaled down for smooth edges
    big = Image.new("RGBA", (2 * R * k, int(3.1 * R) * k), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    bd.ellipse((0, 0, 2 * R * k - 1, 2 * R * k - 1), fill=accent)
    bd.polygon([(R * k * 0.25, R * k * 1.55), (R * k * 1.75, R * k * 1.55), (R * k, big.height - 1)], fill=accent)
    ir = int(R * k * 0.62)
    bd.ellipse((R * k - ir, R * k - ir, R * k + ir, R * k + ir), fill=(255, 255, 255, 255))
    pin = big.resize((2 * R, int(3.1 * R)), Image.LANCZOS)
    if logo is not None:
        lg = logo.copy()
        lg.thumbnail((int(R * 0.95), int(R * 0.95)), Image.LANCZOS)
        pin.alpha_composite(lg, (R - lg.width // 2, R - lg.height // 2))
    else:
        ImageDraw.Draw(pin).ellipse((R - int(R * 0.25), R - int(R * 0.25), R + int(R * 0.25), R + int(R * 0.25)), fill=accent)
    pin, pad = with_shadow(pin, blur=8, alpha=90, drop=6)
    add(pin, "pin", px - pin.width // 2, py - pin.height + pad, "drop", 0.25)
    # Address card at the bottom.
    cw = int(w - 12 * u) if portrait else int(min(w - 12 * u, 96 * u))
    pad_c = int(4 * u)
    fname, fa = font("Bold", 7 * u), font("Medium", 4.4 * u)
    name = str(spec.get("name", "")).upper()
    nlines, fname = fit_lines(probe, name, "Bold", 7 * u, 4.8 * u, cw - 2 * pad_c) if name else ([], fname)
    addr = [l.strip() for l in str(spec.get("address", "")).splitlines() if l.strip()]
    city = str(spec.get("city", "")).strip()
    if city and city.split(",")[0].strip().lower() not in " ".join(addr).lower():  # the address usually names the city already
        addr.append(city)
    if spec.get("phone"):
        addr.append(str(spec["phone"]))
    # A long one-line address ("52A Trần Bình Trọng, Phường Bình Lợi Trung, TP HCM") breaks at its commas.
    split = []
    for a in addr:
        split += [x.strip() for x in a.split(",") if x.strip()] if "," in a and text_w(probe, a, fa) > cw - 2 * pad_c - 6 * u else [a]
    addr = split
    rows = []
    for a in addr[:3]:
        while text_w(probe, a, fa) > cw - 2 * pad_c - 6 * u and len(a) > 3:
            a = a[:-2].rstrip() + "…"
        rows.append(a)
    ch = pad_c * 2 + int(len(nlines) * fname.size * 1.1) + (int(1.5 * u) if nlines and rows else 0) + int(len(rows) * fa.size * 1.5)
    card = Image.new("RGBA", (cw, max(ch, int(12 * u))), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, cw - 1, card.height - 1), radius=int(3.4 * u), fill=(255, 255, 255, 255))
    cd.rounded_rectangle((0, 0, int(1.4 * u), card.height - 1), radius=int(0.7 * u), fill=accent)
    y = pad_c
    for line in nlines:
        cd.text((pad_c + int(1 * u), y), line, font=fname, fill=accent)
        y += int(fname.size * 1.1)
    y += int(1.5 * u) if nlines and rows else 0
    for a in rows:
        cd.text((pad_c + int(1 * u), y), a, font=fa, fill=(52, 48, 42, 255))
        y += int(fa.size * 1.5)
    card, pad = with_shadow(card, blur=12, alpha=80, drop=8)
    add(card, "card", (w - card.width) // 2, h - card.height + pad - int(6 * u), "up", 0.7)


def coupon_card(spec, cw, u, accent):
    """A tear-off coupon: notches at the perforation, a dashed inner border, the deal, a stub with a barcode."""
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    ch = int(cw * 0.6)
    stub = int(cw * 0.24)
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    r = int(2.6 * u)
    d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=r, fill=tint(accent, 0.82))  # the stub's colour
    d.rounded_rectangle((0, 0, cw - stub + r, ch - 1), radius=r, fill=(255, 252, 244, 255))
    d.rectangle((cw - stub, 0, cw - stub + r, ch - 1), fill=tint(accent, 0.82))
    nr = int(2.6 * u)
    for y in (0, ch):  # notches where it tears
        d.ellipse((cw - stub - nr, y - nr, cw - stub + nr, y + nr), fill=(0, 0, 0, 0))
    y = nr + int(1.2 * u)
    while y < ch - nr - int(1.2 * u):
        d.line((cw - stub, y, cw - stub, min(ch - nr, y + 1.4 * u)), fill=(150, 144, 133, 255), width=max(2, int(0.35 * u)))
        y += 2.6 * u
    inset = int(2.4 * u)
    left = cw - stub - inset
    dashed(d, inset, left - inset, inset, accent, u)
    dashed(d, inset, left - inset, ch - inset, accent, u)
    pad = int(5 * u)
    room = left - pad - inset
    label = str(spec.get("label", "")).upper()
    fl = font("Bold", 3.8 * u)
    d.text((pad, pad), label, font=fl, fill=accent)
    text = str(spec.get("offer", "")).upper()
    fo = font("Bold", 8.4 * u)
    lines = wrap(probe, text, fo, room, 4)
    while (len(lines) > 3 or len(lines) * fo.size * 1.08 > ch - 2 * pad - fl.size * 3.2) and fo.size > 4 * u:
        fo = font("Bold", fo.size - 2)
        lines = wrap(probe, text, fo, room, 4)
    oy = pad + int(fl.size * 1.9)
    for i, line in enumerate(lines):
        d.text((pad, oy + int(i * fo.size * 1.08)), line, font=fo, fill=(28, 26, 22, 255))
    if spec.get("place"):
        fp = font("SemiBold", 3.8 * u)
        place = str(spec["place"])
        while text_w(probe, place, fp) > room and len(place) > 3:
            place = place[:-2].rstrip() + "…"
        d.text((pad, ch - pad - fp.size), place, font=fp, fill=(110, 104, 93, 255))
    bc = barcode(int(ch * 0.62), int(stub * 0.5), text or "x").rotate(90, expand=True)
    card.alpha_composite(bc, (cw - stub + (stub - bc.width) // 2, (ch - bc.height) // 2))
    return card


def scene_coupon(spec, w, h, u, color, accent, logo, photos, add):
    """The deal as a tear-off coupon on a striped backdrop, or (mode "photo") a smaller coupon on a dish photo."""
    u = roomy(u, w, h)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    portrait = h >= w
    if spec.get("mode") == "photo" and photos:
        add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
        add(gradient(w, int(h * 0.5), 0, 170), "shade", 0, h - int(h * 0.5), "none")
        cw = int(w * 0.8) if portrait else int(w * 0.44)
        card = coupon_card(spec, cw, cw / 88, accent).rotate(4, resample=Image.BICUBIC, expand=True)  # type scales with the coupon
        card, pad = with_shadow(card, blur=14, alpha=110, drop=10)
        add(card, "coupon", (w - card.width) // 2 if portrait else w - card.width - int(2 * u), h - card.height - int(4 * u), "rise", 0.25)
        if logo is not None:
            chip = chip_logo(logo, u, 18 * u, 10 * u)
            add(chip, "logo", int(5 * u), int(5 * u), "down", 0.1)
        return
    bg = solid(w, h, tint(accent, 0.86))
    stripes = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    step = int(9 * u)
    for x in range(0, w * 2, step * 2):
        sd.rectangle((x, 0, x + step, h * 2), fill=(255, 255, 255, 60))
    stripes = stripes.rotate(30, resample=Image.BICUBIC)
    bg.alpha_composite(stripes.crop((w // 2, h // 2, w // 2 + w, h // 2 + h)))
    add(bg, "bg", 0, 0, "none")
    y = int(h * (0.2 if portrait else 0.08))
    kicker = str(spec.get("kicker", "")).upper()
    if kicker:
        lines, f = fit_lines(probe, kicker, "Bold", 5.6 * u, 4 * u, w - 14 * u)
        blk = text_block(lines, f, accent, w)
        add(blk, "kicker", 0, y, "fade", 0.05)
        y += blk.height + int(4 * u)
    cw = int(w * 0.88) if portrait else int(min(w * 0.6, (h - y - 16 * u) / 0.6))
    card = coupon_card(spec, cw, cw / 88, accent).rotate(-3, resample=Image.BICUBIC, expand=True)
    card, pad = with_shadow(card, blur=16, alpha=100, drop=12)
    add(card, "coupon", (w - card.width) // 2, y - pad, "rise", 0.2)
    if spec.get("sub"):
        lines, f = fit_lines(probe, str(spec["sub"]).upper(), "Bold", 4.6 * u, 3.6 * u, w - 14 * u)
        add(text_block(lines, f, (60, 56, 50, 255), w), "sub", 0, y - pad + card.height + int(2 * u), "fade", 0.8)


def scene_stamp(spec, w, h, u, color, accent, logo, photos, add):
    """A loyalty card: the shop's name, ten stamp circles (the first ones stamped), the reward line under them."""
    u = roomy(u, w, h)
    add(solid(w, h, tint(accent, 0.84)), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    cw = int(w * (0.84 if h >= w else 0.6))
    ch = int(cw * (1.25 if h >= w else 0.72))
    card = Image.new("RGBA", (cw, ch), (255, 252, 244, 255))
    d = ImageDraw.Draw(card)
    pad = int(cw * 0.07)
    name = str(spec.get("name", "")).strip().upper() or "TÊN QUÁN"
    lines, f = fit_lines(probe, name, "Bold", 5.2 * u, 3.4 * u, cw - 2 * pad)
    y = pad
    for line in lines:
        d.text((pad, y), line, font=f, fill=accent)
        y += int(f.size * 1.1)
    fs = font("Medium", max(10, 3.1 * u))
    sub = str(spec.get("sub", "")).strip()
    if sub:
        for line in wrap(probe, sub, fs, cw - 2 * pad, 2):
            d.text((pad, y + int(0.6 * u)), line, font=fs, fill=(110, 104, 93, 255))
            y += int(fs.size * 1.35)
    cols = 5
    gap = (cw - 2 * pad) / cols
    r = int(gap * 0.36)
    top = y + int(gap * 0.9)
    stamped = max(0, min(10, int(spec.get("stamped", 4))))
    for k in range(10):
        cx = int(pad + gap * (k % cols + 0.5))
        cy = int(top + (k // cols) * gap * 1.1 + gap * 0.5)
        if k < stamped:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=accent)
            d.line([(cx - r * 0.45, cy), (cx - r * 0.1, cy + r * 0.38), (cx + r * 0.5, cy - r * 0.38)], fill=(255, 255, 255, 255), width=max(2, int(0.9 * u)), joint="curve")
        else:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=tint(accent, 0.45), width=max(2, int(0.45 * u)))
    reward = str(spec.get("reward", "")).strip().upper()
    if reward:
        fr = font("Bold", 4.2 * u)
        rl = wrap(probe, reward, fr, cw - 2 * pad, 2)
        yy = ch - pad - int(len(rl) * fr.size * 1.1)
        for line in rl:
            d.text((pad, yy), line, font=fr, fill=accent)
            yy += int(fr.size * 1.1)
    card, sp = with_shadow(card, blur=14, alpha=90, drop=10)
    add(card, "card", (w - card.width) // 2, (h - card.height) // 2, "rise", 0.1)
    if logo is not None:
        add(chip_logo(logo, u, 16 * u, 10 * u), "logo", (w - int(16 * u)) // 2, int(h * 0.06), "down", 0.0)


def scene_week(spec, w, h, u, color, accent, logo, photos, add):
    """One dish per day of the week: a title, then a row per day (its label chip, the dish name, its price)."""
    u = roomy(u, w, h)
    add(solid(w, h, tint(accent, 0.9)), "bg", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    m = int(6 * u)
    title = str(spec.get("title", "")).strip().upper()
    y = int(h * 0.1)
    if title:
        lines, f = fit_lines(probe, title, "Bold", 9 * u, 5.5 * u, w - 2 * m)
        blk = text_block(lines, f, accent, w, gap=1.02)
        add(blk, "title", 0, y, "fade", 0.05)
        y += blk.height + int(5 * u)
    rows = [r for r in spec.get("rows", []) if r.get("name")][:7]
    if not rows:
        return
    # Rows share the space left under the title, but never grow past a comfortable height.
    gap_r = int(1.6 * u)
    rh = min(int(15 * u), int((h * 0.9 - y) / len(rows)) - gap_r)
    # The list sits in the middle of the space under the title, so a short list is not stuck at the top.
    block = len(rows) * (rh + gap_r) - gap_r
    y = max(y, (h - block) // 2)
    rw = w - 2 * m
    chip_w = int(rh * 1.5)
    for k, row in enumerate(rows):
        img = Image.new("RGBA", (rw, rh), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle((0, 0, rw - 1, rh - 1), radius=int(rh * 0.28), fill=(255, 255, 255, 255))
        chip = Image.new("RGBA", (chip_w, rh), (0, 0, 0, 0))
        ImageDraw.Draw(chip).rounded_rectangle((0, 0, chip_w - 1, rh - 1), radius=int(rh * 0.28), fill=accent)
        fd = font("Bold", rh * 0.36)
        ImageDraw.Draw(chip).text((chip_w // 2, rh // 2), str(row.get("day", "")).upper(), font=fd, fill=(255, 255, 255, 255), anchor="mm")
        img.alpha_composite(chip, (0, 0))
        price = str(row.get("price", ""))
        fp = font("Bold", rh * 0.36)
        room = rw - chip_w - int(3 * u) - (text_w(probe, price, fp) + int(4 * u) if price else 0)
        fn = font("SemiBold", rh * 0.36)
        label = str(row["name"])
        while text_w(probe, label, fn) > room and len(label) > 3:
            label = label[:-2].rstrip() + "…"
        d = ImageDraw.Draw(img)
        d.text((chip_w + int(3 * u), rh // 2), label, font=fn, fill=(28, 26, 22, 255), anchor="lm")
        if price:
            d.text((rw - int(3 * u), rh // 2), price, font=fp, fill=accent, anchor="rm")
        add(img, f"day{k}", m, y + k * (rh + gap_r), "left" if k % 2 == 0 else "right", 0.15 + 0.12 * k)


def scene_score(spec, w, h, u, color, accent, logo, photos, add):
    """Match night: a photo behind, a scoreboard with the two teams, the kick-off time left to fill in."""
    u = roomy(u, w, h)
    if photos:
        add(cover(photos[0], w, h).convert("RGBA"), "photo", 0, 0, "none")
    else:
        add(solid(w, h, (20, 22, 30, 255)), "photo", 0, 0, "none")
    add(gradient(w, h, 60, 200, (10, 12, 18)), "shade", 0, 0, "none")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    white, gold = (255, 255, 255, 255), (242, 193, 78, 255)
    label = str(spec.get("title", "")).upper()
    y = int(h * (0.16 if h >= w else 0.14))
    if label:
        f = font("Bold", 4.6 * u)
        chip = Image.new("RGBA", (int(text_w(probe, label, f) + 8 * u), int(f.size * 2.1)), accent)
        ImageDraw.Draw(chip).text((chip.width // 2, chip.height // 2), label, font=f, fill=white, anchor="mm")
        add(chip, "label", (w - chip.width) // 2, y, "down", 0.05)
        y += chip.height + int(5 * u)
    bw = int(w * 0.86)
    bh = int(bw * 0.42)
    board = Image.new("RGBA", (bw, bh), (14, 16, 22, 232))
    bd = ImageDraw.Draw(board)
    bd.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=int(3 * u), outline=gold, width=max(2, int(0.5 * u)))
    half = bw // 2
    for x0, text in ((0, spec.get("home", "")), (half, spec.get("away", ""))):
        lines, fn = fit_lines(probe, str(text).upper(), "Bold", 6.4 * u, 4 * u, half - int(6 * u))
        blk = text_block(lines, fn, white, half - int(6 * u), gap=1.0)
        board.alpha_composite(blk, (x0 + int(3 * u), (bh - blk.height) // 2))
    fvs = font("Bold", 4.2 * u)
    bd.text((half, bh // 2), "VS", font=fvs, fill=gold, anchor="mm")
    add(board, "board", (w - bw) // 2, y, "up", 0.2)
    y += bh + int(4 * u)
    when = str(spec.get("when", "")).strip()
    if when:
        add(text_block([when.upper()], font("SemiBold", 4.6 * u), white, w), "when", 0, y, "fade", 0.5)
        y += int(7 * u)
    offer = str(spec.get("offer", "")).strip()
    if offer:
        lines, fo = fit_lines(probe, offer.upper(), "Bold", 4.2 * u, 3 * u, w - 16 * u)
        add(text_block(lines, fo, gold, w, gap=1.05), "offer", 0, y, "fade", 0.7)
    if logo is not None:
        add(chip_logo(logo, u, 16 * u, 10 * u), "logo", int(5 * u), int(5 * u), "down", 0.1)


MARKETING = {
    "title": scene_title, "countdown": scene_countdown, "menu": scene_menu, "offer": scene_offer, "ribbon": scene_ribbon, "polaroids": scene_polaroids, "word": scene_word,
    "film": scene_film, "cover": scene_cover, "grid9": scene_grid9, "story": scene_story, "receipt": scene_receipt, "neon": scene_neon, "postcard": scene_postcard,
    "circle": scene_circle, "marquee": scene_marquee, "news": scene_news, "chalk": scene_chalk, "map": scene_map, "coupon": scene_coupon,
    "stamp": scene_stamp, "week": scene_week, "score": scene_score,
}


def captions(spec, out_dir):
    """Subtitles for the narrated videos: one full-frame transparent PNG per line (white bold type with a dark
    outline, two thirds down the frame), written as out_dir/cap1.png, cap2.png, …"""
    w, h = int(spec["width"]), int(spec["height"])
    u = w / 100
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    f = font("Bold", 6.2 * u if h > w else 3.6 * u)
    stroke = max(2, int(0.75 * u if h > w else 0.45 * u))
    for i, text in enumerate(spec.get("chunks", []), 1):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        lines = wrap(probe, str(text).strip(), f, w - 14 * u, 3)
        y = int(h * (0.68 if h > w else 0.78))
        for line in lines:
            d.text((w // 2, y), line, font=f, fill=(255, 255, 255, 255), anchor="ma", stroke_width=stroke, stroke_fill=(0, 0, 0, 235))
            y += int(f.size * 1.22)
        img.save(out / f"cap{i}.png")
    print(out)


def main():
    spec = json.load(open(sys.argv[2], encoding="utf-8") if len(sys.argv) > 2 else sys.stdin)
    out = sys.argv[1]
    if spec.get("kind") == "captions":
        return captions(spec, out)
    if spec.get("kind") in ("landing", "tilted") or spec.get("kind") in MARKETING:
        return layers(spec, out)
    if spec.get("kind") == "banner":
        return banner(spec, out)
    if spec.get("kind") == "search":
        return search(spec, out)
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
