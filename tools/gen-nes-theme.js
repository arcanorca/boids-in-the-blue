// Generates the "nes" theme's textures (contents/themes/nes/img/*.png) and, optionally, the 8x
// sprite / tile contact sheets. The art is authored the way NES art is: 2-bit tiles (colour
// indices 0..3, no true colour anywhere), assembled into metasprites of 8x8 tiles that each carry
// ONE sprite palette, and a background painted onto a nametable whose 16x16 areas each carry ONE
// background palette. Only after that are the indices mapped through the 64-entry 2C02 palette
// (contents/themes/nes/theme.js) to the PNGs the QML scene shows with nearest-neighbour scaling.
// Hard checks (the script fails on a violation): every tile of a metasprite uses one palette,
// every palette entry is a valid $00..$3F colour, each 16x16 background area uses one BG palette,
// and the tile banks stay within the 256-tile limit of the PPU pattern tables.
//   node tools/gen-nes-theme.js [--check] [--sheet <sprites.png>] [--bg-sheet <bg.png>] [--stats]
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('../tests/png');
const { loadScript } = require('../tests/harness');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'contents', 'themes', 'nes', 'img');
const T = loadScript(path.join(ROOT, 'contents', 'themes', 'nes', 'theme.js'));

const rgb = idx => { const h = T.NES[idx]; return [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)); };
function fail(msg) { throw new Error(msg); }
function checkPal(name, p) {
    if (p.length !== 3) fail('palette ' + name + ' must have 3 colours');
    for (const c of p) if (!(c >= 0 && c <= 0x3F)) fail('palette ' + name + ': $' + c.toString(16) + ' is not a 2C02 colour');
}
for (const n in T.SPR_PAL) checkPal('spr ' + n, T.SPR_PAL[n]);
T.ALARM_STATES.forEach((p, i) => checkPal('alarm state ' + i, p));
for (const s of T.BG_STATES) { if (!(T.BG[s].u >= 0 && T.BG[s].u <= 0x3F)) fail('bg ' + s + ' universal colour'); T.BG[s].pal.forEach((p, i) => checkPal('bg ' + s + ' ' + i, p)); }
if (T.SPR_PAL_ORDER.length !== 4) fail('exactly four sprite palettes');
if (T.BG_STATES.some(s => T.BG[s].pal.length !== 4)) fail('exactly four background palettes');

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
function put(g, x, y, ch) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; }
function get(g, x, y) { return (y >= 0 && y < g.length && x >= 0 && x < g[0].length) ? g[y][x] : '.'; }
function ascii(g, rows, ox, oy) {            // '.' = leave, '~' = erase
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, (ox || 0) + i, (oy || 0) + j, ch === '~' ? '.' : ch); }));
}
function pts(g, ch, list) { for (const [x, y] of list) put(g, x, y, ch); }
function fromRows(rows) { return rows.map(r => [...r]); }
// 1px outline: transparent cells 4-adjacent to a filled cell become 'o'
function outline(g) {
    const add = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
        if (g[y][x] !== '.') continue;
        if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => get(g, x + dx, y + dy) !== '.')) add.push([x, y]);
    }
    for (const [x, y] of add) g[y][x] = 'o';
}
// role letters -> colour indices 0..3
function toIdx(g, map, what) {
    return g.map(r => r.map(ch => {
        if (ch === '.') return 0;
        if (!(ch in map)) fail(what + ': no colour index for role "' + ch + '"');
        return map[ch];
    }));
}

// ── tile banks (pattern tables) ──────────────────────────────
// Every 8x8 tile is registered once. Sprite tiles that equal another one mirrored are stored once
// and drawn with the horizontal-flip attribute; background tiles cannot be flipped.
class ChrBank {
    constructor(name, flips) { this.name = name; this.flips = flips; this.tiles = new Map(); this.refs = 0; }
    add(tile) {                                    // tile: 8 strings of 8 digits
        this.refs++;
        const k = tile.join('/'), f = tile.map(r => [...r].reverse().join('')).join('/');
        if (this.tiles.has(k) || (this.flips && this.tiles.has(f))) return;
        this.tiles.set(k, 1);
    }
    get size() { return this.tiles.size; }
}
// The kelp sway is a CHR bank switch, so the two frames are two background banks (each holds the
// shared surface / dither / glint tiles plus its own seabed tiles).
const SPR_CHR = new ChrBank('sprite', true);
const BG_CHR = [new ChrBank('background frame 0', false), new ChrBank('background frame 1', false)];
function sliceInto(bank, idxGrid, w, h) {
    for (let ty = 0; ty < h; ty += 8) for (let tx = 0; tx < w; tx += 8) {
        const t = []; let empty = true;
        for (let y = 0; y < 8; y++) { let s = ''; for (let x = 0; x < 8; x++) { const v = idxGrid[ty + y][tx + x]; if (v) empty = false; s += v; } t.push(s); }
        if (!empty) bank.add(t);
    }
}

