// Generates the "amiga" theme's textures (contents/themes/amiga/img/*.png), the contact sheet and the
// preview. Creatures are hand-placed pixel grids (ASCII below) in the constraints of the OCS/ECS chipset:
//   * every colour of every texture is 12-bit (channels are multiples of 0x11) - asserted below
//   * one art-pixel scale for every sprite (theme.js), light from above (creatures are mirrored when they
//     swim left, so their shading is top-lit and symmetric left/right; scenery is lit from the top left)
//   * outline policy: opaque creatures longer than 7 art px get a 1 px outline in a dark shade of their own
//     hue (softer on the lit top edge); translucent jellies get a bright rim instead; tiny sprites none
//   * the backdrop (tools/amiga-backdrop.js) is static: copper gradient, soft light shafts, seabed, plants
// Dimensions, frame counts and anchors come from contents/themes/amiga/theme.js.
//   node tools/gen-amiga-theme.js [--check] [--sheet <out.png>] [--scale N]
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
const C = (s, a) => { if (!/^#[0-9a-f]{3}$/i.test(s)) throw new Error('not a 12-bit colour: ' + s); return [1, 2, 3].map(i => parseInt(s[i], 16) * 17).concat(a === undefined ? 255 : a); };
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
const mkPal = o => { const p = {}; for (const k in o) p[k] = Array.isArray(o[k]) ? C(o[k][0], o[k][1]) : C(o[k]); return p; };   // value: '#rgb' or ['#rgb', alpha]
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
// f/g fin + light fin, p marking, e/k eye white / pupil.
const FISH_PAL = {
    coral:  { o: '#412', q: '#824', d: '#c44', b: '#f66', l: '#f99', h: '#fdc', w: '#fcb', f: '#d45', g: '#f78', p: '#c34' },
    amber:  { o: '#421', q: '#843', d: '#c62', b: '#fa3', l: '#fd5', h: '#ffb', w: '#fe9', f: '#e83', g: '#fc5', p: '#d51' },
    lemon:  { o: '#231', q: '#463', d: '#8a3', b: '#dd5', l: '#ff8', h: '#ffd', w: '#ffb', f: '#9b4', g: '#cd5', p: '#8a2' },
    aqua:   { o: '#025', q: '#148', d: '#28b', b: '#4cd', l: '#8ef', h: '#cff', w: '#bff', f: '#39c', g: '#6de', p: '#17a' },
    orchid: { o: '#314', q: '#538', d: '#76b', b: '#b8e', l: '#dbf', h: '#fef', w: '#edf', f: '#96d', g: '#c9f', p: '#85c' },
    red:    { o: '#300', q: '#611', d: '#a22', b: '#e33', l: '#f66', h: '#faa', w: '#f98', f: '#b22', g: '#e44', p: '#a11' },
    alarm:  { o: '#200', q: '#711', d: '#c11', b: '#f33', l: '#f88', h: '#fff', w: '#fdc', f: '#d00', g: '#f55', p: '#c00' }
};
{   // stress flush ramps: base mixed 1/3 and 2/3 towards red, per tone
    for (const c of T.FISH_BASE) for (let k = 1; k < T.STRESS_STEPS; k++) {
        const ref = wrap(toLch(FISH_PAL.red.b)[2] - toLch(FISH_PAL[c].b)[2]), out = {};
        for (const t in FISH_PAL[c]) out[t] = lchMix(FISH_PAL[c][t], FISH_PAL.red[t], k / T.STRESS_STEPS, ref);
        FISH_PAL[c + '-w' + k] = out;
    }
}
// Each class: interior grid (outline is added around it for `outline` classes), body rows with the
// tail columns left empty, four tail overlays (x = 0.., rows from `ty`), and per-colour markings.
const MARKS = {
    stripe: c => c.stripe, double: c => c.double, spots: c => c.spots, lat: c => c.lat, dots: c => c.dots
};
const MARK_STYLE = { coral: 'stripe', amber: 'double', lemon: 'spots', aqua: 'lat', orchid: 'dots' };
const FISH_ART = [
    {   // 5x4 newborn, no outline
        outline: false,
        body: ['..lb.', '.bbkb', '.wbbb', '..dd.'],
        ty: 0, tails: [['.', 'f', 'f', '.'], ['f', 'f', '.', '.'], ['.', 'f', 'g', '.'], ['.', '.', 'f', 'f']],
        marks: {}
    },
    {   // 7x5 newborn, no outline
        outline: false,
        body: ['..lll..', '.bbbbkb', '.wbwbbb', '..wwwd.', '...dd..'],
        ty: 0, tails: [['.', 'f', 'f', 'f', '.'], ['f', 'f', 'f', '.', '.'], ['.', 'f', 'g', 'f', '.'], ['.', '.', 'f', 'f', 'f']],
        marks: { stripe: [[4, 2]], double: [[4, 2]], spots: [[3, 2]], lat: [], dots: [[3, 2]] }
    },
    {   // 10x7 (interior 8x5)
        outline: true,
        body: ['...gf...', '..bllbb.', '..bbbekb', '..wbwwbb', '...ddd..'],
        ty: 0, tails: [['..', 'g.', 'ff', 'g.', '..'], ['g.', 'ff', 'f.', '..', '..'], ['..', 'g.', 'ff', 'gf', '..'], ['..', '..', 'f.', 'ff', 'g.']],
        marks: { stripe: [[4, 2], [4, 3]], double: [[3, 2], [5, 3]], spots: [[3, 2], [5, 3]], lat: [[3, 2], [4, 2]], dots: [[3, 3], [5, 2]] }
    },
    {   // 12x9 (interior 10x7): the default fish
        outline: true,
        body: ['...fgf....', '...bllllb.', '..bllhllbb', '..bbbbbekb', '..bwwwwwbb', '...wwwwwd.', '....fd....'],
        ty: 0, tails: [
            ['..', 'g.', 'ff', 'ff', 'ff', 'g.', '..'], ['g.', 'ff', 'ff', 'f.', '..', '..', '..'],
            ['..', '..', 'gf', 'ff', 'gf', '..', '..'], ['..', '..', '..', 'f.', 'ff', 'ff', 'g.']],
        marks: { stripe: [[5, 2], [5, 3], [5, 4]], double: [[4, 2], [4, 3], [4, 4], [6, 3], [6, 4]], spots: [[4, 3], [6, 2], [5, 4]], lat: [[3, 3], [4, 3], [5, 3], [6, 3]], dots: [[4, 2], [6, 4], [3, 4]] }
    },
    {   // 14x10 (interior 12x8)
        outline: true,
        body: ['.....gff....', '....blllllb.', '...bllhhllbb', '...bbbbbbekb', '...bbbbbgbbb', '...wbbwwfwbb', '....wwwwwwd.', '.....fgd....'],
        ty: 0, tails: [
            ['...', '...', 'g..', 'ff.', 'fff', 'fff', 'ff.', 'g..'], ['g..', 'ff.', 'fff', 'ff.', 'f..', '...', '...', '...'],
            ['...', '.g.', 'ff.', 'fff', 'fff', 'gf.', '...', '...'], ['...', '...', '...', 'f..', 'ff.', 'fff', 'ff.', 'g..']],
        marks: { stripe: [[6, 2], [6, 3], [6, 4], [6, 5]], double: [[5, 2], [5, 3], [5, 4], [7, 3], [7, 4], [7, 5]], spots: [[5, 3], [7, 2], [6, 5], [4, 4]], lat: [[4, 4], [5, 4], [6, 4], [7, 4]], dots: [[5, 2], [7, 5], [4, 4], [8, 3]] }
    }
];
function fishFrame(art, variant, frame) {
    const A = FISH_ART[art], W = A.body[0].length, H = A.body.length, g = mk(W, H), base = variant.replace(/-w\d$/, '');
    A.body.forEach((row, y) => { if (row.length !== W) throw new Error('fish art ' + art + ' row ' + y + ' has ' + row.length + ' cols, expected ' + W); [...row].forEach((ch, x) => { if (ch !== '.') g[y][x] = ch; }); });
    for (const [x, y] of A.marks[MARK_STYLE[T.FISH_BASE.includes(base) ? base : 'coral']] || []) if ('bwl'.includes(g[y][x])) g[y][x] = MARK_STYLE[base] === 'lat' ? 'l' : 'p';
    const tail = A.tails[frame];
    tail.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g[A.ty + j][i] = ch; }));
    let fin = g;
    if (A.outline) {
        fin = mk(W + 2, H + 2);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fin[y + 1][x + 1] = g[y][x];
        outline(fin, () => true);
    }
    const p = FISH_PAL[variant], pal = { e: C('#fff'), k: C('#102') };
    for (const k in p) pal[k] = C(p[k]);
    return render(fin, pal);
}

