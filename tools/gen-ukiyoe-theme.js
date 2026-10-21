// Generates the "ukiyoe" theme's textures and, optionally, a contact sheet.
//   node tools/gen-ukiyoe-theme.js [--check] [--sheet <out.png>] [--write]     (SCALE=4 sets the sheet scale)
//
// A nishiki-e (colour woodblock print) is flat colour areas with bold keyblock outlines, soft bokashi gradients,
// repeating traditional patterns and a limited pigment palette. So: every sprite, the surface strip and the
// seabed are flat fills in the PALETTE of theme.js (one letter per pigment) with 1-texel sumi / indigo outlines;
// only the water layers are blends (a bokashi gradient with the Seigaiha pattern added at low contrast).
// Nothing is noise and nothing animates but the frame sets.
//
// Art is built on char grids: a letter is a pigment of T.PALETTE (water tones '1'..'5' are per variant), '.' is clear.
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('../tests/png');
const { loadScript } = require('../tests/harness');

const ROOT = path.join(__dirname, '..');
const T = loadScript(path.join(ROOT, 'contents', 'themes', 'ukiyoe', 'theme.js'));
const OUT = path.join(ROOT, 'contents', 'themes', 'ukiyoe', 'img');

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const W_ = g => g[0].length, H_ = g => g.length;
const get = (g, x, y) => (y >= 0 && y < H_(g) && x >= 0 && x < W_(g)) ? g[y][x] : '.';
const put = (g, x, y, ch) => { if (y >= 0 && y < H_(g) && x >= 0 && x < W_(g)) g[y][x] = ch; };
const pts = (g, ch, list) => { for (const [x, y] of list) put(g, x, y, ch); };
const N4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// 1-texel outline (4-neighbourhood, so diagonals stay crisp) around every non-empty texel
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
function blit(dst, src, ox, oy) {
    for (let y = 0; y < H_(src); y++) for (let x = 0; x < W_(src); x++) if (src[y][x] !== '.') put(dst, ox + x, oy + y, src[y][x]);
}
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// letter -> rgb for a grid; water tones belong to a daylight variant (default: day)
function palette(variant) {
    const p = {};
    for (const k in T.PALETTE) p[k] = hex(T.PALETTE[k]);
    T.WATER.variants[variant === undefined ? T.WATER.variants.length - 1 : variant].tones.forEach((c, i) => { p[String(i + 1)] = hex(c); });
    return p;
}
function render(g, variant) {
    const H = H_(g), W = W_(g), px = Buffer.alloc(W * H * 4), pal = palette(variant);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (g[y][x] === '.') continue;
        const c = pal[g[y][x]];
        if (!c) throw new Error('unknown pigment letter ' + g[y][x]);
        const o = (y * W + x) * 4;
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
    return { W, H, px };
}

// 4-connected line (never leaves diagonal-only gaps)
function line(g, x0, y0, x1, y1, ch) {
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

// ── fish: koi ────────────────────────────────────────────────
// Sculpted silhouettes with dorsal fin crest, ventral fin, plump snout (nose right) and forked tail.
// Frames: 0 neutral, 1 tail up, 2 wide/pectoral beat, 3 tail down. Silhouette rows: 'p' = body or fin texel.
const FISH_ART = {
    large: {
        tl: 4, shift: 2, eye: [10, 3],
        rows: [
            'p.....pppp...',
            'pp...ppppppp.',
            'ppp.ppppppppp',
            '.pppppppppppp',
            '..ppppppppppp',
            '.pppppppppppp',
            'ppp.ppppppppp',
            'pp...ppppppp.',
            'p.....pppp...'
        ]
    },
    mid: {
        tl: 3, shift: 2, eye: [8, 2],
        rows: [
            'p....pppp..',
            'pp..pppppp.',
            'ppppppppppp',
            '.pppppppppp',
            'ppppppppppp',
            'pp..pppppp.',
            'p....ppp...'
        ]
    },
    small: {
        tl: 2, shift: 1, eye: [6, 2],
        rows: [
            'p...pppp.',
            'pp.pppppp',
            '.pppppppp',
            '.pppppppp',
            'pp.pppppp',
            'p...ppp..'
        ]
    },
    baby: {
        tl: 2, shift: 1, eye: [5, 1],
        rows: [
            'p..ppp.',
            'ppppppp',
            '.pppppp',
            'ppppppp',
            'p..pp..'
        ]
    },
    mote: {
        tl: 1, shift: 1, eye: [3, 1],
        rows: [
            'p.pp',
            '.ppp',
            'p.pp'
        ]
    }
};

function fishBase(name, frame) {
    const a = FISH_ART[name], H = a.rows.length, W = a.rows[0].length, g = mk(W, H);
    a.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'p') g[y][x] = 'p'; }));
    const dy = frame === 1 ? -1 : frame === 3 ? 1 : 0;
    if (dy && a.shift) {
        for (let c = 0; c < a.shift; c++) {
            const rows = [];
            for (let y = 0; y < H; y++) if (g[y][c] === 'p') rows.push(y);
            for (const y of rows) g[y][c] = '.';
            for (const y of rows) put(g, c, Math.max(0, Math.min(H - 1, y + dy)), 'p');
        }
        // ensure 4-connectivity between shifted tail tips and tail stock
        for (let it = 0; it < 3; it++) {
            for (let c = 0; c < a.shift; c++) for (let y = 0; y < H; y++) {
                if (g[y][c] === 'p' && !N4.some(([dx, dy2]) => get(g, c + dx, y + dy2) === 'p')) {
                    put(g, c, Math.max(0, Math.min(H - 1, y - dy)), 'p');
                }
            }
        }
    }
    return g;
}

