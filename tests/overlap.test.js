// Fish must not pass through each other, and avoiding each other must not cause twitching.
// Overlap: centre distance < 0.8 * mean body width (7 * (fishSize + sizeVariation) px), see tests/overlap-eval.js.
const test = require('node:test');
const assert = require('node:assert');
const { loadBoids, mulberry32 } = require('./harness');

const B = loadBoids({ random: mulberry32(20240607) });
const W = 1920, H = 1080, FS = 4;
const body = (f, k) => 7 * (k || 1) * Math.max(0.5, FS + f.sizeVariation);

function overlapStats(fish, k) {
    let pairs = 0, ov = 0; const hit = new Array(fish.length).fill(false);
    for (let i = 0; i < fish.length; i++) for (let j = i + 1; j < fish.length; j++) {
        const a = fish[i], b = fish[j];
        pairs++;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 0.8 * 0.5 * (body(a, k) + body(b, k))) { ov++; hit[i] = hit[j] = true; }
    }
    return { pairs: ov / Math.max(1, pairs), fish: hit.filter(Boolean).length / Math.max(1, fish.length) };
}

// Mean over sampled steps (the last 1000 of 3000), seeded
function simulate(seed, cfg, w, h, k) {
    const Bs = loadBoids({ random: mulberry32(seed) });
    const sim = Bs.createSimulation(w || W, h || H, 1, cfg);
    let sumP = 0, sumF = 0, n = 0;
    for (let t = 0; t < 3000; t++) {
        if (k) sim.bodyScale = k;
        Bs.step(sim, 1, cfg);
        if (t >= 2000 && t % 20 === 0) { const s = overlapStats(sim.entities.fish, k); sumP += s.pairs; sumF += s.fish; n++; }
    }
    return { sim: sim, pairs: sumP / n, fish: sumF / n };
}

for (const count of [38, 120, 200]) {
    test('default config, ' + count + ' fish: bodies do not overlap noticeably after 3000 steps (flock only)', () => {
        const cfg = { fishCount: count, anglerCount: 0, orcaCount: 0, jellyCount: 0 };
        for (const seed of [1, 2, 3]) {
            const r = simulate(seed, cfg);
            assert.ok(r.fish < 0.02, count + ' fish seed ' + seed + ': ' + (100 * r.fish).toFixed(2) + '% of fish overlap another');
            assert.ok(r.pairs < 0.0005, count + ' fish seed ' + seed + ': ' + (100 * r.pairs).toFixed(3) + '% of pairs overlap');
            for (const f of r.sim.entities.fish) {
                assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.vx) && Number.isFinite(f.vy), 'NaN');
                assert.ok(f.x >= 0 && f.x <= W && f.y >= 0 && f.y <= H, 'fish left the screen');
            }
        }
    });
}

test('default predators and a crowded small screen: overlap stays rare, nothing leaves the screen', () => {
    const cfg = { fishCount: 200 };
    const r = simulate(5, cfg, 1366, 768);
    assert.ok(r.fish < 0.08, (100 * r.fish).toFixed(2) + '% of fish overlap another (before the fix: ~27%)');
    for (const f of r.sim.entities.fish) assert.ok(f.x >= 0 && f.x <= 1366 && f.y >= 0 && f.y <= 768);
});

test('two schools swimming head-on flow around each other instead of through', () => {
    const cfg = { fishCount: 0, anglerCount: 0, orcaCount: 0, jellyCount: 0, cursorFearLevel: 0 };
    const Bs = loadBoids({ random: mulberry32(11) });
    const sim = Bs.createSimulation(W, H, 1, cfg);
    cfg.fishCount = 40;
    Bs.step(sim, 1, cfg);           // spawns 40 random fish; re-place them as two schools
    const fish = sim.entities.fish;
    fish.forEach((f, i) => {
        const left = i < 20, k = left ? i : i - 20;
        f.x = (left ? 500 : 1400) + (k % 5) * 40 + (left ? 0 : 0); f.y = 480 + Math.floor(k / 5) * 40 + (left ? 0 : 7);
        f.vx = left ? 0.7 : -0.7; f.vy = 0; f.sizeVariation = 0; f.personality = 1;
    });
    let worst = 0, minAcross = 1e9;
    for (let t = 0; t < 1200; t++) {
        Bs.step(sim, 1, cfg);
        let ovl = 0;
        for (let i = 0; i < 20; i++) for (let j = 20; j < 40; j++) {
            const d = Math.hypot(fish[i].x - fish[j].x, fish[i].y - fish[j].y);
            if (d < minAcross) minAcross = d;
            if (d < 0.8 * 28) ovl++;
        }
        worst = Math.max(worst, ovl);
    }
    // 400 cross pairs; a handful of brief touches at most (before the fix: schools passed straight through each other)
    assert.ok(worst <= 8, 'up to ' + worst + ' overlapping cross pairs at once');
});

