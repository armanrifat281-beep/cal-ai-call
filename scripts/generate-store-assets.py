#!/usr/bin/env python3
"""Generate the two images Google Play requires for a listing.

Play Console asks for a 512x512 app icon and a 1024x500 feature graphic,
and refuses the listing without them. Both are drawn from the same mark as
the app icon, by the same rules: flat colour, no gradient, no glow, no
decoration, and nothing important near an edge, because the feature
graphic is cropped differently on different surfaces.

Run from the project root:  python3 scripts/generate-store-assets.py
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

brand = import_module('generate-brand-icons')

BLACK = brand.BLACK
LIME = brand.LIME
MUTED = (0xA1, 0xA1, 0xA1, 255)
WHITE = (0xFF, 0xFF, 0xFF, 255)

FONT = '/System/Library/Fonts/SFNS.ttf'

NAME = 'FoodLens AI'
# What the app does, in the app's own terms. No claim it cannot keep: it
# estimates, and every figure it shows records where it came from.
TAGLINE = 'Photograph a meal. See what is in it.'


def play_icon() -> Image.Image:
    """512x512, full bleed, no alpha - Play rejects an icon with one."""
    return brand.render(512, int(512 * brand.FULL_AXIS / 1024), LIME, BLACK, opaque=True)


def feature_graphic() -> Image.Image:
    """1024x500. Centred, with wide margins: the edges get cropped."""
    W, H = 1024, 500
    canvas = Image.new('RGB', (W, H), BLACK[:3])

    mark_box = 210
    mark = brand.render(mark_box, int(mark_box * 0.88), LIME)
    name_font = ImageFont.truetype(FONT, 86)
    tag_font = ImageFont.truetype(FONT, 34)

    draw = ImageDraw.Draw(canvas)
    name_w = draw.textbbox((0, 0), NAME, font=name_font)[2]
    tag_w = draw.textbbox((0, 0), TAGLINE, font=tag_font)[2]

    gap = 36
    block_w = mark_box + gap + max(name_w, tag_w)
    x = (W - block_w) // 2
    mid = H // 2

    canvas.paste(mark, (x, mid - mark_box // 2), mark)

    text_x = x + mark_box + gap
    draw.text((text_x, mid - 58), NAME, font=name_font, fill=WHITE[:3])
    draw.text((text_x, mid + 34), TAGLINE, font=tag_font, fill=MUTED[:3])

    return canvas


def main() -> None:
    out = Path('store')
    out.mkdir(exist_ok=True)
    for name, image in [
        ('play-icon-512.png', play_icon()),
        ('play-feature-graphic-1024x500.png', feature_graphic()),
    ]:
        path = out / name
        image.save(path)
        print('wrote %-44s %s %s' % (path, image.size, image.mode))


if __name__ == '__main__':
    main()