// Koi patterns in normalised body coordinates (u: 0 tail stock .. 1 nose, v: 0 back .. 1 belly). Each variant
// returns the pigment of a body texel; `spot` is true where the pattern pigment sits (the alarm variant paints it
// deep vermilion on a vermilion body).
const patch = (u, v, list) => list.some(([cx, cy, rx, ry]) => inEll(u, v, cx, cy, rx, ry));
function koiPixel(variant, u, v, x, y) {
    switch (variant) {
        case 'kohaku': {                                   // white with red patches (a head cap, a saddle)
            if (patch(u, v, [[0.8, 0.12, 0.17, 0.3], [0.46, 0.3, 0.2, 0.38], [0.16, 0.5, 0.11, 0.3]])) return [v > 0.6 ? 'R' : 'r', true];
            return [v > 0.74 ? 'W' : 'w', false];
        }
        case 'ogon':                                       // plain gold with a darker back and a pale belly
            return [v < 0.28 ? 'Y' : (v > 0.76 ? 'S' : 'y'), v < 0.28];
        case 'sanke': {                                    // white, red patches and sumi black accents
            if (patch(u, v, [[0.62, 0.62, 0.1, 0.17], [0.3, 0.34, 0.11, 0.22]])) return ['k', true];
            if (patch(u, v, [[0.8, 0.12, 0.15, 0.3], [0.5, 0.3, 0.18, 0.32]])) return ['r', true];
            return [v > 0.74 ? 'W' : 'w', false];
        }
        case 'asagi':                                      // blue-grey with a net of darker scales, ochre belly
            if (v > 0.66 && u > 0.1) return ['y', false];
            { const net = (x + y) % 3 === 0 && v < 0.62; return [net ? 'B' : 'b', net]; }
        default:                                           // shusui: deep blue back over a white belly, red cheek
            if (patch(u, v, [[0.8, 0.74, 0.1, 0.16]])) return ['r', true];
            if (v < 0.3) return ['B', true];
            return [v > 0.78 ? 'W' : 'w', false];
    }
}
const FIN = { kohaku: 'w', ogon: 'Y', sanke: 'w', asagi: 'B', shusui: 'w' };

function fishSprite(ci, variant, frame, inverted) {
    const name = T.FISH_CLASSES[ci].name, a = FISH_ART[name], tl = a.tl;
    const g = fishBase(name, frame), W = W_(g), H = H_(g);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (g[y][x] !== 'p') continue;
        if (x < tl) { g[y][x] = inverted ? 'R' : FIN[variant]; continue; }
        const u = (x - tl + 0.5) / (W - tl), v = (y + 0.5) / H;
        const [col, spot] = koiPixel(variant, u, v, x, y);
        g[y][x] = inverted ? (spot ? 'R' : 'r') : col;
    }
    const e = a.eye;
    if (e) put(g, e[0], e[1], inverted ? 'w' : 'k');
    const out = pad(g, 1, 1, 1, 1);
    outline(out, 'k');
    return out;
}

// ── orca ─────────────────────────────────────────────────────
// Killer whale, hand-drawn on char grids (nose to the right, the sim flips it): a streamlined body (length about
// 3.5x its depth) with a blunt melon head, a tall back-swept dorsal fin, a slim tail stock ending in small swept
// flukes, a broad flipper, a slanted eye patch, a saddle behind the fin and a belly patch hooking up toward the
// flank. 'k' is sumi black, 'p' is washi cream. Frames: 0 neutral, 1 flukes tilted up, 2 neutral, 3 tilted down.
const ORCA_ART = {
    full: {
        rows: [
            '................kk....................',
            '................kkk...................',
            '.................kkk..................',
            '.................kkkk.................',
            '..................kkkk................',
            '..................kkkkkk..............',
            '..................kkkkkkkkkkkkkk......',
            'k..............kkkkkkkkkkkkkkkkkk.....',
            'kk..........kkkkppkkkkkkkkkppppkkkk...',
            '.kkk.....kkkkpppppkkkkkkkkkkppppkkkkk.',
            '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
            '...kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
            '..kkkkkkkkkkkkkpppkkkkkkkkkkkkkkpppppk',
            '.kk......kkkkkkppppppppkkkkkkkkkpppp..',
            '...............kppppppppppkkkkpppp....',
            '..................kkkkkkkkkkkk........',
            '.....................kkkkkkkkk........',
            '.........................kkkk.........',
            '........................kkk...........',
            '......................................',
            '......................................'
        ],
        beat: [],
        flukes: [
            [7, ['k....', 'kk...', '.kkk.', '..kkk', '...kk', '..kkk', '.kk..']],
            [6, ['k....', 'kk...', '.kk..', '..kkk', '..kkk', '.kkkk', 'kk...']],
            [7, ['k....', 'kk...', '.kkk.', '..kkk', '...kk', '..kkk', '.kk..']],
            [9, ['kk...', '.kkkk', '..kkk', '..kkk', '.kk..', 'kk...', 'k....']]
        ],
        rim: [24, 5]
    },
    small: {
        rows: [
            '.........kk............',
            '.........kkk...........',
            '..........kkk..........',
            '..........kkkkk........',
            'k........kkkkkkkkkkkk..',
            'kk....kkkkkkkkkkpkkkkk.',
            '.kkkkkkkkkkkkkkkkppkkkk',
            'kkkkkkkkkkkkkkkkkkkkkkk',
            '......kppppkkkkkkkkkkkk',
            '........pppppppkkppkkk.',
            '...........ppppkkkpp...',
            '..............kkkk.....',
            '..............kkk......'
        ],
        beat: [[0, 2, [0, -1, 0, 1]]],
        rim: [14, 3]
    }
};

