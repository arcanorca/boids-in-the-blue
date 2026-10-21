// Generates the "gameboy" theme's art (contents/themes/gameboy/img/*.png + atlas.js) and, optionally,
// a contact sheet. Everything is authored here as 8x8 tiles in the four DMG shades:
//   * OBJ sprites: hand-placed shapes -> auto outline -> metasprites of whole 8x8 tiles. Each sprite uses at
//     most THREE shades (+ transparent), like an OBJ palette. One art-texel scale for all of them.
//   * BG: a few big FLAT tone zones (no noise), one 3-row dither seam per tone change, wide flat light shafts,
//     a surface line, a sand strip, boulders / corals and kelp clumps with two sway frames.
//   * Palette registers: the same art is written once per mapping (BGP fades for day/dusk/night,
//     OBP inversion for stress) as small atlases; no colour is ever computed at run time.
//   node tools/gen-gameboy-theme.js [--check] [--sheet <out.png> [scale]] [--write]
// Constraints are asserted while generating (shade count, unique tile budget, sizes).
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('../tests/png');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'gameboy');
const OUT = path.join(DIR, 'img');

// ── the four DMG shades (darkest .. lightest) ────────────────
const SHADES = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
const RGB = SHADES.map(c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)));

// palette registers: shade -> shade
const OBJ_MAPS = { n0: [0, 1, 2, 3], n1: [0, 0, 1, 2], i0: [3, 2, 1, 0] };   // identity, dimmed (dying worm), inverted (stress)
const OBJ_ORDER = ['n0', 'n1', 'i0'];
// BGP fades. dusk drops the lightest shade (foam and light shafts melt into the water); night darkens the
// sea and keeps a faint lit top layer
const BG_MAPS = { day: [0, 1, 2, 3], dusk: [0, 1, 2, 2], night: [0, 0, 1, 1] };
const BG_ORDER = ['day', 'dusk', 'night'];

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const parse = rows => rows.map(r => [...r]);
function put(g, x, y, ch) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; }
function get(g, x, y) { return (y >= 0 && y < g.length && x >= 0 && x < g[0].length) ? g[y][x] : '.'; }
function outline(g, ch) {                          // 4-neighbour outline around every filled cell
    const add = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
        if (g[y][x] !== '.') continue;
        if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => get(g, x + dx, y + dy) !== '.')) add.push([x, y]);
    }
    for (const [x, y] of add) g[y][x] = ch;
}
function remap(g, pal) {                           // semantic chars -> shade digits
    return g.map(r => r.map(c => {
        if (c === '.') return '.';
        if (/[0-3]/.test(c)) return c;
        if (c === 'o' && pal.o === undefined) return '0';
        if (pal[c] === undefined) throw new Error('no shade for "' + c + '"');
        return String(pal[c]);
    }));
}
function ellipse(g, cx, cy, rx, ry, ch, only) {     // fills cells whose centre lies inside the ellipse
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!only || only(g[y][x]))) g[y][x] = ch;
    }
}
function superellipse(g, cx, cy, rx, ry, n, ch) {  // blunter than an ellipse for n > 2
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++)
        if (Math.pow(Math.abs((x - cx) / rx), n) + Math.pow(Math.abs((y - cy) / ry), n) <= 1) g[y][x] = ch;
}
function rect(g, x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch); }
function shadesOf(g) { const s = new Set(); g.forEach(r => r.forEach(c => { if (c !== '.') s.add(+c); })); return [...s].sort(); }
function bbox(g) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    g.forEach((r, y) => r.forEach((c, x) => { if (c !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// crop to the art box, then centre it on a canvas of whole tiles
function fit(g, w, h, dx, dy) {
    const b = bbox(g), o = mk(w, h), ox = ((w - b.w) >> 1) + (dx || 0), oy = ((h - b.h) >> 1) + (dy || 0);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) put(o, ox + x, oy + y, g[b.y0 + y][b.x0 + x]);
    return o;
}

// ── OBJ art: sprites are objects { w, h, grid (shade digits) } ──
const sprites = {};
function addSprite(name, g, maxShades) {
    const w = g[0].length, h = g.length;
    if (w % 8 || h % 8) throw new Error(name + ': ' + w + 'x' + h + ' is not made of 8x8 tiles');
    const sh = shadesOf(g);
    if (sh.length > (maxShades || 3)) throw new Error(name + ' uses ' + sh.length + ' shades (' + sh + '), an OBJ palette has 3');
    sprites[name] = { w, h, grid: g };
}

// ── FISH ─────────────────────────────────────────────────────
// All fish face right, light from the top left (so the back is the lighter part, the belly the shadowed one).
// Letters: o outline (added automatically), b back, h belly, f fin / tail, e eye, p marking.
// Every size class is a hand-drawn interior: `body` (rows right of the tail, '.' empty) and three tail frames
// (0 flicked up, 1 level, 2 flicked down) for the `tc` leftmost columns. The outline adds one texel all round.
//
//   class  art box incl. outline   canvas   screen px at 1080p (3 px per texel)
//   larva   5 x 3                  8 x 8     15 x 9
//   fry     8 x 5                  8 x 8     24 x 15
//   S      10 x 7                 16 x 8     30 x 21
//   M      12 x 8                 16 x 8     36 x 24   <- default fish
//   L      14 x 9                 16 x 16    42 x 27
const FISH = {
    L: { W: 16, H: 16, tc: 3, rows: 7, cx: 0,
        body: ['..ffff...', '.bbbbbbb.', 'bbbbbbbeb', 'bbbbbbbbb', 'hhhhfhhhh', '.hhhhhhh.', '..hhhhh..'],
        tails: [['ff.', '.ff', '..f', '.ff', 'ff.', 'f..', '...'], ['f..', 'ff.', '.ff', '..f', '.ff', 'ff.', 'f..'], ['...', 'f..', 'ff.', '.ff', '..f', '.ff', 'ff.']],
        marks: { amber: [[5, 1], [5, 2], [5, 3], [8, 1], [8, 2], [8, 3]], lemon: [4, 5, 6, 7, 8, 9].map(x => [x, 1]), aqua: [4, 5, 6, 7, 8, 9, 10, 11].map(x => [x, 3]), orchid: [[5, 2], [7, 1], [7, 3]] } },
    M: { W: 16, H: 8, tc: 3, rows: 6,
        body: ['.fff...', '.bbbbb.', 'bbbbbeb', 'bbbbbbb', 'hhhfhhh', '.hhhhh.'],
        tails: [['ff.', '.ff', '.ff', 'ff.', 'f..', '...'], ['f..', 'ff.', '.ff', '.ff', 'ff.', 'f..'], ['...', 'f..', 'ff.', '.ff', '.ff', 'ff.']],
        marks: { amber: [[5, 1], [5, 2], [5, 3], [7, 1], [7, 2], [7, 3]], lemon: [4, 5, 6, 7, 8].map(x => [x, 1]), aqua: [4, 5, 6, 7, 8, 9].map(x => [x, 3]), orchid: [[4, 2], [6, 1], [6, 3]] } },
    S: { W: 16, H: 8, tc: 2, rows: 5,
        body: ['.ff...', '.bbbb.', 'bbbbeb', 'hhhfhh', '.hhhh.'],
        tails: [['ff', '.f', 'ff', 'f.', '..'], ['f.', 'ff', '.f', 'ff', 'f.'], ['..', 'f.', 'ff', '.f', 'ff']],
        marks: { amber: [[3, 1], [3, 2], [5, 1], [5, 2]], lemon: [3, 4, 5].map(x => [x, 1]), aqua: [2, 3, 4, 5].map(x => [x, 2]), orchid: [[3, 2], [5, 1]] } },
    F: { W: 8, H: 8, tc: 1, rows: 3, body: ['.bbb.', 'bbbeb', '.hhh.'], tails: [['f', 'f', '.'], ['f', 'f', 'f'], ['.', 'f', 'f']], marks: {} },
    B: { W: 8, H: 8, tc: 1, rows: 1, body: ['be'], tails: [['f'], ['.']], marks: {} }
};
const FISH_PAL = {          // shade per part; <= 3 shades per sprite incl. the outline (0)
    coral:  { o: 0, b: 3, h: 2, f: 2, e: 0, p: 3 },
    amber:  { o: 0, b: 2, h: 1, f: 1, e: 0, p: 1 },
    lemon:  { o: 0, b: 3, h: 3, f: 1, e: 0, p: 1 },
    aqua:   { o: 0, b: 2, h: 2, f: 3, e: 0, p: 3 },
    orchid: { o: 0, b: 1, h: 2, f: 2, e: 2, p: 2 }
};
const FISH_ORDER = ['coral', 'amber', 'lemon', 'aqua', 'orchid'];
function drawFish(cls, variant, frame) {
    const C = FISH[cls], w = C.tc + C.body[0].length, g = mk(w, C.rows);
    C.body.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') g[y][C.tc + x] = c; }));
    C.tails[frame].forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') g[y][x] = c; }));
    for (const [x, y] of C.marks[variant] || []) if (g[y][x] === 'b') g[y][x] = 'p';
    const o = mk(w + 2, C.rows + 2);
    g.forEach((r, y) => r.forEach((c, x) => { o[y + 1][x + 1] = c; }));
    outline(o, 'o');
    return fit(remap(o, FISH_PAL[variant]), C.W, C.H);
}
for (const v of FISH_ORDER) for (let f = 0; f < 3; f++) {
    addSprite('fL-' + v + '-' + f, drawFish('L', v, f));
    addSprite('fM-' + v + '-' + f, drawFish('M', v, f));
    addSprite('fS-' + v + '-' + f, drawFish('S', v, f));
    addSprite('fF-' + v + '-' + f, drawFish('F', v, f));
    if (f < 2) addSprite('fB-' + v + '-' + f, drawFish('B', v, f));
}

// ── ANGLER 24x16 (faces right, art ~19 x 14 incl. stalk) ─────
// The lure bulb is a separate 8x8 tile drawn at LURE[frame] (top-left of its 2x2 core).
// b body, d dark scales, t tooth/speckle, w eye white, e pupil, f fin, m mouth, s stalk
const ANGLER_TAIL = [
    ['....', '....', '....', '....', 'f...', 'ff..', '.ff.', '.ff.', 'ff..', 'f...', '....', '....', '....', '....', '....', '....'],
    ['....', '....', '....', '....', '....', 'f...', 'fff.', 'fff.', 'f...', '....', '....', '....', '....', '....', '....', '....'],
    ['....', '....', '....', '....', '....', '....', 'f...', 'ff..', '.ff.', '.ff.', 'ff..', 'f...', '....', '....', '....', '....']
];
const ANGLER_LURE = [{ x: 15, y: 0 }, { x: 15, y: 1 }, { x: 15, y: 0 }];   // lure core top-left per frame (stalk tip)
function anglerFrame(fr) {
    const g = mk(24, 16);
    ellipse(g, 10.4, 9.4, 6.4, 4.6, 'b');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) if (g[y][x] === 'b' && y >= 12 && (x + y) % 2 === 0) g[y][x] = 'd';
    stampOn(g, ANGLER_TAIL[fr], 2, 0);
    rect(g, 14, 10, 18, 11, 'm');                              // wide mouth cut into the front edge
    rect(g, 12, 6, 14, 8, 'w'); put(g, 13, 7, 'e'); put(g, 14, 7, 'e'); put(g, 14, 8, 'e'); put(g, 12, 6, 'b');   // big eye
    for (const [x, y] of [[7, 13], [8, 13], [9, 13]]) put(g, x, y, 'f');                 // belly fin
    for (const [x, y] of [[9, 4], [10, 4], [11, 4]]) put(g, x, y, 'f');                  // dorsal spines
    outline(g, 'o');
    for (const x of [14, 16, 18]) put(g, x, 10, 't');          // teeth: upper jaw hangs into the opening, lower rises
    for (const x of [15, 17]) put(g, x, 11, 't');
    const L = ANGLER_LURE[fr];
    for (const [x, y] of [[11, 3], [12, 2], [13, 1], [14, 1], [15, L.y + 2]]) put(g, x, y, 's');    // stalk, drawn after the outline
    return remap(g, { o: 0, b: 1, d: 0, t: 3, w: 3, e: 0, f: 1, s: 3, m: 0 });
}
function stampOn(g, rows, ox, oy) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, ox + i, oy + j, ch); })); }
for (let f = 0; f < 3; f++) addSprite('ang-' + f, anglerFrame(f));
const LURES = [
    ['........', '........', '...oo...', '..o22o..', '..o22o..', '...oo...', '........', '........'],
    ['........', '........', '...oo...', '..o33o..', '..o33o..', '...oo...', '........', '........'],
    ['........', '...22...', '..2oo2..', '.2o33o2.', '.2o33o2.', '..2oo2..', '...22...', '........']
];
LURES.forEach((r, i) => addSprite('lure-' + i, remap(parse(r), {})));

