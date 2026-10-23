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
// Three seabed layers share one width and tile horizontally, and read as three depths: far.png (hazy,
// desaturated hills, rock domes, kelp and coral silhouettes), flora.png (muted mid ground: S-curved kelp with leaf
// blades and a few coral masses; drawn behind the sand so the roots are covered) and seabed.png (the richest layer:
// sunlit dunes with ripples and dappling, rock formations with strata and moss, shells, pebbles).
// Every material is a six-tone ramp (rim, light, mid, shade, deep, outline) with highlights drifting warm / teal and
// shadows drifting blue / purple; forms are shaded as lit from the top-left, with a one-pixel rim light and an
// outline in the material's own darkest tone. Dithering is only used on the wide ramps of rock and sand.
// All periodic functions use whole cycles per tile, so the seams do not show.
const SB = T.SEABED, FL = T.FLORA, FA = T.FAR, TAU = Math.PI * 2, TW = SB.cols;
const per = (x, k, ph) => Math.sin(TAU * k * x / TW + ph);
const surf = x => 18 + 2.2 * per(x, 2, 0.3) + 1.4 * per(x, 5, 1.7);                    // sand surface row in seabed.png
const farSurf = x => 42 + 2.4 * per(x, 3, 0.9) + 1.5 * per(x, 7, 2.1);                 // distant hills row in far.png
const wrapX = x => ((x % TW) + TW) % TW;
const dim = (c, t) => lchMix(c, '#12537f', t);                                          // shift a colour towards the deep water
const dimRgb = (c, t) => { const a = hex(c), b = hex('#12537f'); return '#' + [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join(''); };   // same, hue-true

// ramps: [rim, light, mid, shade, deep, outline]
const RAMPS = {
    ka: ['#d4f5b4', '#8fdfa6', '#4fbe9a', '#32967f', '#256c78', '#1b4a6c'],       // kelp, teal-green
    kb: ['#e4f4a8', '#b0e08a', '#6fc07c', '#46987a', '#33707a', '#214c6c'],       // kelp, olive-green
    cp: ['#ffe4d2', '#ffb9b6', '#ee8aa2', '#c06590', '#8a4a86', '#4e3478'],       // coral, rose
    co: ['#fff0c4', '#ffcc88', '#f0a064', '#c87458', '#8e5272', '#523a74'],       // coral, apricot
    cv: ['#f6e6ff', '#d4b4f6', '#aa86dc', '#8062b8', '#5a4a98', '#38387c'],       // coral, violet
    ro: ['#e2eadc', '#b4c8c4', '#8aa4b0', '#66849c', '#4a6486', '#2e4a72'],       // rock, cool grey-blue
    mo: ['#d8f2a4', '#a4d98a', '#6cb87c', '#4a9078', '#356c78', '#2a4c6c'],       // moss
    sa: ['#f2ecc6', '#dcdcb4', '#bcccaa', '#9cb4a2', '#7d9a9c', '#64828c'],       // sand
    sh: ['#fff6e6', '#f8dcc8', '#e8b8a8', '#c490a0', '#8e6a8e', '#5a4a80']        // shell
};
const IDX = lit => lit > 0.62 ? 0 : lit > 0.32 ? 1 : lit > 0.0 ? 2 : lit > -0.32 ? 3 : 4;   // lit (about -0.8..0.8) -> ramp index
function buildPal(names, t, tint) {
    const pal = {};
    for (const n of names) RAMPS[n].forEach((c, i) => { pal[n + i] = hex(tint ? dim(c, t) : dimRgb(c, t)); });
    return pal;
}
// remove orphan pixels (no 8-neighbour of the same tone): the hand-cleaned look
function despeckle(g) {
    const H = g.length, W = g[0].length;
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = g[y][x]; if (ch === '.') continue;
        let same = 0; const cnt = {};
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const yy = y + dy; if (yy < 0 || yy >= H) continue;
            const c = g[yy][wrapX(x + dx)]; if (c === ch) same++;
            if (!dx || !dy) cnt[c] = (cnt[c] || 0) + 1;
        }
        if (same) continue;
        let best = '.', bn = 0; for (const c in cnt) if (cnt[c] > bn) { bn = cnt[c]; best = c; }
        g[y][x] = best;
    }
}

