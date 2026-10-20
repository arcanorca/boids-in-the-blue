// Generates the "gameboy" theme's art (contents/themes/gameboy/img/*.png + atlas.js) and, optionally,
// the 8x contact sheet. Everything is authored here as 8x8 tiles in the four DMG shades:
//   * OBJ sprites: ASCII fills -> auto outline -> metasprites of 8x8 tiles (8x8, 16x8, 24x16, 32x16,
//     8x16, 16x16). Each sprite may use at most THREE shades (+ transparent), like an OBJ palette.
//   * BG: a 64x14 tile map (seabed, rocks, kelp, sand) + dithered water tiles + water-surface tiles.
//   * Palette registers: the same art is written once per mapping (BGP fades for day/dusk/night,
//     OBP inversion for stress) as small atlases; no colour is ever computed at run time.
//   node tools/gen-gameboy-theme.js [--check] [--sheet <out.png>] [--write]
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
const BG_MAPS = { day: [0, 1, 2, 3], dusk: [0, 0, 1, 2], night: [0, 0, 1, 1] };   // BGP fades
const BG_ORDER = ['day', 'dusk', 'night'];

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const parse = rows => rows.map(r => [...r]);
function check(rows, w, h, name) {
    if (rows.length !== h) throw new Error(name + ': ' + rows.length + ' rows, want ' + h);
    rows.forEach((r, i) => { if (r.length !== w) throw new Error(name + ' row ' + i + ': ' + r.length + ' cols, want ' + w + ' (' + r + ')'); });
}
function stamp(g, rows, ox, oy, over) {            // '.' = leave; over=false keeps cells already set
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
        if (ch === '.') return;
        const x = ox + i, y = oy + j;
        if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return;
        if (over === false && g[y][x] !== '.') return;
        g[y][x] = ch === '~' ? '.' : ch;
    }));
}
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
const flipH = g => g.map(r => r.slice().reverse());
function ellipse(g, cx, cy, rx, ry, ch, only) {     // fills cells whose centre lies inside the ellipse
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!only || only(g[y][x]))) g[y][x] = ch;
    }
}
function rect(g, x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch); }
function shadesOf(g) { const s = new Set(); g.forEach(r => r.forEach(c => { if (c !== '.') s.add(+c); })); return [...s].sort(); }

// ── OBJ art: sprites are objects { w, h, grid (shade digits), tag } ──
const sprites = {};
function addSprite(name, g, maxShades) {
    const w = g[0].length, h = g.length;
    if (w % 8 || h % 8) throw new Error(name + ': ' + w + 'x' + h + ' is not made of 8x8 tiles');
    const sh = shadesOf(g);
    if (sh.length > (maxShades || 3)) throw new Error(name + ' uses ' + sh.length + ' shades (' + sh + '), an OBJ palette has 3');
    sprites[name] = { w, h, grid: g };
}
// the same art on a bigger canvas (centred) so every sprite is a whole number of tiles
function canvas(g, w, h) {
    const o = mk(w, h), ox = (w - g[0].length) >> 1, oy = (h - g.length) >> 1;
    g.forEach((r, j) => r.forEach((c, i) => { o[oy + j][ox + i] = c; }));
    return o;
}