test('fish heading never changes faster than the turn limit (outside panic and the walls)', () => {
    const cfg = { fishCount: 120, anglerCount: 0, orcaCount: 0, jellyCount: 0, cursorFearLevel: 0 };
    const Bs = loadBoids({ random: mulberry32(7) });
    const sim = Bs.createSimulation(W, H, 1, cfg);
    let prev = null, worst = 0, sum = 0, n = 0;
    for (let t = 0; t < 2500; t++) {
        Bs.step(sim, 1, cfg);
        const fish = sim.entities.fish;
        const cur = fish.map(f => Math.atan2(f.vy, f.vx));
        if (prev && t > 500) for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            if (f.x < 30 || f.x > W - 30 || f.y < 30 || f.y > H - 30) continue;   // wall bounce is a separate mechanism
            let d = Math.abs(cur[i] - prev[i]); if (d > Math.PI) d = 2 * Math.PI - d;
            worst = Math.max(worst, d); sum += d; n++;
        }
        prev = cur;
    }
    assert.ok(worst <= 0.1 + 1e-6, 'a fish turned ' + worst.toFixed(4) + ' rad in one step (limit 0.1)');
    assert.ok(sum / n < 0.01, 'mean turn per step ' + (sum / n).toFixed(4) + ' rad (before the fix ~0.08)');
});

test('crowded fish do not flip heading back and forth (no twitching)', () => {
    const cfg = { fishCount: 200, anglerCount: 0, orcaCount: 0, jellyCount: 0, cursorFearLevel: 0 };
    const Bs = loadBoids({ random: mulberry32(9) });
    const sim = Bs.createSimulation(1366, 768, 1, cfg);
    const prevH = new Map(), prevD = new Map();
    let flips = 0, moves = 0;
    for (let t = 0; t < 2500; t++) {
        Bs.step(sim, 1, cfg);
        for (const f of sim.entities.fish) {
            const h = Math.atan2(f.vy, f.vx);
            if (t > 1000 && prevH.has(f)) {
                let d = h - prevH.get(f); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
                const pd = prevD.get(f);
                if (pd !== undefined && Math.abs(d) > 0.035 && Math.abs(pd) > 0.035) { moves++; if (d * pd < 0) flips++; }
                prevD.set(f, d);
            }
            prevH.set(f, h);
        }
    }
    // before the fix about 40 % of the sizeable turns reversed the previous one
    assert.ok(flips <= 0.02 * Math.max(1, moves) + 5, flips + ' reversals in ' + moves + ' sizeable consecutive turns');
});

test('births and counts still work with the new steering', () => {
    const cfg = { fishCount: 30, anglerCount: 0, orcaCount: 0, jellyCount: 0 };
    const Bs = loadBoids({ random: mulberry32(3) });
    const sim = Bs.createSimulation(W, H, 1, cfg);
    for (let i = 0; i < 20; i++) Bs.step(sim, 1, cfg);
    assert.strictEqual(sim.entities.fish.length, 30);
    cfg.fishCount = 50; Bs.step(sim, 1, cfg);
    assert.strictEqual(sim.entities.fish.length, 50);
    cfg.fishCount = 10; Bs.step(sim, 1, cfg);
    assert.strictEqual(sim.entities.fish.length, 10);
});

