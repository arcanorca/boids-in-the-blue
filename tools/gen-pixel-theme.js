// Generates the "pixel" theme's textures (contents/themes/pixel/img/*.png) and, optionally,
// the 8x contact sheet. All art is authored here as hand-placed cell grids (ASCII rows and
// coordinate patches, shaded by hand with 3-4 tones per colour + selective outlines); the
// dimensions, frame counts and anchors come from contents/themes/pixel/theme.js.
//   node tools/gen-pixel-theme.js [--check] [--sheet <out.png>]
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
// 16x12, faces right. l highlight, b base, d shadow, w belly, f fin, e/k eye, p pattern.
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
function fishFrame(variant, frame) {
    const g = mk(16, 12);
    ascii(g, FISH_BODY);
    pts(g, 'd', FISH_GILL);
    for (const [ch, list] of FISH_MARK[variant]) pts(g, ch, list.filter(([x, y]) => get(g, x, y) !== '.' && !'ekf'.includes(get(g, x, y))));
    const dy = [0, -1, 0, 1][frame];
    ascii(g, TAIL, 0, 3 + dy);
    // pectoral fin flutters on the odd-beat frames
    if (frame === 2) { pts(g, 'b', [[8, 6]]); pts(g, 'f', [[8, 7]]); }
    outline(g, () => true);
    const p = FISH_PAL[variant], pal = { '.': null, e: hex('#FFFFFF'), k: hex('#15122A') };
    for (const k of 'lbdwfoqp') pal[k] = hex(p[k]);
    return render(g, pal);
}

// ── ORCA ─────────────────────────────────────────────────────
// 32x16. Natural orientation faces LEFT (matches the classic sprite: the sim flips when moving right).
const ORCA_TOP = [8, 7, 6, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7];   // x = 1..27
const ORCA_BOT = [9, 10, 10, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 11, 11, 10, 10, 10, 10, 9, 9, 9, 8, 8, 8];
const ORCA_PAL = {
    K: '#1E2B40', k: '#0F1829', s: '#41597C', W: '#F5F9FD', w: '#B3C3D9', g: '#7A8DA9', o: '#0A1222', q: '#304A6C',
    E: '#0B1020', e: '#FFFFFF', m: '#2A3B58'
};
function orcaFrame(frame) {
    const OY = 2, g = mk(32, 18);                          // body rows are offset by 2 to leave room for the tall dorsal fin
    const P = (x, y, ch) => put(g, x, y + OY, ch), Gt = (x, y) => get(g, x, y + OY);
    const PP = (ch, list) => list.forEach(([x, y]) => P(x, y, ch));
    ORCA_TOP.forEach((t, i) => { for (let y = t; y <= ORCA_BOT[i]; y++) P(1 + i, y, 'K'); });
    // dorsal fin: tall, swept back, concave trailing edge (rows -2..3 around the body top at row 4)
    for (const [y, x0, x1] of [[-2, 19, 19], [-1, 18, 19], [0, 17, 19], [1, 16, 19], [2, 15, 19], [3, 15, 20]]) for (let x = x0; x <= x1; x++) P(x, y, 'K');
    PP('s', [[19, -2], [18, -1], [17, 0], [16, 1], [15, 2], [15, 3]]);
    PP('k', [[19, 0], [19, 1], [19, 2], [20, 3]]);
    // sheen along the back
    for (let x = 5; x <= 20; x++) { const t = ORCA_TOP[x - 1]; if (Gt(x, t + 1) === 'K') P(x, t + 1, 's'); }
    // belly + chin + underside of the tail stock (white), shaded
    for (let x = 3; x <= 24; x++) {
        const b = ORCA_BOT[x - 1], depth = x < 7 ? 2 : (x < 20 ? 3 : (x < 24 ? 2 : 1));
        for (let y = b - depth + 1; y <= b; y++) if (Gt(x, y) === 'K') P(x, y, y === b ? 'w' : 'W');
    }
    PP('W', [[2, 9], [3, 9], [2, 10]]);
    PP('k', [[2, 9], [3, 9], [4, 9], [5, 9], [6, 10]]);                  // mouth line
    // eye patch (white oval above and behind the eye) + eye
    PP('W', [[6, 6], [7, 6], [8, 6], [7, 5], [8, 5], [9, 6]]);
    PP('w', [[6, 7], [8, 7]]);
    PP('E', [[5, 7], [6, 7]]);
    PP('e', [[6, 6]]);
    // grey saddle behind the dorsal fin
    PP('g', [[19, 5], [20, 5], [21, 5], [22, 6], [21, 6], [20, 6], [19, 4], [22, 5]]);
    // pectoral flipper (paddle swept back), flexes with the beat
    const fl = frame % 2 === 0 ? [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13], [12, 13], [13, 13], [11, 14], [12, 14], [13, 14]]
                               : [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13], [12, 13], [11, 14], [12, 14], [12, 15]];
    PP('K', fl); PP('s', [[10, 13]]);
    // tail flukes: a bold crescent, sheared up/down with the beat (neutral, up, neutral, down)
    const dy = [0, -2, 0, 2][frame];
    const FL = [[31, 3], [30, 4], [31, 4], [29, 5], [30, 5], [31, 5], [28, 6], [29, 6], [30, 6], [27, 7], [28, 7], [29, 7], [27, 8], [28, 8], [29, 8],
                [28, 9], [29, 9], [30, 9], [29, 10], [30, 10], [31, 10], [30, 11], [31, 11], [31, 12]];
    for (const [x, y] of FL) P(x, y + Math.round(dy * (x - 27) / 4), 'K');
    PP('s', FL.filter(([x, y]) => y <= 6 && !(x === 31 && y === 4)).map(([x, y]) => [x, y + Math.round(dy * (x - 27) / 4)]));
    outline(g, () => true);
    const pal = {}; for (const k in ORCA_PAL) pal[k] = hex(ORCA_PAL[k]);
    return render(g, pal);
}