// ── ORCA 40x16 (faces right, art 36 x 14) ─────────────────────
// b black, g sheen, w white, e eye
function orcaFrame(fr) {
    const g = mk(40, 16);
    superellipse(g, 23.5, 9.4, 13.2, 3.9, 2.7, 'b');
    stampOn(g, ['...bb.', '..bbb.', '..bbbb', '.bbbbb', '.bbbbb', 'bbbbbb'], 18, 1);       // tall swept dorsal fin
    const tail = [
        ['...bb.....', '...bbb....', '....bbb...', '....bbbbbb', '.....bbbbb', '.....bbbbb', '....bbb...', '...bbb....', '...bb.....'],
        ['..........', '...bb.....', '...bbb....', '....bbbbbb', '.....bbbbb', '.....bbbbb', '....bbb...', '...bbb....', '...bb.....'],
        ['..........', '..........', '..........', '....bbbbbb', '.....bbbbb', '.....bbbbb', '....bbb...', '...bbb....', '..bbb.....']
    ];
    stampOn(g, tail[fr], 2, 5);
    stampOn(g, ['bb..', '.bbb', '..bb'], 24, 12);                                       // flipper
    for (let y = 0; y < 16; y++) for (let x = 0; x < 40; x++) if (g[y][x] === 'b') {
        if (y >= 11 && x >= 14 && !(y === 11 && x < 18)) g[y][x] = 'w';
        else if (y === 10 && x >= 29) g[y][x] = 'w';
    }
    rect(g, 29, 7, 32, 8, 'w'); put(g, 29, 7, 'b'); put(g, 32, 7, 'b'); put(g, 31, 7, 'e'); put(g, 31, 8, 'e');   // eye patch + eye
    for (const x of [24, 26, 28, 30, 32]) if (g[6][x] === 'b') g[6][x] = 'g';              // light along the back (top-left light)
    outline(g, 'o');
    return remap(g, { o: 0, b: 0, g: 1, w: 3, e: 0 });
}
for (let f = 0; f < 3; f++) addSprite('orca-' + f, orcaFrame(f));

