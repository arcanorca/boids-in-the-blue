// Generates the "onebit" theme's textures (contents/themes/onebit/img/*.png) and, optionally,
// an 8x contact sheet. Exactly two colours (INK, PAPER from theme.js) plus transparency: every
// texel of every texture is one of the three, nothing is ever blended.
//   node tools/gen-onebit-theme.js [--check] [--sheet <out.png>] [--write]
//
// Art is built from small drawing primitives on char grids: 'k' ink, 'p' paper, '.' clear.
// Fish are procedural (profile + tail swing + a pattern per variant); everything else is
// hand-placed rows and coordinate patches. Tones are made only with ordered (Bayer) dither.
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
function ascii(g, rows, ox, oy) {            // '.' = leave, '~' = erase
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, (ox || 0) + i, (oy || 0) + j, ch === '~' ? '.' : ch); }));
}
const swap = g => g.map(r => r.map(c => c === 'k' ? 'p' : c === 'p' ? 'k' : c));
// 1 cell outline (4-neighbourhood, so diagonals stay crisp) around every solid cell
function outline(g, ch) {
    const add = [];
    for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) {
        if (g[y][x] !== '.') continue;
        if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => get(g, x + dx, y + dy) !== '.')) add.push([x, y]);
    }
    for (const [x, y] of add) g[y][x] = ch;
}
function pad(g, l, t, r, b) {
    const out = mk(W_(g) + l + r, H_(g) + t + b);
    for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) out[y + t][x + l] = g[y][x];
    return out;
}
function mirrorX(g) { return g.map(r => r.slice().reverse()); }
const BAYER8 = (() => {      // 8x8 ordered-dither matrix, thresholds 0..63
    let m = [[0]];
    for (let n = 1; n < 8; n *= 2) {
        const s = m.length, o = Array.from({ length: s * 2 }, () => Array(s * 2));
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
            const v = m[y][x] * 4;
            o[y][x] = v; o[y][x + s] = v + 2; o[y + s][x] = v + 3; o[y + s][x + s] = v + 1;
        }
        m = o;
    }
    return m;
})();
// ordered dither: true (paper) where density d (0..1) beats the matrix at texel x, y
const dith = (x, y, d) => BAYER8[((y % 8) + 8) % 8][((x % 8) + 8) % 8] < d * 64;
// 16x16 blue-noise threshold matrix by void-and-cluster (Ulichney), deterministic. Used for the water
// gradient and the light shafts: a fine stipple with no regular grid lines or banding. (Sprite tones
// use the Bayer matrix above or hand-placed patterns.)
const BN = 16;
const NOISE = (() => {
    const N = BN * BN, sigma = 1.5, R = 5;
    let seed = 20240607;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const ker = []; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) ker.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))]);
    const e = new Float64Array(N), b = new Uint8Array(N);
    const splat = (i, sgn) => { const x = i % BN, y = (i / BN) | 0; for (const [dx, dy, w] of ker) e[((y + dy + BN) % BN) * BN + (x + dx + BN) % BN] += sgn * w; };
    const arg = (want, best) => { let bi = -1, bv = best ? -Infinity : Infinity; for (let i = 0; i < N; i++) if (b[i] === want) { if (best ? e[i] > bv : e[i] < bv) { bv = e[i]; bi = i; } } return bi; };
    const order = Array.from({ length: N }, (_, i) => i); for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    for (let k = 0; k < N / 10; k++) { b[order[k]] = 1; splat(order[k], 1); }
    for (let it = 0; it < 1000; it++) {           // relax: move the tightest 1 into the largest void until stable
        const c = arg(1, true); b[c] = 0; splat(c, -1);
        const v = arg(0, false); b[v] = 1; splat(v, 1);
        if (v === c) break;
    }
    const rank = new Array(N), ones = b.reduce((a, x) => a + x, 0);
    const save = Uint8Array.from(b), saveE = Float64Array.from(e);
    let r = ones;
    while (r > 0) { const c = arg(1, true); b[c] = 0; splat(c, -1); rank[c] = --r; }
    b.set(save); e.set(saveE); r = ones;
    while (r < N) { const v = arg(0, false); b[v] = 1; splat(v, 1); rank[v] = r++; }
    return rank;
})();
const noiseT = (x, y) => (NOISE[(((y % BN) + BN) % BN) * BN + (((x % BN) + BN) % BN)] + 0.5) / (BN * BN);
const rgba = ch => ch === 'k' ? T.INK_RGB : ch === 'p' ? T.PAPER_RGB : null;
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
T.INK_RGB = hex(T.INK); T.PAPER_RGB = hex(T.PAPER);
function render(g) {
    const H = H_(g), W = W_(g), px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = rgba(g[y][x]);
        if (!c) { if (g[y][x] !== '.') throw new Error('bad cell "' + g[y][x] + '"'); continue; }
        px[(y * W + x) * 4] = c[0]; px[(y * W + x) * 4 + 1] = c[1]; px[(y * W + x) * 4 + 2] = c[2]; px[(y * W + x) * 4 + 3] = 255;
    }
    return { W, H, px };
}

