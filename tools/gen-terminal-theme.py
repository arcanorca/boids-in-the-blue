#!/usr/bin/env python3
# Generates the "terminal" theme's textures (contents/themes/terminal/img/*.png) and, optionally, a contact sheet.
#   python3 tools/gen-terminal-theme.py [--check] [--write] [--sheet <out.png>] [--scale N]
#
# Every texture is built from text cells of a real pixel font: Terminus 6x12 (ter-u12n.otb, PIL bitmap font),
# one font pixel = one texel. Block elements (U+2580..259F, minus the shades) are synthesised exactly on the
# texel grid, so no glyph gets a stray anti-aliased edge. The QML draws every texture at the same integer texel
# scale (2 device px at 1080p), nearest-neighbour, so one text cell is 12x24 px on a 1080p screen.
#
# Colours are the palette sets of theme.js (PAL below; theme.js repeats them and the theme test compares):
# 'g' day green, 'n' night green, 'a'/'an' amber day/night, 'r'/'rn' red day/night, 'ri' an inverted red alarm
# box for fish. Creatures use the roles 'b' (bright), 'n' (normal) and 'd' (dim) and no other tone.
# Left-facing art is generated from the right-facing character rows (characters mirrored, columns reversed), so
# the QML only chooses a file; nothing is ever mirrored at run time.
#
# --check regenerates everything in memory and compares decoded pixels with the files on disk.
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'contents', 'themes', 'terminal', 'img')
FONT = os.environ.get('TERMINUS', '/usr/share/fonts/misc/ter-u12n.otb')

CW, CH = 6, 12                       # one text cell in texels (Terminus 6x12)
ROWS = 45                            # text rows of the screen at 1080p (540 texels)
BG = '#0a120c'
RED = '#ff4a3a'

# ── palette sets ─────────────────────────────────────────────
PAL = {
    'g':  {'b': '#7dffa0', 'n': '#33d86a', 'd': '#1a6b38'},
    'n':  {'b': '#33d86a', 'n': '#1a6b38', 'd': '#0f4a28'},
    'a':  {'b': '#ffd27a', 'n': '#ffb000', 'd': '#8a5a00'},
    'an': {'b': '#ffb000', 'n': '#8a5a00', 'd': '#4d3300'},
    'r':  {'b': '#ff9a8c', 'n': '#ff4a3a', 'd': '#8a2418'},
    'rn': {'b': '#ff4a3a', 'n': '#8a2418', 'd': '#4d1510'},
    'ri': {'ink': BG, 'fill': RED},
}
FISH_SETS = ['g', 'n', 'a', 'an', 'r', 'rn', 'ri']
BASE_SETS = ['g', 'n']               # the backdrop and the other creatures: day and night only

# ── glyph masks: a mask is a 12 x 6 tuple of rows of 0/1 ────
_font = None
_masks = {}


def _grid(fn):
    return tuple(tuple(1 if fn(x, y) else 0 for x in range(CW)) for y in range(CH))


def _text_mask(ch):
    global _font
    if _font is None:
        _font = ImageFont.truetype(FONT, 12)
    im = Image.new('L', (CW, CH), 0)
    ImageDraw.Draw(im).text((0, 0), ch, font=_font, fill=255)
    return _grid(lambda x, y: im.getpixel((x, y)) >= 128)


def mask_of(ch):
    if ch not in _masks:
        if ch == ' ':
            m = _grid(lambda x, y: False)
        elif ch == '\u2588':
            m = _grid(lambda x, y: True)
        else:
            m = _text_mask(ch)
        _masks[ch] = m
    return _masks[ch]


def _quadrant_mask(bits):
    # bit 1 = top-left, 2 = top-right, 4 = bottom-left, 8 = bottom-right (a quadrant is 3 x 6 texels)
    def on(x, y):
        bit = {(0, 0): 1, (1, 0): 2, (0, 1): 4, (1, 1): 8}[(1 if x >= 3 else 0, 0 if y < 6 else 1)]
        return bool(bit & bits)
    return _grid(on)


def _lower_mask(k):              # k eighths from the bottom
    h = int(CH * k / 8 + 0.5)
    return _grid(lambda x, y: y >= CH - h)


def _left_mask(k):               # k eighths from the left
    w = int(CW * k / 8 + 0.5)
    return _grid(lambda x, y: x < w)


