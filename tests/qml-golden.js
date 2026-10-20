// Runs tests/qml/golden.qml in the real QML engine (V4, needs qml6).
//  * Compared EXACTLY with tests/fixtures/golden.qml.txt, which was produced by
//    the pre-refactor monolithic boids.js run in the same engine: proves the
//    adapter + core + `.import` chain is bit-identical to the old file under V4.
//  * Compared with the Node fixtures for information only: V4 and V8 can differ
//    by 1 ulp in Math.sin/cos, which the (chaotic) flock amplifies.
// The QML fixture depends on this machine's libm; if it ever fails on another
// system with no code change, regenerate it from a pre-change checkout.
// Usage: node tests/qml-golden.js     (exit 77 = qml6 unavailable)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const node = require('./fixtures/golden.json');
const expected = fs.readFileSync(path.join(__dirname, 'fixtures', 'golden.qml.txt'), 'utf8').split('\n').filter(Boolean);

const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'golden.qml')], {
    env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
    encoding: 'utf8', timeout: 180000 });
if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
const got = (r.stdout + r.stderr).split('\n').map(l => l.replace(/^qml: /, '')).filter(l => l.startsWith('GOLDEN '));
if (!got.length) { console.error('no GOLDEN output from qml6:\n' + r.stdout + r.stderr); process.exit(1); }

let bad = 0;
for (let i = 0; i < Math.max(got.length, expected.length); i++)
    if (got[i] !== expected[i]) { bad++; console.error('QML MISMATCH #' + i + ': got "' + got[i] + '" expected "' + expected[i] + '"'); }
let sameAsNode = 0;
for (const l of got) {
    const m = /GOLDEN (\S+) (s\d+) (\w+)/.exec(l);
    if (m && node.scenarios[m[1]][m[2]].hash === m[3]) sameAsNode++;
}
console.log('qml golden: ' + (got.length - bad) + '/' + expected.length + ' checkpoints identical to pre-refactor QML run' +
    ' (' + sameAsNode + '/' + got.length + ' also identical to Node)');
process.exit(bad ? 1 : 0);