// ── FISH ─────────────────────────────────────────────────────
// 16x8, faces right. b body, h belly, f fin, e eye, p marking, o outline (auto).
function fishBase(tail) {
    const g = mk(16, 8);
    ellipse(g, 9.7, 3.5, 4.9, 2.95, 'b');
    for (let y = 5; y <= 6; y++) for (let x = 0; x < 16; x++) if (g[y][x] === 'b') g[y][x] = 'h';
    put(g, 12, 3, 'e');
    rect(g, 8, 1, 10, 1, 'f');                            // dorsal fin
    put(g, 9, 4, 'f'); put(g, 8, 5, 'f'); put(g, 9, 5, 'f');   // pectoral fin
    stamp(g, tail, 0, 0, true);
    outline(g, 'o');
    return g;
}
const FISH_TAIL = [                                  // cols 0..4: spread, narrow, flicked up
    ['.....', 'ff...', 'fff..', '.fff.', '.fff.', 'fff..', 'ff...', '.....'],
    ['.....', '.....', '.ff..', '.fff.', '.fff.', '.ff..', '.....', '.....'],
    ['ff...', 'fff..', '.ff..', '.fff.', '..ff.', '..f..', '.....', '.....']
];
function fryBase(tail) {
    const g = mk(8, 8);
    ellipse(g, 4.2, 4.0, 2.4, 1.9, 'b');
    for (let x = 0; x < 8; x++) if (g[5][x] === 'b') g[5][x] = 'h';
    put(g, 5, 3, 'e');
    stamp(g, tail, 0, 0, true);
    outline(g, 'o');
    return g;
}
const FRY_TAIL = [
    ['.......', '.......', '.......', '.f.....', '.f.....', '.......', '.......', '.......'],
    ['.......', '.......', '.f.....', '.f.....', '.......', '.......', '.......', '.......'],
    ['.......', '.......', '.......', '.......', '.f.....', '.f.....', '.......', '.......']
];
function larvaBase(tail) {
    const g = mk(8, 8);
    rect(g, 3, 3, 5, 5, 'b'); put(g, 3, 3, '.'); put(g, 3, 5, '.'); put(g, 5, 3, 'b'); put(g, 4, 4, 'e'); put(g, 4, 3, 'b');
    stamp(g, tail, 0, 0, true);
    outline(g, 'o');
    return g;
}
const LARVA_TAIL = [['.......', '.......', '.......', '.......', '..f....', '.......', '.......', '.......'],
                    ['.......', '.......', '.......', '..f....', '.......', '.......', '.......', '.......']];

// species: DMG shade of each part (<= 3 distinct per sprite) + a marking painted on 'b' cells.
const FISH_VARIANTS = {
    coral:  { pal: { o: 0, b: 1, h: 3, f: 3, e: 3, p: 3 }, mark: () => false },                                         // dark with pale belly and fins
    amber:  { pal: { o: 0, b: 3, h: 3, f: 1, e: 0, p: 1 }, mark: (x, y) => (x === 7 || x === 10) && y >= 2 && y <= 5 },  // two dark bars
    lemon:  { pal: { o: 0, b: 3, h: 3, f: 2, e: 0, p: 0 }, mark: (x, y) => [[8, 3], [10, 2], [9, 4], [7, 4]].some(c => c[0] === x && c[1] === y) },   // spots
    aqua:   { pal: { o: 0, b: 2, h: 3, f: 3, e: 0, p: 3 }, mark: (x, y) => y === 4 && x >= 6 && x <= 10 },              // light flank stripe
    orchid: { pal: { o: 0, b: 1, h: 2, f: 2, e: 2, p: 2 }, mark: (x, y) => y <= 4 && x >= 6 && x <= 9 && (x + y) % 2 === 0 }   // dithered back
};
const FISH_ORDER = ['coral', 'amber', 'lemon', 'aqua', 'orchid'];
function mark(g, V, small) {
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === 'b' && (small ? V.small(x, y) : V.mark(x, y))) g[y][x] = 'p';
}
FISH_VARIANTS.coral.small = () => false;
FISH_VARIANTS.amber.small = (x, y) => x === 4 && y >= 2 && y <= 4;
FISH_VARIANTS.lemon.small = (x, y) => (x === 4 && y === 3) || (x === 3 && y === 2);
FISH_VARIANTS.aqua.small = (x, y) => y === 3 && x >= 3 && x <= 4;
FISH_VARIANTS.orchid.small = (x, y) => y === 2 && (x === 3 || x === 5);
for (const v of FISH_ORDER) {
    const V = FISH_VARIANTS[v];
    for (let f = 0; f < 3; f++) {
        const g = fishBase(FISH_TAIL[f]); mark(g, V, false); addSprite('f16-' + v + '-' + f, remap(g, V.pal));
        const h = fryBase(FRY_TAIL[f]); mark(h, V, true); addSprite('f8-' + v + '-' + f, remap(h, V.pal));
    }
    for (let f = 0; f < 2; f++) addSprite('fb-' + v + '-' + f, remap(larvaBase(LARVA_TAIL[f]), V.pal));
}

