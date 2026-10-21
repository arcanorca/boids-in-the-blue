#!/usr/bin/env python3
# Generates the "terminal" theme's textures (contents/themes/terminal/img/*.png) and, optionally, a contact sheet.
#   python3 tools/gen-terminal-theme.py [--check] [--write] [--sheet <out.png>] [--scale N]
#
# Sprite pipeline: tools/terminal-img2ascii.py converts the Refined Pixel sprites (orca, fish, angler, jelly) to a
# DRAFT character grid by glyph-shape matching; the grids were then cleaned by hand and live in tools/terminal_art.py
# (right-facing text rows + tone rows). This script renders them with Terminus 8x16 (bitmap font; bold for the bright
# tone) at ONE cell size (8 x 16 texels, 1 texel = 1 device px at 1080p), adds a soft baked phosphor glow and an
# opaque water-colour background to the cells, and trims empty cell rows/columns. Left-facing art is produced by
# mirroring the CHARACTER GRID (glyphs swapped: ( <-> ), / <-> \, < <-> >, ...), never by mirroring pixels.
# Backdrop textures (water swell, waves, seabed, kelp, prompt, load bar, vignette + scanline overlay) are made here too.
#
# Colours are the palette sets of theme.js (PAL below; theme.js repeats them and the theme test compares).
# --check regenerates everything in memory and compares decoded pixels with the files on disk.
import argparse
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont  # noqa: E402


ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'contents', 'themes', 'terminal', 'img')
FONT_N = os.environ.get('TERMINUS_N', '/usr/share/fonts/misc/ter-u12n.otb')
FONT_B = os.environ.get('TERMINUS_B', '/usr/share/fonts/misc/ter-u12b.otb')

CW, CH = 6, 12                       # one text cell in texels (Terminus 6x12); 1 texel = 1 device px at 1080p
BG = (0x08, 0x12, 0x0b)              # the water colour: the only background of every box and of the sea
BG_HEX = '#08120b'
GLOW = 0.6                          # strength of the baked phosphor glow (share of the ink colour at the glyph)
BOLD_ALL = True                      # creatures use the bold weight (the strokes carry the body mass)
GLOW_R = 2.0                         # gaussian radius of the glow in texels

# ── palette sets: four tones each (b highlight, n normal, m mid, d dim) ──
PAL = {
    'g':  {'b': '#e0ffe9', 'n': '#6bf59b', 'm': '#3cc873', 'd': '#217f4a'},
    'n':  {'b': '#6bf59b', 'n': '#3cc873', 'm': '#217f4a', 'd': '#124c2d'},
    'a':  {'b': '#ffe0a0', 'n': '#ffb000', 'm': '#c47f00', 'd': '#7a4d00'},
    'an': {'b': '#ffb000', 'n': '#c47f00', 'm': '#7a4d00', 'd': '#4d3000'},
    'r':  {'b': '#ffb4a8', 'n': '#ff5040', 'm': '#c03024', 'd': '#7a1c14'},
    'rn': {'b': '#ff5040', 'n': '#c03024', 'm': '#7a1c14', 'd': '#4d1510'},
    'ri': {'ink': '#ffc8bc', 'fill': '#5e170f'},
}
FISH_SETS = ['g', 'n', 'a', 'an', 'r', 'rn', 'ri']
BASE_SETS = ['g', 'n']               # the backdrop and the other creatures: day and night only


def rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# ── fonts and glyph masks ────────────────────────────────────
_fonts = {}
_masks = {}


def _font(bold):
    if bold not in _fonts:
        _fonts[bold] = ImageFont.truetype(FONT_B if bold else FONT_N, CH)
    return _fonts[bold]


def mask_of(ch, bold=False):
    k = (ch, bold)
    if k not in _masks:
        im = Image.new('L', (CW, CH), 0)
        if ch != ' ':
            ImageDraw.Draw(im).text((0, 0), ch, font=_font(bold), fill=255)
        _masks[k] = im.point(lambda v: 255 if v >= 128 else 0)
    return _masks[k]


