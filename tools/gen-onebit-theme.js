// Generates the "onebit" theme's textures (contents/themes/onebit/img/*.png) and, optionally,
// a contact sheet. Exactly two colours (INK, PAPER from theme.js) plus transparency: every texel of
// every texture is one of the three, nothing is ever blended and no background texture uses fine noise.
//   node tools/gen-onebit-theme.js [--check] [--sheet <out.png>] [--write]      (SCALE=4 sets the sheet scale)
//
// Art is built on char grids: 'k' ink, 'p' paper, '.' clear. Inspired by woodcut/copperplate engravings:
// creatures have sculpted fins, bold 1-texel outlines in the opposite tone and clear interior markings
// (light from the upper left). Water volume and diagonal sunbeams are built from undulating horizontal
// engraving strokes with pitch >= 4 texels so no 24x24 px window ever contains a period-<=2 pattern.
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
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
T.INK_RGB = hex(T.INK);
T.PAPER_RGB = hex(T.PAPER);
const rgba = ch => ch === 'k' ? T.INK_RGB : ch === 'p' ? T.PAPER_RGB : null;

function render(g) {
    const H = H_(g), W = W_(g), px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = rgba(g[y][x]);
        if (!c) {
            if (g[y][x] !== '.') throw new Error('bad cell "' + g[y][x] + '"');
            continue;
        }
        const o = (y * W + x) * 4;
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
    return { W, H, px };
}

const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

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

function dropOrphans(g, chars) {
    for (let y = 0; y < H_(g); y++) for (let x = 0; x < W_(g); x++) {
        if (chars.includes(g[y][x]) && !N4.some(([dx, dy]) => get(g, x + dx, y + dy) !== '.')) g[y][x] = '.';
    }
}

// ── fish ─────────────────────────────────────────────────────
// Sculpted silhouettes with dorsal fin crest, ventral fin, plump snout (nose right) and forked tail.
// Frames: 0 neutral, 1 tail up, 2 wide/pectoral beat, 3 tail down.
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
        ],
        stripe: [[5, 1, 7], [7, 1, 7], [9, 2, 6]],
        spot: [[5, 2], [5, 6], [7, 4], [8, 2], [8, 6], [6, 4]],
        gill: [[9, 2], [8, 3], [8, 4], [8, 5], [9, 6], [6, 1], [7, 1], [6, 5]],
        check: [4, 8, 1, 7]
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
        ],
        stripe: [[4, 1, 5], [6, 1, 5]],
        spot: [[4, 2], [4, 4], [6, 3], [7, 5], [5, 1]],
        gill: [[7, 2], [6, 3], [6, 4], [7, 5], [5, 1]],
        check: [4, 7, 1, 5]
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
        ],
        stripe: [[3, 1, 4], [5, 1, 4]],
        spot: [[3, 2], [5, 1], [5, 4], [4, 3]],
        gill: [[5, 2], [4, 3], [5, 4]],
        check: [3, 5, 1, 4]
    },
    baby: {
        tl: 2, shift: 1, eye: [5, 1],
        rows: [
            'p..ppp.',
            'ppppppp',
            '.pppppp',
            'ppppppp',
            'p..pp..'
        ],
        stripe: [[3, 1, 3]],
        spot: [[3, 1], [4, 3]],
        gill: [[4, 2], [4, 3]],
        check: [2, 4, 1, 3]
    },
    mote: {
        tl: 1, shift: 1, eye: [3, 1],
        rows: [
            'p.pp',
            '.ppp',
            'p.pp'
        ],
        stripe: [[2, 0, 2]],
        spot: [[2, 1]],
        gill: [[2, 1]],
        check: [1, 2, 0, 2]
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

function fishSprite(ci, variant, frame, inverted) {
    const name = T.FISH_CLASSES[ci].name, a = FISH_ART[name], tl = a.tl;
    const g = fishBase(name, frame), W = W_(g), H = H_(g);
    const body = (x, y) => get(g, x, y) === 'p' && x >= tl;
    const eye = a.eye;
    const nearEye = (x, y) => eye && Math.abs(x - eye[0]) <= 1 && Math.abs(y - eye[1]) <= 1;

    if (variant === 'hollow') {
        // Woodcut contour fish: paper outer rim, ink inner contour ring, paper core + eye
        const rim = g.map((r, y) => r.map((c, x) => c === 'p' && N4.some(([dx, dy]) => get(g, x + dx, y + dy) !== 'p')));
        const ring = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (g[y][x] === 'p' && !rim[y][x] && x >= tl - 1 && N4.some(([dx, dy]) => get(rim, x + dx, y + dy) === true)) {
                ring.push([x, y]);
            }
        }
        for (const [x, y] of ring) g[y][x] = 'k';
        if (eye) put(g, eye[0], eye[1], 'k');
    } else {
        if (variant === 'stripe') {
            for (const [c, r0, r1] of a.stripe) for (let y = r0; y <= r1; y++) if (body(c, y) && !nearEye(c, y)) put(g, c, y, 'k');
        } else if (variant === 'spot') {
            for (const [x, y] of a.spot) if (body(x, y) && !nearEye(x, y)) put(g, x, y, 'k');
        } else if (variant === 'solid') {
            for (const [x, y] of a.gill) if (body(x, y) && !nearEye(x, y)) put(g, x, y, 'k');
            if (frame === 2 && H >= 7) put(g, tl + 2, Math.floor(H / 2) + 1, 'k'); // pectoral flutter mark
        } else if (variant === 'check') {
            const [x0, x1, y0, y1] = a.check;
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                if ((x + y) % 2 === 0 && body(x, y) && !nearEye(x, y)) put(g, x, y, 'k');
            }
        }
        if (eye) put(g, eye[0], eye[1], 'k');
    }

    const out = pad(g, 1, 1, 1, 1);
    const sil = out.map(r => r.map(c => c !== '.'));
    outline(out, 'k');
    if (!inverted) return out;

    // Stress state: swap ink and paper so the fish becomes a dark ink silhouette with a bright paper
    // outline and paper markings; hollow keeps a 2-texel paper contour so all 5 variants stay distinct.
    const sw = swap(out);
    for (let y = 0; y < H_(out); y++) for (let x = 0; x < W_(out); x++) {
        if (sil[y][x] && x - 1 >= tl && N4.some(([dx, dy]) => get(sil, x + dx, y + dy) === false && !(x + dx < 0 || y + dy < 0 || x + dx >= W_(out) || y + dy >= H_(out)))) {
            sw[y][x] = 'p';
        }
    }
    return sw;
}