// a painter bound to one grid: wrapped writes, shaded outlined blobs, tube paths, and the plant / coral builders
function painter(g, noRing) {
    const H = g.length;
    const P = (x, y, ch, ymax) => { x = wrapX(Math.round(x)); y = Math.round(y); if (y >= 0 && y < H && (ymax === undefined || y <= ymax)) g[y][x] = ch; };
    // stamp a set of ellipses {x, y, rx, ry}: outline pass first (one union outline), then the shaded fills.
    // o: mat, ring (false = none), shift (darker by n tones), ymax (clip)
    const stampSet = (pts, mat, o) => {
        o = o || {};
        const ring = (o.ring === false || noRing) ? null : mat + 5, sh = o.shift || 0;
        if (ring) for (const p of pts) {
            const rx = p.rx, ry = p.ry === undefined ? rx : p.ry;
            for (let y = Math.floor(p.y - ry - 1); y <= Math.ceil(p.y + ry + 1); y++) for (let x = Math.floor(p.x - rx - 1); x <= Math.ceil(p.x + rx + 1); x++)
                if (((x + 0.5 - p.x) / (rx + 0.9)) ** 2 + ((y + 0.5 - p.y) / (ry + 0.9)) ** 2 <= 1) P(x, y, ring, o.ymax);
        }
        for (const p of pts) {
            const rx = p.rx, ry = p.ry === undefined ? rx : p.ry;
            for (let y = Math.floor(p.y - ry - 1); y <= Math.ceil(p.y + ry + 1); y++) for (let x = Math.floor(p.x - rx - 1); x <= Math.ceil(p.x + rx + 1); x++) {
                const u = (x + 0.5 - p.x) / rx, v = (y + 0.5 - p.y) / ry;
                if (u * u + v * v > 1) continue;
                let i = IDX(-u * 0.5 - v * 0.6);
                if (o.ridge) { const d = Math.hypot((x + 0.5 - o.ridge[0]) / rx, (y + 0.5 - o.ridge[1]) / ry) * o.ridge[2]; if (d - Math.floor(d) < 0.36) i++; }
                P(x, y, mat + Math.min(4, i + sh), o.ymax);
            }
        }
    };
    const R = (v, a, b) => Math.max(a, Math.min(b, v));
    // a tube along a path of [x, y, r] samples
    const tube = (path, mat, o) => stampSet(path.map(([x, y, r]) => ({ x, y, rx: r })), mat, o);
    // kelp: an S-curved stem with alternating leaf blades; blades first (behind), the stem on top
    const kelp = (x0, y0, h, A, ph, mat) => {
        const sx = j => x0 + A * Math.sin(j * TAU / 58 + ph) * Math.min(1, j / 14);
        const blade = (bx, by, dir, L, wmax, th0) => {
            const pts = []; let x = bx, y = by, th = th0;
            for (let s = 0; s <= L * 2; s++) {
                const t = s / (L * 2);
                pts.push([x, y, Math.max(0.75, wmax * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + 0.9 * t)), 0.75) + 0.4 * (1 - t))]);
                x += dir * Math.sin(th) * 0.5; y -= Math.cos(th) * 0.5; th -= 0.8 * 0.5 / L * (1.2 + t);
            }
            tube(pts, mat);
        };
        let side = ph > 3 ? 1 : -1;
        for (let j = 18; j < h - 12; j += 17) { const f = Math.sin(Math.PI * j / h); blade(sx(j), y0 - j, side, 10 + 7 * f, 1.6 + 1.0 * f, 1.0); side = -side; }
        blade(sx(h - 12), y0 - h + 12, side, 15, 2.4, 0.5);
        const stem = []; for (let j = 0; j <= h - 12; j += 0.5) stem.push([sx(j), y0 - j, 1.5 - 0.5 * j / h]);
        tube(stem, mat);
    };
    // branching coral: thick rounded fingers, two or three levels, clean tips
    const branching = (x0, y0, s, mat, flip, seed) => {
        const pts = [], f = flip ? -1 : 1;
        const br = (x, y, ang, len, r, depth) => {
            const n = Math.round(len * 2);
            for (let i = 0; i < n; i++) { x += Math.sin(ang) * 0.5 * f; y -= Math.cos(ang) * 0.5; ang += 0.02 * Math.sin(seed + depth); pts.push([x, y, r * (1 - 0.1 * i / n)]); }
            pts.push([x, y, r * 1.1]);
            const offs = depth === 2 ? [-0.85, 0.12, 0.9] : depth === 1 ? [-0.55, 0.5] : [];
            offs.forEach((o, k) => br(x, y, ang + o + 0.08 * Math.sin(seed * (k + 2)), len * (depth === 2 ? 1.0 : 0.8), r * 0.74, depth - 1));
        };
        br(x0, y0 + 2, 0, 8 * s, 3.2 * s, 2);
        tube(pts, mat);
    };
    // table coral: a short stalk under a scalloped plate with a dark underside and a thin growth ridge
    const table = (x0, y0, rx, mat) => {
        const yp = y0 - 14, ry = Math.max(3, rx * 0.2);
        tube([[x0, y0 + 1, 4.2], [x0, y0 - 3, 3.2], [x0, y0 - 8, 2.9], [x0, y0 - 12, 3.4]], mat);
        const plate = (dy, o) => stampSet([{ x: x0, y: yp + dy, rx, ry }, { x: x0 - rx * 0.62, y: yp + dy + 0.7, rx: rx * 0.5, ry: ry * 0.8 }, { x: x0 + rx * 0.64, y: yp + dy + 0.9, rx: rx * 0.46, ry: ry * 0.8 }], mat, o);
        plate(2, { shift: 2 });
        plate(0, { ridge: [x0 - rx * 0.1, yp + 1.5, 1.9] });
    };
    // dome (brain) coral with contour ridges
    const brain = (x0, y0, rx, ry, mat) => stampSet([{ x: x0, y: y0 + 1, rx, ry }], mat, { ymax: y0 + 1, ridge: [x0 - rx * 0.15, y0 - ry * 0.5, 3.4] });
    return { P, stampSet, tube, kelp, branching, table, brain };
}