# ── character grids ──────────────────────────────────────────
MIRROR = {'`': "'", "'": '`', '<': '>', '>': '<', '(': ')', ')': '(', '/': '\\', '\\': '/', '{': '}', '}': '{',
          '[': ']', ']': '[', 'd': 'b', 'b': 'd', 'p': 'q', 'q': 'p'}
SAFE = set(" .,'`:;-_=+*#%@oO08|!/\\()[]{}<>~^\"xXvVwWAUYTHIMJ1lc$&FfLSs")   # glyphs that survive a mirror (or are swapped)


# default tone of a glyph when the art gives no tone row: fills are dim, highlights bright, the rest normal
AUTO_TONE = {'@': 'b', 'O': 'b', '*': 'b', ':': 'm', ';': 'm', '%': 'm', '#': 'd'}


EDGE_TONE = set('#%')


class Grid:
    """A sprite as characters + tones (one tone letter per character)."""

    def __init__(self, text, tone):
        w = max(len(t) for t in text)
        self.text = [t.ljust(w) for t in text]
        tone = list(tone) + [''] * (len(text) - len(tone))
        self.tone = []
        for y, (t, k) in enumerate(zip(self.text, tone)):
            row = ''
            for x in range(w):
                if x < len(k) and k[x] != ' ':
                    row += k[x]
                    continue
                c = t[x]
                tn = AUTO_TONE.get(c, 'n')
                if c in EDGE_TONE:       # fill glyphs on the silhouette are drawn in the normal tone: the outline reads by brightness
                    nb = [(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)]
                    if any(not (0 <= yy < len(self.text) and 0 <= xx < w) or self.text[yy][xx] == ' ' for yy, xx in nb):
                        tn = 'n'
                row += tn
            self.tone.append(row)

    @property
    def cols(self):
        return len(self.text[0])

    @property
    def rows(self):
        return len(self.text)

    def mirrored(self):
        return Grid([''.join(MIRROR.get(c, c) for c in reversed(t)) for t in self.text], [k[::-1] for k in self.tone])

    def trimmed(self):
        """Without empty cell rows and columns at the edges (the box covers only what it must)."""
        r0, r1 = 0, self.rows
        while r0 < r1 and not self.text[r0].strip():
            r0 += 1
        while r1 > r0 and not self.text[r1 - 1].strip():
            r1 -= 1
        c0, c1 = 0, self.cols
        while c0 < c1 and all(t[c0] == ' ' for t in self.text[r0:r1]):
            c0 += 1
        while c1 > c0 and all(t[c1 - 1] == ' ' for t in self.text[r0:r1]):
            c1 -= 1
        return Grid([t[c0:c1] for t in self.text[r0:r1]], [k[c0:c1] for k in self.tone[r0:r1]])


def load_art(path=None):
    """tools/terminal-art.txt -> {name: block text}."""
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'terminal-art.txt')
    art, name, buf = {}, None, []
    for line in open(path, encoding='utf-8').read().split('\n'):
        if line.startswith('=== ') and line.endswith(' ==='):
            if name:
                art[name] = '\n'.join(buf)
            name, buf = line[4:-4], []
        elif name is not None:
            buf.append(line)
    if name:
        art[name] = '\n'.join(buf)
    return art


ART = load_art()


def parse(block):
    """A block of art: text rows, then '--', then tone rows (optional)."""
    lines = block.strip('\n').split('\n')
    if '--' in lines:
        i = lines.index('--')
        text, tone = lines[:i], lines[i + 1:]
    else:
        text, tone = lines, []
    for t in text:
        bad = set(t) - SAFE
        assert not bad, 'glyph %r is not mirror safe in %r' % (''.join(sorted(bad)), t)
    return Grid(text, tone)


