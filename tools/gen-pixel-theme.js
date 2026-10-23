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
// Five hand-tuned sizes (T.kinds.fish.arts: 10x7, 14x10, 17x12, 20x14, 23x16), all facing right. The silhouette
// is a head-heavy body whose half height follows a hand-set profile, a forked tail on a slim stalk and
// dorsal / belly / pectoral fins; tones: l light back, b base, w pale belly, d shadow, f/F fins, with
// species markings stamped by `kind` (bar, freckles, lateral line, light back stripe, pale spots).
const FISH_P = [
    { W: 10, H: 7,  bx0: 3, bx1: 8,  by0: 2, by1: 5,  stalk: 0.45, tx0: 1, th: 2.2, notch: 0.0, dh: 1, du: [-0.35, 0.15], vh: 0, pec: null, eye: 'dot', gill: false },
    { W: 14, H: 10, bx0: 4, bx1: 12, by0: 3, by1: 7,  stalk: 0.36, tx0: 1, th: 3.0, notch: 0.4, dh: 2, du: [-0.4, 0.2],  vh: 1, pec: null, eye: 'pair', gill: false },
    { W: 17, H: 12, bx0: 4, bx1: 15, by0: 3, by1: 9,  stalk: 0.32, tx0: 1, th: 3.5, notch: 0.55, dh: 2, du: [-0.45, 0.2], vh: 1, pec: null, eye: 'pair', gill: true },
    { W: 20, H: 14, bx0: 5, bx1: 18, by0: 4, by1: 11, stalk: 0.28, tx0: 1, th: 4.2, notch: 0.7, dh: 3, du: [-0.5, 0.25], vh: 1, pec: { u: 0.1, w: 2 }, eye: 'sq', gill: true },
    { W: 23, H: 16, bx0: 5, bx1: 21, by0: 5, by1: 13, stalk: 0.27, tx0: 1, th: 4.8, notch: 0.8, dh: 4, du: [-0.55, 0.3], vh: 1, pec: { u: 0.08, w: 3 }, eye: 'sq', gill: true }
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
// markings per base variant, applied where u (-1 tail .. +1 nose) and v (-1 back .. +1 belly) fall inside
const FISH_MARK = {
    coral:  (u, v, x, y, P) => (u > -0.18 && u < 0.06 + (P.W > 15 ? 0.06 : 0)) ? 'p' : null,                              // one soft bar
    amber:  (u, v, x, y) => (u > -0.6 && u < 0.35 && v > -0.55 && v < 0.35 && ((x * 7 + y * 5) % 9 === 0)) ? 'p' : null,   // freckles
    lemon:  (u, v, x, y, P) => (Math.abs(v - 0.02) < (P.W > 15 ? 0.14 : 0.1) && u > -0.65 && u < 0.35) ? 'p' : null,        // lateral line
    aqua:   (u, v, x, y) => (v > -0.62 && v < -0.34 && u > -0.7 && u < 0.4) ? 'l' : (v > 0.42 && v < 0.6 && u > -0.4 && u < 0.3 ? 'p' : null),   // bright back stripe
    orchid: (u, v, x, y) => (u > -0.55 && u < 0.35 && v > -0.5 && v < 0.4 && ((x * 5 + y * 3) % 8 === 0)) ? 'l' : null    // pale spots
};
FISH_MARK.red = FISH_MARK.alarm = FISH_MARK.coral;
// stress "flush" steps: <colour>-w<k> = the colour ramp mixed k/4 of the way to the red ramp
for (const c of ['coral', 'amber', 'lemon', 'aqua', 'orchid']) for (let k = 1; k <= 3; k++) {
    FISH_PAL[c + '-w' + k] = {}; FISH_MARK[c + '-w' + k] = FISH_MARK[c];
    { const ref = wrap(toLch(FISH_PAL.red.b)[2] - toLch(FISH_PAL[c].b)[2]); for (const t in FISH_PAL[c]) FISH_PAL[c + '-w' + k][t] = lchMix(FISH_PAL[c][t], FISH_PAL.red[t], k / 4, ref); }
}
function fishFrame(art, variant, frame) {
    const P = FISH_P[art], g = mk(P.W, P.H);
    const cx = (P.bx0 + P.bx1 + 1) / 2, rx = (P.bx1 - P.bx0 + 1) / 2, cy = (P.by0 + P.by1 + 1) / 2, ry = (P.by1 - P.by0 + 1) / 2;
    // body: half height by u (head side: round, tail side: tapering to the stalk)
    const half = u => u >= 0 ? ry * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 1 / 2.2)
                             : ry * (P.stalk + (1 - P.stalk) * Math.pow(Math.max(0, 1 - Math.pow(-u, 1.7)), 1 / 1.7));
    const top = [], bot = [];
    for (let x = P.bx0; x <= P.bx1; x++) {
        const u = (x + 0.5 - cx) / rx, h = half(u);
        let t = 1e9, b = -1;
        for (let y = P.by0; y <= P.by1; y++) if (Math.abs(y + 0.5 - cy) <= h) { t = Math.min(t, y); b = Math.max(b, y); }
        top[x] = t; bot[x] = b;
        if (t > b) { top[x] = Math.round(cy - 0.5); bot[x] = Math.round(cy - 0.5); }
    }
    const mark = FISH_MARK[variant];
    for (let x = P.bx0; x <= P.bx1; x++) for (let y = top[x]; y <= bot[x]; y++) {
        const u = (x + 0.5 - cx) / rx, h = Math.max(0.5, (bot[x] - top[x] + 1) / 2), v = (y + 0.5 - (top[x] + bot[x] + 1) / 2) / h;
        let ch = 'b';
        if (y === top[x] && (bot[x] - top[x] >= 2)) ch = 'l';                          // lit back edge
        else if (v < -0.45 && u < 0.2) ch = 'l';                                       // top-left sheen
        if (v > 0.18 && ch === 'b') ch = 'w';                                          // pale belly
        if (y === bot[x] && bot[x] - top[x] >= 3) ch = (v > 0.18 ? 'd' : ch);          // shaded underside
        const m = mark && mark(u, v, x, y, P);
        if (m && P.W >= 14) ch = m;
        put(g, x, y, ch);
    }
    // gill line + mouth
    if (P.gill) { const gx = Math.round(cx + rx * 0.42); for (let y = top[gx] + 1; y <= bot[gx] - 1; y++) put(g, gx, y, 'd'); }
    const nose = P.bx1, ny = Math.round(cy + ry * 0.18);
    if (P.W >= 14) put(g, nose, ny, 'd');
    // eye
    const ex = Math.round(cx + rx * 0.58), ey = Math.round(cy - ry * 0.28);
    if (P.eye === 'sq') { pts(g, 'e', [[ex - 1, ey], [ex, ey], [ex - 1, ey + 1]]); put(g, ex, ey + 1, 'k'); }
    else if (P.eye === 'pair') { put(g, ex - 1, ey, 'e'); put(g, ex, ey, 'k'); }
    else put(g, ex, ey, 'k');
    // dorsal fin: rises steeply behind the head and trails back along the body
    const du = P.du;
    for (let x = P.bx0; x <= P.bx1; x++) {
        const u = (x + 0.5 - cx) / rx;
        if (u < du[0] || u > du[1]) continue;
        const t = (u - du[0]) / (du[1] - du[0]), hgt = Math.max(1, Math.round(P.dh * Math.sin(Math.pow(1 - t, 0.75) * Math.PI * 0.5 + 0.2) * (t < 0.12 ? 0.6 : 1)));
        for (let k = 1; k <= hgt; k++) put(g, x, top[x] - k, (k === hgt && hgt > 1) ? 'F' : 'f');
    }
    // pelvic fin below the belly, small anal fin
    if (P.vh) for (let x = Math.round(cx - rx * 0.05); x <= Math.round(cx + rx * 0.25); x++) for (let k = 1; k <= P.vh; k++) if (k === 1 || x < Math.round(cx + rx * 0.15)) put(g, x, bot[x] + k, k === P.vh ? 'F' : 'f');
    if (P.W >= 20) for (let x = Math.round(cx - rx * 0.55); x <= Math.round(cx - rx * 0.35); x++) put(g, x, bot[x] + 1, 'f');
    // tail: slim stalk, forked fan; the whole fan sways with the beat (neutral, up, neutral, down)
    const dy = [0, -1, 0, 1][frame], tbx = P.bx0, span = tbx - P.tx0;
    const th = P.th, sh = ry * P.stalk;
    for (let x = P.tx0; x < tbx; x++) {
        const t = (tbx - (x + 0.5)) / span;                                             // 0 at the stalk .. 1 at the tip
        const hh = lerp(sh, th, Math.pow(t, 1.15));
        const notch = t > 0.5 ? (t - 0.5) * 2 * P.notch : 0;
        const c = cy + dy * t * 0.99;
        for (let y = 0; y < P.H; y++) {
            const d = Math.abs(y + 0.5 - c);
            if (d <= hh && d >= notch) put(g, x, y, (c - (y + 0.5)) > hh * 0.55 ? 'F' : 'f');
        }
    }
    // pectoral fin flutters on the odd frames
    if (P.pec) {
        const px0 = Math.round(cx + rx * P.pec.u - P.pec.w + 1), py = Math.round(cy + ry * 0.12) + (frame % 2);
        for (let i = 0; i < P.pec.w; i++) { put(g, px0 + i, py, i === 0 ? 'F' : 'f'); put(g, px0 + i, py + 1, i < P.pec.w - 1 ? 'f' : 'd'); }
    }
    outline(g, () => true);
    const p = FISH_PAL[variant], pal = { '.': null, e: hex('#FFFFFF'), k: hex('#15122A') };
    for (const k of 'lbdwfoqp') pal[k] = hex(p[k]);
    pal.f = hex(lchMix(p.b, p.d, 0.55));                       // fins a shade deeper than the body, their leading rays lighter
    pal.F = hex(lchMix(p.b, p.l, 0.4));
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
    poly(g, sc([[19, 13.5], [21, 8.8], [24.5, 4.2], [29, 1.1], [31.6, 1.1], [31.6, 4.4], [33, 8.4], [37.5, 14.8]]), 'K');
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
    // mouth line
    if (s > 0.8) for (let i = 0; i < 9; i++) { const mx = 2 + i, my = 20.4 + i * 0.28; put(g, mx, Math.floor(my * s + 0.3), 'k'); }
    outline(g, () => true);
    const pal = {}; for (const k in ORCA_PAL) pal[k] = hex(ORCA_PAL[k]);
    return render(g, pal);
}