// ── ANGLER 24x16 (faces right) ────────────────────────────────
// The lure bulb is a separate 8x8 tile drawn at LURE[frame] (top-left of its 2x2 core).
// b body, d dark scales, t tooth, w eye white, e pupil, f fin, s stalk
const ANGLER_TAIL = [
    ['......', '......', '......', 'f.....', 'ff....', '.ff...', '..ff..', '..ff..', '.ff...', 'ff....', 'f.....', '......', '......', '......', '......', '......'],
    ['......', '......', '......', '......', 'f.....', 'ff....', '.fff..', '.fff..', 'ff....', 'f.....', '......', '......', '......', '......', '......', '......'],
    ['......', '......', '......', '......', '......', '.f....', '.ff...', '..ff..', '..ff..', '.ff...', 'ff....', 'ff....', 'f.....', '......', '......', '......']
];
const ANGLER_LURE = [{ x: 18, y: 1 }, { x: 18, y: 2 }, { x: 18, y: 1 }];   // core top-left per frame
function anglerFrame(fr) {
    const g = mk(24, 16);
    ellipse(g, 13.2, 9.6, 8.4, 5.3, 'b');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) if (g[y][x] === 'b' && y >= 11 && (x + y) % 2 === 0) g[y][x] = 'd';
    for (const [x, y] of [[9, 6], [12, 5], [14, 7], [11, 8], [7, 9]]) if (g[y][x] === 'b') g[y][x] = 't';   // light speckles
    stamp(g, ANGLER_TAIL[fr], 0, 0, true);
    rect(g, 19, 10, 22, 11, '.');                           // mouth cut-out (right edge)
    rect(g, 17, 7, 18, 7, 'w'); rect(g, 17, 8, 18, 8, 'w'); put(g, 18, 8, 'e');
    put(g, 10, 14, 'f'); put(g, 11, 14, 'f'); put(g, 12, 14, 'f');     // belly fin
    outline(g, 'o');
    // teeth: light cells along the mouth edge
    for (const x of [18, 20, 22]) { put(g, x, 9, 't'); }
    for (const x of [19, 21]) put(g, x, 12, 't');
    // stalk (thin, drawn after the outline), ends against the bulb
    const L = ANGLER_LURE[fr];
    for (const [x, y] of [[12, 3], [13, 2], [14, 1], [15, 1], [16, 1], [17, L.y]]) put(g, x, y, 's');
    return remap(g, { o: 0, b: 1, d: 0, t: 3, w: 3, e: 0, f: 1, s: 0 });
}
for (let f = 0; f < 3; f++) addSprite('ang-' + f, anglerFrame(f));
const LURES = [
    ['........', '........', '..oooo..', '..o11o..', '..o11o..', '..oooo..', '........', '........'],
    ['........', '........', '..oooo..', '..o33o..', '..o33o..', '..oooo..', '........', '........'],
    ['...33...', '...33...', '.3oooo3.', '33o33o33', '33o33o33', '.3oooo3.', '...33...', '...33...']
];
LURES.forEach((r, i) => addSprite('lure-' + i, remap(parse(r), {})));

// ── ORCA 32x16 (faces right) ──────────────────────────────────
// b black, g sheen, w white, e eye
const ORCA_TAIL = [          // cols 0..9: flukes up / level / down (stock joins the body at col ~8)
    ['..........', '.bb.......', '.bbb......', '..bbb.....', '...bbb....', '...bbbbbb.', '....bbbbbb', '...bbbbbbb', '...bbbbbb.', '..bbb.....', '.bbb......', '.bb.......', '..........', '..........', '..........', '..........'],
    ['..........', '..........', '..........', '.bb.......', '.bbb......', '..bbb.....', '...bbbbbb.', '...bbbbbbb', '...bbbbbb.', '..bbb.....', '.bbb......', '.bb.......', '..........', '..........', '..........', '..........'],
    ['..........', '..........', '..........', '..........', '..........', '..........', '...bbbbbb.', '...bbbbbbb', '...bbbbbb.', '..bbb.....', '.bbb......', '..bbb.....', '..bb......', '.bb.......', '.b........', '..........']
];
function orcaFrame(fr) {
    const g = mk(32, 16);
    ellipse(g, 18.6, 8.6, 12.4, 4.6, 'b');
    // dorsal fin (swept back)
    stamp(g, ['..bb..', '..bbb.', '.bbbb.', '.bbbbb', 'bbbbbb'], 13, 1, true);
    stamp(g, ORCA_TAIL[fr], 0, 0, true);
    // white belly / chin, eye patch, sheen on the back
    for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) if (g[y][x] === 'b') {
        if (y >= 11 && x >= 12 && !(y === 11 && x < 15)) g[y][x] = 'w';
        else if (y === 10 && x >= 25) g[y][x] = 'w';
        else if (y === 5 && x >= 20 && x <= 28 && (x % 2 === 0)) g[y][x] = 'g';
    }
    rect(g, 24, 6, 27, 7, 'w'); put(g, 25, 7, 'e'); put(g, 26, 7, 'e');       // eye patch + eye
    rect(g, 14, 6, 17, 7, 'g'); rect(g, 15, 6, 16, 6, 'g');                    // saddle sheen
    outline(g, 'o');
    return remap(g, { o: 0, b: 0, g: 1, w: 3, e: 0 });
}
for (let f = 0; f < 3; f++) addSprite('orca-' + f, orcaFrame(f));