// ── ORCA ─────────────────────────────────────────────────────
// Faces LEFT (the simulation's orca flag is inverted, same as the other themes). Profile columns (top/bottom
// row of the body per column) are authored for the 37x17 art (interior 35x15); the small art is the same drawing
// resampled. K body, s rim light, t sheen, W white, w white shade, g saddle, E eye.
const ORCA_PAL = mkPal({ K: '#124', s: '#459', t: '#236', W: '#fff', w: '#9bd', g: '#68a', o: '#001', q: '#234', E: '#001', e: '#fff', m: '#012' });
const ORCA_TOP = [7, 6, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 7, 7, 7, 7, 7];
const ORCA_BOT = [9, 10, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 11, 11, 11, 10, 10, 10, 9, 9, 9, 9, 9, 9, 9];
const ORCA_BELLY = [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1];
function orcaFrame(art, frame) {
    const big = art === 1, W = 35, H = 15, g = mk(W, H);
    const P = (x, y, ch) => put(g, x, y, ch);
    for (let x = 0; x < 29; x++) for (let y = ORCA_TOP[x]; y <= ORCA_BOT[x]; y++) P(x, y, 'K');
    // dorsal fin, swept back
    for (const [y, x0, x1] of [[0, 17, 17], [1, 16, 17], [2, 15, 17], [3, 14, 18]]) for (let x = x0; x <= x1; x++) P(x, y, 'K');
    pts(g, 's', [[17, 0], [16, 1], [15, 2], [14, 3]]);
    // rim light along the back, a soft sheen below it
    for (let x = 2; x <= 13; x++) P(x, ORCA_TOP[x], 's');
    for (let x = 19; x <= 26; x++) P(x, ORCA_TOP[x], 's');
    for (let x = 4; x <= 11; x++) P(x, ORCA_TOP[x] + 1, 't');
    // white belly, chin
    for (let x = 1; x <= 23; x++) {
        const b = ORCA_BOT[x], d = ORCA_BELLY[x - 1];
        for (let y = b - d + 1; y <= b; y++) P(x, y, y === b && x > 8 ? 'w' : 'W');
    }
    pts(g, 'W', [[0, 8], [0, 9], [1, 9], [1, 10]]);
    pts(g, 'm', [[0, 8], [1, 8], [2, 8], [3, 9]]);              // mouth line
    // eye patch + eye
    pts(g, 'W', [[5, 5], [6, 5], [7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [9, 6]]);
    pts(g, 'E', [[4, 6], [3, 6]]); pts(g, 'e', [[4, 5]]);
    // grey saddle behind the dorsal fin
    pts(g, 'g', [[19, 4], [20, 4], [21, 4], [20, 5], [21, 5], [22, 5]]);
    // pectoral flipper, flexes slowly
    const fl = frame % 2 === 0 ? [[8, 13], [9, 13], [10, 13], [11, 13], [9, 14], [10, 14], [11, 14]] : [[8, 13], [9, 13], [10, 13], [11, 13], [10, 14], [11, 14], [12, 14]];
    for (const [x, y] of fl) P(x, y, 'K');
    P(9, 13, 's');
    // tail flukes: two thick lobes forking from the peduncle, tilted slowly by the beat
    const dy = [0, -1, 0, 1][frame];
    for (let i = 0; i < 6; i++) {
        const x = 29 + i, sh = Math.round(dy * (x - 28) / 6), th = i >= 4 ? 3 : 3;
        for (let q = 0; q < th; q++) {
            const yu = 9 - i - q + 0, yl = 7 + i + q - 0;
            P(x, yu + sh, q === th - 1 && i > 0 ? 's' : 'K');
            P(x, yl + sh, 'K');
        }
    }
    pts(g, 'K', [[29, 8], [30, 8], [29, 7], [29, 9]]);
    let body = g;
    if (!big) body = resample(g, 20, 8);
    const fin = mk(body[0].length + 2, body.length + 2);
    for (let y = 0; y < body.length; y++) for (let x = 0; x < body[0].length; x++) fin[y + 1][x + 1] = body[y][x];
    outline(fin, () => true);
    return render(fin, ORCA_PAL);
}
// nearest-with-priority resampling for the small variants: a target cell takes the most common tone of its source block
function resample(g, w, h) {
    const sw = g[0].length, sh = g.length, out = mk(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const cnt = {}; let tot = 0;
        for (let sy = Math.floor(y * sh / h); sy < Math.ceil((y + 1) * sh / h); sy++) for (let sx = Math.floor(x * sw / w); sx < Math.ceil((x + 1) * sw / w); sx++) {
            const c = g[sy][sx]; tot++; if (c !== '.') cnt[c] = (cnt[c] || 0) + (c === 'E' || c === 'e' ? 3 : 1);
        }
        let best = null, bn = 0;
        for (const c in cnt) if (cnt[c] > bn) { bn = cnt[c]; best = c; }
        if (best && bn * 2 > tot * 0.6) out[y][x] = best;
    }
    return out;
}

// ── ANGLER ───────────────────────────────────────────────────
// Faces right; the stalk ends at theme.js LURE[art][frame] (the bulb itself is an overlay, see lureImg).
const ANG_PAL = mkPal({ W: '#ffe', F: '#85b', h: '#c9e', b: '#527', l: '#83a', d: '#315', s: '#a6c', f: '#639', F: '#85b', m: '#412', w: '#ffe', e: '#fd4', k: '#102', a: '#b8d', o: '#102', q: '#325', t: '#c9e' });
const ANGLER_ART = [
    {   // 12x10 (interior 10x8); tail at x0..1 (3 rows, tilts with the beat), body rows start at y2
        tail: [0, 3, ['f.', 'ff', 'f.']],
        body: ['..........', '..........', '....bllb..', '...bllllek', '..bbbbbbbb', '..bbbbbmwm', '..dbbbbbmm', '...ddddd..'],
        stalk: [[[6, 1], [7, 1]], [[6, 1], [7, 1]], [[6, 1], [7, 1]], [[6, 1], [7, 1]]]
    },
    {   // 18x14 (interior 16x12): round body, wide toothy mouth, eye, tail fan; body rows start at y3
        tail: [0, 5, ['f..', 'ff.', 'fff', 'ff.', 'f..']],
        body: ['................', '................', '................', '.......bllb.....', '.....bbllhllbb..', '....bblllllleeb.', '...bbbbbbbbbekbb', '..FbbbbbbbbbbmmmW'.slice(0, 16), '..FFbbbbbbbbmwmwm'.slice(0, 16), '...dbbbbbbbbbbd.', '....ddbbbbbbdd..', '......dddddd....'],
        stalk: [[[10, 2], [11, 1], [12, 1]], [[10, 2], [11, 2], [12, 2]], [[10, 2], [11, 1], [12, 1]], [[10, 2], [11, 1], [12, 0]]]
    }
];
function anglerFrame(art, frame) {
    const A = ANGLER_ART[art], W = A.body[0].length, H = A.body.length, g = mk(W, H);
    A.body.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y][x] = ch; }));
    const [tx0, ty0, trows] = A.tail, tdy = [0, -1, 0, 1][frame];
    trows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') put(g, tx0 + i, ty0 + j + tdy, ch); }));
    for (const [x, y] of A.stalk[frame]) put(g, x, y, 'a');
    const fin = mk(W + 2, H + 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fin[y + 1][x + 1] = g[y][x];
    outline(fin, c => c !== 'a');
    return render(fin, ANG_PAL);
}
// lure bulb overlay (2x2): 0 dim, 1 lit, 2 flare
function lureImg(level) {
    const g = mk(2, 2);
    ascii(g, [['oo', 'oo'], ['cc', 'co'], ['hh', 'hc']][level]);
    const pal = [{ o: C('#a60'), c: C('#c82') }, { o: C('#fb2'), c: C('#ffb') }, { o: C('#fe9'), c: C('#fff'), h: C('#fff') }][level];
    return render(g, pal);
}
// newborn sparkle (3x3 plus)
function sparkImg() {
    const g = mk(3, 3);
    ascii(g, ['.y.', 'yWy', '.y.']);
    return render(g, mkPal({ y: '#fe9', W: '#fff' }));
}
// soft glow (15x15): a few smooth concentric alpha rings, no stipple
function glowImg() {
    const S = T.GLOW_SIZE, c = (S - 1) / 2, px = Buffer.alloc(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - c, y - c) / (c + 0.5);
        if (d >= 1) continue;
        const a = Math.round(95 * Math.pow(1 - d, 1.7));
        if (a < 3) continue;
        px.set(C(d < 0.35 ? '#ffd' : '#fc6', a), (y * S + x) * 4);
    }
    return { W: S, H: S, px };
}