test('cursor and predators still make fish flee, and the separation sliders stay meaningful', () => {
    const run = (extra) => {
        const cfg = Object.assign({ fishCount: 60, anglerCount: 0, orcaCount: 0, jellyCount: 0, cursorFearLevel: 0 }, extra);
        const Bs = loadBoids({ random: mulberry32(13) });
        const sim = Bs.createSimulation(W, H, 1, cfg);
        for (let t = 0; t < 1500; t++) Bs.step(sim, 1, cfg);
        const fish = sim.entities.fish;
        let nn = 0;
        for (const a of fish) { let b = 1e9; for (const o of fish) if (o !== a) b = Math.min(b, Math.hypot(a.x - o.x, a.y - o.y)); nn += b; }
        return nn / fish.length;
    };
    // a wider personal space keeps the fish further apart, a lower repulsion lets them come closer
    const wide = run({ separationDist: 90 }), normal = run({}), none = run({ separationFactor: 0 });
    assert.ok(wide > normal, 'personal space 90 px: nearest neighbour ' + wide.toFixed(1) + ' vs ' + normal.toFixed(1));
    assert.ok(none <= normal + 1, 'repulsion 0 is not looser than the default');
    const cfg = { fishCount: 30, anglerCount: 0, orcaCount: 0, jellyCount: 0, cursorFearLevel: 2 };
    const Bs = loadBoids({ random: mulberry32(2) });
    const sim = Bs.createSimulation(W, H, 1, cfg);
    for (let t = 0; t < 300; t++) Bs.step(sim, 1, cfg);
    const f = sim.entities.fish[0];
    sim.mouse = { x: f.x + 40, y: f.y };
    const d0 = Math.hypot(f.x - sim.mouse.x, f.y - sim.mouse.y);
    for (let t = 0; t < 30; t++) Bs.step(sim, 1, cfg);
    assert.ok(Math.hypot(f.x - sim.mouse.x, f.y - sim.mouse.y) > d0 + 15, 'the fish did not move away from the cursor');
});

test('sim step cost stays small with 200 fish', () => {
    const cfg = { fishCount: 200 };
    const Bs = loadBoids({ random: mulberry32(1) });
    const sim = Bs.createSimulation(W, H, 1, cfg);
    for (let i = 0; i < 300; i++) Bs.step(sim, 1, cfg);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 500; i++) Bs.step(sim, 1, cfg);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 500;
    assert.ok(ms < 3, ms.toFixed(3) + ' ms per step (budget: 40 ms per step at 25 Hz, today ~0.4 ms)');
});

for (const k of [1.4, 2.0]) {
    test('sim.bodyScale ' + k + ': wider fish still do not overlap (measured with the scaled body), 200 fish on 1366x768', () => {
        const cfg = { fishCount: 200, anglerCount: 0, orcaCount: 0, jellyCount: 0 };
        const r = simulate(4, cfg, 1366, 768, k);
        assert.ok(r.fish < 0.05, (100 * r.fish).toFixed(2) + '% of fish overlap at scale ' + k);
        const fish = r.sim.entities.fish;
        // no clumping into a point: at most a few fish within a quarter of a (scaled) body of another one
        let tight = 0, pinned = 0;
        for (const a of fish) {
            let n = 0;
            for (const b of fish) if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 0.25 * 7 * k * 4) n++;
            if (n >= 3) tight++;
            if (a.x < 12 || a.x > 1366 - 12 || a.y < 12 || a.y > 768 - 12) pinned++;
        }
        assert.ok(tight <= 2, tight + ' fish are clumped');
        assert.ok(pinned <= 4, pinned + ' fish are pinned at the edges');
    });
}

test('sim.bodyScale: invalid values mean 1, 1 is the unchanged default, values are clamped', () => {
    const state = (scale) => {
        const cfg = { fishCount: 60 };
        const Bs = loadBoids({ random: mulberry32(21) });
        const sim = Bs.createSimulation(W, H, 1, cfg);
        for (let t = 0; t < 600; t++) { if (scale !== undefined) sim.bodyScale = scale; Bs.step(sim, 1, cfg); }
        return JSON.stringify(sim.entities.fish.map(f => [f.x, f.y, f.vx, f.vy]));
    };
    const base = state(undefined);
    for (const bad of [1, NaN, 'abc', -3, 0, Infinity, null]) assert.strictEqual(state(bad), base, 'bodyScale ' + String(bad) + ' must behave like 1');
    assert.notStrictEqual(state(1.5), base, 'a real scale changes the spacing');
    assert.strictEqual(state(50), state(2.0), 'the scale is capped at 2.0');
});