// ── orca ─────────────────────────────────────────────────────
// Killer whale after the owner's reference, hand-drawn on char grids (nose to the right, the sim flips it):
// a straight, streamlined ink body (length about 3.5x its depth) with a blunt melon head, a tall back-swept
// dorsal fin on the middle of the back, a slim tail stock that stays on the body axis and ends in small swept
// flukes, a broad paddle flipper hanging down-back between white throat and white belly, a slanted eye patch,
// a saddle behind the fin and the belly patch hooking up toward the flank. The ink is invisible on the ink water,
// so orcaFromArt() frames it in a 1-texel paper outline plus a rim light on the back in front of the fin (light
// from above, `rim` = [min x, min y] in the padded sprite). Frames: 0 neutral, 1 flukes tilted up, 2 neutral,
// 3 flukes tilted down (`flukes` overrides; the small variant shifts its fluke columns via `beat`).
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
            'k..............kkkkkkkkkkkkkkkkkkkk...',
            'kk..........kkkkppkkkkkkkkppppkkkkkk..',
            '.kkk.....kkkkpppppkkkkkkkkkkpppkkkkkk.',
            '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
            '...kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
            '..kkkkkkkkkkpppppkkkkkkkkkkkkkkkkkkkkk',
            '.kk......kkkkkpppppppkkkkkkkkkkkkkkkkk',
            '...............ppppppppppppkkkppkkkkk.',
            '..................ppppppppkkkkpppkk...',
            '.....................ppppkkkkkpp......',
            '........................kkkkkk........',
            '.......................kkkkkk.........',
            '.......................kkkkk..........',
            '........................kkk...........'
        ],
        // columns that beat with the tail: [x0, x1, row shift per frame]
        beat: [],
        // flukes (columns 0..4) per frame, [first row, rows]: neutral, tilted up, neutral, tilted down
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
    return orcaFromArt(small ? ORCA_ART.small : ORCA_ART.full, frame);
}

function orcaFromArt(A, frame) {
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
    const out = pad(g, 1, 1, 1, 1);
    outline(out, 'p');
    {
        const add = [];
        for (let y = 0; y < H_(out) - 1; y++) for (let x = 0; x < W_(out); x++) if (out[y][x] === '.' && out[y + 1][x] !== '.' && (!A.rim || (y >= A.rim[1] && x >= A.rim[0]))) add.push([x, y]);
        pts(out, 'p', add);
    }
    return out;
}

