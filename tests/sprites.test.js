// The sprite textures in contents/images/sprites are generated from the SPRITES in the core
// (tools/gen-sprites.js). They must be up to date, and every texture the QML renderer can ask
// for must exist.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadBoids, loadScript } = require('./harness');

const ROOT = path.join(__dirname, '..');

test('generated sprite textures are up to date (run: node tools/gen-sprites.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-sprites.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every texture the renderer requests exists', () => {
    const S = loadScript(path.join(ROOT, 'contents', 'ui', 'code', 'sprites.js'));
    const B = loadBoids();
    const dir = path.join(ROOT, 'contents', 'ui');
    const exists = rel => fs.existsSync(path.join(dir, rel));
    const sizes = [0.3, 1, 2.75, 4, 4.3, 5.5, 8.99, 11, 50];
    for (const size of sizes) {
        for (const c of B.Core.FISH_PALETTE.concat(['#FF3333', '#FF0000', '#000080'])) {
            assert.ok(exists(S.baseSource(1, size, c)), 'fish ' + c + ' ' + size);
        }
        assert.ok(exists(S.topSource(size)), 'top ' + size);
        for (let t = 2; t <= 6; t++) assert.ok(exists(S.baseSource(t, size, '')), 'type ' + t + ' ' + size);
    }
});