# ── rendering ────────────────────────────────────────────────
def render_grid(g, pal, inv=False, glow=True):
    """Grid -> RGBA image: an opaque box in the water colour with the glyphs (and their baked glow) on it."""
    W, H = g.cols * CW, g.rows * CH
    ink = Image.new('RGB', (W, H), (0, 0, 0))
    inkmask = Image.new('L', (W, H), 0)
    for cy in range(g.rows):
        for cx in range(g.cols):
            c, k = g.text[cy][cx], g.tone[cy][cx]
            if c in ' L':
                continue
            m = mask_of(c, BOLD_ALL or k == 'b')
            col = rgb(pal[k if k in pal else 'n']) if not inv else rgb(pal['ink'])
            ink.paste(Image.new('RGB', (CW, CH), col), (cx * CW, cy * CH), m)
            inkmask.paste(m, (cx * CW, cy * CH), m)
    if inv:
        base = Image.new('RGB', (W, H), rgb(pal['fill']))
        base.paste(ink, (0, 0), inkmask)
        return base.convert('RGBA')
    base = Image.new('RGB', (W, H), BG)
    if glow:
        gl = ink.filter(ImageFilter.GaussianBlur(GLOW_R))
        # fade the glow near the box border so a clipped glow leaves no visible edge
        fade = Image.new('L', (W, H), 0)
        px = fade.load()
        for y in range(H):
            for x in range(W):
                d = min(x, y, W - 1 - x, H - 1 - y)
                px[x, y] = 255 if d >= 4 else int(255 * d / 4)
        gl = ImageChops.multiply(gl, Image.merge('RGB', (fade, fade, fade)))
        gl = gl.point(lambda v: int(v * GLOW))
        base = ImageChops.add(base, gl)
    base.paste(ink, (0, 0), inkmask)
    return base.convert('RGBA')


def render_clear(g, pal, bold=False):
    """Glyphs only (transparent background): sparkle, lure."""
    W, H = g.cols * CW, g.rows * CH
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for cy in range(g.rows):
        for cx in range(g.cols):
            c, k = g.text[cy][cx], g.tone[cy][cx]
            if c == ' ':
                continue
            m = mask_of(c, bold or k == 'b')
            im.paste(Image.new('RGBA', (CW, CH), rgb(pal[k]) + (255,)), (cx * CW, cy * CH), m)
    return im


LURE_PAD = 6


def render_lure(level, pal):
    """The angler's lure: one glyph (a '*', a '+' at the flare) with a soft glow in its alpha, LURE_PAD texels around the cell."""
    g = Grid([('*', '*', '+')[level]], ['nbb'[level]])
    cell = render_clear(g, pal)
    W, H = CW + 2 * LURE_PAD, CH + 2 * LURE_PAD
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    col = rgb(pal[g.tone[0][0]])
    a = Image.new('L', (W, H), 0)
    a.paste(cell.split()[3], (LURE_PAD, LURE_PAD))
    halo = a.filter(ImageFilter.GaussianBlur(2.6 + level)).point(lambda v: min(255, int(v * (0.9 + 0.45 * level))))
    im.paste(Image.new('RGBA', (W, H), col + (255,)), (0, 0), halo)
    im.alpha_composite(cell, (LURE_PAD, LURE_PAD))
    return im


def render_cropped(g, pal):
    """Glyph only, cropped to its ink (bubbles are sized by their ink)."""
    im = render_clear(g, pal)
    return im.crop(im.split()[3].getbbox())


def lure_pos(face):
    """(col, row) of the lure cell in the trimmed angler art of a face."""
    g = face_grid(parse(ART['angler.0']), face)
    for y, t in enumerate(g.text):
        if 'L' in t:
            return t.index('L'), y
    raise ValueError('no lure marker')


# ── creatures ────────────────────────────────────────────────
def face_grid(g, face):
    return (g if face == 'r' else g.mirrored()).trimmed()


FISH_VARIANTS = ['stripe', 'spot', 'solid', 'hollow', 'check']
FISH_CLASSES = ['fry', 'small', 'mid', 'large']
ORCA_FRAMES = 2
ANGLER_FRAMES = 2
JELLY_CLASSES = ['small', 'mid', 'large']
WORM_STAGES = 3


def variant_grid(tpl, variant):
    """Fills the 'F' / 'f' placeholders of a fish template with the variant's body characters."""
    fill = {'stripe': ('=', '-'), 'spot': ('@', 'o'), 'solid': ('#', '#'), 'hollow': (':', '.'), 'check': ('%', '%')}[variant]
    text = []
    for y, t in enumerate(tpl.text):
        row = ''
        for x, c in enumerate(t):
            row += (fill[0] if c == 'F' else fill[1]) if c in 'Ff' else c
        text.append(row)
    tone = []
    for y, k in enumerate(tpl.tone):
        row = ''
        for x, c in enumerate(tpl.text[y]):
            row += ('m' if variant in ('hollow', 'spot') else 'n') if c in 'Ff' else k[x]
        tone.append(row)
    return Grid(text, tone)