// ── JELLYFISH: 16x16 and 8x16, bell pulse in 3 frames ──────────
// m bell, h highlight, r rim, n tentacle
function jellyFrame(fr, wide) {
    const w = wide ? 16 : 8, g = mk(w, 16), cx = (w - 1) / 2;
    const rx = (wide ? 5.6 : 2.6) + [0, -1, 0.9][fr] * (wide ? 1 : 0.7), ry = [4.6, 5.6, 3.9][fr];
    const top = 1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx, dy = (y - (top + ry)) / ry;
        if (y <= top + ry && dx * dx + dy * dy <= 1) g[y][x] = 'm';
    }
    const base = Math.round(top + ry);
    for (let x = 0; x < w; x++) if (g[base][x] === 'm') g[base][x] = 'r';
    put(g, wide ? 5 : 2, top + 1, 'h'); put(g, wide ? 6 : 3, top + 1, 'h'); put(g, wide ? 4 : 2, top + 2, 'h');
    outline(g, 'o');
    // tentacles: wavy strands hanging from the rim
    const strands = wide ? [Math.round(cx - 3.5), Math.round(cx - 1.2), Math.round(cx + 1.2), Math.round(cx + 3.5)] : [Math.round(cx - 1.2), Math.round(cx + 1.2)];
    strands.forEach((sx, k) => {
        for (let y = base + 1; y < 16; y++) {
            const wob = Math.round(Math.sin((y + fr * 1.7 + k * 1.3) * 0.9) * 0.9);
            put(g, sx + wob, y, ((y - base) % 3 === 0) ? 'p' : 'n');
        }
    });
    return remap(g, { o: 0, m: 2, h: 3, r: 0, n: 0, p: 2 });
}
for (let f = 0; f < 3; f++) { addSprite('j16-' + f, jellyFrame(f, true)); addSprite('j8-' + f, jellyFrame(f, false)); }

// ── WORM 8x8 (wiggle: 3 frames), BUBBLE (2 sizes), sparkle (2 frames) ──
const WORMS = [
    ['...oo...', '..obbo..', '..ohho..', '..obbo..', '...obbo.', '...ohho.', '..obbo..', '...oo...'],
    ['...oo...', '...obbo.', '...ohho.', '..obbo..', '..ohho..', '..obbo..', '...obbo.', '...oo...'],
    ['...oo...', '..obbo..', '.obbho..', '..obbo..', '..ohho..', '...obbo.', '..obbo..', '...oo...']
];
WORMS.forEach((r, i) => addSprite('worm-' + i, remap(parse(r), { o: 0, b: 1, h: 3 })));
addSprite('bub-0', remap(parse(['........', '..oooo..', '.o....o.', '.o.h..o.', '.o....o.', '..oooo..', '........', '........']), { o: 0, h: 3 }));
addSprite('bub-1', remap(parse(['..oooo..', '.o....o.', 'o..hh..o', 'o.h....o', 'o......o', 'o......o', '.o....o.', '..oooo..']), { o: 0, h: 3 }));
addSprite('spark-0', remap(parse(['........', '...oo...', '...33...', '.o3333o.', '.o3333o.', '...33...', '...oo...', '........']), {}));
addSprite('spark-1', remap(parse(['........', '.o....o.', '..o33o..', '...33...', '...33...', '..o33o..', '.o....o.', '........']), {}));