# candidate block shapes for the sub-cell art: every quadrant pattern and the eighth blocks
BLOCK_CANDIDATES = ([_quadrant_mask(b) for b in range(1, 16)] + [_lower_mask(k) for k in range(1, 8)] +
                    [_left_mask(k) for k in range(1, 8)] + [_grid(lambda x, y: y < 2), _grid(lambda x, y: x == 5)])


def mirror_mask(m):
    return tuple(tuple(reversed(r)) for r in m)


# ── cells: (mask, fg role, bg role); a role of None is transparent ──
def text_row(text, roles):
    """One row of text cells. roles: one role letter per character, or one letter for all of them."""
    if len(roles) == 1:
        roles = roles * len(text)
    assert len(text) == len(roles), (text, roles)
    return [(mask_of(c), r, None) for c, r in zip(text, roles)]


MIRROR = {'<': '>', '>': '<', '(': ')', ')': '(', '/': '\\', '\\': '/', '{': '}', '}': '{', '[': ']', ']': '[',
          'd': 'b', 'b': 'd', 'q': 'p', 'p': 'q'}


def mirror_text(text, roles):
    """Left-facing version of a right-facing text row: the characters are mirrored and the columns reversed."""
    return ''.join(MIRROR.get(c, c) for c in reversed(text)), roles[::-1]


def render(rows, pal, inv=False):
    """rows: a list of rows of cells -> RGBA image. inv: every texel opaque (ink on a red box, the alarm look)."""
    H = len(rows) * CH
    W = len(rows[0]) * CW
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    for cy, row in enumerate(rows):
        for cx, (mask, fg, bg) in enumerate(row):
            for y in range(CH):
                for x in range(CW):
                    on = mask[y][x]
                    if inv:
                        c = pal['ink'] if on else pal['fill']
                    else:
                        role = fg if on else bg
                        if role is None:
                            continue
                        c = pal[role]
                    px[cx * CW + x, cy * CH + y] = hex_rgba(c)
    return im


def hex_rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def _face(text, roles, face):
    if face == 'l':
        text, roles = mirror_text(text, roles)
    return [text_row(text, roles)]


# ── fish ─────────────────────────────────────────────────────
# Fish = [tail][body x k][head]: the size class is k (small 0, mid 1, large 2), so a bigger fish is the same fish
# with more body. The tail beat swaps the tail glyph between two frames. Heads are round or blunt and never mirror
# the tail, so a left-facing fish is a different silhouette, not a copy.
FISH_VARIANTS = ['stripe', 'spot', 'solid', 'hollow', 'check']
#           tail frames      body  body role  head  head role  head in the small class
FISH = {
    'stripe': (['<', '/'], '=', 'n', ')', 'n', ')'),
    'spot':   (['<', '/'], 'o', 'b', ')', 'n', 'o'),
    'solid':  (['<', '/'], '#', 'n', '}', 'n', '}'),
    'hollow': (['<', '/'], '-', 'd', ']', 'n', ']'),
    'check':  (['<', '/'], '%', 'n', '}', 'n', '*'),
}
FISH_BODY = {'small': 0, 'mid': 1, 'large': 2}
FISH_CLASSES = ['small', 'mid', 'large']
FRY = (['<', '/'], '.', 'b')                   # babies: a tail and a bright dot, two cells


def fish_rows(variant, cls, frame, face):
    tails, body, brole, head, hrole, small_head = FISH[variant]
    k = FISH_BODY[cls]
    if k == 0:
        text, roles = tails[frame] + small_head, 'd' + hrole
    else:
        text, roles = tails[frame] + body * k + head, 'd' + brole * k + hrole
    return _face(text, roles, face)


def fry_rows(frame, face):
    tails, dot, role = FRY
    return _face(tails[frame] + dot, 'd' + role, face)


# ── angler: 5 x 3 cells; a lure stalk above the head, a wide mouth ──
ANGLER = [
    # frame 0 / frame 1 : text, roles (the lure bulb is drawn over cell (4, 0) by lure-<level>.png)
    (['     ', '(@@/ ', '(@@@>'], ['     ', 'dnnd ', 'dnnnb']),
    (['     ', '(@@| ', '(@@@>'], ['     ', 'dnnd ', 'dnnnb']),
]


def angler_rows(frame, face):
    text, roles = ANGLER[frame]
    rows = []
    for t, r in zip(text, roles):
        if face == 'l':
            t, r = mirror_text(t, r)
        rows.append(text_row(t, r))
    return rows


