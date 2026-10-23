// Generates the "pixel" theme's textures (contents/themes/pixel/img/*.png) and, optionally,
// the 8x contact sheet. The art is authored here: hand-placed silhouettes (profiles, polygons, ASCII
// patches), shaded by hand with 3-4 tones per colour (light from the top-left) + selective outlines,
// rasterised onto cell grids; the dimensions, frame counts and anchors come from
// contents/themes/pixel/theme.js.
//   node tools/gen-pixel-theme.js [--check] [--sheet <out.png>] [--scenery <out.png>] [--write]
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('../tests/png');
const { loadScript } = require('../tests/harness');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'contents', 'themes', 'pixel', 'img');
const T = loadScript(path.join(ROOT, 'contents', 'themes', 'pixel', 'theme.js'));

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const clone = g => g.map(r => r.slice());
function put(g, x, y, ch) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; }
function get(g, x, y) { return (y >= 0 && y < g.length && x >= 0 && x < g[0].length) ? g[y][x] : '.'; }
function ascii(g, rows, ox, oy) {            // '.' = leave, '~' = erase
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, (ox || 0) + i, (oy || 0) + j, ch === '~' ? '.' : ch); }));
}
function pts(g, ch, list) { for (const [x, y] of list) put(g, x, y, ch); }
function fillProfile(g, x0, tops, bottoms, ch) {
    tops.forEach((t, i) => { for (let y = t; y <= bottoms[i]; y++) put(g, x0 + i, y, ch); });
}
// Outline: transparent cells 4-adjacent to a solid cell become 'o'; outlines on the lit top
// edge (solid cell below, none above) use the softer 'q' so the form does not look boxed in.
function outline(g, solidFn) {
    const H = g.length, W = g[0].length, add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (g[y][x] !== '.') continue;
        const n = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => get(g, x + dx, y + dy));
        if (n.some(c => c !== '.' && solidFn(c))) {
            const below = n[0];
            add.push([x, y, (below !== '.' && solidFn(below) && n[1] === '.') ? 'q' : 'o']);
        }
    }
    for (const [x, y, c] of add) g[y][x] = c;
}
const hex = (c, a) => { const v = [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)); v.push(a === undefined ? 255 : Math.round(a * 255)); return v; };
function render(g, pal) {
    const H = g.length, W = g[0].length, px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = g[y][x];
        if (ch === '.') continue;
        const c = pal[ch];
        if (!c) throw new Error('no colour for "' + ch + '" at ' + x + ',' + y);
        px[(y * W + x) * 4] = c[0]; px[(y * W + x) * 4 + 1] = c[1]; px[(y * W + x) * 4 + 2] = c[2]; px[(y * W + x) * 4 + 3] = c[3];
    }
    return { W, H, px };
}
// scanline fill of a polygon (cell centres), points in cell units
function poly(g, points, ch, ox, oy) {
    const H = g.length, W = g[0].length;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const px = x + 0.5 - (ox || 0), py = y + 0.5 - (oy || 0);
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i], [xj, yj] = points[j];
            if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) put(g, x, y, typeof ch === 'function' ? ch(x, y) : ch);
    }
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
// piecewise-linear interpolation through [[x, y], ...] (x ascending)
function interp(ps, x) {
    if (x <= ps[0][0]) return ps[0][1];
    for (let i = 1; i < ps.length; i++) if (x <= ps[i][0]) return lerp(ps[i - 1][1], ps[i][1], (x - ps[i - 1][0]) / (ps[i][0] - ps[i - 1][0]));
    return ps[ps.length - 1][1];
}
// smooth (Catmull-Rom) version of interp: round, flowing silhouettes
function curve(ps, x) {
    if (x <= ps[0][0]) return ps[0][1];
    if (x >= ps[ps.length - 1][0]) return ps[ps.length - 1][1];
    let i = 1; while (x > ps[i][0]) i++;
    const p0 = ps[Math.max(0, i - 2)], p1 = ps[i - 1], p2 = ps[i], p3 = ps[Math.min(ps.length - 1, i + 1)];
    const t = (x - p1[0]) / (p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
    const m1 = (p2[1] - p0[1]) / Math.max(1e-6, p2[0] - p0[0]) * (p2[0] - p1[0]);
    const m2 = (p3[1] - p1[1]) / Math.max(1e-6, p3[0] - p1[0]) * (p2[0] - p1[0]);
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// OKLCH mixing (keeps chroma, rotates hue the short way) for the stress "flush" ramps: a plain RGB
// blend of aqua and red goes muddy grey-purple, this goes aqua -> violet -> magenta -> red.
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const unlin = v => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
function toLch(c) {
    const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(c.substr(i, 2), 16)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function fromLch([L, C, H]) {
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return '#' + [r, g, b].map(v => unlin(v).toString(16).padStart(2, '0')).join('');
}
const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// `ref` = hue travel of the ramp's base tone; every tone follows the same way round the wheel
function lchMix(c1, c2, t, ref) {
    const a = toLch(c1), b = toLch(c2);
    let dh = wrap(b[2] - a[2]);
    if (ref !== undefined) dh += 2 * Math.PI * Math.round((ref - dh) / (2 * Math.PI));
    return fromLch([a[0] + (b[0] - a[0]) * t, Math.max(a[1], 0.02) + (b[1] - Math.max(a[1], 0.02)) * t, a[2] + dh * t]);
}


// ── FISH ─────────────────────────────────────────────────────
// Adult 16x12 (T.kinds.fish.arts[2]), faces right. l highlight, b base, d shadow, w belly, f fin, e/k eye,
// p pattern. Babies (11x8) and newborns (8x6) are the same fish drawn smaller, without markings.
const FISH_BODY = [
    '................',
    '......fff.......',
    '.....ffflbb.....',
    '.....lllbbbbb...',
    '....llbbbbbekb..',
    '....lbbbbbbkkbb.',
    '....wwbbffbbbbb.',
    '....wwwwwwwwwd..',
    '.....wwwwwwdd...',
    '......ddddd.....',
    '.......ff.......',
    '................'
];
// gill line
const FISH_GILL = [[10, 4], [10, 5], [10, 6]];
const TAIL = [          // cols 0..4 (neutral); lobes at rows 3..8, stalk rows 5-6
    'ff...',
    'fff..',
    '.fff.',
    '.fff.',
    'fff..',
    'ff...'
];
const BABY_BODY = [     // 11x8
    '...........',
    '.....ff....',
    '....fflbb..',
    '....lbbebk.',
    '....wbbbbb.',
    '....wwwwwd.',
    '.....ddd...',
    '...........'
];
const BABY_TAIL = [     // cols 0..3, stalk rows 1-2
    'ff..',
    '.fff',
    '.fff',
    'ff..'
];
const NEWBORN_BODY = [  // 8x6
    '........',
    '....f...',
    '...lbek.',
    '...wbbb.',
    '...wwd..',
    '........'
];
const NEWBORN_TAIL = [  // cols 0..2, stalk row 1
    'f..',
    '.ff',
    'f..'
];
const FISH_PAL = {
    coral:  { l: '#FFB8AA', b: '#FF7C7E', d: '#D9546E', w: '#FFD6CB', f: '#EC6074', o: '#582250', q: '#9B3F60', p: '#E2566F' },
    amber:  { l: '#FFDD8F', b: '#FFAC40', d: '#DB7230', w: '#FFEBBA', f: '#F28C36', o: '#5E2A2C', q: '#A24B2E', p: '#E4802F' },
    lemon:  { l: '#F7F6A0', b: '#DEDC52', d: '#A0B640', w: '#FBF9C8', f: '#BFCD46', o: '#3F5A32', q: '#6F8B3A', p: '#B4C444' },
    aqua:   { l: '#B0F4F8', b: '#52D0E8', d: '#2F92CA', w: '#D6F9FC', f: '#3DB3DC', o: '#173F7A', q: '#2B6BA8', p: '#2F9CD0' },
    orchid: { l: '#EDCDF8', b: '#C690E9', d: '#8A62CA', w: '#F4E3FB', f: '#A979DC', o: '#43297A', q: '#6B47A8', p: '#9A6DD8' },
    red:    { l: '#FF9F8D', b: '#EE3C39', d: '#B12135', w: '#FFB59D', f: '#D12B37', o: '#4A0F2A', q: '#8B1E33', p: '#C42433' },
    alarm:  { l: '#C9444F', b: '#8E1328', d: '#5B0B20', w: '#A62F3C', f: '#701124', o: '#2A0511', q: '#4A0A1B', p: '#6C0E22' }
};
// species markings, per variant: [char, [[x,y]...]] stamped on the body (p = pattern tone)
const FISH_MARK = {
    coral:  [['p', [[7, 3], [7, 4], [7, 5], [8, 6], [8, 2]]]],                           // one soft bar
    amber:  [['p', [[7, 4], [9, 5], [8, 3], [6, 5]]]],                                   // freckles
    lemon:  [['p', [[6, 5], [7, 5], [8, 5], [9, 5]]]],                                   // lateral line
    aqua:   [['l', [[6, 4], [7, 4], [8, 4], [9, 4]]], ['p', [[7, 7], [8, 7]]]],           // bright back stripe
    orchid: [['l', [[6, 5], [8, 4], [9, 6], [7, 6]]]],                                   // pale spots
    red:    [['p', [[7, 3], [7, 4], [7, 5], [8, 6], [8, 2]]]],
    alarm:  [['p', [[7, 3], [7, 4], [7, 5], [8, 6], [8, 2]]]]
};
// stress "flush" steps: <colour>-w<k> = the colour ramp mixed k/4 of the way to the red ramp
for (const c of ['coral', 'amber', 'lemon', 'aqua', 'orchid']) for (let k = 1; k <= 3; k++) {
    FISH_PAL[c + '-w' + k] = {}; FISH_MARK[c + '-w' + k] = FISH_MARK[c];
    { const ref = wrap(toLch(FISH_PAL.red.b)[2] - toLch(FISH_PAL[c].b)[2]); for (const t in FISH_PAL[c]) FISH_PAL[c + '-w' + k][t] = lchMix(FISH_PAL[c][t], FISH_PAL.red[t], k / 4, ref); }
}
function fishFrame(art, variant, frame) {
    const A = T.kinds.fish.arts[art], g = mk(A.cols, A.rows), dy = [0, -1, 0, 1][frame];
    if (art === 2) {
        ascii(g, FISH_BODY);
        pts(g, 'd', FISH_GILL);
        for (const [ch, list] of FISH_MARK[variant]) pts(g, ch, list.filter(([x, y]) => get(g, x, y) !== '.' && !'ekf'.includes(get(g, x, y))));
        ascii(g, TAIL, 0, 3 + dy);
        // pectoral fin flutters on the odd-beat frames
        if (frame === 2) { pts(g, 'b', [[8, 6]]); pts(g, 'f', [[8, 7]]); }
    } else if (art === 1) {
        ascii(g, BABY_BODY);
        ascii(g, BABY_TAIL, 0, 2 + dy);
    } else {
        ascii(g, NEWBORN_BODY);
        ascii(g, NEWBORN_TAIL, 0, 2 + dy);
    }
    outline(g, () => true);
    const p = FISH_PAL[variant], pal = { '.': null, e: hex('#FFFFFF'), k: hex('#15122A') };
    for (const k of 'lbdwfoqp') pal[k] = hex(p[k]);
    return render(g, pal);
}

// ── contact-sheet helper ─────────────────────────────────────
function sheet(imgs, file, rows, S) {
    S = S || 8; const PAD = 3, BG = [74, 84, 94];
    const dims = rows.map(r => ({ w: r.reduce((a, n) => a + imgs[n].W * S + PAD * S, PAD * S), h: Math.max(...r.map(n => imgs[n].H * S)) + 2 * PAD * S }));
    const SW = Math.max(...dims.map(d => d.w)), SH = dims.reduce((a, d) => a + d.h, 0);
    const px = Buffer.alloc(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) { px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255; }
    let oy = 0;
    rows.forEach((r, ri) => {
        let ox = PAD * S;
        for (const n of r) {
            const im = imgs[n];
            for (let y = 0; y < im.H * S; y++) for (let x = 0; x < im.W * S; x++) {
                const s = ((y / S | 0) * im.W + (x / S | 0)) * 4, a = im.px[s + 3] / 255;
                if (!a) continue;
                const d = ((oy + PAD * S + y) * SW + ox + x) * 4;
                for (let k = 0; k < 3; k++) px[d + k] = Math.round(im.px[s + k] * a + px[d + k] * (1 - a));
            }
            ox += im.W * S + PAD * S;
        }
        oy += dims[ri].h;
    });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png.encode(SW, SH, px));
}

// ── ORCA ─────────────────────────────────────────────────────
// Designed on a 60x34 grid (the default orca, three fish long) and rasterised at the art's scale (the small
// class is 0.6x). Natural orientation faces LEFT (the simulation's orca flag is inverted: it flips
// when moving right). Features: blunt head, tall swept dorsal fin, white eye patch, white belly and chin, grey
// saddle behind the fin, paddle flipper, level tail stock ending in notched flukes that sway with the beat.
const ORCA_PAL = {
    K: '#1D2A40', k: '#111B2E', s: '#3D5679', S: '#5878A2', W: '#F5F9FD', w: '#B1C2D9', g: '#6E829F', o: '#080F1E', q: '#2A4263',
    E: '#070B16', e: '#FFFFFF'
};
const ORCA_TOP = [[1, 19.4], [2, 17.4], [4, 15], [7, 13.2], [11, 12.2], [17, 11.8], [24, 11.9], [31, 12.8], [37, 14.4], [43, 16.2], [49, 17.2], [52, 17.6]];
const ORCA_BOT = [[1, 20.4], [2, 22.2], [4, 24.2], [8, 26], [13, 27], [19, 27.2], [25, 26.6], [31, 25.2], [37, 23.2], [43, 20.9], [49, 19.1], [52, 18.4]];
const ORCA_WHITE = [[1, 3.6], [6, 5.2], [14, 6.6], [24, 6.4], [32, 5.2], [40, 3.2], [46, 1.4], [49, 0]];   // belly depth below the bottom edge
function orcaFrame(art, frame) {
    const A = T.kinds.orca.arts[art], s = A.cols / 60, g = mk(A.cols, A.rows);
    const sc = ps => ps.map(([x, y]) => [x * s, y * s]);
    const dy = [0, -2.2, 0, 2.2][frame];
    // body
    const topAt = x => curve(ORCA_TOP, x) * s, botAt = x => curve(ORCA_BOT, x) * s;
    for (let x = 0; x < A.cols; x++) {
        const bx = (x + 0.5) / s; if (bx < 1 || bx > 53) continue;
        for (let y = 0; y < A.rows; y++) if (y + 0.5 >= topAt(bx) && y + 0.5 <= botAt(bx)) g[y][x] = 'K';
    }
    // dorsal fin: tall, swept back, concave trailing edge
    poly(g, sc([[19.5, 13.5], [21.4, 8.4], [24, 4], [27.4, 1.1], [30.2, 1.1], [30.6, 4.6], [32.4, 9], [36.5, 14.8]]), 'K');
    // flukes: crescent on the tail stock, sheared by the beat; level stock
    const sh = ([x, y]) => [x * s, (y + dy * Math.max(0, x - 49) / 9) * s];
    poly(g, [[48, 16.6], [51.5, 14], [54.5, 10.6], [58, 7.8], [58.6, 10.6], [57, 14.2], [54.6, 16.6], [55.6, 18], [54.6, 19.4], [57, 21.6], [58.6, 25.2], [58, 28], [54.5, 25.2], [51.5, 22.2], [48, 19.6]].map(sh), 'K');
    // pectoral flipper: a paddle swept back and down, flexing with the beat
    const fx = [0, 1, 0, -1][frame] * 0.9;
    poly(g, sc([[11, 25.5], [15.5, 26], [20.5, 28.4], [24 + fx, 31.8], [22.4 + fx, 33], [18 + fx * 0.5, 32.4], [13.5, 30], [10.4, 27.6]]), 'K');
    // tones: lit back (top-left), shaded underside
    const inb = (x, y) => g[y] && g[y][x] === 'K';
    for (let x = 0; x < A.cols; x++) {
        const bx = (x + 0.5) / s;
        if (bx >= 3 && bx <= 36) { const y = Math.floor(topAt(bx) + 0.5 - 0.5 + 1e-6) + 0; for (let k = 0; k < Math.max(1, Math.round(1.6 * s)); k++) { const yy = Math.ceil(topAt(bx) - 0.5) + k; if (inb(x, yy)) g[yy][x] = k === 0 ? 'S' : 's'; } }
    }
    // dorsal fin leading edge light, trailing edge dark
    for (let y = 0; y < A.rows; y++) {
        let x0 = -1, x1 = -1;
        for (let x = 0; x < A.cols; x++) if (g[y][x] === 'K' && y < Math.floor(12 * s)) { if (x0 < 0) x0 = x; x1 = x; }
        if (x0 >= 0 && y < Math.floor(11 * s)) { g[y][x0] = 'S'; if (x1 > x0 + 1) g[y][x1] = 'k'; if (x1 > x0 + 2) g[y][x0 + 1] = 's'; }
    }
    // white belly, chin and underside of the stock, bottom row shaded
    for (let x = 0; x < A.cols; x++) {
        const bx = (x + 0.5) / s; if (bx < 1.5 || bx > 49) continue;
        const dep = curve(ORCA_WHITE, bx) * s, bt = botAt(bx);
        for (let y = 0; y < A.rows; y++) if (y + 0.5 > bt - dep && y + 0.5 <= bt && g[y][x] !== '.') g[y][x] = (y + 1.5 > bt) ? 'w' : 'W';
    }
    // white lobe up the flank behind the flipper
    poly(g, sc([[33, 23.2], [37, 20.4], [41, 20.4], [43, 21.6], [40, 23]]), (x, y) => g[y][x] !== '.' ? 'W' : '.');
    // eye patch: white oval above and behind the eye, then the eye
    poly(g, sc([[7.8, 15.2], [11, 14], [14.4, 14.8], [13.6, 16.6], [10.5, 17.2], [8.2, 16.6]]), (x, y) => g[y][x] !== '.' ? 'W' : '.');
    // grey saddle behind the dorsal fin
    poly(g, sc([[35, 13.6], [38, 12.8], [43, 13.8], [45, 15.6], [40, 15.4], [36.4, 15]]), (x, y) => (g[y][x] === 'K' || g[y][x] === 's') ? 'g' : '.');
    const ex = Math.round(7.2 * s), ey = Math.round(17.4 * s);
    put(g, ex, ey, 'E'); if (s > 0.8) { put(g, ex + 1, ey, 'E'); put(g, ex, ey - 1, 'E'); put(g, ex + 1, ey - 1, 'E'); put(g, ex + 2, ey - 1, 'w'); }
    outline(g, () => true);
    const pal = {}; for (const k in ORCA_PAL) pal[k] = hex(ORCA_PAL[k]);
    return render(g, pal);
}

// ── ANGLER ───────────────────────────────────────────────────
// 22x18, faces right; stalk ends at T.LURE[art][frame] (bulb is a separate overlay, see lureImg).
const ANG_TOP = [8, 8, 7, 6, 5, 5, 4, 4, 4, 4, 4, 5, 5, 6, 7, 7, 8, 8];   // x = 3..20  (we draw x0=3)
const ANG_BOT = [11, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 13, 13, 12];
const ANGLER_PAL = {
    b: '#4A3C6E', l: '#7461A4', d: '#2C2347', s: '#9482C8', f: '#6A5AA0', F: '#8C7BC2', m: '#5E1C40',
    w: '#F7F1DE', e: '#FFE27A', k: '#25160F', a: '#5B4A86', o: '#150F27', q: '#261C42', t: '#B7A4E2'
};
function anglerFrame(art, frame) {
    const A = T.kinds.angler.arts[art], g = mk(A.cols, A.rows);
    fillProfile(g, 3, ANG_TOP, ANG_BOT, 'b');
    // top rim light and underside shadow
    for (let x = 6; x <= 17; x++) {
        const t = ANG_TOP[x - 3], bt = ANG_BOT[x - 3];
        put(g, x, t, 'l'); if (x > 7 && x < 15) put(g, x, t + 1, 'l');
        put(g, x, bt, 'd'); put(g, x, bt - 1, 'd');
    }
    // bioluminescent speckles
    pts(g, 's', [[8, 8], [10, 7], [11, 10], [7, 11], [9, 12], [12, 12], [6, 9]]);
    // mouth: wide, up-curved, full of teeth
    for (let x = 12; x <= 20; x++) { put(g, x, 10, 'm'); put(g, x, 11, 'm'); }
    pts(g, 'd', [[11, 11], [11, 12]]);
    pts(g, 'w', [[13, 10], [15, 10], [17, 10], [19, 10], [14, 11], [16, 11], [18, 11], [20, 11]]);
    pts(g, 'b', [[20, 9], [20, 8]]);
    // eye: glowing ring + pupil
    ascii(g, ['eee', 'eke', 'eee'], 13, 6);
    // pectoral + dorsal + anal fins
    pts(g, 'f', [[9, 13], [10, 13], [8, 14], [9, 14], [10, 14], [11, 14]]);
    pts(g, 'F', [[9, 13], [8, 14]]);
    pts(g, 'f', [[7, 3], [8, 3], [9, 3], [8, 4], [9, 4], [10, 4], [11, 4]]);
    pts(g, 'F', [[8, 3]]);
    pts(g, 'f', [[7, 16], [8, 16], [9, 16], [8, 17], [9, 17]]);
    // tail fan: tilts with the beat
    const dy = [0, -1, 0, 1][frame];
    const tail = [[0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12],
                  [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [1, 12], [2, 8], [2, 9], [2, 10], [2, 11]];
    for (const [x, y] of tail) put(g, x, y + dy + (x === 0 ? dy : 0), (x + y) % 2 ? 'f' : 'F');
    pts(g, 'f', [[2, 9 + dy], [2, 10 + dy]]);
    // lure stalk: a curve from the brow, up and forward, into the bulb (anchor from theme.js)
    const L = T.LURE[art][frame], p0 = [14, 5], p1 = [15.5, 0 + dy], p2 = [L.x - 1, L.y];
    for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        put(g, Math.round(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), Math.round(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]), 'a');
    }
    put(g, L.x - 2, L.y, 'a');                               // joins the stalk tip (under the bulb) so no texel is left alone
    outline(g, c => c !== 'e' && c !== 'a');
    const pal = {}; for (const k in ANGLER_PAL) pal[k] = hex(ANGLER_PAL[k]);
    return render(g, pal);
}
// lure bulb overlay (5x5, centred): intensity 0 dim, 1 lit, 2 flare
function lureImg(level) {
    const g = mk(5, 5);
    ascii(g, ['..h..', '.hoh.', 'hocoh', '.hoh.', '..h..']);
    const pal = [
        { h: hex('#FF9F3A', 0.0), o: hex('#FFB84A'), c: hex('#FFE9A0') },
        { h: hex('#FF9F3A', 0.35), o: hex('#FFC85A'), c: hex('#FFF6C8') },
        { h: hex('#FFE38A', 0.9), o: hex('#FFE070'), c: hex('#FFFFFF') }
    ][level];
    if (level === 0) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (g[y][x] === 'h') g[y][x] = '.';
    return render(g, pal);
}
// newborn star (5x5)
function sparkImg() {
    const g = mk(5, 5);
    ascii(g, ['..h..', '..H..', 'hHWHh', '..H..', '..h..']);
    return render(g, { h: hex('#FFFFFF', 0.55), H: hex('#FFFFFF', 0.9), W: hex('#FFFFFF') });
}
// soft dithered glow (33x33): ordered-dither of a radial falloff in 3 alpha steps
function glowImg() {
    const S = T.GLOW_SIZE, c = (S - 1) / 2, px = Buffer.alloc(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - c, y - c) / c;
        if (d >= 1) continue;
        const v = Math.pow(1 - d, 1.6) * 3.2;
        const lvl = Math.min(3, Math.floor(v + BAYER[y & 3][x & 3] / 16));
        if (!lvl) continue;
        const o = (y * S + x) * 4, a = [0, 0.08, 0.14, 0.22][lvl];
        px[o] = 255; px[o + 1] = 226; px[o + 2] = 140; px[o + 3] = Math.round(a * 255);
    }
    return { W: S, H: S, px };
}

