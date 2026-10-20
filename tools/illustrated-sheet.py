#!/usr/bin/env python3
"""Sprite contact sheet for the illustrated theme: every texture enlarged on a neutral background.
Usage: python3 tools/illustrated-sheet.py <out.png>"""
import os, sys
from PIL import Image, ImageDraw
IMG = os.path.join(os.path.dirname(__file__), '..', 'contents', 'themes', 'illustrated', 'img')
out = sys.argv[1]
def load(n): return Image.open(os.path.join(IMG, n)).convert('RGBA')
BG = (74, 86, 98, 255)
W = 1920; H = 1080
sheet = Image.new('RGBA', (W, H), BG)
d = ImageDraw.Draw(sheet)
def paste(n, x, y, scale=1.0, label=None):
    im = load(n)
    if scale != 1.0: im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
    sheet.alpha_composite(im, (int(x), int(y)))
    d.text((x, y+im.height+4), label or n.replace('.png',''), fill=(225,232,238,255))
    return im.width, im.height
x = 30
for k in ['coral','apricot','lemon','teal','lilac','hot','alarm']:
    w,h = paste('fish-%s-144.png' % k, x, 30, 1.5, 'fish-'+k); x += w + 22
paste('orca-320.png', 30, 250, 1.4, 'orca')
paste('angler-220.png', 520, 250, 1.4, 'angler')
paste('glow-warm-64.png', 780, 330, 1.5, 'glow-warm'); paste('glow-white-64.png', 890, 330, 1.5, 'glow-white'); paste('glow-red-64.png', 1000, 330, 1.5, 'glow-red')
# jelly: tentacles then bell above
bw,bh = load('jelly-bell-160.png').size
for i,(s,x0) in enumerate([(1.4, 1130), (0.8, 1420)]):
    sheet.alpha_composite(load('jelly-tent-160.png').resize((int(160*s),int(160*s))), (x0, 250+int(bh*s*0.8)))
    sheet.alpha_composite(load('jelly-bell-160.png').resize((int(160*s), int(bh*s))), (x0, 250))
d.text((1130, 250+int(bh*1.4)+190), 'jelly bell + tentacles', fill=(225,232,238,255))
paste('worm-48.png', 1640, 250, 3, 'worm'); paste('bubble-48.png', 1800, 250, 1.8, 'bubble')
x = 30
for n in ['kelp1-120.png','kelp2-120.png','kelp3-120.png']:
    w,h = paste(n, x, 620, 1.0); x += w + 20
sf = load('seabed-far-1920.png').resize((960,150)); sheet.alpha_composite(sf, (400, 620)); d.text((400,772),'seabed-far',fill=(225,232,238,255))
sn = load('seabed-near-1920.png').resize((960,130)); sheet.alpha_composite(sn, (400, 800)); d.text((400,932),'seabed-near',fill=(225,232,238,255))
ray = load('ray-128.png').resize((64,256)); sheet.alpha_composite(ray, (1500, 620)); d.text((1500,880),'ray',fill=(225,232,238,255))
sheet.convert('RGB').save(out)