// ── ANGLER ───────────────────────────────────────────────────
// Designed on a 30x26 grid (default size, 1.5 fish long) and rasterised at the art's scale (the small
// class is 0.667x). Faces right; the stalk ends at T.LURE[art][frame] (the bulb is a separate overlay).
const ANGLER_PAL = {
    b: '#4A3C6E', l: '#7461A4', L: '#9A87CC', d: '#2C2347', s: '#9482C8', f: '#6A5AA0', F: '#8C7BC2', m: '#5E1C40',
    w: '#F7F1DE', e: '#FFE27A', k: '#25160F', a: '#5B4A86', o: '#150F27', q: '#261C42', t: '#B7A4E2'
};
const ANG_TOP = [[5, 15.2], [8, 12], [12, 9.6], [17, 8.8], [22, 10], [26, 12.4], [28.4, 14.6]];
const ANG_BOT = [[5, 17.6], [8, 21], [12, 23.4], [17, 24.2], [22, 23], [26, 21], [29, 19.4]];
function anglerFrame(art, frame) {
    const A = T.kinds.angler.arts[art], s = A.cols / 30, g = mk(A.cols, A.rows);
    const sc = ps => ps.map(([x, y]) => [x * s, y * s]);
    const dy = [0, -1, 0, 1][frame];
    const topAt = x => curve(ANG_TOP, x) * s, botAt = x => curve(ANG_BOT, x) * s;
    for (let x = 0; x < A.cols; x++) {
        const bx = (x + 0.5) / s; if (bx < 5 || bx > 29.3) continue;
        for (let y = 0; y < A.rows; y++) if (y + 0.5 >= topAt(bx) && y + 0.5 <= botAt(bx)) g[y][x] = 'b';
    }
    const at = (x, y) => (g[y] && g[y][x]) || '.';
    // rim light on the back, shadow under the belly, speckles
    for (let x = 0; x < A.cols; x++) {
        const bx = (x + 0.5) / s; if (bx < 7 || bx > 26) continue;
        const t = Math.ceil(topAt(bx) - 0.5), b = Math.floor(botAt(bx) - 0.5);
        if (at(x, t) === 'b') g[t][x] = 'L';
        if (at(x, t + 1) === 'b' && bx < 22) g[t + 1][x] = 'l';
        if (at(x, b) === 'b') g[b][x] = 'd';
        if (at(x, b - 1) === 'b' && bx > 9) g[b - 1][x] = 'd';
    }
    for (const [x, y] of [[9, 15], [12, 13], [15, 19], [10, 19], [18, 21], [13, 16.5], [21, 18], [8.5, 17.5]]) { const cx = Math.floor(x * s), cy = Math.floor(y * s); if (at(cx, cy) === 'b' || at(cx, cy) === 'l') g[cy][cx] = 's'; }
    // gaping, up-curved mouth full of teeth: the lower jaw juts out
    const mouth = [[29, 18.6], [26, 18.3], [23, 17.8], [20, 17.2], [17.5, 16.4], [16, 15.2]];
    for (let i = 0; i < mouth.length - 1; i++) for (let k = 0; k <= 8; k++) {
        const x = lerp(mouth[i][0], mouth[i + 1][0], k / 8), y = lerp(mouth[i][1], mouth[i + 1][1], k / 8);
        const cx = Math.floor(x * s), cy = Math.floor(y * s);
        if (at(cx, cy) !== '.') g[cy][cx] = 'm';
        if (s > 0.8 && at(cx, cy + 1) !== '.' && i < 4) g[cy + 1][cx] = 'm';
    }
    const teeth = s > 0.8 ? [[27.5, 0], [25, 0], [22.5, 0], [20, 0], [18, 0], [26.2, 1], [23.8, 1], [21.2, 1], [19, 1]] : [[17, 0], [14.5, 0], [15.5, 1]];
    teeth.forEach(([tx, lower]) => {
        const my = interp(mouth.slice().reverse(), tx), cx = Math.floor(tx * s), cy = Math.floor(my * s);
        const ty = lower ? cy + (s > 0.8 ? 2 : 1) : cy - 1;
        if (at(cx, ty) !== '.') g[ty][cx] = 'w';
    });
    // eye: glowing ring + pupil
    const ex = Math.round(21.6 * s), ey = Math.round(12.4 * s);
    if (s > 0.8) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(g, ex + i, ey + j, 'e'); put(g, ex + 1, ey, 'k'); put(g, ex + 1, ey + 1, 'k'); put(g, ex, ey, 'k'); }
    else { pts(g, 'e', [[ex - 1, ey], [ex, ey - 1], [ex, ey + 1]]); put(g, ex, ey, 'k'); put(g, ex + 1, ey, 'e'); }
    // fins: dorsal, anal, pectoral (frame-flexed)
    poly(g, sc([[9, 10.4], [12, 7], [14.6, 6.6], [15.6, 9.2]]), (x, y) => at(x, y) === '.' ? 'f' : (at(x, y) === 'L' ? 'F' : '.'));
    poly(g, sc([[9.5, 22.2], [12, 25.2], [14.6, 25.4], [15.2, 23.4]]), (x, y) => at(x, y) === '.' ? 'f' : '.');
    poly(g, sc([[13.6, 19], [18, 19.8], [18.6 + dy * 0.4, 23.6], [15.4, 22.2]]), 'f');
    poly(g, sc([[13.8, 19.2], [17, 19.6], [16.4, 20.8]]), 'F');
    // tail fan: tilts with the beat, with rays
    poly(g, sc([[5.6, 15], [2.4, 10.6 + dy], [0.8, 12.5 + dy], [0.8, 20 + dy * 1.5], [2.4, 22.6 + dy], [5.6, 18]]), (x, y) => ((y + (x >> 1)) % 3 === 0) ? 'F' : 'f');
    // lure stalk: a curve from the brow, up and forward, into the bulb
    const L = T.LURE[art][frame], p0 = [20.6 * s, 9.2 * s], p1 = [(L.x - 3) , 0.4 + dy * 0.5], p2 = [L.x - 1.4, L.y + 0.2];
    for (let i = 0; i <= 28; i++) {
        const t = i / 28, u = 1 - t;
        put(g, Math.floor(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), Math.floor(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]), 'a');
    }
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
// Three seabed layers share one width and tile horizontally: far.png (hazy distant hills and plants, bluer and
// dimmer), flora.png (kelp, corals, grass standing on the floor; drawn behind the sand so the roots are covered)
// and seabed.png (sand dunes with ripples, rocks, shells, starfish). All periodic functions use whole cycles
// per tile, so the seams do not show.
const SB = T.SEABED, FL = T.FLORA, FA = T.FAR, TAU = Math.PI * 2, TW = SB.cols;
const per = (x, k, ph) => Math.sin(TAU * k * x / TW + ph);
const surf = x => 18 + 2.4 * per(x, 2, 0.3) + 1.7 * per(x, 5, 1.7) + 0.9 * per(x, 11, 0.4);        // sand surface row in seabed.png
const farSurf = x => 42 + 2.6 * per(x, 3, 0.9) + 1.8 * per(x, 7, 2.1) + 0.9 * per(x, 13, 1.1);     // distant hills row in far.png
const wrapX = x => ((x % TW) + TW) % TW;
const dim = (c, t) => lchMix(c, '#12537f', t);                                                       // shift a colour towards the deep water