// ── sprites: metasprites ─────────────────────────────────────
// A texture = a list of parts {idx (2-bit grid, multiple of 8), x, y, pal [name, state]}; every part
// is cut into 8x8 tiles that all share that part's palette. Index 0 is transparent.
function palColors(pal) {                          // ['coral'] or ['coral', alarmState]
    return pal.length > 1 ? T.ALARM_STATES[pal[1]] : T.SPR_PAL[pal[0]];
}
function renderSprite(W, H, parts) {
    const px = Buffer.alloc(W * H * 4);
    for (const p of parts) {
        const ph = p.idx.length, pw = p.idx[0].length;
        if (ph % 8 || pw % 8) fail('metasprite part is not a multiple of 8x8');
        if (!T.SPR_PAL[p.pal[0]]) fail('unknown sprite palette ' + p.pal[0]);
        sliceInto(SPR_CHR, p.idx, pw, ph);
        const cols = palColors(p.pal);
        for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
            const v = p.idx[y][x];
            if (!v) continue;
            const X = p.x + x, Y = p.y + y;
            if (X < 0 || Y < 0 || X >= W || Y >= H) fail('metasprite part leaves its canvas');
            const c = rgb(cols[v - 1]), o = (Y * W + X) * 4;
            px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
        }
    }
    return { W, H, px };
}
const single = (idx, pal) => renderSprite(idx[0].length, idx.length, [{ idx, x: 0, y: 0, pal }]);

// ── FISH ─────────────────────────────────────────────────────
// Roles: b body, l belly, f fin/tail, e eye, g gill, p pattern; the outline (o) is added around the fill.
// 16x8 adult (two tiles wide), faces right.
const FISH_M = [
    '................',
    '.....ffff.......',
    '.....bbbbbbb....',
    '....bbbbbbbbbb..',
    '....bbbbbbbbeb..',
    '....llllllllll..',
    '.....llllllll...',
    '................'
];
const FISH_M_TAIL = [          // cols 0..3, rows 1..6 (two beat frames)
    ['f...', 'ff..', 'fff.', 'fff.', '.ff.', '.f..'],
    ['.f..', '.ff.', 'fff.', 'fff.', 'ff..', 'f...']
];
const FISH_M_GILL = [[10, 4], [10, 5]];
const FISH_M_PECT = [[7, 5], [8, 5], [7, 6]];      // pectoral fin, over the belly
const FISH_M_MARK = {         // pattern pixels per variant (x, y)
    coral:  [[7, 2], [7, 3], [8, 4], [8, 3]],
    amber:  [[6, 3], [9, 4], [8, 2], [11, 3]],
    lemon:  [[5, 4], [6, 4], [7, 4], [8, 4]],
    aqua:   [[6, 3], [7, 3], [8, 3], [9, 3]],
    orchid: [[6, 4], [8, 3], [9, 5], [7, 5]]
};
// 8x8 fry (one tile)
const FISH_S = [
    '........',
    '........',
    '...bbb..',
    '..bbbbb.',
    '..bbbeb.',
    '..lllll.',
    '...lll..',
    '........'
];
const FISH_S_TAIL = [[[1, 3], [0, 4], [1, 4], [1, 5]], [[0, 3], [1, 3], [1, 4], [0, 5], [1, 5]]];   // two beat frames
// colour roles -> index per variant: [palette, {role: index 1..3}]
const FISH_ROLES = {
    aqua:    [['teal'],    { o: 1, b: 2, l: 3, f: 2, e: 1, g: 1, p: 3 }],
    orchid:  [['pink'],    { o: 1, b: 2, l: 3, f: 2, e: 1, g: 1, p: 3 }],
    amber:   [['gold'],    { o: 1, b: 2, l: 3, f: 2, e: 1, g: 1, p: 1 }],
    coral:   [['coral'],   { o: 1, b: 2, l: 3, f: 2, e: 1, g: 1, p: 3 }],
    lemon:   [['gold'],    { o: 1, b: 3, l: 2, f: 2, e: 1, g: 2, p: 1 }],
    'alarm-a': [['coral', 0], { o: 1, b: 2, l: 3, f: 2, e: 1, g: 1, p: 3 }],
    'alarm-b': [['coral', 1], { o: 1, b: 2, l: 3, f: 2, e: 1, g: 1, p: 3 }]
};
function fishSprite(cls, variant, frame) {
    const base = variant.startsWith('alarm') ? 'coral' : variant;     // markings of the coral fish
    const [pal, map] = FISH_ROLES[variant];
    let g;
    if (cls === 'm') {
        g = fromRows(FISH_M);
        pts(g, 'g', FISH_M_GILL);
        pts(g, 'f', FISH_M_PECT);
        if (!variant.startsWith('alarm')) pts(g, 'p', FISH_M_MARK[base].filter(([x, y]) => get(g, x, y) === 'b'));
        ascii(g, FISH_M_TAIL[frame], 0, 1);
    } else {
        g = fromRows(FISH_S);
        pts(g, 'f', FISH_S_TAIL[frame]);
        if (variant === 'lemon' || variant === 'orchid' || variant === 'aqua') pts(g, 'p', [[4, 3]]);
        if (variant === 'amber' || variant === 'coral') pts(g, 'p', [[3, 4]]);
    }
    outline(g);
    return single(toIdx(g, map, 'fish ' + cls + ' ' + variant), pal);
}