// ── angler ───────────────────────────────────────────────────
// Deep-sea anglerfish: dark INK body with a bold PAPER outline, dorsal fin rays, bioluminescent lateral
// speckles, huge tooth-lined jaw cavity, glaring eye ring, and an arching illicium stalk to T.LURE.
function anglerSprite(frame, small) {
    const W = small ? 11 : 17, H = small ? 10 : 15;
    const g = mk(W, H);
    const dir = [0, -1, 0, 1][frame & 3];

    if (!small) {
        // Sculpted deep-bodied angler profile (cols 3..16, rows 4..13)
        const aTop = [8, 7, 6, 5, 4, 4, 4, 4, 4, 5, 5, 6, 6, 7]; // x = 3..16
        const aBot = [10, 11, 12, 13, 13, 14, 14, 14, 14, 13, 13, 13, 12, 11];
        for (let i = 0; i < aTop.length; i++) {
            const x = 3 + i;
            for (let y = aTop[i]; y <= aBot[i]; y++) put(g, x, y, 'k');
        }
        // Spiny dorsal crest (rows 2..3) & ventral fin (row 14)
        pts(g, 'k', [[6, 3], [7, 2], [7, 3], [8, 3], [9, 3], [7, 14], [8, 14]]);
        // Webbed tail fan (cols 0..2), sheared by frame
        const tCols = [[0, [6, 7, 8, 10, 11, 12]], [1, [7, 8, 9, 10, 11]], [2, [8, 9, 10]]];
        for (const [x, rows] of tCols) {
            const sh = x < 2 ? dir : 0;
            for (const y of rows) put(g, x, Math.max(2, Math.min(H - 1, y + sh)), 'k');
        }
        // Cavernous mouth cut into the front (cols 11..16, rows 9..11) with alternating sharp paper teeth
        for (let x = 11; x <= 16; x++) {
            put(g, x, 9, (x % 2 === 1) ? 'p' : 'k');
            put(g, x, 10, 'k');
            put(g, x, 11, (x % 2 === 0) ? 'p' : 'k');
        }
        // Glaring 3x3 eye with ink pupil (cols 10..12, rows 5..7)
        for (let y = 5; y <= 7; y++) for (let x = 10; x <= 12; x++) put(g, x, y, 'p');
        put(g, 11, 6, 'k');
        // Woodcut gill rib, pectoral fin & lateral speckles
        pts(g, 'p', [[8, 8], [7, 9], [8, 10], [5, 7], [6, 11], [9, 12]]);
    } else {
        // Small angler (11x10 interior -> 13x12 with outline)
        const sTop = [5, 4, 3, 3, 3, 3, 3, 4, 4]; // x = 2..10
        const sBot = [6, 7, 8, 8, 9, 9, 9, 8, 7];
        for (let i = 0; i < sTop.length; i++) {
            for (let y = sTop[i]; y <= sBot[i]; y++) put(g, 2 + i, y, 'k');
        }
        pts(g, 'k', [[0, 4 + dir], [0, 5 + dir], [0, 7 + dir], [1, 5], [1, 6]]);
        for (let x = 7; x <= 10; x++) {
            put(g, x, 6, (x % 2 === 1) ? 'p' : 'k');
            put(g, x, 7, (x % 2 === 0) ? 'p' : 'k');
        }
        pts(g, 'p', [[6, 4], [7, 4], [6, 5], [4, 6]]);
    }

    const out = pad(g, 1, 1, 1, 1);
    outline(out, 'p');

    // Arching illicium stalk from brow up and forward to the lure bulb anchor
    const lp = T.LURE[small ? 1 : 0][frame & 3];
    const sx = small ? 8 : 11, sy = small ? 3 : 4;
    const mx = Math.round((sx + lp.x) / 2), my = Math.max(0, Math.min(sy, lp.y) - 1);
    line(out, sx, sy, mx, my, 'p');
    line(out, mx, my, lp.x, lp.y, 'p');
    return out;
}

// ── jelly ────────────────────────────────────────────────────
// Woodcut medusa: domed PAPER bell with vertical INK umbrella canals, upper-left dome highlight,
// scalloped frill margin, and 3-5 graceful 4-connected tentacles that wave with phase lag.
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

function jellyDims(ci) {
    const a = JELLY_ART[T.JELLY[ci].name];
    return { cols: a.cols, rows: a.rows };
}