// ── fish ─────────────────────────────────────────────────────
// Hand-drawn bodies (nose at the right edge) + tails as column sets (far -> near the body).
// Frame 0..3 = tail neutral / up / wide / down; up/down shear the tail, wide opens the fork.
const FISH_ART = {
    large: {
        body: ['...##.....', '..####....', '.########.', '##########', '##########', '##########', '.########.', '..######..', '...####...'],
        tail: [[1, 2, 6, 7], [1, 2, 3, 5, 6, 7], [2, 3, 4, 5, 6], [3, 4, 5]],
        wideAdd: [[0, 8], [], [], []], eye: [7, 3], gill: 5, bars: [1, 3, 5], shear: [2, 1, 0, 0]
    },
    mid: {
        body: ['..##....', '.######.', '########', '########', '########', '.######.', '..####..'],
        tail: [[1, 2, 4, 5], [1, 2, 3, 4, 5], [2, 3, 4]],
        wideAdd: [[0, 6], [], []], eye: [5, 2], gill: 4, bars: [1, 3], shear: [2, 1, 0]
    },
    small: {
        body: ['..##..', '.#####', '######', '.#####', '..###.'],
        tail: [[0, 1, 3, 4], [1, 2, 3], [2]],
        wideAdd: [[], [], []], eye: [4, 2], gill: 3, bars: [0, 2], shear: [1, 1, 0]
    },
    baby: {
        body: ['.##.', '####', '.##.'],
        tail: [[0, 2], [1]],
        wideAdd: [[], []], eye: [2, 1], gill: -1, bars: [1], shear: [1, 0]
    },
    mote: {
        body: ['.#', '##'],
        tail: [[1]],
        wideAdd: [[]], eye: [-1, -1], gill: -1, bars: [0], shear: [0]
    }
};
const TAIL_SHEAR = [0, -1, 0, 1];   // per frame: sign of the shear (0 = none)
function fishBody(c, frame) {
    const a = FISH_ART[c.name], bh = c.bh, tl = c.tl;
    const g = mk(tl + c.bw, bh);
    a.body.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') put(g, tl + x, y, 'p'); }));
    for (let k = 0; k < tl; k++) {
        const sh = TAIL_SHEAR[frame & 3] * a.shear[k];
        let rows = a.tail[k].slice();
        if (frame === 2) rows = rows.concat(a.wideAdd[k]);
        for (const y of rows) put(g, k, y + sh, 'p');
        // keep the tail joined to the body when sheared
        if (k === tl - 1) for (let y = 0; y < bh; y++) if (get(g, tl, y) !== '.' && a.tail[k].indexOf(y) < 0 && Math.abs(y - (bh - 1) / 2) < 0.6) put(g, k, y, 'p');
    }
    return g;
}
function fishSprite(cls, variant, frame, inverted) {
    const c = T.FISH_CLASSES[cls], a = FISH_ART[c.name], tl = c.tl;
    const g = fishBody(c, frame);
    const body = (x, y) => get(g, x, y) !== '.' && x >= tl;
    const [ei, ey] = a.eye, ex = tl + ei;
    if (variant === 'hollow' && !inverted) {
        const h = mk(W_(g), H_(g));
        for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) if (g[y][x] !== '.' &&
            [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => get(g, x + dx, y + dy) === '.')) h[y][x] = 'p';
        if (c.bh >= 7) {           // inner ink line: the paper rim is sandwiched between ink so it reads on any water
            const inner = [];
            for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) if (g[y][x] !== '.' && h[y][x] === '.' && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => get(h, x + dx, y + dy) === 'p')) inner.push([x, y]);
            for (const [x, y] of inner) h[y][x] = 'k';
        }
        if (ei >= 0) { if (c.bh >= 5) { pts(h, 'p', [[ex - 1, ey], [ex, ey - 1], [ex, ey + 1]]); put(h, ex, ey, 'k'); } else put(h, ex, ey, 'p'); }
        const out = pad(h, 1, 1, 1, 1); outline(out, 'k');
        return out;
    }
    const v = variant === 'hollow' ? 'solid' : variant;
    const small = c.name === 'mote' || c.name === 'baby';
    if (v === 'stripe') {
        for (const i of a.bars) for (let y = 0; y < c.bh; y++) if (body(tl + i, y) && (c.bh < 5 || (get(g, tl + i, y - 1) !== '.' && get(g, tl + i, y + 1) !== '.'))) put(g, tl + i, y, 'k');
    } else if (v === 'spot') {
        if (small) put(g, tl + 1, Math.round((c.bh - 1) / 2), 'k');
        else for (let i = 0; i < c.bw - 1; i++) for (let y = 0; y < c.bh; y++) {
            const on = (i % 4 === 1 && y % 4 === 1) || (i % 4 === 3 && y % 4 === 3);
            if (on && body(tl + i, y) && !(Math.abs(i - ei) <= 1 && Math.abs(y - ey) <= 1) && get(g, tl + i - 1, y) !== '.' && get(g, tl + i + 1, y) !== '.' && get(g, tl + i, y - 1) !== '.' && get(g, tl + i, y + 1) !== '.') put(g, tl + i, y, 'k');
        }
    } else if (v === 'check') {
        for (let i = 0; i < c.bw - 1; i++) for (let y = 0; y < c.bh; y++)
            if ((i + y) % 2 === 0 && body(tl + i, y) && !(Math.abs(i - ei) <= 1 && Math.abs(y - ey) <= 1)) put(g, tl + i, y, 'k');
    } else if (v === 'solid' && a.gill >= 0) {
        const cy = (c.bh - 1) / 2;
        for (let y = 0; y < c.bh; y++) if (body(tl + a.gill, y) && Math.abs(y - cy) <= (c.bh >= 7 ? 2 : 1) && get(g, tl + a.gill, y - 1) !== '.' && get(g, tl + a.gill, y + 1) !== '.') put(g, tl + a.gill, y, 'k');
    }
    if (ei >= 0) put(g, ex, ey, 'k');
    const out = pad(g, 1, 1, 1, 1); outline(out, 'k');
    return inverted ? swap(out) : out;
}