// ── JELLY ────────────────────────────────────────────────────
// Four sizes (T.kinds.jelly.arts), translucent: alpha is baked into the pixels (bright rim, glassy bell,
// pink gonads, faint trailing tentacles). The bell pulses over 4 frames (wide / narrowing / narrow / widening).
function jellyFrame(art, frame) {
    const A = T.kinds.jelly.arts[art], W = A.cols, H = A.rows, g = mk(W, H), cx = (W - 1) / 2;
    const pulse = [0, 0.12, 0.26, 0.12][frame];                              // 0 wide .. 1 narrow
    const bw = (W - 2) * (1 - pulse * 0.45), bh = Math.round((W - 2) * (0.5 + pulse * 0.28));
    const top = 1, rows = [];
    for (let j = 0; j < bh; j++) {
        const yn = (bh - 1 - j + 0.4) / (bh + 0.2);                          // 1 at the crown .. ~0 at the rim
        const hw = (bw / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(yn, 2.3))) + (j >= bh - 2 ? 0.35 : 0);
        const x0 = Math.ceil(cx - hw + 0.4), x1 = Math.floor(cx + hw - 0.4);
        rows.push([x0, x1]);
        for (let x = x0; x <= x1; x++) put(g, x, top + j, 'b');
    }
    rows.forEach(([x0, x1], j) => {
        const y = top + j;
        put(g, x0, y, 'h'); put(g, x1, y, j < bh - 3 ? 'R' : 'h');
        if (j === 0) for (let x = x0; x <= x1; x++) put(g, x, y, 'h');
        if (j === 1) for (let x = x0 + 1; x <= x1 - 1; x++) if (get(g, x, y) === 'b') put(g, x, y, x < cx ? 'H' : 'i');
        if (j === bh - 1) for (let x = x0; x <= x1; x++) put(g, x, y, 'r');
        else if (j > 2 && W >= 16) for (const dx of [-W * 0.27, 0, W * 0.27]) { const x = Math.round(cx + dx + (dx ? 0 : -0.5)); if (get(g, x, y) === 'b') put(g, x, y, 'i'); }
    });
    // sheen on the upper left
    for (let j = 1; j < Math.min(bh - 2, 3 + (W >> 3)); j++) { const x = rows[j][0] + 1 + (j > 2 ? 0 : 1); if (get(g, x, top + j) === 'b') put(g, x, top + j, 'H'); }
    // gonads: a four-leaf clover in the middle of the bell
    if (W >= 16) for (const [dx, dj] of [[-2, 0], [2, 0], [-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]]) { const x = Math.round(cx + dx), y = top + bh - 4 + dj; if (get(g, x, y) !== '.') put(g, x, y, 'g'); }
    else for (const [dx, dj] of [[-1, 0], [0, 0], [1, 0]]) { const x = Math.round(cx + dx), y = top + bh - 3 + dj; if (get(g, x, y) !== '.') put(g, x, y, 'g'); }
    // scalloped rim fringe
    const rimY = top + bh, last = rows[bh - 1];
    for (let x = last[0]; x <= last[1]; x++) if ((x - last[0]) % 2 === 0) put(g, x, rimY, 'r');
    // oral arms (frilly, centre) and trailing tentacles: the sway lags down the length
    const ph = frame * Math.PI / 2, avail = H - rimY - 1;
    const armLen = Math.round(avail * 0.62);
    for (let j = 0; j < armLen; j++) {
        const sw = Math.round(Math.sin(j * 0.6 - ph) * (0.6 + j * 0.05));
        put(g, Math.floor(cx) + sw, rimY + 1 + j, j % 3 === 2 ? 'A' : 'a'); put(g, Math.ceil(cx + 0.01) + sw, rimY + 1 + j, j % 3 === 0 ? 'A' : 'a');
    }
    if (W < 16) for (let j = 0; j < armLen; j++) put(g, Math.floor(cx), rimY + 1 + j, 'a');
    const bases = W >= 16 ? [last[0] + 1, Math.round(cx - W * 0.2), Math.round(cx + W * 0.2) + 1, last[1] - 1] : [last[0] + 1, last[1] - 1];
    bases.forEach((bx, t) => {
        const len = Math.round(avail * (0.72 + (t % 2) * 0.28));
        let px = bx;
        for (let j = 0; j < len; j++) {
            const x = bx + Math.round(Math.sin(j * 0.5 + t * 1.7 - ph) * (j > 0 ? 1 + j / avail : 0));
            const ch = j > len * 0.65 ? 'f' : 't';
            if (x !== px) put(g, px, rimY + 1 + j, ch);                  // keep the thread 4-connected
            put(g, x, rimY + 1 + j, ch); px = x;
        }
    });
    const pal = {
        b: hex('#A58AE8', 0.62), i: hex('#C9B8FF', 0.72), h: hex('#E8DEFF', 0.95), r: hex('#D8C8FF', 0.88), H: hex('#FFFFFF', 0.9), R: hex('#CDBBFF', 0.8),
        g: hex('#F6A8DA', 0.85), a: hex('#C9A8F0', 0.7), A: hex('#E6C8FA', 0.8), t: hex('#B7A0F0', 0.72), f: hex('#B7A0F0', 0.42)
    };
    return render(g, pal);
}

