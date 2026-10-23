// The "ukiyoe" theme (contents/themes/ukiyoe): textures are up to date with tools/gen-ukiyoe-theme.js, every file
// the QML renderer can ask for exists, every sprite texel is one of the declared pigments, the bokashi water is a
// smooth gradient with a low-contrast Seigaiha pattern (no stripes, no period-2 noise), the sprites face the way
// they swim, and the measurable comfort criteria hold on offscreen renders.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadScript } = require('./harness');
const png = require('./png');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'ukiyoe');
const IMG = path.join(DIR, 'img');
const T = loadScript(path.join(DIR, 'theme.js'));
const exists = f => fs.existsSync(path.join(IMG, f));
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
const load = f => png.decode(fs.readFileSync(path.join(IMG, f)));
const NV = T.WATER.variants.length;

test('ukiyoe textures are up to date (run: node tools/gen-ukiyoe-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-ukiyoe-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every ukiyoe frame the renderer requests exists', () => {
    for (let c = 0; c < T.FISH_CLASSES.length; c++) for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++)
        for (const inv of [false, true]) assert.ok(exists(T.fishFile(c, v, f, inv)), T.fishFile(c, v, f, inv));
    for (const col of Object.keys(T.FISH_VARIANT)) assert.ok(T.FISH_VARIANTS.includes(T.fishVariant(col)));
    assert.strictEqual(new Set(Object.values(T.FISH_VARIANT)).size, 5, 'five variants');
    for (let f = 0; f < 4; f++) {
        for (let v = 0; v < T.ORCA.length; v++) assert.ok(exists(T.orcaFile(v, f)) && exists(T.anglerFile(v, f)));
        assert.ok(exists('orca-' + f + '.png') && exists('angler-' + f + '.png'));
        for (let c = 0; c < T.JELLY.length; c++) assert.ok(exists(T.jellyFile(c, f)));
        for (const life of [1, 0.5, 0.1]) assert.ok(exists(T.wormFile(life, f)));
        for (let k = 0; k < T.KELP.length; k++) assert.ok(exists('kelp-' + k + '-' + f + '.png'));
    }
    for (const s of [1.5, 3]) assert.ok(exists(T.bubbleFile(s)));
    for (let l = 0; l < 3; l++) assert.ok(exists('lure-' + l + '.png'));
    for (let f = 0; f < 2; f++) assert.ok(exists('sparkle-' + f + '.png'));
    for (let l = 0; l < NV; l++) assert.ok(exists(T.waterFile(l)) && exists(T.surfaceFile(l)));
    assert.ok(exists('seabed.png'));
    assert.strictEqual(T.waterLevel(0), 0); assert.strictEqual(T.waterLevel(1), NV - 1);
    for (const f of ['Scene.qml', 'Ambient.qml', 'EntityLayer.qml', 'UkiyoeSprite.qml', 'sync.js', 'README.md', 'preview.png']) assert.ok(fs.existsSync(path.join(DIR, f)), f);
    assert.ok(!fs.existsSync(path.join(DIR, 'img-nishikie')), 'the second texture folder is gone');
});

test('palette: every sprite, surface and seabed texel is a declared pigment (fully opaque or clear)', () => {
    const base = new Set(Object.values(T.PALETTE).map(c => hex(c).join(',')));
    const used = new Set();
    for (const f of fs.readdirSync(IMG)) {
        if (/^water-/.test(f)) continue;
        const ok = new Set(base);
        const m = /^surface-(\d)\.png$/.exec(f);
        if (m) T.WATER.variants[+m[1]].tones.concat(T.WATER.variants[+m[1]].foam).forEach(c => ok.add(hex(c).join(',')));
        const im = load(f);
        for (let i = 0; i < im.W * im.H; i++) {
            const p = im.px.subarray(i * 4, i * 4 + 4);
            if (p[3] === 0) continue;
            assert.strictEqual(p[3], 255, f + ' has a translucent texel');
            const k = p[0] + ',' + p[1] + ',' + p[2];
            assert.ok(ok.has(k), f + ' has an undeclared colour ' + k);
            used.add(k);
        }
    }
    assert.ok(used.size >= 16, 'a colour print uses many pigments, got ' + used.size);
    assert.ok(Object.keys(T.PALETTE).length <= 24, 'limited palette');
});

