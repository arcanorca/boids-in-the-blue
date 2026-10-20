// The "nes" theme (contents/themes/nes): textures are up to date with tools/gen-nes-theme.js, every
// file the renderer can ask for exists, the art obeys the hardware limits it claims (master palette,
// 3 colours per palette, 4 + 4 palettes) and the sync drives palette swaps / shake / animation.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const png = require('./png');
const { loadBoids, loadLibrary, mulberry32 } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'nes');
const T = loadLibrary(path.join(DIR, 'theme.js'));
const exists = f => fs.existsSync(path.join(DIR, T.DIR, f));
const load = f => png.decode(fs.readFileSync(path.join(DIR, T.DIR, f)));
const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
function colours(im) {
    const set = new Set();
    for (let i = 0; i < im.W * im.H; i++) {
        if (im.px[i * 4 + 3] === 0) continue;
        assert.strictEqual(im.px[i * 4 + 3], 255, 'no partial alpha on the NES');
        set.add(hex(im.px[i * 4], im.px[i * 4 + 1], im.px[i * 4 + 2]));
    }
    return set;
}

test('nes theme textures are up to date (run: node tools/gen-nes-theme.js)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'gen-nes-theme.js'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
});

test('every nes frame the renderer requests exists, in every palette state', () => {
    for (const v of Object.keys(T.FISH_PALETTE)) for (const cls of ['m', 's']) for (let f = 0; f < 2; f++) assert.ok(exists(T.spriteFile('fish', cls, v, f)), v + cls + f);
    for (const k of ['jelly', 'orca', 'worm']) for (let f = 0; f < 2; f++) assert.ok(exists(T.spriteFile(k, 'm', '', f)), k);
    for (let f = 0; f < 2; f++) for (let l = 0; l < 3; l++) assert.ok(exists(T.spriteFile('angler', 'm', '', f, l)));
    for (const c of ['s', 'm', 'l']) assert.ok(exists(T.spriteFile('bubble', c)));
    for (const f of ['sparkle-0.png', 'sparkle-1.png']) assert.ok(exists(f), f);
    for (const st of T.BG_STATES) {
        assert.ok(exists(T.surfaceFile(st)));
        for (let k = 0; k < 3; k++) assert.ok(exists(T.seamFile(st, k)));
        for (let f = 0; f < 2; f++) assert.ok(exists(T.seabedFile(st, f)) && exists(T.glintFile(st, f)));
    }
    for (const f of ['NesSprite.qml', 'EntityLayer.qml', 'Ambient.qml', 'Scene.qml', 'sync.js', 'README.md', 'preview.png']) assert.ok(fs.existsSync(path.join(DIR, f)), f);
    // colours the simulation sends map to a variant; descriptor sizes match the art
    const B = loadBoids();
    for (const c of B.Core.FISH_PALETTE) assert.ok(T.fishVariant(c) in T.FISH_PALETTE, c);
    for (const k in T.kinds) for (const cls of ['m', 's']) {
        const kd = T.kinds[k][cls]; if (!kd) continue;
        const im = load(T.spriteFile(k, cls, k === 'fish' ? 'aqua' : '', 0, 0));
        assert.deepStrictEqual([im.W, im.H], [kd.w, kd.h], k + cls);
        assert.strictEqual(kd.w % 8 + kd.h % 8, 0, 'metasprites are made of 8x8 tiles');
    }
});

