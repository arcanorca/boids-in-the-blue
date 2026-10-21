// Generates the "onebit" theme's textures (contents/themes/onebit/img/*.png) and, optionally,
// a contact sheet. Exactly two colours (INK, PAPER from theme.js) plus transparency: every texel of
// every texture is one of the three, nothing is ever blended and no texture is a dither or noise.
//   node tools/gen-onebit-theme.js [--check] [--sheet <out.png>] [--write]      (SCALE=4 sets the sheet scale)
//
// Art is built on char grids: 'k' ink, 'p' paper, '.' clear. Creatures are line art on dark water: a
// flat fill, a bold 1-texel outline in the opposite tone and a few deliberate marks (light comes from
// the top left). Tone in the backdrop comes only from straight hatch lines.
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('../tests/png');
const { loadScript } = require('../tests/harness');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'contents', 'themes', 'onebit', 'img');
const T = loadScript(path.join(ROOT, 'contents', 'themes', 'onebit', 'theme.js'));

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const W_ = g => g[0].length, H_ = g => g.length;
const get = (g, x, y) => (y >= 0 && y < H_(g) && x >= 0 && x < W_(g)) ? g[y][x] : '.';
const put = (g, x, y, ch) => { if (y >= 0 && y < H_(g) && x >= 0 && x < W_(g)) g[y][x] = ch; };
const pts = (g, ch, list) => { for (const [x, y] of list) put(g, x, y, ch); };
const N4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const swap = g => g.map(r => r.map(c => c === 'k' ? 'p' : c === 'p' ? 'k' : c));
// 1 texel outline (4-neighbourhood, so diagonals stay crisp) around every solid texel
function outline(g, ch) {
    const add = [];
    for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) {
        if (g[y][x] !== '.') continue;
        if (N4.some(([dx, dy]) => get(g, x + dx, y + dy) !== '.')) add.push([x, y]);
    }
    for (const [x, y] of add) g[y][x] = ch;
}
function pad(g, l, t, r, b) {
    const out = mk(W_(g) + l + r, H_(g) + t + b);
    for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) out[y + t][x + l] = g[y][x];
    return out;
}
function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
T.INK_RGB = hex(T.INK); T.PAPER_RGB = hex(T.PAPER);
const rgba = ch => ch === 'k' ? T.INK_RGB : ch === 'p' ? T.PAPER_RGB : null;
function render(g) {
    const H = H_(g), W = W_(g), px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = rgba(g[y][x]);
        if (!c) { if (g[y][x] !== '.') throw new Error('bad cell "' + g[y][x] + '"'); continue; }
        px[(y * W + x) * 4] = c[0]; px[(y * W + x) * 4 + 1] = c[1]; px[(y * W + x) * 4 + 2] = c[2]; px[(y * W + x) * 4 + 3] = 255;
    }
    return { W, H, px };
}
// polygon / ellipse tests at texel centres (float coordinates in texels)
function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
}
const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function line(g, x0, y0, x1, y1, ch) {                  // 4-connected line (no diagonal-only steps)
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
        put(g, x0, y0, ch);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; put(g, x0, y0, ch); }
        if (x0 === x1 && y0 === y1) break;
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}
// remove paper/ink texels that touch nothing 4-connected (orphan pixels)
function dropOrphans(g, chars) {
    for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++)
        if (chars.includes(g[y][x]) && !N4.some(([dx, dy]) => get(g, x + dx, y + dy) !== '.')) g[y][x] = '.';
}

