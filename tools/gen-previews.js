#!/usr/bin/env node
// Generates contents/themes/<id>/preview.png (480x270) for the settings page's theme cards:
// renders each theme through tests/qml/render.qml (the 'defaults' scene, same settings for every
// theme), crops a 960x540 window and halves it. Needs qml6 and ImageMagick (convert).
// Usage: node tools/gen-previews.js [theme...]
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadScript } = require('../tests/harness');

const ROOT = path.join(__dirname, '..');
const T = loadScript(path.join(ROOT, 'contents', 'ui', 'code', 'themes.js'));
const want = process.argv.slice(2).length ? process.argv.slice(2) : T.THEMES.map(t => t.id);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boids-previews-'));
for (const id of want) {
    const shot = path.join(tmp, id + '.png');
    let r = spawnSync('qml6', [path.join(ROOT, 'tests', 'qml', 'render.qml'), '--', id, 'defaults', shot], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen' }), encoding: 'utf8', timeout: 240000 });
    if (!fs.existsSync(shot)) { console.error(id + ': render failed\n' + r.stdout + r.stderr); process.exit(1); }
    const out = path.join(ROOT, 'contents', 'themes', id, 'preview.png');
    r = spawnSync('convert', [shot, '-crop', '960x540+700+120', '+repage', '-filter', 'Box', '-resize', '480x270', '-strip', out], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(id + ': convert failed ' + r.stderr); process.exit(1); }
    console.log(id + ' -> ' + path.relative(ROOT, out));
}
fs.rmSync(tmp, { recursive: true, force: true });