test('nes art obeys the hardware: master palette, 3-colour palettes, 4+4 palette slots', () => {
    assert.strictEqual(T.NES.length, 64);
    const master = new Set(T.NES.map(c => c.toUpperCase()));
    const sprPal = pal => new Set(pal.map(i => T.NES[i]));
    assert.strictEqual(Object.keys(T.SPR_PAL).length, 4);
    for (const n in T.SPR_PAL) assert.strictEqual(T.SPR_PAL[n].length, 3);
    T.ALARM_STATES.forEach(p => assert.strictEqual(p.length, 3));
    for (const f of fs.readdirSync(path.join(DIR, T.DIR))) {
        const cs = colours(load(f));
        for (const c of cs) assert.ok(master.has(c), f + ' uses ' + c + ', not a 2C02 colour');
        // sprites: one palette per tile -> a single-palette sprite shows only colours of its palette
        if (f.startsWith('fish-')) {
            const v = /^fish-[ms]-(.+)-\d\.png$/.exec(f)[1], st = v === 'alarm-b' ? 1 : 0;
            const pal = sprPal(v.startsWith('alarm') ? T.ALARM_STATES[st] : T.SPR_PAL[T.FISH_PALETTE[v]]);
            for (const c of cs) assert.ok(pal.has(c), f + ': ' + c + ' is not in the ' + T.FISH_PALETTE[v] + ' palette');
        } else if (f.startsWith('angler-')) {
            const pal = new Set([...sprPal(T.SPR_PAL.pink), ...sprPal(T.SPR_PAL.gold)]);
            for (const c of cs) assert.ok(pal.has(c), f + ' ' + c);
        } else if (/^(orca|bubble|sparkle)-/.test(f)) {
            for (const c of cs) assert.ok(sprPal(T.SPR_PAL.teal).has(c), f + ' ' + c);
        } else if (/^jelly-/.test(f)) {
            for (const c of cs) assert.ok(sprPal(T.SPR_PAL.pink).has(c), f + ' ' + c);
        } else if (/^worm-/.test(f)) {
            for (const c of cs) assert.ok(sprPal(T.SPR_PAL.gold).has(c), f + ' ' + c);
        } else {                                          // background: only that state's 4 palettes + universal colour
            const st = /-(day|dusk|night)[-.]/.exec(f)[1], S = T.BG[st];
            const allowed = new Set([T.NES[S.u]]); S.pal.forEach(p => p.forEach(i => allowed.add(T.NES[i])));
            assert.ok(allowed.size <= 13, 'at most 1 + 4x3 colours');
            for (const c of cs) assert.ok(allowed.has(c), f + ' uses ' + c + ' outside the ' + st + ' background palettes');
        }
    }
    for (const st of T.BG_STATES) {
        assert.strictEqual(T.BG[st].pal.length, 4);
        T.BG[st].pal.forEach(p => assert.strictEqual(p.length, 3));
    }
});

test('nes: palette state follows daylight, and the integer pixel scale grows with the screen', () => {
    assert.strictEqual(T.bgState(1), 'day'); assert.strictEqual(T.bgState(0.5), 'dusk'); assert.strictEqual(T.bgState(0), 'night');
    assert.strictEqual(T.pxFor(1080), 4); assert.strictEqual(T.pxFor(1440), 6); assert.strictEqual(T.pxFor(2160), 9); assert.strictEqual(T.pxFor(360), 2);
    for (const h of [300, 480, 720, 1080, 1440, 2160]) { const p = T.pxFor(h); assert.strictEqual(p % 1, 0); assert.ok(h / p >= 240 || p === 2); }
    for (const vh of [240, 270, 360]) {
        const L = T.waterLayout(vh);
        assert.strictEqual(L.bands.length, 4); assert.strictEqual(L.seams.length, 3);
        // bands and seams tile the screen top to bottom, each seam is one row between two bands
        let y = 0;
        L.bands.forEach((b, i) => {
            assert.strictEqual(b.y0, y); assert.ok(b.y1 > b.y0 + 8, 'band is more than a few rows'); y = b.y1;
            if (i < 3) { assert.strictEqual(L.seams[i].y, b.y1); assert.strictEqual(L.seams[i].k, i); y = b.y1 + 1; }
        });
        assert.strictEqual(y, vh, 'bands end at the bottom of the screen');
    }
});