// ── JELLY ────────────────────────────────────────────────────
// Translucency with real alpha: a brighter rim, a soft body, thin trailing tentacles. No dark outline.
const JELLY_PAL = mkPal({ r: ['#fdf', 235], R: '#fff', b: ['#d9f', 150], i: ['#b7e', 150], g: ['#f9c', 200], a: ['#e9e', 170], A: ['#fbf', 140], t: ['#c8e', 130], f: ['#a7d', 90] });
function jellyFrame(art, frame) {
    const K = T.kinds.jelly.arts[art], W = K.cols, H = K.rows, g = mk(W, H);
    const bw0 = W, bh = Math.round(bw0 * 0.6), top = 1, cx = (W - 1) / 2;
    const bw = Math.max(bw0 - [0, 1, 2, 1][frame] * 2, 4);           // slow pulse: the bell narrows by 2 columns
    const hgt = bh + [0, 0, 1, 0][frame] * 0;
    const rows = [];
    for (let j = 0; j < hgt; j++) {
        const yn = (hgt - 1 - j) / (hgt - 0.3), hw = (bw / 2) * Math.sqrt(Math.max(0, 1 - yn * yn));
        const x0 = Math.ceil(cx - hw + 0.001), x1 = Math.floor(cx + hw - 0.001);
        rows.push([x0, x1]);
        for (let x = x0; x <= x1; x++) put(g, x, top + j, (j > hgt * 0.55 && x > cx) ? 'i' : 'b');
    }
    rows.forEach(([x0, x1], j) => {
        const y = top + j;
        put(g, x0, y, 'r'); put(g, x1, y, 'r');
        if (j === 0 || j === hgt - 1) for (let x = x0; x <= x1; x++) put(g, x, y, 'r');
    });
    // gonads and a specular glint (top left, as the light)
    const gy = top + hgt - 3;
    pts(g, 'g', [[Math.round(cx) - 1, gy], [Math.round(cx), gy], [Math.round(cx) + 1, gy], [Math.round(cx), gy - 1]]);
    pts(g, 'R', [[rows[1][0] + 2, top + 1], [rows[1][0] + 1, top + 2]]);
    // oral arms + tentacles, sway lags down the length
    const ph = frame * Math.PI / 2, rimY = top + hgt, len = H - rimY - 1;
    for (let j = 0; j < len - 4; j++) put(g, Math.round(cx) + Math.round(Math.sin(j * 0.6 - ph) * 0.9), rimY + j, j % 3 === 2 ? 'A' : 'a');
    const nT = W <= 12 ? 3 : 4, rb = rows[hgt - 1];
    for (let t = 0; t < nT; t++) {
        const bx = Math.round(rb[0] + 1 + t * (rb[1] - rb[0] - 2) / (nT - 1));
        for (let j = 0; j < len; j++) {
            const x = bx + (j > 0 ? Math.round(Math.sin(j * 0.55 + t * 1.7 - ph)) : 0);
            put(g, x, rimY + j, j > len * 0.6 ? 'f' : 't');
        }
    }
    return render(g, JELLY_PAL);
}

