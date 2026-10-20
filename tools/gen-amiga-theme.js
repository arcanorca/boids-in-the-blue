// Generates the "amiga" theme's textures (contents/themes/amiga/img/*.png), the 8x contact sheet
// and the preview. Everything is authored here as hand-placed cell grids / profiles shaded with
// DPaint-style tricks (dark outline, 3-4 tone ramps, checkerboard dither between tones), in the
// constraints of the OCS/ECS chipset:
//   * every colour of every texture is 12-bit (channels are multiples of 0x11) - asserted below
//   * copper gradients: one colour per scanline, ordered dither between adjacent 12-bit levels
//   * colour cycling: the water light shafts are 6 pre-rendered palette-rotation frames
// Dimensions, frame counts and anchors come from contents/themes/amiga/theme.js.
//   node tools/gen-amiga-theme.js [--check] [--sheet <out.png>]
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const png = require('../tests/png');
const { loadScript } = require('../tests/harness');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'contents', 'themes', 'amiga', 'img');
const T = loadScript(path.join(ROOT, 'contents', 'themes', 'amiga', 'theme.js'));

// ── colour: 12-bit only ──────────────────────────────────────
const C = s => { if (!/^#[0-9a-f]{3}$/i.test(s)) throw new Error('not a 12-bit colour: ' + s); return [1, 2, 3].map(i => parseInt(s[i], 16) * 17).concat(255); };
const snap = v => Math.max(0, Math.min(15, Math.round(v / 17)));
const to12 = hex6 => '#' + [1, 3, 5].map(i => snap(parseInt(hex6.substr(i, 2), 16)).toString(16)).join('');

// ── grid helpers ─────────────────────────────────────────────
const mk = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
function put(g, x, y, ch) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; }
function get(g, x, y) { return (y >= 0 && y < g.length && x >= 0 && x < g[0].length) ? g[y][x] : '.'; }
function ascii(g, rows, ox, oy) {            // '.' = leave, '~' = erase
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, (ox || 0) + i, (oy || 0) + j, ch === '~' ? '.' : ch); }));
}
function pts(g, ch, list) { for (const [x, y] of list) put(g, x, y, ch); }
// 4-neighbour outline: transparent cells next to a solid one become 'o'; on the lit top edge 'q' (softer)
function outline(g, solidFn, o, q) {
    const H = g.length, W = g[0].length, add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (g[y][x] !== '.') continue;
        const n = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => get(g, x + dx, y + dy));
        if (n.some(c => c !== '.' && solidFn(c))) {
            const below = n[0];
            add.push([x, y, (below !== '.' && solidFn(below) && n[1] === '.') ? (q || 'q') : (o || 'o')]);
        }
    }
    for (const [x, y, c] of add) g[y][x] = c;
}
function render(g, pal) {
    const H = g.length, W = g[0].length, px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = g[y][x];
        if (ch === '.') continue;
        const c = pal[ch];
        if (!c) throw new Error('no colour for "' + ch + '" at ' + x + ',' + y);
        px.set(c, (y * W + x) * 4);
    }
    return { W, H, px };
}
const mkPal = o => { const p = {}; for (const k in o) p[k] = C(o[k]); return p; };
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const chk = (x, y) => (x + y) & 1;                         // checkerboard dither
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// opaque RGB PNG (Qt loads it as an opaque image: no blending for the full-screen copper)
function encodeRGB(W, H, px) {
    const raw = Buffer.alloc((W * 3 + 1) * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = (y * W + x) * 4, d = y * (W * 3 + 1) + 1 + x * 3;
        raw[d] = px[s]; raw[d + 1] = px[s + 1]; raw[d + 2] = px[s + 2];
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, c]);
    };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// OKLCH mixing for the stress "flush" ramps (a plain RGB blend of aqua and red goes muddy), snapped to 12-bit
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const unlin = v => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
function toLch(c) {
    const [r, g, b] = [1, 2, 3].map(i => lin(parseInt(c[i], 16) * 17));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function fromLch([L, Cc, H]) {
    const A = Cc * Math.cos(H), B = Cc * Math.sin(H);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return to12('#' + [r, g, b].map(v => unlin(v).toString(16).padStart(2, '0')).join(''));
}
const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function lchMix(c1, c2, t, ref) {
    const a = toLch(c1), b = toLch(c2);
    let dh = wrap(b[2] - a[2]);
    if (ref !== undefined) dh += 2 * Math.PI * Math.round((ref - dh) / (2 * Math.PI));
    return fromLch([a[0] + (b[0] - a[0]) * t, Math.max(a[1], 0.02) + (b[1] - Math.max(a[1], 0.02)) * t, a[2] + dh * t]);
}

// ── FISH ─────────────────────────────────────────────────────
// Faces right. o outline, q soft outline (lit top edge), l/h light + specular, b base, w belly, d shade,
// f/g fin + light fin, p marking, e/k eye.
const FISH_PAL = {
    coral:  { o: '#412', q: '#824', d: '#b35', b: '#f66', l: '#f99', h: '#fdc', w: '#fcb', f: '#d45', g: '#f78', p: '#c34' },
    amber:  { o: '#421', q: '#843', d: '#c62', b: '#fa3', l: '#fd5', h: '#ffb', w: '#fe9', f: '#e83', g: '#fc5', p: '#d51' },
    lemon:  { o: '#231', q: '#463', d: '#7a3', b: '#dd5', l: '#ff8', h: '#ffd', w: '#ffb', f: '#9b4', g: '#cd5', p: '#8a2' },
    aqua:   { o: '#025', q: '#148', d: '#28b', b: '#4cd', l: '#8ef', h: '#cff', w: '#bff', f: '#39c', g: '#6de', p: '#17a' },
    orchid: { o: '#314', q: '#538', d: '#76b', b: '#b8e', l: '#dbf', h: '#fef', w: '#edf', f: '#96d', g: '#c9f', p: '#85c' },
    red:    { o: '#300', q: '#611', d: '#922', b: '#d33', l: '#f66', h: '#faa', w: '#f98', f: '#b22', g: '#e44', p: '#a11' },
    alarm:  { o: '#200', q: '#711', d: '#c11', b: '#f33', l: '#f88', h: '#fff', w: '#fdc', f: '#d00', g: '#f55', p: '#c00' }
};
{   // stress flush ramps: base mixed 1/3 and 2/3 towards red, per tone
    for (const c of T.FISH_BASE) for (let k = 1; k < T.STRESS_STEPS; k++) {
        const ref = wrap(toLch(FISH_PAL.red.b)[2] - toLch(FISH_PAL[c].b)[2]), out = {};
        for (const t in FISH_PAL[c]) out[t] = (t === 'o' || t === 'q') ? lchMix(FISH_PAL[c][t], FISH_PAL.red[t], k / T.STRESS_STEPS, ref) : lchMix(FISH_PAL[c][t], FISH_PAL.red[t], k / T.STRESS_STEPS, ref);
        FISH_PAL[c + '-w' + k] = out;
    }
}
// body column profiles shaded DPaint style: l crown, b flank, w belly, d keel, checker dither at tone borders
function shadeBody(g, x0, tops, bots, spec) {
    tops.forEach((t, i) => {
        const b = bots[i], n = b - t + 1, x = x0 + i;
        for (let y = t; y <= b; y++) {
            const r = n > 1 ? (y - t) / (n - 1) : 0;
            let ch;
            if (n === 1) ch = 'b';
            else if (n === 2) ch = y === t ? 'l' : 'b';
            else if (y === t) ch = 'l';
            else if (y === b && n >= 4) ch = 'd';
            else if (r < 0.3) ch = (y === t + 1 && chk(x, y)) ? 'l' : 'b';
            else if (r < 0.5) ch = 'b';
            else if (r < 0.62) ch = chk(x, y) ? 'w' : 'b';
            else ch = 'w';
            if (y === b - 1 && n >= 5 && chk(x, y)) ch = 'd';
            put(g, x, y, ch);
        }
    });
    for (const [x, y] of spec || []) if (get(g, x, y) === 'l') put(g, x, y, 'h');
}
function tailCols(g, cols, dy) {             // cols: [[x, y0, y1], ...]; the outermost column swings with the beat
    cols.forEach(([x, y0, y1], i) => {
        const sh = i === 0 ? dy : 0;
        for (let y = y0; y <= y1; y++) put(g, x, y + sh, (y === y0 && y1 - y0 > 1) ? 'g' : 'f');
    });
}
// per class: interior size, body x0/tops/bots, tail columns, fins/eye/marks (interior coords); final = interior + 1 each side
const FISH_CLASS = [
    { W: 4, H: 3, body: [1, [0, 0, 0], [2, 2, 2]], tail: [[0, 1, 1]], spec: [], eye: [[3, 1, 'k']], extra: [], gill: [], marks: {} },
    { W: 7, H: 5, body: [2, [2, 1, 1, 1, 2], [2, 3, 3, 3, 3]], tail: [[0, 1, 3], [1, 2, 2]], spec: [[4, 1]],
      eye: [[5, 2, 'k']], extra: [[3, 0, 'f'], [4, 0, 'g'], [4, 4, 'f']], gill: [],
      marks: { coral: [[3, 2]], amber: [[3, 2]], lemon: [[3, 2]], aqua: [[4, 1, 'h']], orchid: [[3, 2, 'h']] } },
    { W: 10, H: 7, body: [2, [3, 2, 1, 1, 1, 1, 2, 3], [3, 4, 5, 5, 5, 5, 4, 4]], tail: [[0, 1, 5], [1, 2, 4]], spec: [[5, 1], [6, 1]],
      eye: [[7, 2, 'e'], [8, 2, 'k']], extra: [[4, 0, 'f'], [5, 0, 'g'], [5, 6, 'f'], [5, 4, 'f'], [6, 4, 'g'], [6, 3, 'f'], [9, 4, 'd']], gill: [[6, 2], [6, 3]],
      marks: { coral: [[4, 2], [4, 3], [4, 4]], amber: [[4, 3], [6, 4], [5, 2]], lemon: [[4, 3], [5, 3]], aqua: [[4, 2, 'h'], [5, 2, 'h']], orchid: [[4, 4, 'h'], [6, 5, 'h']] } },
    { W: 13, H: 8, body: [3, [3, 2, 1, 1, 1, 1, 1, 1, 2, 3], [4, 5, 6, 6, 6, 6, 6, 5, 5, 4]], tail: [[0, 1, 6], [1, 2, 5], [2, 3, 4]], spec: [[7, 1], [8, 1]],
      eye: [[10, 3, 'e'], [11, 3, 'k']], extra: [[5, 0, 'f'], [6, 0, 'g'], [7, 0, 'f'], [8, 0, 'f'], [6, 7, 'f'], [7, 7, 'f'], [7, 4, 'f'], [8, 4, 'g'], [7, 5, 'f'], [8, 5, 'f'], [12, 4, 'd']], gill: [[9, 3], [9, 4], [9, 5]],
      marks: { coral: [[6, 2], [6, 3], [6, 4], [7, 5], [7, 2]], amber: [[6, 3], [8, 2], [5, 5], [9, 5], [7, 3]], lemon: [[5, 3], [6, 3], [7, 3], [8, 3]], aqua: [[5, 2, 'h'], [6, 2, 'h'], [7, 2, 'h'], [8, 2, 'h']], orchid: [[6, 3, 'h'], [8, 2, 'h'], [7, 5, 'h'], [5, 4, 'h']] } }
];
function fishFrame(cls, variant, frame) {
    const c = FISH_CLASS[cls], g = mk(c.W, c.H), base = variant.replace(/-w\d$/, '');
    shadeBody(g, c.body[0], c.body[1], c.body[2], c.spec);
    for (const [x, y, ch] of c.extra) put(g, x, y, ch);
    for (const [x, y] of c.gill) if (get(g, x, y) !== '.') put(g, x, y, 'd');
    const mk2 = c.marks[T.FISH_BASE.includes(base) ? base : 'coral'] || [];
    for (const [x, y, ch] of mk2) if ('bwl'.includes(get(g, x, y))) put(g, x, y, ch || 'p');
    if (cls === 0) { put(g, 0, [1, 0, 1, 2][frame], 'f'); }
    else tailCols(g, c.tail, [0, -1, 0, 1][frame]);
    // fin flutter on the odd beat
    if (frame === 2 && cls >= 2) { const px = cls === 3 ? 7 : 5, py = cls === 3 ? 5 : 4; put(g, px, py + 1, 'f'); }
    for (const [x, y, ch] of c.eye) put(g, x, y, ch);
    // final grid = interior + 1px border for the outline
    const fin = mk(c.W + 2, c.H + 2);
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) fin[y + 1][x + 1] = g[y][x];
    outline(fin, () => true);
    const p = FISH_PAL[variant], pal = { e: C('#fff'), k: C('#102') };
    for (const k in p) pal[k] = C(p[k]);
    return render(fin, pal);
}