// ── fish ─────────────────────────────────────────────────────
// Hand-drawn silhouettes (interior, nose to the right; 'p' = body). tl = tail columns, shift = how many
// of them swing. Frames: 0 neutral, 1 tail up, 2 neutral, 3 tail down (lobe tips pivot, no orphan texels).
// eye / stripes [col,row0,row1] / spots / gill / check box are in interior texels.
const FISH_ART = {
    large: {
        tl: 4, shift: 2, eye: [10, 3],
        rows: ['p.....pppp..', 'pp...pppppp.', 'ppp.pppppppp', 'pppppppppppp', '.ppppppppppp', 'pppppppppppp', 'ppp.pppppppp', 'pp...pppppp.', 'p.....pppp..'],
        stripe: [[6, 1, 7], [8, 1, 7]], spot: [[5, 4], [7, 2], [7, 6], [9, 5]], gill: [[7, 2], [6, 3], [6, 4], [6, 5], [7, 6]], check: [5, 9, 1, 7]
    },
    mid: {
        tl: 3, shift: 1, eye: [8, 2],
        rows: ['p....ppp..', 'pp..ppppp.', 'pppppppppp', '.ppppppppp', 'pppppppppp', 'pp..ppppp.', 'p....ppp..'],
        stripe: [[4, 2, 4], [6, 1, 5]], spot: [[4, 3], [6, 2], [6, 4]], gill: [[6, 2], [5, 3], [6, 4]], check: [4, 7, 1, 5]
    },
    small: {
        tl: 2, shift: 1, eye: [6, 2],
        rows: ['p...ppp.', 'pp.ppppp', '.ppppppp', '.ppppppp', 'pp.ppppp', 'p...ppp.'],
        stripe: [[4, 1, 4]], spot: [[4, 2], [5, 4]], gill: [[4, 2], [4, 3]], check: [3, 4, 1, 4]
    },
    baby: {
        tl: 1, shift: 1, eye: [4, 1],
        rows: ['p..pp.', 'pppppp', 'pppppp', 'p..pp.'],
        stripe: [[2, 1, 2]], spot: [[2, 2]], gill: [], check: [2, 3, 0, 3]
    },
    mote: {
        tl: 1, shift: 0, eye: null,
        rows: ['.pp', 'ppp'],
        stripe: [[2, 1, 1]], spot: [[2, 0]], gill: [], check: [1, 1, 1, 1]
    }
};
function fishBase(name, frame) {
    const a = FISH_ART[name], H = a.rows.length, W = a.rows[0].length, g = mk(W, H);
    a.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'p') g[y][x] = 'p'; }));
    const dy = frame === 1 ? -1 : frame === 3 ? 1 : 0;
    if (dy && a.shift) {
        for (let c = 0; c < a.shift; c++) {
            const rows = []; for (let y = 0; y < H; y++) if (g[y][c] === 'p') rows.push(y);
            for (const y of rows) g[y][c] = '.';
            for (const y of rows) put(g, c, y + dy, 'p');
        }
        for (let it = 0; it < 3; it++) for (let c = 0; c < a.shift; c++) for (let y = 0; y < H; y++)
            if (g[y][c] === 'p' && !N4.some(([dx, dy2]) => get(g, c + dx, y + dy2) === 'p')) put(g, c, y - dy, 'p');
    }
    return g;
}
function fishSprite(ci, variant, frame, inverted) {
    const name = T.FISH_CLASSES[ci].name, a = FISH_ART[name], tl = a.tl;
    const g = fishBase(name, frame), W = W_(g), H = H_(g);
    const body = (x, y) => get(g, x, y) === 'p' && x >= tl;
    const eye = a.eye;
    const nearEye = (x, y) => eye && Math.abs(x - eye[0]) <= 1 && Math.abs(y - eye[1]) <= 1;
    if (variant === 'hollow') {                         // outline fish: solid paper, an ink contour line one texel inside the rim
        const rim = g.map((r, y) => r.map((c, x) => c === 'p' && N4.some(([dx, dy]) => get(g, x + dx, y + dy) !== 'p')));
        const ring = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'p' && !rim[y][x] && x >= tl - 1 && N4.some(([dx, dy]) => get(rim, x + dx, y + dy) === true)) ring.push([x, y]);
        for (const [x, y] of ring) g[y][x] = 'k';
        if (eye) put(g, eye[0], eye[1], 'k');
    } else {
        if (variant === 'stripe') for (const [c, r0, r1] of a.stripe) for (let y = r0; y <= r1; y++) { if (body(c, y)) put(g, c, y, 'k'); }
        else if (variant === 'spot') for (const [x, y] of a.spot) { if (body(x, y)) put(g, x, y, 'k'); }
        else if (variant === 'solid') for (const [x, y] of a.gill) { if (body(x, y)) put(g, x, y, 'k'); }
        else if (variant === 'check') { const [x0, x1, y0, y1] = a.check; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 2 === 0 && body(x, y) && !nearEye(x, y)) put(g, x, y, 'k'); }
        if (eye) put(g, eye[0], eye[1], 'k');
    }
    const out = pad(g, 1, 1, 1, 1);
    // outline: ink around the paper fish; the hollow fish keeps a paper rim, so its outline is ink too
    const sil = out.map(r => r.map(c => c !== '.'));
    outline(out, 'k');
    if (!inverted) return out;
    // stress state: the tones swap (ink body, paper pattern and outline); the body rim joins the outline, so the
    // hollow fish keeps a 2 texel paper contour and still reads at a glance
    const sw = swap(out);
    for (let y = 0; y < H_(out); y++) for (let x = 0; x < W_(out); x++)
        if (sil[y][x] && x - 1 >= tl && N4.some(([dx, dy]) => get(sil, x + dx, y + dy) === false && !(x + dx < 0 || y + dy < 0 || x + dx >= W_(out) || y + dy >= H_(out)) )) sw[y][x] = 'p';
    return sw;
}

