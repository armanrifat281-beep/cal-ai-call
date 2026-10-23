#!/usr/bin/env python3
"""Generate every FoodLens AI brand asset from one shape.

The mark is a vesica - the lens two overlapping circles make - which reads
as a leaf and as a camera lens at once, named for what the app does. Its
midrib is a second, far slenderer vesica cut out of the blade as negative
space, so the whole mark is one silhouette built from one construction
rather than a drawing with a line laid over it. Nothing here is a gradient,
a glow or a letterform: at 32px those are the first things to turn to mud.

Run from the project root:  python3 scripts/generate-brand-icons.py

Requires Pillow. Everything is drawn at 4x and resampled down, which is what
keeps the midrib's points clean at icon sizes.
"""
from PIL import Image, ImageDraw

SS = 4

BLACK = (0x0A, 0x0A, 0x0A, 255)   # palette.ts dark background
LIME = (0xA3, 0xE6, 0x35, 255)    # palette.ts dark primary
GRASS = (0x17, 0x80, 0x3D, 255)   # palette.ts light primary
MINT = (0xEF, 0xF6, 0xF1, 255)    # palette.ts light background
WHITE = (0xFF, 0xFF, 0xFF, 255)

# Lime on mint measures 1.37:1, so light surfaces take the darker green.
# Lime on black is 13.13:1; grass on mint is 4.56:1.

TILT = 34.0        # degrees; off-axis enough to look grown, not tipped over
BLADE_RATIO = 0.58  # width as a fraction of length
RIB_LEN = 0.74     # midrib length as a fraction of the blade's
RIB_RATIO = 0.085
RIB_TILT = 9.0     # midrib runs slightly off the blade's axis


def _vesica(C, cx, cy, length, ratio):
    """Mask of a vesica `length` tall and `length * ratio` wide."""
    h, w = length / 2.0, length * ratio / 2.0
    R = (h * h + w * w) / (2.0 * w)
    d = R - w
    a = Image.new('L', (C, C), 0)
    b = Image.new('L', (C, C), 0)
    ImageDraw.Draw(a).ellipse([cx - d - R, cy - R, cx - d + R, cy + R], fill=255)
    ImageDraw.Draw(b).ellipse([cx + d - R, cy - R, cx + d + R, cy + R], fill=255)
    return Image.composite(a, Image.new('L', (C, C), 0), b)


def mark_mask(canvas, long_axis):
    C = canvas * SS
    L = long_axis * SS
    cx = cy = C / 2.0
    blade = _vesica(C, cx, cy, L, BLADE_RATIO)
    rib = _vesica(C, cx, cy, L * RIB_LEN, RIB_RATIO / RIB_LEN)
    rib = rib.rotate(RIB_TILT, resample=Image.BICUBIC, center=(cx, cy))
    mark = Image.composite(Image.new('L', (C, C), 0), blade, rib)
    mark = mark.rotate(TILT, resample=Image.BICUBIC, center=(cx, cy))
    return mark.resize((canvas, canvas), Image.LANCZOS)


def render(canvas, long_axis, fg, bg=None, opaque=False):
    m = mark_mask(canvas, long_axis)
    base = Image.new('RGBA', (canvas, canvas), bg if bg else (0, 0, 0, 0))
    base.paste(Image.new('RGBA', (canvas, canvas), fg), (0, 0), m)
    # iOS rejects an app icon carrying an alpha channel, and a square icon is
    # correct besides: every platform applies its own mask, so corners baked
    # into the file get rounded twice.
    return base.convert('RGB') if opaque else base


# An Android adaptive icon's outer 1024 maps to 108dp, of which only the
# centre 72dp is guaranteed to survive the launcher's mask - a radius of
# 341px. The foreground keeps its tip at 290px to stay clear of it.
ADAPTIVE_AXIS = 580
FULL_AXIS = 660
SPLASH_AXIS = 440


def main():
    out = []
    out.append(('assets/icon.png', render(1024, FULL_AXIS, LIME, BLACK, opaque=True)))
    out.append(('assets/android-icon-foreground.png', render(1024, ADAPTIVE_AXIS, LIME)))
    out.append(('assets/android-icon-background.png',
                Image.new('RGBA', (1024, 1024), BLACK)))
    out.append(('assets/android-icon-monochrome.png', render(1024, ADAPTIVE_AXIS, WHITE)))
    out.append(('assets/favicon.png', render(64, int(64 * FULL_AXIS / 1024), LIME, BLACK, opaque=True)))
    out.append(('assets/splash-icon.png', render(512, SPLASH_AXIS, GRASS)))
    out.append(('assets/splash-icon-dark.png', render(512, SPLASH_AXIS, LIME)))
    for path, im in out:
        im.save(path)
        print('wrote %-40s %s %s' % (path, im.size, im.mode))


if __name__ == '__main__':
    main()