test('the five koi differ by colour AND pattern (every frame-0 mid sprite is unique, no two share a colour set)', () => {
    const sig = v => { const im = load(T.fishFile(3, v, 0, false)), set = new Set(); for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) set.add(im.px[i * 4] + ',' + im.px[i * 4 + 1] + ',' + im.px[i * 4 + 2]); return [...set].sort().join('|'); };
    const sigs = T.FISH_VARIANTS.map(sig);
    assert.strictEqual(new Set(sigs).size, 5, 'colour sets of the five variants must all differ');
    // the stress (alarm) variant is red: its dominant colour is vermilion
    const im = load(T.fishFile(3, 'ogon', 0, true)), red = hex(T.PALETTE.r);
    const deep = hex(T.PALETTE.R), sumi = hex(T.PALETTE.k);
    let n = 0, tot = 0;
    for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) {
        const c = [im.px[i * 4], im.px[i * 4 + 1]];
        if (c[0] === sumi[0] && c[1] === sumi[1]) continue;                    // the keyblock outline
        tot++;
        if ((c[0] === red[0] && c[1] === red[1]) || (c[0] === deep[0] && c[1] === deep[1])) n++;
    }
    assert.ok(n / tot > 0.8, 'the inverted variant is vermilion (' + n + '/' + tot + ')');
});

test('fish classes, sizes and the seabed / kelp proportions behave', () => {
    assert.strictEqual(T.fishClass(0.5), 0);
    assert.strictEqual(T.fishClass(2.5), 1);
    assert.strictEqual(T.fishClass(4), 3);
    assert.strictEqual(T.fishClass(5), 4);
    assert.strictEqual(T.fishClass(9), T.FISH_CLASSES.length - 1);
    assert.strictEqual(T.fishMag(4), 1);
    assert.strictEqual(T.fishMag(8), 2);
    assert.strictEqual(T.texelDevice(1080), 3);
    assert.strictEqual(T.texelDevice(2160), 6);
    assert.strictEqual(T.texelDevice(500), 2);
    assert.strictEqual(T.kindMag('orca', 5.5), 1);
    assert.strictEqual(T.kindMag('orca', 10), 2);
    assert.strictEqual(T.kindVariant('orca', 1), 1);
    assert.strictEqual(T.kindVariant('angler', 4.2), 0);
    assert.ok(T.SEABED.rows / T.GRID_ROWS <= 0.09);
    assert.ok(Math.max(...T.KELP.map(k => k.rows)) / T.GRID_ROWS <= 0.20);
    for (let x = 0; x < T.SEABED.cols; x += 7) assert.ok(T.seabedTop(x) >= 12 && T.seabedTop(x) <= T.SEABED.rows - 4);
    // the surface strip stays above the creatures' floor and starts below the 54 px top panel (18 texels)
    assert.ok(T.SURFACE.y + T.SURFACE.rows <= T.SURFACE.floor, 'surface strip overlaps the creature floor');
    assert.ok(T.SURFACE.y + 1 >= 18, 'the topmost crest must sit below the 54 px top panel');
});

// busy: the texel is part of an alternation of period <= 2 along x or y (a, b, c with a != b and b != c)
function busyShare(im, x0, y0, win) {
    let n = 0;
    const u = (x, y) => { const o = (y * im.W + x) * 4; return im.px[o] | im.px[o + 1] << 8 | im.px[o + 2] << 16 | im.px[o + 3] << 24; };
    for (let y = y0; y < y0 + win; y++) for (let x = x0; x < x0 + win; x++) {
        if (x + 2 >= im.W || y + 2 >= im.H) continue;
        const a = u(x, y), b = u(x + 1, y), c = u(x + 2, y), d = u(x, y + 1), e = u(x, y + 2);
        if ((a !== b && b !== c) || (a !== d && d !== e)) n++;
    }
    return n / (win * win);
}