function orcaSprite(frame, small) {
    const A = small ? ORCA_ART.small : ORCA_ART.full;
    const src = A.rows.map(r => [...r]), g = A.rows.map(r => [...r]);
    for (const [x0, x1, dys] of A.beat) {
        const d = dys[frame & 3];
        for (let x = x0; x <= x1; x++) for (let y = 0; y < g.length; y++) g[y][x] = get(src, x, y - d);
    }
    if (A.flukes) {
        const [r0, rows] = A.flukes[frame & 3];
        for (let y = 0; y < g.length; y++) for (let x = 0; x < rows[0].length; x++) g[y][x] = '.';
        rows.forEach((r, i) => [...r].forEach((ch, x) => { g[r0 + i][x] = ch; }));
    }
    for (const r of g) for (let x = 0; x < r.length; x++) if (r[x] === 'p') r[x] = 'w';
    const out = pad(g, 1, 1, 1, 1);
    // rim light: the slate outline (a lighter edge than the sumi body, so the black reads on the blue water)
    outline(out, 'n');
    const add = [];
    for (let y = 0; y < H_(out) - 1; y++) for (let x = 0; x < W_(out); x++) if (out[y][x] === '.' && out[y + 1][x] !== '.' && (!A.rim || (y >= A.rim[1] && x >= A.rim[0]))) add.push([x, y]);
    pts(out, 'n', add);
    return out;
}

// ── angler ───────────────────────────────────────────────────
// Deep-sea anglerfish in deep wisteria with a sumi outline, cream teeth, an ochre eye and a lantern lure on an
// arching illicium (the lure itself is lure-<n>.png, anchored at T.LURE).
function anglerSprite(frame, small) {
    const W = small ? 11 : 17, H = small ? 10 : 15;
    const g = mk(W, H);
    const dir = [0, -1, 0, 1][frame & 3];
    const body = 'M';

    if (!small) {
        const aTop = [8, 7, 6, 5, 4, 4, 4, 4, 4, 5, 5, 6, 6, 7]; // x = 3..16
        const aBot = [10, 11, 12, 13, 13, 14, 14, 14, 14, 13, 13, 13, 12, 11];
        for (let i = 0; i < aTop.length; i++) {
            const x = 3 + i;
            for (let y = aTop[i]; y <= aBot[i]; y++) put(g, x, y, body);
        }
        pts(g, body, [[6, 3], [7, 2], [7, 3], [8, 3], [9, 3], [7, 14], [8, 14]]);
        const tCols = [[0, [6, 7, 8, 10, 11, 12]], [1, [7, 8, 9, 10, 11]], [2, [8, 9, 10]]];
        for (const [x, rows] of tCols) {
            const sh = x < 2 ? dir : 0;
            for (const y of rows) put(g, x, Math.max(2, Math.min(H - 1, y + sh)), 'm');
        }
        // lit back (upper rim), cavernous mouth with alternating teeth
        for (let i = 0; i < aTop.length; i++) put(g, 3 + i, aTop[i], 'm');
        for (let x = 11; x <= 16; x++) {
            put(g, x, 9, (x % 2 === 1) ? 'w' : 'k');
            put(g, x, 10, 'k');
            put(g, x, 11, (x % 2 === 0) ? 'w' : 'k');
        }
        // glaring eye: ochre ring, sumi pupil
        for (let y = 5; y <= 7; y++) for (let x = 10; x <= 12; x++) put(g, x, y, 'y');
        put(g, 11, 6, 'k');
        // gill rib, pectoral fin & bioluminescent speckles
        pts(g, 'm', [[8, 8], [7, 9], [8, 10], [5, 7], [6, 11], [9, 12]]);
    } else {
        const sTop = [5, 4, 3, 3, 3, 3, 3, 4, 4]; // x = 2..10
        const sBot = [6, 7, 8, 8, 9, 9, 9, 8, 7];
        for (let i = 0; i < sTop.length; i++) {
            for (let y = sTop[i]; y <= sBot[i]; y++) put(g, 2 + i, y, body);
            put(g, 2 + i, sTop[i], 'm');
        }
        pts(g, 'm', [[0, 4 + dir], [0, 5 + dir], [0, 7 + dir], [1, 5], [1, 6]]);
        for (let x = 7; x <= 10; x++) {
            put(g, x, 6, (x % 2 === 1) ? 'w' : 'k');
            put(g, x, 7, (x % 2 === 0) ? 'w' : 'k');
        }
        pts(g, 'y', [[6, 4], [7, 4], [6, 5]]);
        put(g, 7, 5, 'k');
        pts(g, 'm', [[4, 6]]);
    }

    const out = pad(g, 1, 1, 1, 1);
    outline(out, 'k');

    const lp = T.LURE[small ? 1 : 0][frame & 3];
    const sx = small ? 8 : 11, sy = small ? 3 : 4;
    const mx = Math.round((sx + lp.x) / 2), my = Math.max(0, Math.min(sy, lp.y) - 1);
    line(out, sx, sy, mx, my, 'm');
    line(out, mx, my, lp.x, lp.y, 'm');
    return out;
}

