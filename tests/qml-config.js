// Settings page harness (needs qml6; exit 77 = unavailable). Stages contents/ui/{config,NumberInput,
// ValueSlider,HelpSlot}.qml + code/themes.js into a temp dir with the shell's i18n* globals replaced by a
// stub, and the main.xml defaults/ranges as JS, then runs tests/qml/config.qml offscreen.
// Usage: node tests/qml-config.js [outDir] [width]    -> <outDir>/settings-collapsed.png, settings-expanded.png
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const outDir = process.argv[2] || path.join(os.tmpdir(), 'boids-settings');
const width = process.argv[3] || '600';
fs.mkdirSync(outDir, { recursive: true });
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'boids-config-'));

const xml = fs.readFileSync(path.join(ROOT, 'contents', 'config', 'main.xml'), 'utf8');
const DEFAULTS = {}, RANGES = {};
const re = /<entry name="(\w+)" type="(\w+)">([\s\S]*?)<\/entry>/g;
let m;
while ((m = re.exec(xml))) {
    const def = /<default>([^<]*)<\/default>/.exec(m[3])[1];
    DEFAULTS[m[1]] = m[2] === 'Bool' ? def === 'true' : (m[2] === 'String' ? def : Number(def));
    const mn = /<min>([^<]*)<\/min>/.exec(m[3]), mx = /<max>([^<]*)<\/max>/.exec(m[3]);
    if (mn && mx) RANGES[m[1]] = [Number(mn[1]), Number(mx[1])];
}
fs.writeFileSync(path.join(stage, 'defaults.js'), '.pragma library\nvar DEFAULTS = ' + JSON.stringify(DEFAULTS) + ';\nvar RANGES = ' + JSON.stringify(RANGES) + ';\n');
fs.writeFileSync(path.join(stage, 'L.js'), `.pragma library
function _f(s, a) { return String(s).replace(/%(\\d)/g, function (_, i) { return a[i - 1]; }); }
function i18n(s) { return _f(s, Array.prototype.slice.call(arguments, 1)); }
function i18nc(c, s) { return _f(s, Array.prototype.slice.call(arguments, 2)); }
function i18nd(d, s) { return _f(s, Array.prototype.slice.call(arguments, 2)); }
`);
fs.mkdirSync(path.join(stage, 'code'));
fs.copyFileSync(path.join(ROOT, 'contents', 'ui', 'code', 'themes.js'), path.join(stage, 'code', 'themes.js'));
for (const f of ['config.qml', 'NumberInput.qml', 'ValueSlider.qml', 'HelpSlot.qml']) {
    let s = fs.readFileSync(path.join(ROOT, 'contents', 'ui', f), 'utf8');
    s = s.replace(/\bi18n(c|p|d|cp)?\(/g, 'L.i18n$1(').replace(/^import QtQuick$/m, 'import QtQuick\nimport "L.js" as L');
    s = s.replace(/L\.i18np\(/g, 'L.i18n(').replace(/L\.i18ncp\(/g, 'L.i18nc(');
    fs.writeFileSync(path.join(stage, f), s);
}
fs.copyFileSync(path.join(__dirname, 'qml', 'config.qml'), path.join(stage, 'harness.qml'));
const a = path.join(outDir, 'settings-collapsed.png'), b = path.join(outDir, 'settings-expanded.png');
const r = spawnSync('qml6', [path.join(stage, 'harness.qml'), '--', a, b, width], {
    env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
    encoding: 'utf8', timeout: 180000 });
if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
const lines = (r.stdout + r.stderr).split('\n');
let fail = 0;
for (const l of lines) if (/CONFIG /.test(l)) { console.log(l.replace(/^qml: /, '')); if (/CONFIG FAIL/.test(l)) fail++; }
const bad = lines.filter(l => /warn|error|Cannot|TypeError|ReferenceError|not a function|Unable|binding loop/i.test(l) && !/CONFIG|installEventFilter/.test(l));   // installEventFilter: harmless Kirigami twin-layout message under the offscreen runner
if (bad.length) { fail++; console.log('QML warnings/errors:\n  ' + bad.slice(0, 10).join('\n  ')); }
if (!lines.some(l => /CONFIG ok\s+finished/.test(l))) { fail++; console.log('harness did not finish\n' + (r.stdout + r.stderr).slice(-800)); }
fs.rmSync(stage, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