function seabedImg() {
    const W = SB.cols, H = SB.rows, g = mk(W, H), { P, stampSet } = painter(g);
    const surfaceY = x => Math.round(surf(wrapX(x)));
    const sandIdx = (x, d) => {
        const q = d + 0.9 * (surf(x + 3) - surf(x - 3));
        let i = q < 1.1 ? 0 : q < 4.5 ? 1 : q < 9.5 ? 2 : q < 16 ? 3 : 4;
        return Math.max(0, Math.min(4, i));
    };
    const idx = Array.from({ length: H }, () => Array(W).fill(-1));
    for (let x = 0; x < W; x++) { const n = surfaceY(x); for (let y = n; y < H; y++) idx[y][x] = sandIdx(x, y - n); }
    // soft ripples: a lit crest with a shaded trough under it, in long runs that follow the dune
    for (const [k, ph, f, ph2] of [[6, 0.0, 0.026, 0.5], [11, 1.7, 0.021, 2.4], [17, 3.1, 0.024, 4.1], [23, 4.6, 0.02, 1.2]]) for (let x = 0; x < W; x++) {
        if (Math.sin(x * f * 2.3 + ph2) < 0.5) continue;
        const y = surfaceY(x) + k + Math.round(1.2 * Math.sin(x * 0.03 + ph));
        if (y + 1 < H && idx[y][x] > 0) { idx[y][x] = Math.max(0, idx[y][x] - 1); idx[y + 1][x] = Math.min(4, idx[y + 1][x] + 1); }
    }
    // light dappling near the surface: broad, soft, lighter ellipses
    for (const [x0, d0, rx, ry] of [[22, 4, 11, 1.6], [64, 6.5, 8, 1.3], [118, 3.5, 13, 1.7], [172, 7, 9, 1.4], [236, 4.5, 12, 1.6], [296, 6.5, 8, 1.3], [352, 3.5, 11, 1.6], [420, 6, 10, 1.4], [476, 4, 13, 1.7], [538, 7, 8, 1.3], [580, 4.5, 10, 1.5]])
        for (let x = Math.floor(x0 - rx); x <= x0 + rx; x++) for (let y = 0; y < H; y++) {
            const xx = wrapX(x), n = surfaceY(xx), dy = y - (n + d0);
            if (idx[y][xx] >= 0 && (x - x0) ** 2 / (rx * rx) + dy * dy / (ry * ry) <= 1) idx[y][xx] = Math.max(0, idx[y][xx] - 1);
        }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (idx[y][x] >= 0) g[y][x] = 'sa' + idx[y][x];
    // contact shadow under a rock, then the rock itself: round parts with strata and an optional moss cap
    const rock = (cx, parts, moss) => {
        const base = surfaceY(cx) + 4;
        for (const [dx, w, h] of parts) for (let x = Math.floor(cx + dx - w / 2 - 3); x <= cx + dx + w / 2 + 4; x++) for (let y = base - 1; y <= base + 2; y++) {
            const u = (x - (cx + dx)) / (w / 2 + 3.5), v = (y - base - 0.5) / 2.2;
            if (u * u + v * v <= 1 && g[y][wrapX(x)].startsWith('sa')) g[y][wrapX(x)] = 'sa' + Math.min(4, +g[y][wrapX(x)].slice(2) + 1);
        }
        parts.forEach(([dx, w, h], pi) => {
            const x0 = cx + dx, rx = w / 2;
            const cells = [];
            for (let y = Math.floor(base - h - 1); y <= base; y++) for (let x = Math.floor(x0 - rx - 1); x <= Math.ceil(x0 + rx + 1); x++) {
                const u = (x + 0.5 - x0) / rx, v = (y + 0.5 - base) / h;
                if (u * u + v * v <= 1.0 && v <= 0.12) cells.push([x, y, u, v]);
            }
            // outline: union ring around the part, clipped at the sand
            for (let y = Math.floor(base - h - 2); y <= base; y++) for (let x = Math.floor(x0 - rx - 2); x <= Math.ceil(x0 + rx + 2); x++)
                if (((x + 0.5 - x0) / (rx + 0.9)) ** 2 + ((y + 0.5 - base) / (h + 0.9)) ** 2 <= 1) P(x, y, 'ro5', base);
            for (const [x, y, u, v] of cells) {
                const lit = -u * 0.5 + v * 0.62 + 0.18 * (1 - u * u);                       // v is negative towards the top
                let i = IDX(lit - 0.1), mat = 'ro';
                const s = base - y + 1.5 * Math.sin(x * 0.12 + pi * 2) + 0.8 * Math.sin(x * 0.31);
                if (Math.abs(s - 5 * Math.round(s / 5)) < 0.5 && s > 3 && v < -0.1) i = Math.min(4, i + 1);          // a stratum crack
                else if (Math.abs(s - 5 * Math.round(s / 5) - 1) < 0.5 && s > 3 && i > 1) i = i - 1;               // lit lip above it
                if (moss && pi === 0 && v < -0.55 - 0.1 * Math.sin(x * 0.5 + 1) - 0.07 * Math.sin(x * 1.3)) { mat = 'mo'; i = IDX(lit + 0.1); }
                P(x, y, mat + Math.min(4, Math.max(0, i)));
            }
        });
    };
    rock(130, [[0, 46, 20], [-17, 22, 10], [19, 24, 12]], true);
    rock(372, [[0, 28, 12], [14, 14, 7]], false);
    rock(500, [[0, 52, 22], [24, 22, 10], [-26, 18, 8]], true);
    // scallop shells
    const scallop = (x0, tint) => {
        const y0 = surfaceY(x0) + 7, R = 6;
        for (let y = y0 - R - 1; y <= y0 + 1; y++) for (let x = x0 - R - 1; x <= x0 + R + 1; x++) {
            const dx = x + 0.5 - x0, dy = y + 0.5 - y0, d = Math.hypot(dx, dy * 1.15), a = Math.atan2(dx, -dy);
            if (dy > 0.6 || d > R + 0.9 || Math.abs(a) > 1.25) continue;
            if (d > R) { P(x, y, 'sh5'); continue; }
            const rib = Math.abs(Math.sin(a * 4.5)) < 0.45;
            P(x, y, 'sh' + Math.min(4, (rib ? 3 : 2) + (tint ? 0 : -1) + (dx < -1.5 && dy < -1 ? -1 : 0) + (d < 1.6 ? 1 : 0)));
        }
    };
    scallop(168, 0); scallop(300, 1); scallop(566, 0);
    despeckle(g);
    const pal = buildPal(['ro', 'mo', 'sh'], 0, false); Object.assign(pal, buildPal(['sa'], 0.2, false));
    return render(g, pal);
}

