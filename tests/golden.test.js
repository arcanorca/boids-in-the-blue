// Characterization tests: the stored fixtures were generated from the
// pre-refactor boids.js. Any change in simulation/sync state fails here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadBoids, loadScript, mockComponent, mulberry32 } = require('./harness');

const S = loadScript(path.join(__dirname, 'scenarios.js'));
const FIX = path.join(__dirname, 'fixtures', 'golden.json');
const SEED = 20240607;

function runOne(sc, viaSetters) {
    const B = loadBoids(viaSetters ? {} : { random: mulberry32(SEED) });
    let t = 0;
    if (viaSetters) { B.setRandom(mulberry32(SEED)); B.setClock(() => t); }
    const comp = mockComponent();
    return S.runScenario(B, sc, comp, viaSetters ? (v) => { t = v; } : B.setTime);
}

const fixtures = JSON.parse(fs.readFileSync(FIX, 'utf8'));

test('fixtures cover every scenario', () => {
    assert.deepStrictEqual(Object.keys(fixtures.scenarios), Array.from(S.SCENARIOS, s => s.name));
});

for (const sc of S.SCENARIOS) {
    test('golden: ' + sc.name, () => {
        const got = runOne(sc, false);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), fixtures.scenarios[sc.name]);
    });
}

// Optional setRandom/setClock API (added by the refactor) must reproduce the same state
const probe = loadBoids();
if (probe.setRandom) {
    for (const name of ['defaults', 'stress1.5', 'worms-births', 'config-changes']) {
        test('golden via setRandom/setClock: ' + name, () => {
            const sc = S.SCENARIOS.find(s => s.name === name);
            assert.deepStrictEqual(JSON.parse(JSON.stringify(runOne(sc, true))), fixtures.scenarios[name]);
        });
    }
}