// ── ORCA ─────────────────────────────────────────────────────
// 26x13, faces LEFT (the simulation's orca flag is inverted, same as the other themes).
const ORCA_PAL = mkPal({ K: '#124', s: '#347', W: '#fff', w: '#9bd', g: '#68a', o: '#001', q: '#235', E: '#001', e: '#fff', m: '#236' });
function orcaFrame(frame) {
    const W = 24, H = 11, g = mk(W, H);
    const top = [6, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 5, 5];
    const bot = [7, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8, 8, 7, 7, 6, 6, 6, 6];
    const P = (x, y, ch) => put(g, x, y, ch);
    for (let x = 0; x < 20; x++) for (let y = top[x]; y <= bot[x]; y++) P(x, y, 'K');
    // dorsal fin, swept back
    for (const [y, x0, x1] of [[0, 15, 16], [1, 14, 16], [2, 13, 16]]) for (let x = x0; x <= x1; x++) P(x, y, 'K');
    pts(g, 's', [[15, 0], [14, 1], [13, 2]]);
    // sheen along the back (dithered)
    for (let x = 4; x <= 13; x++) if (get(g, x, top[x] + 1) === 'K' && (x + frame * 0) % 2 === 0) P(x, top[x] + 1, 's');
    for (let x = 17; x <= 19; x++) if (get(g, x, top[x] + 1) === 'K') P(x, top[x] + 1, 's');
    // white belly with a dithered edge, chin
    for (let x = 1; x <= 17; x++) {
        const b = bot[x], d = x < 4 ? 1 : 2;
        for (let y = b - d; y <= b; y++) if (get(g, x, y) === 'K') P(x, y, (y === b - d && chk(x, y)) ? 'K' : ((y === b && x > 10) ? 'w' : 'W'));
    }
    pts(g, 'W', [[0, 7], [1, 7], [1, 8]]);
    pts(g, 'o', [[0, 7], [1, 7], [2, 7]]);                 // mouth line
    // eye patch + eye
    pts(g, 'W', [[5, 4], [6, 4], [7, 4], [6, 3]]); pts(g, 'w', [[7, 5]]);
    pts(g, 'E', [[4, 5], [5, 5]]); pts(g, 'e', [[5, 4]]);
    // grey saddle behind the dorsal fin
    pts(g, 'g', [[17, 3], [18, 3], [18, 4], [19, 4]]);
    // pectoral flipper, flexes with the beat
    const fl = frame % 2 === 0 ? [[7, 9], [8, 9], [7, 10], [8, 10], [9, 10]] : [[7, 9], [8, 9], [8, 10], [9, 10], [9, 9]];
    for (const [x, y] of fl) P(x, y, 'K');
    P(8, 9, 's');
    // tail flukes: sheared by the beat
    const dy = [0, -1, 0, 1][frame];
    const FL = [[20, 5], [20, 6], [21, 4], [21, 5], [21, 6], [21, 7], [22, 2], [22, 3], [22, 4], [22, 5], [22, 7], [22, 8], [22, 9], [23, 1], [23, 2], [23, 3], [23, 8], [23, 9], [23, 10]];
    for (const [x, y] of FL) P(x, y + Math.round(dy * (x - 19) / 4), 'K');
    pts(g, 's', FL.filter(([x, y]) => y <= 3).map(([x, y]) => [x, y + Math.round(dy * (x - 19) / 4)]));
    const fin = mk(W + 2, H + 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fin[y + 1][x + 1] = g[y][x];
    outline(fin, () => true);
    return render(fin, ORCA_PAL);
}

// ── ANGLER ───────────────────────────────────────────────────
// 15x12, faces right; the stalk ends at theme.js LURE[frame] (the bulb itself is an overlay, see lureImg).
const ANG_PAL = mkPal({ b: '#527', l: '#83a', d: '#315', s: '#a6c', f: '#639', F: '#85b', m: '#412', w: '#ffe', e: '#fd4', k: '#102', a: '#b8d', o: '#102', q: '#325', t: '#c9e' });
function anglerFrame(frame) {
    const W = 13, H = 10, g = mk(W, H);
    const x0 = 3, top = [5, 4, 3, 3, 3, 3, 3, 4, 4, 5], bot = [7, 8, 8, 8, 8, 8, 8, 8, 7, 7];
    top.forEach((t, i) => { for (let y = t; y <= bot[i]; y++) put(g, x0 + i, y, 'b'); });
    // rim light, keel shade, bioluminescent speckles
    top.forEach((t, i) => { const x = x0 + i; put(g, x, t, 'l'); if (i > 1 && i < 7 && chk(x, t + 1)) put(g, x, t + 1, 'l'); put(g, x, bot[i], 'd'); if (chk(x, bot[i] - 1) && i > 0) put(g, x, bot[i] - 1, 'd'); });
    pts(g, 's', [[5, 5], [7, 4], [8, 6], [6, 7], [4, 6], [9, 7]]);
    // mouth: wide, up-curved, a row of teeth
    for (let x = 8; x <= 12; x++) { put(g, x, 6, 'm'); put(g, x, 7, 'm'); }
    pts(g, 'w', [[9, 6], [11, 6], [10, 7], [12, 7]]);
    pts(g, 'b', [[12, 5]]);
    // eye: glowing, with a pupil
    pts(g, 'e', [[9, 4], [10, 4], [9, 5], [10, 5]]); pts(g, 'k', [[10, 4], [10, 5]]);
    // fins
    pts(g, 'f', [[6, 9], [7, 9], [5, 8]]); pts(g, 'F', [[6, 9]]);
    pts(g, 'f', [[5, 2], [6, 2], [7, 2]]); pts(g, 'F', [[6, 2]]);
    // tail fan, tilts with the beat
    const dy = [0, -1, 0, 1][frame];
    for (const [x, y] of [[0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [1, 5], [1, 6], [1, 7], [1, 8], [2, 6], [2, 7]]) put(g, x, y + (x === 0 ? dy : 0), (x + y) % 2 ? 'f' : 'F');
    // stalk from the brow up and forward to the lure (interior coords = final - 1)
    const L = T.LURE[frame], p0 = [6, 3], p1 = [7, -2 + dy], p2 = [L.x - 2, L.y - 1];
    for (let i = 0; i <= 20; i++) { const t = i / 20, u = 1 - t; put(g, Math.round(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), Math.round(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]), 'a'); }
    const fin = mk(W + 2, H + 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fin[y + 1][x + 1] = g[y][x];
    outline(fin, c => c !== 'e' && c !== 'a');
    return render(fin, ANG_PAL);
}
// lure bulb overlay (3x3, centred): 0 dim, 1 lit, 2 flare (white core, yellow ring, rays)
function lureImg(level) {
    const g = mk(3, 3);
    const A = [['.o.', 'ooo', '.o.'], ['.o.', 'oco', '.o.'], ['hoh', 'oco', 'hoh']][level];
    ascii(g, A);
    const pal = [{ o: C('#a60'), c: C('#fc4') }, { o: C('#fb2'), c: C('#ffb') }, { o: C('#fd4'), c: C('#fff'), h: C('#fe9') }][level];
    return render(g, pal);
}
// newborn sparkle (5x5 four-point star)
function sparkImg() {
    const g = mk(5, 5);
    ascii(g, ['..y..', '.yWy.', 'yWWWy', '.yWy.', '..y..']);
    return render(g, mkPal({ y: '#fd6', W: '#fff' }));
}
// stippled glow (17x17): concentric 1-bit-alpha dither rings, like an HAM-free Amiga glow
function glowImg() {
    const S = T.GLOW_SIZE, c = (S - 1) / 2, px = Buffer.alloc(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - c, y - c) / c;
        if (d >= 1) continue;
        const v = Math.pow(1 - d, 1.3) * 2.2, lvl = Math.floor(v);
        const on = lvl >= 2 || (lvl === 1 && chk(x, y)) || (lvl === 0 && v > 0.45 && (x % 2 === 0 && y % 2 === 0));
        if (!on) continue;
        px.set(C(lvl >= 2 ? '#ffb' : '#fc6'), (y * S + x) * 4);
    }
    return { W: S, H: S, px };
}

// ── JELLY ────────────────────────────────────────────────────
// Translucency the Amiga way: opaque rim, checkerboard-dithered body, stippled tentacles.
const JELLY_PAL = mkPal({ r: '#fdf', R: '#fff', b: '#c9f', i: '#a7e', g: '#f8c', a: '#d9e', A: '#fbf', t: '#a7d', f: '#86c', o: '#425' });
function jellyFrame(cls, frame) {
    const K = T.kinds.jelly.classes[cls], W = K.cols, H = K.rows, g = mk(W, H);
    const maxW = W - 2, bh = cls === 0 ? 7 : 9, top = 1, cx = (W - 1) / 2;
    const bw = Math.round(maxW * [1, 0.85, 0.7, 0.85][frame]) | 1;       // odd widths stay symmetric
    const rows = [];
    for (let j = 0; j < bh; j++) {
        const yn = (bh - 1 - j) / (bh - 0.4), hw = (bw / 2) * Math.sqrt(Math.max(0, 1 - yn * yn * 0.96));
        const x0 = Math.ceil(cx - hw + 0.001), x1 = Math.floor(cx + hw - 0.001);
        rows.push([x0, x1]);
        for (let x = x0; x <= x1; x++) put(g, x, top + j, chk(x, top + j) ? 'b' : 'i');
    }
    rows.forEach(([x0, x1], j) => {
        const y = top + j;
        put(g, x0, y, 'r'); put(g, x1, y, 'r');
        if (j === 0) for (let x = x0; x <= x1; x++) put(g, x, y, 'r');
        if (j === bh - 1) for (let x = x0; x <= x1; x++) put(g, x, y, 'r');
    });
    // gonads and a specular glint
    const gy = top + bh - 3;
    pts(g, 'g', [[Math.round(cx) - 1, gy], [Math.round(cx), gy], [Math.round(cx) + 1, gy], [Math.round(cx), gy - 1]]);
    pts(g, 'R', [[rows[1][0] + 2, top + 1], [rows[1][0] + 1, top + 2]]);
    // oral arms + tentacles, sway lags down the length
    const ph = frame * Math.PI / 2, rimY = top + bh, len = H - rimY - 1;
    for (let j = 0; j < len - 3; j++) {
        const sw = Math.round(Math.sin(j * 0.7 - ph) * 0.9);
        put(g, Math.round(cx) + sw, rimY + j, j % 2 ? 'A' : 'a');
    }
    const nT = cls === 0 ? 3 : 4;
    for (let t = 0; t < nT; t++) {
        const bx = Math.round(rows[bh - 1][0] + 1 + t * (rows[bh - 1][1] - rows[bh - 1][0] - 2) / (nT - 1));
        for (let j = 0; j < len; j++) {
            const x = bx + Math.round(Math.sin(j * 0.6 + t * 1.7 - ph) * 1.0) * (j > 0 ? 1 : 0);
            if (j > len * 0.6 && (j + t) % 2) continue;       // thinning, stippled tips
            put(g, x, rimY + j, j > len * 0.6 ? 'f' : 't');
        }
    }
    return render(g, JELLY_PAL);
}

// ── WORM ─────────────────────────────────────────────────────
const WORM_PAL = mkPal({ b: '#f78', l: '#fba', d: '#b45', n: '#fcb', k: '#201', o: '#412', q: '#823' });
function wormFrame(frame) {
    const W = 5, H = 11, g = mk(W + 2, H + 2), ph = frame * Math.PI / 2;
    // two-pixel wide body wriggling down the sprite: ringed segments, lit left edge, bulb head on top
    for (let y = 0; y < H; y++) {
        const amp = 0.5 + Math.min(1.0, y * 0.16), x = 2 + Math.round(Math.sin(y * 0.75 + ph) * amp);
        const seg = (y >> 1) % 2;
        put(g, x + 1, y + 1, seg ? 'd' : 'l'); put(g, x + 2, y + 1, seg ? 'd' : 'b');
        if (y > 1 && y < H - 2) put(g, x + 3, y + 1, 'd');
    }
    const hx = [...g[1]].findIndex(c => c !== '.');
    put(g, hx, 1, 'n'); put(g, hx + 1, 1, 'n'); put(g, hx, 2, 'n');
    put(g, hx + 1, 2, 'k');
    outline(g, () => true);
    return render(g, WORM_PAL);
}

// ── BUBBLE ───────────────────────────────────────────────────
const BUB_PAL = mkPal({ r: '#9df', R: '#dff', H: '#fff', i: '#6bd' });
function bubbleImg(cls) {
    const n = T.kinds.bubble.classes[cls].cols, g = mk(n, n), c = (n - 1) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d <= n / 2 - 0.25 && d > n / 2 - 1.25) g[y][x] = (x <= c && y <= c) ? 'R' : 'r';
        else if (n > 5 && d <= n / 2 - 1.25 && x > c && y > c && d > n / 2 - 2.4 && chk(x, y)) g[y][x] = 'i';   // dithered lower-right glint
    }
    if (n >= 6) { put(g, 1, 2, 'H'); put(g, 2, 1, 'H'); if (n >= 8) put(g, 2, 2, 'H'); } else put(g, 1, 1, 'H');
    return render(g, BUB_PAL);
}

