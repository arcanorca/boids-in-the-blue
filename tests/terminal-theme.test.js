// The "terminal" theme (contents/themes/terminal): textures up to date with tools/gen-terminal-theme.py, every
// frame the renderer can request exists, every texel is a blend of the water colour and a tone of its set, the proportions at 1080p,
// the facing rule (static and at run time), the descriptor helpers, and the measurable comfort criteria.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');
const png = require('./png');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'terminal');
const T = loadScript(path.join(DIR, 'theme.js'));
const exists = f => fs.existsSync(path.join(DIR, T.DIR, f));
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
const FISH_SETS = ['g', 'n', 'a', 'an', 'r', 'rn', 'ri'];
const BASE_SETS = ['g', 'n'];

test('terminal textures are up to date (run: python3 tools/gen-terminal-theme.py --write)', t => {
    const r = spawnSync('python3', [path.join(ROOT, 'tools', 'gen-terminal-theme.py'), '--check'], { encoding: 'utf8' });
    if (r.error || /No module named PIL|No such file or directory: .*ter-u12/.test(r.stderr)) return t.skip('python3 with Pillow and the Terminus fonts is needed');
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every terminal frame the renderer requests exists', () => {
    for (const s of FISH_SETS) for (let c = 0; c < T.FISH_CLASSES.length; c++) for (let f = 0; f < T.FISH_FRAMES; f++) for (const face of ['r', 'l']) {
        if (T.FISH_CLASSES[c].name === 'fry') assert.ok(exists(T.fishFile(c, 'stripe', f, face, s)), T.fishFile(c, 'stripe', f, face, s));
        else for (const v of T.FISH_VARIANTS) assert.ok(exists(T.fishFile(c, v, f, face, s)), T.fishFile(c, v, f, face, s));
    }
    for (const s of BASE_SETS) {
        for (let f = 0; f < 2; f++) {
            for (const face of ['r', 'l']) assert.ok(exists(T.orcaFile(f, face, s)) && exists(T.anglerFile(f, face, s)), s + f + face);
            for (let c = 0; c < T.JELLY_CLASSES.length; c++) assert.ok(exists(T.jellyFile(c, f, s)));
            for (let st = 0; st < T.WORM_STAGES; st++) assert.ok(exists(T.wormFile(st, f, s)));
            assert.ok(exists('sparkle-' + f + '-' + s + '.png'));
            for (let k = 0; k < T.KELP.length; k++) assert.ok(exists(T.kelpFile(k, f, s)));
        }
        for (let l = 0; l < T.LURE_LEVELS; l++) assert.ok(exists(T.lureFile(l, s)));
        for (const b of [1, 3]) assert.ok(exists(T.bubbleFile(b, s)));
        for (let lvl = 0; lvl <= 100; lvl += 5) assert.ok(exists(T.statusFile(lvl, s)), T.statusFile(lvl, s));
        for (const n of ['seabed', 'waves', 'prompt', 'water']) assert.ok(exists(n + '-' + s + '.png'), n);
    }
    for (const n of ['glass-g', 'glass-n', 'scan']) assert.ok(exists(n + '.png'), n);
});

test('every texel is a blend of the water colour and a tone of its set (boxes are opaque; only lure, bubbles and the glass overlays are translucent)', () => {
    const overlay = /^(glass-g|glass-n|scan)\.png$/, clear = /^(lure|sparkle|bubble|waves|water|seabed|kelp|prompt|status|dots)/;
    for (const f of fs.readdirSync(path.join(DIR, T.DIR))) {
        if (overlay.test(f)) continue;
        const set = /-([a-z]+)\.png$/.exec(f)[1];
        assert.ok(T.PALETTE[set], f + ': unknown palette set ' + set);
        const im = png.decode(fs.readFileSync(path.join(DIR, T.DIR, f)));
        const bg = hex(T.BG), P = T.PALETTE[set];
        for (let i = 0; i < im.W * im.H; i++) {
            const p = im.px.subarray(i * 4, i * 4 + 4);
            if (p[3] === 0) { assert.ok(clear.test(f), f + ' has a clear texel: creature boxes are opaque'); continue; }
            if (set === 'ri') {
                const ok = [hex(P.ink), hex(P.fill)].some(c => c.every((v, k) => v === p[k]));
                assert.ok(ok && p[3] === 255, f + ' has colour ' + [p[0], p[1], p[2]].join(',') + ' outside the alarm box colours');
                continue;
            }
            if (p[3] !== 255) { assert.ok(/^(lure|bubble|sparkle)/.test(f), f + ' has a translucent texel'); continue; }
            const tones = ['b', 'n', 'm', 'd'].map(k => hex(P[k])).concat([bg]);
            for (let k = 0; k < 3; k++) assert.ok(p[k] >= Math.min(...tones.map(c => c[k])) - 1 && p[k] <= Math.max(...tones.map(c => c[k])) + 1, f + ' has colour ' + [p[0], p[1], p[2]].join(',') + ' outside the range of the water colour and the tones of its set');
        }
    }
});

