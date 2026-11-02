"""Sinh bo icon / splash cho chaybo.

Chay:  python scripts/generate-assets.py

Mark: mot vong chay (superellipse hoi nghieng) mau vang chanh #D8FF3E tren nen
gan den #08090A, co mot khe o ben phai va mot diem tron danh dau diem bat dau.
Toan bo hinh duoc ve bang code nen mau va hinh hoc luon chinh xac.
"""

import math
import os

from PIL import Image, ImageDraw

BG = (8, 9, 10)
LIME = (216, 255, 62)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
SS = 4  # supersampling: ve o 4x roi thu nho bang LANCZOS


def loop_points(cx, cy, rx, ry, gap_deg, tilt, n=2.55, steps=1400):
    """Cac diem tren mot superellipse co khe, da xoay theo `tilt`."""
    gap = math.radians(gap_deg)
    start = gap / 2
    end = 2 * math.pi - gap / 2
    pts = []
    for i in range(steps + 1):
        t = start + (end - start) * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = math.copysign(abs(ct) ** (2 / n), ct) * rx
        y = math.copysign(abs(st) ** (2 / n), st) * ry
        pts.append(
            (
                cx + x * math.cos(tilt) - y * math.sin(tilt),
                cy + x * math.sin(tilt) + y * math.cos(tilt),
            )
        )
    return pts


def stroke_path(draw, pts, width, color):
    """To net day bang mot polygon duy nhat (ImageDraw.line bi artifact khi net qua day)."""
    half = width / 2
    n = len(pts)
    outer, inner = [], []
    for i, p in enumerate(pts):
        if i == 0:
            t = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
        elif i == n - 1:
            t = (pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1])
        else:
            t = (pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1])
        length = math.hypot(*t) or 1.0
        nx, ny = -t[1] / length, t[0] / length
        outer.append((p[0] + nx * half, p[1] + ny * half))
        inner.append((p[0] - nx * half, p[1] - ny * half))
    draw.polygon(outer + inner[::-1], fill=color)


def draw_mark(size, color, scale=1.0, dot=True):
    """Anh RGBA nen trong suot chua mark."""
    w = size * SS
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cx = cy = w / 2
    rx = 0.272 * w * scale
    ry = 0.238 * w * scale
    stroke = int(0.097 * w * scale)
    tilt = -0.18

    pts = loop_points(cx, cy, rx, ry, 56 if dot else 0, tilt)
    stroke_path(d, pts, stroke, color)

    r = stroke / 2
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)

    if dot:
        x, y = rx, 0.0
        xr = x * math.cos(tilt) - y * math.sin(tilt)
        yr = x * math.sin(tilt) + y * math.cos(tilt)
        dr = 0.052 * w * scale
        d.ellipse([cx + xr - dr, cy + yr - dr, cx + xr + dr, cy + yr + dr], fill=color)

    return img.resize((size, size), Image.LANCZOS)


def save(img, name, background=None):
    if background is not None:
        flat = Image.new("RGB", img.size, background)
        flat.paste(img, (0, 0), img)
        img = flat
    img.save(os.path.join(OUT, name), optimize=True)
    print(f"{name:30} {img.size[0]}x{img.size[1]} {img.mode}")


def main():
    # iOS: full-bleed, khong trong suot, iOS tu bo goc
    save(draw_mark(1024, LIME + (255,), scale=1.14), "icon.png", background=BG)

    # Splash: nen trong suot de hoa vao backgroundColor #08090A
    save(draw_mark(1024, LIME + (255,), scale=1.06), "splash-icon.png")

    # Android adaptive icon: mark nam trong safe zone 66%
    save(draw_mark(512, LIME + (255,), scale=0.86), "android-icon-foreground.png")
    save(Image.new("RGB", (512, 512), BG), "android-icon-background.png")
    save(draw_mark(432, (255, 255, 255, 255), scale=0.86), "android-icon-monochrome.png")

    save(draw_mark(48, LIME + (255,)), "favicon.png", background=BG)


if __name__ == "__main__":
    main()