// ── jelly ────────────────────────────────────────────────────
// Kurage: a pale wisteria bell with wisteria canals and rim, cream frill and cream tentacles that wave with phase lag.
const JELLY_ART = {
    t: {
        cols: 9, rows: 15,
        bell: [[1, 3, 3, 3, 3], [1, 2, 3, 3, 3, 2], [1, 2, 2, 2, 2, 2]],
        tent: [[-2, 7], [0, 8], [2, 7]]
    },
    s: {
        cols: 12, rows: 19,
        bell: [[2, 4, 5, 5, 5, 5], [1, 3, 4, 5, 4, 4, 3], [1, 3, 4, 4, 4, 3, 3]],
        tent: [[-3, 9], [-1, 10], [1, 10], [3, 9]]
    },
    l: {
        cols: 14, rows: 22,
        bell: [[2, 4, 5, 6, 6, 6, 6], [2, 4, 5, 5, 5, 5, 4, 4], [1, 3, 4, 5, 5, 4, 4, 3]],
        tent: [[-4, 10], [-2, 11], [0, 12], [2, 11], [4, 10]]
    }
};

function jellySprite(ci, frame) {
    const a = JELLY_ART[T.JELLY[ci].name], W = a.cols, H = a.rows;
    const cx = Math.floor((W - 1) / 2);
    const bell = a.bell[[0, 1, 2, 1][frame & 3]], hb = bell.length;
    const g = mk(W, H);

    for (let r = 0; r < hb; r++) {
        const hw = bell[r];
        for (let dx = -hw; dx <= hw; dx++) {
            const x = cx + dx;
            if (x <= 0 || x >= W - 1) continue;
            if (r === hb - 1 && Math.abs(dx) % 2 === 1) continue;
            put(g, x, 1 + r, r === hb - 1 ? 'w' : 'L');
        }
    }
    // canals and the sub-marginal frill band (the upper-left crown stays lit)
    for (let r = 2; r < hb - 1; r++) {
        const hw = bell[r];
        if (r === hb - 2) {
            for (let dx = -hw + 1; dx <= hw - 1; dx++) if (dx % 2 === 0) put(g, cx + dx, 1 + r, 'm');
        } else if (W >= 12) {
            for (const rib of [-2, 2]) if (Math.abs(rib) < hw - 1) put(g, cx + rib, 1 + r, 'm');
        }
    }
    // lit crown
    put(g, cx - 1, 2, 'w');
    if (hb > 4) put(g, cx - 2, 3, 'w');
    outline(g, 'm');

    a.tent.forEach(([off, len], ti) => {
        let px = Math.max(1, Math.min(W - 2, cx + off));
        for (let k = 0; k < len; k++) {
            const y = 1 + hb + k;
            if (y >= H - 1) break;
            const wob = Math.round(0.85 * Math.sin(k * 0.45 + frame * 1.5708 + ti * 1.1) * (k > 1 ? 1 : 0));
            const x = Math.max(1, Math.min(W - 2, cx + off + wob));
            if (x !== px) put(g, px, y, 'w');
            put(g, x, y, 'w');
            px = x;
        }
    });
    return g;
}

// ── worm ─────────────────────────────────────────────────────
// Segmented vermilion worm (4x9 texels) that shortens and dissolves across 3 life stages.
function wormSprite(stage, frame) {
    const g = mk(T.WORM.cols, T.WORM.rows), len = [9, 6, 4][stage];
    for (let y = 0; y < len; y++) {
        const x = 1 + Math.round(0.75 * Math.sin(y * 0.75 + frame * Math.PI / 2));
        put(g, x, y, 'r');
        put(g, x + 1, y, (y % 2 === 1 && y < len - 1) ? 'R' : 'r');
    }
    if (stage === 1) put(g, 2, 8, 'r'); // detached dissolving tail speck
    return g;
}

// ── bubbles, sparkle, lure ───────────────────────────────────
function bubbleSprite(big) {
    const g = big ? mk(4, 4) : mk(2, 2);
    if (big) {
        pts(g, 'w', [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]]);
        put(g, 1, 1, 'W');
    } else {
        pts(g, 'w', [[0, 0], [1, 0], [0, 1]]);
        put(g, 1, 1, 'W');
    }
    return g;
}