test('proportions at 1080p: fish 2-4 rows, angler 1.5 x, orca 3 x, jelly, worm, bubbles, seabed and kelp limits', () => {
    const Q = T.texelDevice(1080);
    const size = (f, q) => { const im = png.decode(fs.readFileSync(path.join(DIR, T.DIR, f))); return { w: im.W * q, h: im.H * q }; };
    const fish = size(T.fishFile(2, 'stripe', 0, 'r', 'g'), Q);
    assert.ok(fish.w >= 54 * 0.8 && fish.w <= 72 * 1.2 && fish.h >= 40 * 0.8 && fish.h <= 54 * 1.2, 'mid fish ' + fish.w + 'x' + fish.h);
    assert.ok(fish.h / T.CELL_H >= 2 && fish.h / T.CELL_H <= 4, 'mid fish is 2 to 4 rows tall');
    const within = (v, ref, tol) => Math.abs(v / ref - 1) <= tol;
    assert.ok(within(size(T.anglerFile(0, 'r', 'g'), Q).w, 1.5 * fish.w, 0.25), 'angler length ~1.5 fish');
    const orca = size(T.orcaFile(0, 'r', 'g'), Q);
    assert.ok(within(orca.w, 3 * fish.w, 0.2) && orca.w >= 136 && orca.w <= 264, 'orca length ' + orca.w);
    assert.ok(orca.h >= 64 && orca.h <= 144, 'orca height ' + orca.h + ' px');
    assert.ok(within(size(T.jellyFile(1, 0, 'g'), Q).w, fish.w, 0.2), 'jelly bell about one fish wide');
    assert.ok(within(size(T.wormFile(0, 0, 'g'), Q).w, 0.3 * fish.w, 0.2), 'worm about 0.3 fish wide');
    for (const sc of [1.5, 3]) { const b = size(T.bubbleFile(sc, 'g'), Q); assert.ok(Math.max(b.w, b.h) >= 6 && Math.max(b.w, b.h) <= 14, 'bubble ' + b.w + 'x' + b.h); }
    assert.ok(T.SEABED.rows * Q / 1080 <= 0.09, 'seabed <= 9 % of the height');
    assert.ok(Math.max(...T.KELP.map(k => k.rows)) * T.CELL_H * Q / 1080 <= 0.20, 'tallest kelp <= 20 %');
    const kelp = size(T.kelpFile(2, 0, 'g'), Q);
    assert.strictEqual(kelp.h, T.KELP[2].rows * T.CELL_H, 'kelp texture is its declared rows');
    // the classes order by size
    const widths = T.FISH_CLASSES.map((c, i) => size(T.fishFile(i, 'stripe', 0, 'r', 'g'), Q).w);
    assert.ok(widths[0] <= widths[1] && widths[1] < widths[2] && widths[2] < widths[3], 'classes ' + widths);
});

test('the sim floor keeps the orca below the waves: floor >= waves bottom + half the orca', () => {
    const Q = T.texelDevice(1080), floorPx = T.SURFACE.floor * Q, wavesBottomPx = (T.SURFACE.y + T.SURFACE.rows) * Q;
    const im = png.decode(fs.readFileSync(path.join(DIR, T.DIR, T.orcaFile(0, 'r', 'g'))));
    assert.ok(floorPx >= wavesBottomPx + im.H * Q / 2, floorPx + ' < ' + wavesBottomPx + ' + half orca ' + im.H * Q / 2);
    assert.ok(T.SURFACE.y >= 48 && T.SURFACE.y <= 54, 'the waves start ~51 px below the screen top (the floating panel covers the first ~54 px)');
});

test('the angler lure cell in theme.js is where the art puts it (python3 tools/gen-terminal-theme.py --lure)', t => {
    const r = spawnSync('python3', [path.join(ROOT, 'tools', 'gen-terminal-theme.py'), '--lure'], { encoding: 'utf8' });
    if (r.error || /No module named PIL|No such file or directory: .*ter-u12/.test(r.stderr)) return t.skip('python3 with Pillow and the Terminus fonts is needed');
    const m = /r: \{ x: (\d+), y: (\d+) \}, l: \{ x: (\d+), y: (\d+) \}/.exec(r.stdout);
    assert.ok(m, r.stdout + r.stderr);
    assert.deepStrictEqual([T.ANGLER_LURE.r.x, T.ANGLER_LURE.r.y, T.ANGLER_LURE.l.x, T.ANGLER_LURE.l.y], m.slice(1).map(Number));
});