def gen_creatures(out):
    for s in FISH_SETS:
        pal = PAL[s]
        for cls in FISH_CLASSES:
            for v in (FISH_VARIANTS if cls != 'fry' else ['stripe']):
                for f in range(2):
                    tpl = parse(ART['fish.%s.%d' % (cls, f)])
                    g = variant_grid(tpl, v)
                    for face in 'rl':
                        name = ('fish-fry-%d-%s-%s.png' % (f, face, s)) if cls == 'fry' else ('fish-%s-%s-%d-%s-%s.png' % (cls, v, f, face, s))
                        out[name] = render_grid(face_grid(g, face), pal, inv=(s == 'ri'))
    for s in BASE_SETS:
        pal = PAL[s]
        for f in range(ORCA_FRAMES):
            for face in 'rl':
                out['orca-%d-%s-%s.png' % (f, face, s)] = render_grid(face_grid(parse(ART['orca.%d' % f]), face), pal)
        for f in range(ANGLER_FRAMES):
            for face in 'rl':
                out['angler-%d-%s-%s.png' % (f, face, s)] = render_grid(face_grid(parse(ART['angler.%d' % f]), face), pal)
        for ci, cls in enumerate(JELLY_CLASSES):
            for f in range(2):
                out['jelly-%s-%d-%s.png' % (cls, f, s)] = render_grid(parse(ART['jelly.%s.%d' % (cls, f)]).trimmed(), pal)
        for st in range(WORM_STAGES):
            for f in range(2):
                out['worm-%d-%d-%s.png' % (st, f, s)] = render_grid(parse(ART['worm.%d.%d' % (st, f)]).trimmed(), pal)
        for f in range(2):
            out['sparkle-%d-%s.png' % (f, s)] = render_clear(Grid(['*+'[f]], ['b']), pal)
        for lvl in range(3):
            out['lure-%d-%s.png' % (lvl, s)] = render_lure(lvl, pal)
        out['bubble-s-%s.png' % s] = render_cropped(Grid(['o'], ['m']), pal)
        out['bubble-b-%s.png' % s] = render_cropped(Grid(['()'], ['n']), pal)


# ── backdrop ─────────────────────────────────────────────────
ROWS = 90                            # text rows of the screen at 1080p (1080 / 12)
COLS = 320                           # text columns at 1080p (1920 / 6)
SURFACE_ROW = 4                      # first wave row: y = 48 px, under the floating panel (about 54 px, the first rows stay empty)
SURFACE_ROWS = 2
WATER_ROW0, WATER_ROWS = 6, 66       # the swell texture covers rows 6..71
SEABED_ROW, SEABED_ROWS = 82, 8      # 96 px = 8.9 % of 1080; the last row holds the prompt and the load bar
KELP_ROWS = [9, 13, 17]              # tallest 17 rows = 204 px = 18.9 %
PROMPT = '$ boids --watch '
STATUS_COLS = 32


def lcg(seed):
    return random.Random(seed)


def put(rowbuf, tonebuf, x, text, tone):
    for i, ch in enumerate(text):
        if 0 <= x + i < len(rowbuf) and ch != ' ':
            rowbuf[x + i] = ch
            tonebuf[x + i] = tone


