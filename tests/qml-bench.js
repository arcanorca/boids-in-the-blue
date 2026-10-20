// CPU benchmark of the themes: runs the real 40 ms sim + sync loop (500 ticks = 20 s, offscreen QML engine)
// per theme and case and prints process CPU time (user+sys, includes ~0.5 s startup) plus the
// sim/sync time spent inside the loop.
// Usage: node tests/qml-bench.js [theme ...]        (default: pixel gameboy; ~20 s per run)
const { spawnSync } = require('child_process');
const path = require('path');
const themes = process.argv.slice(2).length ? process.argv.slice(2) : ['pixel', 'gameboy'];
const cases = ['fish=38,stress=0', 'fish=200,stress=0', 'fish=38,stress=0.6', 'fish=38,stress=0,churn=1'];
console.log('theme       case                         cpu_user  cpu_sys  cpu_total  wall   step_ms sync_ms frames  backend');
for (const c of cases) for (const th of themes) {
    const r = spawnSync('bash', ['-c', 'TIMEFORMAT="TIME %U %S %R"; time qml6 "$0" -- "$1" "$2"', path.join(__dirname, 'qml', 'bench.qml'), th, c], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
        encoding: 'utf8', timeout: 180000 });
    const out = r.stdout + r.stderr;
    const t = /TIME (\S+) (\S+) (\S+)/.exec(out), b = /BENCH ticks (\d+) step_ms (\d+) sync_ms (\d+) frames (\d+) api (\S+)/.exec(out);
    if (!t || !b) { console.log(th, c, 'FAILED\n' + String(out).slice(-500)); continue; }
    console.log(th.padEnd(12) + c.padEnd(29) + t[1].padStart(8) + t[2].padStart(9) + (+t[1] + +t[2]).toFixed(2).padStart(11) + t[3].padStart(7) +
        b[2].padStart(8) + b[3].padStart(8) + b[4].padStart(7) + '  ' + b[5]);
}