// ── ANGLER ───────────────────────────────────────────────────
// 22x18, faces right; stalk ends at T.LURE[frame] (bulb is a separate overlay, see lureImg).
const ANG_TOP = [8, 8, 7, 6, 5, 5, 4, 4, 4, 4, 4, 5, 5, 6, 7, 7, 8, 8];   // x = 3..20  (we draw x0=3)
const ANG_BOT = [11, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 13, 13, 12];
const ANGLER_PAL = {
    b: '#4A3C6E', l: '#7461A4', d: '#2C2347', s: '#9482C8', f: '#6A5AA0', F: '#8C7BC2', m: '#5E1C40',
    w: '#F7F1DE', e: '#FFE27A', k: '#25160F', a: '#5B4A86', o: '#150F27', q: '#261C42', t: '#B7A4E2'
};
function anglerFrame(frame) {
    const g = mk(22, 18);
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
    const L = T.LURE[frame], p0 = [14, 5], p1 = [15.5, 0 + dy], p2 = [L.x - 1, L.y];
    for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        put(g, Math.round(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), Math.round(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]), 'a');
    }
    outline(g, c => c !== 'e' && c !== 'a');
    const pal = {}; for (const k in ANGLER_PAL) pal[k] = hex(ANGLER_PAL[k]);
    return render(g, pal);
}
// lure bulb overlay (5x5, centred): intensity 0 dim, 1 lit, 2 flare
function lureImg(level) {
    const g = mk(5, 5);
    const A = [
        ['..h..', '.hoh.', 'hocoh', '.hoh.', '..h..'],
        ['..h..', '.hoh.', 'hocoh', '.hoh.', '..h..'],
        ['..h..', '.hoh.', 'hocoh', '.hoh.', '..h..']
    ][level];
    ascii(g, A);
    const pal = [
        { h: hex('#FF9F3A', 0.0), o: hex('#FFB84A'), c: hex('#FFE9A0') },
        { h: hex('#FF9F3A', 0.35), o: hex('#FFC85A'), c: hex('#FFF6C8') },
        { h: hex('#FFE38A', 0.9), o: hex('#FFE070'), c: hex('#FFFFFF') }
    ][level];
    // 'h' = halo rays (only visible when brighter), 'o' = ring, 'c' = core
    const gg = mk(5, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) gg[y][x] = g[y][x];
    if (level === 0) { for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (gg[y][x] === 'h') gg[y][x] = '.'; }
    return render(gg, pal);
}
// soft dithered glow (33x33): ordered-dither of a radial falloff in 3 alpha steps
function glowImg() {
    const S = T.GLOW_SIZE, c = (S - 1) / 2, px = Buffer.alloc(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - c, y - c) / c;
        if (d >= 1) continue;
        const v = Math.pow(1 - d, 1.6) * 3.2;                 // 0..~3 levels
        const lvl = Math.min(3, Math.floor(v + BAYER[y & 3][x & 3] / 16));
        if (!lvl) continue;
        const o = (y * S + x) * 4, a = [0, 0.08, 0.14, 0.22][lvl];
        px[o] = 255; px[o + 1] = 226; px[o + 2] = 140; px[o + 3] = Math.round(a * 255);
    }
    return { W: S, H: S, px };
}