function sparkleSprite(frame) {
    const g = mk(T.SPARKLE_SIZE, T.SPARKLE_SIZE);
    pts(g, 'w', [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]]);
    if (frame === 1) pts(g, 'y', [[2, 0], [0, 2], [4, 2], [2, 4]]);
    return g;
}

// Angler lantern (9x9): 0 = dim bulb, 1 = lit lantern, 2 = flare with ochre rays
function lureSprite(level) {
    const g = mk(T.LURE_SIZE, T.LURE_SIZE), c = Math.floor(T.LURE_SIZE / 2);
    if (level === 0) {
        pts(g, 'r', [[c, c - 1], [c - 1, c], [c, c], [c + 1, c], [c, c + 1]]);
        outline(g, 'R');
    } else if (level === 1) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(g, c + dx, c + dy, 'r');
        pts(g, 'y', [[c, c - 2], [c, c + 2], [c - 2, c], [c + 2, c]]);
        put(g, c, c, 'y');
        outline(g, 'R');
    } else {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(g, c + dx, c + dy, 'r');
        pts(g, 'y', [[c, c - 2], [c, c - 3], [c, c + 2], [c, c + 3], [c - 2, c], [c - 3, c], [c + 2, c], [c + 3, c]]);
        put(g, c, c, 'w');
        outline(g, 'R');
        pts(g, 'y', [[1, 1], [7, 1], [1, 7], [7, 7]]);
    }
    return g;
}

// ── backdrop: bokashi water with Seigaiha ────────────────────
// Seigaiha: scales of radius R texels on a half-radius grid (rows R/2 apart, every second row shifted by R), the
// rows drawn top to bottom so each lower scale overlaps the one above. Rings `ring` texels wide alternate two
// tones, the outer arc is a lighter band 2 texels wide (never a 1-texel line). Returns the pattern index per texel: 0 none, 1 lighter ring, 2 arc.
function seigaiha(cols, rows) {
    const Wt = T.WATER, R = Wt.scale, idx = new Uint8Array(cols * rows), step = R / 2;
    for (let j = -2; Wt.startRow - R + j * step <= rows + R; j++) {
        const cy = Wt.startRow + j * step, off = (j & 1) ? R : 0;
        for (let cx = off - 2 * R; cx < cols + 2 * R; cx += 2 * R) {
            for (let y = Math.max(0, cy - R); y <= Math.min(rows - 1, cy + R); y++) {
                for (let x = cx - R; x <= cx + R; x++) {
                    const d = Math.hypot(x - cx, y - cy);
                    if (d > R) continue;
                    const k = Math.floor(d / Wt.ring), xx = ((x % cols) + cols) % cols;
                    idx[y * cols + xx] = d > R - 2 ? 2 : (k & 1 ? 1 : 0);
                }
            }
        }
    }
    return idx;
}
// gradient colour of variant v at texel row y (a step of `step` rows: the same value for step rows in a row)
function gradient(v, y) {
    const st = T.WATER.variants[v].stops, yq = Math.floor(y / T.WATER.step) * T.WATER.step + Math.floor(T.WATER.step / 2);
    let i = 0;
    while (i < st.length - 2 && yq > st[i + 1][0]) i++;
    const a = st[i], b = st[i + 1], t = Math.max(0, Math.min(1, (yq - a[0]) / (b[0] - a[0])));
    const ca = hex(a[1]), cb = hex(b[1]);
    return [0, 1, 2].map(k => lerp(ca[k], cb[k], t));
}
function waterImage(v) {
    const Wt = T.WATER, W = Wt.cols, H = Wt.rows, vr = Wt.variants[v], px = Buffer.alloc(W * H * 4), idx = seigaiha(W, H);
    for (let y = 0; y < H; y++) {
        const yq = Math.floor(y / Wt.step) * Wt.step + Math.floor(Wt.step / 2), base = gradient(v, y);
        const fade = smooth((yq - Wt.startRow) / Wt.fadeIn) * (1 - smooth((yq - Wt.fadeFrom) / (Wt.fadeTo - Wt.fadeFrom)));
        for (let x = 0; x < W; x++) {
            const p = idx[y * W + x], d = p === 2 ? vr.arc : p === 1 ? vr.tone : [0, 0, 0], o = (y * W + x) * 4;
            for (let k = 0; k < 3; k++) px[o + k] = Math.round(base[k] + d[k] * fade);
            px[o + 3] = 255;
        }
    }
    return { W, H, px };
}