def water_grid():
    """Sparse swell strands: rows of dim `~ - . '` that thin out with depth. Static, never a lattice."""
    rnd = lcg(7)
    text = [[' '] * COLS for _ in range(WATER_ROWS)]
    tone = [[' '] * COLS for _ in range(WATER_ROWS)]
    y = 1
    while y < WATER_ROWS - 2:
        depth = y / float(WATER_ROWS)
        n = max(1, int(9 * (1 - depth) ** 1.4) + (1 if rnd.random() < 0.5 else 0))
        xs = sorted(rnd.randrange(0, COLS - 16) for _ in range(n))
        last = -99
        for x in xs:
            if x - last < 14:
                continue
            L = rnd.randrange(5, 15 - int(6 * depth))
            motif = rnd.random()
            if motif < 0.45:
                seg = ''.join(rnd.choice('~~~-') for _ in range(L))
            elif motif < 0.8:
                seg = ('.-~' * 6)[:L]
            else:
                seg = ("'-~-." * 4)[:L]
            put(text[y], tone[y], x, seg, 'm' if depth < 0.18 else 'd')
            last = x + L
        y += 2 + int(depth * 4) + (1 if rnd.random() < 0.4 else 0)
    # a few drifting specks, fewer with depth
    for _ in range(46):
        yy = int(WATER_ROWS * rnd.random() ** 1.6)
        xx = rnd.randrange(COLS)
        if text[min(yy, WATER_ROWS - 1)][xx] == ' ':
            text[yy][xx] = rnd.choice(".'.,")
            tone[yy][xx] = 'd'
    return Grid([''.join(r) for r in text], [''.join(r) for r in tone])


def waves_grid():
    rnd = lcg(11)
    r0, r1 = [' '] * COLS, [' '] * COLS
    t0, t1 = [' '] * COLS, [' '] * COLS
    x = 0
    while x < COLS - 12:
        L = rnd.randrange(6, 15)
        crest = ('_.-~"~-._' * 3)
        put(r0, t0, x, ('.-~"~-.' + '_' * 10)[:L] if rnd.random() < 0.5 else ('_.-~~-._' + '~' * 10)[:L], 'n')
        if rnd.random() < 0.6:
            put(r1, t1, x + rnd.randrange(0, 4), rnd.choice(["'", '.', "' '", '. .']), 'd')
        x += L + rnd.randrange(2, 7)
    return Grid([''.join(r0), ''.join(r1)], [''.join(t0), ''.join(t1)])


def seabed_grid():
    rnd = lcg(4242)
    text = [[' '] * COLS for _ in range(SEABED_ROWS)]
    tone = [[' '] * COLS for _ in range(SEABED_ROWS)]
    x = 0
    while x < COLS - 14:
        r = rnd.random()
        if r < 0.22:                                    # boulder: two rows
            w = rnd.choice([6, 8, 10])
            top = ('_.-' + '"' * (w - 5) + '-._')[:w] if False else '.' + '-' * (w - 2) + '.'
            put(text[0], tone[0], x + 1, ' ' + '_' * (w - 2) + ' ', 'm')
            put(text[1], tone[1], x, '(' + ''.join(rnd.choice('==:') for _ in range(w - 2)) + ')', 'm')
            x += w + rnd.randrange(1, 5)
        elif r < 0.45:                                  # mound
            n = rnd.randrange(2, 5)
            seg = '/^\\' * n
            put(text[1], tone[1], x, seg, 'm')
            x += len(seg) + rnd.randrange(1, 4)
        elif r < 0.62:                                  # coral tuft
            put(text[0], tone[0], x, "\\|/", 'm')
            put(text[1], tone[1], x, "_|_", 'm')
            x += 4 + rnd.randrange(2, 6)
        else:                                           # sand
            n = rnd.randrange(5, 14)
            put(text[1], tone[1], x, ''.join(rnd.choice('___.,') for _ in range(n)), 'm')
            x += n + rnd.randrange(0, 4)
    # sediment: a few dim ripples in rows 2-3 (like the swell, but lower and sparser); rows 4-6 hold only a rare pebble
    for y, n in ((2, 22), (3, 14), (4, 6), (5, 3)):
        last = -99
        for xx in sorted(rnd.randrange(0, COLS - 12) for _ in range(n)):
            if xx - last < 9:
                continue
            seg = rnd.choice([".-'-.", "~-~~", "_.-._", "- . -", ".:.", "'-.-'"])
            put(text[y], tone[y], xx, seg, 'd')
            last = xx + len(seg)
    return Grid([''.join(r) for r in text], [''.join(r) for r in tone])