// ══ BACKGROUND (BG layer: a tile map) ═════════════════════════
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 8x8 tile: shade `a`, with shade `b` on n/16 of the cells (ordered dither, tiles seamlessly)
function ditherTile(a, b, n) {
    return Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => String(BAYER[y % 4][x % 4] < n ? b : a)));
}
// water tiles, by id: 0..3 solid shades; 4..6 3->2 ramp; 7..9 2->1; 10..12 1->0 (dither 4/8/12 of 16)
const WATER = [0, 1, 2, 3].map(s => ditherTile(s, s, 0));
for (const [hi, lo] of [[3, 2], [2, 1], [1, 0]]) for (const n of [4, 8, 12]) WATER.push(ditherTile(hi, lo, n));
// surface strips (16x8, seamless): a sine wave seen from below, in two parallax rows
function waveStrip(amp, y0, phase, hi, mid, lo) {
    const g = mk(16, 8);
    for (let x = 0; x < 16; x++) {
        const y = y0 + Math.round(amp * Math.sin((x / 16 + phase) * 2 * Math.PI));
        put(g, x, y - 1, String(hi)); put(g, x, y, String(lo)); put(g, x, y + 1, String(mid));
    }
    return g;
}
const SURF = [waveStrip(1.6, 3, 0, 3, 2, 1), waveStrip(1.0, 3, 0.35, 3, 2, 2)];

