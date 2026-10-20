// The "pixel" theme (contents/themes/pixel): textures must be up to date with tools/gen-pixel-theme.js
// and every file the QML renderer can ask for must exist.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'pixel');

test('pixel theme textures are up to date (run: node tools/gen-pixel-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-pixel-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every pixel-theme frame the renderer requests exists', () => {
    const T = loadScript(path.join(DIR, 'theme.js'));
    const exists = f => fs.existsSync(path.join(DIR, T.DIR, f));
    for (const k in T.kinds) {
        const kd = T.kinds[k];
        assert.strictEqual(T.NAMES[kd.type], k);
        for (let f = 0; f < kd.frames; f++) {
            if (k === 'fish') {
                for (const c of Object.keys(T.FISH_VARIANT)) for (let lv = 0; lv <= 4; lv++)
                    assert.ok(exists(T.frameFile(k, T.fishStressVariant(c, lv), f)), c + ' level ' + lv + ' frame ' + f);
                assert.ok(exists(T.frameFile(k, 'alarm', f)));
            } else assert.ok(exists(T.frameFile(k, '', f)), k + ' frame ' + f);
        }
    }
    for (const f of ['glow.png', 'lure-0.png', 'lure-1.png', 'lure-2.png', 'seabed.png', 'shaft.png', 'surface.png']) assert.ok(exists(f), f);
    assert.ok(fs.existsSync(path.join(DIR, T.AMBIENT)) && fs.existsSync(path.join(DIR, T.SPRITE)));
    assert.strictEqual(T.LURE.length, T.kinds.angler.frames);
});

test('cellFor quantises sizes crisply and never below the minimum', () => {
    const T = loadScript(path.join(DIR, 'theme.js'));
    for (const k in T.kinds) for (const size of [0.1, 0.5, 1, 2.5, 4, 5.5, 8, 10]) {
        const c = T.cellFor(k, size);
        assert.ok(c >= T.kinds[k].minCell, k + ' ' + size);
        assert.ok(c >= 1 ? (c * 2) % 1 === 0 : (c * 4) % 1 === 0, 'quantised ' + k + ' ' + size + ' -> ' + c);
    }
});

test('water is a smooth gradient: stop colours equal waterColor at the stops, day/night blends, custom colours honoured', () => {
    const T = loadScript(path.join(DIR, 'theme.js'));
    assert.strictEqual(T.BANDS, undefined);
    assert.strictEqual(T.STOPS.length, 3);
    assert.strictEqual(T.STOPS[0], 0); assert.strictEqual(T.STOPS[2], 1);
    for (let i = 0; i < 3; i++) {
        assert.strictEqual(T.stopColor(i, 1, '', ''), T.waterColor(1, T.STOPS[i]));
        assert.strictEqual(T.stopColor(i, 0, '', ''), T.waterColor(0, T.STOPS[i]));
    }
    assert.strictEqual(T.stopColor(0, 1, '', ''), '#3a9bcc');
    assert.strictEqual(T.stopColor(2, 0, '', ''), '#040d1c');
    assert.notStrictEqual(T.stopColor(1, 0.5, '', ''), T.stopColor(1, 1, '', ''));
    assert.strictEqual(T.stopColor(0, 1, '#112233', '#445566'), '#112233');
    assert.strictEqual(T.stopColor(2, 1, '#112233', '#445566'), '#445566');
});