test('the bokashi water is a smooth gradient: no stripes, steps of at least `step` rows, flat below the pattern', () => {
    const W = T.WATER.cols, H = T.WATER.rows;
    for (let v = 0; v < NV; v++) {
        const im = load(T.waterFile(v));
        assert.strictEqual(im.W, W); assert.strictEqual(im.H, H);
        const px = (x, y) => Array.from(im.px.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
        for (let i = 0; i < W * H; i++) assert.strictEqual(im.px[i * 4 + 3], 255, 'water must be opaque');
        // below the pattern every row is one flat colour; the rows form runs of at least `step` rows with small steps
        const rowCol = y => px(0, y).join(',');
        let run = 1, last = rowCol(T.WATER.fadeTo + 1), maxStep = 0;
        for (let y = T.WATER.fadeTo + 1; y < H; y++) {
            for (let x = 1; x < W; x++) assert.deepStrictEqual(px(x, y), px(0, y), 'row ' + y + ' of ' + T.waterFile(v) + ' is not flat below the pattern');
            const c = rowCol(y);
            if (c === last) { run++; continue; }
            assert.ok(run >= T.WATER.step, 'a one-row stripe in ' + T.waterFile(v) + ' at row ' + y + ' (run ' + run + ')');
            const a = last.split(',').map(Number), b = c.split(',').map(Number);
            maxStep = Math.max(maxStep, ...a.map((q, k) => Math.abs(q - b[k])));
            run = 1; last = c;
        }
        assert.ok(maxStep <= 4, 'bokashi step of ' + maxStep + ' levels is visible as a stripe');
        // every colour stays inside the declared gradient (+ pattern offsets)
        const vr = T.WATER.variants[v], cols = vr.stops.map(s => hex(s[1]));
        for (let k = 0; k < 3; k++) {
            const lo = Math.min(...cols.map(c => c[k])) - 1, hi = Math.max(...cols.map(c => c[k])) + vr.arc[k] + 1;
            for (let i = 0; i < W * H; i++) { const q = im.px[i * 4 + k]; assert.ok(q >= lo && q <= hi, T.waterFile(v) + ' channel ' + k + ' out of the gradient range'); }
        }
        // the sea's bottom row is the colour under everything
        assert.deepStrictEqual(px(0, H - 1).slice(0, 3), hex(T.DEEP));
        // the Seigaiha pattern exists in the upper sea (several tones per row) and is low contrast
        const tones = new Set();
        for (let x = 0; x < W; x++) tones.add(px(x, 60).join(','));
        assert.ok(tones.size >= 3, 'seigaiha tones in row 60: ' + tones.size);
        const d = (a, b) => Math.max(...a.map((q, k) => Math.abs(q - b[k])));
        let hiC = 0;
        for (const t of tones) hiC = Math.max(hiC, d(t.split(',').map(Number), px(0, 60)));
        assert.ok(hiC <= 70, 'the pattern must stay low contrast');
    }
});

test('no 24x24 window of the background textures is a period <= 2 pattern (checker, stipple, 1-texel hatching)', () => {
    const files = [];
    for (let v = 0; v < NV; v++) files.push(T.waterFile(v), T.surfaceFile(v));
    files.push('seabed.png');
    for (const f of files) {
        const im = load(f);
        let worst = 0;
        for (const win of [8, 24]) {       // 8 texels = a 24 px window at 1080p; 24 texels = a 24x24 window of the texture
            const st = win / 2;
            for (let y = 0; y + win <= im.H; y += (/surface/.test(f) ? 1 : st)) for (let x = 0; x + win <= im.W; x += st) worst = Math.max(worst, busyShare(im, x, y, win));
            assert.ok(worst < 0.5, f + ': a ' + win + 'x' + win + ' window is ' + (worst * 100).toFixed(0) + '% busy');
            worst = 0;
        }
    }
});

test('the seigaiha tile repeats without a seam and the surface strip starts below the top panel', () => {
    for (let v = 0; v < NV; v++) {
        const im = load(T.waterFile(v));
        for (let y = 36; y < 150; y += 7) {
            const a = im.px.subarray((y * im.W) * 4, (y * im.W) * 4 + 4), b = im.px.subarray((y * im.W + im.W - 1) * 4, (y * im.W + im.W - 1) * 4 + 4), c = im.px.subarray((y * im.W + 1) * 4, (y * im.W + 1) * 4 + 4);
            const dd = (p, q) => Math.max(...[0, 1, 2].map(k => Math.abs(p[k] - q[k])));
            assert.ok(dd(a, b) <= 40 && dd(a, c) <= 40, 'seam at row ' + y);
        }
    }
    const s = load(T.surfaceFile(NV - 1));
    let first = -1;
    for (let y = 0; y < s.H && first < 0; y++) for (let x = 0; x < s.W; x++) if (s.px[(y * s.W + x) * 4 + 3]) { first = y; break; }
    assert.ok(T.SURFACE.y + first >= 18, 'the topmost crest pixel is on row ' + (T.SURFACE.y + first) + ', must be below the 54 px top panel (row 18)');
    // wrap: the wave line is periodic over the strip width, so its left and right edges join (no step at the seam)
    const topRow = x => { for (let y = 0; y < s.H; y++) if (s.px[(y * s.W + x) * 4 + 3]) return y; return s.H; };
    assert.ok(Math.abs(topRow(0) - topRow(s.W - 1)) <= 1, 'the wave line steps at the seam of the strip');
});

// ── the wave form: a calm, regular crest line; the Seigaiha fans ──
const lumaOf = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function surfaceInfo(v) {
    const im = load(T.surfaceFile(v)), W = im.W, H = im.H;
    const hexOf = c => hex(c).join(','), vr = T.WATER.variants[v];
    const key = (x, y) => { const o = (y * W + x) * 4; return im.px[o + 3] ? im.px[o] + ',' + im.px[o + 1] + ',' + im.px[o + 2] : null; };
    const ink = hexOf(T.PALETTE.i), foam = new Set(vr.foam.map(hexOf));
    return { im, W, H, key, ink, foam, top: Array.from({ length: W }, (_, x) => { for (let y = 0; y < H; y++) if (key(x, y)) return y; return H; }) };
}

test('surface strip: calm and regular, small soft crests at an even rhythm on a gentle swell', () => {
    // the whole 1920 px at 1080p in one tile, so the pattern never repeats on a 1080p screen
    assert.ok(T.SURFACE.cols * T.texelDevice(1080) >= 1920, 'strip is ' + T.SURFACE.cols * T.texelDevice(1080) + ' px wide at 1080p');
    for (let v = 0; v < NV; v++) {
        const { W, top } = surfaceInfo(v);
        const base = top.slice().sort((a, b) => a - b)[Math.floor(W * 0.6)];            // the typical wave line row
        const inCrest = top.map(t => t <= base - 3);
        // peaks: runs of crest columns
        const peaks = [];
        for (let x = 0; x < W; x++) if (inCrest[x]) {
            let x1 = x, best = top[x];
            while (x1 + 1 < W && inCrest[x1 + 1]) { x1++; best = Math.min(best, top[x1]); }
            peaks.push({ x0: x, x1, h: base - best, c: (x + x1) / 2 }); x = x1;
        }
        assert.ok(peaks.length >= 10 && peaks.length <= 14, peaks.length + ' crests');
        // small: no tall curler, no flat ripple; one crest every 53 texels or so (an even rhythm)
        assert.ok(Math.max(...peaks.map(p => p.h)) <= 10 && Math.min(...peaks.map(p => p.h)) >= 3, 'crest heights ' + peaks.map(p => p.h).join(','));
        const gaps = peaks.slice(1).map((p, i) => p.c - peaks[i].c);
        assert.ok(Math.min(...gaps) >= 44 && Math.max(...gaps) <= 64, 'crest spacing ' + gaps.join(','));
        // gentle swell: the troughs between crests rise and fall by only a few texels over the strip
        const trough = top.filter((t, x) => !inCrest[x]);
        assert.ok(Math.max(...trough) - Math.min(...trough) >= 1 && Math.max(...trough) - Math.min(...trough) <= 4, 'swell range of ' + (Math.max(...trough) - Math.min(...trough)) + ' texels');
        // no claws and nothing hanging: the topmost texel of every column is directly above the rest of it (no overhang)
        const { im } = surfaceInfo(v);
        for (let x = 0; x < W; x++) for (let y = top[x]; y < im.H; y++) assert.ok(im.px[(y * W + x) * 4 + 3], 'a hole in column ' + x + ' at row ' + y);
    }
});

test('surface strip: constant 1-texel indigo outline, flat two-tone foam, no specks, no single-texel noise', () => {
    for (let v = 0; v < NV; v++) {
        const { W, H, key, ink, foam } = surfaceInfo(v);
        const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const nb = (x, y, dx, dy) => (y + dy < 0 || y + dy >= H) ? null : key((x + dx + W) % W, y + dy);
        const seen = new Set();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const c = key(x, y);
            if (!c) continue;
            if (foam.has(c)) seen.add(c);
            for (const [dx, dy] of N) {
                const n = nb(x, y, dx, dy);
                if (y + dy < 0) continue;
                // every silhouette edge texel is the keyblock indigo; foam only ever touches foam or indigo
                if (n === null && y + dy < H) assert.strictEqual(c, ink, T.surfaceFile(v) + ' silhouette texel ' + x + ',' + y + ' is not outline');
                if (foam.has(c)) assert.ok(n === null || foam.has(n) || n === ink, T.surfaceFile(v) + ' foam touches a non-outline blue at ' + x + ',' + y);
            }
            // an outline texel with no outline neighbour is a speck
            if (c === ink) assert.ok(N.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]).some(([dx, dy]) => nb(x, y, dx, dy) === ink), T.surfaceFile(v) + ' isolated outline texel at ' + x + ',' + y);
        }
        assert.ok(seen.size <= 2, 'foam in at most two tones');
        // foam pieces: 4-connected components of at least 8 texels (no isolated specks)
        const lab = new Int32Array(W * H).fill(-1);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (lab[y * W + x] >= 0 || !foam.has(key(x, y))) continue;
            const st = [[x, y]]; lab[y * W + x] = 1; let n = 0;
            while (st.length) {
                const [cx, cy] = st.pop(); n++;
                for (const [dx, dy] of N) {
                    const nx = (cx + dx + W) % W, ny = cy + dy;
                    if (ny < 0 || ny >= H || lab[ny * W + nx] >= 0 || !foam.has(key(nx, ny))) continue;
                    lab[ny * W + nx] = 1; st.push([nx, ny]);
                }
            }
            assert.ok(n >= 8, T.surfaceFile(v) + ': a foam speck of ' + n + ' texels at ' + x + ',' + y);
        }
    }
});