// ── JELLY ────────────────────────────────────────────────────
// 14x22. Translucent: alpha is baked into the pixels (rim bright, body glassy, tentacles faint).
function jellyFrame(frame) {
    const W = 14, H = 22, g = mk(W, H);
    // bell shape per frame: [width, height]
    const [bw, bh] = [[14, 8], [12, 9], [10, 9], [12, 8]][frame];
    const top = 1, cx = (W - 1) / 2;
    const rows = [];
    for (let j = 0; j < bh; j++) {
        const yn = (bh - 1 - j) / (bh - 0.4);                      // 1 at the crown .. 0 at the rim
        const hw = (bw / 2) * Math.sqrt(Math.max(0, 1 - yn * yn * 0.96));
        const x0 = Math.ceil(cx - hw + 0.001), x1 = Math.floor(cx + hw - 0.001);
        rows.push([x0, x1]);
        for (let x = x0; x <= x1; x++) put(g, x, top + j, 'b');
    }
    // edge light + crown + canals + gonads + sheen
    rows.forEach(([x0, x1], j) => {
        const y = top + j;
        put(g, x0, y, 'h'); put(g, x1, y, 'h');
        if (j === 0) for (let x = x0; x <= x1; x++) put(g, x, y, 'h');
        if (j === bh - 1) for (let x = x0; x <= x1; x++) put(g, x, y, 'r');
        else if (j > 1 && j < bh - 1) for (const dx of [-3, 0, 3]) { const x = Math.round(cx + dx + (dx ? 0 : -0.5)); if (get(g, x, y) === 'b') put(g, x, y, 'i'); }
    });
    for (const [dx, dj] of [[-2, bh - 4], [-1, bh - 3], [1, bh - 3], [2, bh - 4], [0, bh - 5], [-1, bh - 4], [0, bh - 4]]) {
        const x = Math.round(cx - 0.5 + dx + 0.5), y = top + dj; if (get(g, x, y) !== '.') put(g, x, y, 'g');
    }
    pts(g, 'H', [[4 + (bw < 12 ? 1 : 0), top + 2], [5 + (bw < 12 ? 1 : 0), top + 1], [4 + (bw < 12 ? 1 : 0), top + 3]]);
    // scalloped rim fringe
    const rimY = top + bh;
    for (let x = rows[bh - 1][0]; x <= rows[bh - 1][1]; x++) if ((x - rows[bh - 1][0]) % 2 === 0) put(g, x, rimY, 'r');
    // oral arms (frilly, centre) and trailing tentacles; sway lags down the length
    const ph = frame * Math.PI / 2;
    for (let j = 0; j < 9; j++) {
        const sw = Math.round(Math.sin(j * 0.7 - ph) * 0.9);
        put(g, 6 + sw, rimY + 1 + j, j % 3 === 2 ? 'A' : 'a'); put(g, 7 + sw, rimY + 1 + j, j % 3 === 0 ? 'A' : 'a');
    }
    const bases = [rows[bh - 1][0] + 1, 4, 9, rows[bh - 1][1] - 1];
    bases.forEach((bx, t) => {
        const len = 8 + (t % 2) * 3;
        for (let j = 0; j < len; j++) {
            const x = bx + Math.round(Math.sin(j * 0.6 + t * 1.7 - ph) * 1.0) * (j > 0 ? 1 : 0);
            put(g, x, rimY + 1 + j, j > len - 4 ? 'f' : 't');
        }
    });
    const pal = {
        b: hex('#A58AE8', 0.5), i: hex('#C9B8FF', 0.62), h: hex('#E8DEFF', 0.92), r: hex('#D8C8FF', 0.88), H: hex('#FFFFFF', 0.9),
        g: hex('#F6A8DA', 0.85), a: hex('#C9A8F0', 0.7), A: hex('#E6C8FA', 0.8), t: hex('#B7A0F0', 0.62), f: hex('#B7A0F0', 0.34)
    };
    return render(g, pal);
}

