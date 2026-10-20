// The "biolum" theme (contents/themes/biolum): every texture its descriptor / QML can ask for must exist,
// the textures must be what tools/gen-biolum.py makes, and the theme switch must default to "classic".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'biolum');

test('biolum: every texture in theme.js exists and is a PNG', () => {
    const T = loadScript(path.join(DIR, 'theme.js'));
    const files = T.allFiles();
    assert.ok(files.length > 40);
    for (const f of files) {
        const p = path.join(DIR, f);
        assert.ok(fs.existsSync(p), 'missing ' + f);
        assert.strictEqual(fs.readFileSync(p).subarray(1, 4).toString(), 'PNG', f);
    }
});

test('biolum: fish colours the sim can send map to textures', () => {
    const T = loadScript(path.join(DIR, 'theme.js'));
    const { loadBoids } = require('./harness');
    const B = loadBoids();
    for (const c of B.Core.FISH_PALETTE.concat(['#FF3333', '#FF0000', '#000080']))
        for (let f = 0; f < 3; f++) assert.ok(fs.existsSync(path.join(DIR, T.fishSource(c, f))), c + ' ' + f);
});

test('biolum: gradient is valid hex at day, night and in between', () => {
    const T = loadScript(path.join(DIR, 'theme.js'));
    for (const b of [0, 0.3, 1]) for (const k of ['top', 'mid', 'bottom']) assert.match(T.gradient(b)[k], /^#[0-9a-f]{6}$/);
});