// ── JELLYFISH 16x16 (bell 12 wide) and 8x16 (small bell) ──────
// m bell, h highlight, r rim, n tentacle
function jellyFrame(fr, wide) {
    const w = wide ? 16 : 8, g = mk(w, 16), cx = (w - 1) / 2;
    const rx = (wide ? 5.0 : 3.0) + [0, -0.6, 0.7][fr], ry = [4.4, 5.0, 3.9][fr], top = 1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx, dy = (y - (top + ry)) / ry;
        if (y <= top + ry && dx * dx + dy * dy <= 1) g[y][x] = 'm';
    }
    const base = Math.round(top + ry);
    for (let x = 0; x < w; x++) if (g[base][x] === 'm') g[base][x] = 'r';
    put(g, wide ? 4 : 2, top + 1, 'h'); put(g, wide ? 5 : 3, top + 1, 'h'); put(g, wide ? 3 : 2, top + 2, 'h');
    outline(g, 'o');
    const strands = wide ? [Math.round(cx - 3), Math.round(cx), Math.round(cx + 3)] : [Math.round(cx - 1.5), Math.round(cx + 1.5)];
    strands.forEach((sx, k) => {
        for (let y = base + 1; y < base + 8; y++) {
            const wob = Math.round(Math.sin((y + fr * 1.6 + k * 1.7) * 0.8) * 0.7);
            put(g, sx + wob, y, 'n');
        }
    });
    return remap(g, { o: 0, m: 2, h: 3, r: 3, n: 2 });
}
for (let f = 0; f < 3; f++) { addSprite('j16-' + f, jellyFrame(f, true)); addSprite('j8-' + f, jellyFrame(f, false)); }

