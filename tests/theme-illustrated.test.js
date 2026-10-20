// The "illustrated" theme (contents/themes/illustrated): every texture the renderer can ask for
// exists, the sky grading and pseudo-depth behave, the sync writes the stress / flip / baby
// state to its sprites, and the theme switch is wired into the config.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadBoids, loadLibrary, mulberry32 } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'illustrated');
const T = loadLibrary(path.join(DIR, 'theme.js'));
const exists = rel => fs.existsSync(path.join(DIR, rel));

test('illustrated: every texture the theme can request exists', () => {
    for (const k in T.KINDS) {
        const K = T.KINDS[k];
        for (const w of K.lods) {
            if (k === 'fish') {
                for (const c of ['coral', 'apricot', 'lemon', 'teal', 'lilac', 'hot', 'alarm']) assert.ok(exists(T.img('fish-' + c, w)), 'fish-' + c + ' ' + w);
            } else assert.ok(exists(T.img(K.tex, w)), k + ' ' + w);
            if (k === 'jelly') assert.ok(exists(T.img('jelly-tent', w)), 'tentacles ' + w);
        }
    }
    for (const g of ['warm', 'white', 'red']) assert.ok(exists(T.img('glow-' + g, 64)));
    for (const f of ['ray-128', 'kelp1-60', 'kelp1-120', 'kelp2-60', 'kelp2-120', 'kelp3-60', 'kelp3-120', 'seabed-far-1920', 'seabed-near-1920']) assert.ok(exists('img/' + f + '.png'), f);
    // lodOf picks the smallest texture covering the size
    assert.strictEqual(T.lodOf([48, 84, 144], 30), 48);
    assert.strictEqual(T.lodOf([48, 84, 144], 80), 84);
    assert.strictEqual(T.lodOf([48, 84, 144], 400), 144);
    // every simulation palette colour maps to a texture colour
    const B = loadBoids();
    for (const c of B.Core.FISH_PALETTE) assert.ok(exists(T.img('fish-' + T.fishKey(c), 48)), c);
});

test('illustrated: sky grading follows the day/night cycle', () => {
    const hex = /^#[0-9a-f]{6}$/;
    const day = T.sky(12, true), night = T.sky(0, true), dusk = T.sky(18.5, true), off = T.sky(3, false);
    for (const s of [day, night, dusk, off]) { assert.strictEqual(s.stops.length, 5); assert.strictEqual(s.haze.length, 5); s.stops.concat(s.haze).forEach(c => assert.match(c, hex)); }
    assert.strictEqual(day.day, 1); assert.strictEqual(night.day, 0);
    assert.strictEqual(off.day, 1, 'cycle off = full day whatever the hour');
    assert.ok(dusk.warmth > 0.9 && day.warmth === 0 && night.warmth === 0);
    const lum = c => parseInt(c.substr(1, 2), 16) + parseInt(c.substr(3, 2), 16) + parseInt(c.substr(5, 2), 16);
    assert.ok(lum(day.stops[0]) > lum(night.stops[0]) + 100);
    assert.notStrictEqual(dusk.stops[0], T.sky(12, true).stops[0]);
});

test('illustrated: pseudo-depth is stable, in range and spread over the three bins', () => {
    const bins = [0, 0, 0];
    for (let n = 1; n <= 600; n++) {
        const d = T.depthFor('fish', n);
        assert.strictEqual(d, T.depthFor('fish', n));
        assert.ok(d >= 0 && d <= 1);
        bins[T.depthBin(d)]++;
        const w = T.depthFor('worm', n);
        assert.ok(w >= 0.55 && w <= 1);
    }
    for (const b of bins) assert.ok(b > 120, 'bins ' + bins);
    assert.ok(T.depthScale(0) < T.depthScale(1));
});

