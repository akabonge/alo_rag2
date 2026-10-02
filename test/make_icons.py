"""Generate AK icon assets with Pillow; no system font or network is needed.

The hand-drawn AK outlines use the 2D site's rounded dark square and teal colors.
Run from the repository root: python test/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'src'
BG, INK = '#0B0D12', '#0F766E'
A = [(12, 44), (20, 20), (25, 20), (33, 44), (27.5, 44), (26, 39), (19, 39), (17.5, 44)]
HOLE = [(20.3, 34.5), (22.5, 27), (24.7, 34.5)]
K = [(36, 20), (41, 20), (41, 29), (48, 20), (54, 20), (44.5, 32), (54, 44), (48, 44), (41, 35), (41, 44), (36, 44)]


def points(shape):
    return ' '.join(f'{x},{y}' for x, y in shape)


svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="{BG}"/>
  <polygon points="{points(A)}" fill="{INK}"/>
  <polygon points="{points(HOLE)}" fill="{BG}"/>
  <polygon points="{points(K)}" fill="{INK}"/>
</svg>
'''
(OUT / 'favicon.svg').write_text(svg, encoding='utf-8', newline='\n')


def render(size, apple=False):
    # Supersampling keeps the same vector geometry legible at small tab sizes.
    scale = 16
    im = Image.new('RGBA', (64 * scale, 64 * scale), BG if apple else (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=12 * scale, fill=BG)
    for shape, color in [(A, INK), (HOLE, BG), (K, INK)]:
        draw.polygon([(round(x * scale), round(y * scale)) for x, y in shape], fill=color)
    return im.resize((size, size), Image.Resampling.LANCZOS)


for size in (16, 32, 192):
    render(size).save(OUT / f'favicon-{size}x{size}.png')
render(180, apple=True).convert('RGB').save(OUT / 'apple-touch-icon.png')
render(256).save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('Generated SVG, multi-size ICO, 16/32/192 PNG and 180 Apple icon.')