// ── WORM ─────────────────────────────────────────────────────
function wormFrame(art, frame) {
    const A = T.kinds.worm.arts[art], W = A.cols, H = A.rows, g = mk(W, H), ph = frame * Math.PI / 2;
    const bwid = art === 0 ? 1 : 2, free = W - 2 - bwid, cx = [];
    for (let y = 1; y < H - 1; y++) {
        const k = y - 1, amp = (0.3 + Math.min(1, k * 0.2)) * (free > 0 ? 1 : 0);
        const x = 1 + Math.max(0, Math.min(free, Math.round(free / 2 + Math.sin(k * 0.8 + ph) * amp * (free / 2 + 0.2))));
        cx.push(x);
        const seg = (k >> 1) % 2;
        for (let i = 0; i < bwid; i++) put(g, x + i, y, seg ? (i ? 'b' : 'd') : (i ? 'l' : 'b'));
    }
    put(g, cx[0], 1, 'n'); if (bwid > 1) put(g, cx[0] + 1, 1, 'n');
    put(g, cx[0] + bwid - 1, 2, 'k');                        // eye
    outline(g, () => true);
    const pal = { b: hex('#FF9AA3'), l: hex('#FFC8C8'), d: hex('#E8687F'), n: hex('#FFB0B4'), k: hex('#5A1E3A'), o: hex('#8A3A58'), q: hex('#C0576F') };
    return render(g, pal);
}