// ── ORCA ─────────────────────────────────────────────────────
// 24x16 (3x2 tiles), faces right. K black body, S rim light on the back, W white; palette 'sea'.
const ORCA_TOP = [8, 7, 6, 6, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 6, 7, 8];     // x = 4..23
const ORCA_BOT = [9, 10, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 11, 10];
function orcaSprite(frame) {
    const g = mk(24, 16), top = x => ORCA_TOP[x - 4], bot = x => ORCA_BOT[x - 4];
    ORCA_TOP.forEach((t, i) => { for (let y = t; y <= ORCA_BOT[i]; y++) put(g, 4 + i, y, 'K'); });
    // dorsal fin
    for (const [y, x0, x1] of [[0, 15, 15], [1, 15, 16], [2, 14, 16], [3, 13, 17]]) for (let x = x0; x <= x1; x++) put(g, x, y, 'K');
    pts(g, 'S', [[15, 0], [15, 1], [14, 2], [13, 3]]);
    // rim light along the back
    for (let x = 6; x <= 21; x++) if (get(g, x, top(x)) === 'K') put(g, x, top(x), 'S');
    // belly + chin
    for (let x = 8; x <= 22; x++) { const b = bot(x), d = (x < 10 || x > 19) ? 0 : 2; for (let y = b - d; y <= b; y++) put(g, x, y, 'W'); }
    pts(g, 'W', [[22, 11], [23, 10], [23, 9]]);
    // eye patch
    pts(g, 'W', [[17, 6], [18, 6], [19, 6], [17, 7], [18, 7]]);
    // flipper
    const fl = frame === 0 ? [[13, 13], [14, 13], [15, 13], [13, 14], [14, 14], [13, 15]] : [[13, 13], [14, 13], [15, 13], [14, 14], [15, 14]];
    pts(g, 'K', fl);
    // tail: stalk + flukes (a crescent with a notched trailing edge), the fan sags on the odd frame
    const dy = frame === 0 ? 0 : 2, fdy = dy / 2;
    const fluke = [[3, 8, 10], [2, 6, 12], [1, 4, 7], [1, 11, 14], [0, 3, 5], [0, 13, 15]];
    for (const [x, y0, y1] of fluke) for (let y = y0; y <= y1; y++) put(g, x, y + fdy + (x === 0 ? fdy : 0), 'K');
    pts(g, 'K', [[4, 8], [4, 9], [4, 10]]);
    pts(g, 'S', [[0, 3 + dy], [1, 4 + fdy], [1, 5 + fdy]]);
    return single(toIdx(g, { K: 1, S: 2, W: 3 }, 'orca'), ['teal']);
}