// ── WORM ─────────────────────────────────────────────────────
// 3x3 / 3x4, no outline: pale head, pink body, darker tail; the lower rows wiggle (4 frames).
const WORM_PAL = mkPal({ n: '#fcb', b: '#f78', d: '#c46', l: '#fab' });
function wormFrame(art, frame) {
    const H = art === 0 ? 3 : 4, g = mk(3, H), off = [0, 1, 1, 0][frame];
    ascii(g, ['nn.', 'bb.']);
    for (let y = 2; y < H; y++) { const last = y === H - 1; put(g, off, y, last ? 'd' : 'b'); put(g, off + 1, y, 'd'); }
    return render(g, WORM_PAL);
}

// ── BUBBLE ───────────────────────────────────────────────────
const BUB_PAL = mkPal({ r: ['#9df', 235], R: ['#dff', 245], H: '#fff', i: ['#6bd', 200] });
function bubbleImg(art) {
    const g = mk(art + 2, art + 2);
    ascii(g, [['HR', 'ri'], ['.R.', 'r.r', '.ri'], ['.RR.', 'r..r', 'r..i', '.ri.']][art]);
    return render(g, BUB_PAL);
}

// ── driver ───────────────────────────────────────────────────
function allImages() {
    const out = {};
    for (let a = 0; a < FISH_ART.length; a++)
        for (const v of T.allFishVariants()) for (let f = 0; f < T.kinds.fish.frames; f++) out[T.frameFile('fish', a, v, f)] = fishFrame(a, v, f);
    for (let f = 0; f < 4; f++) {
        for (let a = 0; a < T.kinds.orca.arts.length; a++) out[T.frameFile('orca', a, '', f)] = orcaFrame(a, f);
        for (let a = 0; a < T.kinds.angler.arts.length; a++) out[T.frameFile('angler', a, '', f)] = anglerFrame(a, f);
        for (let a = 0; a < T.kinds.worm.arts.length; a++) out[T.frameFile('worm', a, '', f)] = wormFrame(a, f);
        for (let a = 0; a < T.kinds.jelly.arts.length; a++) out[T.frameFile('jelly', a, '', f)] = jellyFrame(a, f);
    }
    for (let l = 0; l < 3; l++) out['lure-' + l + '.png'] = lureImg(l);
    out['glow.png'] = glowImg();
    out['spark.png'] = sparkImg();
    for (let a = 0; a < T.kinds.bubble.arts.length; a++) out[T.frameFile('bubble', a, '', 0)] = bubbleImg(a);
    Object.assign(out, require('./amiga-backdrop')({ C, mk, put, get, pts, ascii, render, mkPal, chk, T, encodeRGB, outline, to12 }));
    for (const k in T.kinds) {                            // descriptor sizes must match the art
        T.kinds[k].arts.forEach((ar, i) => {
            const f = out[T.frameFile(k, i, 'coral', 0)];
            if (f.W !== ar.cols || f.H !== ar.rows) throw new Error(k + ' art ' + i + ': art is ' + f.W + 'x' + f.H + ', theme.js says ' + ar.cols + 'x' + ar.rows);
        });
    }
    for (const f in out) {                                // OCS rule: 12-bit colours only
        const im = out[f];
        if (im.encoded || im.smooth8) continue;
        for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) for (let k = 0; k < 3; k++) if (im.px[i * 4 + k] % 17) throw new Error(f + ': colour is not 12-bit at texel ' + i);
    }
    return out;
}
const bytesOf = im => im.encoded ? im.encoded : (im.opaque ? encodeRGB(im.W, im.H, im.px) : png.encode(im.W, im.H, im.px));