function withOutline(g) { const o = mk(g[0].length + 2, g.length + 2); g.forEach((r, y) => r.forEach((c, x) => { o[y + 1][x + 1] = c; })); outline(o, '0'); return o; }
// ── WORM (4x4, 3 wiggle frames), BUBBLES (2x2, 3x3, 4x4), sparkle (2 frames) ──
const WORMS = [['bh', 'b.'], ['bh', '.b'], ['b.', 'bh']];
WORMS.forEach((r, i) => addSprite('worm-' + i, fit(withOutline(remap(parse(r), { b: 2, h: 3 })), 8, 8)));
// bubbles: light arc top left, dark arc bottom right (reads on light and dark water alike)
const BUBBLES = [['30', '00'], ['.3.', '3.0', '.0.'], ['.33.', '3..0', '3..0', '.00.']];
BUBBLES.forEach((r, i) => addSprite('bub-' + i, fit(parse(r), 8, 8)));
const SPARKS = [['..3..', '..3..', '33.33', '..3..', '..3..'], ['3...3', '.3.3.', '.....', '.3.3.', '3...3']];
SPARKS.forEach((r, i) => addSprite('spark-' + i, fit(remap(parse(r), {}), 8, 8)));

// ══ BACKGROUND (BG layer) ═════════════════════════════════════
// Layout of the 360-row virtual screen (see Ambient.qml): top lit layer (shade 2) with the surface line and
// light shafts, a 3-row dither seam, the open water (shade 1), a second seam, deep water (shade 0) and the
// seabed. Every tone change is ONE clean 3-row dither strip; everything else is flat.
const BAYER_ROWS = (hi, lo) => [          // 8 wide, 3 rows: 25 %, 50 %, 75 % of `lo`
    Array.from({ length: 8 }, (_, x) => String(x % 4 === 0 ? lo : hi)),
    Array.from({ length: 8 }, (_, x) => String(x % 2 === 1 ? lo : hi)),
    Array.from({ length: 8 }, (_, x) => String(x % 4 === 2 ? hi : lo))
];
const FLAT = [0, 1, 2, 3].map(s => mk(8, 8).map(r => r.map(() => String(s))));
const SEAM21 = BAYER_ROWS(2, 1), SEAM10 = BAYER_ROWS(1, 0);