// ── ANGLER ───────────────────────────────────────────────────
// 16x16 body + an 8x8 lure tile above it (own palette). B body, L rim, T teeth/eye.
const ANG_TOP = [8, 6, 5, 4, 4, 3, 3, 3, 3, 3, 4, 4, 5, 6, 7];          // x = 1..15
const ANG_BOT = [12, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13, 12, 11];
function anglerBody(frame) {
    const g = mk(16, 16);
    ANG_TOP.forEach((t, i) => { for (let y = t; y <= ANG_BOT[i]; y++) put(g, 1 + i, y, 'B'); });
    for (let x = 3; x <= 13; x++) put(g, x, ANG_TOP[x - 1], 'L');
    for (let x = 4; x <= 12; x += 2) put(g, x, ANG_BOT[x - 1], 'L');
    pts(g, 'L', [[10, 2], [10, 1], [10, 0]]);                                // stalk (continues in the lure tile)
    pts(g, 'L', [[5, 2], [6, 2], [7, 2], [6, 3], [7, 3], [8, 3]]);          // dorsal fin
    pts(g, 'L', [[6, 12], [7, 12], [8, 12], [7, 13], [8, 13], [7, 14]]);    // pectoral fin
    // mouth: a gap with teeth, wider on frame 0
    const open = frame === 0 ? 2 : 1;
    for (let x = 9; x <= 15; x++) for (let k = 0; k < open; k++) put(g, x, 10 + k, '.');
    pts(g, 'T', [[10, 9], [12, 9], [14, 9]]);
    pts(g, 'T', [[11, 10 + open], [13, 10 + open], [15, 10 + open]]);
    pts(g, 'T', [[11, 5], [12, 5], [11, 6], [12, 6]]);                      // eye
    pts(g, 'B', [[12, 6]]);
    pts(g, 'T', [[5, 8], [7, 10], [4, 11]]);                                // speckles
    // tail fan
    const dy = frame === 0 ? 0 : 1;
    const tail = [[0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [1, 8], [1, 9], [1, 10], [1, 11], [2, 9], [2, 10]];
    for (const [x, y] of tail) put(g, x, y + dy * (x === 0 ? 1 : 0), x === 2 ? 'B' : 'L');
    return g;
}
function lureTile(level) {
    const g = mk(8, 8);
    pts(g, 'o', [[2, 7], [2, 6], [3, 5]]);
    pts(g, 'r', [[3, 2], [4, 2], [5, 2], [3, 3], [5, 3], [3, 4], [4, 4], [5, 4]]);
    pts(g, 'c', [[4, 3]]);
    if (level === 2) pts(g, 'h', [[4, 0], [4, 1], [2, 3], [6, 3], [4, 5], [5, 5], [6, 1], [6, 5], [2, 1]]);
    const map = [{ o: 1, r: 1, c: 2, h: 2 }, { o: 1, r: 2, c: 3, h: 2 }, { o: 1, r: 3, c: 3, h: 2 }][level];
    return toIdx(g, map, 'lure');
}
function anglerSprite(frame, lure) {
    return renderSprite(16, 24, [
        { idx: toIdx(anglerBody(frame), { B: 2, L: 1, T: 3 }, 'angler'), x: 0, y: 8, pal: ['pink'] },
        { idx: lureTile(lure), x: 8, y: 0, pal: ['gold'] }
    ]);
}

// ── JELLY ────────────────────────────────────────────────────
// 8x16 (1x2 tiles), palette 'violet': B bell, s shade, d gonad, t tentacle, u tentacle light
function jellySprite(frame) {
    const g = mk(8, 16);
    ascii(g, frame === 0
        ? ['..BBBB..', '.BBBBBB.', 'BBBddBBB', 'BBBddBBB', 'sBBBBBBs', '.s.ss.s.']
        : ['........', '..BBBB..', '.BBBBBB.', '.BBddBB.', '.sBddBs.', '..ssss..']);
    const ph = frame * Math.PI;
    [1, 3, 5, 6].forEach((x0, t) => {
        const len = 9 + (t % 2);
        for (let j = 0; j < len; j++) {
            const x = x0 + Math.round(Math.sin(j * 0.7 + t * 1.3 + ph) * 0.9);
            put(g, Math.max(0, Math.min(7, x)), 6 + j, j % 3 === 2 ? 'u' : 't');
        }
    });
    return single(toIdx(g, { B: 2, s: 1, d: 1, t: 3, u: 2 }, 'jelly'), ['pink']);
}

// ── WORM ─────────────────────────────────────────────────────
function wormSprite(frame) {
    const g = mk(8, 8), ph = frame * Math.PI;
    for (let y = 0; y < 8; y++) {
        const x = 2 + Math.round(Math.sin(y * 0.95 + ph) * 1.3), seg = (y >> 1) % 2;
        if (y === 0) { put(g, x, y, 'a'); put(g, x + 1, y, 'h'); put(g, x + 2, y, 'a'); continue; }     // head
        put(g, x, y, 'a'); put(g, x + 1, y, seg ? 'b' : 'h'); if (y < 7) put(g, x + 2, y, seg ? 'h' : 'b');
    }
    return single(toIdx(g, { h: 3, a: 1, b: 2 }, 'worm'), ['gold']);
}

// ── BUBBLES ──────────────────────────────────────────────────
const num = rows => rows.map(r => [...r].map(c => c === '.' ? 0 : Number(c)));
const BUBBLES = {
    s: num(['........', '........', '........', '...3....', '..3.3...', '...3....', '........', '........']),
    m: num(['........', '...33...', '..3..3..', '..3.23..', '..3..3..', '...33...', '........', '........']),
    l: num(['..3333..', '.3....3.', '3..22..3', '3.2....3', '3......3', '3......3', '.3....3.', '..3333..'])
};
// newborn sparkle (two frames)
const SPARKLE = [
    num(['...3....', '...3....', '...3....', '3.333.3.', '...3....', '...3....', '...3....', '........']),
    num(['........', '.3...3..', '..3.3...', '...3....', '..3.3...', '.3...3..', '........', '........'])
];

// ── BACKGROUND ───────────────────────────────────────────────
// A background picture is a grid of cells {p: BG palette 0..3, i: colour 1..3}; colour 0 = the
// universal backdrop (null). attributes() enforces the attribute table: each 16x16 area may only
// reference ONE palette.
class Plane {
    constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
    set(x, y, p, i) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = i ? { p, i } : null; }
    get(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.c[y * this.w + x] : null; }
    attributes(name, banks) {
        for (let by = 0; by < Math.ceil(this.h / 16); by++) for (let bx = 0; bx < Math.ceil(this.w / 16); bx++) {
            const used = new Set();
            for (let y = by * 16; y < Math.min(this.h, by * 16 + 16); y++) for (let x = bx * 16; x < Math.min(this.w, bx * 16 + 16); x++) { const c = this.get(x, y); if (c) used.add(c.p); }
            if (used.size > 1) fail(name + ': 16x16 area (' + bx + ',' + by + ') mixes background palettes ' + [...used].join('+') + ' (x ' + bx * 16 + '..' + (bx * 16 + 15) + ', y ' + by * 16 + '..' + (by * 16 + 15) + ')');
        }
        for (let ty = 0; ty < this.h; ty += 8) for (let tx = 0; tx < this.w; tx += 8) {   // tile bank accounting
            const t = []; let empty = true;
            for (let y = 0; y < 8; y++) { let s = ''; for (let x = 0; x < 8; x++) { const c = this.get(tx + x, ty + y); if (c) empty = false; s += c ? c.i : 0; } t.push(s); }
            if (!empty) for (const b of banks) b.add(t);
        }
    }
    render(state, opaque) {                         // opaque: colour 0 = the universal colour
        const S = T.BG[state], px = Buffer.alloc(this.w * this.h * 4), u = rgb(S.u);
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            const c = this.get(x, y), o = (y * this.w + x) * 4;
            if (c) { const v = rgb(S.pal[c.p][c.i - 1]); px[o] = v[0]; px[o + 1] = v[1]; px[o + 2] = v[2]; px[o + 3] = 255; }
            else if (opaque) { px[o] = u[0]; px[o + 1] = u[1]; px[o + 2] = u[2]; px[o + 3] = 255; }
        }
        return { W: this.w, H: this.h, px };
    }
}
const BAYER2 = [[0, 2], [3, 1]];

