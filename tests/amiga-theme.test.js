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
        kd.classes.forEach((cl, ci) => {
            for (let f = 0; f < kd.frames; f++) {
                const variants = k === 'fish' ? Object.keys(t.FISH_VARIANT).flatMap(c => [0, 1, 2, 3].map(l => t.fishStressVariant(c, l))).concat(['alarm']) : [''];
                for (const v of variants) {
                    const file = t.frameFile(k, ci, v, f);
                    assert.ok(exists(file), file);
                    const im = png.decode(fs.readFileSync(path.join(DIR, t.DIR, file)));
                    assert.deepStrictEqual([im.W, im.H], [cl.cols, cl.rows], file);
                }
            }
        });
    }
    for (const f of ['glow.png', 'spark.png', 'lure-0.png', 'lure-1.png', 'lure-2.png', 'far.png', 'ground.png'].concat(
        t.COPPER.lists.map(l => 'copper-' + l + '.png'),
        Array.from({ length: t.CAUSTICS.frames }, (_, i) => 'caustics-' + i + '.png'),
        Array.from({ length: t.KELP.frames }, (_, i) => 'kelp-' + i + '.png'),
        Array.from({ length: t.NEAR.frames }, (_, i) => 'near-' + i + '.png'))) assert.ok(exists(f), f);
    assert.strictEqual(t.LURE.length, t.kinds.angler.frames);
});

test('every amiga texel is a 12-bit colour (channels multiples of 0x11)', () => {
    const t = T(), dir = path.join(DIR, t.DIR);
    for (const f of fs.readdirSync(dir)) {
        const im = png.decode(fs.readFileSync(path.join(dir, f)));
        for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) for (let k = 0; k < 3; k++) assert.strictEqual(im.px[i * 4 + k] % 17, 0, f);
    }
});

test('vpFor: integer virtual pixel size from the screen height, enough scanlines for the copper', () => {
    const t = T();
    for (const h of [360, 600, 768, 900, 1080, 1200, 1440, 2160, 4320]) {
        const vp = t.vpFor(h);
        assert.ok(Number.isInteger(vp) && vp >= 1, h + ' -> ' + vp);
        assert.ok(h / vp <= t.COPPER.h, h + ': ' + h / vp + ' lines');
    }
    assert.strictEqual(t.vpFor(1080), 4);
    assert.strictEqual(t.vpFor(2160), 8);
});

test('classFor picks a class for every size and fish stress variants cover the steps', () => {
    const t = T();
    for (const k in t.kinds) for (const s of [0.1, 0.5, 2.5, 3, 4, 5, 5.5, 10]) assert.ok(t.classFor(k, s) < t.kinds[k].classes.length);
    assert.strictEqual(t.classFor('fish', 0.5), 0);
    assert.strictEqual(t.classFor('fish', 5), 3);
    assert.strictEqual(t.fishStressVariant('#4DCCE6', 0), 'aqua');
    assert.strictEqual(t.fishStressVariant('#4DCCE6', 1), 'aqua-w1');
    assert.strictEqual(t.fishStressVariant('#4DCCE6', t.STRESS_STEPS), 'red');
});