// surface line (16x8, seamless): foam (3) down to a wavy edge, one dark line (1) under it, then the lit water (2)
function surfaceTile() {
    const g = mk(16, 8);
    for (let x = 0; x < 16; x++) {
        const c = 2 + Math.round(1.4 * Math.sin(x / 16 * 2 * Math.PI));
        for (let y = 0; y < 8; y++) g[y][x] = y <= c ? '3' : (y === c + 1 ? '1' : '2');
    }
    return g;
}
const SURF = surfaceTile();

// light shafts: flat bands of the lightest shade (over the lit layer: one shade up, hardly any contrast);
// 320 x 80 seamless, slope 1:2
function shafts() {
    const W = 320, H = 80, g = mk(W, H);
    for (const [x0, wd] of [[40, 44], [196, 28]]) for (let y = 0; y < H; y++) for (let k = 0; k < wd; k++) g[y][(x0 + (y >> 1) + k) % W] = '3';
    return g;
}
const SHAFTS = shafts();

// sand strip 128 x 24, seamless: smooth contour, lit edge (2), body (1), deep (0), a few deliberate pebbles
function sandStrip() {
    const W = 128, H = 24, g = mk(W, H);
    for (let x = 0; x < W; x++) {
        const t = x / W * 2 * Math.PI;
        const top = Math.max(2, Math.min(4, Math.round(3 + 1.1 * Math.sin(2 * t) + 0.7 * Math.sin(5 * t + 1))));
        for (let y = top; y < H; y++) g[y][x] = y <= top + 1 ? '2' : (y <= top + 6 ? '1' : '0');
    }
    for (const [x, dy] of [[12, 4], [47, 5], [83, 4], [110, 5]]) {
        let top = 0; while (g[top][x] === '.') top++;
        put(g, x, top + dy, '2'); put(g, x + 1, top + dy, '2');
    }
    return g;
}
const SAND = sandStrip();

// boulder: dome, lit from the upper left (2), shadow underneath (0), outline (0)
function boulder(w, h) {
    const g = mk(w, h), cx = (w - 1) / 2, rx = w / 2 - 0.4, ry = h - 0.9;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx, dy = (y - (h - 1)) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let c = '1';
        const hx = (x - (cx - rx * 0.30)) / (rx * 0.55), hy = (y - (h - 1 - ry * 0.62)) / (ry * 0.30);
        if (hx * hx + hy * hy <= 1) c = '2';
        if (y >= h - 2) c = '0';
        g[y][x] = c;
    }
    const o = mk(w + 2, h + 1);
    g.forEach((r, y) => r.forEach((c, x) => { o[y + 1][x + 1] = c; }));
    outline(o, '0');
    for (let x = 0; x < o[0].length; x++) if (o[h][x] === '0') o[h][x] = '.';       // flat underside: the sand covers it
    return o.slice(0, h);
}
// organ-pipe coral: three tubes, lit left edge, open mouth
function tubes() {
    const hs = [10, 14, 8], H = 14, g = mk(18, H);
    hs.forEach((h, k) => {
        const x0 = k * 6, top = H - h;
        for (let y = top; y < H; y++) for (let x = 0; x < 5; x++) g[y][x0 + x] = x === 0 ? '3' : (x === 4 ? '1' : '2');
        for (let x = 0; x < 5; x++) g[top][x0 + x] = '0';
        for (let x = 1; x < 4; x++) g[top + 1][x0 + x] = '1';
    });
    const o = mk(20, H + 1);
    g.forEach((r, y) => r.forEach((c, x) => { o[y][x + 1] = c; }));
    outline(o, '0');
    return o.slice(0, H);
}
// brain-coral cluster: three domes
function lobes() {
    const H = 14, g = mk(30, H);
    for (const [cx, w, h] of [[7, 13, 10], [17, 15, 14], [25, 8, 7]]) {
        const rx = w / 2, ry = h - 0.5;
        for (let y = 0; y < H; y++) for (let x = 0; x < 30; x++) {
            const dx = (x - cx) / rx, dy = (y - (H - 1)) / ry;
            if (dx * dx + dy * dy > 1) continue;
            let c = '2';
            const hx = (x - (cx - rx * 0.3)) / (rx * 0.5), hy = (y - (H - 1 - ry * 0.62)) / (ry * 0.28);
            if (hx * hx + hy * hy <= 1) c = '3';
            if (dx * 0.6 + dy * 0.4 > 0.55) c = '1';
            g[y][x] = c;
        }
    }
    const o = mk(32, H + 1);
    g.forEach((r, y) => r.forEach((c, x) => { o[y][x + 1] = c; }));
    outline(o, '0');
    return o.slice(0, H);
}
const PROPS = { rockL: boulder(34, 18), rockM: boulder(24, 13), rockS: boulder(15, 8), tubes: tubes(), lobes: lobes() };