// ── driver ───────────────────────────────────────────────────
function allImages() {
    const out = {};
    for (let cls = 0; cls < T.kinds.fish.classes.length; cls++)
        for (const v of T.allFishVariants()) for (let f = 0; f < T.kinds.fish.frames; f++) out[T.frameFile('fish', cls, v, f)] = fishFrame(cls, v, f);
    for (let f = 0; f < 4; f++) {
        out[T.frameFile('orca', 0, '', f)] = orcaFrame(f);
        out[T.frameFile('angler', 0, '', f)] = anglerFrame(f);
        out[T.frameFile('worm', 0, '', f)] = wormFrame(f);
        for (let c = 0; c < T.kinds.jelly.classes.length; c++) out[T.frameFile('jelly', c, '', f)] = jellyFrame(c, f);
    }
    for (let l = 0; l < 3; l++) out['lure-' + l + '.png'] = lureImg(l);
    out['glow.png'] = glowImg();
    out['spark.png'] = sparkImg();
    for (let c = 0; c < T.kinds.bubble.classes.length; c++) out[T.frameFile('bubble', c, '', 0)] = bubbleImg(c);
    Object.assign(out, require('./amiga-backdrop')({ C, mk, put, get, pts, ascii, render, mkPal, chk, BAYER4, T, encodeRGB, outline, to12 }));
    for (const k in T.kinds) {                            // descriptor sizes must match the art
        T.kinds[k].classes.forEach((cl, i) => {
            const f = out[T.frameFile(k, i, 'coral', 0)];
            if (f.W !== cl.cols || f.H !== cl.rows) throw new Error(k + ' class ' + i + ': art is ' + f.W + 'x' + f.H + ', theme.js says ' + cl.cols + 'x' + cl.rows);
        });
    }
    for (const f in out) {                                // OCS rule: 12-bit colours only
        const im = out[f];
        if (im.encoded) continue;
        for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) for (let k = 0; k < 3; k++) if (im.px[i * 4 + k] % 17) throw new Error(f + ': colour is not 12-bit at texel ' + i);
    }
    return out;
}
const bytesOf = im => im.encoded ? im.encoded : (im.opaque ? encodeRGB(im.W, im.H, im.px) : png.encode(im.W, im.H, im.px));

