// Renders the preview scenes of a theme (offscreen, 1920x1080) and a sprite sheet.
// Usage: node tests/theme-preview.js <themeId> <outDir> [scene...]
//   scenes: day night dusk crowded stress-0.9 stress-1.5 feeding   (default: all)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const theme = process.argv[2] || 'illustrated';
const outDir = process.argv[3] || path.join(require('os').tmpdir(), 'boids-previews', theme);
const only = process.argv.slice(4);
fs.mkdirSync(outDir, { recursive: true });
const SCENES = { day: 'defaults', night: 'night', dusk: 'dusk', crowded: 'crowded', 'stress-0.9': 'stress0.9', 'stress-1.5': 'stress1.5', feeding: 'feeding' };
let fail = 0;
for (const name of Object.keys(SCENES)) {
    if (only.length && !only.includes(name)) continue;
    const out = path.join(outDir, name + '.png');
    try { fs.unlinkSync(out); } catch (e) {}
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'render.qml'), '--', theme, SCENES[name], out], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }), encoding: 'utf8', timeout: 300000 });
    const bad = (r.stdout + r.stderr).split('\n').filter(l => /warn|error|Cannot|\[boids/i.test(l));
    if (!fs.existsSync(out) || bad.length) { fail++; console.log(name + ': FAILED\n' + bad.slice(0, 5).join('\n') + (fs.existsSync(out) ? '' : '\n' + (r.stdout + r.stderr).slice(-400))); }
    else console.log(name + ': ' + out);
}
if (!only.length && theme === 'illustrated') {
    const r = spawnSync('python3', [path.join(__dirname, '..', 'tools', 'illustrated-sheet.py'), path.join(outDir, 'sprites.png')], { encoding: 'utf8' });
    if (r.status !== 0) { fail++; console.log('sprite sheet failed: ' + r.stderr); } else console.log('sprites: ' + path.join(outDir, 'sprites.png'));
}
process.exit(fail ? 1 : 0);