// kelp: ribbon fronds (3 interior texels wide + outline), the centre line sways with the frame; fronds are 16 wide
function frond(h, frame, seed) {
    const W = 16, g = mk(W, h);
    let prev = 0;
    for (let i = 0; i < h; i++) {
        const y = h - 1 - i, amp = Math.min(3.0, i / 9);
        let off = Math.round(amp * Math.sin(i * 0.19 + seed + frame * 1.15));
        off = Math.max(prev - 1, Math.min(prev + 1, off)); prev = off;
        const tip = h - 1 - i;                           // rows left to the top
        const ks = tip >= 6 ? [-1, 0, 1, 2] : (tip >= 4 ? [-1, 0, 1] : (tip >= 2 ? [0, 1] : [0]));
        ks.forEach(k => { g[y][7 + off + k] = k <= 0 && ks.length > 1 ? '2' : '1'; });
        if (i > 8 && (i === Math.round(h * 0.36) || i === Math.round(h * 0.64))) {       // side blades
            const dir = (i === Math.round(h * 0.36)) === (seed > 1) ? 1 : -1;
            for (let b = 1; b <= 4; b++) { put(g, 7 + off + dir * (1 + b), y - (b >> 1), '1'); put(g, 7 + off + dir * (1 + b), y - (b >> 1) - 1, b === 1 ? '1' : '.'); }
        }
    }
    const o = mk(W + 2, h + 2);
    g.forEach((r, y) => r.forEach((c, x) => { o[y + 1][x + 1] = c; }));
    outline(o, '0');
    return o;
}
function kelpClump(frame, spec) {                         // spec: [[dx, h, seed], ...] back to front
    const W = 36, H = 58, g = mk(W, H);
    for (const [dx, h, seed] of spec) {
        const f = frond(h, frame, seed);
        f.forEach((r, y) => r.forEach((c, x) => { if (c !== '.') put(g, dx + x, H - f.length + y, c); }));
    }
    return g;
}
const KELP = [[[2, 40, 0.6], [12, 56, 2.2], [20, 32, 4.0]], [[0, 34, 1.4], [11, 48, 3.1]], [[3, 26, 2.9], [11, 40, 0.3], [18, 24, 5.0]]];
const KELP_ART = KELP.map((spec, i) => [kelpClump(0, spec), kelpClump(1, spec)]);
function trimmed(g) { const b = bbox(g); return g.slice(b.y0, b.y1 + 1).map(r => r.slice(b.x0, b.x1 + 1)); }
const KELP_TRIM = KELP_ART.map(p => p.map(trimmed));   // frames may differ in width: use the union box
KELP_ART.forEach((pair, i) => { const b0 = bbox(pair[0]), b1 = bbox(pair[1]), x0 = Math.min(b0.x0, b1.x0), x1 = Math.max(b0.x1, b1.x1), y0 = Math.min(b0.y0, b1.y0); KELP_TRIM[i] = pair.map(g => g.slice(y0).map(r => r.slice(x0, x1 + 1))); });

// placement on the seabed: fx = centre as a share of the screen width; `m` mirrors; kelp is drawn behind props
const LAYOUT = [
    { k: 'kelp', v: 0, fx: 0.085 }, { k: 'prop', v: 'rockL', fx: 0.055 }, { k: 'prop', v: 'tubes', fx: 0.15 }, { k: 'prop', v: 'rockS', fx: 0.215, m: 1 },
    { k: 'kelp', v: 2, fx: 0.335 }, { k: 'prop', v: 'rockM', fx: 0.375, m: 1 },
    { k: 'prop', v: 'lobes', fx: 0.5 }, { k: 'kelp', v: 1, fx: 0.585 }, { k: 'prop', v: 'rockS', fx: 0.63 },
    { k: 'prop', v: 'rockL', fx: 0.725, m: 1 }, { k: 'kelp', v: 0, fx: 0.80, m: 1 }, { k: 'prop', v: 'tubes', fx: 0.865, m: 1 },
    { k: 'kelp', v: 1, fx: 0.945, m: 1 }, { k: 'prop', v: 'rockM', fx: 0.97 }
];
const GEOM = { seabedRows: 24, kelpRows: Math.max(...KELP_TRIM.map(p => p[0].length)), sandRows: 24, zoneA: 0.15, seamB: 0.72 };

// ══ atlases ═══════════════════════════════════════════════════
function pack(items, width) {                         // shelf packing, tallest first; items: [name, w, h]
    const order = items.slice().sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
    const rects = {}; let x = 0, y = 0, rowH = 0;
    for (const [name, w, h] of order) {
        if (x + w > width) { y += rowH; x = 0; rowH = 0; }
        rects[name] = [x, y, w, h]; x += w; rowH = Math.max(rowH, h);
    }
    return { rects, W: width, H: y + rowH };
}
function paint(im, g, ox, oy, map) {
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
        let c = g[y][x]; if (c === '.') continue;
        if (c === 'o') c = '0';
        const k = RGB[map[+c]], d = ((oy + y) * im.W + ox + x) * 4;
        im.px[d] = k[0]; im.px[d + 1] = k[1]; im.px[d + 2] = k[2]; im.px[d + 3] = 255;
    }
}
const newImage = (W, H) => ({ W, H, px: Buffer.alloc(W * H * 4) });

