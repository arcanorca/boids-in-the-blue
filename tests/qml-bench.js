// CPU benchmark of the theme renderers (offscreen): runs the real 40 ms sim+sync loop for 12 s and
// prints process CPU time (user+sys, includes ~0.5 s startup), sync time and rendered frames.
// Usage: node tests/qml-bench.js [theme ...]      (default: pixel amiga; ~12 s per run)
const { spawnSync } = require('child_process');
const path = require('path');
const themes = process.argv.slice(2).length ? process.argv.slice(2) : ['pixel', 'amiga'];
const cases = ['fish=38,stress=0', 'fish=200,stress=0', 'fish=38,stress=0.9'];
console.log('theme     case                 cpu_user cpu_sys  cpu_total  sync_ms frames  backend');
for (const c of cases) for (const th of themes) {
    const r = spawnSync('bash', ['-c', 'TIMEFORMAT="TIME %U %S %R"; time qml6 "$0" -- "$1" "$2"', path.join(__dirname, 'qml', 'bench.qml'), th, c], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }), encoding: 'utf8', timeout: 120000 });
    const out = r.stdout + r.stderr;
    const t = /TIME (\S+) (\S+) (\S+)/.exec(out), b = /BENCH ticks (\d+) sync_ms (\d+) frames (\d+) api (\S+)/.exec(out);
    if (!t || !b) { console.log(th, c, 'FAILED\n' + String(out).slice(-500)); continue; }
    console.log(th.padEnd(10) + c.padEnd(21) + t[1].padStart(8) + t[2].padStart(8) + (+t[1] + +t[2]).toFixed(2).padStart(11) + b[2].padStart(9) + b[3].padStart(7) + '  ' + b[4]);
}