// ── BUBBLE ───────────────────────────────────────────────────
function bubbleImg(art) {
    const D = T.kinds.bubble.arts[art].cols, g = mk(D, D), R = (D - 1) / 2, c = R;
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        const d = Math.hypot(x - c, y - c);
        if (D === 3 && d < 0.1) g[y][x] = 'i';
        else if (Math.abs(d - R) < (D === 3 ? 0.4 : 0.55)) g[y][x] = 'r';
        else if (d < R - 0.5 && D >= 5) g[y][x] = 'i';
    }
    // lit upper-left rim, highlight, glint low right
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (g[y][x] === 'r' && x + y < D - 1.2) g[y][x] = 'R';
    if (D >= 5) { put(g, 1 + (D > 5 ? 1 : 0), 1 + (D > 5 ? 1 : 0), 'H'); if (D > 5) put(g, 1, 2, 'H'); }
    else if (D === 4) put(g, 1, 1, 'H');
    if (D >= 4) put(g, D - 2, D - 2, 'G');
    const pal = { r: hex('#BFE6FF', 0.62), i: hex('#CFEFFF', 0.13), R: hex('#F2FAFF', 0.95), H: hex('#FFFFFF', 1), G: hex('#E2F4FF', 0.7) };
    return render(g, pal);
}