// every BG piece by name
function bgPieces() {
    const p = { 'flat0': FLAT[0], 'flat1': FLAT[1], 'flat2': FLAT[2], 'flat3': FLAT[3], seam21: SEAM21, seam10: SEAM10, surf: SURF, shafts: SHAFTS, sand: SAND };
    for (const k in PROPS) p['prop-' + k] = PROPS[k];
    KELP_TRIM.forEach((pair, i) => { p['kelp' + i + 'A'] = pair[0]; p['kelp' + i + 'B'] = pair[1]; });
    return p;
}

function allImages() {
    const out = {}, atlas = {};
    // OBJ atlases: one per OBP mapping (identity, dimmed, inverted)
    const P = pack(Object.keys(sprites).map(n => [n, sprites[n].w, sprites[n].h]), 256);
    atlas.OBJ = P.rects;
    for (const m of OBJ_ORDER) {
        const im = newImage(P.W, P.H);
        for (const n in sprites) paint(im, sprites[n].grid, P.rects[n][0], P.rects[n][1], OBJ_MAPS[m]);
        out['obj-' + m + '.png'] = im;
    }
    // BG atlases: one per BGP fade
    const pcs = bgPieces(), B = pack(Object.keys(pcs).map(n => [n, pcs[n][0].length, pcs[n].length]), 512);
    const r = B.rects;
    atlas.BG = {
        flat: [r.flat0, r.flat1, r.flat2, r.flat3], seam21: r.seam21, seam10: r.seam10, surf: r.surf, shafts: r.shafts, sand: r.sand,
        props: Object.fromEntries(Object.keys(PROPS).map(k => [k, r['prop-' + k]])),
        kelp: KELP_TRIM.map((_, i) => [r['kelp' + i + 'A'], r['kelp' + i + 'B']])
    };
    for (const m of BG_ORDER) {
        const im = newImage(B.W, B.H);
        for (const n in pcs) paint(im, pcs[n], r[n][0], r[n][1], BG_MAPS[m]);
        out['bg-' + m + '.png'] = im;
    }
    atlas.LURE = ANGLER_LURE;
    atlas.LAYOUT = LAYOUT;
    atlas.GEOM = GEOM;
    return { out, atlas };
}

// ── hardware budget: unique 8x8 tiles (palette-independent, flips folded) ──
function tileStats() {
    const key = t => t.map(r => r.join('').replace(/o/g, '0')).join('|');
    const variants = t => { const h = t.map(r => r.slice().reverse()), v = t.slice().reverse(), hv = h.slice().reverse(); return [t, h, v, hv].map(key); };
    const norm = t => variants(t).sort()[0];
    const sliceTiles = (g, set) => {
        const W = Math.ceil(g[0].length / 8) * 8, H = Math.ceil(g.length / 8) * 8;
        for (let ty = 0; ty < H / 8; ty++) for (let tx = 0; tx < W / 8; tx++) {
            const t = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => get(g, tx * 8 + x, ty * 8 + y)));
            if (t.every(r => r.every(c => c === '.'))) continue;
            set.add(norm(t));
        }
    };
    const obj = new Set(), bg = new Set(), pcs = bgPieces();
    for (const n in sprites) sliceTiles(sprites[n].grid, obj);
    for (const n in pcs) sliceTiles(pcs[n], bg);
    return { obj: obj.size, bg: bg.size };
}

function atlasJs(atlas, stats) {
    return '.pragma library\n// GENERATED by tools/gen-gameboy-theme.js - do not edit.\n' +
        '// Sprite rectangles inside the OBJ atlases (obj-n0/n1/i0.png: one per palette register mapping) and\n' +
        '// the BG atlases (bg-day/dusk/night.png: one per BGP fade). Unique 8x8 tiles: OBJ ' + stats.obj + ', BG ' + stats.bg + ' of 384.\n' +
        'var OBJ = ' + JSON.stringify(atlas.OBJ) + ';\n' +
        'var BG = ' + JSON.stringify(atlas.BG) + ';\n' +
        'var LURE = ' + JSON.stringify(atlas.LURE) + ';\n' +
        'var LAYOUT = ' + JSON.stringify(atlas.LAYOUT) + ';\n' +
        'var GEOM = ' + JSON.stringify(atlas.GEOM) + ';\n' +
        'var SHADES = ' + JSON.stringify(SHADES) + ';\n';
}

