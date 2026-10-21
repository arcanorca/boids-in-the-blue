// The "ukiyoe" theme (contents/themes/ukiyoe): textures are up to date with tools/gen-ukiyoe-theme.js (both
// palette sets), every file the QML renderer can ask for exists, the default set is exactly INK and PAPER, the
// Ryuusen water is made of connected strokes, the sprites face the way they swim, and the measurable comfort
// criteria hold on offscreen renders.
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
const T = loadScript(path.join(DIR, 'theme.js'));
const SETS = ['img/', 'img-nishikie/'];
const exists = (set, f) => fs.existsSync(path.join(DIR, set, f));
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));

test('ukiyoe textures are up to date in both palette sets (run: node tools/gen-ukiyoe-theme.js [NISHIKIE=1])', () => {
    const gen = path.join(ROOT, 'tools', 'gen-ukiyoe-theme.js');
    const r = spawnSync('node', [gen, '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    const n = spawnSync('node', [gen, '--check'], { encoding: 'utf8', env: Object.assign({}, process.env, { NISHIKIE: '1' }) });
    assert.strictEqual(n.status, 0, n.stderr);
});

test('every ukiyoe frame the renderer requests exists in both sets', () => {
    for (const set of SETS) {
        for (let c = 0; c < T.FISH_CLASSES.length; c++) for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++)
            for (const inv of [false, true]) assert.ok(exists(set, T.fishFile(c, v, f, inv)), set + T.fishFile(c, v, f, inv));
        for (const col of Object.keys(T.FISH_VARIANT)) assert.ok(T.FISH_VARIANTS.includes(T.fishVariant(col)));
        for (let f = 0; f < 4; f++) {
            for (let v = 0; v < T.ORCA.length; v++) assert.ok(exists(set, T.orcaFile(v, f)) && exists(set, T.anglerFile(v, f)));
            assert.ok(exists(set, 'orca-' + f + '.png') && exists(set, 'angler-' + f + '.png'));
            for (let c = 0; c < T.JELLY.length; c++) assert.ok(exists(set, T.jellyFile(c, f)));
            for (const life of [1, 0.5, 0.1]) assert.ok(exists(set, T.wormFile(life, f)));
            for (let k = 0; k < T.KELP.length; k++) assert.ok(exists(set, 'kelp-' + k + '-' + f + '.png'));
        }
        for (const s of [1.5, 3]) assert.ok(exists(set, T.bubbleFile(s)));
        for (let l = 0; l < 3; l++) assert.ok(exists(set, 'lure-' + l + '.png'));
        for (let f = 0; f < 2; f++) assert.ok(exists(set, 'sparkle-' + f + '.png'));
        for (let l = 0; l < T.WATER.layers; l++) assert.ok(exists(set, T.waterFile(l)));
        for (const f of ['seabed.png', 'surface.png']) assert.ok(exists(set, f));
    }
    for (const f of ['Scene.qml', 'Ambient.qml', 'EntityLayer.qml', 'UkiyoeSprite.qml', 'sync.js', 'README.md', 'preview.png']) assert.ok(fs.existsSync(path.join(DIR, f)), f);
});

test('the default ukiyoe set is strictly two colours: every texel is INK, PAPER or fully transparent', () => {
    const ink = hex(T.INK), paper = hex(T.PAPER);
    for (const f of fs.readdirSync(path.join(DIR, 'img'))) {
        const im = png.decode(fs.readFileSync(path.join(DIR, 'img', f)));
        for (let i = 0; i < im.W * im.H; i++) {
            const p = im.px.subarray(i * 4, i * 4 + 4);
            if (p[3] === 0) continue;
            assert.strictEqual(p[3], 255, f + ' has a translucent texel');
            assert.ok((p[0] === ink[0] && p[1] === ink[1] && p[2] === ink[2]) || (p[0] === paper[0] && p[1] === paper[1] && p[2] === paper[2]), f + ' has a third colour');
        }
    }
});

test('the Nishiki-e set uses only the pigment palette (no translucent texels, at most seven colours)', () => {
    const seen = new Set();
    for (const f of fs.readdirSync(path.join(DIR, 'img-nishikie'))) {
        const im = png.decode(fs.readFileSync(path.join(DIR, 'img-nishikie', f)));
        for (let i = 0; i < im.W * im.H; i++) {
            const p = im.px.subarray(i * 4, i * 4 + 4);
            if (p[3] === 0) continue;
            assert.strictEqual(p[3], 255, f + ' has a translucent texel');
            seen.add(p[0] + ',' + p[1] + ',' + p[2]);
        }
    }
    assert.ok(seen.size >= 3 && seen.size <= 7, 'colours in the pigment set: ' + seen.size);
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

test('the Ryuusen water is strokes: every paper piece is at least minRun texels long, layers only grow', () => {
    const W = T.WATER.cols, H = T.WATER.rows;
    let prev = null;
    for (let l = 0; l < T.WATER.layers; l++) {
        const im = png.decode(fs.readFileSync(path.join(DIR, 'img', T.waterFile(l))));
        assert.strictEqual(im.W, W); assert.strictEqual(im.H, H);
        const on = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) on[i] = im.px[i * 4 + 3] === 255 && im.px[i * 4] === hex(T.PAPER)[0] ? 1 : 0;
        if (prev) for (let i = 0; i < W * H; i++) assert.ok(!prev[i] || on[i], 'layer ' + l + ' drops a stroke of layer ' + (l - 1));
        prev = on;
        const comp = new Int32Array(W * H).fill(-1);
        for (let i = 0; i < W * H; i++) {
            if (!on[i] || comp[i] >= 0) continue;
            const cells = [], stack = [i];
            comp[i] = i;
            while (stack.length) {
                const c = stack.pop(); cells.push(c);
                const cx = c % W, cy = (c - cx) / W;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const ny = cy + dy, nx = (cx + dx + W) % W;
                    if (ny < 0 || ny >= H) continue;
                    const j = ny * W + nx;
                    if (on[j] && comp[j] < 0) { comp[j] = i; stack.push(j); }
                }
            }
            const xs = [...new Set(cells.map(c => c % W))].sort((a, b) => a - b);
            let gap = xs[0] + W - xs[xs.length - 1];
            for (let k = 1; k < xs.length; k++) gap = Math.max(gap, xs[k] - xs[k - 1]);
            assert.ok(W - gap + 1 >= T.WATER.minRun, 'water layer ' + l + ': a piece is only ' + (W - gap + 1) + ' texels long');
        }
        if (l === T.WATER.layers - 1) {
            const share = on.reduce((a, b) => a + b, 0) / (W * T.GRID_ROWS);
            assert.ok(share < 0.08, 'full-day paper share of the water ' + share);
        }
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