function jellySprite(ci, frame) {
    const a = JELLY_ART[T.JELLY[ci].name], W = a.cols, H = a.rows;
    const cx = Math.floor((W - 1) / 2);
    const bell = a.bell[[0, 1, 2, 1][frame & 3]], hb = bell.length;
    const g = mk(W, H);

    // Solid paper bell dome with scalloped bottom fringe
    for (let r = 0; r < hb; r++) {
        const hw = bell[r];
        for (let dx = -hw; dx <= hw; dx++) {
            const x = cx + dx;
            if (x <= 0 || x >= W - 1) continue;
            if (r === hb - 1 && Math.abs(dx) % 2 === 1) continue;
            put(g, x, 1 + r, 'p');
        }
    }
    // Interior ink radial canals and sub-marginal frill band (leaving upper-left crown lit)
    for (let r = 2; r < hb - 1; r++) {
        const hw = bell[r];
        if (r === hb - 2) {
            for (let dx = -hw + 1; dx <= hw - 1; dx++) if (dx % 2 === 0) put(g, cx + dx, 1 + r, 'k');
        } else if (W >= 12) {
            for (const rib of [-2, 2]) if (Math.abs(rib) < hw - 1) put(g, cx + rib, 1 + r, 'k');
        }
    }
    outline(g, 'k');

    // Graceful 4-connected tentacles with ink shadow where space permits
    a.tent.forEach(([off, len], ti) => {
        let px = Math.max(1, Math.min(W - 2, cx + off));
        for (let k = 0; k < len; k++) {
            const y = 1 + hb + k;
            if (y >= H - 1) break;
            const wob = Math.round(0.85 * Math.sin(k * 0.45 + frame * 1.5708 + ti * 1.1) * (k > 1 ? 1 : 0));
            const x = Math.max(1, Math.min(W - 2, cx + off + wob));
            if (x !== px) put(g, px, y, 'p');
            put(g, x, y, 'p');
            px = x;
        }
    });
    return g;
}

// ── worm ─────────────────────────────────────────────────────
// Segmented wriggling worm (4x9 texels) that shortens and dissolves across 3 life stages.
function wormSprite(stage, frame) {
    const g = mk(T.WORM.cols, T.WORM.rows), len = [9, 6, 4][stage];
    for (let y = 0; y < len; y++) {
        const x = 1 + Math.round(0.75 * Math.sin(y * 0.75 + frame * Math.PI / 2));
        put(g, x, y, 'p');
        put(g, x + 1, y, (y % 2 === 1 && y < len - 1) ? 'k' : 'p');
    }
    if (stage === 1) put(g, 2, 8, 'p'); // detached dissolving tail speck
    return g;
}

// ── bubbles, sparkle, lure ───────────────────────────────────
function bubbleSprite(big) {
    const g = big ? mk(4, 4) : mk(2, 2);
    if (big) {
        pts(g, 'p', [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3], [1, 1]]);
        pts(g, 'k', [[2, 1], [1, 2], [2, 2]]);
    } else {
        pts(g, 'p', [[0, 0], [1, 0], [0, 1], [1, 1]]);
    }
    return g;
}

function sparkleSprite(frame) {
    const g = mk(T.SPARKLE_SIZE, T.SPARKLE_SIZE);
    pts(g, 'p', [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]]);
    if (frame === 1) pts(g, 'p', [[2, 0], [0, 2], [4, 2], [2, 4]]);
    outline(g, 'k');
    return g;
}

// Bioluminescent angler lantern (9x9): 0 = dim bulb, 1 = lit lantern, 2 = star flare with halo ticks
function lureSprite(level) {
    const g = mk(T.LURE_SIZE, T.LURE_SIZE), c = Math.floor(T.LURE_SIZE / 2);
    if (level === 0) {
        pts(g, 'p', [[c, c - 1], [c - 1, c], [c, c], [c + 1, c], [c, c + 1]]);
        outline(g, 'k');
    } else if (level === 1) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(g, c + dx, c + dy, 'p');
        pts(g, 'p', [[c, c - 2], [c, c + 2], [c - 2, c], [c + 2, c]]);
        put(g, c, c, 'k');
        outline(g, 'k');
    } else {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(g, c + dx, c + dy, 'p');
        pts(g, 'p', [[c, c - 2], [c, c - 3], [c, c + 2], [c, c + 3], [c - 2, c], [c - 3, c], [c + 2, c], [c + 3, c]]);
        put(g, c, c, 'k');
        outline(g, 'k');
        // Outer lantern rays at the 4 corners (spaced 8 texels apart so they never form fine noise)
        pts(g, 'p', [[1, 1], [7, 1], [1, 7], [7, 7]]);
    }
    return g;
}