# ── jelly: the bell (3 rows) and its tentacles; two frames pulse the bell and sway the tentacles ──
JELLY = {
    'small': [(['.-', '()', '/\\'], ['dd', 'nn', 'dd']), (['.-', '()', '\\/'], ['dd', 'nn', 'dd'])],
    'mid':   [(['.-.', '(*)', '/|\\'], ['ddd', 'dnd', 'ddd']), (['.-.', '( )', '\\|/'], ['ddd', 'dnd', 'ddd'])],
    'large': [(['.-.-.', '(   )', '/|||\\'], ['ddddd', 'ddddd', 'ddddd']),
              (['.-.-.', '(   )', '\\|||/'], ['ddddd', 'ddddd', 'ddddd'])],
}


def jelly_rows(cls, frame):
    art, roles = JELLY[cls][frame]
    return [text_row(t, r) for t, r in zip(art, roles)]


# ── worm: one cell wide; a wiggle stack that dissolves through three stages as its life drains ──
WORM = {
    0: (['S', 's', '~'], ['s', 'S', '~']),
    1: (['S', '~'], ['s', '~']),
    2: (['~'], ['s']),
}


def worm_rows(stage, frame):
    return [text_row(c, 'n') for c in WORM[stage][frame]]


# ── kelp: a stalk of brackets, one cell wide; the two frames swap the sides of the brackets ──
KELP_HEIGHT = {0: 5, 1: 7, 2: 8}


def kelp_rows(cls, frame):
    return [text_row('{' if (y + frame) % 2 == 0 else '}', 'd') for y in range(KELP_HEIGHT[cls])]


# ── orca: a hand-drawn sub-cell map, 18 x 24 units (3 texels across, 1.5 texels down each), quantised to blocks ──
# B = black body (dim), G = grey saddle (normal), W = white markings (bright). Frame 1 lifts the flukes by one unit.
ORCA_MAP = [
    '.........B........',
    '........BB........',
    '........BB........',
    '.......BBBB.......',
    'BB.....BBBB.......',
    'BB....BBBBB.......',
    'BBB...BBBBBB......',
    'BBB..BBBBBBBB.....',
    '..BBBBBBBBBBBBBB..',
    '..GGGBBBBBBWWWBBBB',
    '..GGGBBBBBWWWWWBBB',
    '..BBBBBBBBWWWWWWWW',
    '...BBBBBBWWWBBWWWW',
    'BBBBBWWWWWWWBBWWWW',
    'BBBBBBWWWWWWWWWW..',
    'BB..BBWWWWWWWW....',
    'BB...BBBBBBB......',
    '...BBBBBBBB.......',
    '....BBBB..........',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
]


def orca_map(frame):
    m = [list(r) for r in ORCA_MAP]
    if frame == 1:
        # the flukes (the three left units) lift by one unit
        for y in range(24):
            for x in range(3):
                m[y][x] = ORCA_MAP[y + 1][x] if y + 1 < 24 else '.'
    return m


def _quantise(labels):
    """labels: 12 x 6 texels of None / 'b' / 'd'. The cell (mask, fg, bg) with the fewest wrong texels; ties prefer
    fewer coloured sides, then the earlier candidate (stable output)."""
    best = None
    for mask in BLOCK_CANDIDATES:
        for fg in (None, 'd', 'b'):
            for bg in (None, 'd', 'b'):
                err = 0
                for y in range(CH):
                    for x in range(CW):
                        if (fg if mask[y][x] else bg) != labels[y][x]:
                            err += 1
                key = (err, (fg is not None) + (bg is not None))
                if best is None or key < best[0]:
                    best = (key, (mask, fg, bg))
    return best[1]


