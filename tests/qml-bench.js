// CPU benchmark of theme scenes in the real QML engine (offscreen): 15 s of the real 40 ms sim+sync loop,
// prints process CPU time (user+sys, includes ~0.5 s startup), the JS time per tick spent in sim step and
// in the theme's sync, and rendered frames.
// Usage: node tests/qml-bench.js [theme ...]      (default: pixel onebit; ~15 s per run)
const { spawnSync } = require('child_process');
const path = require('path');
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['pixel', 'onebit'];
const cases = ['fish=38,stress=0', 'fish=200,stress=0', 'fish=38,stress=1.5', 'fish=200,stress=0.6'];
console.log('theme      case                  cpu_user cpu_sys cpu_total  step_ms sync_ms frames');
for (const c of cases) for (const mode of modes) {
    const r = spawnSync('bash', ['-c', 'TIMEFORMAT="TIME %U %S %R"; time qml6 "$0" -- "$1" "$2"', path.join(__dirname, 'qml', 'bench.qml'), mode, c], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }), encoding: 'utf8', timeout: 120000 });
    const out = r.stdout + r.stderr, t = /TIME (\S+) (\S+) (\S+)/.exec(out), b = /BENCH ticks (\d+) step_ms (\d+) sync_ms (\d+) frames (\d+)/.exec(out);
    if (!t || !b) { console.log(mode, c, 'FAILED\n' + out.slice(-400)); continue; }
    console.log(mode.padEnd(10) + c.padEnd(22) + t[1].padStart(8) + t[2].padStart(8) + (+t[1] + +t[2]).toFixed(2).padStart(10) + b[2].padStart(9) + b[3].padStart(8) + b[4].padStart(7));
}