// ── backdrop ─────────────────────────────────────────────────
// Dotted water (see theme.js WATER). Every layer is a set of dots on a fixed lattice or fixed contour
// candidates; layer n is the union of dots that show at daylight scale n, so each dot appears once and
// never moves. Tone is carried by dot SIZE (single texel, plus of 5, solid 3x3) only.
const clamp01 = v => Math.max(0, Math.min(1, v));
// beam envelope 0..1 at (x, y); x wraps around the tile width
function waterBeam(x, y) {
    const Wt = T.WATER;
    let best = 0;
    for (const [c, wf] of Wt.beams) {
        const hw = (Wt.beamHalf + Wt.beamGrow * y) * wf;
        let dx = ((x - (c + 0.48 * y)) % Wt.cols + Wt.cols) % Wt.cols;
        if (dx > Wt.cols / 2) dx -= Wt.cols;
        const u = Math.abs(dx) / hw;
        if (u < 1) best = Math.max(best, 1 - u * u);
    }
    return best;
}
// depth fade: 1 at the surface band, 0 from fadeBot * rows down (the lower third is empty)
function waterDepth(y) {
    const Wt = T.WATER;
    return clamp01((Wt.fadeBot * Wt.rows - y) / ((Wt.fadeBot - Wt.fadeTop) * Wt.rows));
}
// tone scale of daylight layer n
function waterScale(n) {
    const Wt = T.WATER;
    return Wt.scale0 + (1 - Wt.scale0) * n / (Wt.layers - 1);
}
// dot of size lvl centred on (x, y); x wraps (tile), y is clipped
function stampDot(g, x, y, lvl) {
    if (lvl <= 0) return;
    const cells = lvl === 1 ? [[0, 0]]
        : lvl === 2 ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    for (const [dx, dy] of cells) {
        const yy = y + dy;
        if (yy < 0 || yy >= H_(g)) continue;
        g[yy][(((x + dx) % W_(g)) + W_(g)) % W_(g)] = 'p';
    }
}

// Ben-Day halftone: dots on the 45-degree lattice (x, y multiples of pitch, (x/pitch + y/pitch) even)
function halftoneLayers() {
    const Wt = T.WATER, Hf = Wt.halftone, P = Hf.pitch;
    const layers = Array.from({ length: Wt.layers }, () => mk(Wt.cols, Wt.rows));
    const levelOf = t => t < Hf.levels[0] ? 0 : t < Hf.levels[1] ? 1 : t < Hf.levels[2] ? 2 : 3;
    for (let y = 0; y < Wt.rows; y += P) for (let x = 0; x < Wt.cols; x += P) {
        if (((x / P) + (y / P)) % 2 !== 0) continue;
        const df = waterDepth(y);
        if (df <= 0) continue;
        // low-frequency swell (periods divide the tile width, so it is seamless)
        const sw = 1 + Hf.swell * (0.6 * Math.sin(2 * Math.PI * x / 216 + 0.7) + 0.4 * Math.sin(2 * Math.PI * y / 97 + 1.3));
        const tone = (Hf.surfaceTone + Hf.beamBoost * waterBeam(x, y)) * df * sw;
        for (let n = 0; n < Wt.layers; n++) stampDot(layers[n], x, y, levelOf(tone * waterScale(n)));
    }
    return layers;
}