// ── AMBIENT TEXTURES ─────────────────────────────────────────
// Three seabed layers share one width and tile horizontally: far.png (hazy distant hills, a few soft kelp and
// coral silhouettes, bluer and dimmer), flora.png (a calm cartoon garden: ribbon kelp, chunky rounded corals,
// flower anemones on stalks, tube sponges; drawn behind the sand so the roots are covered) and seabed.png
// (smooth layered dunes, a few round rocks, two starfish). Every shape is a rounded blob with a one-pixel dark
// outline and three flat tones (light from the top-left); no dithering, no noise. All periodic functions use
// whole cycles per tile, so the seams do not show.
const SB = T.SEABED, FL = T.FLORA, FA = T.FAR, TAU = Math.PI * 2, TW = SB.cols;
const per = (x, k, ph) => Math.sin(TAU * k * x / TW + ph);
const surf = x => 18 + 2.2 * per(x, 2, 0.3) + 1.4 * per(x, 5, 1.7);                    // sand surface row in seabed.png
const surf2 = x => surf(x) + 9 + 1.6 * per(x, 3, 2.2) + 1.0 * per(x, 7, 0.5);          // a second, darker dune line below it
const farSurf = x => 42 + 2.4 * per(x, 3, 0.9) + 1.5 * per(x, 7, 2.1);                 // distant hills row in far.png
const wrapX = x => ((x % TW) + TW) % TW;
const dim = (c, t) => lchMix(c, '#12537f', t);                                          // shift a colour towards the deep water (far layer)
const dimRgb = (c, t) => { const a = hex(c), b = hex('#12537f'); return '#' + [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join(''); };   // same, hue-true (flora, sand)

// a painter bound to one grid: wrapped writes, optional clip below `ymax`, shaded outlined discs, ribbon kelp
function painter(g) {
    const H = g.length;
    const P = (x, y, ch, ymax) => { x = wrapX(Math.round(x)); y = Math.round(y); if (y >= 0 && y < H && (ymax === undefined || y <= ymax)) g[y][x] = ch; };
    // ellipse centred on (cx, cy); tones = [light, mid, dark] keys; ring = outline key (or null); ymax clips the bottom
    const disc = (cx, cy, rx, ry, tones, ring, ymax) => {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
            if (d <= 1) {
                const lit = -u * 0.45 - v * 0.55;
                P(x, y, lit > 0.42 ? tones[0] : lit > -0.3 ? tones[1] : tones[2], ymax);
            } else if (ring && ((x + 0.5 - cx) / (rx + 1)) ** 2 + ((y + 0.5 - cy) / (ry + 1)) ** 2 <= 1) P(x, y, ring, ymax);
        }
    };
    // wavy ribbon rising from (x0, y0): width swells and narrows, rounded tip. wid = [base, swell]; outlined if ring
    const ribbon = (x0, y0, h, amp, ph, wph, wid, tones, ring) => {
        const cx = [], hw = [];
        for (let j = 0; j <= h; j++) {
            cx.push(x0 + Math.sin(j * 0.075 + ph) * amp * Math.min(1, j / 16));
            hw.push((wid[0] + wid[1] * (0.5 + 0.5 * Math.sin(j * 0.19 + wph))) * (j > h - 9 ? Math.sqrt(Math.max(0.05, (h - j) / 9)) : 1));
        }
        const span = (j, pad) => {
            const p = cx[Math.max(0, j - 1)], w = hw[j] + pad;
            return [Math.round(Math.min(p, cx[j]) - w), Math.round(Math.max(p, cx[j]) + w)];
        };
        if (ring) {
            for (let j = 0; j <= h; j++) { const [a, b] = span(j, 1); for (let x = a; x <= b; x++) P(x, y0 - j, ring); }
            for (let x = Math.round(cx[h] - 1); x <= Math.round(cx[h] + 1); x++) P(x, y0 - h - 1, ring);
        }
        for (let j = 0; j <= h; j++) {
            const [a, b] = span(j, 0), w = Math.max(0.5, hw[j]);
            for (let x = a; x <= b; x++) P(x, y0 - j, x < cx[j] - w * 0.25 ? tones[0] : x > cx[j] + w * 0.45 ? tones[2] : tones[1]);
        }
    };
    return { P, disc, ribbon };
}

