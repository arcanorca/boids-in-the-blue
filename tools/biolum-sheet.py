#!/usr/bin/env python3
"""Contact sheet of every biolum texture, enlarged on a neutral dark background.
Usage: python3 tools/biolum-sheet.py <out.png> [imagesdir]"""
import os, sys
from PIL import Image, ImageDraw
out = sys.argv[1]
d = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'contents', 'themes', 'biolum', 'images')
names = sorted(os.listdir(d))
groups = [
    ('fish (3 tail frames each)', [n for n in names if n.startswith('fish-')], 3.0),
    ('orca / angler (+lure overlay)', [n for n in names if n.startswith(('orca', 'angler'))], 2.0),
    ('jelly bells + tentacles', [n for n in names if n.startswith('jelly')], 2.0),
    ('worm / bubble / sparkle / snow', [n for n in names if n.startswith(('worm', 'bubble', 'spark', 'snow'))], 3.0),
]
W = 1800
BG = (18, 20, 28)
rows = []
y = 10
placed = []
for title, files, sc in groups:
    placed.append(('T', title, 10, y)); y += 22
    x, rh = 10, 0
    for f in files:
        im = Image.open(os.path.join(d, f)).convert('RGBA')
        im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
        if x + im.width > W - 10:
            x, y, rh = 10, y + rh + 22, 0
        placed.append(('I', f, x, y, im))
        x += im.width + 14; rh = max(rh, im.height)
        x += 0
    y += rh + 40
sheet = Image.new('RGBA', (W, y + 10), BG + (255,))
dr = ImageDraw.Draw(sheet)
for p in placed:
    if p[0] == 'T':
        dr.text((p[2], p[3]), p[1], fill=(200, 210, 230, 255))
    else:
        sheet.alpha_composite(p[4], (p[2], p[3]))
        dr.text((p[2], p[3] + p[4].height + 1), p[1].replace('.png', ''), fill=(120, 130, 150, 255))
sheet.convert('RGB').save(out)
print(sheet.size)