// ── orca ─────────────────────────────────────────────────────
// Ink body with paper belly/chin, eye patch and saddle: the black-and-white animal is the 1-bit animal.
// Outline in paper. Flukes are column sets (far -> near) sheared by the frame.
function lerpPoly(k, x) {
    for (let i = 1; i < k.length; i++) if (x <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (x - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
    return k[k.length - 1][1];
}
function orcaSprite(frame) {
    const tl = 6, bw = 22, H = 15, g = mk(tl + bw, H);
    const top = [[0, 7], [3, 6], [5, 4], [14, 4], [17, 5], [20, 6], [21, 7]], bot = [[0, 9], [3, 10], [5, 11], [14, 11], [17, 11], [20, 10], [21, 9]];
    for (let x = 0; x < bw; x++) for (let y = Math.round(lerpPoly(top, x)); y <= Math.round(lerpPoly(bot, x)); y++) put(g, tl + x, y, 'k');
    // dorsal fin, swept back
    const fin = [[8], [8, 9], [8, 9, 10], [7, 8, 9, 10, 11, 12]];
    fin.forEach((r, y) => r.forEach(x => put(g, tl + x, y, 'k')));
    // pectoral flipper
    [[10, 11, 12, 13], [10, 11, 12], [10, 11]].forEach((r, i) => r.forEach(x => put(g, tl + x, 12 + i, 'k')));
    // flukes
    const cols = [[3, 4, 12, 13], [4, 5, 11, 12], [5, 6, 10, 11], [6, 7, 8, 9, 10], [7, 8, 9], [7, 8, 9]];
    const shear = [3, 2, 1, 0, 0, 0], dir = [0, -1, 0, 1][frame & 3];
    cols.forEach((rows, k) => rows.forEach(y => put(g, k, y + dir * shear[k] + (frame === 2 ? (y < 8 ? -1 : 1) * (k < 3 ? 1 : 0) : 0), 'k')));
    // paper: belly and chin, eye patch, dithered saddle
    for (let x = 7; x < bw; x++) for (let y = 4; y <= 11; y++) if (get(g, tl + x, y) === 'k' && y >= 11 - Math.floor((x - 5) * 0.16 + 0.5)) put(g, tl + x, y, 'p');
    pts(g, 'p', [[15, 6], [16, 6], [17, 6], [18, 6], [16, 7], [17, 7]].map(([x, y]) => [tl + x, y]));
    for (let y = 5; y <= 6; y++) for (let x = 9; x <= 13; x++) if (dith(x, y, 0.45)) put(g, tl + x, y, 'p');
    pts(g, 'k', [[tl + 17, 6]]);                                             // eye
    const out = pad(g, 1, 1, 1, 1); outline(out, 'p');
    return out;
}

// ── angler ───────────────────────────────────────────────────
// Round ink body, zig-zag grin of paper teeth, a long stalk arching over the mouth to the lure.
function anglerSprite(frame) {
    const tl = 3, bw = 14, dy = 2, H = 18, g = mk(tl + bw, H);
    const P = (ch, list) => pts(g, ch, list.map(([x, y]) => [x, y + dy]));
    const top = [[0, 8], [2, 6], [5, 4], [8, 4], [11, 5], [13, 7]], bot = [[0, 10], [2, 12], [5, 14], [8, 14], [11, 13], [13, 11]];
    for (let x = 0; x < bw; x++) for (let y = Math.round(lerpPoly(top, x)); y <= Math.round(lerpPoly(bot, x)); y++) put(g, tl + x, y + dy, 'k');
    // tail fan, sheared by the frame
    const sh = [0, -1, 0, 1][frame & 3];
    [[8 + sh, 9 + sh, 12 + sh, 13 + sh], [9, 10, 11, 12], [10, 11]].forEach((rows, k) => rows.forEach(y => put(g, k, y + dy, 'k')));
    P('k', [[tl + 3, 3], [tl + 4, 3], [tl + 3, 2]]);                       // dorsal fin
    // stalk: up from the brow, over the head, to the lure hanging in front of the mouth
    const ty = 1 + [0, 1, 0, -1][frame & 3];
    pts(g, 'k', [[tl + 4, 5], [tl + 5, 4], [tl + 6, 3], [tl + 7, 2], [tl + 8, 1], [tl + 9, 0], [tl + 10, 0], [tl + 11, 1], [tl + 12, ty]]);
    if (ty === 2) put(g, tl + 12, 1, 'k');
    // open mouth: a paper gap between the jaws, ink teeth hanging into it
    for (let x = tl + 7; x <= tl + 13; x++) { P('p', [[x, 9]]); P('p', [[x, 10]]); }
    P('k', [[tl + 8, 9], [tl + 10, 9], [tl + 12, 9], [tl + 9, 10], [tl + 11, 10], [tl + 13, 10]]);
    // big eye: 2x2 paper with the pupil in one corner
    P('p', [[tl + 8, 5], [tl + 9, 5], [tl + 8, 6], [tl + 9, 6]]);
    P('k', [[tl + 9, 6]]);
    for (let x = tl + 2; x < tl + 10; x++) if (get(g, x, 14 + dy) === 'k' && x % 2 === 0) put(g, x, 14 + dy, 'p');   // belly dither
    const out = pad(g, 1, 1, 1, 1); outline(out, 'p');
    return out;
}

// ── jelly ────────────────────────────────────────────────────
// Bell: paper rim, interior = paper dots by Bayer density (the water shows through), ink outside.
// Tentacles = columns of paper with an ink shadow to the right. w = bell width (odd).
const JELLY = [
    { name: 's', cw: 11, h: 6, len: 8, bell: [[1, 3, 4, 4, 4, 5], [1, 3, 4, 4, 4, 4], [1, 2, 3, 3, 3, 3, 4], [1, 3, 4, 4, 4, 4]] },
    { name: 'l', cw: 13, h: 8, len: 11, bell: [[2, 4, 5, 5, 5, 5, 5, 6], [2, 4, 5, 5, 5, 5, 5, 5], [1, 3, 4, 4, 4, 4, 4, 4, 5], [2, 4, 5, 5, 5, 5, 5, 5]] }
];
function jellyDims(c) { return { cols: c.cw + 2, rows: c.h + c.len + 5 }; }
function jellySprite(ci, frame) {
    const c = JELLY[ci], bell = c.bell[frame & 3], h = bell.length, cw = c.cw;
    const g = mk(cw, c.h + c.len + 3);
    const cx = (cw - 1) / 2;
    // bell: solid paper dome, ink dots thicken towards the lip (Bayer), scalloped lip
    for (let r = 0; r < h; r++) {
        for (let x = -bell[r]; x <= bell[r]; x++) {
            const X = cx + x;
            put(g, X, r, (r >= 2 && r < h - 1 && Math.abs(x) < bell[r] && dith(X, r, 0.5 * (r - 1) / h)) ? 'k' : 'p');
        }
    }
    for (let x = -bell[h - 1]; x <= bell[h - 1]; x++) if (Math.abs(x) % 2 === 1) put(g, cx + x, h - 1, '.');
    // tentacles: a column of paper with a waving path (ink shadow added below)
    const n = ci === 0 ? 3 : 4, span = bell[h - 1] * 2 - 2;
    for (let t = 0; t < n; t++) {
        const bx = Math.round(cx + (t - (n - 1) / 2) * (span / Math.max(1, n - 1)));
        const len = c.len - (t % 2) * 3 - (frame === 2 ? 1 : 0);
        for (let k = 0; k < len; k++) {
            const wob = Math.round(Math.sin((k + t * 2 + frame * 1.6) * 0.8) * (k > 1 ? 1 : 0));
            put(g, bx + wob, h + k, 'p');
        }
    }
    const out = pad(g, 1, 1, 1, 1);
    const o = out.map(r => r.slice());
    // ink outline around the bell, ink shadow right of the tentacles
    for (let y = 0; y < H_(out); y++) for (let x = 0; x < W_(out); x++) {
        if (out[y][x] !== '.') continue;
        if (y <= h + 1 && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => get(out, x + dx, y + dy) === 'p')) o[y][x] = 'k';
    }
    for (let y = h + 2; y < H_(out); y++) for (let x = 0; x < W_(out) - 1; x++) if (out[y][x] === 'p' && o[y][x + 1] === '.') o[y][x + 1] = 'k';
    return o;
}

// ── worm ─────────────────────────────────────────────────────
function wormSprite(frame, density) {
    const g = mk(5, 11);
    for (let y = 0; y < 11; y++) {
        const x = Math.round(1.2 + 1.1 * Math.sin(y * 0.75 + frame * Math.PI / 2));
        put(g, x, y, 'p'); put(g, x + 1, y, 'p');
        if (y % 3 === 1) put(g, x, y, 'k');         // segment marks
    }
    pts(g, 'k', [[Math.round(1.2 + 1.1 * Math.sin(frame * Math.PI / 2)) + 1, 0]]);   // head dot
    const out = pad(g, 1, 1, 1, 1); outline(out, 'k');
    if (density < 1) for (let y = 0; y < H_(out); y++) for (let x = 0; x < W_(out); x++) if (!dith(x * 3 + 1, y * 3 + 1, density)) out[y][x] = '.';
    return out;
}

// ── bubbles, sparkle, lure, glow ─────────────────────────────
function bubbleSprite(big) {
    const g = big ? mk(5, 5) : mk(3, 3);
    if (big) { pts(g, 'p', [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4], [1, 1]]); }
    else pts(g, 'p', [[1, 0], [0, 1], [2, 1], [1, 2]]);
    const out = pad(g, 1, 1, 1, 1); outline(out, 'k');
    return out;
}
function sparkleSprite(frame) {
    const g = mk(3, 3);
    if (frame === 0) pts(g, 'p', [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]);
    else pts(g, 'p', [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]);
    const out = pad(g, 1, 1, 1, 1);
    if (frame === 0) outline(out, 'k');
    else for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (out[y][x] === '.' && (get(out, x, y - 1) === 'p' || get(out, x, y + 1) === 'p')) out[y][x] = 'k';
    return out;
}
function lureSprite(level) {
    const g = mk(7, 7);
    if (level === 0) pts(g, 'p', [[3, 2], [2, 3], [3, 3], [4, 3], [3, 4]]);
    else {
        for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) put(g, x, y, 'p');
        if (level === 2) pts(g, 'p', [[3, 0], [3, 1], [3, 5], [3, 6], [0, 3], [1, 3], [5, 3], [6, 3]]);
        else pts(g, 'k', [[3, 3]]);
    }
    if (level === 2) { pts(g, 'k', [[3, 3]]); }
    outline(g, 'k');
    return g;
}
function glowSprite(level) {
    const R = [6, 8, 10][level], S = R * 2 + 1, g = mk(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const r = Math.hypot(x - R, y - R) / R;
        if (r <= 1 && dith(x + 4, y + 4, 0.55 * Math.pow(1 - r, 1.5))) put(g, x, y, 'p');
    }
    return g;
}