function seabedImg() {
    const W = SB.cols, H = SB.rows, g = mk(W, H);
    for (let x = 0; x < W; x++) {
        const n = Math.round(surf(x));
        for (let y = n; y < H; y++) {
            const d = y - n, dith = BAYER[y & 3][x & 3] / 16;
            g[y][x] = d === 0 ? 'h' : d === 1 ? 'a' : (d < 4 ? (dith < 0.5 ? 'a' : 'b') : d < 9 ? (dith < 0.4 ? 'b' : 'c') : (dith < 0.45 ? 'c' : 'e'));
        }
        // sand ripples: short light dashes following the dune, in shallow bands
        for (const [off, ph] of [[3, 0.0], [6, 2.1], [10, 4.0], [15, 1.3]]) {
            const y = n + off + Math.round(Math.sin(x * 0.07 + ph) * 0.8);
            if (y < H && Math.sin(x * 0.19 + ph * 3 + off) > 0.35) g[y][x] = off < 8 ? 'r' : 's';
        }
    }
    const surfaceY = x => Math.round(surf(wrapX(x)));
    // rocks: rounded domes sitting in the sand, lit from the top-left
    const rock = (x0, w, h, moss) => {
        const base = surfaceY(x0 + w / 2) + 2;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const u = (i + 0.5) / w * 2 - 1, v = 1 - (j + 0.5) / h;
            const edge = Math.sqrt(Math.max(0, 1 - u * u));
            if (v > edge * (0.85 + 0.15 * Math.sin(i * 1.7 + w))) continue;
            const x = wrapX(x0 + i), y = base - (h - 1 - j) - 0;
            const lit = -u * 0.55 + v * 0.8;
            let ch = lit > 0.62 ? 'M' : lit > 0.18 ? 'm' : lit > -0.35 ? 'k' : 'K';
            if (moss && v > 0.55 && Math.sin(i * 2.1 + w) > -0.2) ch = lit > 0.4 ? 'G' : 'g';
            if (y >= 0 && y < H) g[y][x] = ch;
        }
        // outline the dome
        for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
            const x = wrapX(x0 + i), y = base - (h - 1 - j);
            if (y < 0 || y >= H || !'MmkKGg'.includes(g[y][x] || '.')) continue;
        }
    };
    rock(58, 30, 15, true); rock(80, 16, 9, false); rock(210, 38, 18, true); rock(246, 18, 9, false); rock(398, 24, 12, true); rock(520, 34, 16, true); rock(548, 14, 8, false); rock(330, 12, 6, false); rock(120, 10, 5, false);
    // pebbles, shells, starfish on the near dune
    for (const x of [14, 31, 47, 99, 118, 139, 171, 184, 233, 291, 322, 350, 377, 433, 468, 497, 563, 585]) {
        const y = surfaceY(x) + 3 + (x % 4);
        g[y][x] = 'p'; g[y][wrapX(x + 1)] = 'P'; if (x % 2) g[y + 1][x] = 'c';
    }
    const shell = x => { const y = surfaceY(x) + 2; for (const [dx, dy, ch] of [[0, 0, 'Q'], [1, 0, 'Q'], [2, 0, 'q'], [0, 1, 'q'], [1, 1, 'Q'], [1, -1, 'Q']]) g[y + dy][wrapX(x + dx)] = ch; };
    [160, 302, 458, 556].forEach(shell);
    const star = (x, c1, c2) => {
        const y = surfaceY(x) + 3;
        for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [-2, 2], [2, 2]]) g[y + dy][wrapX(x + dx)] = (dx + dy < 0 && dx < 1) ? c1 : c2;
        g[y][wrapX(x)] = 'Y';
    };
    star(130, 'T', 't'); star(340, 'T', 't'); star(505, 'T', 't');
    const pal = {
        h: hex('#b9cdb2'), a: hex('#9dbda7'), b: hex('#7ca4a2'), c: hex('#5e8c95'), e: hex('#44708b'), r: hex('#c9dbbd'), s: hex('#6d9aa0'),
        p: hex('#cbd9c6'), P: hex('#8fb2a2'), M: hex('#9cb3b7'), m: hex('#738f9a'), k: hex('#516d7f'), K: hex('#3a5568'),
        G: hex('#5f9a7c'), g: hex('#3f7a67'), Q: hex('#f0e2d2'), q: hex('#d9a49e'), T: hex('#f09a62'), t: hex('#c8683f'), Y: hex('#ffd9a0')
    };
    outlineSolid(g, ch => 'MmkKGg'.includes(ch), 'u');
    pal.u = hex('#2c4458');
    return render(g, pal);
}
// outline only the cells of one family (rocks): transparent -> not needed (they sit in sand), so darken the edge instead
function outlineSolid(g, fam, ch) {
    const H = g.length, W = g[0].length, add = [];
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
        if (fam(g[y][x])) continue;
        const n = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => fam(g[y + dy][wrapX(x + dx)] || '.'));
        if (n.length && !'ph'.includes(g[y][x]) && fam(g[y + 1][x])) continue;
        if (n.length && g[y][x] !== '.') add.push([x, y]);
    }
    for (const [x, y] of add) if (!'ph'.includes(g[y][x])) g[y][x] = ch;
}