// Topographic swell contours: single-texel dots, at least 4 texels apart along the lines; a second set of
// diagonal contours appears inside the sunbeams. Candidates are picked greedily by intensity (fixed order).
function contourLayers() {
    const Wt = T.WATER, C = Wt.contours;
    const layers = Array.from({ length: Wt.layers }, () => mk(Wt.cols, Wt.rows));
    const G = (x, y) => 0.35 * Math.sin(2 * Math.PI * x / 216 + 0.4) + 0.30 * Math.sin(2 * Math.PI * y / 170 + 1.1)
        + 0.20 * Math.sin(2 * Math.PI * x / 324 + 2 * Math.PI * y / 290 + 0.3);
    const H = (x, y) => 0.5 * Math.cos(2 * Math.PI * (x - 0.5 * y) / C.beamPeriod);
    const cand = [];
    for (let y = 0; y < Wt.rows - 1; y++) for (let x = 0; x < Wt.cols; x++) {
        const df = waterDepth(y);
        if (df <= 0) continue;
        const k = Math.floor(G(x, y) / C.step);
        const xr = (x + 1) % Wt.cols;
        if (Math.floor(G(xr, y) / C.step) !== k || Math.floor(G(x, y + 1) / C.step) !== k) cand.push({ x, y, I: df });
        const bs = waterBeam(x, y);
        if (bs > 0.25) {
            const kb = Math.floor(H(x, y) / C.step);
            if (Math.floor(H(xr, y) / C.step) !== kb || Math.floor(H(x, y + 1) / C.step) !== kb) cand.push({ x, y, I: df * (0.6 + 0.4 * bs) });
        }
    }
    cand.sort((a, b) => (b.I - a.I) || (a.y - b.y) || (a.x - b.x));
    const kept = [];
    for (const c of cand) {
        let ok = true;
        for (const k of kept) {
            let dx = Math.abs(c.x - k.x); dx = Math.min(dx, Wt.cols - dx);
            const dy = c.y - k.y;
            if (dx * dx + dy * dy < C.gap * C.gap) { ok = false; break; }
        }
        if (ok) kept.push(c);
    }
    for (const c of kept) {
        for (let n = 0; n < Wt.layers; n++) if (c.I * waterScale(n) >= C.theta) layers[n][c.y][c.x] = 'p';
    }
    return layers;
}

function waterLayers() {
    if (T.BACKGROUND_STYLE === 'none') return Array.from({ length: T.WATER.layers }, () => mk(T.WATER.cols, T.WATER.rows));
    return T.BACKGROUND_STYLE === 'contours' ? contourLayers() : halftoneLayers();
}

// Double-crested woodcut surface wave strip (128x8, tiles horizontally)
function surfaceTile() {
    const S = T.SURFACE, W = S.cols, H = S.rows, g = mk(W, H);
    const waveY = x => 2 + Math.round(1.1 * Math.sin(2 * Math.PI * x / 32 + 0.3) + 0.5 * Math.cos(2 * Math.PI * x / 64));
    for (let x = 0; x < W; x++) {
        const y = waveY(x);
        put(g, x, y, 'p');
        if (x % 4 !== 0) put(g, x, y + 1, 'p'); // bold 2-texel wave crest with woodcut breaks
        if (x > 0 && waveY(x - 1) !== y) put(g, x, waveY(x - 1), 'p');
    }
    // Secondary braided swell dashes 4 rows below the main crest (pitch >= 4 texels)
    for (const [x0, len] of [[4, 14], [26, 11], [48, 16], [74, 12], [96, 15], [116, 9]]) {
        for (let i = 0; i < len; i++) {
            const xx = (x0 + i) % W;
            put(g, xx, Math.min(H - 1, waveY(xx) + 4), 'p');
        }
    }
    return g;
}