// ── orca ─────────────────────────────────────────────────────
// Ink body with a paper outline, paper belly / chin and eye patch, a tall swept dorsal fin, flukes that swing
// with the frame. Drawn from float polygons at scale S (1 = full, 0.6 = small).
const ORCA_TOP = [9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9];      // x = 8 .. 34
const ORCA_BOT = [11, 11, 11, 11, 12, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 14, 13, 13, 12, 11];
function orcaSprite(frame, S) {
    const L = Math.round(35 * S), H = Math.round(18 * S), g = mk(L, H);
    const dir = [0, -1, 0, 1][frame & 3];
    const sh = (x, y) => y + dir * Math.max(0, (10 - x) / 10) * 2.4;          // flukes swing about the tail stock
    const fl = [[[10.5, 9.4], [7, 7.4], [4.2, 4.8], [0.6, 3.2], [0.2, 6.2], [2.4, 8.8], [4.5, 9.8]], [[10.5, 10.8], [7, 12.8], [4.2, 15.4], [0.6, 17], [0.2, 14], [2.4, 11.4], [4.5, 10.4]]]
        .map(p => p.map(([x, y]) => [x, sh(x, y)]));
    const stock = [[5, 8.8], [10, 8.6], [10, 11.6], [5, 11.2]].map(([x, y]) => [x, sh(x, y)]);
    const fin = [[27.6, 6.2], [26, 3.6], [24.4, 1.0], [23, 0], [21.6, 1.2], [21, 3.4], [19.6, 5.2], [17.5, 6.6]];
    const flipper = [[22, 14.4], [27.6, 14.6], [26.2, 18], [23.6, 18]];
    const col = X => Math.max(0, Math.min(26, Math.floor(X) - 8));
    const body = (X, Y) => X >= 8 && X < 35 && Y >= ORCA_TOP[col(X)] && Y < ORCA_BOT[col(X)] + 1;
    const inFin = (X, Y) => inPoly(X, Y, fin);
    for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
        const X = (x + 0.5) / S, Y = (y + 0.5) / S;
        if (body(X, Y) || inFin(X, Y) || inPoly(X, Y, flipper) || inPoly(X, Y, stock) || inPoly(X, Y, fl[0]) || inPoly(X, Y, fl[1])) g[y][x] = 'p';
    }
    // solid paper animal; the black back is a cape inside a 1 texel paper rim; eye patch and saddle stay paper;
    // the dorsal fin carries a black blade along its base
    const finCore = fin.map(([x, y]) => [22.6 + (x - 22.6) * 0.5, 6.6 + (y - 6.6) * 0.62]);
    const cape = (X, Y) => X >= 13 && X < 34.6 && Y >= ORCA_TOP[col(X)] + 1.1 && Y < ORCA_TOP[col(X)] + (X < 29 ? 5.5 : 5.5 - (X - 29) * 0.55);
    for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
        if (g[y][x] !== 'p') continue;
        const X = (x + 0.5) / S, Y = (y + 0.5) / S;
        if (S >= 0.9 && inPoly(X, Y, finCore) && Y < ORCA_TOP[col(X)] + 1.2) { g[y][x] = 'k'; continue; }
        if (cape(X, Y)) {
            g[y][x] = 'k';
            const ex = X - 29.6, ey = Y - 8.2;
            if ((ex * 0.94 - ey * 0.34) ** 2 / 6.4 + (ey * 0.94 + ex * 0.34) ** 2 / 1.7 <= 1) g[y][x] = 'p';
            if (S >= 0.9 && inEll(X, Y, 16.4, 8.2, 2.2, 0.95)) g[y][x] = 'p';
        }
    }
    const out = pad(g, 1, 1, 1, 1); outline(out, 'k');
    return out;
}