// seabed: tile map of 64x14 tiles (512x112 px) in two kelp-sway frames
const SEA_COLS = 64, SEA_ROWS = 14, SEA_SAND_ROW = 10;
function lcg(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const T = {};                                         // named 8x8 tiles (digit grids, '.' transparent)
const tile = rows => { check(rows, 8, 8, 'tile'); return parse(rows); };
function sandTop(h, v) {                              // lit sand edge at row h, then shaded
    const g = mk(8, 8), r = lcg(h * 31 + v * 7 + 1);
    for (let y = h; y < 8; y++) for (let x = 0; x < 8; x++) {
        let c = y === h ? '3' : (y === h + 1 ? '3' : '2');
        if (y > h + 1 && (x + y) % 2 === 0) c = '3';
        if (r() < 0.07 && y > h) c = '1';
        g[y][x] = c;
    }
    return g;
}
for (const h of [3, 4, 5]) for (const v of [0, 1]) T['top' + h + '_' + v] = sandTop(h, v);
T.mid = [0, 1, 2].map(v => { const g = ditherTile(2, 3, 8), r = lcg(50 + v); for (let k = 0; k < 3; k++) put(g, Math.floor(r() * 8), Math.floor(r() * 8), '1'); return g; });
T.deep = [0, 1, 2].map(v => { const g = ditherTile(1, 2, 4), r = lcg(70 + v); for (let k = 0; k < 3; k++) put(g, Math.floor(r() * 8), Math.floor(r() * 8), '0'); return g; });
T.floor = [ditherTile(0, 1, 8), ditherTile(0, 1, 6)];
T.kelpA = tile(['..o11o..', '..o12o..', '.o112o..', 'o1121o..', '.o11o...', '..o11o..', '..o12o..', '..o11o..']);
T.kelpB = tile(['..o11o..', '..o21o..', '..o211o.', '..o1211o', '...o11o.', '..o11o..', '..o21o..', '..o11o..']);
T.kelpTop = tile(['...oo...', '..o11o..', '.o1121o.', '.o1111o.', '..o11o..', '..o11o..', '..o12o..', '..o11o..']);
T.grassA = tile(['........', '..o..o..', '.o1.o1..', '.o1o1o..', '..o1o1o.', '.o1o.o1o', 'o11o.o1o', 'o11oo11o']);
T.grassB = tile(['........', '.o..o...', '.1o.1o..', '.1o1o...', 'o1o1o...', 'o1o.o1o.', 'o1o.o11o', 'o11oo11o']);
T.shell = tile(['........', '........', '........', '........', '..oooo..', '.o3333o.', '.o3o3oo.', '..oooo..']);
// boulders: half-ellipse domes, lit from the upper left; their bottoms sink into the sand row
function boulder(w, h, seed) {
    const g = mk(w, h), cx = (w - 1) / 2, rx = w / 2 - 0.6, ry = h - 1.4, r = lcg(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx, dy = (y - (h - 1)) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let c = '1';
        if (dx * 0.8 + dy * 0.7 < -0.62) c = '2';
        if (dx * 0.8 + dy * 0.7 < -0.95) c = '3';
        if (dx * 0.5 - dy * 0.3 > 0.6 && (x + y) % 2 === 0) c = '0';
        if (c === '1' && r() < 0.06) c = '2';
        g[y][x] = c;
    }
    outline(g, '0');
    return g;
}
T.rockL = boulder(32, 16, 3);
T.rockM = boulder(24, 16, 5);
T.rockS = boulder(16, 8, 9);

function buildSeabed(frame) {
    const g = mk(SEA_COLS * 8, SEA_ROWS * 8), r = lcg(12345);
    const tileAt = (c, row, t) => stamp(g, t.map(rw => rw.join('')), c * 8, row * 8, true);
    // random-walk of the sand edge height (3..5, steps of 1)
    let h = 4; const hs = [];
    for (let c = 0; c < SEA_COLS; c++) { const q = r(); if (q < 0.25 && h > 3) h--; else if (q > 0.75 && h < 5) h++; hs.push(h); }
    for (let c = 0; c < SEA_COLS; c++) {
        tileAt(c, SEA_SAND_ROW, T['top' + hs[c] + '_' + (c % 2)]);
        tileAt(c, SEA_SAND_ROW + 1, T.mid[(c * 5) % 3]);
        tileAt(c, SEA_SAND_ROW + 2, T.deep[(c * 7) % 3]);
        tileAt(c, SEA_SAND_ROW + 3, T.floor[c % 2]);
    }
    const obj = (t, c, rowBottom) => stamp(g, t.map(rw => rw.join('')), c * 8, (rowBottom + 1) * 8 - t.length, true);
    // rocks first (kelp grows behind/between them)
    obj(T.rockL, 5, SEA_SAND_ROW); obj(T.rockM, 22, SEA_SAND_ROW); obj(T.rockS, 31, SEA_SAND_ROW);
    obj(T.rockL, 40, SEA_SAND_ROW); obj(T.rockS, 52, SEA_SAND_ROW); obj(T.rockM, 57, SEA_SAND_ROW);
    // kelp stalks: tile stacks swaying by alternating the two leaf tiles each frame
    for (const [c, ht] of [[2, 7], [3, 10], [12, 6], [13, 8], [27, 9], [28, 5], [29, 7], [46, 8], [47, 11], [62, 7], [63, 5]]) {
        for (let k = 0; k < ht; k++) {
            const row = SEA_SAND_ROW - k;
            const t = k === ht - 1 ? T.kelpTop : ((k + frame) % 2 ? T.kelpB : T.kelpA);
            tileAt(c, row, t);
        }
    }
    for (const c of [9, 16, 18, 34, 37, 49, 54, 60]) tileAt(c, SEA_SAND_ROW - 1, (c + frame) % 2 ? T.grassA : T.grassB);
    tileAt(14, SEA_SAND_ROW - 0, T.shell);
    return g;
}

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
    const A = buildSeabed(0), B = buildSeabed(1);
    const bgH = SEA_ROWS * 8 * 2 + 8 + 8;
    atlas.BG = { seaA: [0, 0, SEA_COLS * 8, SEA_ROWS * 8], seaB: [0, SEA_ROWS * 8, SEA_COLS * 8, SEA_ROWS * 8],
                 water: WATER.map((_, i) => [i * 8, SEA_ROWS * 16, 8, 8]), surf: SURF.map((_, i) => [i * 16, SEA_ROWS * 16 + 8, 16, 8]) };
    for (const m of BG_ORDER) {
        const im = newImage(SEA_COLS * 8, bgH);
        paint(im, A, 0, 0, BG_MAPS[m]); paint(im, B, 0, SEA_ROWS * 8, BG_MAPS[m]);
        WATER.forEach((t, i) => paint(im, t, i * 8, SEA_ROWS * 16, BG_MAPS[m]));
        SURF.forEach((t, i) => paint(im, t, i * 16, SEA_ROWS * 16 + 8, BG_MAPS[m]));
        out['bg-' + m + '.png'] = im;
    }
    // LCD glass: one n x n cell per integer scale 2..12 (a dark line along the right and bottom edge)
    const lcdRects = {}; let lx = 0;
    const lw = []; for (let n = 2; n <= 12; n++) lw.push(n);
    const L = newImage(lw.reduce((a, n) => a + n, 0), 12);
    for (const n of lw) {
        lcdRects[n] = [lx, 0, n, n];
        const a = n >= 4 ? 46 : (n === 3 ? 38 : 28);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (x === n - 1 || y === n - 1) {
            const d = (y * L.W + lx + x) * 4; L.px[d] = RGB[0][0]; L.px[d + 1] = RGB[0][1]; L.px[d + 2] = RGB[0][2]; L.px[d + 3] = a;
        }
        lx += n;
    }
    out['lcd.png'] = L; atlas.LCD = lcdRects;
    atlas.LURE = ANGLER_LURE;
    return { out, atlas };
}

