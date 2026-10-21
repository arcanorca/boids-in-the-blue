#!/usr/bin/env python3
# Image -> ASCII draft converter for the "terminal" theme (the first stage of the sprite pipeline).
#   python3 tools/terminal-img2ascii.py <sprite.png> <cols> <rows> [--flip] [--lo 0.45] [--out draft.txt]
#
# Classic ASCII-art conversion, done with glyph SHAPE matching instead of a plain brightness ramp: the source sprite
# is resampled to cols*8 x rows*16 texels (one Terminus 8x16 cell = 8x16 texels), every cell becomes an "intensity
# patch" (alpha x level: light areas such as the white belly are 1.0, dark body areas `lo`, empty 0), and the glyph
# of the font whose own (blurred) ink pattern is closest to that patch is chosen. Interiors therefore get a density
# ramp (` .:-=+*#%@` fall out of the match), and edge cells get the directional glyphs (/ \ | _ - ' ` ( ) , .) that
# follow the silhouette. A tone letter per cell says how bright it should be drawn: b (bright), n (normal), d (dim).
# The output is a DRAFT: the art that ships is the hand-cleaned text in tools/terminal_art.py.
import argparse
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import os
CELL = os.environ.get('CELL', '6x12')
CW, CH = map(int, CELL.split('x'))
FONT_N = '/usr/share/fonts/misc/ter-u%d%s.otb' % (CH, os.environ.get('WEIGHT', 'n'))
# ── pairs mode: a 6x12 cell is one source pixel wide and two source pixels tall (the sprites are authored at 1 px per
# column, 2 px per text row), so every cell is a (top, bottom) pixel pair and the glyph follows from the pair: nothing
# is guessed. Classes: 0 empty, 1 dark body, 2 mid (shaded), 3 light (white patches). ──
def classes(src, cols, rows, flip, th=(60, 130)):
    im = Image.open(src).convert('RGBA')
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.resize((cols, rows * 2), Image.BOX if im.width > cols else Image.NEAREST)
    out = []
    for y in range(rows * 2):
        r = []
        for x in range(cols):
            p = im.getpixel((x, y))
            if p[3] < 110:
                r.append(0)
            else:
                l = (p[0] + p[1] + p[2]) / 3
                r.append(1 if l < th[0] else (2 if l < th[1] else 3))
        out.append(r)
    return out


FILL = {1: '#', 2: '=', 3: '@'}
TONE = {1: 'd', 2: 'm', 3: 'b'}


def pairs(src, cols, rows, flip=False, th=(60, 130)):
    c = classes(src, cols, rows, flip, th)
    filled = [[1 if (c[ry * 2][x] or c[ry * 2 + 1][x]) else 0 for x in range(cols)] for ry in range(rows)]

    def at(ry, x):
        return filled[ry][x] if 0 <= ry < rows and 0 <= x < cols else 0

    def edge(ry, x, step):
        """x of the nearest edge of the run in row ry (looking from x towards `step`), or None."""
        for d in range(0, 4):
            xx = x + step * d
            if at(ry, xx) and not at(ry, xx + step):
                return xx
        return None

    text, tone = [], []
    for ry in range(rows):
        t, k = '', ''
        for x in range(cols):
            a, b = c[ry * 2][x], c[ry * 2 + 1][x]
            if not (a or b):
                t += ' '; k += ' '
                continue
            cls = max(a, b) if abs(a - b) < 2 else 2
            if a and not b:
                t += "'" ; k += 'n'
            elif b and not a:
                t += '_' if (at(ry, x - 1) and at(ry, x + 1)) else '.'; k += 'n'
            else:
                left = not at(ry, x - 1)
                right = not at(ry, x + 1)
                g = FILL[cls]
                if left or right:
                    if left:
                        up, dn = edge(ry - 1, x, 1), edge(ry + 1, x, 1)
                        g = '('
                        # left edge: leftmost x of the neighbours (the run starts at x here)
                        ul = next((xx for xx in range(x - 3, x + 4) if at(ry - 1, xx)), None)
                        dl = next((xx for xx in range(x - 3, x + 4) if at(ry + 1, xx)), None)
                        if ul is not None and dl is not None:
                            if ul > x and dl < x: g = '/'
                            elif ul < x and dl > x: g = '\\'
                    else:
                        ur = next((xx for xx in range(x + 3, x - 4, -1) if at(ry - 1, xx)), None)
                        dr = next((xx for xx in range(x + 3, x - 4, -1) if at(ry + 1, xx)), None)
                        g = ')'
                        if ur is not None and dr is not None:
                            if ur < x and dr > x: g = '\\'
                            elif ur > x and dr < x: g = '/'
                    t += g; k += 'n'
                else:
                    outline = not (at(ry - 1, x) and at(ry + 1, x))
                    t += FILL[cls]
                    k += 'n' if (outline and cls != 3) else TONE[cls]
        text.append(t)
        tone.append(k)
    return text, tone


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('cols', type=int)
    ap.add_argument('rows', type=int)
    ap.add_argument('--flip', action='store_true')
    ap.add_argument('--out')
    a = ap.parse_args()
    text, tone = pairs(a.src, a.cols, a.rows, a.flip)
    s = '\n'.join(text) + '\n--\n' + '\n'.join(tone)
    print(s)
    if a.out:
        open(a.out, 'w').write(s + '\n')


if __name__ == '__main__':
    main()