// ── WORM ─────────────────────────────────────────────────────
function wormFrame(frame) {
    const W = 6, H = 12, g = mk(W, H), ph = frame * Math.PI / 2;
    const cx = [];
    for (let y = 0; y < H; y++) {
        const amp = 0.3 + Math.min(1.5, y * 0.25) * (y > H - 3 ? 0.7 : 1);
        const x = 2 + Math.round(Math.sin(y * 0.62 + ph) * amp);
        cx.push(x);
        const seg = (y >> 1) % 2;                     // annulus rings
        put(g, x, y, seg ? 'd' : 'b'); put(g, x + 1, y, seg ? 'b' : 'l');
    }
    // tapered tail
    put(g, cx[H - 1], H - 1, '.'); 
    put(g, cx[0] + 1, 0, 'n');                         // head cap
    pts(g, 'k', [[cx[1], 1]]);                         // eye
    outline(g, () => true);
    const pal = { b: hex('#FF9AA3'), l: hex('#FFC8C8'), d: hex('#E8687F'), n: hex('#FFB0B4'), k: hex('#5A1E3A'), o: hex('#8A3A58'), q: hex('#C0576F') };
    return render(g, pal);
}

// ── BUBBLE ───────────────────────────────────────────────────
function bubbleImg() {
    const g = mk(8, 8);
    ascii(g, ['..rrrr..', '.r....r.', 'r......r', 'r......r', 'r......r', 'r......r', '.r....r.', '..rrrr..']);
    // inner body (faint), lit upper-left rim, highlight, bottom glint
    for (let y = 1; y <= 6; y++) for (let x = 1; x <= 6; x++) if (g[y][x] === '.' && Math.hypot(x - 3.5, y - 3.5) < 3.4) g[y][x] = 'i';
    pts(g, 'R', [[2, 1], [3, 1], [1, 2], [1, 3]]);
    pts(g, 'H', [[2, 2], [2, 3]]);
    pts(g, 'G', [[5, 6], [6, 5]]);
    const pal = { r: hex('#BFE6FF', 0.62), i: hex('#CFEFFF', 0.13), R: hex('#F2FAFF', 0.95), H: hex('#FFFFFF', 1), G: hex('#E2F4FF', 0.7) };
    return render(g, pal);
}

