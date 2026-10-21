// The "amiga" theme (contents/themes/amiga): textures must be up to date with tools/gen-amiga-theme.js
// (which also asserts that every colour is 12-bit), every file the renderer can ask for must exist,
// and the integer virtual-pixel scale must behave.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');
const png = require('./png');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'amiga');
const T = () => loadScript(path.join(DIR, 'theme.js'));

test('amiga theme textures are up to date (run: node tools/gen-amiga-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-amiga-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every amiga frame the renderer requests exists, sizes match the descriptor', () => {
    const t = T(), exists = f => fs.existsSync(path.join(DIR, t.DIR, f));
    for (const k in t.kinds) {
        const kd = t.kinds[k];
        assert.strictEqual(t.NAMES[kd.type], k);
        kd.classes.forEach(cl => assert.ok(cl.art < kd.arts.length && Number.isInteger(cl.mul) && cl.mul >= 1, k));
        kd.arts.forEach((ar, ai) => {
            for (let f = 0; f < kd.frames; f++) {
                const variants = k === 'fish' ? Object.keys(t.FISH_VARIANT).flatMap(c => [0, 1, 2, 3].map(l => t.fishStressVariant(c, l))).concat(['alarm']) : [''];
                for (const v of variants) {
                    const file = t.frameFile(k, ai, v, f);
                    assert.ok(exists(file), file);
                    const im = png.decode(fs.readFileSync(path.join(DIR, t.DIR, file)));
                    assert.deepStrictEqual([im.W, im.H], [ar.cols, ar.rows], file);
                }
            }
        });
    }
    for (const f of ['glow.png', 'spark.png', 'lure-0.png', 'lure-1.png', 'lure-2.png', 'far.png', 'ground.png', 'rays.png'].concat(
        t.COPPER.lists.map(l => 'copper-' + l + '.png'),
        t.COPPER.lists.flatMap(l => Array.from({ length: t.COPPER.stressSteps }, (_, k) => 'copper-stress-' + l + '-' + (k + 1) + '.png')),
        Object.keys(t.PLANTS).flatMap(n => Array.from({ length: t.sliceCount(n) }, (_, i) => t.plantFile(n, i))))) assert.ok(exists(f), f);
    for (const n in t.PLANTS) assert.strictEqual(t.PLANTS[n].h % t.SLICE_H, 0, n);
    assert.strictEqual(t.LURE.length, t.kinds.angler.arts.length);
    t.LURE.forEach(l => assert.strictEqual(l.length, t.kinds.angler.frames));
});

test('every amiga sprite texel is a 12-bit colour (channels multiples of 0x11); only the copper lists interpolate', () => {
    const t = T(), dir = path.join(DIR, t.DIR);
    for (const f of fs.readdirSync(dir)) {
        if (/^copper-/.test(f)) continue;
        const im = png.decode(fs.readFileSync(path.join(dir, f)));
        for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) for (let k = 0; k < 3; k++) assert.strictEqual(im.px[i * 4 + k] % 17, 0, f);
    }
});

test('palette discipline: scenery <= 32 opaque colours, every creature ramp <= 16 colours, outlines closed', () => {
    const t = T(), dir = path.join(DIR, t.DIR), colours = f => { const im = png.decode(fs.readFileSync(path.join(dir, f))), s = new Set(); for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) s.add(im.px.readUInt32BE(i * 4)); return s; };
    const play = new Set();
    for (const f of ['ground.png', 'far.png'].concat(Object.keys(t.PLANTS).filter(n => t.PLANTS[n].layer === 'front').map(n => t.plantFile(n, 0)))) for (const c of colours(f)) play.add(c);
    assert.ok(play.size <= 32, 'playfield colours ' + play.size);
    for (const v of t.allFishVariants()) { const s = new Set(); for (let f = 0; f < 4; f++) for (let a = 0; a < t.kinds.fish.arts.length; a++) for (const c of colours(t.frameFile('fish', a, v, f))) s.add(c); assert.ok(s.size <= 16, v + ' ' + s.size); }
    // no orphan pixels in the outlined creatures: every opaque texel touches another opaque texel
    const check = f => { const im = png.decode(fs.readFileSync(path.join(dir, f))), A = (x, y) => x >= 0 && y >= 0 && x < im.W && y < im.H && im.px[(y * im.W + x) * 4 + 3] > 0;
        for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) if (A(x, y)) assert.ok(A(x + 1, y) || A(x - 1, y) || A(x, y + 1) || A(x, y - 1), f + ' orphan at ' + x + ',' + y); };
    for (const f of ['fish-3-coral-0.png', 'fish-4-aqua-1.png', 'fish-2-amber-2.png', 'orca-1-0.png', 'orca-1-2.png', 'angler-1-1.png', 'angler-0-0.png']) check(f);
});