def orca_rows(frame, face):
    amap = orca_map(frame)
    labels = [[None] * 54 for _ in range(36)]
    for ty in range(36):
        uy = min(23, int(ty * 2 / 3))
        for tx in range(54):
            c = amap[uy][tx // 3]
            labels[ty][tx] = {'W': 'b', 'G': 'n', 'B': 'd'}.get(c)
    cells = []
    for cy in range(3):
        row = []
        for cx in range(9):
            sub = [labels[cy * CH + y][cx * CW:(cx + 1) * CW] for y in range(CH)]
            row.append(_quantise(sub))
        cells.append(row)
    if face == 'l':
        cells = [[(mirror_mask(m), f, b) for (m, f, b) in reversed(r)] for r in cells]
    return cells


def lure_rows(level):
    return [text_row('*', ['d', 'n', 'b'][level])]


def sparkle_rows(frame):
    return [text_row('*+'[frame], 'b')]


def bubble_rows(big):
    return [text_row('O' if big else '\u00b0', 'n' if big else 'd')]


# ── backdrop ─────────────────────────────────────────────────
SEABED_COLS = 80
SEABED_ROWS = 4                       # rows 41..44 of the 45 text rows: 8.9 % of the height; row 44 holds the prompt
DOTS = {'a': (6, 8, [(0, 0), (3, 4)]), 'b': (6, 16, [(0, 0)])}   # tile of cells, dots inside it (sparse)


def _lcg(seed):
    s = seed
    while True:
        s = (s * 1103515245 + 12345) & 0x7fffffff
        yield s / 2147483648.0


def seabed_rows():
    rnd = _lcg(4242)
    top = [' '] * SEABED_COLS
    x = 0
    while x < SEABED_COLS:
        r = next(rnd)
        if r < 0.20:                                        # rock
            for i, ch in enumerate('(@@)'):
                if x + i < SEABED_COLS:
                    top[x + i] = ch
            x += 4
        elif r < 0.42:                                      # mound
            s = '/\\/\\' if next(rnd) < 0.5 else '\\/\\/'
            for i, ch in enumerate(s):
                if x + i < SEABED_COLS:
                    top[x + i] = ch
            x += len(s)
        elif r < 0.60:                                      # ridge
            n = 3 + int(next(rnd) * 4)
            for i in range(n):
                if x + i < SEABED_COLS:
                    top[x + i] = '_'
            x += n
        else:                                               # sand
            n = 2 + int(next(rnd) * 5)
            for i in range(n):
                if x + i < SEABED_COLS:
                    top[x + i] = '_' if next(rnd) < 0.7 else '.'
            x += n
    rows = [text_row(''.join(top), 'd' * SEABED_COLS)]
    for y in range(1, SEABED_ROWS - 1):
        line = ''.join(('#' if next(rnd) < 0.5 else ' ') if y == 1 else ('=' if next(rnd) < 0.3 else ' ')
                       for x in range(SEABED_COLS))
        rows.append(text_row(line, 'd' * SEABED_COLS))
    rows.append(text_row(' ' * SEABED_COLS, 'd' * SEABED_COLS))
    return rows


def status_text(level):
    cells = level // 5
    return '[' + '|' * cells + ' ' * (20 - cells) + '] load %3d%%' % level


PROMPT = '$ boids --watch '


def gen_all():
    """name -> PIL image for every texture of the theme."""
    out = {}
    for s in FISH_SETS:
        pal = PAL[s]
        for v in FISH_VARIANTS:
            for cls in FISH_CLASSES:
                for f in (0, 1):
                    for face in ('r', 'l'):
                        out['fish-%s-%s-%d-%s-%s.png' % (cls, v, f, face, s)] = \
                            render(fish_rows(v, cls, f, face), pal, inv=(s == 'ri'))
        for f in (0, 1):
            for face in ('r', 'l'):
                out['fish-fry-%d-%s-%s.png' % (f, face, s)] = render(fry_rows(f, face), pal, inv=(s == 'ri'))
    for s in BASE_SETS:
        pal = PAL[s]
        for f in (0, 1):
            for face in ('r', 'l'):
                out['orca-%d-%s-%s.png' % (f, face, s)] = render(orca_rows(f, face), pal)
                out['angler-%d-%s-%s.png' % (f, face, s)] = render(angler_rows(f, face), pal)
            for cls in FISH_CLASSES:
                out['jelly-%s-%d-%s.png' % (cls, f, s)] = render(jelly_rows(cls, f) if cls in JELLY else [], pal)
            for stage in range(3):
                out['worm-%d-%d-%s.png' % (stage, f, s)] = render(worm_rows(stage, f), pal)
            out['sparkle-%d-%s.png' % (f, s)] = render(sparkle_rows(f), pal)
        for lvl in range(3):
            out['lure-%d-%s.png' % (lvl, s)] = render(lure_rows(lvl), pal)
        out['bubble-s-%s.png' % s] = render(bubble_rows(False), pal)
        out['bubble-b-%s.png' % s] = render(bubble_rows(True), pal)
        for cls in range(3):
            for f in (0, 1):
                out['kelp-%d-%d-%s.png' % (cls, f, s)] = render(kelp_rows(cls, f), pal)
        out['seabed-%s.png' % s] = render(seabed_rows(), pal)
        out['waves-%s.png' % s] = render([text_row('~', 'd')], pal)
        for band, (tw, th, dots) in DOTS.items():
            rows = []
            for y in range(th):
                rows.append([(mask_of('.') if (x, y) in dots else mask_of(' '), 'd', None) for x in range(tw)])
            out['dots-%s-%s.png' % (band, s)] = render(rows, pal)
        out['prompt-%s.png' % s] = render([text_row(PROMPT, 'n') + [(mask_of('\u2588'), 'n', None)]], pal)
        for lvl in range(0, 101, 5):
            out['status-%03d-%s.png' % (lvl, s)] = render([text_row(status_text(lvl), 'n')], pal)
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
            if f.size != imgs[name].size or f.convert('RGBA').tobytes() != imgs[name].tobytes():
                print('stale: ' + name, file=sys.stderr)
                bad += 1
    if os.path.isdir(OUT):
        for name in os.listdir(OUT):
            if name not in imgs:
                print('extra: ' + name, file=sys.stderr)
                bad += 1
    return bad


def sheet(imgs, file, scale):
    """A contact sheet of the day textures, one line per family."""
    def pick(pred):
        return [n for n in sorted(imgs) if pred(n)]
    groups = [
        pick(lambda n: n.startswith('fish-') and n.endswith('-g.png') and '-r-' in n),
        pick(lambda n: n.startswith('fish-') and n.endswith('-g.png') and '-l-' in n),
        pick(lambda n: n.startswith('fish-') and n.endswith('-ri.png') and '-r-' in n),
        ['orca-0-r-g.png', 'orca-1-r-g.png', 'orca-0-l-g.png'],
        ['angler-0-r-g.png', 'angler-1-r-g.png', 'lure-0-g.png', 'lure-1-g.png', 'lure-2-g.png'],
        ['jelly-small-0-g.png', 'jelly-mid-0-g.png', 'jelly-large-1-g.png', 'worm-0-0-g.png', 'worm-1-1-g.png',
         'worm-2-0-g.png', 'bubble-s-g.png', 'bubble-b-g.png', 'sparkle-0-g.png', 'sparkle-1-g.png'],
        ['kelp-0-0-g.png', 'kelp-1-1-g.png', 'kelp-2-0-g.png', 'waves-g.png', 'dots-a-g.png', 'dots-b-g.png',
         'seabed-g.png', 'prompt-g.png', 'status-050-g.png'],
    ]
    pad = 12
    lines = []
    for g in groups:
        ims = [imgs[n] for n in g]
        w = sum(i.width * scale + pad for i in ims) + pad
        h = max(i.height for i in ims) * scale + 2 * pad
        lines.append((w, h, ims))
    W = max(l[0] for l in lines)
    H = sum(l[1] for l in lines)
    canvas = Image.new('RGBA', (W, H), hex_rgba(BG))
    y = 0
    for w, h, ims in lines:
        x = pad
        for im in ims:
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            canvas.alpha_composite(big, (x, y + pad))
            x += big.width + pad
        y += h
    os.makedirs(os.path.dirname(os.path.abspath(file)), exist_ok=True)
    canvas.convert('RGB').save(file)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='exit 1 if a texture on disk is missing or stale')
    ap.add_argument('--write', action='store_true', help='write the textures (the default without --check/--sheet)')
    ap.add_argument('--sheet', metavar='OUT.png', help='write a contact sheet of the day textures')
    ap.add_argument('--scale', type=int, default=4, help='contact sheet scale (default 4)')
    args = ap.parse_args()
    imgs = gen_all()
    if args.sheet:
        sheet(imgs, args.sheet, args.scale)
        print('sheet -> ' + args.sheet)
    if args.check:
        bad = check(imgs)
        if bad:
            print('%d texture problem(s): run python3 tools/gen-terminal-theme.py --write' % bad, file=sys.stderr)
        sys.exit(1 if bad else 0)
    if args.write or not args.sheet:
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


if __name__ == '__main__':
    main()
