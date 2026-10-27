"""
Build the optimized Puglia assets used by the premium homepage.

Source of truth: img/favicold.png (1315 x 1315, transparent).
Outputs:
  img/opt/puglia-map.webp / .png      transparent editorial map (2D section)
  img/opt/puglia-texture.webp         dark-backed texture for the Three.js top face
  img/opt/favicon.png                 compact square icon
  img/opt/apple-touch-icon.png        iOS icon
  img/opt/logo-nav.webp / .png        horizontal logo for the navbar
  img/opt/logo-white.png              light version for the dark footer
  assets/data/puglia-shape.json       high-fidelity silhouette contour (UV space)

Run from the project root:
  python tools/build-puglia-assets.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage
from skimage import measure

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
OPT = IMG / "opt"
DATA = ROOT / "assets" / "data"
CROP = (60, 90, 1250, 980)  # left, top, right, bottom
INK = (11, 15, 20, 255)


def ensure_dirs() -> None:
    OPT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)


def load_source() -> Image.Image:
    source = Image.open(IMG / "favicold.png").convert("RGBA")
    return source


def build_map(source: Image.Image) -> Image.Image:
    crop = source.crop(CROP)
    crop.save(OPT / "puglia-map.png", optimize=True)
    crop.save(OPT / "puglia-map.webp", quality=90, method=6)
    return crop


def build_texture(source: Image.Image, width: int = 1024) -> None:
    crop = source.crop(CROP)
    height = round(width * crop.height / crop.width)
    crop = crop.resize((width, height), Image.LANCZOS)
    # The 3D top face ignores the transparent background, but a dark backing
    # avoids sampling transparent pixels along the bevel.
    backing = Image.new("RGBA", crop.size, INK)
    backing.alpha_composite(crop)
    backing.convert("RGB").save(OPT / "puglia-texture.webp", quality=90, method=6)


def build_icons(map_image: Image.Image) -> None:
    for name, size in (("favicon.png", 256), ("apple-touch-icon.png", 180)):
        canvas = Image.new("RGBA", (size, size), (11, 15, 20, 255))
        inner = round(size * 0.78)
        art = map_image.copy()
        art.thumbnail((inner, inner), Image.LANCZOS)
        x = (size - art.width) // 2
        y = (size - art.height) // 2
        canvas.alpha_composite(art, (x, y))
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle(
            (1, 1, size - 2, size - 2),
            radius=round(size * 0.22),
            outline=(56, 189, 248, 190),
            width=max(1, size // 90),
        )
        canvas.save(OPT / name, optimize=True)


def build_og(map_image: Image.Image) -> None:
    """1200 x 630 social card with the atlas artwork and the wordmark."""
    width, height = 1200, 630
    canvas = Image.new("RGBA", (width, height), (11, 15, 20, 255))

    # Atmospheric pools of light + a faint cartographic grid.
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((630, -180, 1280, 460), fill=(56, 189, 248, 42))
    draw.ellipse((780, 210, 1300, 720), fill=(124, 58, 237, 38))
    draw.ellipse((-220, 320, 360, 800), fill=(176, 141, 79, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    canvas.alpha_composite(glow)

    grid = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid)
    for x in range(0, width, 60):
        grid_draw.line((x, 0, x, height), fill=(255, 255, 255, 8))
    for y in range(0, height, 60):
        grid_draw.line((0, y, width, y), fill=(255, 255, 255, 8))
    canvas.alpha_composite(grid)

    # Map artwork inside a soft halo.
    art = map_image.copy()
    art.thumbnail((520, 390), Image.LANCZOS)
    art_x = 1200 - art.width - 96
    art_y = (height - art.height) // 2 - 12

    halo = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    halo_draw.ellipse(
        (art_x - 70, art_y + 30, art_x + art.width + 70, art_y + art.height + 20),
        fill=(56, 189, 248, 60),
    )
    halo = halo.filter(ImageFilter.GaussianBlur(60))
    canvas.alpha_composite(halo)
    canvas.alpha_composite(art, (art_x, art_y))

    # Compass ring around the island.
    ring = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring)
    ring_draw.ellipse(
        (art_x - 34, art_y - 6, art_x + art.width + 34, art_y + art.height + 4),
        outline=(199, 167, 106, 110),
        width=2,
    )
    ring_draw.ellipse(
        (art_x - 20, art_y + 8, art_x + art.width + 20, art_y + art.height - 10),
        outline=(199, 167, 106, 48),
        width=1,
    )
    canvas.alpha_composite(ring)

    # Hub pins.
    network = json.loads((DATA / "network.json").read_text(encoding="utf-8"))
    for hub in network:
        px = art_x + hub["x"] * art.width
        py = art_y + hub["y"] * art.height
        color = tuple(int(hub["color"][i : i + 2], 16) for i in (1, 3, 5))
        for radius, alpha in ((13, 42), (7, 96)):
            pin_glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            pin_draw = ImageDraw.Draw(pin_glow)
            pin_draw.ellipse(
                (px - radius, py - radius, px + radius, py + radius),
                fill=(*color, alpha),
            )
            canvas.alpha_composite(pin_glow.filter(ImageFilter.GaussianBlur(5)))
        pin_draw = ImageDraw.Draw(canvas)
        pin_draw.ellipse((px - 4, py - 4, px + 4, py + 4), fill=(*color, 255), outline=(246, 241, 231, 255), width=1)

    draw = ImageDraw.Draw(canvas)
    serif = ImageFont.truetype(r"C:\Windows\Fonts\georgia.ttf", 72)
    serif_italic = ImageFont.truetype(r"C:\Windows\Fonts\georgiai.ttf", 72)
    sans = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 21)
    mono = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 14)
    mono_small = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 12)

    draw.line((82, 96, 142, 96), fill=(176, 141, 79, 255), width=2)
    draw.text((158, 84), "A P U L I A N C H A I N", font=mono, fill=(199, 167, 106, 255))
    draw.text((82, 154), "Puglia,", font=serif, fill=(246, 241, 231, 255))
    draw.text((82, 246), "Terra Digitale.", font=serif_italic, fill=(56, 189, 248, 255))
    draw.text(
        (86, 370),
        "Blockchain, AI e Heritage per formare\n i leader di domani, in Puglia.",
        font=sans,
        fill=(196, 199, 192, 255),
        spacing=10,
    )
    draw.line((86, 480, 565, 480), fill=(255, 255, 255, 26), width=1)
    draw.text(
        (86, 504),
        "7 HUB  ·  4 PERCORSI  ·  RETE ATTIVA",
        font=mono_small,
        fill=(150, 153, 146, 255),
    )
    draw.text((86, 548), "apulianchain.com", font=mono, fill=(246, 241, 231, 220))

    canvas.convert("RGB").save(OPT / "og-cover.jpg", quality=88, optimize=True, progressive=True)


def build_logos() -> None:
    logo = Image.open(IMG / "favico.png").convert("RGBA")
    nav = logo.copy()
    nav.thumbnail((640, 640), Image.LANCZOS)
    nav.save(OPT / "logo-nav.png", optimize=True)
    nav.save(OPT / "logo-nav.webp", quality=92, method=6)

    # Recolour the wordmark to warm white while keeping the coloured Puglia
    # artwork. The wordmark starts around x=225 in the 1280px source; filling
    # every opaque pixel there removes the dark anti-aliased fringe.
    white = logo.copy()
    px = np.array(white)
    alpha = px[:, :, 3]
    wordmark_start = round(logo.width * 0.17)
    wordmark = np.zeros_like(alpha, dtype=bool)
    wordmark[:, wordmark_start:] = True
    fill = (alpha > 0) & wordmark
    px[fill, 0] = 243
    px[fill, 1] = 239
    px[fill, 2] = 232

    # Keep the map coloured, but lift its black circuitry for the dark footer.
    rgb = px[:, :, :3].astype(int)
    dark_art = (
        (alpha > 30)
        & (rgb[:, :, 0] < 48)
        & (rgb[:, :, 1] < 48)
        & (rgb[:, :, 2] < 48)
        & ~wordmark
    )
    px[dark_art, 0] = 243
    px[dark_art, 1] = 239
    px[dark_art, 2] = 232
    white = Image.fromarray(px, "RGBA")
    white.save(OPT / "logo-white.png", optimize=True)


def build_contour() -> None:
    source = np.array(load_source())
    red, green, blue = (source[:, :, i].astype(int) for i in range(3))
    alpha = source[:, :, 3]
    mask = (
        (alpha > 180)
        & (blue > 90)
        & (blue > red * 1.15)
        & (blue > green * 1.05)
    )
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3)), iterations=2)
    mask = ndimage.binary_fill_holes(mask)
    # Include the hand-drawn black outline around the galaxy fill.
    mask = ndimage.binary_dilation(mask, structure=np.ones((3, 3)), iterations=4)

    labels, count = ndimage.label(mask)
    if count == 0:
        raise RuntimeError("No silhouette found in favicold.png")
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    silhouette = labels == (int(np.argmax(sizes)) + 1)

    contours = measure.find_contours(silhouette.astype(float), 0.5)
    contour = max(contours, key=len)
    simplified = measure.approximate_polygon(contour, tolerance=1.2)

    left, top, right, bottom = CROP
    points: list[list[float]] = []
    for row, col in simplified[:-1]:
        u = (float(col) - left) / (right - left)
        v = (float(row) - top) / (bottom - top)
        if -0.001 <= u <= 1.001 and -0.001 <= v <= 1.001:
            points.append([round(u, 4), round(v, 4)])

    payload = {
        "source": "img/favicold.png",
        "crop": {"left": left, "top": top, "right": right, "bottom": bottom},
        "aspect": round((right - left) / (bottom - top), 5),
        "points": points,
    }
    (DATA / "puglia-shape.json").write_text(
        json.dumps(payload, separators=(",", ":")), encoding="utf-8"
    )
    print(f"contour points: {len(points)}")


def main() -> None:
    ensure_dirs()
    source = load_source()
    map_image = build_map(source)
    build_texture(source)
    build_icons(map_image)
    build_og(map_image)
    build_logos()
    build_contour()
    print("assets written to", OPT)
    for path in sorted(OPT.iterdir()):
        if path.is_file():
            print(f"  {path.name:24s} {path.stat().st_size / 1024:8.1f} KB")


if __name__ == "__main__":
    main()