# kelp: a stalk with leaves on both sides (up to two per side), 5 columns wide; the two frames swap the leaf
# lengths of the sides (a slow sway, one step every 2 s)
def kelp_grid(cls, frame):
    h = KELP_ROWS[cls]
    rnd = random.Random(100 + cls)
    text, tone = [], []
    for y in range(h):
        l, r = rnd.choice([0, 1, 1, 2]), rnd.choice([0, 1, 1, 2])
        if y == 0:
            text.append('  ,  '); tone.append('  m  ')
            continue
        if cls == 0 and y == 1:
            text.append(' \\|/ '); tone.append(' dmd ')
            continue
        if frame:
            l, r = r, l
        left, right = '(' * l, ')' * r
        text.append(left.rjust(2) + '|' + right.ljust(2))
        tone.append('dd' + 'm' + 'dd')
    return Grid(text, tone)


def status_text(level):
    cells = level // 5
    return '[' + '|' * cells + ' ' * (20 - cells) + '] load %3d%%' % level


def bar_grid(text, tone='n'):
    return Grid([text], [tone * len(text)])


def render_flat(g, pal):
    """Backdrop pieces: glyphs on a transparent background, no glow."""
    return render_clear(g, pal, bold=True)


def shade_image():
    """Static vignette + depth darkening: black with alpha, 480 x 270, stretched over the screen (4 px blocks, alpha steps of one level)."""
    W, H = 480, 270
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    for y in range(H):
        for x in range(W):
            nx, ny = (x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1
            r = math.sqrt((nx * 0.92) ** 2 + (ny * 1.0) ** 2)
            vig = max(0.0, r - 0.55) / 0.8
            vig = min(1.0, vig) ** 2.0 * 0.5
            depth = (y + 0.5) / H
            dep = 0.22 * depth ** 1.5
            a = 1 - (1 - vig) * (1 - dep)
            px[x, y] = (0, 0, 0, int(round(a * 255)))
    return im


def haze_image():
    """A soft phosphor-green lift of the water, brightest high and in the middle (the lit glass), 480 x 270, stretched."""
    W, H = 480, 270
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    for y in range(H):
        for x in range(W):
            nx, ny = (x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1
            v = math.exp(-(nx * nx) / 0.55 - ((ny + 0.35) ** 2) / 0.30)
            px[x, y] = (40, 170, 90, int(round(v * 0.20 * 255)))
    return im


def glass_image(haze_gain):
    """The CRT glass in ONE full-screen layer (one blend instead of two): the green haze under the black vignette."""
    h, v = haze_image(), shade_image()
    W, H = h.size
    out = Image.new('RGBA', (W, H))
    for y in range(H):
        for x in range(W):
            r1, g1, b1, a1 = h.getpixel((x, y))
            a1 = a1 / 255.0 * haze_gain
            a2 = v.getpixel((x, y))[3] / 255.0
            A = 1 - (1 - a1) * (1 - a2)
            if A <= 0:
                out.putpixel((x, y), (0, 0, 0, 0))
                continue
            k = a1 * (1 - a2) / A
            out.putpixel((x, y), (int(round(r1 * k)), int(round(g1 * k)), int(round(b1 * k)), int(round(A * 255))))
    return out


def scan_image():
    """One dark line in six (static scanlines, two per text row). 6 x 6, tiled by the QML at a whole-number scale."""
    im = Image.new('RGBA', (6, 6), (0, 0, 0, 0))
    for x in range(6):
        im.putpixel((x, 5), (0, 0, 0, 56))
    return im


def gen_backdrop(out):
    for s in BASE_SETS:
        pal = PAL[s]
        wim = Image.new('RGB', (COLS * CW, WATER_ROWS * CH), BG)          # opaque: a plain blit, no blending
        wim.paste(render_flat(water_grid(), pal), (0, 0), render_flat(water_grid(), pal))
        out['water-%s.png' % s] = wim
        out['waves-%s.png' % s] = render_flat(waves_grid(), pal)
        out['seabed-%s.png' % s] = render_flat(seabed_grid(), pal)
        for cls in range(3):
            for f in range(2):
                out['kelp-%d-%d-%s.png' % (cls, f, s)] = render_flat(kelp_grid(cls, f), pal)
        out['prompt-%s.png' % s] = render_flat(Grid([PROMPT + '\u2588'], ['n' * len(PROMPT) + 'b']), pal)
        for lvl in range(0, 101, 5):
            out['status-%03d-%s.png' % (lvl, s)] = render_flat(bar_grid(status_text(lvl)), pal)
    for s_ in BASE_SETS:
        out['glass-%s.png' % s_] = glass_image(0.35 if s_ == 'n' else 1.0)
    out['scan.png'] = scan_image()


def gen_all():
    out = {}
    gen_creatures(out)
    gen_backdrop(out)
    return out


def check(imgs):
    bad = 0
    for name in sorted(imgs):
        p = os.path.join(OUT, name)
        if not os.path.exists(p):
            print('missing: ' + name, file=sys.stderr)
            bad += 1
            continue
        with Image.open(p) as f:
            if f.size != imgs[name].size or f.convert('RGBA').tobytes() != imgs[name].convert('RGBA').tobytes():
                print('stale: ' + name, file=sys.stderr)
                bad += 1
    if os.path.isdir(OUT):
        for name in os.listdir(OUT):
            if name not in imgs:
                print('extra: ' + name, file=sys.stderr)
                bad += 1
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='exit 1 if a texture on disk is missing or stale')
    ap.add_argument('--write', action='store_true', help='write the textures (the default without --check/--sheet)')
    ap.add_argument('--sheet', metavar='OUT.png', help='write a contact sheet of the day creature textures')
    ap.add_argument('--scale', type=int, default=4, help='contact sheet scale (default 4)')
    ap.add_argument('--lure', action='store_true', help='print the lure cell of the angler art per face (for theme.js)')
    ap.add_argument('--only', default='', help='sheet: comma separated name prefixes (orca,angler,fish,jelly,worm)')
    args = ap.parse_args()
    if args.lure:
        print('ANGLER_LURE = { r: { x: %d, y: %d }, l: { x: %d, y: %d } }' % (lure_pos('r') + lure_pos('l')))
        return
    imgs = {}
    if args.sheet:
        gen_creatures(imgs)
        sheet(imgs, args.sheet, args.scale, args.only.split(',') if args.only else None)
        return
    imgs = gen_all()
    if args.check:
        bad = check(imgs)
        if bad:
            print('%d texture problem(s): run python3 tools/gen-terminal-theme.py --write' % bad, file=sys.stderr)
        sys.exit(1 if bad else 0)
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        if name not in imgs:
            os.remove(os.path.join(OUT, name))
    total = 0
    for name, im in imgs.items():
        path = os.path.join(OUT, name)
        im.save(path, optimize=False)
        total += os.path.getsize(path)
    print('%d images, %.0f KiB -> %s' % (len(imgs), total / 1024.0, OUT))


def sheet(imgs, file, scale, only=None):
    def pick(pred):
        return [n for n in sorted(imgs) if pred(n)]
    groups = [
        pick(lambda n: n.startswith('orca-') and n.endswith('-g.png')),
        pick(lambda n: n.startswith('angler-') and n.endswith('-g.png')),
        pick(lambda n: n.startswith('fish-') and n.endswith('-g.png') and '-r-' in n and '-0-' in n),
        pick(lambda n: n.startswith('fish-') and n.endswith('-g.png') and '-l-' in n and '-1-' in n),
        pick(lambda n: n.startswith('jelly-') and n.endswith('-g.png')),
        pick(lambda n: n.startswith('worm-') and n.endswith('-g.png')),
    ]
    pad = 10
    lines = []
    for grp in groups:
        if only and not any(grp and grp[0].startswith(o) for o in only):
            continue
        ims = [imgs[n] for n in grp]
        lines.append((sum(i.width * scale + pad for i in ims) + pad, max(i.height for i in ims) * scale + 2 * pad, ims))
    W = max(l[0] for l in lines)
    H = sum(l[1] for l in lines)
    canvas = Image.new('RGBA', (W, H), BG + (255,))
    y = 0
    for w, h, ims in lines:
        x = pad
        for im in ims:
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            canvas.alpha_composite(big, (x, y + pad))
            x += big.width + pad
        y += h
    canvas.convert('RGB').save(file)
    print('sheet -> ' + file)


if __name__ == '__main__':
    main()
