// Backdrop textures of the "amiga" theme (used by tools/gen-amiga-theme.js): copper lists,
// colour-cycled light shafts, and the tileable parallax strips. 12-bit colours only.
'use strict';

module.exports = function (H) {
    const { C, mk, put, get, render, mkPal, chk, BAYER4, T, encodeRGB } = H;
    const out = {};
    const TAU = Math.PI * 2;
    const bay = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

    // ── COPPER LISTS ─────────────────────────────────────────
    // stops: [scanline, '#rgb']. Between stops the colour is interpolated per scanline in 4-bit
    // channel space and then ordered-dithered to the neighbouring 12-bit levels (the "fine steps").
    const COPPER = {
        night: [[0, '#48c'], [3, '#37b'], [14, '#26a'], [60, '#259'], [130, '#148'], [210, '#036'], [320, '#025']],
        dusk:  [[0, '#fc8'], [3, '#f96'], [14, '#e68'], [50, '#b6a'], [100, '#76b'], [160, '#349'], [230, '#127'], [320, '#015']],
        day:   [[0, '#cff'], [3, '#8ff'], [14, '#5de'], [50, '#3bd'], [110, '#19b'], [190, '#07a'], [250, '#058'], [320, '#036']],
        stress:[[0, '#f96'], [3, '#f74'], [14, '#e53'], [60, '#c32'], [130, '#a12'], [210, '#712'], [320, '#401']]
    };
    function copper(stops) {
        const W = T.COPPER.w, Hh = T.COPPER.h, px = Buffer.alloc(W * Hh * 4);
        const rgb = stops.map(([l, c]) => [l, C(c).slice(0, 3).map(v => v / 17)]);
        for (let y = 0; y < Hh; y++) {
            let i = 1; while (i < rgb.length - 1 && y > rgb[i][0]) i++;
            const [l0, c0] = rgb[i - 1], [l1, c1] = rgb[i], t = Math.min(1, Math.max(0, (y - l0) / (l1 - l0)));
            const v = c0.map((a, k) => a + (c1[k] - a) * t);
            for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                for (let k = 0; k < 3; k++) {
                    const lv = Math.floor(v[k]), fr = v[k] - lv;
                    // dither only the middle of each step: wide clean runs of one level, a narrow stippled seam
                    const f2 = Math.min(1, Math.max(0, (fr - 0.2) / 0.6));
                    px[o + k] = (lv + (f2 > bay(x + k * 2, y) ? 1 : 0)) * 17;
                }
                px[o + 3] = 255;
            }
        }
        return { W, H: Hh, px, opaque: true };
    }
    for (const l of T.COPPER.lists) out['copper-' + l + '.png'] = copper(COPPER[l]);

    // ── COLOUR-CYCLED LIGHT SHAFTS + SURFACE ─────────────────
    // RGBA with 1-bit alpha: intensity is a stipple density. Band brightness runs down each shaft;
    // frame f rotates it by 4 lines (6 frames = one 24-line cycle), like a DPaint colour-cycle range.
    const SHAFTS = [[34, 0.30, 12, 0.5], [118, 0.26, 20, 3], [205, 0.32, 15, 5], [292, 0.27, 24, 1.5], [385, 0.31, 14, 4], [470, 0.28, 19, 2.2], [556, 0.30, 13, 0.7], [612, 0.25, 16, 3.6]];
    function caustics(f) {
        const W = T.CAUSTICS.w, Hh = T.CAUSTICS.h, px = Buffer.alloc(W * Hh * 4), P = 24;
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            let s = 0;
            for (const [x0, sl, w0, ph] of SHAFTS) {
                const hw = w0 / 2 + y * 0.045, d = Math.abs(x - (x0 + sl * y)) / hw;
                if (d >= 1) continue;
                const band = 0.62 + 0.38 * Math.cos(TAU * ((y - f * 4) / P + ph / 6));
                const v = (1 - d * d) * Math.pow(Math.max(0, 1 - y / 215), 1.25) * band;
                if (v > s) s = v;
            }
            // surface ripple band: crests ride the cycle frames
            const wave = 3.2 + 1.5 * Math.sin(TAU * (x / 64 - f / 6)) + 1.0 * Math.sin(TAU * (x / 21 + f / 3));
            if (y < wave - 1) s = Math.max(s, 1.5);
            else if (y < wave + 1) s = Math.max(s, 1.1);
            else if (y < wave + 5) s = Math.max(s, 0.5 * (1 - (y - wave - 1) / 4));
            if (s * 0.42 > bay(x, y)) {
                const o = (y * W + x) * 4;
                px.set(C(s > 1.3 ? '#fff' : s > 0.8 ? '#cff' : s > 0.45 ? '#9ef' : '#7df'), o);
            }
        }
        return { W, H: Hh, px };
    }
    for (let f = 0; f < T.CAUSTICS.frames; f++) out['caustics-' + f + '.png'] = caustics(f);

    // ── PARALLAX STRIPS (tile horizontally: periodic in x) ───
    const wx = (g, x) => ((x % g[0].length) + g[0].length) % g[0].length;
    const putw = (g, x, y, ch) => put(g, wx(g, Math.round(x)), y, ch);
    function outlineWrap(g, o, q) {          // outline that wraps at the tile seam
        const W = g[0].length, Hh = g.length, add = [];
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            if (g[y][x] !== '.') continue;
            const n = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => get(g, wx(g, x + dx), y + dy));
            if (n.some(c => c !== '.')) add.push([x, y, (n[0] !== '.' && n[1] === '.') ? q : o]);
        }
        for (const [x, y, c] of add) g[y][x] = c;
    }

    // far rocks: hazy rounded mesas and pillars (superellipse bumps), lit rim on top, dithered fade into the water
    {
        const W = T.FAR.tw, Hh = T.FAR.h, g = mk(W, Hh);
        const FORM = [[60, 54, 58], [142, 26, 40], [214, 62, 48], [300, 30, 72], [382, 50, 54], [455, 38, 66], [506, 24, 36]];
        const hgt = x => {
            let m = 16 + 3 * Math.sin(TAU * 3 * x / W + 0.6) + 2 * Math.sin(TAU * 9 * x / W + 1.3);
            for (const [cx, hw, h] of FORM) {
                const d = Math.min(Math.abs(x - cx), W - Math.abs(x - cx)) / hw;
                if (d < 1) m = Math.max(m, h * Math.pow(1 - Math.pow(d, 2.6), 1 / 2.6));
            }
            return m;
        };
        const top = [];
        for (let x = 0; x < W; x++) {
            top[x] = Hh - Math.round(hgt(x));
            for (let y = top[x]; y < Hh; y++) {
                const d = y - top[x];
                g[y][x] = d === 0 ? 'a' : d === 1 ? (chk(x, y) ? 'a' : 'b') : d < 4 ? 'b' : d < 8 ? (chk(x, y) ? 'b' : 'c') : (y > Hh - 24 && chk(x + (y >> 1), y)) ? 'e' : 'c';
            }
        }
        // strata and cracks: short darker strokes + a few lit ledges
        for (let k = 0; k < 120; k++) { const x = (k * 97 + 13) % W, y = top[x] + 5 + (k * 53) % 44; for (let i = 0; i < 3 + k % 4; i++) if (get(g, wx(g, x + i), y) === 'c') putw(g, x + i, y, 'e'); }
        for (let k = 0; k < 40; k++) { const x = (k * 131 + 29) % W, y = top[x] + 9 + (k * 37) % 30; for (let i = 0; i < 3; i++) if (get(g, wx(g, x + i), y) === 'c') putw(g, x + i, y, 'b'); }
        out['far.png'] = render(g, mkPal({ a: '#3ac', b: '#28b', c: '#179', e: '#168' }));
    }

    // ground: sand dunes with pebbles, shells and two small rocks. Static, full opacity.
    {
        const W = T.GROUND.tw, Hh = T.GROUND.h, g = mk(W, Hh);
        const dune = x => 10 + 3 * Math.sin(TAU * 3 * x / W + 0.3) + 2 * Math.sin(TAU * 8 * x / W + 1.7) + 1.2 * Math.sin(TAU * 19 * x / W);
        for (let x = 0; x < W; x++) {
            const t = Math.round(dune(x));
            for (let y = t; y < Hh; y++) {
                const d = y - t, k = bay(x, y);
                g[y][x] = d === 0 ? 'a' : d === 1 ? (k < 0.5 ? 'a' : 'b') : d < 4 ? (k < 0.6 ? 'b' : 'c') : d < 8 ? (k < 0.45 ? 'c' : 'd') : (k < 0.45 ? 'd' : 'e');
            }
        }
        const rock = (cx, w, h) => { const base = Math.round(dune(cx)) + 2; for (let j = 0; j < h; j++) { const hw = Math.round(w / 2 * Math.sqrt(1 - Math.pow(j / h, 2))); for (let x = cx - hw; x <= cx + hw; x++) putw(g, x, base - j, (j >= h - 2 || x > cx + hw / 3 - 1) ? (j >= h - 1 ? 'R' : 'r') : 'm'); } };
        rock(110, 14, 8); rock(114, 7, 11); rock(380, 18, 7); rock(470, 9, 5);
        for (let k = 0; k < 40; k++) { const x = (k * 61 + 7) % W, y = Math.round(dune(x)) + 2 + (k * 7) % 5; putw(g, x, y, k % 3 ? 'p' : 'P'); if (k % 2) putw(g, x + 1, y, 'c'); }
        for (const x of [60, 250, 330, 500]) { const y = Math.round(dune(x)) + 1; putw(g, x, y, 'S'); putw(g, x + 1, y, 'S'); putw(g, x, y - 1, 's'); }   // shells
        out['ground.png'] = render(g, mkPal({ a: '#fe9', b: '#ec7', c: '#ca6', d: '#a85', e: '#864', p: '#fff', P: '#fdb', S: '#fca', s: '#fff', m: '#468', r: '#69b', R: '#9cd' }));
    }

    // kelp forest + corals + sea-grass: transparent strip, N sway frames. Two depths: thin hazy stalks
    // behind (lower-case palette), brighter stalks in front.
    {
        const W = T.KELP.tw, Hh = T.KELP.h, N = T.KELP.frames, ground = Hh - 17;
        const PALK = mkPal({ o: '#021', q: '#032', D: '#063', B: '#0a6', L: '#3c7', H: '#8e9', Y: '#6b3', y: '#9d4', d: '#053', b: '#086', l: '#2a7',
                             c: '#a3a', C: '#d6d', Z: '#fac', u: '#e63', U: '#fa4', V: '#fd8', t: '#f86', n: '#7a3' });
        const FRONT = [[18, 52], [27, 30], [34, 64], [88, 40], [97, 58], [104, 26], [158, 34], [166, 62], [175, 44], [236, 48], [244, 28], [252, 56],
                       [304, 36], [311, 60], [318, 30], [378, 54], [387, 40], [447, 46], [455, 66], [462, 28], [497, 38]];
        const BACK = [[8, 62], [46, 74], [72, 52], [124, 70], [141, 48], [192, 78], [212, 56], [268, 72], [290, 50], [346, 68], [362, 54], [410, 76], [430, 52], [480, 70]];
        const frameImg = f => {
            const g = mk(W, Hh), base = ground;
            const stalk = (x, h, back, k) => {
                const ph = (k * 1.7) % TAU, kind = k % 5 === 2 && !back ? 'y' : 'g';
                for (let i = 0; i < h; i++) {
                    const t = i / h, dx = (back ? 3 : 4.2) * Math.pow(t, 1.3) * Math.sin(TAU * f / N - i * 0.075 + ph), cx = x + dx;
                    const ww = back ? 2 : Math.max(2, Math.round(3 * (1 - 0.4 * t)) + (k % 4 === 0 ? 1 : 0));
                    for (let q = 0; q < ww; q++) putw(g, cx - ww / 2 + q + 0.5, base - i, back ? (q === 0 ? 'd' : 'b') : (q === 0 ? 'D' : (q === ww - 1 ? (kind === 'y' ? 'y' : 'L') : (kind === 'y' ? 'Y' : 'B'))));
                    if (i % 10 === 5 && i > 6 && i < h - 2) {          // leaf: a short curved blade, alternating sides
                        const side = (i / 10 | 0) % 2 ? 1 : -1, len = back ? 3 : 4 + (k % 2);
                        for (let q = 1; q <= len; q++) for (let r = 0; r < (q < len ? 2 : 1); r++) putw(g, cx + side * (ww / 2 + q - 0.5), base - i - ((q * q) >> 2) - r + 1, back ? (r ? 'b' : 'l') : (r ? (kind === 'y' ? 'Y' : 'B') : (kind === 'y' ? 'y' : (q === len ? 'H' : 'L'))));
                    }
                }
            };
            BACK.forEach(([x, h], k) => stalk(x, h, true, k));
            // coral heads and tubes, standing on the sand line
            const brain = (cx, cy, r, col) => { for (let y = -r; y <= 0; y++) for (let x = -r; x <= r; x++) if (x * x + y * y * 1.5 <= r * r) putw(g, cx + x, cy + y, (chk(x, y) && y < -r / 2) ? 'Z' : (x > r / 3 ? (col === 'c' ? 'c' : 'u') : (col === 'c' ? 'C' : 'U'))); };
            brain(124, ground - 1, 13, 'c'); brain(138, ground, 8, 'c'); brain(300, ground - 1, 15, 'u'); brain(316, ground, 9, 'u'); brain(452, ground - 1, 11, 'c');
            for (const [cx, hh] of [[212, 26], [217, 34], [223, 22], [400, 30], [406, 21], [411, 27]]) for (let j = 0; j < hh; j++) {
                const bend = j > hh * 0.7 ? (cx % 2 ? 1 : -1) : 0;
                putw(g, cx + bend, ground + 6 - j, j % 4 === 3 ? 'V' : 'U'); putw(g, cx + 1 + bend, ground + 6 - j, 't');
            }
            FRONT.forEach(([x, h], k) => stalk(x, h, false, k));
            // sea-grass fans
            for (let k = 0; k < 22; k++) {
                const gx = (k * 47 + 20) % W, len = 9 + (k * 5) % 9;
                for (let b2 = -2; b2 <= 2; b2++) for (let j = 0; j < len - Math.abs(b2) * 2; j++) putw(g, gx + b2 + Math.round((b2 * 0.5 + Math.sin(TAU * f / N + k) * 1.3) * j / len * 2), ground + 3 - j, j > len - 4 ? 'n' : 'Y');
            }
            outlineWrap(g, 'o', 'q');
            return render(g, PALK);
        };
        for (let f = 0; f < N; f++) out['kelp-' + f + '.png'] = frameImg(f);
    }

    // near plants: big dark foreground blades with a rim light, sparse so fish stay visible
    {
        const W = T.NEAR.tw, Hh = T.NEAR.h, N = T.NEAR.frames;
        const PALN = mkPal({ o: '#011', D: '#032', B: '#054', L: '#188', H: '#4b9', G: '#a34', g: '#d58' });
        const blades = [[20, 62, 6, 0.4], [34, 80, 7, 2.1], [49, 50, 5, 3.3], [63, 70, 6, 5.0], [305, 56, 6, 1.2], [320, 74, 7, 2.9], [334, 46, 5, 4.4], [455, 60, 6, 0.9], [470, 40, 5, 2.4], [484, 68, 7, 3.6]];
        const frameImg = f => {
            const g = mk(W, Hh), base = Hh + 2;
            for (const [x, h, w, ph] of blades) for (let i = 0; i < h; i++) {
                const t = i / h, dx = 6 * Math.pow(t, 1.25) * Math.sin(TAU * f / N - i * 0.045 + ph), cx = x + dx, ww = Math.max(2, Math.round(w * (1 - 0.65 * t)));
                for (let k = 0; k < ww; k++) putw(g, cx - ww / 2 + k + 0.5, base - i, k === 0 ? 'L' : (k === ww - 1 ? 'D' : ((i + k) % 7 === 0 ? 'D' : 'B')));
                if (ww > 3 && i % 6 === 3) putw(g, cx - ww / 2 + 1.5, base - i, 'H');
            }
            // a pair of sea-anemone tufts between the blades
            for (const [ax, ah] of [[92, 14], [388, 17], [510, 11]]) for (let r = -5; r <= 5; r++) {
                const len = Math.round(ah - Math.abs(r) * 1.7), sw = Math.round(Math.sin(TAU * f / N + r * 0.8) * 1.5);
                for (let j = 0; j < len; j++) putw(g, ax + r + Math.round(sw * j / len), base - j, j >= len - 2 ? 'g' : (j > len * 0.55 ? 'G' : 'B'));
            }
            outlineWrap(g, 'o', 'o');
            return render(g, PALN);
        };
        for (let f = 0; f < N; f++) out['near-' + f + '.png'] = frameImg(f);
    }
    return out;
};