// ── hardware budget: unique 8x8 tiles (palette-independent, flips folded) ──
function tileStats() {
    const key = t => t.map(r => r.join('').replace(/o/g, '0')).join('|');
    const variants = t => { const h = t.map(r => r.slice().reverse()), v = t.slice().reverse(), hv = h.slice().reverse(); return [t, h, v, hv].map(key); };
    const norm = t => variants(t).sort()[0];
    const sliceTiles = (g, set) => {
        for (let ty = 0; ty < g.length / 8; ty++) for (let tx = 0; tx < g[0].length / 8; tx++) {
            const t = Array.from({ length: 8 }, (_, y) => g[ty * 8 + y].slice(tx * 8, tx * 8 + 8));
            if (t.every(r => r.every(c => c === '.'))) continue;
            set.add(norm(t));
        }
    };
    const obj = new Set(), bg = new Set();
    for (const n in sprites) sliceTiles(sprites[n].grid, obj);
    sliceTiles(buildSeabed(0), bg); sliceTiles(buildSeabed(1), bg);
    WATER.forEach(t => sliceTiles(t, bg));
    SURF.forEach(t => sliceTiles(t, bg));
    return { obj: obj.size, bg: bg.size };
}

function atlasJs(atlas, stats) {
    return '.pragma library\n// GENERATED by tools/gen-gameboy-theme.js - do not edit.\n' +
        '// Sprite rectangles inside the OBJ atlases (obj-n0/n1/i0.png: one per palette register mapping) and\n' +
        '// the BG atlases (bg-day/dusk/night.png: one per BGP fade). Unique 8x8 tiles: OBJ ' + stats.obj + ', BG ' + stats.bg + ' of 384.\n' +
        'var OBJ = ' + JSON.stringify(atlas.OBJ) + ';\n' +
        'var BG = ' + JSON.stringify(atlas.BG) + ';\n' +
        'var LCD = ' + JSON.stringify(atlas.LCD) + ';\n' +
        'var LURE = ' + JSON.stringify(atlas.LURE) + ';\n' +
        'var SHADES = ' + JSON.stringify(SHADES) + ';\n';
}

// ── contact sheet (8x) ──
function sheet(file) {
    const S = 8, PAD = 2, MAXW = 1900;
    const groups = [
        FISH_ORDER.map(v => [0, 1, 2].map(f => 'f16-' + v + '-' + f)).reduce((a, b) => a.concat(b), []),
        FISH_ORDER.map(v => [0, 1, 2].map(f => 'f8-' + v + '-' + f)).reduce((a, b) => a.concat(b), []).concat(FISH_ORDER.map(v => 'fb-' + v + '-0')),
        ['ang-0', 'ang-1', 'ang-2', 'lure-0', 'lure-1', 'lure-2'],
        ['orca-0', 'orca-1', 'orca-2'],
        ['j16-0', 'j16-1', 'j16-2', 'j8-0', 'j8-1', 'j8-2', 'worm-0', 'worm-1', 'worm-2', 'bub-0', 'bub-1', 'spark-0', 'spark-1']
    ];
    const rows = [];
    for (const grp of groups) {
        let cur = [], cw = PAD * S;
        for (const n of grp) { const w = (sprites[n].w + PAD) * S; if (cw + w > MAXW) { rows.push(cur); cur = []; cw = PAD * S; } cur.push(n); cw += w; }
        rows.push(cur);
    }
    const rh = rows.map(r => Math.max(...r.map(n => sprites[n].h)) * S + PAD * S);
    const H = rh.reduce((a, b) => a + b, 0);
    // three background stripes (shades 3, 2, 1) show how each sprite reads on the water
    const px = Buffer.alloc(MAXW * H * 4);
    const band = x => (x < MAXW / 3 ? 3 : (x < 2 * MAXW / 3 ? 2 : 1));
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
    if (si > 0) sheet(process.argv[si + 1]);
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
module.exports = { sprites, SHADES, ATLAS, IMAGES, STATS };