// contact sheet: every sprite/frame enlarged 8x on a neutral background
function sheet(imgs, file) {
    const S = 8, PAD = 3, BG = [74, 84, 94];
    const rows = [];
    for (let cls = 3; cls >= 0; cls--) for (const v of ['coral', 'amber', 'lemon', 'aqua', 'orchid', 'red', 'alarm', 'aqua-w1', 'aqua-w2']) {
        if (cls < 3 && !['coral', 'aqua', 'red', 'alarm'].includes(v)) continue;
        rows.push([0, 1, 2, 3].map(f => T.frameFile('fish', cls, v, f)));
    }
    rows.push([0, 1, 2, 3].map(f => 'orca-' + f + '.png'));
    rows.push([0, 1, 2, 3].map(f => 'angler-' + f + '.png').concat(['lure-0.png', 'lure-1.png', 'lure-2.png', 'spark.png', 'glow.png']));
    rows.push([0, 1, 2, 3].map(f => T.frameFile('jelly', 0, '', f)).concat([0, 1, 2, 3].map(f => T.frameFile('jelly', 1, '', f))));
    rows.push([0, 1, 2, 3].map(f => 'worm-' + f + '.png').concat([0, 1, 2].map(c => T.frameFile('bubble', c, '', 0))));
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
        if (!fs.existsSync(p) || !fs.readFileSync(p).equals(bytesOf(imgs[f]))) { console.error('stale: ' + f); bad++; }
    }
    if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (!imgs[f]) { console.error('extra: ' + f); bad++; }
    process.exit(bad ? 1 : 0);
}
if (si < 0 || process.argv.includes('--write')) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (!imgs[f]) fs.unlinkSync(path.join(OUT, f));
    let bytes = 0;
    for (const f in imgs) { const b = bytesOf(imgs[f]); fs.writeFileSync(path.join(OUT, f), b); bytes += b.length; }
    console.log(Object.keys(imgs).length + ' images, ' + (bytes / 1024).toFixed(0) + ' KiB -> ' + OUT);
}