// flora: drawn on a canvas as tall as FL.rows; roots sit on the sand surface (and are covered by seabed.png)
function floraImg() {
    const W = FL.cols, H = FL.rows, g = mk(W, H);
    const rootY = x => H - SB.rows + Math.round(surf(wrapX(x))) + 2;
    const P = (x, y, ch) => { x = wrapX(Math.round(x)); y = Math.round(y); if (y >= 0 && y < H) g[y][x] = ch; };
    // kelp: a wavy stem with alternating leaf blades
    const kelp = (x0, h, amp, ph, tones) => {
        const [st, lf, lh] = tones, y0 = rootY(x0);
        let sx = x0;
        for (let j = 0; j < h; j++) {
            const nx = x0 + Math.sin(j * 0.085 + ph) * amp * Math.min(1, j / 20);
            const x = Math.round(nx);
            if (x !== sx) P(sx, y0 - j, st);
            P(x, y0 - j, st); if (j < h * 0.35) P(x + 1, y0 - j, st);
            sx = x;
            if (j > 8 && j % 7 === 3 && j < h - 4) {
                const dir = ((j / 7) | 0) % 2 ? 1 : -1, len = 3 + Math.round(2 * Math.sin(j * 0.13 + ph) + 1.5 * (1 - j / h));
                for (let k = 1; k <= len; k++) { P(x + dir * k, y0 - j - (k >> 1), k % 2 ? lf : lh); P(x + dir * k, y0 - j - (k >> 1) + 1, lf); }
                P(x + dir * (len + 1), y0 - j - ((len + 1) >> 1), lh);
            }
        }
        P(sx, y0 - h, lh); P(sx, y0 - h - 1, lh);
    };
    const KT = [['#1f7a63', '#37ad86', '#72dcab'], ['#1d6e6e', '#2fa0a0', '#66d2c8'], ['#3b7a3c', '#68b052', '#a4dc72']];
    const kc = c => c.map(h => hex(h));
    const kelpList = [[28, 104, 5, 0.3, 0], [34, 78, 4, 1.4, 1], [41, 60, 4, 2.2, 0], [150, 96, 5, 4.0, 1], [157, 70, 4, 5.1, 0], [236, 108, 6, 2.7, 0], [244, 84, 5, 0.9, 2], [252, 52, 4, 3.3, 1],
                      [330, 88, 5, 1.1, 1], [338, 64, 4, 2.9, 0], [415, 100, 5, 5.5, 0], [423, 72, 4, 0.2, 2], [492, 94, 5, 3.6, 1], [500, 58, 4, 4.4, 0], [575, 80, 5, 1.9, 0]];
    for (const [x, h, a, ph, t] of kelpList) kelp(x, h, a, ph, KT[t]);
    // sea-grass tufts: curved blades
    const grass = (x0, n, h, c1, c2) => {
        const y0 = rootY(x0);
        for (let b = 0; b < n; b++) {
            const lean = (b - (n - 1) / 2) * 0.9, hh = h - Math.abs(b - (n - 1) / 2) * 3 + (b % 2) * 2;
            let px = x0 + b - (n >> 1);
            for (let j = 0; j < hh; j++) {
                const x = Math.round(x0 + b - (n >> 1) + lean * Math.pow(j / hh, 1.4) * 2 + Math.sin(j * 0.2 + b) * 0.8);
                if (x !== px) P(px, y0 - j, c1);
                P(x, y0 - j, j > hh * 0.75 ? c2 : c1); px = x;
            }
        }
    };
    [[12, 5, 22, 'G1', 'G2'], [92, 6, 26, 'G1', 'G2'], [180, 5, 20, 'G3', 'G2'], [286, 6, 24, 'G1', 'G2'], [372, 5, 21, 'G3', 'G2'], [452, 6, 25, 'G1', 'G2'], [540, 5, 20, 'G3', 'G2'], [598, 4, 18, 'G1', 'G2']].forEach(a => grass(...a));
    // staghorn coral: recursive branches
    const stag = (x0, h, c1, c2, seed) => {
        const y0 = rootY(x0);
        const br = (x, y, dx, dy, len, depth) => {
            for (let i = 0; i < len; i++) { x += dx; y += dy; P(x, y, depth > 1 ? c1 : c2); if (depth <= 1 || i % 2) P(x + 1, y, c1); }
            if (depth > 0 && len > 2) { br(x, y, dx - 0.55, dy, Math.round(len * 0.72), depth - 1); br(x, y, dx + 0.55, dy, Math.round(len * 0.7), depth - 1); }
            else P(x, y - 1, c2);
        };
        br(x0, y0, 0, -1, h, 3);
    };
    stag(112, 13, 'C1', 'C2'); stag(268, 15, 'C3', 'C4'); stag(396, 13, 'C1', 'C2'); stag(520, 14, 'C3', 'C4'); stag(52, 11, 'C3', 'C4'); stag(200, 11, 'C1', 'C2');
    // fan coral (sea fan): a mesh in an arc on a short stalk
    const fan = (x0, r, c1, c2) => {
        const y0 = rootY(x0);
        for (let j = 0; j < 5; j++) P(x0, y0 - j, c1);
        for (let j = 0; j < r * 2; j++) for (let i = -r; i <= r; i++) {
            const yy = j - 0, d = Math.hypot(i, (j - r) * 1.0);
            if (d > r || (j < r && false)) continue;
            if ((i & 1) === 0 || j % 4 === 0) P(x0 + i, y0 - 5 - j * 0.9, (j % 4 === 0 || i === 0) ? c2 : c1);
        }
    };
    fan(72, 13, 'F1', 'F2'); fan(322, 12, 'F3', 'F4'); fan(470, 13, 'F1', 'F2'); fan(585, 10, 'F3', 'F4');
    // brain coral domes
    const brain = (x0, w, h, c1, c2, c3) => {
        const y0 = rootY(x0) + 1;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const u = (i + 0.5) / w * 2 - 1, v = 1 - (j + 0.5) / h;
            if (v > Math.sqrt(Math.max(0, 1 - u * u))) continue;
            const lit = -u * 0.5 + v * 0.8, maze = Math.sin(i * 1.3 + Math.sin(j * 0.9) * 2) > 0.45;
            P(x0 + i, y0 - (h - 1 - j), maze ? c3 : (lit > 0.35 ? c1 : c2));
        }
    };
    brain(168, 18, 11, 'B1', 'B2', 'B3'); brain(432, 21, 12, 'B1', 'B2', 'B3'); brain(7, 14, 9, 'B1', 'B2', 'B3'); brain(298, 14, 8, 'B1', 'B2', 'B3');
    // tube sponges: little clusters
    const tubes = (x0, list, c1, c2, c3) => {
        const y0 = rootY(x0);
        list.forEach(([dx, h], i) => { for (let j = 0; j < h; j++) { P(x0 + dx, y0 - j, c1); P(x0 + dx + 1, y0 - j, c2); } P(x0 + dx, y0 - h, c3); P(x0 + dx + 1, y0 - h, c3); });
    };
    tubes(130, [[0, 11], [3, 17], [6, 8], [9, 12]], 'S1', 'S2', 'S3'); tubes(358, [[0, 14], [3, 8], [-3, 10], [6, 12]], 'S4', 'S5', 'S6'); tubes(560, [[0, 12], [3, 18], [6, 9]], 'S1', 'S2', 'S3');
    const col = {
        G1: '#2b8e70', G2: '#5cc79b', G3: '#3f8a4a', C1: '#e0728f', C2: '#ffb0b4', C3: '#a56fcc', C4: '#d3a8ee',
        F1: '#d2563f', F2: '#f58a5a', F3: '#c04a86', F4: '#e888c0', B1: '#c8c46a', B2: '#8f9f4a', B3: '#657a3c',
        S1: '#e8a04a', S2: '#c1762f', S3: '#6b3a22', S4: '#8c6cd0', S5: '#6648a4', S6: '#2e2058'
    };
    const pal = {}; for (const k in col) pal[k] = hex(col[k]);
    KT.forEach(t => { pal[t[0]] = hex(t[0]); pal[t[1]] = hex(t[1]); pal[t[2]] = hex(t[2]); });
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