// ── angler ───────────────────────────────────────────────────
// Round ink body, open mouth with a zig-zag of ink teeth, big eye, a stalk over the head to the lure bulb
// (the bulb itself is a separate overlay so it can glow).
function anglerSprite(frame, S) {
    const W = Math.round(16 * S), H = Math.round(15 * S), g = mk(W, H);
    const dir = [0, -1, 0, 1][frame & 3];
    const body = (x, y) => inEll(x, y, 8.6, 9.6, 6.1, 5.2);
    const sh = (x, y) => y + dir * Math.max(0, (4 - x) / 4) * 1.4;
    const tail = [[[4.2, 8.9], [0.4, 5.6], [1.2, 9.4]], [[4.2, 10.6], [0.4, 14.0], [1.2, 10.0]]].map(p => p.map(([x, y]) => [x, sh(x, y)]));
    const dorsal = [[6.2, 5.5], [5.0, 2.2], [8.8, 4.6]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const X = (x + 0.5) / S, Y = (y + 0.5) / S;
        if (body(X, Y) || inPoly(X, Y, tail[0]) || inPoly(X, Y, tail[1]) || inPoly(X, Y, dorsal) || (X >= 3.4 && X <= 5 && Y >= 8.6 && Y <= 10.6)) g[y][x] = 'p';
    }
    dropOrphans(g, ['p']);
    const R = v => Math.round(v * S - 0.001);
    // solid paper body; mouth = an ink cavity cut into the face with paper teeth from both jaws; a big ink eye; a gill line
    const my = R(9.0), mh = S >= 0.9 ? 3 : 2;
    for (let x = R(9.6); x <= R(15.4); x++) for (let y = 0; y < mh; y++) if (get(g, x, my + y) === 'p') g[my + y][x] = 'k';
    for (let x = R(10.6); x <= R(15.4); x += 2) if (get(g, x, my) === 'k') g[my][x] = 'p';
    if (S >= 0.9) for (let x = R(11.6); x <= R(15.4); x += 2) if (get(g, x, my + mh - 1) === 'k') g[my + mh - 1][x] = 'p';
    const ex = R(8.2), ey = R(5.4), es = S >= 0.9 ? 2 : 1;
    for (let dy = 0; dy < es; dy++) for (let dx = 0; dx < es; dx++) put(g, ex + dx, ey + dy, 'k');
    const out = pad(g, 1, 1, 1, 1); outline(out, 'k');
    // stalk: bold paper line from the brow, arching forward to the lure bulb (2 texels thick near the head)
    const lp = T.LURE[S >= 0.9 ? 0 : 1][frame & 3];
    const bx = lp.x, by = lp.y, x1 = R(11.6) + 1, y1 = R(2.6) + 1, xm = Math.round((x1 + bx) / 2 + 1), ym = Math.max(0, by - 3);
    const thick = (x0, y0, x2, y2, t) => { line(out, x0, y0, x2, y2, 'p'); if (t) line(out, x0 + 1, y0, x2 + 1, y2, 'p'); };
    thick(R(10.4) + 1, R(4.9) + 1, x1, y1, S >= 0.9);
    thick(x1, y1, xm, ym, S >= 0.9);
    line(out, xm, ym, bx, Math.max(0, by - 2), 'p');
    return out;
}

// ── jelly ────────────────────────────────────────────────────
// Dome (ink fill, paper outline, a highlight at the upper left), a frilly rim (every other rim texel is left
// out, so the outline scallops), 3-5 clean 1-texel tentacles that sway with the frame. Frames: relaxed,
// mid, contracted, mid.
const JELLY_ART = {
    t: { hw: 3, bell: [[1, 2, 3, 3, 3], [1, 2, 3, 3, 2, 2], [1, 2, 3, 2, 2, 2]], tent: [[-2, 4], [0, 6], [2, 4]], hl: 1 },
    s: { hw: 4, bell: [[1, 3, 4, 4, 4, 4], [1, 3, 4, 4, 4, 3, 3], [1, 3, 4, 4, 3, 3, 2]], tent: [[-4, 6], [0, 9], [4, 6]], hl: 2 },
    l: { hw: 5, bell: [[2, 4, 5, 5, 5, 5], [2, 4, 5, 5, 5, 4, 4], [1, 3, 5, 5, 4, 4, 3]], tent: [[-4, 7], [0, 11], [4, 7]], hl: 2 }
};
function jellyDims(ci) {
    const a = JELLY_ART[T.JELLY[ci].name], hb = Math.max(...a.bell.map(b => b.length)), len = Math.max(...a.tent.map(t => t[1]));
    return { cols: 2 * a.hw + 3, rows: 1 + hb + len };
}
function jellySprite(ci, frame) {
    const a = JELLY_ART[T.JELLY[ci].name], d = jellyDims(ci), cx = a.hw + 1;
    const bell = a.bell[[0, 1, 2, 1][frame & 3]], hb = bell.length;
    const g = mk(d.cols, d.rows);
    // solid paper dome; the last row keeps every other texel (scalloped rim); ink ribs and a frill line inside
    for (let r = 0; r < hb; r++) for (let x = -bell[r]; x <= bell[r]; x++) if (r < hb - 1 || x % 2 === 0) g[1 + r][cx + x] = 'p';
    for (let x = -bell[hb - 2] + 1; x <= bell[hb - 2] - 1; x++) g[hb - 1][cx + x] = 'k';       // frill: an ink band above the scalloped rim
    outline(g, 'k');
    // tentacles: 1-texel paper lines hanging from the rim, swaying slowly; every lateral step keeps the line 4-connected
    for (const [off, len] of a.tent) {
        let px = cx + off;
        for (let k = 0; k < len; k++) {
            const x = cx + off + Math.round(0.9 * Math.sin(k * 0.38 + frame * 1.0 + off) * (k > 1 ? 1 : 0));
            const y = hb + 1 + k;
            if (x !== px) put(g, px, y, 'p');
            put(g, x, y, 'p'); px = x;
        }
    }
    return g;
}