// ── AMBIENT TEXTURES ─────────────────────────────────────────
// Sandy seabed silhouette, 192x30, tiles horizontally. Two dune layers + pebbles + weeds.
function seabedImg() {
    const W = T.SEABED.cols, H = T.SEABED.rows, g = mk(W, H), TAU = Math.PI * 2;
    const far = x => 14 + 2.4 * Math.sin(TAU * x / 192 + 0.8) + 1.5 * Math.sin(TAU * 3 * x / 192 + 2.1) + 0.8 * Math.sin(TAU * 6 * x / 192);
    const near = x => 25 + 2.8 * Math.sin(TAU * 2 * x / 192 + 0.3) + 1.7 * Math.sin(TAU * 5 * x / 192 + 1.7) + 0.8 * Math.sin(TAU * 9 * x / 192 + 0.4);
    for (let x = 0; x < W; x++) {
        const f = Math.round(far(x)), n = Math.round(near(x));
        for (let y = f; y < H; y++) g[y][x] = y === f ? 'u' : (y < f + 3 ? 'v' : 'z');
        for (let y = n; y < H; y++) {
            const d = y - n, dith = BAYER[y & 3][x & 3] / 16;
            g[y][x] = d === 0 ? 'h' : d === 1 ? 'a' : (d < 4 ? (dith < 0.5 ? 'a' : 'b') : d < 8 ? (dith < 0.35 ? 'b' : 'c') : (dith < 0.4 ? 'c' : 'e'));
        }
    }
    // rocks sitting on the far dune: rounded 2-tone blobs
    const rock = (x, w, h) => {
        const base = Math.round(far(x)) + 1;
        for (let j = 0; j < h; j++) { const hw = Math.round(w / 2 * Math.sqrt(1 - Math.pow(j / h, 2))); for (let xx = x - hw; xx <= x + hw; xx++) put(g, xx, base - j, (j > h - 3 || xx > x + hw / 3) ? 'k' : 'm'); }
    };
    rock(40, 12, 6); rock(41, 5, 8); rock(150, 14, 5); rock(110, 8, 4);
    // pebbles & shells on the near dune
    for (const x of [14, 31, 47, 66, 83, 101, 118, 139, 152, 171, 184]) {
        const y = Math.round(near(x)) + 2 + (x % 3);
        put(g, x, y, 'p'); put(g, x + 1, y, 'P'); if (x % 2) put(g, x, y + 1, 'c');
    }
    // sea-grass tufts and fan corals, silhouetted dark teal, swaying shapes frozen
    const weed = (x, len, lean) => {
        const base = Math.round(near(x)) + 1;
        for (let j = 0; j < len; j++) {
            const wx = x + Math.round(Math.sin(j * 0.5 + x) * 1 + lean * j / len);
            put(g, wx, base - j, j > len - 3 ? 'W' : 'w');
        }
    };
    [[22, 11, 1], [24, 15, -1], [26, 8, 2], [96, 13, 1], [98, 9, -2], [100, 16, 0], [150, 12, 1], [153, 8, -1], [60, 7, 1], [168, 9, -1], [171, 12, 1]].forEach(a => weed(...a));
    for (const cx of [124, 74]) {                          // fan coral
        const base = Math.round(near(cx)) + 1;
        for (let j = 0; j < 12; j++) { const hw = Math.min(5, 1 + (j >> 1)); for (let x = cx - hw; x <= cx + hw; x++) if ((x + j) % 2 === 0 || j < 3) put(g, x, base - j, j > 8 ? 'W' : 'w'); }
        for (let j = 0; j < 3; j++) put(g, cx, base - j, 'w');
    }
    const pal = {
        u: hex('#1f6f94'), v: hex('#195f84'), z: hex('#134e72'), k: hex('#0f4566'), m: hex('#1a5b7e'),
        h: hex('#a3c4ae'), a: hex('#7fa99f'), b: hex('#648f94'), c: hex('#497b87'), e: hex('#35607a'),
        p: hex('#c2d4bf'), P: hex('#8fb2a2'), w: hex('#14565f'), W: hex('#2e8c84')
    };
    return render(g, pal);
}
// light shaft 36x200: a leaning bar of light, dithered in 3 alpha steps, fading with depth
function shaftImg() {
    const W = 36, H = 200, px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
        const t = y / H, lean = y * 0.12, half = 5 + t * 5;
        for (let x = 0; x < W; x++) {
            const d = Math.abs(x - (10 + lean + half)) / half;      // 0 centre .. 1 edge
            if (d >= 1) continue;
            const strength = (1 - d * d) * Math.pow(1 - t, 1.4);
            const lvl = Math.min(3, Math.floor(strength * 3.2 + BAYER[y & 3][x & 3] / 16));
            if (!lvl) continue;
            const o = (y * W + x) * 4, a = [0, 0.4, 0.7, 1][lvl];
            px[o] = 224; px[o + 1] = 246; px[o + 2] = 255; px[o + 3] = Math.round(a * 255);
        }
    }
    return { W, H, px };
}
// surface ripple strip 64x6: light caustic dashes under the waterline, tiles horizontally
function surfaceImg() {
    const W = 64, H = 6, g = mk(W, H);
    const dash = (x, y, n, c) => { for (let i = 0; i < n; i++) put(g, (x + i) % W, y, c); };
    dash(0, 0, 9, 'a'); dash(14, 0, 5, 'a'); dash(26, 0, 12, 'a'); dash(46, 0, 7, 'a'); dash(57, 0, 4, 'a');
    dash(6, 1, 6, 'b'); dash(20, 1, 8, 'b'); dash(36, 1, 5, 'b'); dash(50, 1, 9, 'b');
    dash(2, 3, 3, 'c'); dash(24, 3, 4, 'c'); dash(41, 3, 3, 'c'); dash(55, 3, 4, 'c');
    dash(12, 5, 2, 'c'); dash(33, 5, 3, 'c');
    return render(g, { a: hex('#e8f8ff', 0.5), b: hex('#bfe8ff', 0.3), c: hex('#bfe8ff', 0.16) });
}