// ── ambience ─────────────────────────────────────────────────
function noiseTile(level, half) {         // 16 wide x 8 high: rows 0-7 (half 0) or 8-15 (half 1) of the matrix
    const g = mk(16, 8);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) g[y][x] = noiseT(x, y + half * 8) < level / 64 ? 'p' : 'k';
    return g;
}
const SEABED = T.SEABED;
function seabedTile() {
    const W = SEABED.cols, H = SEABED.rows, g = mk(W, H);
    const top = x => 9 + 2.4 * Math.sin(4 * Math.PI * x / W + 0.7) + 1.8 * Math.sin(10 * Math.PI * x / W + 2.1) + 1.0 * Math.sin(18 * Math.PI * x / W + 4.0);
    const t = [];
    for (let x = 0; x < W; x++) {
        t[x] = Math.round(top(x));
        for (let y = t[x]; y < H; y++) g[y][x] = 'k';
        g[t[x]][x] = 'p';
        // sand lit from above: the stipple thins out with depth (same blue-noise matrix as the water)
        for (let k = 1; k <= 12; k++) if (t[x] + k < H && noiseT(x, t[x] + k) < 0.85 * Math.pow(1 - (k - 1) / 12, 1.6)) g[t[x] + k][x] = 'p';
    }
    // rocks: ink bodies with a paper rim and a stippled lit side
    const rock = (cx, base, rx, ry) => {
        const inside = (x, y) => Math.pow((x - cx) / rx, 2) + Math.pow((y - base) / ry, 2) <= 1 && y <= base + 2;
        for (let y = base - ry - 1; y <= base + 2; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || y === base + 2;
            const lit = x < cx + 1 && y < base - 1 && noiseT(x, y) < 0.5;
            put(g, (x + W) % W, y, edge || lit ? 'p' : 'k');
        }
    };
    const ground = x => t[((x % W) + W) % W];
    rock(30, ground(30) + 2, 8, 5); rock(41, ground(41) + 3, 5, 3);
    rock(133, ground(133) + 2, 10, 6); rock(146, ground(146) + 3, 5, 3);
    // starfish
    const star = (cx, cy) => pts(g, 'p', [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [-2, 0], [2, 0], [-1, 1], [1, 1]].map(([x, y]) => [cx + x, cy + y]));
    star(86, ground(86) + 5);
    // pebbles and ripple dashes in the shade
    for (const [x, y] of [[8, 18], [9, 18], [10, 18], [60, 20], [61, 20], [62, 20], [63, 20], [104, 17], [105, 17], [106, 17], [117, 21], [118, 21], [170, 19], [171, 19], [172, 19], [183, 22], [184, 22]]) put(g, x, y, 'p');
    for (const [x, y] of [[52, 23], [101, 24], [160, 25], [18, 25]]) { put(g, x, y, 'p'); put(g, x + 1, y, 'p'); put(g, x, y + 1, 'p'); put(g, x + 1, y + 1, 'p'); }
    return g;
}
const KELP = T.KELP;
function kelpSprite(ci, frame) {
    const h = KELP[ci].rows, W = KELP[ci].cols, g = mk(W, h), bx = 4;
    const sway = y => Math.round(Math.sin((h - y) * 0.13 + frame * 2.1) * (0.6 + (h - y) / h * 2.0));
    for (let y = 0; y < h; y++) {
        const x = bx + sway(y);
        put(g, x, y, 'p');
        if (h - y < h / 3) put(g, x - 1, y, 'p');                       // thicker towards the base
        const k = h - y;
        if (k > 5 && k % 6 === 2 && y > 1) {                            // blade: three cells out and up
            const d = (k / 6 | 0) % 2 ? 1 : -1;
            put(g, x + d, y - 1, 'p'); put(g, x + 2 * d, y - 2, 'p'); put(g, x + 2 * d, y - 3, 'p'); put(g, x + d, y, 'p');
        }
    }
    const o = g.map(r => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < W - 1; x++) if (g[y][x] === 'p' && g[y][x + 1] === '.') o[y][x + 1] = 'k';   // ink shadow to the right
    return o;
}
const SHAFT = { cols: T.SHAFT.cols, rows: T.SHAFT.rows, peaks: [0.16, 0.28, 0.42, 0.6] };
function shaftSprite(level, dir) {
    const W = SHAFT.cols, H = SHAFT.rows, g = mk(W, H), peak = SHAFT.peaks[level];
    for (let y = 0; y < H; y++) {
        const c = dir > 0 ? 18 + 0.34 * y : W - 18 - 0.34 * y, hw = 7 + y * 0.075;
        const fade = 1 - 0.55 * y / H;
        for (let x = 0; x < W; x++) {
            const u = Math.abs(x - c) / hw;
            if (u < 1 && noiseT(x, y) < peak * fade * (1 - u)) g[y][x] = 'p';
        }
    }
    return g;
}
const SURFACE = T.SURFACE;
function surfaceTile() {
    const g = mk(32, 5);
    for (let x = 0; x < 32; x++) {
        const y = 1 + Math.round(1.0 * Math.sin(2 * Math.PI * x / 32 * 2 + 0.5));
        g[y][x] = 'p'; g[y + 1][x] = 'k';
    }
    for (let x = 6; x < 11; x++) { g[4][x] = 'p'; }
    for (let x = 22; x < 26; x++) { g[4][x] = 'p'; }
    return g;
}

