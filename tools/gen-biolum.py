#!/usr/bin/env python3
"""Generates the "Bioluminescent Deep" theme textures (contents/themes/biolum/images/*.png).

Everything is drawn procedurally (PIL + numpy, no network): silhouettes are rasterised
at 4x supersampling, rim lights are morphological edges, and the soft glow halos are
gaussian blurs baked into the PNG alpha channel, so the QML side needs no runtime blur.

Units: shapes are described in "u" (1 u == 1 * entity size px when the texture is shown
1:1; a sprite is displayed at size_u * entity.size px). ppu = texels per u.
Usage:  python3 tools/gen-biolum.py [outdir]
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'contents', 'themes', 'biolum', 'images')
os.makedirs(OUT, exist_ok=True)


def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


def blur(a, s):
    """separable gaussian (sigma in texels) on a 2D float array"""
    if s < 0.05:
        return a
    r = int(3 * s + 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    k /= k.sum()
    p = np.pad(a, ((0, 0), (r, r)))
    o = sum(k[i] * p[:, i:i + a.shape[1]] for i in range(2 * r + 1))
    p = np.pad(o, ((r, r), (0, 0)))
    return sum(k[i] * p[i:i + a.shape[0], :] for i in range(2 * r + 1))


def rot(pts, c, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(c[0] + (x - c[0]) * ca - (y - c[1]) * sa, c[1] + (x - c[0]) * sa + (y - c[1]) * ca) for x, y in pts]


def spline(pts, closed=True, n=14):
    """Catmull-Rom through pts -> dense polyline"""
    out = []
    N = len(pts)
    for i in range(N if closed else N - 1):
        p0, p1, p2, p3 = (pts[(i - 1) % N], pts[i % N], pts[(i + 1) % N], pts[(i + 2) % N]) if closed else \
            (pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, N - 1)])
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
                                    (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    if not closed:
        out.append(pts[-1])
    return out


class Mask:
    def __init__(self, cv, im):
        self.cv, self.im = cv, im

    @property
    def f(self):
        a = np.asarray(self.im, dtype=np.float32) / 255.0
        s = self.cv.ss
        return a.reshape(self.cv.H, s, self.cv.W, s).mean(axis=(1, 3))

    def erode(self, r_u):
        k = max(1, int(round(r_u * self.cv.ppu * self.cv.ss))) * 2 + 1
        return Mask(self.cv, self.im.filter(ImageFilter.MinFilter(k)))


class Cv:
    def __init__(self, wu, hu, ppu, ss=4):
        self.wu, self.hu, self.ppu, self.ss = wu, hu, ppu, ss
        self.W, self.H = int(round(wu * ppu)), int(round(hu * ppu))
        self.rgb = np.zeros((self.H, self.W, 3), np.float32)   # premultiplied
        self.a = np.zeros((self.H, self.W), np.float32)
        ys, xs = np.mgrid[0:self.H, 0:self.W]
        self.X = (xs + 0.5) / ppu - wu / 2      # u coordinates of each texel
        self.Y = (ys + 0.5) / ppu - hu / 2

    def pt(self, x, y):
        k = self.ppu * self.ss
        return ((x + self.wu / 2) * k, (y + self.hu / 2) * k)

    def blank(self):
        return Image.new('L', (self.W * self.ss, self.H * self.ss), 0)

    def poly(self, *polys, val=255):
        im = self.blank()
        d = ImageDraw.Draw(im)
        for p in polys:
            d.polygon([self.pt(*q) for q in p], fill=val)
        return Mask(self, im)

    def ell(self, cx, cy, rx, ry, ang=0.0, val=255, n=48):
        pts = [(cx + rx * math.cos(2 * math.pi * i / n) * math.cos(ang) - ry * math.sin(2 * math.pi * i / n) * math.sin(ang),
                cy + rx * math.cos(2 * math.pi * i / n) * math.sin(ang) + ry * math.sin(2 * math.pi * i / n) * math.cos(ang)) for i in range(n)]
        return self.poly(pts, val=val)

    def strokes(self, polylines, width_u, val=255):
        """polylines: list of point lists; width in u (round joins)"""
        im = self.blank()
        d = ImageDraw.Draw(im)
        w = max(1, int(round(width_u * self.ppu * self.ss)))
        for pl in polylines:
            pp = [self.pt(*q) for q in pl]
            d.line(pp, fill=val, width=w, joint='curve')
            for q in pp[::max(1, len(pp) // 40)] + [pp[0], pp[-1]]:   # round the caps
                d.ellipse([q[0] - w / 2, q[1] - w / 2, q[0] + w / 2, q[1] + w / 2], fill=val)
        return Mask(self, im)

    def over(self, color, alpha):
        al = np.clip(alpha, 0, 1)[..., None]
        self.rgb = np.asarray(color, np.float32) * al + self.rgb * (1 - al)
        self.a = al[..., 0] + self.a * (1 - al[..., 0])

    def vgrad(self, y0, y1, v0, v1):
        t = np.clip((self.Y - y0) / (y1 - y0), 0, 1)
        return v0 + (v1 - v0) * t

    def taper(self, width_u):
        """fade everything to 0 towards the canvas border so a tight canvas shows no clipped glow"""
        d = np.minimum(np.minimum(self.X + self.wu / 2, self.wu / 2 - self.X), np.minimum(self.Y + self.hu / 2, self.hu / 2 - self.Y))
        t = np.clip(d / width_u, 0, 1)
        t = t * t * (3 - 2 * t)
        self.rgb *= t[..., None]
        self.a *= t

    def save(self, name):
        a = np.clip(self.a, 0, 1)
        straight = np.where(a[..., None] > 1e-4, self.rgb / np.maximum(a[..., None], 1e-4), 0)
        arr = np.dstack([np.clip(straight, 0, 1) * 255, a * 255]).round().astype(np.uint8)
        Image.fromarray(arr, 'RGBA').save(os.path.join(OUT, name), optimize=True)


def mix(c1, c2, t):
    return c1 * (1 - t) + c2 * t


# ---------------------------------------------------------------- FISH
FISH_COLORS = {          # key: (neon hue, glow hue)
    'cyan':    '#1fe3ff',
    'magenta': '#ff44b4',
    'lime':    '#a8ff3a',
    'amber':   '#ffb41f',
    'violet':  '#a46bff',
    'stress':  '#ff3b24',    # classic #FF3333 overlay: angry red-orange
    'alarm':   '#ff0f2a',    # >1.2: base
    'flash':   '#ff8a2e',    # >1.2: pulse partner (hot white-pink)
}
FISH_TAIL = [0.0, 0.34, -0.34]      # tail angle (rad) of frames 0,1,2


def fish(key, frame, small=False):
    c = rgb(FISH_COLORS[key])
    cv = Cv(10, 8, 4)
    ang = FISH_TAIL[frame]
    # profile (faces right): spindle body, forked tail, dorsal + pectoral fins
    top, bot = [], []
    for i in range(41):
        t = i / 40
        x = -2.0 + 5.7 * t
        h = 0.40 * (1 - t) ** 1.5 + 1.62 * math.sin(math.pi * min(1, t ** 0.72)) ** 0.8
        h *= 1 - 0.30 * t ** 6
        top.append((x, -h))
        bot.append((x, h * 0.92))
    body_pts = top + bot[::-1]
    tail_pts = rot([(-1.85, -0.34), (-3.7, -1.55), (-3.15, 0.0), (-3.7, 1.55), (-1.85, 0.34)], (-2.0, 0), ang)
    dors = [(1.05, -1.45), (-0.2, -2.45), (-1.0, -1.35)]
    pect = [(0.75, 1.15), (-0.35, 2.0), (-0.55, 1.1)]
    body = cv.poly(body_pts)
    fins = cv.poly(tail_pts, dors, pect)
    sil_im = cv.poly(body_pts, tail_pts, dors, pect)
    sil, bodyf, finf = sil_im.f, body.f, fins.f
    rim = np.clip(sil - sil_im.erode(0.26).f, 0, 1)
    rim_body = np.clip(bodyf - body.erode(0.26).f, 0, 1)
    lit = cv.vgrad(-2.0, 2.0, 1.0, 0.42)                   # lit from above
    # halo
    cv.over(c, np.clip(blur(sil * 0.7 + rim * 1.1, 3.4), 0, 1) * 0.62)
    cv.over(c, np.clip(blur(sil * 0.5 + rim * 1.2, 1.1), 0, 1) * 0.55)
    # dark body with a faint luminous core, translucent glowing fins
    cv.over(c * 0.09, sil * 0.95)
    core = blur(bodyf, 2.4) * bodyf
    cv.over(c * 0.85, core * 0.13)
    cv.over(c, finf * (1 - bodyf) * 0.30)
    # rim light
    cv.over(mix(c, np.ones(3, np.float32), 0.18), np.clip(rim * lit * 0.95 + rim * 0.18, 0, 1))
    # photophore row on the belly
    ph = None
    for px, rr in ((-1.3, 0.09), (-0.4, 0.11), (0.5, 0.12), (1.4, 0.10)):
        m = cv.ell(px, 1.12 - 0.07 * (px - 0.3) ** 2 * 0.5, rr, rr).f
        ph = m if ph is None else np.maximum(ph, m)
    cv.over(c, np.clip(blur(ph, 2.0), 0, 1) * 0.85)
    cv.over(mix(c, np.ones(3, np.float32), 0.75), ph)
    # eye
    eye = cv.ell(2.35, -0.38, 0.26, 0.26).f
    cv.over(mix(c, np.ones(3, np.float32), 0.6), np.clip(blur(eye, 2.0), 0, 1) * 0.8)
    cv.over(np.ones(3, np.float32), eye)
    cv.taper(1.3)
    cv.save('fish-%s-%d.png' % (key, frame))


# ---------------------------------------------------------------- ORCA (faces LEFT: matches the classic flip convention)
def orca():
    cv = Cv(17, 11, 6)
    up = [(-5.6, 0.45), (-4.9, -0.75), (-3.6, -1.55), (-2.1, -2.0), (-0.9, -2.1), (-0.15, -3.9), (0.55, -2.15), (2.0, -1.8), (3.5, -1.15),
          (4.6, -0.55), (5.0, -0.35)]
    fluke = [(5.0, -0.35), (6.2, -1.75), (5.75, 0.05), (6.2, 1.75), (5.0, 0.35)]
    lo = [(4.6, 0.6), (3.2, 1.25), (1.7, 1.85), (0.2, 2.1), (-0.8, 2.15), (-0.9, 3.3), (-2.1, 2.2), (-2.9, 1.85), (-4.3, 1.2), (-5.35, 0.85)]
    outline = spline([p for p in up] + lo[0:], closed=False, n=10)
    outline = outline + [(-5.6, 0.45)]
    sil_im = cv.poly(outline, fluke)
    sil = sil_im.f
    rim = np.clip(sil - sil_im.erode(0.12).f, 0, 1)
    lit = cv.vgrad(-3.5, 2.0, 1.0, 0.0) ** 1.1
    cold = rgb('#7fb6ff')
    # faint cold halo, dark body (darker than the water => silhouette)
    cv.over(rgb('#3a78d8'), np.clip(blur(sil, 3.4), 0, 1) * 0.16)
    cv.over(rgb('#030710'), sil * 0.97)
    # white patches (very faint, cool): eye patch, throat/belly, saddle
    eyep = cv.ell(-3.95, -0.55, 0.62, 0.26, ang=0.35).f
    belly = cv.poly(spline([(-4.9, 0.95), (-3.0, 0.55), (-1.0, 0.95), (1.2, 1.35), (2.4, 1.1), (1.2, 1.85), (-1.0, 2.0), (-3.3, 1.5)], n=8)).f * sil
    saddle = cv.poly(spline([(0.9, -1.8), (2.6, -1.35), (1.7, -0.7), (0.7, -1.0)], n=8)).f * sil
    pat = np.clip(eyep * 1.6 + belly * 0.75 + saddle * 0.8, 0, 1)
    cv.over(rgb('#c9ddff'), blur(pat, 0.8) * 0.17 * sil)
    # rim light revealing the back
    cv.over(cold, np.clip(rim * lit * 0.70 + rim * 0.08, 0, 1))
    cv.over(cold, np.clip(blur(rim * lit, 2.0), 0, 1) * 0.28 * sil)
    # eye glint
    e = cv.ell(-4.45, -0.3, 0.1, 0.1).f
    cv.over(rgb('#d8ecff'), e * 0.8)
    cv.save('orca.png')


# ---------------------------------------------------------------- ANGLER (faces right, lure above the snout)
LURE = (3.7, -4.6)       # centre of the lure bulb, u from the sprite centre


def angler():
    cv = Cv(16, 13, 6)
    ys = 0.7        # body centre offset
    up = [(-5.3, ys - 1.1), (-4.2, ys - 1.35), (-2.6, ys - 2.0), (-0.6, ys - 2.9), (1.6, ys - 2.7), (3.1, ys - 1.7), (4.3, ys - 0.6)]
    lo = [(4.3, ys + 1.2), (3.0, ys + 2.2), (1.2, ys + 3.0), (-1.0, ys + 3.0), (-2.8, ys + 2.2), (-4.2, ys + 1.2), (-5.2, ys + 1.4)]
    tail = [(-4.4, ys + 0.1), (-6.2, ys - 1.5), (-5.7, ys + 0.1), (-6.2, ys + 1.7)]
    pts = spline(up + [(4.3, ys + 0.2)] + lo, n=10)
    body = cv.poly(pts)
    tailm = cv.poly(tail)
    sil_im = cv.poly(pts, tail)
    sil = sil_im.f
    rim = np.clip(sil - sil_im.erode(0.14).f, 0, 1)
    lit = cv.vgrad(-3.0, 3.0, 1.0, 0.25)
    # illicium (stalk) + bulb
    stalk = spline([(1.2, ys - 2.6), (1.9, ys - 4.6), (2.9, ys - 5.2), (3.5, ys - 4.9)], closed=False, n=10)
    # nearly invisible body: just a trace of violet
    cv.over(rgb('#5a3fb0'), np.clip(blur(sil, 3.0), 0, 1) * 0.07)
    cv.over(rgb('#06030e'), sil * 0.95)
    cv.over(rgb('#7c5cff'), np.clip(rim * lit * 0.34, 0, 1))
    # mouth: dark slit + needle teeth
    mouth = cv.strokes([[(4.25, ys + 0.1), (3.0, ys + 0.85), (1.2, ys + 1.15), (-0.3, ys + 0.95)]], 0.16).f * sil
    cv.over(rgb('#000000'), mouth * 0.9)
    teeth = np.zeros((cv.H, cv.W), np.float32)
    for i in range(7):
        tx = 3.8 - i * 0.52
        ty = ys + 0.12 + 0.68 * (1 - (i / 7)) ** 0.0 * (0.2 + 0.1 * i)
        teeth = np.maximum(teeth, cv.poly([(tx, ty - 0.05), (tx - 0.14, ty + 0.46), (tx - 0.3, ty - 0.02)]).f)
    cv.over(rgb('#d9f0ff'), teeth * 0.42)
    # faint speckles along the flank
    sp = np.zeros((cv.H, cv.W), np.float32)
    for i, (x, y) in enumerate([(-3.0, 0.5), (-2.2, 1.3), (-1.4, 0.4), (-0.5, 1.1), (0.4, 0.2), (-3.9, 1.1), (-2.8, 2.0)]):
        sp = np.maximum(sp, cv.ell(x, ys + y, 0.07, 0.07).f)
    cv.over(rgb('#52ffd8'), blur(sp, 1.4) * 0.5 * sil)
    cv.over(rgb('#9dfff0'), sp * 0.7)
    # stalk + dim bulb
    st = cv.strokes([stalk], 0.10).f
    cv.over(rgb('#8a78e8'), st * 0.5)
    # eye (a cold green-white glint, the other thing you can see)
    e = cv.ell(2.2, ys - 0.95, 0.5, 0.5).f
    cv.over(rgb('#b6ff7a'), np.clip(blur(e, 4.0), 0, 1) * 0.8)
    cv.over(rgb('#e9ffc4'), e)
    cv.over(rgb('#0a1a00'), cv.ell(2.3, ys - 0.95, 0.15, 0.2).f * 0.9)
    cv.save('angler.png')
    # the pulsing lure: separate overlay texture, 8x8 u, centred on the bulb
    lv = Cv(8, 8, 6)
    r2 = np.hypot(lv.X, lv.Y)
    halo = np.exp(-(r2 / 2.1) ** 2) * 0.5 + np.exp(-(r2 / 0.8) ** 2) * 0.6
    lv.over(rgb('#ff9a1e'), np.clip(halo, 0, 1) * 0.85)
    lv.over(rgb('#ffe28a'), np.clip(np.exp(-(r2 / 0.6) ** 2) * 1.1, 0, 1))
    lv.over(rgb('#fffbe8'), np.clip(np.exp(-(r2 / 0.28) ** 2) * 1.4, 0, 1))
    lv.save('angler-lure.png')


# ---------------------------------------------------------------- JELLY
JELLY_HUES = {'aqua': '#4be8ff', 'rose': '#ff6fd2', 'lilac': '#9d86ff'}


def jelly(hue):
    c = rgb(JELLY_HUES[hue])
    # bell: 12 x 8 u, dome centred horizontally, rim at y=+1.7
    cv = Cv(12, 8, 6)
    pts = []
    for i in range(0, 61):
        t = math.pi * i / 60
        pts.append((-3.2 * math.cos(t), 1.7 - 3.0 * math.sin(t) ** 0.85))
    pts += [(2.95, 1.9), (2.3, 1.55), (1.5, 2.0), (0.7, 1.55), (0, 2.0), (-0.7, 1.55), (-1.5, 2.0), (-2.3, 1.55), (-2.95, 1.9)]
    bell = cv.poly(pts)
    m = bell.f
    rim = np.clip(m - bell.erode(0.14).f, 0, 1)
    inner = m * (0.20 + 0.45 * np.clip(cv.vgrad(-1.4, 1.7, 0.0, 1.0), 0, 1) ** 1.5)
    cv.over(c, np.clip(blur(m, 5.0), 0, 1) * 0.62)
    cv.over(c * 0.9, np.clip(blur(m, 1.6), 0, 1) * 0.34)
    cv.over(c * 0.6, inner * 0.78)
    # radial canals + a bright gonad ring
    canals = cv.strokes([[(0, -1.1), (0, 1.6)], [(0, -1.1), (-1.6, 1.4)], [(0, -1.1), (1.6, 1.4)],
                         [(0, -1.2), (-2.5, 0.9)], [(0, -1.2), (2.5, 0.9)]], 0.05).f * m
    cv.over(mix(c, np.ones(3, np.float32), 0.5), canals * 0.28)
    ring = cv.ell(0, -0.1, 1.0, 0.55).f - cv.ell(0, -0.1, 0.78, 0.36).f
    ring = np.clip(ring, 0, 1)
    cv.over(mix(c, np.ones(3, np.float32), 0.55), np.clip(blur(ring, 2.0), 0, 1) * 0.5)
    cv.over(mix(c, np.ones(3, np.float32), 0.7), ring * 0.7 * m)
    cv.over(mix(c, np.ones(3, np.float32), 0.35), rim * cv.vgrad(-1.4, 1.7, 1.0, 0.6) * 0.95)
    cv.save('jelly-bell-%s.png' % hue)
    # tentacles + oral arms: 12 x 11 u, hang from y=-5.0 (top) -> attaches to the bell rim
    tv = Cv(12, 11, 6)
    layers = np.zeros((tv.H, tv.W), np.float32)
    fil = []
    rng = np.random.RandomState(7)
    for i in range(9):
        x0 = -2.6 + i * 0.65
        ph = rng.uniform(0, 6.28)
        pl = [(x0 + 0.35 * math.sin(ph + y * 0.9) * (0.4 + y / 6.0) , -5.0 + y) for y in np.linspace(0, 8.2 - rng.uniform(0, 3.4), 40)]
        fil.append(pl)
    m_fil = np.zeros((tv.H, tv.W), np.float32)
    for pl in fil:
        # fade with length: draw in 4 segments of falling alpha
        n = len(pl)
        for s in range(4):
            seg = pl[s * (n // 4): min(n, (s + 1) * (n // 4) + 1)]
            if len(seg) < 2:
                continue
            m_fil = np.maximum(m_fil, tv.strokes([seg], 0.075).f * (0.85 - 0.18 * s))
    arms = []
    for k, x0 in enumerate((-1.1, 0.0, 1.1)):
        arms.append([(x0 + 0.5 * math.sin(k * 2.1 + y * 0.8) * (y / 5.0), -4.9 + y) for y in np.linspace(0, 4.6 + k % 2 * 0.8, 30)])
    m_arm = tv.strokes(arms, 0.30).f
    fade = tv.vgrad(-5.0, 4.0, 1.0, 0.0)
    tv.over(c, np.clip(blur(m_fil * fade + m_arm * 0.6 * fade, 2.4), 0, 1) * 0.6)
    tv.over(c * 0.8, np.clip(m_arm * 0.38 * fade, 0, 1))
    tv.over(mix(c, np.ones(3, np.float32), 0.35), m_fil * fade * 0.8)
    tv.save('jelly-tent-%s.png' % hue)


# ---------------------------------------------------------------- WORM (food): a faint glowing wriggle
def worm():
    cv = Cv(6, 7, 6)
    pl = [(0.7 * math.sin(y * 1.6), y) for y in np.linspace(-1.9, 1.9, 24)]
    core = cv.strokes([pl], 0.42).f
    cv.over(rgb('#ff8a5c'), np.clip(blur(core, 4.2), 0, 1) * 0.85)
    cv.over(rgb('#ffb08a'), core * 0.9)
    thin = cv.strokes([pl], 0.14).f
    cv.over(rgb('#fff0dc'), thin * 0.95)
    cv.save('worm.png')


# ---------------------------------------------------------------- BUBBLE
def bubble():
    cv = Cv(5, 5, 8)
    r = np.hypot(cv.X, cv.Y)
    disc = cv.ell(0, 0, 1.55, 1.55).f
    ring = np.clip(disc - cv.ell(0, 0, 1.37, 1.37).f, 0, 1)
    lit = np.clip(0.55 + 0.45 * (-cv.X - cv.Y) / 2.0, 0.25, 1)
    c = rgb('#bfeaff')
    cv.over(c, np.clip(blur(ring, 3.0), 0, 1) * 0.22)
    cv.over(c * 0.7, disc * 0.07)
    cv.over(c, ring * lit * 0.85)
    # specular highlight (top-left) and a faint counter-glint (bottom-right)
    cv.over(np.ones(3, np.float32), cv.ell(-0.62, -0.66, 0.24, 0.16, ang=-0.7).f * 0.95)
    cv.over(c, cv.ell(0.65, 0.7, 0.2, 0.09, ang=-0.7).f * 0.5)
    cv.save('bubble.png')


# ---------------------------------------------------------------- AMBIENT textures
def ambient():
    for nm, px, a in (('snow-s', 14, 1.0), ('snow-m', 28, 1.0)):
        cv = Cv(px / 4, px / 4, 4)
        r = np.hypot(cv.X, cv.Y) / (px / 8)
        cv.over(rgb('#bfe6ff'), np.clip(np.exp(-(r * 2.2) ** 2) * 1.2 + np.exp(-(r * 1.1) ** 2) * 0.22, 0, 1) * a)
        cv.taper(px / 12.0)
        cv.save(nm + '.png')
    cv = Cv(16, 16, 4)                           # soft out-of-focus bokeh
    r = np.hypot(cv.X, cv.Y) / 8
    fall = np.clip((1.0 - r) / 0.18, 0, 1)
    cv.over(rgb('#9fd8ff'), np.clip(np.clip(1.15 - r, 0, 1) ** 0.6 * 0.30 + np.exp(-((r - 0.82) / 0.1) ** 2) * 0.25, 0, 1) * fall)
    cv.save('snow-bokeh.png')
    for key, col in FISH_COLORS.items():          # sparkle glints in each fish hue
        if key in ('stress', 'alarm', 'flash'):
            continue
        cv = Cv(8, 8, 6)
        r = np.hypot(cv.X, cv.Y)
        c = rgb(col)
        star = np.exp(-(np.abs(cv.X) / 0.07) ** 1) * np.exp(-(np.abs(cv.Y) / 1.2) ** 2) + np.exp(-(np.abs(cv.Y) / 0.07) ** 1) * np.exp(-(np.abs(cv.X) / 1.2) ** 2)
        cv.over(c, np.clip(np.exp(-(r / 1.3) ** 2) * 0.8, 0, 1))
        cv.over(mix(c, np.ones(3, np.float32), 0.5), np.clip(star * 0.95, 0, 1))
        cv.over(np.ones(3, np.float32), np.clip(np.exp(-(r / 0.26) ** 2), 0, 1))
        cv.save('spark-%s.png' % key)
    # light shaft from far above: slanted, bright at the top, gone by ~75% of the height
    W, H = 160, 540
    ys, xs = np.mgrid[0:H, 0:W]
    cx = W / 2 - (ys / H - 0.5) * 70
    d = (xs - cx) / (W * 0.19)
    prof = np.exp(-d ** 2) * (np.clip(1 - ys / (H * 0.8), 0, 1) ** 1.5)
    arr = np.zeros((H, W, 4), np.float32)
    arr[..., :3] = rgb('#8fd6ff')
    arr[..., 3] = np.clip(prof, 0, 1)
    Image.fromarray((arr * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'shaft.png'), optimize=True)
    # vignette (stretched over the screen)
    W, H = 192, 108
    ys, xs = np.mgrid[0:H, 0:W]
    nx, ny = (xs + 0.5) / W * 2 - 1, (ys + 0.5) / H * 2 - 1
    v = np.clip((np.hypot(nx * 0.95, ny * 1.05) - 0.45) / 0.85, 0, 1) ** 1.6
    arr = np.zeros((H, W, 4), np.float32)
    arr[..., :3] = rgb('#000208')
    arr[..., 3] = v * 0.62
    Image.fromarray((arr * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'vignette.png'), optimize=True)
    # caustic web: cellular light network, seamless in x, faded out towards the bottom
    rng = np.random.RandomState(3)
    NW, NH = 512, 320
    pts = rng.rand(30, 2) * [NW, NH]
    ys, xs = np.mgrid[0:NH, 0:NW]
    dmin = np.full((NH, NW), 1e9)
    d2 = np.full((NH, NW), 1e9)
    wx = xs + 10 * np.sin(2 * math.pi * (xs * 3 / NW + ys / 110.0)) + 6 * np.sin(2 * math.pi * (xs * 7 / NW - ys / 60.0))
    wy = ys + 9 * np.sin(2 * math.pi * (xs * 4 / NW + ys / 90.0)) + 5 * np.sin(2 * math.pi * (xs * 9 / NW + ys / 47.0))
    for ox in (-NW, 0, NW):
        for px_, py_ in pts:
            dd = np.hypot(wx - (px_ + ox), wy - py_)
            d2 = np.minimum(d2, np.maximum(dd, dmin))
            dmin = np.minimum(dmin, dd)
    edge = np.clip(1 - (d2 - dmin) / 8.0, 0, 1) ** 2.0
    edge = blur(edge, 1.6)
    fade = np.clip(1 - ys / NH, 0, 1) ** 1.6
    arr = np.zeros((NH, NW, 4), np.float32)
    arr[..., :3] = rgb('#7fd8ff')
    arr[..., 3] = np.clip(edge * fade, 0, 1)
    Image.fromarray((arr * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'caustic.png'), optimize=True)


if __name__ == '__main__':
    for k in FISH_COLORS:
        for f in range(3):
            fish(k, f)
    orca()
    angler()
    for h in JELLY_HUES:
        jelly(h)
    worm()
    bubble()
    ambient()
    print('wrote %d files to %s' % (len(os.listdir(OUT)), OUT))