// water seams: ONE row of ordered dither (checkerboard) between two neighbouring water shades. Shade k
// is palette 0 colour k+1 (shade 3 is the universal colour). Only row 0 of the 8x8 tile is used, so the
// PNG is 8x1; the QML repeats it along the water boundary.
function seamPlane(k) {
    const p = new Plane(8, 8), a = k + 1, b = k + 2;           // colour index of shade k and k+1
    const upper = a <= 3 ? a : 0, lower = b <= 3 ? b : 0;
    for (let x = 0; x < 8; x++) p.set(x, 0, 0, x % 2 === 0 ? upper : lower);
    return p;
}

// waterline: 32 tiles x 2 rows scrolling horizontally; palette 3 (foam). Seen from below: a pale
// ceiling with a wavy edge and white glints, ripples fading out underneath.
function surfacePlane() {
    const W = T.SURFACE.cols * 8, p = new Plane(W, 16), TAU = Math.PI * 2;
    for (let x = 0; x < W; x++) {
        const edge = 3 + Math.round(1.4 * Math.sin(TAU * x / 64) + 1.0 * Math.sin(TAU * 3 * x / 256 + 1.3) + 0.7 * Math.sin(TAU * x / 32 + 0.5));
        for (let y = 0; y < 16; y++) {
            let i = 1;
            if (y < edge) i = 2;
            else if (y === edge) i = 3;
            else if (y === edge + 1 && (x % 4 < 2)) i = 2;
            else if (y >= 9 && y <= 10 && ((x * 7 + 3) % 31) < 8) i = 2;
            else if (y === 13 && ((x * 5 + 11) % 37) < 6) i = 2;
            p.set(x, y, 3, i);
        }
    }
    return p;
}

// water glints: a twinkling plus-sign tile in the foam palette (2 frames), scattered over the water
function glintPlane(f) {
    const p = new Plane(8, 8);
    const arms = f === 0 ? [[3, 2], [2, 3], [4, 3], [3, 4]] : [[3, 1], [3, 2], [1, 3], [2, 3], [4, 3], [5, 3], [3, 4], [3, 5]];
    for (const [x, y] of arms) p.set(x, y, 3, 2);
    p.set(3, 3, 3, 3);
    return p;
}

