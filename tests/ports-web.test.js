// Smoke test for the web port: loads the generated classic-script build in a vm
// with a fake `window`, runs the simulation and checks that everything stays finite.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = path.join(__dirname, '..', 'boids-web', 'boids-core.js');

test('web build exposes BoidsCore and simulates 1000 steps with finite positions', () => {
    const window = {};
    const ctx = vm.createContext({ window, globalThis: window, console });
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE });
    const Core = window.BoidsCore;
    assert.ok(Core, 'window.BoidsCore missing');
    for (const n of ['createSimulation', 'step', 'resize', 'forceSpawnWorm', 'forceSpawnBubble', 'SPRITES', 'WORM_COLOR', 'BUBBLE_COLOR'])
        assert.ok(n in Core, 'missing export ' + n);

    const cfg = { fishCount: 38, jellyCount: 5, anglerCount: 3, orcaCount: 3 };
    const sim = Core.createSimulation(1280, 720, 1, cfg);
    Core.forceSpawnWorm(sim, 400, 300);
    for (let i = 0; i < 1000; i++) {
        Core.step(sim, 1, cfg);
        if (i === 400) Core.resize(sim, 900, 600, 2);
        if (i === 500) { sim.mouse.x = 450; sim.mouse.y = 300; Core.forceSpawnBubble(sim, 450, 300); }
    }
    let n = 0;
    for (const list of sim.allLists) for (const e of list) {
        n++;
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), e.kind + ' has non-finite position');
    }
    assert.ok(n >= 40, 'entities exist');
    assert.ok(sim._c && sim._c.fishSize > 0);
});