test('illustrated: sync writes flip, tilt, stress overlay, baby halo and jelly state', () => {
    const rnd = mulberry32(7);
    const B = loadBoids({ random: rnd });
    B.setRandom(rnd);
    const S = loadLibrary(path.join(DIR, 'sync.js'), { random: rnd });
    const cfg = { fishCount: 30, anglerCount: 2, orcaCount: 2, jellyCount: 3 };
    const sim = B.createSimulation(1920, 1080, 1, cfg);
    const made = [];
    const layer = { createObject(parent, props) {
        const d = Object.assign({ mirror: false, shakeX: 0, shakeY: 0, rotation: 0, opacity: 1, tintAlpha: 0, haloAlpha: 0, baseKey: '', overKey: '', haloKey: '', tiltS: 0, glowAlpha: 0, phase: 0, release() {} }, props);
        made.push(d); return d;
    } };
    for (let i = 0; i < 20; i++) B.step(sim, 1, cfg);
    S.sync(sim, layer, 1000);
    const count = k => made.filter(d => d.kind === k).length;
    assert.strictEqual(count('fish'), 30); assert.strictEqual(count('angler'), 2); assert.strictEqual(count('orca'), 2); assert.strictEqual(count('jelly'), 3);
    assert.ok(made.every(d => d.depth >= 0 && d.depth <= 1 && d.size > 0));
    assert.ok(sim.entities.fish.every(f => f.delegate.mirror === !f.facingRight), 'fish art faces right');
    assert.ok(sim.entities.orcas.every(o => o.delegate.mirror === o.facingRight), 'orca: sim facingRight is inverted');
    assert.ok(sim.entities.fish.every(f => f.delegate.tintAlpha === 0 && f.delegate.baseKey === f.delegate.colorKey));
    // jelly translucency and phase
    assert.ok(sim.entities.jellies.every(j => j.delegate.opacity < 1 && j.delegate.phase === j.wobble));
    // stress overlay: red silhouette at the quantised level; alarm state: red body + wine pulse + red halo; shake
    sim.cpuStress = 0.9;
    S.sync(sim, layer, 1000);
    const f0 = sim.entities.fish[0].delegate;
    assert.strictEqual(f0.overKey, 'hot'); assert.ok(f0.tintAlpha > 0.5 && f0.tintAlpha <= 1); assert.ok(Math.abs(f0.shakeX) + Math.abs(f0.shakeY) > 0);
    sim.cpuStress = 1.5;
    S.sync(sim, layer, 300 * Math.PI / 2);                       // sin = 1 -> pulse 1
    assert.strictEqual(f0.baseKey, 'hot'); assert.strictEqual(f0.overKey, 'alarm'); assert.strictEqual(f0.tintAlpha, 1);
    assert.strictEqual(f0.haloKey, 'red'); assert.ok(f0.haloAlpha > 0.5);
    sim.cpuStress = 0;
    S.sync(sim, layer, 1000);
    assert.strictEqual(f0.tintAlpha, 0); assert.strictEqual(f0.shakeX, 0); assert.strictEqual(f0.haloAlpha, 0);
    // babies: smaller than adults, glow while being born
    const baby = { x: 100, y: 100, vx: 0.3, vy: 0, kind: 'fish', color: '#FF8080', sizeVariation: -3.5, isBaby: true, birthAnim: 5, facingRight: true, dead: false };
    sim.entities.fish.push(baby);
    S.sync(sim, layer, 1000);
    assert.ok(baby.delegate.size < 1.2 && baby.delegate.haloAlpha > 0.8 && baby.delegate.haloKey === 'white');
    baby.birthAnim = 60;
    S.sync(sim, layer, 1000);
    assert.strictEqual(baby.delegate.haloAlpha, 0);
    // worms fade with life, wiggle, bubbles take their scale
    B.forceSpawnWorm(sim, 200, 200);
    const w = sim.entities.worms[0]; w.life = 0.4;
    S.sync(sim, layer, 1000);
    assert.strictEqual(w.delegate.opacity, 0.4);
    assert.ok(sim.entities.bubbles.every(b => b.delegate.size === b.scale));
});
