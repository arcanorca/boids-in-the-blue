// The "onebit" theme (contents/themes/onebit): textures are up to date with tools/gen-onebit-theme.js,
// every file the QML renderer can ask for exists, and every texel is INK, PAPER or transparent.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');
const png = require('./png');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'onebit');
const T = loadScript(path.join(DIR, 'theme.js'));
const exists = f => fs.existsSync(path.join(DIR, T.DIR, f));

test('onebit textures are up to date (run: node tools/gen-onebit-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-onebit-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every onebit frame the renderer requests exists', () => {
    for (let c = 0; c < T.FISH_CLASSES.length; c++) for (const v of T.FISH_VARIANTS) for (let f = 0; f < T.FISH_FRAMES; f++)
        for (const inv of [false, true]) assert.ok(exists(T.fishFile(c, v, f, inv)), T.fishFile(c, v, f, inv));
    for (const col of Object.keys(T.FISH_VARIANT)) assert.ok(T.FISH_VARIANTS.includes(T.fishVariant(col)));
    for (let f = 0; f < 4; f++) {
        assert.ok(exists('orca-' + f + '.png') && exists('angler-' + f + '.png'));
        for (let c = 0; c < T.JELLY.length; c++) assert.ok(exists(T.jellyFile(c, f)));
        for (const life of [1, 0.5, 0.1]) assert.ok(exists(T.wormFile(life, f)));
    }
    for (const s of [1.5, 3]) assert.ok(exists(T.bubbleFile(s)));
    for (let l = 0; l < 3; l++) assert.ok(exists('lure-' + l + '.png') && exists('glow-' + l + '.png'));
    for (let f = 0; f < 2; f++) assert.ok(exists('sparkle-' + f + '.png'));
    for (let l = 0; l < 4; l++) assert.ok(exists('shaft-' + l + '.png'));
    for (let l = 0; l <= 64; l++) for (let h = 0; h < 2; h++) assert.ok(exists(T.noiseFile(l, h)));
    for (const d of [0, 0.3, 0.77, 1]) for (const p of [0, 0.5, 1]) assert.ok(exists(T.waterFile(d, p, 3)));
    for (const f of ['seabed.png', 'surface.png']) assert.ok(exists(f));
    for (let k = 0; k < T.KELP.length; k++) for (let f = 0; f < 3; f++) assert.ok(exists('kelp-' + k + '-' + f + '.png'));
    for (const f of ['Scene.qml', 'Ambient.qml', 'EntityLayer.qml', 'OneBitSprite.qml', 'sync.js', 'README.md', 'preview.png']) assert.ok(fs.existsSync(path.join(DIR, f)), f);
});

test('onebit is strictly two colours: every texel of every texture is ink, paper or fully transparent', () => {
    const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
    const ink = hex(T.INK), paper = hex(T.PAPER);
    for (const f of fs.readdirSync(path.join(DIR, T.DIR))) {
        const im = png.decode(fs.readFileSync(path.join(DIR, T.DIR, f)));
        for (let i = 0; i < im.W * im.H; i++) {
            const p = im.px.subarray(i * 4, i * 4 + 4);
            if (p[3] === 0) continue;
            assert.strictEqual(p[3], 255, f + ' has a translucent texel');
            assert.ok((p[0] === ink[0] && p[1] === ink[1] && p[2] === ink[2]) || (p[0] === paper[0] && p[1] === paper[1] && p[2] === paper[2]), f + ' has a third colour');
        }
    }
});

test('fish classes and the water ramp behave', () => {
    assert.strictEqual(T.fishClass(0.5), 0);
    assert.strictEqual(T.fishClass(2.5), 1);
    assert.strictEqual(T.fishClass(4), 3);
    assert.strictEqual(T.fishClass(9), T.FISH_CLASSES.length - 1);
    assert.strictEqual(T.fishMag(4), 1);
    assert.strictEqual(T.fishMag(8), 2);
    for (const d of [0, 0.5, 1]) {      // darker with depth, lighter by day
        let prev = 2;
        for (let p = 0; p <= 1; p += 0.1) { const v = T.waterDensity(d, p); assert.ok(v <= prev + 1e-9 && v >= 0 && v <= 1); prev = v; }
    }
    assert.ok(T.waterDensity(1, 0.3) > T.waterDensity(0, 0.3));
    assert.strictEqual(T.texelDevice(1080), 3);
    assert.strictEqual(T.texelDevice(2160), 6);
    assert.strictEqual(T.texelDevice(500), 2);
});