// far layer: distant hills, hazy rocks and a few tall silhouettes of kelp, all pulled towards the water colour
function farImg() {
    const W = FA.cols, H = FA.rows, g = mk(W, H);
    for (let x = 0; x < W; x++) {
        const n = Math.round(farSurf(x));
        for (let y = n; y < H; y++) g[y][x] = y === n ? 'u' : (y < n + 4 ? 'v' : 'z');
    }
    const rockF = (x0, w, h) => { const base = Math.round(farSurf(x0 + w / 2)) + 1; for (let j = 0; j < h; j++) { const hw = w / 2 * Math.sqrt(1 - Math.pow(j / h, 2)); for (let x = Math.ceil(w / 2 - hw); x <= Math.floor(w / 2 + hw); x++) g[base - j][wrapX(x0 + x)] = (j > h - 3 || x < w * 0.4) ? 'r' : 'q'; } };
    rockF(48, 26, 11); rockF(66, 14, 16); rockF(300, 30, 12); rockF(330, 14, 8); rockF(480, 22, 10);
    const weed = (x0, h, ph) => { const y0 = Math.round(farSurf(x0)) + 1; for (let j = 0; j < h; j++) { const x = x0 + Math.round(Math.sin(j * 0.12 + ph) * 3); g[y0 - j][wrapX(x)] = 'w'; if (j % 6 === 2 && j > 6) { g[y0 - j][wrapX(x + 1)] = 'w'; g[y0 - j][wrapX(x + 2)] = 'w'; g[y0 - j - 1][wrapX(x + 3)] = 'w'; } if (j % 6 === 5 && j > 6) { g[y0 - j][wrapX(x - 1)] = 'w'; g[y0 - j][wrapX(x - 2)] = 'w'; g[y0 - j - 1][wrapX(x - 3)] = 'w'; } } };
    [[100, 34, 0.2], [108, 24, 1.4], [188, 38, 2.5], [260, 30, 3.7], [268, 22, 0.8], [372, 36, 5.0], [440, 32, 1.9], [510, 38, 4.1], [20, 28, 3.0]].forEach(a => weed(...a));
    const pal = { u: hex(dim('#4a9bb8', 0.55)), v: hex(dim('#3a86a6', 0.62)), z: hex(dim('#2c6f93', 0.62)), r: hex(dim('#4f93b0', 0.58)), q: hex(dim('#356f93', 0.62)), w: hex(dim('#2d8a94', 0.6)) };
    return render(g, pal);
}
// light shaft 40x150: a leaning bar of light, dithered in 3 alpha steps, wider and fainter with depth
function shaftImg() {
    const W = T.SHAFT.cols, H = T.SHAFT.rows, px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
        const t = y / H, lean = y * 0.11, half = 5 + t * 12;
        for (let x = 0; x < W; x++) {
            const d = Math.abs(x - (6 + lean + half)) / half;
            if (d >= 1) continue;
            const strength = Math.pow(1 - d * d, 1.3) * Math.pow(1 - t, 1.6);
            const lvl = Math.min(3, Math.floor(strength * 3.2 + (BAYER[y & 3][x & 3] / 16) * (0.3 + 0.7 * (1 - t))));
            if (!lvl) continue;
            const o = (y * W + x) * 4, a = [0, 0.3, 0.55, 0.85][lvl];
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
    for (const a of [4, 3, 2, 1, 0]) for (const v of ['coral', 'amber', 'lemon', 'aqua', 'orchid', 'red', 'alarm', 'aqua-w2']) if (a >= 3 || ['coral', 'aqua', 'red'].includes(v)) rows.push(row('fish', a, v));
    for (const a of [1, 0]) rows.push(row('orca', a, ''));
    for (const a of [1, 0]) rows.push(row('angler', a, ''));
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
