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
    u = w / 100
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    logo_path = spec.get("logo")
    logo = Image.open(logo_path).convert("RGBA") if logo_path and Path(logo_path).exists() else None
    color = brand_color(logo)
    accent = color if logo is not None else (200, 52, 34, 255)
    items = []

    def add(img, name, x, y, anim="fade", delay=0.0):
        img.save(out / f"{name}.png")
        items.append({"file": str(out / f"{name}.png"), "x": int(x), "y": int(y), "anim": anim, "delay": round(delay, 2)})

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


MARKETING = {"title": scene_title, "countdown": scene_countdown, "menu": scene_menu, "offer": scene_offer, "ribbon": scene_ribbon, "polaroids": scene_polaroids, "word": scene_word}


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