test('nes sync: palette swap per individual, shake, alarm cycling, 2-frame animation, unsnapped positions', () => {
    const rnd = mulberry32(11);
    const B = loadBoids({ random: rnd });
    B.setRandom(rnd);
    let clock = 1000;
    const S = loadLibrary(path.join(DIR, 'sync.js'), { random: rnd, now: () => clock });
    const cfg = { fishCount: 60, anglerCount: 2, orcaCount: 2, jellyCount: 3 };
    const sim = B.createSimulation(1920, 1080, 1, cfg);
    const made = [];
    const layer = { createObject(parent, props) {
        const d = Object.assign({ x: 0, y: 0, z: 0, flip: false, shakeX: 0, shakeY: 0, rotation: 0, opacity: 1, frame: 0, lure: 1, sparkle: 0, thr: 0, phase: 0, tick: 0, variant: 'aqua', cls: 'm', release() {} }, props);
        made.push(d); return d;
    } };
    for (let i = 0; i < 20; i++) B.step(sim, 1, cfg);
    S.sync(sim, layer, layer, 4);
    const fish = sim.entities.fish;
    assert.strictEqual(made.filter(d => d.type === T.kinds.fish.type).length, 60);
    // not snapped to the virtual grid: the metasprite box is centred on the simulation position
    assert.ok(fish.every(f => { const d = T.dims('fish', f.delegate.cls);
        return Math.abs(f.delegate.ax - (f.x - d.w * 4 / 2)) < 1e-6 && Math.abs(f.delegate.ay - (f.y - d.h * 4 / 2)) < 1e-6; }), 'sprites sit on the sim position');
    assert.ok(fish.every(f => f.delegate.flip === !f.facingRight && f.delegate.frame >= 0 && f.delegate.frame <= 1));
    assert.ok(fish.every(f => f.delegate.variant === T.fishVariant(f.color) && f.delegate.shakeX === 0));
    // stress 0.9: some, not all, fish swap to the red palette, and only those shake
    sim.cpuStress = 0.9;
    for (let i = 0; i < 6; i++) S.sync(sim, layer, layer, 4);
    const red = fish.filter(f => f.delegate.variant === 'alarm-a'), calm = fish.filter(f => f.delegate.variant === T.fishVariant(f.color));
    assert.ok(red.length > 15 && calm.length > 5 && red.length + calm.length === fish.length, red.length + ' red, ' + calm.length + ' calm');
    assert.ok(calm.every(f => f.delegate.shakeX === 0 && f.delegate.shakeY === 0));
    assert.ok(red.some(f => f.delegate.shakeX !== 0 || f.delegate.shakeY !== 0));
    assert.ok(fish.every(f => Math.abs(f.delegate.shakeX) <= 2 && Math.abs(f.delegate.shakeY) <= 2), 'shake stays within 2 virtual pixels');
    // monotonic: the fish that are red at 0.9 are still red at 1.1
    sim.cpuStress = 1.1;
    for (let i = 0; i < 3; i++) S.sync(sim, layer, layer, 4);
    assert.ok(red.every(f => f.delegate.variant === 'alarm-a'));
    // above 1.2 everything is red and the alarm palette alternates slowly (never faster than 2 Hz)
    sim.cpuStress = 1.5;
    const seen = [];
    for (let ms = 0; ms < 3000; ms += 40) { clock = ms; S.sync(sim, layer, layer, 4); seen.push(fish[0].delegate.variant); }
    assert.ok(fish.every(f => f.delegate.variant.startsWith('alarm')));
    assert.ok(seen.includes('alarm-a') && seen.includes('alarm-b'));
    let flips = 0; for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1]) flips++;
    assert.ok(flips <= 3000 / 1000 * 2 * 2 + 1, 'palette changes ' + flips + ' times in 3 s');
    // back to calm
    sim.cpuStress = 0;
    S.sync(sim, layer, layer, 4);
    assert.ok(fish.every(f => f.delegate.variant === T.fishVariant(f.color) && f.delegate.shakeX === 0 && f.delegate.shakeY === 0));
    // babies are fry and twinkle while being born; worms blink instead of fading
    const baby = { x: 100, y: 100, vx: 0.3, vy: 0, kind: 'fish', color: '#FF8080', sizeVariation: -1.5, isBaby: true, birthAnim: 5, facingRight: true, dead: false, wanderTheta: 1 };
    sim.entities.fish.push(baby);
    S.sync(sim, layer, layer, 4);
    assert.strictEqual(baby.delegate.cls, 's'); assert.ok(baby.delegate.sparkle > 0);
    baby.birthAnim = 60; S.sync(sim, layer, layer, 4);
    assert.strictEqual(baby.delegate.sparkle, 0);
    B.forceSpawnWorm(sim, 200, 200);
    const w = sim.entities.worms[0]; w.life = 0.4;
    const ops = new Set(); for (let i = 0; i < 20; i++) { S.sync(sim, layer, layer, 4); ops.add(w.delegate.opacity); }
    assert.deepStrictEqual([...ops].sort(), [0, 1]);
    assert.ok(sim.entities.bubbles.every(b => b.delegate.cls === T.bubbleClass(b.scale)));
});
