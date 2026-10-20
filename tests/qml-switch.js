// Runs tests/qml/switch.qml (the real main.qml with stub Plasma modules): cycles all themes at
// runtime, then checks that covering the wallpaper freezes every theme (two screenshots 500 ms
// apart are identical) while the running wallpaper does change. Exit 77 = qml6 unavailable.
// Usage: node tests/qml-switch.js [outDir]
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png');

const outDir = process.argv[2] || path.join(os.tmpdir(), 'boids-switch');
fs.mkdirSync(outDir, { recursive: true });
const r = spawnSync('qml6', ['-I', path.join(__dirname, 'qml', 'stubs'), path.join(__dirname, 'qml', 'switch.qml'), '--', outDir], {
    env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
    encoding: 'utf8', timeout: 240000 });
if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
const lines = (r.stdout + r.stderr).split('\n');
let fail = 0;
const ok = lines.filter(l => /SWITCH ok/.test(l)).length;
for (const l of lines) if (/SWITCH FAIL/.test(l)) { fail++; console.log(l); }
const bad = lines.filter(l => /warn|error|Cannot|TypeError|ReferenceError|\[boids\]|Unable|not a function/i.test(l) && !/SWITCH/.test(l));
if (bad.length) { fail++; console.log('QML warnings/errors:\n  ' + bad.slice(0, 8).join('\n  ')); }
if (!lines.some(l => /SWITCH ok finished/.test(l))) { fail++; console.log('switch test did not finish:\n' + (r.stdout + r.stderr).slice(-600)); }
// the real Occluder.qml (system org.kde.taskmanager) must load and idle sanely offscreen
const occ = spawnSync('qml6', [path.join(__dirname, 'qml', 'occluder.qml')], {
    env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }), encoding: 'utf8', timeout: 60000 });
const occLines = (occ.stdout + occ.stderr).split('\n');
for (const l of occLines) if (/OCC FAIL/.test(l)) { fail++; console.log(l); }
if (!occLines.some(l => /OCC ok\s+finished/.test(l))) { fail++; console.log('occluder test did not finish:\n' + (occ.stdout + occ.stderr).slice(-400)); }
else console.log('ok   Occluder.qml loads and reports "not covered" without windows');
const load = n => png.decode(fs.readFileSync(path.join(outDir, n + '.png')));
const same = (a, b) => a.W === b.W && a.H === b.H && Buffer.compare(Buffer.from(a.px), Buffer.from(b.px)) === 0;
for (const th of ['pixel', 'classic', 'biolum', 'nes']) {
    const frozen = same(load(th + '-paused0'), load(th + '-paused1'));
    const moving = !same(load(th + '-run0'), load(th + '-run1'));
    console.log((frozen && moving ? 'ok   ' : 'FAIL ') + th + ': covered -> frozen ' + frozen + ', running -> changing ' + moving);
    if (!(frozen && moving)) fail++;
}
console.log(ok + ' switch checks passed' + (fail ? ', ' + fail + ' failure(s)' : ''));
process.exit(fail ? 1 : 0);