// ── all images ───────────────────────────────────────────────
function allImages() {
    const imgs = {};
    const add = (name, g, cols, rows) => {
        if (cols !== undefined && (W_(g) !== cols || H_(g) !== rows)) throw new Error(name + ' is ' + W_(g) + 'x' + H_(g) + ', theme.js says ' + cols + 'x' + rows);
        imgs[name] = render(g);
    };
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++) for (const inv of [false, true])
            add(T.fishFile(ci, v, f, inv), fishSprite(ci, v, f, inv), c.cols, c.rows);
    });
    for (let f = 0; f < 4; f++) {
        add('orca-' + f + '.png', orcaSprite(f), T.ORCA.cols, T.ORCA.rows);
        add('angler-' + f + '.png', anglerSprite(f), T.ANGLER.cols, T.ANGLER.rows);
        JELLY.forEach((c, ci) => { const d = jellyDims(c); add('jelly-' + c.name + '-' + f + '.png', jellySprite(ci, f), d.cols, d.rows); });
        for (let d = 0; d < 3; d++) add('worm-' + d + '-' + f + '.png', wormSprite(f, [1, 0.6, 0.3][d]), T.WORM.cols, T.WORM.rows);
        if (f < 3) for (let k = 0; k < KELP.length; k++) add('kelp-' + k + '-' + f + '.png', kelpSprite(k, f), KELP[k].cols, KELP[k].rows);
    }
    add('bubble-s.png', bubbleSprite(false)); add('bubble-b.png', bubbleSprite(true));
    for (let f = 0; f < 2; f++) add('sparkle-' + f + '.png', sparkleSprite(f));
    for (let l = 0; l < 3; l++) { add('lure-' + l + '.png', lureSprite(l)); add('glow-' + l + '.png', glowSprite(l)); }
    for (let l = 0; l <= 64; l++) for (let h = 0; h < 2; h++) add(T.noiseFile(l, h), noiseTile(l, h), 16, 8);
    add('seabed.png', seabedTile(), SEABED.cols, SEABED.rows);
    add('surface.png', surfaceTile(), SURFACE.cols, SURFACE.rows);
    for (let l = 0; l < 4; l++) add('shaft-' + l + '.png', shaftSprite(l, 1), SHAFT.cols, SHAFT.rows);
    return imgs;
}