test('the wave line is smooth: the silhouette rows change by one texel at a time with a steady rhythm', () => {
    const { W, top } = surfaceInfo(NV - 1);
    // no jump of more than 2 rows between neighbouring columns except at the lip of a curl (counted), and no
    // 1-column zigzag (up, down) anywhere
    let zig = 0, jumps = 0;
    for (let x = 1; x < W - 1; x++) {
        const a = top[x] - top[x - 1], b = top[x + 1] - top[x];
        if (a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)) zig++;
        if (Math.abs(a) > 2) jumps++;
    }
    assert.ok(zig <= 12, zig + ' one-column zigzags in the wave line');
    assert.ok(jumps <= 24, jumps + ' steep jumps');
});

test('Seigaiha: the classic fan pattern, scales of 16 texels with a clear lighter outline, over the upper sea', () => {
    assert.strictEqual(T.WATER.scale, 16, 'scale radius ' + T.WATER.scale + ' texels');
    assert.strictEqual(T.WATER.cols % (2 * T.WATER.scale), 0, 'the tile holds a whole number of scales');
    assert.ok(T.WATER.fadeTo >= 200 && T.WATER.fadeTo <= 220, 'the pattern fades out at row ' + T.WATER.fadeTo);
    for (const vr of T.WATER.variants) {
        const L = lumaOf(vr.arc);
        assert.ok(L >= 18 && L <= 40, vr.name + ': outline step of ' + L.toFixed(1) + ' levels');
    }
    // every baked image shows the fans: several tones in a row of the upper sea, low contrast against the bokashi
    for (let v = 0; v < NV; v++) {
        const im = load(T.waterFile(v)), y = 60, tones = new Set();
        for (let x = 0; x < im.W; x++) tones.add(Array.from(im.px.subarray((y * im.W + x) * 4, (y * im.W + x) * 4 + 3)).join(','));
        assert.ok(tones.size >= 3, T.waterFile(v) + ': no fans in row ' + y);
    }
});

