// The "gameboy" theme (contents/themes/gameboy): the art must match tools/gen-gameboy-theme.js, use exactly
// the four DMG shades (+ transparent), and respect the hardware limits it emulates.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const png = require('./png');
const { loadLibrary } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'gameboy');
const IMG = path.join(DIR, 'img');
const T = loadLibrary(path.join(DIR, 'theme.js'));
const A = loadLibrary(path.join(DIR, 'atlas.js'));
const SHADES = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'].map(c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)).join(','));

test('gameboy art is up to date (run: node tools/gen-gameboy-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-gameboy-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every atlas uses only the four DMG shades, fully opaque or fully transparent ', () => {
    for (const f of fs.readdirSync(IMG)) {
        const im = png.decode(fs.readFileSync(path.join(IMG, f)));
        const seen = new Set();
        for (let i = 0; i < im.W * im.H; i++) {
            const a = im.px[i * 4 + 3];
            assert.ok(a === 0 || a === 255, f + ': partial alpha ' + a);
            if (a) seen.add([im.px[i * 4], im.px[i * 4 + 1], im.px[i * 4 + 2]].join(','));
        }
        for (const c of seen) assert.ok(SHADES.includes(c), f + ': colour ' + c + ' is not one of the 4 shades');
    }
});

test('every OBJ sprite uses at most 3 shades plus transparent, in whole 8x8 tiles', () => {
    const im = png.decode(fs.readFileSync(path.join(IMG, 'obj-n0.png')));
    for (const name in A.OBJ) {
        const [x, y, w, h] = A.OBJ[name], seen = new Set();
        assert.ok(w % 8 === 0 && h % 8 === 0, name + ' ' + w + 'x' + h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const d = ((y + j) * im.W + x + i) * 4;
            if (im.px[d + 3]) seen.add(im.px[d] + ',' + im.px[d + 1] + ',' + im.px[d + 2]);
        }
        assert.ok(seen.size <= 3, name + ' uses ' + seen.size + ' shades');
    }
});

test('every sprite the adapter can ask for exists in the atlas', () => {
    for (const v of T.FISH_VARIANTS) for (let ph = 0; ph < 4; ph++) for (const size of [0.5, 1.5, 2.5, 3.3, 4, 5, 7, 9]) {
        const [cls] = T.fishPick(size);
        assert.ok(A.OBJ[T.fishKey(v, cls, ph)], T.fishKey(v, cls, ph));
    }
    for (let f = 0; f < 3; f++) for (const k of ['ang-', 'orca-', 'j16-', 'j8-', 'worm-']) assert.ok(A.OBJ[k + f], k + f);
    for (const k of ['lure-0', 'lure-1', 'lure-2', 'bub-0', 'bub-1', 'spark-0', 'spark-1']) assert.ok(A.OBJ[k], k);
    assert.strictEqual(A.LURE.length, 3);
    for (const f of T.OBJ_FILES.concat(T.BG_FILES)) assert.ok(fs.existsSync(path.join(IMG, f)), f);
    for (const sc of [1.5, 2.2, 2.4, 3]) assert.ok(A.OBJ[T.bubbleKey(sc)]);
    for (const sz of [1, 2, 3, 4, 6, 9]) assert.ok(A.OBJ[T.jellyPick(sz)[0] + '0']);
    assert.strictEqual(A.BG.flat.length, 4);
    for (const e of A.LAYOUT) assert.ok(e.k === 'kelp' ? A.BG.kelp[e.v] : A.BG.props[e.v], JSON.stringify(e));
});

test('hardware budget: unique tiles fit the 384 tiles of DMG VRAM', () => {
    const m = /Unique 8x8 tiles: OBJ (\d+), BG (\d+)/.exec(fs.readFileSync(path.join(DIR, 'atlas.js'), 'utf8'));
    assert.ok(m, 'atlas.js reports the tile budget');
    assert.ok(+m[1] <= 256 && +m[2] <= 256 && +m[1] + +m[2] <= 384, m[0]);
});

test('integer scaling, fade stages, size classes', () => {
    for (const [h, dpr, want] of [[1080, 1, 3], [720, 1, 2], [1440, 1, 4], [2160, 1, 6], [540, 1, 2], [1080, 2, 6]]) assert.strictEqual(T.cellPx(h, dpr), want, h + 'x' + dpr);
    assert.strictEqual(T.stage(1), 0); assert.strictEqual(T.stage(0.5), 1); assert.strictEqual(T.stage(0), 2);
    assert.strictEqual(JSON.stringify(T.fishPick(4)), JSON.stringify(['M', 1]));          // the default fish
    assert.strictEqual(JSON.stringify(T.fishPick(3)), JSON.stringify(['S', 1]));
    assert.strictEqual(JSON.stringify(T.fishPick(5)), JSON.stringify(['L', 1]));
    assert.strictEqual(JSON.stringify(T.fishPick(1)), JSON.stringify(['B', 1]));
    assert.strictEqual(JSON.stringify(T.fishPick(2.5)), JSON.stringify(['F', 1]));
    assert.strictEqual(JSON.stringify(T.fishPick(8)), JSON.stringify(['M', 2]));          // slider maximum: whole 2x, never fractional
    for (let s = 0.5; s <= 10; s += 0.1) { const [, m] = T.fishPick(s); assert.ok(m === 1 || m === 2); }
});

test('geometry: calm tone zones, short kelp, shallow seabed', () => {
    const G = A.GEOM;
    assert.ok(G.seabedRows / T.SCREEN_ROWS <= 0.09, 'seabed band');
    assert.ok(G.kelpRows / T.SCREEN_ROWS <= 0.18, 'kelp height');
    assert.ok(G.zoneA < G.seamB && G.seamB < 1);
    assert.ok(A.LAYOUT.filter(e => e.k === 'kelp').length >= 4);
});

test('fish keys: size classes and the 4-phase tail beat', () => {
    assert.strictEqual(T.fishKey('aqua', 'M', 0), 'fM-aqua-0');
    assert.strictEqual(T.fishKey('coral', 'S', 1), 'fS-coral-1');
    assert.strictEqual(T.fishKey('lemon', 'L', 3), 'fL-lemon-1');
    assert.strictEqual(T.fishKey('lemon', 'B', 3), 'fB-lemon-1');
    assert.strictEqual(T.fishVariant('#ff8080'), 'coral');
    assert.strictEqual(T.fishVariant('nonsense'), 'aqua');
    assert.ok(T.FLASH_MS * 2 >= 1000, 'alarm alternation stays at or below 1 Hz');
});

// The QML-side measurements (calm backdrop, smooth motion, eye comfort, proportions): tests/gameboy-measure.js.
// Skipped when qml6 is unavailable (exit 77).
test('measured acceptance criteria A-D (needs qml6)', { timeout: 600000 }, (t) => {
    const r = spawnSync('node', [path.join(__dirname, 'gameboy-measure.js'), 'all'], { encoding: 'utf8', timeout: 560000 });
    if (r.status === 77) return t.skip('qml6 unavailable');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