// ── contact sheet ────────────────────────────────────────────
function sheet(imgs, file) {
    const S = +(process.env.SCALE || 8), PAD = 2;
    let rows = [];
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const inv of [false, true]) rows.push(T.FISH_VARIANTS.map(v => Array.from({ length: 4 }, (_, f) => T.fishFile(ci, v, f, inv))).reduce((a, b) => a.concat(b), []));
    });
    const fr = (fmt, n) => Array.from({ length: n }, (_, f) => fmt(f));
    rows.push(fr(f => 'orca-' + f + '.png', 4));
    rows.push(fr(f => 'angler-' + f + '.png', 4).concat(['lure-0.png', 'lure-1.png', 'lure-2.png', 'glow-0.png', 'glow-1.png', 'glow-2.png', 'sparkle-0.png', 'sparkle-1.png', 'bubble-s.png', 'bubble-b.png']));
    rows.push(fr(f => 'jelly-s-' + f + '.png', 4).concat(fr(f => 'jelly-l-' + f + '.png', 4)));
    rows.push(fr(f => 'worm-0-' + f + '.png', 4).concat(fr(f => 'worm-1-' + f + '.png', 4), fr(f => 'worm-2-' + f + '.png', 4), fr(f => 'kelp-0-' + (f % 3) + '.png', 3), fr(f => 'kelp-1-' + (f % 3) + '.png', 3), fr(f => 'kelp-2-' + (f % 3) + '.png', 3)));
    rows.push(['seabed.png', 'surface.png']);
    if (process.env.ONLY) { const re = new RegExp(process.env.ONLY); rows = rows.map(r => r.filter(n => re.test(n))).filter(r => r.length); }
    const dims = rows.map(r => ({ w: r.reduce((a, n) => a + imgs[n].W * S + PAD * S, PAD * S), h: Math.max(...r.map(n => imgs[n].H * S)) + 2 * PAD * S }));
    const SW = Math.max(...dims.map(d => d.w)), SH = dims.reduce((a, d) => a + d.h, 0);
    const px = Buffer.alloc(SW * SH * 4);
    // left half: mid-tone Bayer water, right half: dark water -- sprites must read on both
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const tx = x / S | 0, ty = y / S | 0, d = x < SW / 2 ? 0.0 : 1.0;
        const c = noiseT(tx, ty) < d ? T.PAPER_RGB : T.INK_RGB;
        px[(y * SW + x) * 4] = c[0]; px[(y * SW + x) * 4 + 1] = c[1]; px[(y * SW + x) * 4 + 2] = c[2]; px[(y * SW + x) * 4 + 3] = 255;
    }
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
