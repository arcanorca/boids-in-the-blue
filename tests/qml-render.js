// Offscreen render checks for every theme (needs qml6; exit 77 = unavailable).
//   node tests/qml-render.js compare [outDir]      classic vs the frozen ORIGINAL renderer
//                                                  (tests/qml/legacy): must be pixel-identical
//   node tests/qml-render.js smoke [outDir]        every theme x a few scenes: no QML warnings,
//                                                  correct size, not blank, not a copy of another theme
//   node tests/qml-render.js previews <outDir> [theme...]   day, crowded, stress1.5 (+ night, dusk, feeding
//                                                  with ALL=1) per theme, as <outDir>/<theme>/<scene>.png
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png');
const { loadScript } = require('./harness');

const T = loadScript(path.join(__dirname, '..', 'contents', 'ui', 'code', 'themes.js'));
const THEMES = T.THEMES.map(t => t.id);
const cmd = process.argv[2] || 'compare';
const outDir = process.argv[3] || path.join(os.tmpdir(), 'boids-render');

function render(mode, scenario, file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { fs.unlinkSync(file); } catch (e) {}
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'render.qml'), '--', mode, scenario, file], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
        encoding: 'utf8', timeout: 240000 });
    if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
    const warnings = (r.stdout + r.stderr).split('\n').filter(l => /warn|error|Cannot|TypeError|ReferenceError|\[boids\]/i.test(l));
    if (!fs.existsSync(file)) throw new Error(mode + ' ' + scenario + ' produced no image:\n' + r.stdout + r.stderr);
    return { img: png.decode(fs.readFileSync(file)), warnings, file };
}

let fail = 0;
function check(ok, msg) { if (!ok) { fail++; console.log('FAIL ' + msg); } else console.log('ok   ' + msg); }

if (cmd === 'compare') {
    for (const sc of ['defaults', 'stress1.5', 'crowded', 'worms-bubbles', 'orca-angler-jelly']) {
        const A = render('legacy', sc, path.join(outDir, sc + '-legacy.png'));
        const B = render('classic', sc, path.join(outDir, sc + '-classic.png'));
        let diff = 0, max = 0;
        const n = A.img.W * A.img.H * 4;
        if (A.img.W !== B.img.W || A.img.H !== B.img.H) diff = n;
        else for (let i = 0; i < n; i++) { const d = Math.abs(A.img.px[i] - B.img.px[i]); if (d) { diff++; if (d > max) max = d; } }
        check(diff === 0 && !B.warnings.length, 'classic == legacy ' + sc + ' (differing channels: ' + diff + ', max ' + max + ')' + (B.warnings.length ? ' ' + B.warnings[0] : ''));
    }
} else if (cmd === 'smoke') {
    const scenes = ['defaults', 'stress1.5', 'night'];
    const hashes = {};
    for (const th of THEMES) for (const sc of scenes) {
        if (th === 'classic' && sc === 'night') continue;   // classic colours come from main.qml, not the scene
        if (th === 'onebit' && sc === 'night') continue;     // flat ink water: night is identical to day by design
        const R = render(th, sc, path.join(outDir, th, sc + '.png'));
        const px = R.img.px, N = R.img.W * R.img.H;
        const seen = new Set();
        for (let i = 0; i < N; i += 97) seen.add(px[i * 4] >> 4 | (px[i * 4 + 1] >> 4) << 4 | (px[i * 4 + 2] >> 4) << 8);
        const h = require('crypto').createHash('md5').update(px).digest('hex');
        check(R.img.W === 1920 && R.img.H === 1080 && seen.size > (th === 'gameboy' ? 3 : (th === 'onebit' || th === 'ukiyoe') ? 1 : 12) &&  /* gameboy: four shades (+ LCD glass); onebit, ukiyoe: two colours by design */ !R.warnings.length && !hashes[h],
              th + ' ' + sc + ' (colours ' + seen.size + (R.warnings.length ? ', ' + R.warnings[0] : '') + ')');
        hashes[h] = 1;
    }
} else if (cmd === 'previews') {
    const want = process.argv.slice(4).length ? process.argv.slice(4) : THEMES;
    const scenes = { day: 'defaults', crowded: 'crowded', 'stress-1.5': 'stress1.5' };
    if (process.env.ALL) Object.assign(scenes, { night: 'night', dusk: 'dusk', feeding: 'feeding' });
    for (const th of want) for (const s of Object.keys(scenes)) {
        const R = render(th, scenes[s], path.join(outDir, th, s + '.png'));
        console.log(th + '/' + s + ': ' + R.file + (R.warnings.length ? '  WARN ' + R.warnings[0] : ''));
    }
} else { console.error('unknown command ' + cmd); process.exit(2); }
process.exit(fail ? 1 : 0);