// ── worm ─────────────────────────────────────────────────────
function wormSprite(stage, frame) {
    const g = mk(T.WORM.cols, T.WORM.rows), len = [8, 6, 4][stage];
    for (let y = 0; y < len; y++) {
        const x = 1 + Math.round(Math.sin(y * 0.7 + frame * Math.PI / 2));
        put(g, x, y, 'p'); put(g, x + 1, y, 'p');
    }
    return g;
}

// ── bubbles, sparkle, lure ───────────────────────────────────
function bubbleSprite(big) {
    const g = big ? mk(4, 4) : mk(2, 2);
    if (big) pts(g, 'p', [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3], [1, 1]]);
    else pts(g, 'p', [[0, 0], [1, 0], [0, 1], [1, 1]]);
    return g;
}
function sparkleSprite(frame) {
    const g = mk(T.SPARKLE_SIZE, T.SPARKLE_SIZE);
    pts(g, 'p', [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]]);
    if (frame === 1) pts(g, 'p', [[2, 0], [0, 2], [4, 2], [2, 4]]);
    return g;
}
function lureSprite(level) {
    const g = mk(T.LURE_SIZE, T.LURE_SIZE);
    if (level === 0) pts(g, 'p', [[3, 2], [2, 3], [4, 3], [3, 4]]);
    else if (level === 1) pts(g, 'p', [[3, 2], [2, 3], [3, 3], [4, 3], [3, 4]]);
    else { for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) put(g, x, y, 'p'); pts(g, 'p', [[3, 0], [3, 1], [3, 5], [3, 6], [0, 3], [1, 3], [5, 3], [6, 3]]); }
    outline(g, 'k');
    return g;
}