test('facing is the file: right-facing art for right-moving fish, the orca flag is inverted, both sync rules are in sync.js', () => {
    const sync = fs.readFileSync(path.join(DIR, 'sync.js'), 'utf8');
    assert.match(sync, /face = ent\.facingRight \? 'r' : 'l';/, 'fish and angler: right-facing when the flag is true');
    assert.match(sync, /face = ent\.facingRight \? 'l' : 'r';/, 'orca: its flag is inverted, so the right-facing art is used when it is false');
    assert.doesNotMatch(sync, /flip\s*=\s*(?!false)/, 'no mirror transform on the art');
    assert.ok(T.fishFile(2, 'stripe', 0, 'r', 'g').includes('-r-') && T.fishFile(2, 'stripe', 0, 'l', 'g').includes('-l-'));
});

test('facing and the sprites at run time (needs qml6; exit 77 = unavailable)', { timeout: 300000 }, t => {
    const r = spawnSync('node', [path.join(__dirname, 'terminal-measure.js'), 'F'], { encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env, { QUIET: '1' }) });
    if (r.status === 77) return t.skip('qml6 unavailable');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('descriptor helpers: classes, magnification, texel scale, load bar steps, palette step', () => {
    assert.strictEqual(T.fishClass(2.5), 0);       // babies: fry
    assert.strictEqual(T.fishClass(3.0), 1);       // small
    assert.strictEqual(T.fishClass(4), 2);         // mid: the reference fish
    assert.strictEqual(T.fishClass(5), 3);         // large
    assert.strictEqual(T.fishClass(9), T.FISH_CLASSES.length - 1);
    assert.strictEqual(T.fishMag(4), 1);
    assert.strictEqual(T.fishMag(8), 2);
    assert.strictEqual(T.texelDevice(1080), 1);
    assert.strictEqual(T.texelDevice(2160), 2);
    assert.strictEqual(T.texelDevice(720), 1);
    assert.strictEqual(T.creatureTexelDevice(2160), 2);
    assert.strictEqual(T.statusFile(0, 'g'), 'status-000-g.png');
    assert.strictEqual(T.statusFile(50, 'n'), 'status-050-n.png');
    assert.strictEqual(T.statusFile(100, 'g'), 'status-100-g.png');
    assert.strictEqual(T.loadLevel(0), 0);
    assert.strictEqual(T.loadLevel(1.5), 100);
    assert.strictEqual(T.loadLevel(0.72), 50);
    assert.strictEqual(T.nightSet(0.2), true);
    assert.strictEqual(T.nightSet(0.8), false);
    assert.strictEqual(T.fishSet(false, 3), 'ri');
    assert.strictEqual(T.fishSet(true, 2), 'rn');
    assert.strictEqual(T.fishVariant('#FF8080'), 'stripe');
    assert.strictEqual(T.fishVariant('#nothing'), 'solid');
    // the palette colours fish use come from the simulation's pattern colours: the variant is the character design
    const core = fs.readFileSync(path.join(ROOT, 'core', 'boids-core.js'), 'utf8');
    for (const c of Object.keys(T.FISH_VARIANT)) assert.ok(core.toUpperCase().includes(c.toUpperCase()), c);
    assert.strictEqual(T.BG, '#08120b');
});

test('the terminal sea never blinks: no timer in the scene runs faster than 1 Hz except the kelp sway', () => {
    const amb = fs.readFileSync(path.join(DIR, 'Ambient.qml'), 'utf8');
    const intervals = [...amb.matchAll(/interval:\s*(\d+)/g)].map(m => +m[1]);
    assert.deepStrictEqual(intervals, [500, 1000], 'the kelp sways at 2 s per frame, the load bar samples at 1 Hz');
    assert.doesNotMatch(amb, /\b(Behavior|NumberAnimation|ColorAnimation|SequentialAnimation|PauseAnimation)\b|\bopacity\s*:/);
});

test('the comfort criteria A to D and S hold (needs qml6; exit 77 = unavailable)', { timeout: 900000 }, t => {
    const r = spawnSync('node', [path.join(__dirname, 'terminal-measure.js'), 'A', 'B', 'C', 'D', 'S'], { encoding: 'utf8', timeout: 880000, env: Object.assign({}, process.env, { QUIET: '1' }) });
    if (r.status === 77) return t.skip('qml6 unavailable');
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('terminal is registered with a preview and a README', () => {
    assert.ok(fs.existsSync(path.join(DIR, 'Scene.qml')) && fs.existsSync(path.join(DIR, 'README.md')));
    const b = fs.readFileSync(path.join(DIR, 'preview.png'));
    assert.deepStrictEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [480, 270]);
});