// flora: drawn on a canvas as tall as FL.rows; roots sit on the sand surface (and are covered by seabed.png)
function floraImg() {
    const W = FL.cols, H = FL.rows, g = mk(W, H), B = painter(g);
    const rootY = x => H - SB.rows + Math.round(surf(wrapX(x))) + 1;
    // the garden: five groups per tile with long stretches of empty water between them
    B.kelp(26, rootY(26), 70, 5, 0.3, 'ka'); B.kelp(41, rootY(41), 54, 4.5, 3.6, 'kb');
    B.branching(92, rootY(92), 1.25, 'cp', false, 1.3);
    B.table(206, rootY(206), 17, 'cv');
    B.kelp(268, rootY(268), 66, 5, 1.5, 'kb');
    B.brain(322, rootY(322) - 2, 14, 10, 'co');
    B.kelp(380, rootY(380), 72, 5, 2.2, 'ka'); B.kelp(395, rootY(395), 52, 4.5, 5.1, 'kb');
    B.branching(446, rootY(446), 1.3, 'co', true, 2.1);
    B.table(558, rootY(558), 15, 'cp');
    despeckle(g);
    return { W, H, px: renderMulti(g, buildPal(['ka', 'kb', 'cp', 'co', 'cv'], 0.16, false)) };
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

// far layer: hazy, desaturated hills with soft banding, rock domes, and kelp / coral silhouettes without outlines
function farImg() {
    const W = FA.cols, H = FA.rows, g = mk(W, H), B = painter(g, true);
    for (let x = 0; x < W; x++) {
        const n = Math.round(farSurf(x));
        for (let y = n; y < H; y++) { const d = y - n; g[y][x] = d === 0 ? 'hu' : d < 4 ? 'hv' : d < 11 ? 'hw' : 'hz'; if (d >= 10 && d <= 11 && ((x + y) & 1)) g[y][x] = d === 10 ? 'hz' : 'hw'; }
    }
    const base = x => Math.round(farSurf(wrapX(x))) + 2;
    for (const [x, w, h] of [[60, 44, 11], [76, 22, 7], [312, 50, 12], [488, 36, 10]]) B.stampSet([{ x, y: base(x), rx: w / 2, ry: h }], 'fr', { ring: false, ymax: base(x) });
    for (const [x, h, A, ph, m] of [[110, 40, 4, 0.4, 'fk'], [119, 30, 3.5, 2.6, 'fk'], [196, 44, 4, 1.3, 'fk'], [372, 42, 4, 3.9, 'fk'], [380, 32, 3.5, 5.3, 'fk'], [520, 44, 4, 2.2, 'fk'], [20, 34, 3.5, 4.6, 'fk']]) B.kelp(x, base(x), h, A, ph, m);
    B.branching(152, base(152), 0.9, 'fc', false, 0.7); B.branching(430, base(430), 0.95, 'fc', true, 1.9);
    despeckle(g);
    const pal = { hu: hex(dim('#4a9bb8', 0.55)), hv: hex(dim('#3a86a6', 0.62)), hw: hex(dim('#327aa0', 0.62)), hz: hex(dim('#2c6f93', 0.62)) };
    for (const [m, src] of [['fr', 'ro'], ['fk', 'ka'], ['fc', 'cv']]) RAMPS[src].forEach((c, i) => { pal[m + i] = hex(dim(c, 0.74)); });
    return { W, H, px: renderMulti(g, pal) };
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