// seabed: 64 tiles x 10 rows (512x80), ground top at y = 64. Palette 1 sand/rocks, 2 weed.
const GROUND = 64;
function seabedPlane(frame) {
    const W = T.SEABED.cols * 8, H = T.SEABED.rows * 8, p = new Plane(W, H), TAU = Math.PI * 2;
    // plants claim whole 16-px columns, so the dunes and rocks keep out of them (attribute areas)
    const KELP = [[16, 26, 2], [96, 56, 0], [112, 40, 1], [160, 64, 2], [336, 48, 1], [352, 62, 0], [400, 34, 2], [448, 54, 1]];
    const GRASS = [[192, 20], [240, 24], [304, 18], [384, 22], [464, 20]];
    const claimed = new Set();
    for (const [x0] of KELP) claimed.add(x0 / 16);
    for (const [x0] of GRASS) claimed.add(x0 / 16);
    const dune = x => {
        if (claimed.has(Math.floor(x / 16))) return 0;
        const v = 1.6 + 1.4 * Math.sin(TAU * 2 * x / 512 + 0.4) + 1.0 * Math.sin(TAU * 5 * x / 512 + 1.9) + 0.8 * Math.sin(TAU * 9 * x / 512);
        return Math.max(0, Math.round(v));
    };
    const top = []; for (let x = 0; x < W; x++) top.push(GROUND - dune(x));
    for (let x = 0; x < W; x++) {
        for (let y = top[x]; y < H; y++) {
            const d = y - top[x], dith = BAYER2[y & 1][x & 1];
            let i;
            if (d === 0) i = 2;
            else if (d < 6) i = (dith === 1 && d > 3) ? 2 : 3;
            else if (d < 10) i = dith >= 2 ? 3 : 2;
            else i = dith >= 2 ? 2 : 1;
            p.set(x, y, 1, i);
        }
    }
    // pebbles on the ground
    for (const x of [14, 53, 77, 131, 190, 232, 290, 318, 372, 420, 440, 492]) {
        if (claimed.has(Math.floor(x / 16))) continue;
        const y = top[x] - 1;
        p.set(x, y, 1, 1); p.set(x + 1, y, 1, 2); p.set(x, y - 1, 1, 2);
    }
    // boulders (sand palette, brown): lit from the upper left
    const boulder = (cx, w, h, sink) => {
        const base = GROUND + sink;
        for (let y = base - h; y <= base; y++) for (let x = cx - Math.ceil(w / 2); x <= cx + Math.ceil(w / 2); x++) {
            const nx = (x - cx) / (w / 2), ny = (y - base) / h;
            if (nx * nx + ny * ny > 1) continue;
            const lit = (nx * -0.6 + ny * -0.8);                 // >0 faces up-left
            p.set(x, y, 1, lit > 0.8 ? 3 : (lit > 0.5 ? 2 : 1));
        }
        p.set(cx + 1, base - Math.round(h * 0.6), 1, 1); p.set(cx + 1, base - Math.round(h * 0.6) + 1, 1, 1); p.set(cx, base - Math.round(h * 0.6) + 2, 1, 1);   // crack
    };
    boulder(60, 30, 20, 3); boulder(86, 14, 10, 2);
    boulder(288, 28, 22, 3); boulder(220, 12, 8, 2);
    boulder(432, 24, 16, 3); boulder(8, 12, 8, 2); boulder(500, 12, 8, 2);
    // starfish
    const star = (cx, cy) => {
        ['..2..', '.212.', '22122', '.2.2.'].forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') p.set(cx - 2 + i, cy - 3 + j, 1, ch === '1' ? 1 : 2); }));
    };
    star(180, GROUND - 1); star(372, GROUND - 1);
    // a sunken chest (brown wood, orange lid, pale clasp and bands), half buried
    const chest = (x0, y0) => {
        ['..22222222222...', '.2222222222222..', '2222222222222222', '1111111331111111', '1111111331111111', '1311111331111131', '1311111111111131', '1111111111111111', '1111111111111111']
            .forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') p.set(x0 + i, y0 + j, 1, Number(ch)); }));
    };
    chest(130, GROUND - 7);
    // kelp: x0 = left edge of its 16-px column, h = height in px, ph = sway phase
    const kelp = (x0, h, ph) => {
        for (let k = 0; k <= h; k++) {
            const y = GROUND - 1 - k, f = Math.min(1, k / 28);
            const sway = Math.round(2.3 * f * Math.sin(k / 15 + ph * 2.1 + frame * Math.PI));
            const cx = x0 + 7 + sway, tip = k > h - 7;
            if (!tip) { p.set(cx - 1, y, 2, 1); p.set(cx, y, 2, 2); p.set(cx + 1, y, 2, 3); }
            else { p.set(cx, y, 2, 2); if (k < h - 2) p.set(cx + 1, y, 2, 3); }
            // fronds every 12 px, alternating sides, arching up then drooping
            if (k > 9 && k < h - 5 && (k + ph * 5) % 12 === 0) {
                const side = ((k + ph * 5) / 12) % 2 === 0 ? -1 : 1;
                for (let j = 0; j < 4; j++) {
                    const fx = cx + side * (2 + j), fy = y - Math.round(Math.sin((j + 0.5) / 4 * Math.PI) * 2);
                    p.set(fx, fy, 2, 3); p.set(fx, fy + 1, 2, 2); p.set(fx, fy + 2, 2, 1);
                }
            }
        }
    };
    for (const [x0, h, ph] of KELP) kelp(x0, h, ph);
    // sea-grass tufts: three blades fanning out of the ground
    const grass = (x0, h) => {
        for (const [dx, lean, hh] of [[5, -1, h * 0.8], [8, 0, h], [11, 1, h * 0.7]]) for (let k = 0; k < hh; k++) {
            const sway = Math.round((lean * k / 7) + (k > 6 ? Math.sin(k / 5 + frame * Math.PI) * 0.9 * (k / hh) : 0));
            p.set(x0 + dx + sway, GROUND - 1 - k, 2, k > hh - 4 ? 3 : (dx === 8 ? 2 : 1));
        }
    };
    for (const [x0, h] of GRASS) grass(x0, h);
    p.attributes('seabed frame ' + frame, [BG_CHR[frame]]);
    return p;
}