// Layered woodcut seabed (640x32):
// - Rolling far hills (`farTop`) with contour hatching
// - Sculpted reef boulders, brain corals, branching fan corals and starfish
// - Near foreground dune crest (`T.seabedTop`) with wide-pitched woodcut sediment contours
function seabedTile() {
    const W = T.SEABED.cols, H = T.SEABED.rows, g = mk(W, H), rnd = rng(109);
    const nearTop = x => T.seabedTop(x);
    const farTop = x => {
        const a = 6.2831853 * ((x % W) + W) / W;
        return Math.min(nearTop(x) - 5, Math.round(11 + 2.2 * Math.sin(2 * a + 1.1) + 1.5 * Math.sin(5 * a + 0.4) + 0.9 * Math.cos(9 * a + 2.3)));
    };
    const putW = (x, y, ch) => put(g, ((x % W) + W) % W, y, ch);

    // 1. Fill far hills and near dunes with ink, plus crisp paper ridge crests
    for (let x = 0; x < W; x++) {
        const ft = farTop(x), nt = nearTop(x);
        for (let y = ft; y < H; y++) g[y][x] = 'k';
        put(g, x, ft, 'p');
        if (x % 7 !== 0) put(g, x, nt, 'p');
        put(g, x, nt + 1, 'p');
    }

    // 2. Far-hill woodcut contour hatching (strictly 4 rows below farTop and >= 3 rows above nearTop)
    let fx = 6;
    while (fx < W) {
        const d = 7 + Math.floor(rnd() * 10), gap = 8 + Math.floor(rnd() * 10);
        for (let i = 0; i < d; i++) {
            const xx = (fx + i) % W, yy = farTop(xx) + 4;
            if (yy <= nearTop(xx) - 3) put(g, xx, yy, 'p');
        }
        fx += d + gap;
    }

    // 3. Reef boulders sitting on the ridges (ink mass, paper upper-left rim & contour arc)
    const rocks = [
        [44, 9, 5, true], [56, 5, 3, true], [148, 10, 6, false], [162, 6, 4, false],
        [248, 11, 6, true], [338, 8, 5, false], [418, 10, 5, true], [432, 5, 3, true],
        [522, 9, 5, false], [596, 8, 5, true]
    ];
    const rockCells = new Set(), key = (x, y) => (((x % W) + W) % W) + ',' + y;
    for (const [cx, rx, ry, onNear] of rocks) {
        const cy = (onNear ? nearTop(cx) : farTop(cx)) + 2;
        for (let y = cy - ry - 1; y <= cy + 2; y++) {
            for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
                if (inEll(x, y, cx, cy, rx + 0.3, ry + 0.3)) {
                    rockCells.add(key(x, y));
                    putW(x, y, 'k');
                }
            }
        }
    }
    for (const c of rockCells) {
        const [x, y] = c.split(',').map(Number);
        for (const [dx, dy] of N4) {
            if (!rockCells.has(key(x + dx, y + dy)) && dy <= 0) putW(x + dx, y + dy, 'p');
        }
    }
    for (const [cx, rx, ry, onNear] of rocks) {
        if (rx >= 8) {
            const cy = (onNear ? nearTop(cx) : farTop(cx)) + 2;
            for (let dx = -Math.floor(rx * 0.5); dx <= Math.floor(rx * 0.2); dx++) {
                putW(cx + dx, cy - Math.floor(ry * 0.45), 'p');
            }
        }
    }

    // 4. Branching staghorn corals & sea anemones along the reef crest (2-texel thick paper branches)
    const corals = [96, 206, 304, 468, 558];
    for (const cx of corals) {
        const by = farTop(cx);
        for (let h = 1; h <= 7; h++) {
            putW(cx, by - h, 'p'); putW(cx + 1, by - h, 'p');
            if (h >= 3 && h <= 6) {
                putW(cx - h + 1, by - h, 'p'); putW(cx - h + 2, by - h, 'p');
                putW(cx + h, by - h, 'p'); putW(cx + h - 1, by - h, 'p');
            }
        }
    }

    // 5. Near-dune woodcut sediment contour dashes (depths +5 and +9 below nearTop -> pitch >= 4 texels)
    const dash = (depth, cover, minL, maxL) => {
        let x = Math.floor(rnd() * 18);
        while (x < W) {
            const d = Math.round(minL + rnd() * (maxL - minL));
            const gap = Math.max(7, Math.round(d * (1 - cover) / cover * (0.7 + 0.6 * rnd())));
            for (let i = 0; i < d; i++) {
                const xx = (x + i) % W, y = nearTop(xx) + depth;
                if (y < H - 1 && !rockCells.has(xx + ',' + y)) g[y][xx] = 'p';
            }
            x += d + gap;
        }
    };
    dash(5, 0.55, 8, 20);
    dash(9, 0.38, 6, 15);

    // 6. Starfish & shells resting on the foreground sand
    for (const sx of [122, 378, 618]) {
        const sy = Math.min(H - 3, nearTop(sx) + 5);
        pts(g, 'p', [[sx, sy], [sx - 1, sy], [sx + 1, sy], [sx, sy - 1], [sx, sy + 1], [sx - 2, sy + 1], [sx + 2, sy + 1]]);
    }
    return g;
}