function seabedImg() {
    const W = SB.cols, H = SB.rows, g = mk(W, H), { P, disc } = painter(g);
    for (let x = 0; x < W; x++) {
        const n = Math.round(surf(x)), m = Math.round(surf2(x));
        for (let y = n; y < H; y++) g[y][x] = y === n ? 'h' : y < m ? 'a' : y === m ? 's' : y < m + 10 ? 'b' : y < m + 15 ? 'c' : 'e';
    }
    const surfaceY = x => Math.round(surf(wrapX(x)));
    // round rocks: half-domes sitting in the sand, three tones and a dark outline (flat at the bottom)
    const rock = (x, w, h, mossy) => {
        const base = surfaceY(x) + 3;
        disc(x, base, w / 2, h, ['M', 'm', 'k'], 'u', base);
        if (mossy) disc(x - w * 0.12, base - h * 0.62, w * 0.3, h * 0.26, ['G', 'g', 'g'], null, base - 2);
    };
    rock(196, 40, 17, true); rock(222, 18, 8); rock(372, 34, 15); rock(396, 14, 7); rock(520, 44, 18, true); rock(548, 16, 8);
    for (const x of [30, 150, 330, 455, 590]) { const y = surfaceY(x) + 4; P(x, y, 'p'); P(x + 1, y, 'P'); }          // a few pebbles
    const star = (x, c1, c2) => {
        const y = surfaceY(x) + 4;
        for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [-2, 2], [2, 2]]) P(x + dx, y + dy, (dx + dy < 0 && dx < 1) ? c1 : c2);
        P(x, y, 'Y');
    };
    star(170, 'T', 't'); star(450 + 5, 'T', 't');
    const pal = {
        h: hex(dimRgb('#d6d9b0', 0.18)), a: hex(dimRgb('#c6cfa6', 0.21)), s: hex(dimRgb('#a5bb9c', 0.25)), b: hex(dimRgb('#b2c4a0', 0.23)), c: hex(dimRgb('#96b19a', 0.27)), e: hex(dimRgb('#78a096', 0.31)),
        p: hex(dimRgb('#e0e2c0', 0.18)), P: hex(dimRgb('#b2c4a4', 0.23)), M: hex(dimRgb('#b2c4c2', 0.21)), m: hex(dimRgb('#90a8b0', 0.25)), k: hex(dimRgb('#6d899a', 0.27)),
        G: hex('#7fb190'), g: hex('#5f9a82'), u: hex('#3f6076'), T: hex('#f2a876'), t: hex('#d0764a'), Y: hex('#ffe0aa')
    };
    return render(g, pal);
}

