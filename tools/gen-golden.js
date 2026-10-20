// Regenerates tests/fixtures/golden.json from the CURRENT code.
// Only do this deliberately (a behaviour change), never to "fix" a refactor.
const fs = require('fs');
const path = require('path');
const { loadBoids, loadScript, mockComponent, mulberry32 } = require('../tests/harness');
const S = loadScript(path.join(__dirname, '..', 'tests', 'scenarios.js'));
const out = { seed: 20240607, scenarios: {} };
for (const sc of S.SCENARIOS) {
    const B = loadBoids({ random: mulberry32(out.seed) });
    out.scenarios[sc.name] = JSON.parse(JSON.stringify(S.runScenario(B, sc, mockComponent(), B.setTime)));
}
const file = path.join(__dirname, '..', 'tests', 'fixtures', 'golden.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log('wrote ' + file + ' (' + Object.keys(out.scenarios).length + ' scenarios)');