// ── driver ───────────────────────────────────────────────────
function allImages() {
    const out = {};
    for (const v of T.allFishVariants()) for (let f = 0; f < T.kinds.fish.frames; f++) out['fish-' + v + '-' + f + '.png'] = fishFrame(v, f);
    for (let f = 0; f < 4; f++) {
        out['orca-' + f + '.png'] = orcaFrame(f);
        out['angler-' + f + '.png'] = anglerFrame(f);
        out['jelly-' + f + '.png'] = jellyFrame(f);
        out['worm-' + f + '.png'] = wormFrame(f);
    }
    for (let l = 0; l < 3; l++) out['lure-' + l + '.png'] = lureImg(l);
    out['glow.png'] = glowImg();
    out['bubble.png'] = bubbleImg();
    out['seabed.png'] = seabedImg();
    out['shaft.png'] = shaftImg();
    out['surface.png'] = surfaceImg();
    for (const k in T.kinds) {                            // descriptor sizes must match the art
        const kd = T.kinds[k], f = out[T.frameFile(k, 'coral', 0)];
        if (f.W !== kd.cols || f.H !== kd.rows) throw new Error(k + ': art is ' + f.W + 'x' + f.H + ', theme.js says ' + kd.cols + 'x' + kd.rows);
    }
    return out;
}

// contact sheet: every sprite/frame enlarged 8x on a neutral background
function sheet(imgs, file) {
    const S = 8, PAD = 3, BG = [74, 84, 94];
    const rows = [];
    for (const v of T.FISH_VARIANTS.concat(['aqua-w1', 'aqua-w2', 'aqua-w3', 'orchid-w2', 'lemon-w2'])) rows.push([0, 1, 2, 3].map(f => 'fish-' + v + '-' + f + '.png'));
    for (const k of ['orca', 'angler', 'jelly', 'worm']) rows.push([0, 1, 2, 3].map(f => k + '-' + f + '.png'));
    rows.push(['lure-0.png', 'lure-1.png', 'lure-2.png', 'bubble.png', 'glow.png']);
    rows.push(['shaft.png', 'surface.png', 'seabed.png']);
    // lay out rows of items with 3-cell gaps; width = widest row
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
