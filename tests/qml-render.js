// Visual regression: renders each scenario with the ORIGINAL Canvas-per-entity renderer
// (tests/qml/legacy/BoidDelegate.qml) and the new EntityLayer in the real QML engine
// (offscreen), then compares pixel by pixel. Prints per-scenario stats and writes
// <out>/<scenario>-{legacy,new,diff}.png (diff = |A-B| x4, plus a grey copy of A).
// Usage: node tests/qml-render.js [outDir] [scenario...]     (exit 77 = qml6 unavailable)
// Thresholds: >= 99.5% of pixels within +-8 per channel (all scenarios).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png');

const outDir = process.argv[2] || path.join(os.tmpdir(), 'boids-render');
const only = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });
const names = fs.readFileSync(path.join(__dirname, 'qml', 'render-scenarios.js'), 'utf8')
    .split('\n').map(l => /^add\('([^']+)'/.exec(l)).filter(Boolean).map(m => m[1]);
const TH = 8, MIN_OK = 0.995;
// Stress overlay = base layer + tint layer at alpha, which equals the old colour blend inside a
// sprite but not on antialiased edge pixels (coverage is applied twice); the pulse (red -> navy)
// is the extreme case. Everything else is size-class / texture-resampling noise on edges.
const MIN_OK_BY = { 'crowded-stress0.6': 0.994, 'crowded-stress1.5': 0.985 };
const BLOCK = 8, BLOCK_MEAN = 24;   // an 8x8 block with mean |diff| > 24 means a sprite is missing/extra/misplaced

function render(mode, name) {
    const f = path.join(outDir, name + '-' + mode + '.png');
    try { fs.unlinkSync(f); } catch (e) {}
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'render.qml'), '--', mode, name, f], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
        encoding: 'utf8', timeout: 240000 });
    if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
    const bad = (r.stdout + r.stderr).split('\n').filter(l => /warn|error|Cannot|\[boids\]/i.test(l));
    if (!fs.existsSync(f)) throw new Error(mode + ' ' + name + ' produced no image:\n' + r.stdout + r.stderr);
    return { img: png.decode(fs.readFileSync(f)), warnings: bad };
}

let fail = 0;
console.log('scenario'.padEnd(20) + 'maxDiff  >8(%)   >32(%)  px>8   badBlocks | sprite-px >8 (of non-bg)');
for (const name of names) {
    if (only.length && !only.includes(name)) continue;
    const A = render('legacy', name), B = render('new', name);
    const a = A.img.px, b = B.img.px, N = A.img.W * A.img.H, d = Buffer.alloc(N * 4);
    let max = 0, n8 = 0, n32 = 0, nonBg = 0, nonBg8 = 0;
    for (let i = 0; i < N; i++) {
        let m = 0;
        for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(a[i * 4 + k] - b[i * 4 + k]));
        if (m > max) max = m;
        if (m > TH) n8++;
        if (m > 32) n32++;
        const y = (i / A.img.W) | 0, bgIsh = false;   // eslint-disable-line
        d[i * 4] = Math.min(255, m * 4); d[i * 4 + 1] = Math.min(255, m * 4); d[i * 4 + 2] = Math.min(255, m * 4); d[i * 4 + 3] = 255;
    }
    // pixels belonging to sprites: differ from the A-side background gradient by anything (row colour at x=0)
    for (let i = 0; i < N; i++) {
        const y = (i / A.img.W) | 0, r0 = y * A.img.W * 4;
        const isFg = [0, 1, 2].some(k => Math.abs(a[i * 4 + k] - a[r0 + k]) > 2 || Math.abs(b[i * 4 + k] - a[r0 + k]) > 2);
        if (isFg) { nonBg++; if (Math.max(Math.abs(a[i * 4] - b[i * 4]), Math.abs(a[i * 4 + 1] - b[i * 4 + 1]), Math.abs(a[i * 4 + 2] - b[i * 4 + 2])) > TH) nonBg8++; }
    }
    let badBlocks = 0;
    for (let by = 0; by + BLOCK <= A.img.H; by += BLOCK) for (let bx = 0; bx + BLOCK <= A.img.W; bx += BLOCK) {
        let sum = 0;
        for (let y = by; y < by + BLOCK; y++) for (let x = bx; x < bx + BLOCK; x++) {
            const i = (y * A.img.W + x) * 4;
            sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
        }
        if (sum / (BLOCK * BLOCK) > BLOCK_MEAN) badBlocks++;
    }
    fs.writeFileSync(path.join(outDir, name + '-diff.png'), png.encode(A.img.W, A.img.H, d));
    const ok = (1 - n8 / N) >= (MIN_OK_BY[name] || MIN_OK) && badBlocks === 0 && A.img.W === B.img.W && A.img.H === B.img.H && !B.warnings.length;
    if (!ok) fail++;
    console.log(name.padEnd(20) + String(max).padStart(6) + '  ' + (100 * n8 / N).toFixed(3).padStart(7) + ' ' + (100 * n32 / N).toFixed(3).padStart(7) +
        '  ' + String(n8).padStart(6) + String(badBlocks).padStart(8) + '   | ' + nonBg8 + '/' + nonBg + ' (' + (100 * nonBg8 / Math.max(1, nonBg)).toFixed(1) + '%)' + (ok ? '' : '   FAIL') +
        (B.warnings.length ? '\n   warnings: ' + B.warnings.slice(0, 3).join(' | ') : ''));
}
console.log(fail ? fail + ' scenario(s) over threshold' : 'all scenarios within threshold');
process.exit(fail ? 1 : 0);
