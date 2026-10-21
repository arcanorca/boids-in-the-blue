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
        for (let v = 0; v < T.ORCA.length; v++) assert.ok(exists(T.orcaFile(v, f)) && exists(T.anglerFile(v, f)));
        assert.ok(exists('orca-' + f + '.png') && exists('angler-' + f + '.png'));
        for (let c = 0; c < T.JELLY.length; c++) assert.ok(exists(T.jellyFile(c, f)));
        for (const life of [1, 0.5, 0.1]) assert.ok(exists(T.wormFile(life, f)));
        for (let k = 0; k < T.KELP.length; k++) assert.ok(exists('kelp-' + k + '-' + f + '.png'));
    }
    for (const s of [1.5, 3]) assert.ok(exists(T.bubbleFile(s)));
    for (let l = 0; l < 3; l++) assert.ok(exists('lure-' + l + '.png'));
    for (let f = 0; f < 2; f++) assert.ok(exists('sparkle-' + f + '.png'));
    for (let l = 0; l < T.WATER.layers; l++) assert.ok(exists(T.waterFile(l)));
    for (const f of ['seabed.png', 'surface.png']) assert.ok(exists(f));
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

test('fish classes, sizes and the backdrop budget behave', () => {
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
    // sliders scale by whole texels: small variant far below the default, 2x / 3x far above
    assert.strictEqual(T.kindMag('orca', 5.5), 1);
    assert.strictEqual(T.kindMag('orca', 10), 2);
    assert.strictEqual(T.kindVariant('orca', 1), 1);
    assert.strictEqual(T.kindVariant('angler', 4.2), 0);
    // proportions at 1080p (3 px per texel): seabed <= 9 % of the height, tallest kelp <= 20 %
    assert.ok(T.SEABED.rows / T.GRID_ROWS <= 0.09);
    assert.ok(Math.max(...T.KELP.map(k => k.rows)) / T.GRID_ROWS <= 0.20);
    // the seabed ridge stays inside its strip
    for (let x = 0; x < T.SEABED.cols; x += 7) assert.ok(T.seabedTop(x) >= 12 && T.seabedTop(x) <= T.SEABED.rows - 4);
});

test('the backdrop is calm and dark: hatch lines only, no stipple, low mean luminance (texture level)', () => {
    const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
    const paper = hex(T.PAPER);
    let paperTexels = 0, all = 0;
    for (let l = 0; l < T.WATER.layers; l++) {
        const im = png.decode(fs.readFileSync(path.join(DIR, T.DIR, T.waterFile(l))));
        for (let y = 0; y < im.H; y++) {
            let runs = 0, inRun = false, row = 0;
            for (let x = 0; x < im.W; x++) {
                const on = im.px[(y * im.W + x) * 4 + 3] === 255 && im.px[(y * im.W + x) * 4] === paper[0];
                if (on) { row++; paperTexels++; if (!inRun) runs++; }
                inRun = on;
            }
            // no row is a stipple: every paper run is a dash of at least 6 texels
            if (row) assert.ok(row / runs >= 6, 'water layer ' + l + ' row ' + y + ' has short runs');
        }
        all += im.W * im.H;
    }
    // all layers shown (full day): paper share of the 640x360 world well below the 25 % luminance budget
    const share = paperTexels / (T.WATER.cols * T.GRID_ROWS);
    assert.ok(share < 0.08, 'water hatch share ' + share);
});

test('onebit measurable criteria (needs qml6): calm backdrop, smooth motion, comfort, proportions, stress', { timeout: 600000 }, t => {
    const r = spawnSync('node', [path.join(__dirname, 'onebit-measure.js')], { encoding: 'utf8', timeout: 580000, env: Object.assign({}, process.env, { QUIET: '1' }) });
    if (r.status === 77) return t.skip('qml6 unavailable');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