// ── backdrop ─────────────────────────────────────────────────
// Water: horizontal hatch lines (1 texel thick, long irregular dashes that wrap, so the strip tiles) in four bands;
// every line belongs to one of WATER.layers layers; water-<n>.png is the union of layers 0..n (the scene shows more of them in daylight). Seams are solid.
function waterLayers() {
    const Wt = T.WATER, rnd = rng(Wt.seed), layers = Array.from({ length: Wt.layers }, () => mk(Wt.cols, Wt.rows));
    const dashRow = (cover) => {
        const on = new Uint8Array(Wt.cols);
        let pos = Math.floor(rnd() * Wt.cols);
        const start = pos;
        while (pos < start + Wt.cols) {
            const d = Math.round(8 + rnd() * 14), gap = Math.max(8, Math.round(d * (1 - cover) / cover * (0.7 + 0.6 * rnd())));
            for (let i = 0; i < d && pos + i < start + Wt.cols; i++) on[(pos + i) % Wt.cols] = 1;
            pos += d + gap;
        }
        return on;
    };
    const beamAt = (x, y) => Wt.beams.some(([c, wf]) => {
        const hw = (Wt.beamHalf + Wt.beamGrow * y) * wf;
        let dx = ((x - (c + 0.5 * y)) % Wt.cols + Wt.cols) % Wt.cols; if (dx > Wt.cols / 2) dx -= Wt.cols;
        return Math.abs(dx) <= hw;
    });
    const paint = (y, layer, on) => { for (let x = 0; x < Wt.cols; x++) if (on === null || on[x]) layers[layer][y][x] = 'p'; };
    for (const y of Wt.seams) paint(y, 0, null);
    for (const b of Wt.bands) for (let y0 = b.from; y0 <= b.to; y0 += b.pitch) {
        const y = Math.min(b.to, y0 + (b.jitter ? Math.floor(rnd() * 3) - 1 : 0));
        const layer = b.full ? Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * (Wt.layers - 1)), on = dashRow(b.cover);
        if (!b.full) {
            for (let x = 0; x < Wt.cols; x++) if (!beamAt(x, y)) on[x] = 0;
            // drop fragments the beam edge cut too short (no specks)
            for (let x = 0; x < Wt.cols;) {
                if (!on[x]) { x++; continue; }
                let e = x; while (e < Wt.cols && on[e]) e++;
                if (e - x < 7) for (let i = x; i < e; i++) on[i] = 0;
                x = e;
            }
        }
        paint(y, layer, on);
    }
    // a dashed diagonal on the lit (left) edge of every beam, drawn in layer 0, so night keeps the shafts as sparse diagonals
    const first = Wt.bands[1].from, last = Wt.bands[3].to;
    for (const [c, wf] of Wt.beams) for (let y = first - 4; y <= last; y++) {
        if (((y + Math.round(c)) % 22) >= 15) continue;
        const hw = (Wt.beamHalf + Wt.beamGrow * y) * wf, x = (Math.round(c + 0.5 * y - hw - 2) + Wt.cols * 2) % Wt.cols;
        layers[0][y][x] = 'p';
    }
    return layers;
}
function surfaceTile() {
    const S = T.SURFACE, g = mk(S.cols, S.rows);
    const y = x => 2 + Math.round(1.0 * Math.sin(2 * Math.PI * x / 32 + 0.4));
    for (let x = 0; x < S.cols; x++) { put(g, x, y(x), 'p'); if (x > 0 && y(x) !== y(x - 1)) put(g, x, y(x - 1), 'p'); }
    return g;
}
// Seabed: an ink ground under a 2 texel paper ridge line with paper sediment hatch dashes (pitch 3) and ink boulders
// outlined in paper with a highlight. It tiles (the ridge is periodic).
function seabedTile() {
    const W = T.SEABED.cols, H = T.SEABED.rows, g = mk(W, H), rnd = rng(99);
    const top = x => T.seabedTop(x);
    const put2 = (x, y, ch) => put(g, (x + W) % W, y, ch);
    // ground: an ink body under a 2 texel paper ridge line, broken by paper hatch dashes (pitch 4), so passing fish keep contrast
    for (let x = 0; x < W; x++) for (let y = top(x); y < H; y++) g[y][x] = y < top(x) + 2 ? 'p' : 'k';
    // boulders: ink with a paper outline (dark against the sand, outlined against the water), a highlight at the upper left
    const rocks = [[70, 7, 5], [82, 4, 3], [255, 9, 6], [270, 5, 3], [410, 6, 4], [470, 3, 2], [560, 8, 5], [574, 4, 2]];
    const cells = new Set(), key = (x, y) => (((x % W) + W) % W) + ',' + y;
    for (const [cx, rx, ry] of rocks) {
        const cy = top(cx) + 1;
        for (let y = cy - ry - 1; y <= cy + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++)
            if (inEll(x, y, cx, cy, rx + 0.4, ry + 0.4)) cells.add(key(x, y));
    }
    for (const c of cells) { const [x, y] = c.split(',').map(Number); g[y][x] = 'k'; }
    for (const c of cells) {
        const [x, y] = c.split(',').map(Number);
        for (const [dx, dy] of N4) if (!cells.has(key(x + dx, y + dy)) && y + dy >= 0 && get(g, (x + dx + W) % W, y + dy) === '.') put2(x + dx, y + dy, 'p');
    }
    for (const [cx, rx, ry] of rocks) if (rx >= 5) {
        const cy = top(cx) + 1, hx = cx - Math.round(rx * 0.4), hy = cy - Math.round(ry * 0.5);
        put2(hx, hy, 'p'); put2(hx + 1, hy, 'p'); put2(hx, hy + 1, 'p');
    }
    // sediment hatch: paper dashes following the ridge
    const dash = (depth, cover, minL, maxL) => {
        let x = Math.floor(rnd() * 20);
        while (x < W) {
            const d = Math.round(minL + rnd() * (maxL - minL)), gap = Math.max(4, Math.round(d * (1 - cover) / cover * (0.6 + 0.8 * rnd())));
            for (let i = 0; i < d; i++) { const xx = (x + i) % W, y = top(xx) + depth; if (y < H && g[y][xx] === 'k' && !cells.has(xx + ',' + y)) g[y][xx] = 'p'; }
            x += d + gap;
        }
    };
    dash(4, 0.65, 6, 18); dash(8, 0.5, 5, 14); dash(12, 0.3, 4, 9);
    return g;
}
// Kelp: a wavy stem 2 texels thick and curling fronds 2 texels thick, line art in paper; swaying in whole texels.
function kelpSprite(ci, frame) {
    const K = T.KELP[ci], h = K.rows, W = K.cols, g = mk(W, h), bx = Math.floor(W / 2) - 1;
    const ph = frame * Math.PI / 2, A = 1.0 + ci * 0.5;
    const sway = y => Math.round(Math.sin((h - y) * 0.11 + ph) * A * Math.pow((h - y) / h, 1.4) * 1.6);
    const thick = y => (h - y) > h * 0.4 ? 3 : 2;
    for (let y = 0; y < h; y++) {
        const x = bx + sway(y), t = thick(y);
        for (let i = 0; i < t; i++) put(g, x + i, y, 'p');
        if (y > 0) { const xp = bx + sway(y - 1); if (xp !== x) for (let i = 0; i < t; i++) put(g, xp + i, y, 'p'); }   // keep steps 4-connected
    }
    // fronds: solid blades every 11 rows, alternating sides, 3 texels thick at the root tapering to 1, curling up
    let side = 1;
    for (let y = h - 10; y > 8; y -= 11) {
        const x = bx + sway(y), len = Math.max(5, Math.round(8 * Math.min(1, (y + 6) / (h * 0.55))));
        for (let i = 0; i < len; i++) {
            const dx = side > 0 ? thick(y) + i : -1 - i, dy = -Math.floor(i * 0.6), th = Math.max(1, 3 - Math.floor(i / 3));
            for (let t = 0; t < th; t++) put(g, x + dx, y + dy - t, 'p');
            if (i > 0 && Math.floor((i - 1) * 0.6) !== Math.floor(i * 0.6)) put(g, x + dx - side, y + dy, 'p');
        }
        side = -side;
    }
    // tip: a small tapered crown
    const tx = bx + sway(0);
    pts(g, 'p', [[tx - 1, 2], [tx - 1, 1], [tx + 2, 2], [tx + 2, 1], [tx, 0], [tx + 1, 0]]);
    return g;
}