// Botanical giant kelp: sinuous 2-texel stipe, gas bladders, and curving leaf blades outlined in ink
// so overlapping plants and passing creatures always read with crisp woodcut separation.
function kelpSprite(ci, frame) {
    const K = T.KELP[ci], h = K.rows, W = K.cols, g = mk(W, h);
    const bx = Math.floor(W / 2) - 1;
    const ph = frame * Math.PI / 2, A = 1.1 + ci * 0.45;
    const sway = y => Math.round(Math.sin((h - y) * 0.11 + ph) * A * Math.pow((h - y) / h, 1.35) * 1.5);
    const thick = y => (h - y) > h * 0.35 ? 2 : 2;

    // Main stipe (4-connected)
    for (let y = 2; y < h; y++) {
        const x = bx + sway(y), t = thick(y);
        for (let i = 0; i < t; i++) put(g, x + i, y, 'p');
        if (y > 2) {
            const xp = bx + sway(y - 1);
            if (xp !== x) for (let i = 0; i < t; i++) put(g, xp + i, y, 'p');
        }
    }

    // Curving botanical fronds every 9 rows, alternating left/right, 2-3 texels thick
    let side = (ci % 2 === 0) ? 1 : -1;
    for (let y = h - 8; y >= 9; y -= 9) {
        const x = bx + sway(y);
        const len = Math.max(5, Math.min(8, Math.round(5 + 3.5 * Math.sin(Math.PI * (h - y) / h))));
        for (let i = 0; i < len; i++) {
            const dx = side > 0 ? 2 + i : -1 - i;
            const arch = Math.round(-i * 0.55 + (i >= len - 2 ? 0.6 : 0));
            const th = i === 0 ? 2 : (i < len - 2 ? 3 : 2);
            for (let t = 0; t < th; t++) put(g, x + dx, y + arch - t, 'p');
        }
        side = -side;
    }

    // Crown blade at the tip
    const tx = bx + sway(2);
    pts(g, 'p', [[tx, 1], [tx + 1, 1], [tx - 1, 2], [tx + 2, 2], [tx, 3], [tx + 1, 3]]);
    outline(g, 'k');
    return g;
}

// ── all images ───────────────────────────────────────────────
function allImages() {
    const imgs = {};
    const add = (name, g, cols, rows) => {
        if (cols !== undefined && (W_(g) !== cols || H_(g) !== rows)) {
            (process.env.DIMS ? console.log : (m => { throw new Error(m); }))(name + ' is ' + W_(g) + 'x' + H_(g) + ', theme.js says ' + cols + 'x' + rows);
        }
        imgs[name] = render(g);
    };
    T.FISH_CLASSES.forEach((c, ci) => {
        for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++) for (const inv of [false, true]) {
            add(T.fishFile(ci, v, f, inv), fishSprite(ci, v, f, inv), c.cols, c.rows);
        }
    });
    for (let f = 0; f < 4; f++) {
        T.ORCA.forEach((o, i) => add(T.orcaFile(i, f), orcaSprite(f, i === 1), o.cols, o.rows));
        T.ANGLER.forEach((o, i) => add(T.anglerFile(i, f), anglerSprite(f, i === 1), o.cols, o.rows));
        T.JELLY.forEach((c, ci) => { const d = jellyDims(ci); add(T.jellyFile(ci, f), jellySprite(ci, f), c.cols, c.rows); });
        for (let s = 0; s < 3; s++) add('worm-' + s + '-' + f + '.png', wormSprite(s, f), T.WORM.cols, T.WORM.rows);
        for (let k = 0; k < T.KELP.length; k++) add('kelp-' + k + '-' + f + '.png', kelpSprite(k, f), T.KELP[k].cols, T.KELP[k].rows);
    }
    add('bubble-s.png', bubbleSprite(false), T.BUBBLE[0].cols, T.BUBBLE[0].rows);
    add('bubble-b.png', bubbleSprite(true), T.BUBBLE[1].cols, T.BUBBLE[1].rows);
    for (let f = 0; f < 2; f++) add('sparkle-' + f + '.png', sparkleSprite(f), T.SPARKLE_SIZE, T.SPARKLE_SIZE);
    for (let l = 0; l < 3; l++) add('lure-' + l + '.png', lureSprite(l), T.LURE_SIZE, T.LURE_SIZE);

    const wl = waterLayers();
    wl.forEach((g, l) => {
        const u = mk(T.WATER.cols, T.WATER.rows);
        for (let k = 0; k <= l; k++) {
            for (let y = 0; y < T.WATER.rows; y++) for (let x = 0; x < T.WATER.cols; x++) {
                if (wl[k][y][x] === 'p') u[y][x] = 'p';
            }
        }
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
    rows.push(['seabed.png', 'surface.png']);
    if (process.env.ONLY) {
        const re = new RegExp(process.env.ONLY);
        rows = rows.map(r => r.filter(n => re.test(n))).filter(r => r.length);
    }
    const dims = rows.map(r => ({
        w: r.reduce((a, n) => a + imgs[n].W * S + PAD * S, PAD * S),
        h: Math.max(...r.map(n => imgs[n].H * S)) + 2 * PAD * S
    }));
    const SW = Math.max(...dims.map(d => d.w)), SH = dims.reduce((a, d) => a + d.h, 0);
    const px = Buffer.alloc(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) {
        px[i * 4] = T.INK_RGB[0]; px[i * 4 + 1] = T.INK_RGB[1]; px[i * 4 + 2] = T.INK_RGB[2]; px[i * 4 + 3] = 255;
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