// Hokusai Kanagawa-style surface strip (128 texels wide = two wave cells of 64, tiles horizontally): a deep blue
// wave body that lightens in three flat steps into the sea's top blue, a thick cream foam cap on the crest and
// tapering foam claws that hang down the curling front, indigo keyblock outlines around everything.
// Letters '1'..'5' are the variant's five blues; '4' equals the water's top tone so the strip melts into the sea.
function surfaceStrip() {
    const S = T.SURFACE, W = S.cols, H = S.rows, g = mk(W, H);
    const cells = [{ amp: 12.5, xp: 40, trough: 15.4 }, { amp: 10, xp: 37, trough: 15.4 }];
    cells.forEach((c, ci) => {
        const x0 = ci * 64;
        const top = x => {                                   // crest profile: the row of the wave's upper edge
            if (x <= c.xp) return c.trough - c.amp * Math.pow(Math.sin(Math.PI / 2 * x / c.xp), 1.7) + 0.3 * Math.sin(x * 0.6);
            const u = Math.min(1, (x - c.xp) / 15);          // the lip curls over and the front face falls steeply
            return c.trough - c.amp + c.amp * Math.pow(u, 1.9);
        };
        const putc = (x, y, ch) => put(g, x0 + x, y, ch);
        for (let x = 0; x < 64; x++) {
            const t = top(x), yt = Math.round(t);
            // foam depth: none on the back slope, a thick cap near the crest, thin along the front face
            const fd = x < 13 ? 0 : (x < c.xp ? 2 + 2.2 * smooth((x - 13) / (c.xp - 13)) : 4.2 * (1 - smooth((x - c.xp) / 9)));
            for (let y = yt; y < H; y++) {
                const d = y - t;
                const foamHere = fd >= 0.9 && d < fd;
                putc(x, y, foamHere ? 'w' : (d < fd + 5 ? '2' : (d < fd + 9 ? '3' : '4')));
            }
        }
        // foam claws: tapering fingers hanging from the crest lip down the front face, curling forward
        const claws = [[c.xp - 5, 7.5, 0.0], [c.xp + 0, 10, 0.4], [c.xp + 5, 9, 0.8], [c.xp + 10, 6, 1.1]];
        for (const [cx, len, curl] of claws) {
            const cy = top(cx) + 1.5;
            for (let s2 = 0; s2 <= len * 3; s2++) {
                const t = s2 / (len * 3), px = cx + 1.2 * t * len * 0.35 + curl * 2.2 * t * t, py = cy + len * t;
                const rad = 1.7 * (1 - 0.75 * t) + 0.3;
                for (let y = Math.floor(py - rad); y <= Math.ceil(py + rad); y++) for (let x = Math.floor(px - rad); x <= Math.ceil(px + rad); x++) {
                    if (Math.hypot(x - px, y - py) <= rad) putc(x, y, 'w');
                }
            }
        }
        // spray: two detached 2x2 cream flecks ahead of the crest
        for (const [fx, fy] of [[c.xp + 12, 3], [c.xp + 16, 1]]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) putc(fx + dx, fy + dy, 'w');
    });
    // keyblock outlines: indigo around the whole shape and between foam and blue
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = g[y][x];
        for (const [dx, dy] of N4) {
            const n = get(g, (x + dx + W) % W, y + dy);
            if (c === '.' && n !== '.') { add.push([x, y]); break; }
            if (c !== 'w' && c !== '.' && n === 'w') { add.push([x, y]); break; }
        }
    }
    for (const [x, y] of add) g[y][x] = 'i';
    return g;
}