// flora: drawn on a canvas as tall as FL.rows; roots sit on the sand surface (and are covered by seabed.png)
function floraImg() {
    const W = FL.cols, H = FL.rows, g = mk(W, H), { P, disc, ribbon } = painter(g);
    const rootY = x => H - SB.rows + Math.round(surf(wrapX(x))) + 1;
    // palettes: three tones each (light, mid, dark), pulled slightly towards the water so the garden stays calm
    const TONES = {
        kA: ['#62c9a2', '#3ea788', '#277f74'], kB: ['#74d29c', '#4cb383', '#2e8a6c'], gr: ['#8adba0', '#5cbb85', '#3c9470'],
        pk: ['#ffbfc8', '#f58fab', '#cc6489'], or: ['#ffcb92', '#f9a062', '#d27649'], pu: ['#d8b8f4', '#ae88da', '#805eb4'],
        ye: ['#fff3b8', '#ffdc80', '#eab654'], st: ['#e4a8b8', '#c7809f', '#9d5d82'], dk: ['#7a3c64', '#6a3058', '#5a2650']
    };
    const pal = { o: hex('#103f66', 0.92) };
    const tk = {};
    for (const n in TONES) { tk[n] = TONES[n].map((c, i) => { const k = n + i; pal[k] = hex(dimRgb(c, 0.24)); return k; }); }
    const RING = 'o';
    // ribbon kelp: pair or trio of swaying fronds sharing a root
    const kelp = (x, h, amp, ph, wph, t, w) => ribbon(x, rootY(x), h, amp, ph, wph, w || [1.5, 1.5], tk[t], RING);
    // chunky coral mound: overlapping round lobes, back to front, with a couple of darker dots
    const mound = (x, s, flip, t) => {
        const y0 = rootY(x), f = flip ? -1 : 1;
        const lobes = [[-7, -8, 5.2], [7, -9, 5.6], [0, -12, 6], [-3.5, -5.5, 6], [5, -5, 5.4]];
        for (const [dx, dy, r] of lobes) disc(x + f * dx * s, y0 + dy * s, r * s, r * s * 0.95, tk[t], RING);
        for (const [dx, dy] of [[-1, -12], [7, -6], [-5, -5]]) { P(x + f * dx * s, y0 + dy * s, tk[t][2]); P(x + f * dx * s + 1, y0 + dy * s, tk[t][2]); }
    };
    // flower anemone: a curved stalk topped by a ring of round petals around a bright centre
    const flower = (x, h, ph, petal, centre, s) => {
        s = s || 1.5;
        const y0 = rootY(x), sx = j => x + Math.sin(j * 0.13 + ph) * 1.8 * Math.min(1, j / 8);
        for (let j = 0; j <= h; j++) { for (const dx of [-1, 0, 1, 2]) P(sx(j) + dx - 0.5, y0 - j, RING); }
        for (let j = 0; j <= h; j++) { P(sx(j) - 0.5, y0 - j, tk.kA[0]); P(sx(j) + 0.5, y0 - j, tk.kA[1]); }
        const hx = sx(h) + 0.5, hy = y0 - h - 3 * s, n = 6;
        const pet = [];
        for (let k = 0; k < n; k++) { const a = k * TAU / n + 0.5; pet.push([hx + Math.cos(a) * 4.6 * s, hy + Math.sin(a) * 4.0 * s]); }
        pet.sort((a, b) => a[1] - b[1]);
        for (const [px, py] of pet) disc(px, py, 3.0 * s, 3.0 * s, tk[petal], RING);
        disc(hx, hy, 2.9 * s, 2.7 * s, tk[centre], RING);
    };
    // tube sponges: a small cluster of fat tubes with a dark opening
    const tubes = (x, list, t) => {
        const y0 = rootY(x);
        for (let [dx, w, h] of list) {
            dx = Math.round(dx * 1.6); w = Math.round(w * 1.5); h = Math.round(h * 1.6);
            const x0 = x + dx, top = y0 - h;
            for (let j = 0; j <= h; j++) { P(x0 - 1, top + j, RING); P(x0 + w, top + j, RING); }
            for (let j = 0; j <= h; j++) for (let i = 0; i < w; i++) P(x0 + i, top + j, i < w * 0.3 ? tk[t][0] : i >= w * 0.65 ? tk[t][2] : tk[t][1]);
            disc(x0 + w / 2, top, w / 2 + 0.2, 3, [tk[t][0], tk[t][0], tk[t][1]], RING);
            disc(x0 + w / 2, top + 0.3, w / 2 - 1.3, 1.7, tk.dk, null);
        }
    };
    // ── the garden: five calm groups per tile, plenty of empty water between them
    kelp(30, 70, 4, 0.3, 0.0, 'kA'); kelp(39, 50, 3.5, 1.9, 2.0, 'kB');
    mound(68, 1.6, false, 'pk');
    flower(106, 28, 0.6, 'or', 'ye');
    tubes(150, [[0, 6, 14], [-7, 5, 9], [7, 5, 10]], 'or');
    kelp(210, 78, 4.5, 2.2, 1.0, 'kB'); kelp(219, 56, 4, 0.4, 3.0, 'kA');
    mound(250, 1.7, true, 'pu');
    flower(292, 36, 2.1, 'pk', 'ye', 1.7);
    tubes(336, [[0, 6, 12], [-7, 5, 8], [7, 5, 7]], 'pu');
    kelp(392, 62, 4, 4.1, 0.6, 'kA'); kelp(401, 74, 4.5, 5.2, 2.4, 'kB');
    mound(436, 1.7, false, 'or');
    flower(472, 26, 3.4, 'pu', 'ye');
    kelp(522, 72, 4, 1.2, 1.7, 'kA'); kelp(531, 48, 3.5, 3.0, 0.2, 'kB');
    mound(562, 1.5, true, 'pk');
    flower(592, 20, 4.4, 'or', 'ye', 1.3);
    // a few short sea-grass tufts
    for (const x of [88, 190, 274, 372, 500]) { ribbon(x - 2, rootY(x), 13, 1.5, x, 0.5, [0.8, 0.5], tk.gr, RING); ribbon(x + 2, rootY(x), 17, 1.8, x + 2, 1.5, [0.8, 0.5], tk.gr, RING); }
    return { W, H, px: renderMulti(g, pal) };
}
// like render() but characters may be multi-character keys (stored as strings in the grid)
function renderMulti(g, pal) {
    const H = g.length, W = g[0].length, px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = g[y][x]; if (ch === '.') continue;
        const c = pal[ch]; if (!c) throw new Error('no colour for "' + ch + '" at ' + x + ',' + y);
        px[(y * W + x) * 4] = c[0]; px[(y * W + x) * 4 + 1] = c[1]; px[(y * W + x) * 4 + 2] = c[2]; px[(y * W + x) * 4 + 3] = c[3];
    }
    return px;
}

