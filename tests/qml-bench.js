// CPU benchmark of the renderers: runs the real 40 ms sim+sync loop for 20 s in the real
// QML engine (offscreen, see the backend line) with the ORIGINAL Canvas-per-entity renderer
// ("legacy") and the new EntityLayer, and prints process CPU time (user+sys, includes ~0.5 s
// startup) and, if available, QSG_RENDER_TIMING output.
// Usage: node tests/qml-bench.js [legacy|new|illustrated ...]   (takes ~20 s per run; "illustrated" = contents/themes/illustrated)
const { spawnSync } = require('child_process');
const path = require('path');
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['legacy', 'new'];
const cases = [['fish=38,stress=0'], ['fish=38,stress=0.6'], ['fish=200,stress=0'], ['fish=200,stress=0.6'],
    ['fish=38,stress=0,churn=1'], ['fish=200,stress=0,ramp=1']];   // churn: bubbles+worms spawn/die constantly; ramp: stress sweeps the tint levels
console.log('mode    case                      cpu_user  cpu_sys  cpu_total  wall   step_ms sync_ms frames  backend');
for (const c of cases) for (const mode of modes) {
    const r = spawnSync('bash', ['-c', 'TIMEFORMAT="TIME %U %S %R"; time qml6 "$0" -- "$1" defaults "$2" bench', path.join(__dirname, 'qml', 'render.qml'), mode, c[0]], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1', QSG_RENDER_TIMING: process.env.TIMING ? '1' : '' }),
        encoding: 'utf8', timeout: 120000 });
    const out = r.stdout + r.stderr;
    const t = /TIME (\S+) (\S+) (\S+)/.exec(out), b = /BENCH ticks (\d+) step_ms (\d+) sync_ms (\d+) frames (\d+) api (\S+)/.exec(out);
    if (!t || !b) { console.log(mode, c[0], 'FAILED\n' + String(out).slice(-500)); continue; }
    console.log(mode.padEnd(8) + c[0].padEnd(26) + t[1].padStart(8) + t[2].padStart(9) + (+t[1] + +t[2]).toFixed(2).padStart(11) + t[3].padStart(7) +
        b[2].padStart(8) + b[3].padStart(8) + b[4].padStart(7) + '  ' + b[5]);
    if (process.env.TIMING) console.log(out.split('\n').filter(l => /render|polish|sync|swap|gui/i.test(l)).slice(-3).join('\n'));
}