test('sprites face the way they swim (fish and orca), read from the real sync.js', () => {
    const code = fs.readFileSync(path.join(DIR, 'sync.js'), 'utf8').replace(/^\.pragma library.*$/m, '').replace(/^\.import .*$/mg, '');
    const ctx = vm.createContext({ T, Math, Boids: { _now: () => 0, _report: e => { throw e; } } });
    vm.runInContext(code, ctx, { filename: 'sync.js' });
    const make = (kind, vx) => {
        // the simulation's facing rules (boids-core.js): fish face right while vx >= 0, orca face right while vx < 0
        const facingRight = kind === 'orca' ? vx < 0 : vx >= 0;
        return { kind, x: 300, y: 300, vx, vy: 0, facingRight, color: '#FF8080', sizeVariation: 0, delegate: null, wobble: 0, wiggle: 0, life: 1 };
    };
    for (const kind of ['fish', 'orca']) for (const vx of [2, -2]) {
        const ent = make(kind, vx), lists = kind === 'fish' ? [[ent], []] : [[], [ent]];
        const sim = { width: 1920, height: 1080, _c: { fishSize: 4, orcaSize: 5.5, anglerSize: 4.2, jellySize: 3, wormSize: 4 }, cpuStress: 0, allLists: [[], [], []] };
        sim.allLists = kind === 'fish' ? [lists[0]] : [lists[1]];
        const comp = { beginTick() {}, place() {}, target() {}, createObject: (p, props) => Object.assign({ z: 0, seed: 0.5, phase: 0, tick: 0 }, props) };
        ctx.sync(sim, null, comp, 3, 1);
        assert.strictEqual(ent.delegate.flip, vx < 0, kind + ' moving ' + (vx > 0 ? 'right' : 'left') + ' must be mirrored only when moving left');
    }
});

test('ukiyoe measurable criteria (needs qml6): calm backdrop, smooth motion, comfort, proportions, stress', { timeout: 600000 }, t => {
    const r = spawnSync('node', [path.join(__dirname, 'ukiyoe-measure.js')], { encoding: 'utf8', timeout: 580000, env: Object.assign({}, process.env, { QUIET: '1' }) });
    if (r.status === 77) return t.skip('qml6 unavailable');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
