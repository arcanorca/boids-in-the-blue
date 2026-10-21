// Backdrop textures of the "amiga" theme (used by tools/gen-amiga-theme.js): copper lists, soft static
// light shafts, far hills, seabed and the plants. Everything is STATIC art (the plants lean a little in
// QML, see Backdrop.qml): no colour cycling, no stipple, no dither at all. 12-bit colours only (alpha is free),
// except the copper gradients, which are interpolated between 12-bit key colours.
'use strict';

module.exports = function (H) {
    const { C, mk, put, get, render, mkPal, T, outline } = H;
    const out = {};
    const TAU = Math.PI * 2;

    // ── COPPER LISTS ─────────────────────────────────────────
    // stops: [fraction of the screen height, '#rgb'] (12-bit key colours of the copper list).
    const COPPER = {
        night:  [[0, '#247'], [0.08, '#236'], [0.35, '#136'], [0.7, '#125'], [1, '#013']],
        dusk:   [[0, '#b87'], [0.12, '#a7a'], [0.4, '#659'], [0.7, '#437'], [1, '#225']],
        day:    [[0, '#6bd'], [0.06, '#5ac'], [0.35, '#39a'], [0.7, '#278'], [1, '#157']],
        stress: [[0, '#c46'], [0.08, '#b46'], [0.35, '#a25'], [0.7, '#824'], [1, '#513']]
    };
    // Scanlines are interpolated at 8 bit between the 12-bit key colours: plain 12-bit rows band visibly (and
    // wobble in hue where the channels step on different lines) on a 1080p wallpaper. Smooth, noise-free, no dither.
    function copper(stops) {
        const W = T.COPPER.w, Hh = T.COPPER.h, px = Buffer.alloc(W * Hh * 4);
        const rgb = stops.map(([f, c]) => [f * (Hh - 1), C(c).slice(0, 3)]);
        for (let y = 0; y < Hh; y++) {
            let i = 1; while (i < rgb.length - 1 && y > rgb[i][0]) i++;
            const [l0, c0] = rgb[i - 1], [l1, c1] = rgb[i], t = Math.min(1, Math.max(0, (y - l0) / (l1 - l0))), s = t * t * (3 - 2 * t);
            for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                for (let k = 0; k < 3; k++) px[o + k] = Math.round(c0[k] + (c1[k] - c0[k]) * s);
                px[o + 3] = 255;
            }
        }
        return { W, H: Hh, px, opaque: true, smooth8: true };
    }
    const rowsOf = im => Array.from({ length: im.H }, (_, y) => [0, 1, 2].map(k => im.px[y * im.W * 4 + k]));
    function mixList(a, b, t) {
        const px = Buffer.alloc(a.px.length), ra = rowsOf(a), rb = rowsOf(b);
        for (let y = 0; y < a.H; y++) for (let x = 0; x < a.W; x++) { const o = (y * a.W + x) * 4; for (let k = 0; k < 3; k++) px[o + k] = Math.round(ra[y][k] + (rb[y][k] - ra[y][k]) * t); px[o + 3] = 255; }
        return { W: a.W, H: a.H, px, opaque: true, smooth8: true };
    }
    const lists = {};
    for (const l of T.COPPER.lists) out['copper-' + l + '.png'] = lists[l] = copper(COPPER[l]);
    const hot = copper(COPPER.stress);
    for (const l of T.COPPER.lists) for (let k = 1; k <= T.COPPER.stressSteps; k++) out['copper-stress-' + l + '-' + k + '.png'] = mixList(lists[l], hot, 0.6 * k / T.COPPER.stressSteps);

    // ── LIGHT SHAFTS ─────────────────────────────────────────
    // Static, soft: smooth alpha (<= ~9 %), a few slanted beams fading out with depth, plus a faint glow at the surface.
    {
        const W = T.RAYS.w, Hh = T.RAYS.h, px = Buffer.alloc(W * Hh * 4);
        const BEAMS = [[40, 0.34, 20, 1.0], [118, 0.30, 34, 0.8], [196, 0.36, 22, 1.0], [284, 0.30, 40, 0.7], [352, 0.34, 24, 0.95], [430, 0.28, 30, 0.8]];
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            let a = 0;
            for (const [x0, sl, w0, k] of BEAMS) {
                const hw = w0 / 2 + y * 0.12, d = Math.abs(x - (x0 + sl * y)) / hw;
                if (d >= 1) continue;
                const s = (1 - d) * (1 - d) * (3 - 2 * (1 - d));
                a = Math.max(a, k * s * Math.pow(Math.max(0, 1 - y / (Hh * 0.8)), 1.4) * 0.11);
            }
            a = Math.max(a, 0.11 * Math.pow(Math.max(0, 1 - y / 26), 2));        // surface glow
            const al = Math.round(a * 255);
            if (al > 0) px.set(C('#dff', al), (y * W + x) * 4);
        }
        out['rays.png'] = { W, H: Hh, px };
    }

    // ── SEABED: far hills + sand ─────────────────────────────
    const wx = (g, x) => ((x % g[0].length) + g[0].length) % g[0].length;
    const putw = (g, x, y, ch) => put(g, wx(g, Math.round(x)), y, ch);
    {   // far hills: hazy, low contrast (alpha over the water), 2 depths
        const W = T.FAR.tw, Hh = T.FAR.h, g = mk(W, Hh);
        const hill = (x, a, b, c) => 7 + a * (0.5 + 0.5 * Math.sin(TAU * 2 * x / W + b)) + c * Math.sin(TAU * 5 * x / W + 1.3 * b);
        for (let x = 0; x < W; x++) {
            const t = Hh - Math.round(Math.min(18, hill(x, 9, 0.7, 2.2)));
            for (let y = t; y < Hh; y++) g[y][x] = y === t ? 'r' : 'a';
        }
        out['far.png'] = render(g, mkPal({ a: ['#146', 95], r: ['#146', 95] }));
    }
    {   // sand: 5 tones by depth, top-left lit slopes; hand-drawn rocks, shells, coral heads
        const W = T.GROUND.tw, Hh = T.GROUND.h, g = mk(W, Hh);
        const dune = x => 6 + 2.4 * Math.sin(TAU * 2 * x / W + 0.3) + 1.6 * Math.sin(TAU * 6 * x / W + 1.7) + 0.7 * Math.sin(TAU * 17 * x / W);
        const top = []; for (let x = 0; x < W; x++) top[x] = Math.round(dune(x)) + 10;
        for (let x = 0; x < W; x++) {
            const lit = top[(x + 1) % W] >= top[x];
            for (let y = top[x]; y < Hh; y++) {
                const d = y - top[x];
                g[y][x] = d === 0 ? (lit ? 'a' : 'b') : d < 3 ? 'b' : d < 6 ? 'c' : d < 9 ? 'd' : 'e';
            }
        }
        // hand-drawn props: placed on the dune line. rock: o outline, r lit, m mid, s shade
        const ROCKA = ['..oooo..', '.orrrmo.', 'orrmmmmo', 'ommmmmso', 'ommmmsso', '.ossssoo'];
        const ROCKB = ['..oo..', '.orro.', 'ormmmo', 'ommmso', 'osssoo'];
        const CORAL = ['...oooo....', '..onnnNo...', '.onnNnNNo..', 'onnNNNnNNo.', 'onNNNNNNkko', 'okNNnNNNkko', '.okkkkkkoo.'];
        const TUBES = ['o..o.o.', 'UoUoUo.', 'UoUoUoo', 'VoUoVoU', 'UoUoUoU', 'UuUuUuU'];
        const SHELL = ['.oo.', 'oSSo', '.oo.'];
        const stamp = (art, x0, dy) => art.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') putw(g, x0 + i, top[wx(g, x0 + (art[0].length >> 1))] + dy - art.length + 1 + j, ch); }));
        stamp(ROCKA, 70, 3); stamp(ROCKB, 78, 3);
        stamp(CORAL, 200, 3); stamp(TUBES, 215, 3);
        stamp(ROCKB, 330, 3); stamp(ROCKA, 340, 3);
        stamp(CORAL, 470, 3); stamp(SHELL, 150, 1); stamp(SHELL, 410, 1); stamp(SHELL, 560, 1);
        for (let k = 0; k < 48; k++) { const x = (k * 61 + 13) % W, y = top[x] + 2 + (k * 7) % 5; putw(g, x, y, k % 3 ? 'p' : 'P'); }   // pebbles
        out['ground.png'] = render(g, mkPal({ a: '#dc9', b: '#ba7', c: '#a86', d: '#875', e: '#654', p: '#cb8', P: '#fed',
            o: '#243', r: '#6a9', m: '#486', s: '#364', S: '#fcb',
            U: '#e85', V: '#fb7', u: '#c63', N: '#e57', n: '#f9a', k: '#a35' }));
    }

    // ── PLANTS ───────────────────────────────────────────────
    // Drawn upright on a canvas of the species' size (base = bottom centre), then cut into slices
    // (SLICE_H rows each, plus 1 extra row of overlap) so QML can shift them sideways a little. l lit (left), b body, d shade, h tip light.
    const PALETTES = {
        front: mkPal({ o: '#043', d: '#065', b: '#187', l: '#3a8', h: '#6c9' }),
        back:  mkPal({ d: ['#197', 105], b: ['#2a8', 105], l: ['#5cb', 115], h: ['#7dc', 120] }),
        fg:    mkPal({ o: ['#021', 215], d: ['#043', 215], b: ['#054', 215], l: ['#076', 215], h: ['#098', 215] })
    };
    function kelp(sp, o) {
        const g = mk(sp.w, sp.h), cx = sp.w / 2 - 1;
        const stalkX = y => Math.round(cx + o.amp * Math.sin(y * o.freq + o.ph) * (0.35 + 0.65 * y / sp.h));
        const rowOf = y => sp.h - 1 - y;
        for (let y = 0; y < sp.h; y++) {
            const t = y / sp.h, w = t > 0.8 ? 1 : (o.thick > 2 && t < 0.5 ? 3 : 2), x = stalkX(y);
            for (let q = 0; q < w; q++) put(g, x + q, rowOf(y), w === 1 ? 'b' : q === 0 ? 'l' : (q === w - 1 ? 'd' : 'b'));
        }
        for (let k = 0, y = o.first; y < sp.h - 3; k++, y += o.every) {
            const side = k % 2 ? 1 : -1, x = stalkX(y) + (side > 0 ? 2 : 0), L = Math.max(3, Math.round(o.leaf * (1 - 0.45 * y / sp.h)));
            for (let q = 1; q <= L; q++) {
                const by = y + Math.round(q * 0.55) - Math.round(q * q * 0.07), bx = x + side * q;
                put(g, bx, rowOf(by), q === L ? 'h' : 'l');
                if (q < L) put(g, bx, rowOf(by - 1), side < 0 ? 'b' : 'd');
            }
        }
        for (let q = -1; q <= 1; q++) for (let j = 0; j < 4; j++) put(g, stalkX(sp.h - 4) + q * (j + 1) / 3 + 0.5 | 0, rowOf(sp.h - 4 + j), j === 3 ? 'h' : 'l');   // crown tuft
        return g;
    }
    function weed(sp, o) {
        const g = mk(sp.w, sp.h), cx = sp.w / 2, rowOf = y => sp.h - 1 - y;
        o.blades.forEach(([dir, len, bend]) => {
            for (let y = 0; y < len; y++) {
                const t = y / len, x = Math.round(cx + dir * t * 3 + bend * t * t * 4);
                put(g, x, rowOf(y), t > 0.85 ? 'h' : (dir < 0 ? 'l' : 'b'));
                if (t < 0.7) put(g, x + 1, rowOf(y), 'd');
            }
        });
        return g;
    }
    const SPECIES = {
        kelpA: [kelp, { amp: 2.4, freq: 0.11, ph: 0.4, thick: 3, first: 6, every: 7, leaf: 7 }, 'front'],
        kelpB: [kelp, { amp: 2.0, freq: 0.14, ph: 2.0, thick: 2, first: 5, every: 7, leaf: 5 }, 'front'],
        kelpC: [kelp, { amp: 1.6, freq: 0.17, ph: 3.3, thick: 2, first: 4, every: 6, leaf: 4 }, 'front'],
        weedA: [weed, { blades: [[-1.6, 22, -1], [-0.8, 24, 0], [0, 19, 0.6], [0.8, 23, 1], [1.7, 20, 1.4]] }, 'front'],
        hazeA: [kelp, { amp: 2.2, freq: 0.10, ph: 1.1, thick: 2, first: 6, every: 9, leaf: 5 }, 'back'],
        hazeB: [kelp, { amp: 1.8, freq: 0.15, ph: 4.0, thick: 2, first: 5, every: 7, leaf: 4 }, 'back'],
        fgA:   [kelp, { amp: 2.6, freq: 0.12, ph: 0.9, thick: 3, first: 6, every: 9, leaf: 7 }, 'fg'],
        fgB:   [kelp, { amp: 2.0, freq: 0.16, ph: 2.7, thick: 3, first: 5, every: 8, leaf: 6 }, 'fg']
    };
    for (const name in T.PLANTS) {
        const sp = T.PLANTS[name], [fn, o, layer] = SPECIES[name];
        if (layer !== sp.layer) throw new Error('layer mismatch ' + name);
        const g = fn(sp, o);
        if (layer !== 'back') outline(g, () => true, 'o', 'o');
        const sh = T.SLICE_H;
        for (let i = 0; i < T.sliceCount(name); i++) {
            const rows = [];
            for (let r = 0; r < sh + 1; r++) { const src = sp.h - (i + 1) * sh - 1 + r; rows.push(src >= 0 ? g[src].slice() : Array(sp.w).fill('.')); }
            out[T.plantFile(name, i)] = render(rows, PALETTES[layer]);
        }
    }
    return out;
};
