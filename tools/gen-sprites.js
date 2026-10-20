// Generates the shared sprite textures (contents/images/sprites/*.png) from the
// SPRITES data in the core. Run:  node tools/gen-sprites.js [--check]
//
// Why files: every entity is then a plain Image sharing a few small textures, so the
// scene graph can atlas and batch them (the old renderer painted one Canvas per entity).
//
// Geometry reproduces the old Canvas painter: every cell of value v is a rect
// (c*s, r*s, s+1, s+1) in px (1 px overlap), clipped to the cols*s x rows*s item, one
// antialiased path per layer. The old Canvas drew that into a round(W) x round(H) tile and
// stretched the tile over W x H with linear filtering; sprites.js reproduces the stretch.
// One texture is rendered per size class (size = n/Q px, Q in sprites.js) at 1 texel per px
// with exact-ish area coverage (16x16 supersampling), because the overlap and the antialiased
// edges depend on the size and cannot be produced by scaling one master.
// Files (n = size class in 1/Q px, see sprites.js; Q=16 so n=64 is size 4.0):
//   fish-<HEX>-<n>.png   layer 1 of a fish in colour HEX (palette + tint colours)
//   fish-top-<n>.png     fish layers 2+3 (eye, fixed colours)
//   <species>-<n>.png    orca/angler/jelly/worm/bubble: all layers composited
// Swapping sprite art later = change SPRITES / COLORS here and rerun.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { loadBoids } = require("../tests/harness");
const OUT = path.join(__dirname, '..', 'contents', 'images', 'sprites');
const { loadScript } = require('../tests/harness');
const META = loadScript(path.join(__dirname, '..', 'contents', 'ui', 'code', 'sprites.js'));
const Q = META.Q;
const MAXN = t => Math.round(META.MAX_SIZE[t] * Q);   // by delegate type
const RES = 1;                                      // texels per px (the item is drawn ~1:1)
const SUB = 16;                                     // coverage supersampling per texel

const B = loadBoids();
const SPR = B.SPRITES;
const PALETTE = B.Core.FISH_PALETTE;

function hex(c) { return [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)); }
function rgba(c) {
    const m = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
    if (m) return [+m[1], +m[2], +m[3], Math.round(parseFloat(m[4]) * 255)];
    return hex(c).concat(255);
}

// layers: [{value, color}] drawn in order, source-over, onto a transparent canvas.
// Each layer is one path (union of its cell rects), antialiased by exact-ish area coverage.
function render(sprite, layers, n) {
    const s = n / Q, rows = sprite.length, cols = sprite[0].length;
    const K = s * RES;                                   // texels per cell
    const W = Math.max(1, Math.round(cols * K)), H = Math.max(1, Math.round(rows * K));
    const px = new Float64Array(W * H * 4);              // premultiplied
    for (const L of layers) {
        const col = rgba(L.color), a = col[3] / 255;
        const sub = new Uint8Array(W * SUB * H * SUB);
        const SW = W * SUB;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (sprite[r][c] !== L.value) continue;
            const x0 = Math.round(c * K * SUB), y0 = Math.round(r * K * SUB);
            const x1 = Math.min(SW, Math.round((c * K + K + RES) * SUB)), y1 = Math.min(H * SUB, Math.round((r * K + K + RES) * SUB));
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sub[y * SW + x] = 1;
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let cnt = 0;
            for (let yy = 0; yy < SUB; yy++) for (let xx = 0; xx < SUB; xx++) cnt += sub[(y * SUB + yy) * SW + x * SUB + xx];
            if (!cnt) continue;
            const o = (y * W + x) * 4, ca = a * cnt / (SUB * SUB);
            for (let k = 0; k < 3; k++) px[o + k] = col[k] / 255 * ca + px[o + k] * (1 - ca);
            px[o + 3] = ca + px[o + 3] * (1 - ca);
        }
    }
    const out = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        const al = px[i * 4 + 3];
        for (let k = 0; k < 3; k++) out[i * 4 + k] = al > 0 ? Math.round(Math.min(1, px[i * 4 + k] / al) * 255) : 0;
        out[i * 4 + 3] = Math.round(al * 255);
    }
    return { W, H, px: out };
}

const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
}
function png(W, H, px) {
    const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
    const raw = Buffer.alloc((W * 4 + 1) * H);
    for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih),
                          chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Colours (must match what the old BoidDelegate drew)
const L3 = '#FF3333';
const SPECIES = {
    orca:   { sprite: SPR.ORCA,   l1: '#4D6680', l2: '#E6E6E6' },
    angler: { sprite: SPR.ANGLER, l1: '#403359', l2: '#FFFF99' },
    jelly:  { sprite: SPR.JELLY,  l1: '#8B7BB5', l2: '#8B7BB5' },
    worm:   { sprite: SPR.WORM,   l1: B.WORM_COLOR },
    bubble: { sprite: SPR.BUBBLE, l1: B.BUBBLE_COLOR }
};
// fish layer-1 colours: palette + stress tint endpoints (#FF3333 overlay, red/navy pulse)
const FISH_L1 = PALETTE.concat(['#FF3333', '#FF0000', '#000080']).map(c => c.toUpperCase());
const FISH_L2 = '#FFFFFF';

function files() {
    const out = {};
    const T = { fish: 1, jelly: 2, orca: 3, angler: 4, bubble: 5, worm: 6 };
    for (let n = 1; n <= MAXN(1); n++) {
        for (const c of FISH_L1) out['fish-' + c.slice(1) + '-' + n + '.png'] = [SPR.FISH, [{ value: 1, color: c }], n];
        out['fish-top-' + n + '.png'] = [SPR.FISH, [{ value: 2, color: FISH_L2 }, { value: 3, color: L3 }], n];
    }
    for (const k in SPECIES) {
        const S = SPECIES[k], ls = [{ value: 1, color: S.l1 }];
        if (S.l2) ls.push({ value: 2, color: S.l2 });
        ls.push({ value: 3, color: L3 });
        for (let n = 1; n <= MAXN(T[k]); n++) out[k + '-' + n + '.png'] = [S.sprite, ls, n];
    }
    return out;
}

const all = files();
if (process.argv.includes('--check')) {
    let bad = 0;
    for (const f in all) {
        const p = path.join(OUT, f);
        const r = render(all[f][0], all[f][1], all[f][2]);
        if (!fs.existsSync(p) || !fs.readFileSync(p).equals(png(r.W, r.H, r.px))) { console.error('stale: ' + f); bad++; }
    }
    if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (!all[f]) { console.error('extra: ' + f); bad++; }
    process.exit(bad ? 1 : 0);
}
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (!all[f]) fs.unlinkSync(path.join(OUT, f));
let bytes = 0;
for (const f in all) {
    const r = render(all[f][0], all[f][1], all[f][2]), b = png(r.W, r.H, r.px);
    fs.writeFileSync(path.join(OUT, f), b); bytes += b.length;
}
console.log(Object.keys(all).length + ' sprites, ' + (bytes / 1024).toFixed(0) + ' KiB -> ' + OUT);
