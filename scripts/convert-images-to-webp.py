"""Convert bundled content images to WebP to reduce app size.

Run `python scripts/convert-images-to-webp.py`. Requires Pillow; never runs in
the app. WebP is used because `expo-image` decodes it on Android and iOS.

Two conversion strategies:

- Catalog artwork and the brand logo keep their alpha channel: the app draws
  them over white cards *and* over brand-tinted surfaces (`bg-brand/5` category
  chips, `bg-surface-muted` cart thumbnails), so flattening would show a box.
- Onboarding and auth illustrations are only ever drawn on the app's white
  background, so they are flattened onto white to drop the alpha channel.

Catalog photos (opaque JPEGs) are re-encoded as WebP. App icons and the splash
stay PNG (a platform requirement) and live under assets/icons, which is out of
scope. Originals and existing WebP files are preserved; this script never deletes
or overwrites them. Validate the result before changing application references.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTO_QUALITY = 85
LOGO_QUALITY = 92

KEEP_ALPHA = sorted(
    [
        *ROOT.glob("assets/images/catalog/*.png"),
        ROOT / "assets/branding/cemydi-logo-horizontal.png",
    ]
)
FLATTEN_ON_WHITE = sorted(
    [
        *ROOT.glob("assets/images/onboarding/*.png"),
        *ROOT.glob("assets/images/auth/*.png"),
    ]
)
OPAQUE_PHOTOS = sorted(ROOT.glob("assets/images/catalog/*.jpg"))


# Existing outputs and original sources are preserved.
def convert(source: Path, *, flatten: bool) -> tuple[int, int]:
    target = source.with_suffix(".webp")
    if target.exists():
        return source.stat().st_size, target.stat().st_size
    with Image.open(source) as original:
        has_alpha = "transparency" in original.info or original.mode in {"RGBA", "LA"}
        if flatten:
            base = Image.new("RGBA", original.size, "white")
            image = Image.alpha_composite(base, original.convert("RGBA")).convert("RGB")
        elif has_alpha:
            image = original.convert("RGBA")
        else:
            image = original.convert("RGB")
        quality = LOGO_QUALITY if source.name == "cemydi-logo-horizontal.png" else PHOTO_QUALITY
        image.save(target, format="WEBP", quality=quality, method=6)
    before, after = source.stat().st_size, target.stat().st_size
    return before, after


def main() -> None:
    sources = [*KEEP_ALPHA, *FLATTEN_ON_WHITE, *OPAQUE_PHOTOS]
    if not sources:
        print("No source images left to convert.")
        return
    total_before = 0
    total_after = 0
    for source in sources:
        flatten = source in FLATTEN_ON_WHITE
        before, after = convert(source, flatten=flatten)
        total_before += before
        total_after += after
        note = " (flattened on white)" if flatten else ""
        print(f"{source.relative_to(ROOT).as_posix()} -> {after // 1024} KB{note}")
    saved = 100 * (1 - total_after / total_before) if total_before else 0
    print(f"Total: {total_after // 1024} KB (was {total_before // 1024} KB, -{saved:.0f}%)")


if __name__ == "__main__":
    main()