// contact sheet: every sprite/frame enlarged on a water-coloured background
function sheet(imgs, file, S) {
    const PAD = 3, BG = [40, 130, 170];
    const rows = [];
    for (let a = 4; a >= 0; a--) for (const v of ['coral', 'amber', 'lemon', 'aqua', 'orchid', 'red', 'alarm', 'aqua-w1', 'aqua-w2']) {
        if (a < 4 && !['coral', 'aqua', 'amber'].includes(v)) continue;
        rows.push([0, 1, 2, 3].map(f => T.frameFile('fish', a, v, f)));
    }
    for (let a = 0; a < 2; a++) rows.push([0, 1, 2, 3].map(f => 'orca-' + a + '-' + f + '.png'));
    for (let a = 0; a < 2; a++) rows.push([0, 1, 2, 3].map(f => 'angler-' + a + '-' + f + '.png').concat(a ? ['lure-0.png', 'lure-1.png', 'lure-2.png', 'spark.png', 'glow.png'] : []));
    for (let a = 0; a < 4; a += 2) rows.push([0, 1, 2, 3].map(f => T.frameFile('jelly', a, '', f)).concat([0, 1, 2, 3].map(f => T.frameFile('jelly', a + 1, '', f))));
    rows.push([0, 1, 2, 3].map(f => 'worm-1-' + f + '.png').concat([0, 1, 2, 3].map(f => 'worm-0-' + f + '.png'), [0, 1, 2].map(c => T.frameFile('bubble', c, '', 0))));
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
if (si > 0) sheet(imgs, process.argv[si + 1], +(process.argv[process.argv.indexOf('--scale') + 1]) || 8);
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
