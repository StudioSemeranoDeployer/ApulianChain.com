"""
Generate responsive WebP versions of the 30 gallery photos referenced in
index.html. The source JPEGs stay untouched.

Naming scheme used by the frontend helper optimizedImage():
  img/opt/gallery/2026-DSC_8429-600.webp
  img/opt/gallery/2026-DSC_8429-1200.webp
  img/opt/gallery/2026-DSC_8429-1800.webp
  img/opt/gallery/2025-DSC_0078-600.webp
  ...
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "opt" / "gallery"
WIDTHS = (600, 1200, 1800)
QUALITY = {600: 76, 1200: 80, 1800: 82}


def gallery_urls() -> list[str]:
    text = (ROOT / "index.html").read_text(encoding="utf-8")
    start = text.index("const APULIAN_GALLERY_CONFIG")
    end = text.index("function initGallery")
    return re.findall(r'url:\s*"([^"]+)"', text[start:end])


def output_name(url: str, width: int) -> str:
    file = Path(url).name
    stem = Path(file).stem
    if "01-08-2026" in url:
        prefix = "2026"
    elif "30-08-2025" in url:
        prefix = "2025"
    else:
        prefix = "photo"
    return f"{prefix}-{stem}-{width}.webp"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    urls = gallery_urls()
    print(f"gallery photos: {len(urls)}")
    for index, url in enumerate(urls, 1):
        source = ROOT / url.lstrip("./")
        if not source.exists():
            print(f"  missing: {url}")
            continue
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            for width in WIDTHS:
                if image.width <= width:
                    resized = image.copy()
                else:
                    height = round(image.height * width / image.width)
                    resized = image.resize((width, height), Image.LANCZOS)
                resized.save(
                    OUT / output_name(url, width),
                    "WEBP",
                    quality=QUALITY[width],
                    method=5,
                )
        print(f"  [{index:02d}/{len(urls)}] {Path(url).name}")
    total = sum(path.stat().st_size for path in OUT.glob("*.webp"))
    print(f"written: {len(list(OUT.glob('*.webp')))} files, {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