// far layer: smooth distant hills with a few round humps and soft kelp / coral silhouettes, all pulled towards the water colour
function farImg() {
    const W = FA.cols, H = FA.rows, g = mk(W, H), { disc, ribbon } = painter(g);
    for (let x = 0; x < W; x++) {
        const n = Math.round(farSurf(x));
        for (let y = n; y < H; y++) g[y][x] = y === n ? 'u' : (y < n + 4 ? 'v' : 'z');
    }
    const base = x => Math.round(farSurf(wrapX(x))) + 2;
    for (const [x, w, h] of [[56, 40, 11], [310, 46, 12], [486, 34, 10]]) disc(x, base(x), w / 2, h, ['r', 'q', 'q'], null, base(x));
    for (const [x, h, ph] of [[104, 32, 0.2], [112, 24, 1.6], [190, 36, 2.5], [262, 28, 3.7], [372, 34, 5.0], [440, 30, 1.9], [512, 36, 4.1], [20, 26, 3.0]])
        ribbon(x, base(x), h, 3, ph, ph * 2, [1.0, 1.0], ['wl', 'w', 'w'], null);
    for (const [x, s] of [[150, 1], [226, 0.9], [420, 1], [566, 0.9]]) for (const [dx, dy, r] of [[-5, -4, 4], [5, -4, 4], [0, -7, 4.6], [0, -2, 5]]) disc(x + dx * s, base(x) + dy * s, r * s, r * s, ['m', 'm', 'm'], null, base(x));
    const pal = { u: hex(dim('#4a9bb8', 0.55)), v: hex(dim('#3a86a6', 0.62)), z: hex(dim('#2c6f93', 0.62)), r: hex(dim('#4f93b0', 0.58)), q: hex(dim('#3c7899', 0.62)),
        w: hex(dim('#2d8a94', 0.6)), wl: hex(dim('#3a9aa0', 0.6)), m: hex(dim('#4a8aa6', 0.62)) };
    return render(g, pal);
}
// light shaft: a leaning bar of light with a smooth alpha profile, wider and fainter with depth
function shaftImg() {
    const W = T.SHAFT.cols, H = T.SHAFT.rows, px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
        const t = y / H, lean = y * 0.11, half = 5 + t * 12;
        for (let x = 0; x < W; x++) {
            const d = Math.abs(x - (6 + lean + half)) / half;
            if (d >= 1) continue;
            const strength = Math.pow(1 - d * d, 1.3) * Math.pow(1 - t, 1.6);
            const o = (y * W + x) * 4, a = Math.min(1, strength * 1.05);
            if (a < 0.02) continue;
            px[o] = 226; px[o + 1] = 247; px[o + 2] = 255; px[o + 3] = Math.round(a * 255);
        }
    }
    return { W, H, px };
}
// waterline (static, 96x4): the bright edge of the surface seen from below; ripple strip (moving, 96x8)
function waterlineImg() {
    const W = 96, H = 4, g = mk(W, H);
    for (let x = 0; x < W; x++) {
        const w = Math.round(1.2 + 0.9 * Math.sin(TAU * 2 * x / W) + 0.5 * Math.sin(TAU * 5 * x / W + 1));
        for (let y = 0; y < H; y++) g[y][x] = y < w ? 'a' : (y === w ? 'b' : (y === w + 1 ? 'c' : '.'));
    }
    return render(g, { a: hex('#f4fcff', 0.95), b: hex('#d2f0ff', 0.7), c: hex('#b4e4ff', 0.34) });
}
function surfaceImg() {
    const W = 96, H = 8, g = mk(W, H);
    const dash = (x, y, n, c) => { for (let i = 0; i < n; i++) g[y][(x + i) % W] = c; };
    dash(0, 0, 9, 'a'); dash(14, 0, 5, 'a'); dash(26, 0, 12, 'a'); dash(46, 0, 7, 'a'); dash(57, 0, 4, 'a'); dash(70, 0, 10, 'a'); dash(86, 0, 6, 'a');
    dash(6, 1, 6, 'b'); dash(20, 1, 8, 'b'); dash(36, 1, 5, 'b'); dash(50, 1, 9, 'b'); dash(66, 1, 4, 'b'); dash(80, 1, 7, 'b');
    dash(2, 3, 3, 'c'); dash(24, 3, 4, 'c'); dash(41, 3, 3, 'c'); dash(55, 3, 4, 'c'); dash(74, 3, 3, 'c'); dash(90, 3, 4, 'c');
    dash(12, 5, 2, 'c'); dash(33, 5, 3, 'c'); dash(62, 5, 3, 'c'); dash(84, 6, 2, 'c');
    return render(g, { a: hex('#e8f8ff', 0.5), b: hex('#bfe8ff', 0.3), c: hex('#bfe8ff', 0.16) });
}

// ── driver ───────────────────────────────────────────────────
function allImages() {
    const out = {}, K = T.kinds;
    for (let a = 0; a < K.fish.arts.length; a++) for (const v of T.allFishVariants()) for (let f = 0; f < K.fish.frames; f++) out[T.frameFile('fish', a, v, f)] = fishFrame(a, v, f);
    for (let f = 0; f < 4; f++) {
        for (let a = 0; a < K.orca.arts.length; a++) out[T.frameFile('orca', a, '', f)] = orcaFrame(a, f);
        for (let a = 0; a < K.angler.arts.length; a++) out[T.frameFile('angler', a, '', f)] = anglerFrame(a, f);
        for (let a = 0; a < K.jelly.arts.length; a++) out[T.frameFile('jelly', a, '', f)] = jellyFrame(a, f);
        for (let a = 0; a < K.worm.arts.length; a++) out[T.frameFile('worm', a, '', f)] = wormFrame(a, f);
    }
    for (let a = 0; a < K.bubble.arts.length; a++) out[T.frameFile('bubble', a, '', 0)] = bubbleImg(a);
    for (let l = 0; l < 3; l++) out['lure-' + l + '.png'] = lureImg(l);
    out['spark.png'] = sparkImg();
    out['glow.png'] = glowImg();
    out['seabed.png'] = seabedImg();
    out['flora.png'] = floraImg();
    out['far.png'] = farImg();
    out['shaft.png'] = shaftImg();
    out['waterline.png'] = waterlineImg();
    out['surface.png'] = surfaceImg();
    for (const k in K) K[k].arts.forEach((ar, a) => {      // descriptor sizes must match the art
        const f = out[T.frameFile(k, a, k === 'fish' ? 'coral' : '', 0)];
        if (f.W !== ar.cols || f.H !== ar.rows) throw new Error(k + ' art ' + a + ': art is ' + f.W + 'x' + f.H + ', theme.js says ' + ar.cols + 'x' + ar.rows);
    });
    return out;
}

// contact sheet: every sprite/frame enlarged 8x on a neutral background
function contactSheet(imgs, file) {
    const row = (kind, art, variant) => [0, 1, 2, 3].map(f => T.frameFile(kind, art, variant, f));
    const rows = [];
    for (const a of [2, 1, 0]) for (const v of ['coral', 'amber', 'lemon', 'aqua', 'orchid', 'red', 'alarm', 'aqua-w2']) if (a === 2 || ['coral', 'aqua', 'red'].includes(v)) rows.push(row('fish', a, v));
    for (const a of [1, 0]) rows.push(row('orca', a, ''));
    for (const a of [0]) rows.push(row('angler', a, ''));
    for (let a = 3; a >= 0; a--) rows.push(row('jelly', a, ''));
    for (let a = 2; a >= 0; a--) rows.push(row('worm', a, ''));
    rows.push([0, 1, 2, 3, 4].map(a => T.frameFile('bubble', a, '', 0)).concat(['lure-0.png', 'lure-1.png', 'lure-2.png', 'spark.png', 'glow.png']));
    sheet(imgs, file, rows, 8);
}

const imgs = allImages();
const si = process.argv.indexOf('--sheet');
if (si > 0) contactSheet(imgs, process.argv[si + 1]);
if (process.argv.includes('--scenery')) {
    const j = process.argv.indexOf('--scenery');
    sheet(imgs, process.argv[j + 1], [['far.png'], ['flora.png'], ['seabed.png'], ['shaft.png', 'waterline.png', 'surface.png']], 3);
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
if (si < 0 || process.argv.includes('--write')) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (!imgs[f]) fs.unlinkSync(path.join(OUT, f));
    let bytes = 0;
    for (const f in imgs) { const b = png.encode(imgs[f].W, imgs[f].H, imgs[f].px); fs.writeFileSync(path.join(OUT, f), b); bytes += b.length; }
    console.log(Object.keys(imgs).length + ' images, ' + (bytes / 1024).toFixed(0) + ' KiB -> ' + OUT);
}
