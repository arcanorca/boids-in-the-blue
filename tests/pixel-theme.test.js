// The "pixel" theme (contents/themes/pixel): textures must be up to date with tools/gen-pixel-theme.js,
// every file the QML renderer can ask for must exist, the cast must keep believable proportions on one
// art-pixel scale, the size classes must scale sensibly and the creature art must be clean.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');
const png = require('./png');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'pixel');
const T = () => loadScript(path.join(DIR, 'theme.js'));
const img = f => png.decode(fs.readFileSync(path.join(DIR, T().DIR, f)));

test('pixel theme textures are up to date (run: node tools/gen-pixel-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-pixel-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every pixel-theme frame the renderer requests exists, with the size the descriptor says', () => {
    const t = T();
    const check = (f, art) => {
        const p = path.join(DIR, t.DIR, f);
        assert.ok(fs.existsSync(p), f);
        const im = png.decode(fs.readFileSync(p));
        assert.strictEqual(im.W, art.cols, f); assert.strictEqual(im.H, art.rows, f);
    };
    for (const k in t.kinds) {
        const kd = t.kinds[k];
        assert.strictEqual(t.NAMES[kd.type], k);
        kd.classes.forEach(c => assert.ok(c.art >= 0 && c.art < kd.arts.length && c.mul >= 1 && Number.isInteger(c.mul)));
        for (let a = 0; a < kd.arts.length; a++) for (let f = 0; f < kd.frames; f++) {
            if (k === 'fish') {
                for (const c of Object.keys(t.FISH_VARIANT)) for (let lv = 0; lv <= 4; lv++) check(t.frameFile(k, a, t.fishStressVariant(c, lv), f), kd.arts[a]);
                check(t.frameFile(k, a, 'alarm', f), kd.arts[a]);
            } else check(t.frameFile(k, a, '', f), kd.arts[a]);
        }
    }
    for (const f of ['glow.png', 'lure-0.png', 'lure-1.png', 'lure-2.png', 'spark.png', 'seabed.png', 'flora.png', 'far.png', 'shaft.png', 'surface.png', 'waterline.png']) assert.ok(fs.existsSync(path.join(DIR, t.DIR, f)), f);
    for (const l of t.SEABED_LAYERS) { const im = img(l.tex); assert.strictEqual(im.W, l.cols); assert.strictEqual(im.H, l.rows); }
    assert.ok(fs.existsSync(path.join(DIR, t.AMBIENT)) && fs.existsSync(path.join(DIR, t.SPRITE)));
    t.LURE.forEach(l => assert.strictEqual(l.length, t.kinds.angler.frames));
    assert.strictEqual(t.LURE.length, t.kinds.angler.arts.length);
});

test('psFor: one integer art-pixel scale from the screen height (1080p -> 2)', () => {
    const t = T();
    assert.strictEqual(t.psFor(1080), 2); assert.strictEqual(t.psFor(1440), 3); assert.strictEqual(t.psFor(2160), 4); assert.strictEqual(t.psFor(300), 2);
});

test('proportions at 1080p and the default sliders: fish 32x24, orca ~3.75 fish, angler ~1.4, jelly bell ~1.25, worm, bubbles', () => {
    const t = T(), ps = t.psFor(1080), K = t.kinds;
    const dim = (kind, size) => { const c = K[kind].classes[t.classFor(kind, size)], a = K[kind].arts[c.art]; return [a.cols * c.mul * ps, a.rows * c.mul * ps]; };
    const fish = dim('fish', 4.0), orca = dim('orca', 5.5), angler = dim('angler', 4.2), worm = dim('worm', 4);
    assert.deepStrictEqual(fish, [32, 24]);
    assert.ok(orca[0] >= 3.4 * fish[0] && orca[0] <= 4.0 * fish[0], 'orca ' + orca);
    assert.ok(orca[1] >= 60 && orca[1] <= 72, 'orca height ' + orca[1]);
    assert.ok(angler[0] >= 1.25 * fish[0] && angler[0] <= 1.5 * fish[0], 'angler ' + angler);
    for (const js of [3, 3.5, 4, 5]) { const j = dim('jelly', js); assert.ok(j[0] >= 0.8 * fish[0] && j[0] <= 1.6 * fish[0] && j[1] >= 1.4 * j[0] * 0.9 && j[1] <= 2.2 * j[0], 'jelly ' + js + ' ' + j); }
    assert.ok(worm[1] >= 0.25 * fish[0] && worm[1] <= 0.4 * fish[0], 'worm ' + worm);
    for (const bs of [1.5, 2.25, 3]) { const b = dim('bubble', bs); assert.ok(b[0] >= 6 && b[0] <= 14, 'bubble ' + bs + ' ' + b); }
    // adults share one hand-drawn size (size 4 +- 1) and babies are clearly smaller
    for (const s of [3, 5]) { const f = dim('fish', s); assert.ok(f[0] >= 0.8 * fish[0] && f[0] <= 1.2 * fish[0], 'fish ' + s + ' ' + f); }
    assert.ok(dim('fish', 2.5)[0] <= 0.75 * fish[0] && dim('fish', 0.5)[0] <= 0.55 * fish[0]);
});

