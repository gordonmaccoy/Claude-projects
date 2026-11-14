#!/usr/bin/env python3
"""Regenerate Examio's animated avatar GIFs from the bundled, approved WebPs.

From exam-monitor: python3 scripts/animate-game-avatars.py  (requires Pillow).
Each authored rectangle is an open eye's center and radii at a 150px design
scale. The blink folds original pixels inward rather than painting over eyes.
"""
from math import cos, pi, sin
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "game-avatars"
DESIGN = 150
DRAW = 216
OUTPUT = 144
BG = (253, 253, 253)
EYES = [
    [(64,55,14,10),(98,52,14,10)], [(61,71,14,12)],
    [(60,58,11,9),(87,54,12,10)], [(51,41,13,12),(88,40,14,12)],
    [(69,56,20,19)], [(57,50,12,11),(83,48,12,11)],
    [(62,59,12,12),(92,57,12,12)], [(64,59,13,11),(93,57,13,11)],
    [(65,54,12,11),(92,52,11,11)], [(61,56,11,13),(88,53,11,11)],
    [(62,64,13,12),(90,61,13,13)], [(59,62,12,13),(91,57,11,13)],
    [(62,61,12,13),(88,59,12,13)], [(56,57,11,10),(80,54,10,10)],
    [(62,54,12,11),(91,53,12,11)], [(64,58,12,12),(90,56,12,11)],
    [(61,59,10,10),(83,55,11,10)], [(62,55,13,10)],
    [(64,54,12,12),(93,52,11,12)], [(61,56,12,11),(89,50,11,12)],
    [(66,54,10,8),(95,52,10,8)], [(74,49,11,10),(98,45,10,9)],
    [(62,68,11,12),(87,65,11,11)], [(60,57,13,13),(90,54,12,13)],
    [(60,54,13,10),(91,52,11,11)], [(58,58,12,9),(83,55,12,9)],
    [(67,55,12,12)], [(64,53,13,14),(93,52,13,15)],
    [(51,50,12,10),(75,45,12,11)], [(78,31,11,11),(110,30,11,11)],
    [(64,55,12,12),(82,52,10,10)], [(66,51,12,10),(98,50,10,10)],
    [(61,51,12,11),(90,50,12,11)], [(65,49,12,10),(90,47,12,10)],
    [(61,57,12,13),(90,55,12,13)], [(55,61,11,11),(86,60,13,12)],
]


def blink(original, eyes, closure):
    if not closure:
        return original
    canvas = original.copy()
    for x, y, w, h in eyes:
        x, y, w, h = (round(k * DRAW / DESIGN) for k in (x, y, w, h))
        left, upper, right, lower = x - w, y - h, x + w, y + h
        band = max(3, round(h * .68))
        patch = original.crop((left, upper, right, lower))
        folded = patch.copy()
        # Deform the original drawing continuously, without alpha ghost pupils.
        # The outer 24% tapers the warp to zero against the surrounding face.
        for ix in range(2*w):
            envelope = min(1, min(ix, 2*w-1-ix) / max(1,w*.24))
            if not envelope:
                continue
            target_band = max(1, round(band * (1 - closure * envelope * .94)))
            for a, b, c, d in ((0, h-band, 0, h-target_band),
                               (h-band, h+band, h-target_band, h+target_band),
                               (h+band, 2*h, h+target_band, 2*h)):
                column = patch.crop((ix, a, ix+1, b)).resize((1, d-c), Image.Resampling.BICUBIC)
                folded.paste(column, (ix,c))
        canvas.paste(folded, (left,upper))
    return canvas


def frame(source, eyes, t, closure):
    sprite = blink(source, eyes, closure)
    zoom = .937 + .013 * sin(t * 2 * pi)
    wide = round(OUTPUT * (zoom + .006 * cos(t * 4 * pi)))
    high = round(OUTPUT * zoom)
    sprite = sprite.resize((wide, high), Image.Resampling.LANCZOS)
    # Matte padding follows the approved tile art's white tone.
    canvas = Image.new('RGB', (OUTPUT, OUTPUT), BG)
    dx = (OUTPUT - wide) // 2 + round(1.4 * sin(t * 2 * pi))
    dy = (OUTPUT - high) // 2 + round(2.3 * cos(t * 2 * pi))
    canvas.paste(sprite, (dx, dy))
    return canvas


def create(path, index, eyes):
    src = Image.open(path).convert('RGB').resize((DRAW, DRAW), Image.Resampling.LANCZOS)
    # Vary blink timing and idle starting phase so a room of avatars doesn't blink in unison.
    blink_at = 5 + (index * 7) % 8
    frames, duration = [], []
    for i in range(18):
        normal_t = (i/18 + (index * .137)) % 1
        closure = {blink_at-1:.48, blink_at:1, blink_at+1:.5}.get(i,0)
        frames.append(frame(src,eyes,normal_t,closure))
        duration.append(70 if closure else 160)
    # Shared compact palette, no dithering, for better interframe compression.
    palette_source = Image.new('RGB', (OUTPUT * 2, OUTPUT))
    palette_source.paste(frames[0], (0, 0))
    palette_source.paste(frames[blink_at], (OUTPUT, 0))
    palette = palette_source.quantize(colors=72, method=Image.Quantize.MEDIANCUT)
    frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    frames[0].save(path.with_suffix('.gif'), save_all=True, append_images=frames[1:],
                   duration=duration, loop=0, optimize=True, disposal=1)


if __name__ == '__main__':
    for i, eyes in enumerate(EYES):
        create(ROOT / f'avatar-{i+1:02d}.webp', i, eyes)