// ── contact sheet (scaled) ──
function sheet(file, S) {
    S = S || 6;
    const PAD = 2, MAXW = 1900;
    const names = Object.keys(sprites);
    const pick = re => names.filter(n => re.test(n));
    const groups = [
        pick(/^fL-/), pick(/^fM-/), pick(/^fS-/), pick(/^fF-/).concat(pick(/^fB-/)),
        ['ang-0', 'ang-1', 'ang-2', 'lure-0', 'lure-1', 'lure-2'], ['orca-0', 'orca-1', 'orca-2'],
        pick(/^j16-|^j8-|^worm-|^bub-|^spark-/)
    ];
    const rows = [];
    for (const grp of groups) {
        let cur = [], cw = PAD * S;
        for (const n of grp) { const w = (sprites[n].w + PAD) * S; if (cw + w > MAXW) { rows.push(cur); cur = []; cw = PAD * S; } cur.push(n); cw += w; }
        rows.push(cur);
    }
    const rh = rows.map(r => Math.max(...r.map(n => sprites[n].h)) * S + PAD * S);
    const H = rh.reduce((a, b) => a + b, 0);
    // three background stripes (shades 2, 1, 0 = lit layer, open water, deep water) show how each sprite reads
    const px = Buffer.alloc(MAXW * H * 4);
    const only = process.env.SHEETBG, band = x => only ? +only : (x < MAXW / 3 ? 2 : (x < 2 * MAXW / 3 ? 1 : 0));
    for (let y = 0; y < H; y++) for (let x = 0; x < MAXW; x++) { const k = RGB[band(x)], d = (y * MAXW + x) * 4; px[d] = k[0]; px[d + 1] = k[1]; px[d + 2] = k[2]; px[d + 3] = 255; }
    let oy = 0;
    rows.forEach((r, ri) => {
        let ox = PAD * S;
        for (const n of r) {
            const s = sprites[n];
            for (let y = 0; y < s.h * S; y++) for (let x = 0; x < s.w * S; x++) {
                const c = s.grid[y / S | 0][x / S | 0]; if (c === '.') continue;
                const k = RGB[+c], d = ((oy + y) * MAXW + ox + x) * 4; px[d] = k[0]; px[d + 1] = k[1]; px[d + 2] = k[2];
            }
            ox += (s.w + PAD) * S;
        }
        oy += rh[ri];
    });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png.encode(MAXW, H, px));
}

// ── main ──
const { out: IMAGES, atlas: ATLAS } = allImages();
const STATS = tileStats();
if (STATS.obj > 256) throw new Error('OBJ tiles: ' + STATS.obj + ' > 256');
if (STATS.bg > 256) throw new Error('BG tiles: ' + STATS.bg + ' > 256');
if (STATS.obj + STATS.bg > 384) throw new Error('VRAM: ' + (STATS.obj + STATS.bg) + ' tiles > 384');
const ATLAS_JS = atlasJs(ATLAS, STATS);
const same = (f, im) => {
    if (!fs.existsSync(f)) return false;
    const old = png.decode(fs.readFileSync(f));
    return old.W === im.W && old.H === im.H && Buffer.compare(old.px, im.px) === 0;
};
if (require.main === module) {
    const si = process.argv.indexOf('--sheet');
    if (si > 0) sheet(process.argv[si + 1], +process.argv[si + 2] || 6);
    if (process.argv.includes('--check')) {
        let bad = 0;
        for (const f in IMAGES) if (!same(path.join(OUT, f), IMAGES[f])) { console.error('stale: ' + f); bad++; }
        if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (!IMAGES[f]) { console.error('extra: ' + f); bad++; }
        const aj = path.join(DIR, 'atlas.js');
        if (!fs.existsSync(aj) || fs.readFileSync(aj, 'utf8') !== ATLAS_JS) { console.error('stale: atlas.js'); bad++; }
        process.exit(bad ? 1 : 0);
    }
    if (si < 0 || process.argv.includes('--write')) {
        fs.mkdirSync(OUT, { recursive: true });
        for (const f of fs.readdirSync(OUT)) if (!IMAGES[f]) fs.unlinkSync(path.join(OUT, f));
        let bytes = 0;
        for (const f in IMAGES) { const b = png.encode(IMAGES[f].W, IMAGES[f].H, IMAGES[f].px); fs.writeFileSync(path.join(OUT, f), b); bytes += b.length; }
        fs.writeFileSync(path.join(DIR, 'atlas.js'), ATLAS_JS);
        console.log(Object.keys(sprites).length + ' sprites, ' + Object.keys(IMAGES).length + ' images, ' + (bytes / 1024).toFixed(0) + ' KiB; unique tiles OBJ ' + STATS.obj + ' / BG ' + STATS.bg + ' (VRAM 384)');
    }
}
module.exports = { sprites, SHADES, ATLAS, IMAGES, STATS, bgPieces };