test('size classes grow monotonically with the slider and stay on whole texels', () => {
    const t = T(), K = t.kinds;
    for (const k in K) {
        let last = 0;
        for (let s = 0.4; s <= 10.01; s += 0.1) {
            const c = K[k].classes[t.classFor(k, s)], w = K[k].arts[c.art].cols * c.mul;
            assert.ok(w >= last - 1e-9, k + ' width shrinks at size ' + s.toFixed(1));
            last = w;
        }
        for (const c of K[k].classes) assert.ok(Number.isInteger(c.mul));
    }
    // the orca keeps the facing art direction: art faces LEFT (the simulation flag is inverted, sync.js flips it)
    const sync = fs.readFileSync(path.join(DIR, 'sync.js'), 'utf8');
    assert.ok(/var flip = !ent\.facingRight;/.test(sync));
});

test('creature art: no orphan texels (every opaque texel touches another), fish ramps <= 16 colours', () => {
    const t = T();
    const orphans = f => { const im = img(f), A = (x, y) => x >= 0 && y >= 0 && x < im.W && y < im.H && im.px[(y * im.W + x) * 4 + 3] > 0; let n = 0;
        for (let y = 0; y < im.H; y++) for (let x = 0; x < im.W; x++) if (A(x, y) && !(A(x + 1, y) || A(x - 1, y) || A(x, y + 1) || A(x, y - 1))) n++;
        return n; };
    for (const k of ['fish', 'orca', 'angler', 'jelly', 'worm']) for (let a = 0; a < t.kinds[k].arts.length; a++) for (let f = 0; f < 4; f++) {
        const file = t.frameFile(k, a, k === 'fish' ? 'aqua' : '', f);
        assert.strictEqual(orphans(file), 0, file);
    }
    for (const v of t.allFishVariants()) {
        const s = new Set();
        for (let a = 0; a < t.kinds.fish.arts.length; a++) for (let f = 0; f < 4; f++) { const im = img(t.frameFile('fish', a, v, f)); for (let i = 0; i < im.W * im.H; i++) if (im.px[i * 4 + 3]) s.add(im.px.readUInt32BE(i * 4)); }
        assert.ok(s.size <= 16, v + ' ' + s.size);
    }
});

test('water is a smooth gradient: stop colours equal waterColor at the stops, day/night blends, custom colours honoured', () => {
    const t = T();
    assert.strictEqual(t.BANDS, undefined);
    assert.strictEqual(t.STOPS.length, 5);
    assert.strictEqual(t.STOPS[0], 0); assert.strictEqual(t.STOPS[t.STOPS.length - 1], 1);
    for (let i = 1; i < t.STOPS.length; i++) assert.ok(t.STOPS[i] > t.STOPS[i - 1]);
    for (let i = 0; i < t.STOPS.length; i++) {
        assert.strictEqual(t.stopColor(i, 1, '', ''), t.waterColor(1, t.STOPS[i]));
        assert.strictEqual(t.stopColor(i, 0, '', ''), t.waterColor(0, t.STOPS[i]));
    }
    assert.strictEqual(t.stopColor(0, 1, '', ''), '#5dc2e2');
    assert.strictEqual(t.stopColor(4, 0, '', ''), '#030a18');
    assert.notStrictEqual(t.stopColor(2, 0.5, '', ''), t.stopColor(2, 1, '', ''));
    assert.strictEqual(t.stopColor(0, 1, '#112233', '#445566'), '#112233');
    assert.strictEqual(t.stopColor(4, 1, '#112233', '#445566'), '#445566');
});

test('seabed layers stay low: sand band <= 9 % and the tallest plant <= 22 % of a 1080p screen', () => {
    const t = T(), H = 1080, ps = t.psFor(H);
    assert.ok(t.SEABED.rows * ps <= 0.09 * H, 'sand band');
    assert.ok(t.FLORA.rows * ps <= 0.22 * H, 'plants');
    const shaft = t.SHAFT; assert.ok(shaft.cols > 0 && shaft.rows > 0);
});