// ── driver ───────────────────────────────────────────────────
function allImages() {
    const out = {};
    for (const v of Object.keys(FISH_ROLES)) for (let f = 0; f < 2; f++) for (const cls of ['m', 's']) out[T.spriteFile('fish', cls, v, f)] = fishSprite(cls, v, f);
    for (let f = 0; f < 2; f++) {
        out[T.spriteFile('orca', 'm', '', f)] = orcaSprite(f);
        out[T.spriteFile('jelly', 'm', '', f)] = jellySprite(f);
        out[T.spriteFile('worm', 'm', '', f)] = wormSprite(f);
        for (let l = 0; l < 3; l++) out[T.spriteFile('angler', 'm', '', f, l)] = anglerSprite(f, l);
    }
    for (const c of ['s', 'm', 'l']) out[T.spriteFile('bubble', c)] = single(BUBBLES[c], ['teal']);
    SPARKLE.forEach((idx, f) => { out['sparkle-' + f + '.png'] = single(idx, ['teal']); });
    const sPlane = surfacePlane(); sPlane.attributes('surface', BG_CHR);
    const dPlanes = [0, 1, 2].map(seamPlane); dPlanes.forEach((d, k) => d.attributes('seam ' + k, BG_CHR));
    const gPlanes = [0, 1].map(glintPlane); gPlanes.forEach((g, f) => g.attributes('glint ' + f, BG_CHR));
    const bPlanes = [0, 1].map(seabedPlane);
    for (const st of T.BG_STATES) {
        out[T.surfaceFile(st)] = sPlane.render(st, true);
        dPlanes.forEach((d, k) => { const im = d.render(st, true), W = im.W; out[T.seamFile(st, k)] = { W: W, H: 1, px: im.px.subarray(0, W * 4) }; });
        bPlanes.forEach((b, f) => { out[T.seabedFile(st, f)] = b.render(st, false); });
        gPlanes.forEach((g, f) => { out[T.glintFile(st, f)] = g.render(st, false); });
    }
    for (const k in T.kinds) {                      // descriptor sizes must match the art
        const kd = T.kinds[k];
        for (const cls of ['m', 's']) {
            if (!kd[cls]) continue;
            const f = out[T.spriteFile(k, cls, k === 'fish' ? 'aqua' : '', 0, 0)];
            if (f.W !== kd[cls].w || f.H !== kd[cls].h) fail(k + ' ' + cls + ': art is ' + f.W + 'x' + f.H + ', theme.js says ' + kd[cls].w + 'x' + kd[cls].h);
        }
    }
    if (SPR_CHR.size > 256) fail('sprite pattern table overflow: ' + SPR_CHR.size);
    for (const b of BG_CHR) if (b.size > 256) fail(b.name + ' pattern table overflow: ' + b.size);
    return out;
}