// ── seabed ───────────────────────────────────────────────────
// Matsushima: ochre/brown rock islands with tiered pine tufts, vermilion coral, and cream-ochre dunes with printed
// wave contours (continuous bands that follow the dune, not dashes), keyblock outlines in dark brown (640x32).
function pineSprite(w) {
    // Matsushima pine: a 2-texel trunk and two flat cloud tiers; lit malachite on top (2 rows), deep malachite
    // below (1 row). Flat shapes only: no 1-texel outline and no period-2 stacking.
    const g = mk(w + 2, 8), cx = Math.floor((w + 2) / 2);
    for (let y = 6; y <= 7; y++) pts(g, 'O', [[cx - 1, y], [cx, y]]);
    for (const [yt, tw] of [[0, w - 3], [3, w]]) {
        for (let k = 0; k < 3; k++) {
            const hw = Math.round((tw / 2) * (0.7 + 0.15 * k));
            for (let x = cx - hw; x <= cx + hw - 1; x++) put(g, x, yt + k, k === 2 ? 'G' : 'g');
        }
    }
    return g;
}
function seabedTile() {
    const W = T.SEABED.cols, H = T.SEABED.rows, g = mk(W, H), rnd = rng(109);
    const nearTop = x => T.seabedTop(x);
    const farTop = x => {
        const a = 6.2831853 * ((x % W) + W) / W;
        return Math.min(nearTop(x) - 5, Math.round(11 + 2.2 * Math.sin(2 * a + 1.1) + 1.5 * Math.sin(5 * a + 0.4) + 0.9 * Math.cos(9 * a + 2.3)));
    };
    const putW = (x, y, ch) => put(g, ((x % W) + W) % W, y, ch);

    // 1. far dunes (sand shade) and near dunes (cream ochre), brown crest lines, printed wave contours
    for (let x = 0; x < W; x++) {
        const ft = farTop(x), nt = nearTop(x);
        for (let y = ft; y < H; y++) g[y][x] = 's';
        put(g, x, ft, 'o');
        for (let y = nt; y < H; y++) g[y][x] = 'S';
        put(g, x, nt, 'o');
        for (const depth of [4, 8]) { const y = nt + depth; if (y < H - 1) g[y][x] = 's'; }   // contours follow the dune
    }

    // 2. rock islands: brown body, lit ochre upper-left crescent, dark brown outline, pine tufts
    const rocks = [
        [44, 9, 5, true, 2], [56, 5, 3, true, 0], [148, 10, 6, false, 2], [162, 6, 4, false, 1],
        [248, 11, 6, true, 2], [338, 8, 5, false, 1], [418, 10, 5, true, 2], [432, 5, 3, true, 0],
        [522, 9, 5, false, 2], [600, 8, 5, true, 1]
    ];
    const rockCells = new Set(), key = (x, y) => (((x % W) + W) % W) + ',' + y;
    for (const [cx, rx, ry, onNear] of rocks) {
        const cy = (onNear ? nearTop(cx) : farTop(cx)) + 2;
        for (let y = cy - ry - 1; y <= cy + 2; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
            if (!inEll(x, y, cx, cy, rx + 0.3, ry + 0.3)) continue;
            rockCells.add(key(x, y));
            putW(x, y, inEll(x, y, cx + 2, cy + 1.5, rx - 0.5, ry - 0.2) ? 'o' : 'Y');
        }
    }
    for (const c of rockCells) {
        const [x, y] = c.split(',').map(Number);
        for (const [dx, dy] of N4) if (!rockCells.has(key(x + dx, y + dy))) putW(x + dx, y + dy, 'O');
    }
    for (const [cx, rx, ry, onNear, pines] of rocks) {
        const cy = (onNear ? nearTop(cx) : farTop(cx)) + 2, topY = cy - ry - 1;
        if (pines >= 1) { const pw = pines === 2 ? 9 : 7; blit(g, pineSprite(pw), cx - Math.floor((pw + 2) / 2) + (pines === 2 ? -2 : 0), topY - 6); }
        if (pines >= 2) blit(g, pineSprite(7), cx + 3, topY - 5);
    }

    // 3. branching vermilion corals on the far ridge (3-texel branches, darker right edge)
    for (const cx of [96, 206, 304, 468, 558]) {
        const by = farTop(cx), br = mk(23, 11);
        for (let h = 1; h <= 9; h++) {
            pts(br, 'r', [[10, 10 - h], [11, 10 - h]]); put(br, 12, 10 - h, 'R');
            if (h >= 4 && h <= 8) {
                const o = h - 3;
                pts(br, 'r', [[10 - o, 10 - h], [11 - o, 10 - h], [9 - o, 10 - h]]);
                pts(br, 'r', [[11 + o, 10 - h], [12 + o, 10 - h]]); put(br, 13 + o, 10 - h, 'R');
            }
        }
        blit(g, br, cx - 11, by - 9);
    }
    // 4. starfish & shells on the near sand
    for (const sx of [122, 378, 618]) {
        const sy = Math.min(H - 3, nearTop(sx) + 5);
        pts(g, 'r', [[sx, sy], [sx - 1, sy], [sx + 1, sy], [sx, sy - 1], [sx, sy + 1], [sx - 2, sy + 1], [sx + 2, sy + 1]]);
        pts(g, 'R', [[sx - 2, sy + 2], [sx + 2, sy + 2]]);
    }
    return g;
}

// Wakame kelp: a 2-texel stipe that opens into one broad ruffled blade in malachite with a darker midrib and
// herringbone veins, deep malachite outline. The whole plant sways by whole texels (4 frames).
function kelpSprite(ci, frame) {
    const K = T.KELP[ci], h = K.rows, W = K.cols, g = mk(W, h);
    const bx = Math.floor(W / 2) - 1;
    const ph = frame * Math.PI / 2, A = 1.0 + ci * 0.4;
    const sway = y => Math.round(Math.sin((h - y) * 0.11 + ph) * A * Math.pow((h - y) / h, 1.35) * 1.5);
    const maxw = [4, 5, 6][ci], frondTop = 2, frondBot = Math.round(h * 0.7);
    for (let y = h - 1; y >= frondTop; y--) {
        const x = bx + sway(y);
        let hw = 0;
        if (y <= frondBot) {
            const t = (frondBot - y) / (frondBot - frondTop);            // 0 at the base of the blade .. 1 at the tip
            hw = Math.round(maxw * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.9)), 0.75));
            if (((y + ci) >> 1) % 3 === 0 && hw > 1) hw -= 1;               // ruffled margin
            if (y <= frondTop + 2) hw = Math.min(hw, 1);
        }
        put(g, x, y, 'G'); put(g, x + 1, y, y > frondBot ? 'G' : 'g');
        for (let j = 1; j <= hw; j++) { put(g, x - j, y, 'g'); put(g, x + 1 + j, y, 'g'); }
        if (y > 0 && y < frondBot - 1 && y % 5 === 1) {                // herringbone veins
            for (let j = 1; j < hw; j++) { put(g, x - j, y - j + 1, 'G'); put(g, x + 1 + j, y - j + 1, 'G'); }
        }
        // join this row to the previous one when the sway steps sideways
        if (y < h - 1) {
            const xp = bx + sway(y + 1);
            if (xp !== x) { put(g, xp, y, 'G'); put(g, xp + 1, y, 'g'); }
        }
    }
    outline(g, 'G');
    return g;
}

