const test = require('node:test');
const assert = require('node:assert');
const { loadBoids, mockComponent } = require('./harness');

const B = loadBoids();
const W = 1920, H = 1080;

function run(sim, cfg, steps, comp) {
    for (let i = 0; i < steps; i++) {
        B.step(sim, 1, cfg);
        if (comp) B.sync(sim, {}, comp);
    }
}

test('simulation stays finite and inside the screen', () => {
    const cfg = {};
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 3000);
    const all = [].concat(sim.entities.fish, sim.entities.anglers, sim.entities.orcas, sim.entities.jellies);
    for (const e of all) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), e.kind + ' position is not finite');
        assert.ok(e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H, e.kind + ' left the screen');
    }
});

test('lowering predator/jelly counts destroys their delegates', () => {
    const comp = mockComponent();
    const cfg = { anglerCount: 3, orcaCount: 3, jellyCount: 5, fishCount: 20 };
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 5, comp);
    const before = comp.live.size;
    cfg.anglerCount = 0; cfg.orcaCount = 0; cfg.jellyCount = 0;
    run(sim, cfg, 5, comp);
    assert.strictEqual(comp.live.size, before - 11, 'orphaned delegates remain on screen');
});

test('jellyfish keep drifting after hitting the walls', () => {
    const cfg = { fishCount: 5, anglerCount: 0, orcaCount: 0, jellyCount: 5 };
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 20000);
    for (const j of sim.entities.jellies)
        assert.ok(Math.abs(j.vy) >= j.speed * 0.8, 'jelly slowed to ' + j.vy.toFixed(3) + ' (base ' + j.speed.toFixed(3) + ')');
});

test('spatial grid covers the configured vision range', () => {
    const cfg = { visualRange: 400 };
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 2);
    assert.ok(sim.grid.cellSize >= 400, 'cell size ' + sim.grid.cellSize + ' < vision range 400');
});

test('manual spawns are capped', () => {
    const cfg = {};
    const sim = B.createSimulation(W, H, 1, cfg);
    for (let i = 0; i < 1000; i++) { B.forceSpawnBubble(sim, 10, 10); B.forceSpawnWorm(sim, 10, 10); }
    assert.ok(sim.entities.bubbles.length <= 150, 'bubbles: ' + sim.entities.bubbles.length);
    assert.ok(sim.entities.worms.length <= 40, 'worms: ' + sim.entities.worms.length);
});

test('entity errors are reported, not swallowed silently', () => {
    const cfg = {};
    const sim = B.createSimulation(W, H, 1, cfg);
    sim.entities.fish[0].update = function () { throw new Error('boom'); };
    const logged = [];
    const orig = B.console.warn;
    B.console.warn = (...a) => logged.push(a.join(' '));
    try { run(sim, cfg, 1); } finally { B.console.warn = orig; }
    assert.ok(logged.some(l => l.includes('boom')), 'no warning emitted');
});

test('one worm is eaten once per step, however many fish are near', () => {
    const cfg = { fishCount: 38, anglerCount: 0, orcaCount: 0, jellyCount: 0 };
    const sim = B.createSimulation(W, H, 1, cfg);
    for (const f of sim.entities.fish) { f.x = 500 + Math.random() * 4; f.y = 500 + Math.random() * 4; }
    B.forceSpawnWorm(sim, 502, 502);
    sim.entities.worms[0].y = 502; sim.entities.worms[0].x = 502;
    B.step(sim, 1, cfg);
    assert.strictEqual(sim.totalWormsEaten, 1);
});

test('babies add to the population and are capped', () => {
    const cfg = { fishCount: 20, anglerCount: 0, orcaCount: 0, jellyCount: 0 };
    const sim = B.createSimulation(W, H, 1, cfg);
    B.step(sim, 1, cfg);
    sim.totalWormsEaten = 9;
    const f = sim.entities.fish[0];
    B.forceSpawnWorm(sim, f.x, f.y);
    B.step(sim, 1, cfg);
    for (let i = 0; i < 200; i++) B.step(sim, 1, cfg);
    assert.strictEqual(sim.entities.fish.length, 21, 'baby was culled or not born');
    for (let n = 0; n < 60; n++) {
        sim.totalWormsEaten = 9;
        const g = sim.entities.fish[0];
        B.forceSpawnWorm(sim, g.x, g.y);
        B.step(sim, 1, cfg);
    }
    for (let i = 0; i < 5; i++) B.step(sim, 1, cfg);
    assert.ok(sim.entities.fish.length <= 20 + 20, 'births exceed cap: ' + sim.entities.fish.length);
});

test('NaN positions and a zero-size screen do not break the step', () => {
    const cfg = { fishCount: 10, anglerCount: 1, orcaCount: 1, jellyCount: 1 };
    const sim = B.createSimulation(W, H, 1, cfg);
    sim.entities.fish[0].x = NaN;
    sim.entities.fish[1].vy = NaN;
    sim.entities.orcas[0].x = NaN;
    run(sim, cfg, 3);
    const all = [].concat(sim.entities.fish, sim.entities.anglers, sim.entities.orcas, sim.entities.jellies);
    for (const e of all) assert.ok(Number.isFinite(e.x + e.y + e.vx + e.vy), e.kind + ' not finite');

    const z = B.createSimulation(0, 0, 1, cfg);
    run(z, cfg, 3);
    B.resize(z, W, H, 1);
    run(z, cfg, 3);
    const xs = z.entities.fish.map(f => f.x);
    assert.ok(xs.some(x => x > 0), 'entities not redistributed after first real size');
    for (const f of z.entities.fish) assert.ok(f.x >= 0 && f.x <= W && f.y >= 0 && f.y <= H);
});

test('non-numeric config falls back to defaults; counts are clamped', () => {
    const cfg = { fishCount: 'abc', anglerCount: -4, orcaCount: 0, jellyCount: 2.7, visualRange: 'x' };
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 2);
    assert.strictEqual(sim.entities.fish.length, 38);
    assert.strictEqual(sim.entities.anglers.length, 0);
    assert.strictEqual(sim.entities.jellies.length, 2);
    for (const f of sim.entities.fish) assert.ok(Number.isFinite(f.x));
});

test('cursorFearLevel falls back to 2 and min speed never exceeds max speed', () => {
    const cfg = { fishMinSpeed: 5, fishMaxSpeed: 1 };
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 1);
    assert.strictEqual(sim._c.fearLevel, 2);
    assert.ok(sim._c.minSpeed <= sim._c.maxSpeed);
});

test('resize keeps the grid when dimensions are unchanged and clamps entities', () => {
    const cfg = {};
    const sim = B.createSimulation(W, H, 1, cfg);
    run(sim, cfg, 1);
    const g = sim.grid;
    B.resize(sim, W, H, 2);
    assert.strictEqual(sim.grid, g, 'grid rebuilt needlessly');
    B.resize(sim, 800, 600, 1);
    for (const f of sim.entities.fish) assert.ok(f.x <= 800 && f.y <= 600);
});