// contact sheets: every sprite/frame enlarged on the day backdrop, with the palettes as swatches
function blit(dst, DW, im, ox, oy, S) {
    for (let y = 0; y < im.H * S; y++) for (let x = 0; x < im.W * S; x++) {
        const s = ((y / S | 0) * im.W + (x / S | 0)) * 4, a = im.px[s + 3] / 255;
        if (!a) continue;
        const d = ((oy + y) * DW + ox + x) * 4;
        for (let k = 0; k < 3; k++) dst[d + k] = Math.round(im.px[s + k] * a + dst[d + k] * (1 - a));
    }
}
function sheet(imgs, file) {
    const S = 8, PAD = 2, BG = rgb(T.BG.day.pal[0][2]);
    const rows = [];
    for (const v of Object.keys(FISH_ROLES)) rows.push(['m', 's'].flatMap(c => [0, 1].map(f => T.spriteFile('fish', c, v, f))));
    rows.push(['orca-0.png', 'orca-1.png']);
    rows.push([0, 1].flatMap(f => [0, 1, 2].map(l => T.spriteFile('angler', 'm', '', f, l))));
    rows.push(['jelly-0.png', 'jelly-1.png', 'worm-0.png', 'worm-1.png', 'bubble-s.png', 'bubble-m.png', 'bubble-l.png', 'sparkle-0.png', 'sparkle-1.png']);
    const dims = rows.map(r => ({ w: r.reduce((a, n) => a + (imgs[n].W + PAD) * S, PAD * S), h: Math.max(...r.map(n => imgs[n].H)) * S + 2 * PAD * S }));
    const SW = Math.max(...dims.map(d => d.w)), SH = dims.reduce((a, d) => a + d.h, 0) + 6 * S + 4 * S;
    const px = Buffer.alloc(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) { px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255; }
    let oy = 0;
    rows.forEach((r, ri) => {
        let ox = PAD * S;
        for (const n of r) { blit(px, SW, imgs[n], ox, oy + PAD * S, S); ox += (imgs[n].W + PAD) * S; }
        oy += dims[ri].h;
    });
    let sx = 2 * S;       // palette swatches: 4 sprite palettes (+ alarm state B)
    const swatch = cols => { for (const c of cols) { const v = rgb(c); for (let y = 0; y < 5 * S; y++) for (let x = 0; x < 4 * S; x++) { const o = ((oy + S + y) * SW + sx + x) * 4; px[o] = v[0]; px[o + 1] = v[1]; px[o + 2] = v[2]; } sx += 4 * S + 2; } sx += 2 * S; };
    for (const n of T.SPR_PAL_ORDER) swatch(T.SPR_PAL[n]);
    swatch(T.ALARM_STATES[1]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png.encode(SW, SH, px));
}
function bgSheet(imgs, file) {
    const S = 2, GAP = 12, parts = [];
    for (const st of T.BG_STATES) { parts.push(imgs[T.surfaceFile(st)]); for (let f = 0; f < 2; f++) parts.push(imgs[T.seabedFile(st, f)]); for (let k = 0; k < 3; k++) parts.push(imgs[T.seamFile(st, k)]); }
    const SW = 512 * S, SH = parts.reduce((a, p) => a + p.H * S + GAP, 0), px = Buffer.alloc(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) { px[i * 4] = 40; px[i * 4 + 1] = 40; px[i * 4 + 2] = 40; px[i * 4 + 3] = 255; }
    let oy = 0;
    for (const p of parts) { blit(px, SW, p, 0, oy, S); oy += p.H * S + GAP; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png.encode(SW, SH, px));
}

const imgs = allImages();
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
if (arg('--sheet')) sheet(imgs, arg('--sheet'));
if (arg('--bg-sheet')) bgSheet(imgs, arg('--bg-sheet'));
if (process.argv.includes('--stats')) {
    console.log('sprite CHR tiles: ' + SPR_CHR.size + ' unique (of ' + SPR_CHR.refs + ' placed, flip-folded), limit 256');
    for (const b of BG_CHR) console.log(b.name + ' CHR tiles: ' + b.size + ' unique (of ' + b.refs + ' placed, no flips), limit 256');
}
if (process.argv.includes('--check')) {
    let bad = 0;
    for (const f in imgs) {
        const p = path.join(OUT, f);
        if (!fs.existsSync(p) || !fs.readFileSync(p).equals(png.encode(imgs[f].W, imgs[f].H, imgs[f].px))) { console.error('stale: ' + f); bad++; }
    }
    if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (!imgs[f]) { console.error('extra: ' + f); bad++; }
    process.exit(bad ? 1 : 0);
}
if ((!arg('--sheet') && !arg('--bg-sheet') && !process.argv.includes('--stats')) || process.argv.includes('--write')) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (!imgs[f]) fs.unlinkSync(path.join(OUT, f));
    let bytes = 0;
    for (const f in imgs) { const b = png.encode(imgs[f].W, imgs[f].H, imgs[f].px); fs.writeFileSync(path.join(OUT, f), b); bytes += b.length; }
    console.log(Object.keys(imgs).length + ' images, ' + (bytes / 1024).toFixed(0) + ' KiB -> ' + OUT);
}