// ── all images ───────────────────────────────────────────────
function allImages() {
    const imgs = {};
    const add = (name, g, cols, rows, variant) => {
        if (cols !== undefined && (W_(g) !== cols || H_(g) !== rows)) {
            (process.env.DIMS ? console.log : (m => { throw new Error(m); }))(name + ' is ' + W_(g) + 'x' + H_(g) + ', theme.js says ' + cols + 'x' + rows);
        }
        imgs[name] = render(g, variant);
    };
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++) for (const inv of [false, true]) {
            add(T.fishFile(ci, v, f, inv), fishSprite(ci, v, f, inv), c.cols, c.rows);
        }
    });
    for (let f = 0; f < 4; f++) {
        T.ORCA.forEach((o, i) => add(T.orcaFile(i, f), orcaSprite(f, i === 1), o.cols, o.rows));
        T.ANGLER.forEach((o, i) => add(T.anglerFile(i, f), anglerSprite(f, i === 1), o.cols, o.rows));
        T.JELLY.forEach((c, ci) => add(T.jellyFile(ci, f), jellySprite(ci, f), c.cols, c.rows));
        for (let s = 0; s < 3; s++) add('worm-' + s + '-' + f + '.png', wormSprite(s, f), T.WORM.cols, T.WORM.rows);
        for (let k = 0; k < T.KELP.length; k++) add('kelp-' + k + '-' + f + '.png', kelpSprite(k, f), T.KELP[k].cols, T.KELP[k].rows);
    }
    add('bubble-s.png', bubbleSprite(false), T.BUBBLE[0].cols, T.BUBBLE[0].rows);
    add('bubble-b.png', bubbleSprite(true), T.BUBBLE[1].cols, T.BUBBLE[1].rows);
    for (let f = 0; f < 2; f++) add('sparkle-' + f + '.png', sparkleSprite(f), T.SPARKLE_SIZE, T.SPARKLE_SIZE);
    for (let l = 0; l < 3; l++) add('lure-' + l + '.png', lureSprite(l), T.LURE_SIZE, T.LURE_SIZE);

    T.WATER.variants.forEach((vr, v) => {
        imgs[T.waterFile(v)] = waterImage(v);
        add(T.surfaceFile(v), surfaceStrip(), T.SURFACE.cols, T.SURFACE.rows, v);
    });
    add('seabed.png', seabedTile(), T.SEABED.cols, T.SEABED.rows);
    return imgs;
}

// ── contact sheet ────────────────────────────────────────────
function sheet(imgs, file) {
    const S = +(process.env.SCALE || 4), PAD = 3;
    let rows = [];
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const inv of [false, true]) {
            rows.push(T.FISH_VARIANTS.map(v => [0, 1, 2, 3].map(f => T.fishFile(ci, v, f, inv))).reduce((a, b) => a.concat(b), []));
        }
    });
    const fr = (fmt, n) => Array.from({ length: n }, (_, f) => fmt(f));
    rows.push(fr(f => 'orca-' + f + '.png', 4).concat(fr(f => 'orca-s-' + f + '.png', 4)));
    rows.push(fr(f => 'angler-' + f + '.png', 4).concat(fr(f => 'angler-s-' + f + '.png', 4), ['lure-0.png', 'lure-1.png', 'lure-2.png', 'sparkle-0.png', 'sparkle-1.png', 'bubble-s.png', 'bubble-b.png']));
    rows.push(['t', 's', 'l'].map(n => fr(f => 'jelly-' + n + '-' + f + '.png', 4)).reduce((a, b) => a.concat(b), []));
    rows.push([0, 1, 2].map(s => fr(f => 'worm-' + s + '-' + f + '.png', 4)).reduce((a, b) => a.concat(b), []));
    rows.push([0, 1, 2].map(k => fr(f => 'kelp-' + k + '-' + f + '.png', 4)).reduce((a, b) => a.concat(b), []));
    rows.push(['seabed.png', 'surface-2.png']);
    if (process.env.ONLY) {
        const re = new RegExp(process.env.ONLY);
        rows = rows.map(r => r.filter(n => re.test(n))).filter(r => r.length);
    }
    const bg = hex(T.WATER.variants[2].tones[2]);
    const dims = rows.map(r => ({
        w: r.reduce((a, n) => a + imgs[n].W * S + PAD * S, PAD * S),
        h: Math.max(...r.map(n => imgs[n].H * S)) + 2 * PAD * S
    }));
    const SW = Math.max(...dims.map(d => d.w)), SH = dims.reduce((a, d) => a + d.h, 0);
    const px = Buffer.alloc(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
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
        if (!fs.existsSync(p) || !fs.readFileSync(p).equals(png.encode(imgs[f].W, imgs[f].H, imgs[f].px))) {
            console.error('stale: ' + f);
            bad++;
        }
    }
    if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (!imgs[f]) { console.error('extra: ' + f); bad++; }
    process.exit(bad ? 1 : 0);
}
if (si < 0 || process.argv.includes('--write')) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (!imgs[f]) fs.unlinkSync(path.join(OUT, f));
    let bytes = 0;
    for (const f in imgs) {
        const b = png.encode(imgs[f].W, imgs[f].H, imgs[f].px);
        fs.writeFileSync(path.join(OUT, f), b);
        bytes += b.length;
    }
    console.log(Object.keys(imgs).length + ' images, ' + (bytes / 1024).toFixed(0) + ' KiB -> ' + OUT);
}