// ── all images ───────────────────────────────────────────────
function allImages() {
    const imgs = {};
    const add = (name, g, cols, rows) => {
        if (cols !== undefined && (W_(g) !== cols || H_(g) !== rows)) (process.env.DIMS ? console.log : (m => { throw new Error(m); }))(name + ' is ' + W_(g) + 'x' + H_(g) + ', theme.js says ' + cols + 'x' + rows);
        imgs[name] = render(g);
    };
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++) for (const inv of [false, true])
            add(T.fishFile(ci, v, f, inv), fishSprite(ci, v, f, inv), c.cols, c.rows);
    });
    for (let f = 0; f < 4; f++) {
        T.ORCA.forEach((o, i) => add(T.orcaFile(i, f), orcaSprite(f, i ? 0.6 : 1), o.cols, o.rows));
        T.ANGLER.forEach((o, i) => add(T.anglerFile(i, f), anglerSprite(f, i ? 0.6 : 1), o.cols, o.rows));
        T.JELLY.forEach((c, ci) => { const d = jellyDims(ci); add(T.jellyFile(ci, f), jellySprite(ci, f), c.cols, c.rows); });
        for (let s = 0; s < 3; s++) add('worm-' + s + '-' + f + '.png', wormSprite(s, f), T.WORM.cols, T.WORM.rows);
        for (let k = 0; k < T.KELP.length; k++) add('kelp-' + k + '-' + f + '.png', kelpSprite(k, f), T.KELP[k].cols, T.KELP[k].rows);
    }
    add('bubble-s.png', bubbleSprite(false), T.BUBBLE[0].cols, T.BUBBLE[0].rows); add('bubble-b.png', bubbleSprite(true), T.BUBBLE[1].cols, T.BUBBLE[1].rows);
    for (let f = 0; f < 2; f++) add('sparkle-' + f + '.png', sparkleSprite(f));
    for (let l = 0; l < 3; l++) add('lure-' + l + '.png', lureSprite(l), T.LURE_SIZE, T.LURE_SIZE);
    // water-<n>.png = the hatch lines of layers 0..n (what the scene shows at that daylight), one image at a time
    const wl = waterLayers();
    wl.forEach((g, l) => {
        const u = mk(T.WATER.cols, T.WATER.rows);
        for (let k = 0; k <= l; k++) for (let y = 0; y < T.WATER.rows; y++) for (let x = 0; x < T.WATER.cols; x++) if (wl[k][y][x] === 'p') u[y][x] = 'p';
        add(T.waterFile(l), u, T.WATER.cols, T.WATER.rows);
    });
    add('seabed.png', seabedTile(), T.SEABED.cols, T.SEABED.rows);
    add('surface.png', surfaceTile(), T.SURFACE.cols, T.SURFACE.rows);
    return imgs;
}