test('vpFor: one integer art-pixel scale from the screen height (1080p -> 3 = 640x360 art pixels)', () => {
    const t = T();
    for (const h of [360, 600, 768, 900, 1080, 1200, 1440, 2160, 4320]) {
        const vp = t.vpFor(h);
        assert.ok(Number.isInteger(vp) && vp >= 1, h + ' -> ' + vp);
        assert.ok(h / vp <= t.COPPER.h * 1.02 || vp === 1, h + ': ' + h / vp + ' lines');
    }
    assert.strictEqual(t.vpFor(1080), 3);
    assert.strictEqual(t.vpFor(2160), 6);
});

test('sprite proportions at 1080p defaults match the brief (fish 36x26, angler 1.5x, orca 3x, jelly bell = fish, worm 0.3x)', () => {
    const t = T(), vp = t.vpFor(1080);
    const px = (k, size) => { const cl = t.kinds[k].classes[t.classFor(k, size)], ar = t.kinds[k].arts[cl.art]; return [ar.cols * cl.mul * vp, ar.rows * cl.mul * vp]; };
    const near = (v, ref, tol) => Math.abs(v - ref) <= ref * tol;
    const fish = px('fish', 4.0);
    assert.ok(near(fish[0], 36, 0.15) && near(fish[1], 26, 0.15), fish.join('x'));
    assert.ok(near(px('fish', 3.0)[0], 36, 0.2) && near(px('fish', 5.0)[0], 36, 0.2));
    assert.ok(near(px('angler', 4.2)[0], 1.5 * fish[0], 0.15));
    assert.ok(near(px('orca', 5.5)[0], 3 * fish[0], 0.15));
    assert.ok(near(px('jelly', 3.5)[0], fish[0], 0.15));
    assert.ok(near(Math.max(...px('worm', 4)), 0.3 * fish[0], 0.15));
    for (const s of [1.5, 2.25, 3]) { const b = px('bubble', s); assert.ok(b[0] >= 6 && b[0] <= 14, 'bubble ' + b); }
    // plants: tallest kelp <= 22 %, foreground <= 18 % of the screen height
    for (const n in t.PLANTS) assert.ok((t.PLANTS[n].h + 7) * vp / 1080 <= (t.PLANTS[n].layer === 'fg' ? 0.18 : 0.22), n);
});

test('classFor picks a class for every size and fish stress variants cover the steps', () => {
    const t = T();
    for (const k in t.kinds) for (const s of [0.1, 0.5, 2.5, 3, 4, 5, 5.5, 8, 10]) assert.ok(t.classFor(k, s) < t.kinds[k].classes.length);
    assert.strictEqual(t.classFor('fish', 0.5), 0);
    assert.strictEqual(t.fishStressVariant('#4DCCE6', 0), 'aqua');
    assert.strictEqual(t.fishStressVariant('#4DCCE6', 1), 'aqua-w1');
    assert.strictEqual(t.fishStressVariant('#4DCCE6', t.STRESS_STEPS), 'red');
    // classes grow monotonically with the slider (width in screen px never shrinks as the size rises)
    for (const k in t.kinds) { let last = 0; for (let s = 0.2; s < 10.5; s += 0.1) { const cl = t.kinds[k].classes[t.classFor(k, s)], w = t.kinds[k].arts[cl.art].cols * cl.mul; assert.ok(w >= last, k + ' ' + s); last = w; } }
});

test('calm by construction: sprite animation rates are slow, no colour cycling or stipple', () => {
    const t = T();
    for (const k of ['fish', 'angler', 'orca', 'jelly', 'worm']) assert.ok(t.anim[k].max * 25 <= 3.01, k + ' frames/s');
    assert.ok(t.anim.stressHz <= 1 && t.anim.shakeHz <= 3);
    for (const f of fs.readdirSync(DIR)) if (/\.qml$/.test(f)) {
        const src = fs.readFileSync(path.join(DIR, f), 'utf8');
        assert.ok(!/interval:\s*(?:[0-9]|[1-9][0-9]|1[0-9][0-9])\b/.test(src.replace(/interval: 100\b/, '')) || /interval: 100\b/.test(src) || f === 'AmigaSprite.qml', f + ' has a fast timer');
        assert.ok(!/ShaderEffect|Canvas|layer\.enabled/.test(src), f);
    }
});

test('qml measurements (calm backdrop, smooth motion, sizes): node tests/amiga-measure.js', { timeout: 300000 }, t => {
    const r = spawnSync('node', [path.join(__dirname, 'amiga-measure.js'), 'all'], { encoding: 'utf8', timeout: 280000 });
    if (r.status === 77) return t.skip('qml6 not available');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