// ── contact sheet ────────────────────────────────────────────
function sheet(imgs, file) {
    const S = +(process.env.SCALE || 4), PAD = 3;
    let rows = [];
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const inv of [false, true]) rows.push(T.FISH_VARIANTS.map(v => [0, 1, 3].map(f => T.fishFile(ci, v, f, inv))).reduce((a, b) => a.concat(b), []));
    });
    const fr = (fmt, n) => Array.from({ length: n }, (_, f) => fmt(f));
    rows.push(fr(f => 'orca-' + f + '.png', 4).concat(fr(f => 'orca-s-' + f + '.png', 4)));
    rows.push(fr(f => 'angler-' + f + '.png', 4).concat(fr(f => 'angler-s-' + f + '.png', 4), ['lure-0.png', 'lure-1.png', 'lure-2.png', 'sparkle-0.png', 'sparkle-1.png', 'bubble-s.png', 'bubble-b.png']));
    rows.push(['t', 's', 'l'].map(n => fr(f => 'jelly-' + n + '-' + f + '.png', 4)).reduce((a, b) => a.concat(b), []));
    rows.push([0, 1, 2].map(s => fr(f => 'worm-' + s + '-' + f + '.png', 4)).reduce((a, b) => a.concat(b), []));
    rows.push([0, 1, 2].map(k => fr(f => 'kelp-' + k + '-' + f + '.png', 4)).reduce((a, b) => a.concat(b), []));
    rows.push(['seabed.png', 'surface.png']);
    if (process.env.ONLY) { const re = new RegExp(process.env.ONLY); rows = rows.map(r => r.filter(n => re.test(n))).filter(r => r.length); }
    const dims = rows.map(r => ({ w: r.reduce((a, n) => a + imgs[n].W * S + PAD * S, PAD * S), h: Math.max(...r.map(n => imgs[n].H * S)) + 2 * PAD * S }));
    const SW = Math.max(...dims.map(d => d.w)), SH = dims.reduce((a, d) => a + d.h, 0);
    const px = Buffer.alloc(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) { px[i * 4] = T.INK_RGB[0]; px[i * 4 + 1] = T.INK_RGB[1]; px[i * 4 + 2] = T.INK_RGB[2]; px[i * 4 + 3] = 255; }
    let oy = 0;
    rows.forEach((r, ri) => {
        let ox = PAD * S;
        for (const n of r) {
            const im = imgs[n];
            for (let y = 0; y < im.H * S; y++) for (let x = 0; x < im.W * S; x++) {
                const s = ((y / S | 0) * im.W + (x / S | 0)) * 4;
                if (!im.px[s + 3]) continue;
                const d = ((oy + PAD * S + y) * SW + ox + x) * 4;
                px[d] = im.px[s]; px[d + 1] = im.px[s + 1]; px[d + 2] = im.px[s + 2];
            }
            ox += im.W * S + PAD * S;
        }
        oy += dims[ri].h;
    });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png.encode(SW, SH, px));
}

const imgs = allImages();
const si = process.argv.indexOf('--sheet');
if (si > 0) sheet(imgs, process.argv[si + 1]);
if (process.argv.includes('--check')) {
    let bad = 0;
    for (const f in imgs) {
        const p = path.join(OUT, f);
        if (!fs.existsSync(p) || !fs.readFileSync(p).equals(png.encode(imgs[f].W, imgs[f].H, imgs[f].px))) { console.error('stale: ' + f); bad++; }
    }
    if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (!imgs[f]) { console.error('extra: ' + f); bad++; }
    process.exit(bad ? 1 : 0);
}
if (si < 0 || process.argv.includes('--write')) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (!imgs[f]) fs.unlinkSync(path.join(OUT, f));
    let bytes = 0;
    for (const f in imgs) { const b = png.encode(imgs[f].W, imgs[f].H, imgs[f].px); fs.writeFileSync(path.join(OUT, f), b); bytes += b.length; }
    console.log(Object.keys(imgs).length + ' images, ' + (bytes / 1024).toFixed(0) + ' KiB -> ' + OUT);
}
