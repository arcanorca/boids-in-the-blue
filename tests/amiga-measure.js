// Measurements for the "amiga" theme (A calm backdrop, B smooth motion, D proportions).
//   node tests/amiga-measure.js [calm|motion|sizes|all] [--theme amiga] [--keep dir]
// Needs qml6 (exit 77 if missing). Prints numbers and PASS/FAIL against the acceptance criteria.
// Works on any theme revision: it only uses rendered pixels and the sprite's on-screen x.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png');

const argv = process.argv.slice(2);
const what = argv.find(a => !a.startsWith('--') && !/^\//.test(a)) || 'all';
const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const theme = opt('theme') || 'amiga';
const WORK = opt('keep') || fs.mkdtempSync(path.join(os.tmpdir(), 'amiga-measure-'));
const REF = { fishW: 36, fishH: 26 };       // 1080p reference sizes (screen px)

function run(mode, dir) {
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'amiga-measure.qml'), '--', theme, mode, dir], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }), encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 28 });
    if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
    return r.stdout + r.stderr;
}
const load = f => png.decode(fs.readFileSync(f));
let fails = 0;
const report = (ok, msg) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + msg); };

// ── A: calm backdrop ─────────────────────────────────────────
function calm() {
    const dir = path.join(WORK, 'calm'), out = run('calm', dir);
    const times = [...out.matchAll(/FRAME (\d+) (\d+)/g)].map(m => +m[2]);
    const frames = times.map((_, i) => load(path.join(dir, 'f' + String(i).padStart(3, '0') + '.png')));
    const N = frames[0].W * frames[0].H;
    const differs = (a, b) => { let c = 0; for (let i = 0; i < N; i++) { const o = i * 4; if (a.px[o] !== b.px[o] || a.px[o + 1] !== b.px[o + 1] || a.px[o + 2] !== b.px[o + 2]) c++; } return c; };
    let worst = 0, wp = '';
    for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
        const dt = (times[j] - times[i]) / 1000;
        if (dt < 0.09 || dt > 10.5) continue;
        if (j - i > 3 && (i % 3 || j % 3) && !(i === 0)) continue;           // thin out the long-lag pairs
        const d = differs(frames[i], frames[j]) / N;
        if (d > worst) { worst = d; wp = 'frames ' + i + '-' + j + ' dt ' + dt.toFixed(2) + ' s'; }
    }
    // temporal frequency: transitions of each pixel in the 100 ms section (first 30 frames = 3 s)
    const K = 30, cnt = new Uint8Array(N);
    for (let f = 1; f < K; f++) for (let i = 0; i < N; i++) {
        const o = i * 4, a = frames[f - 1].px, b = frames[f].px;
        if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2]) cnt[i]++;
    }
    let maxT = 0, over = 0;
    const span = (times[K - 1] - times[0]) / 1000;
    for (let i = 0; i < N; i++) { if (cnt[i] > maxT) maxT = cnt[i]; if (cnt[i] / span / 2 > 2) over++; }
    const hz = maxT / span / 2;
    console.log('A calm: max differing pixels between frames 0.1-10 s apart = ' + (worst * 100).toFixed(3) + ' % (' + wp + ')');
    console.log('A calm: fastest pixel = ' + maxT + ' transitions in ' + span.toFixed(1) + ' s = ' + hz.toFixed(2) + ' Hz; pixels above 2 Hz: ' + over);
    report(worst <= 0.02, 'A1 <= 2 % of the screen differs');
    report(hz <= 2, 'A2 nothing changes faster than 2 Hz');
    return frames[0];
}

// ── B: smooth motion ─────────────────────────────────────────
function motion() {
    for (const vx of [3, 0.6]) {
        const out = run('motion:' + vx, path.join(WORK, 'motion-' + vx)), m = /MOTION (\{.*\})/.exec(out);
        if (!m) { console.log(out.slice(-600)); report(false, 'B motion run failed'); return; }
        const d = JSON.parse(m[1]), s = d.s;
        // sample every ~100 ms: x increments, compared with the constant velocity of the entity
        const pick = [s[0]];
        for (const p of s) if (p[0] - pick[pick.length - 1][0] >= 100) pick.push(p);
        const v = d.vx / d.tick;                                  // px/ms of the entity
        let worst = 0, mn = 1e9, mx = -1e9;
        for (let i = 1; i < pick.length; i++) {
            const dt = pick[i][0] - pick[i - 1][0], inc = pick[i][1] - pick[i - 1][1];
            worst = Math.max(worst, Math.abs(inc - v * dt)); mn = Math.min(mn, inc); mx = Math.max(mx, inc);
        }
        let smallest = 1e9, largest = 0;                          // every display frame
        for (let i = 1; i < s.length; i++) { const dx = s[i][1] - s[i - 1][1]; smallest = Math.min(smallest, dx); largest = Math.max(largest, dx); }
        console.log('B motion @' + (v * 1000).toFixed(1) + ' px/s: ' + s.length + ' display frames in 4 s; 100 ms increments ' + mn + '..' + mx + ' px (ideal ' + (v * 100).toFixed(2) + '), worst deviation ' + worst.toFixed(2) + ' px; per-frame step ' + smallest + '..' + largest + ' px');
        report(worst <= 1.0 + 1e-9 && s.length > 100, 'B on-screen x increments uniform within +-1 px at ' + (v * 1000).toFixed(1) + ' px/s');
    }
}

// ── D: proportions (rendered pixels) ─────────────────────────
function sizes() {
    const dir = path.join(WORK, 'sizes'); run('sizes', dir);
    const base = load(path.join(dir, 'sizes-base.png'));
    const zones = { fish: [150, 450, 330, 480], orca: [560, 1000, 300, 500], angler: [1000, 1400, 300, 500], jelly: [1420, 1760, 250, 600], worm: [200, 400, 620, 780], bubble: [600, 1000, 620, 780] };
    const res = {};
    for (const cs of ['default', 'small', 'large', 'baby', 'huge', 'tiny']) {
        const im = load(path.join(dir, 'sizes-' + cs + '.png'));
        for (const k in zones) {
            const [x0, x1, y0, y1] = zones[k];
            let a = 1e9, b = -1, c = 1e9, e = -1;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                const o = (y * im.W + x) * 4, df = Math.abs(im.px[o] - base.px[o]) + Math.abs(im.px[o + 1] - base.px[o + 1]) + Math.abs(im.px[o + 2] - base.px[o + 2]);
                if (df > 60) { if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > e) e = y; }
            }
            res[cs + '/' + k] = b < 0 ? null : [b - a + 1, e - c + 1];
        }
    }
    const L = (cs, k) => res[cs + '/' + k];
    const fmt = (cs, k) => { const r = L(cs, k); return r ? r[0] + 'x' + r[1] : '-'; };
    console.log('D sizes (screen px, w x h) default: fish ' + fmt('default', 'fish') + ', orca ' + fmt('default', 'orca') + ', angler ' + fmt('default', 'angler') + ', jelly ' + fmt('default', 'jelly') + ', worm ' + fmt('default', 'worm') + ', bubbles ' + fmt('default', 'bubble'));
    console.log('D fish variation: small ' + fmt('small', 'fish') + ', large ' + fmt('large', 'fish') + ', baby ' + fmt('baby', 'fish') + ', size 8 ' + fmt('huge', 'fish') + ', size 1 ' + fmt('tiny', 'fish'));
    const within = (v, ref, tol) => v >= ref * (1 - tol) && v <= ref * (1 + tol);
    const fw = L('default', 'fish') ? L('default', 'fish')[0] : 0, fh = L('default', 'fish') ? L('default', 'fish')[1] : 0;
    report(within(fw, REF.fishW, 0.15) && within(fh, REF.fishH, 0.15), 'D1 fish ' + fw + 'x' + fh + ' ~ ' + REF.fishW + 'x' + REF.fishH);
    const r = (k, ref) => { const v = L('default', k); return v && within(Math.max(v[0], 0), ref, 0.15); };
    report(r('orca', 3 * REF.fishW), 'D2 orca ~ 3x fish length (' + 3 * REF.fishW + ')');
    report(r('angler', 1.5 * REF.fishW), 'D3 angler ~ 1.5x fish length (' + 1.5 * REF.fishW + ')');
    const jl = L('default', 'jelly');
    report(jl && within(jl[0], REF.fishW, 0.15) || (jl && within(L('small', 'jelly')[0], REF.fishW, 0.15)), 'D4 jelly bell ~ fish length wide (' + (jl ? jl[0] : '-') + ', small ' + fmt('small', 'jelly') + ')');
    const wm = L('default', 'worm');
    report(wm && within(Math.max(wm[0], wm[1]), 0.3 * REF.fishW, 0.15), 'D5 worm ~ 0.3x fish (' + (wm ? Math.max(wm[0], wm[1]) : '-') + ' px vs ' + (0.3 * REF.fishW).toFixed(1) + ')');
    const bs = ['small', 'default', 'large'].map(c => L(c, 'bubble'));
    report(bs.every(v => v && Math.max(v[0], v[1]) >= 5 && Math.max(v[0], v[1]) <= 15), 'D6 bubbles 6-14 px (observed span ' + bs.map(v => v ? Math.max(v[0], v[1]) : '-').join('/') + ' incl. neighbours)');
    const fs_ = [L('small', 'fish'), L('default', 'fish'), L('large', 'fish')];
    report(fs_.every(Boolean) && fs_[0][0] >= fs_[1][0] * 0.78 && fs_[2][0] <= fs_[1][0] * 1.22, 'D7 fish size variation within +-20 % (' + fs_.map(v => v && v[0]).join('/') + ')');
}

// ── D: backdrop heights (rendered, no creatures) ─────────────
// Scenery = pixels that differ from the water colour of their row AND are connected to the bottom edge
// (so faint light shafts and the surface are not counted).
function backdrop(img) {
    if (!img) img = load(path.join(WORK, 'calm', 'f000.png'));
    const W = img.W, H = img.H, at = (x, y) => (y * W + x) * 4;
    // water colour per row: modal colour while it varies slowly from row to row, then extrapolated linearly below
    const modal = [], share = [];
    for (let y = 0; y < H; y++) {
        const cols = {}; let best = 0, bk = 0, n = 0;
        for (let x = 0; x < W; x += 5) { const o = at(x, y), k = img.px[o] << 16 | img.px[o + 1] << 8 | img.px[o + 2]; cols[k] = (cols[k] || 0) + 1; n++; if (cols[k] > best) { best = cols[k]; bk = k; } }
        modal.push([bk >> 16, (bk >> 8) & 255, bk & 255]); share.push(best / n);
    }
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let yw = 1;
    for (let y = 1, bad = 0; y < H; y++) { if (share[y] >= 0.3 && dist(modal[y], modal[yw - 1]) <= 24) { yw = y + 1; bad = 0; } else if (++bad > 4) break; }
    const y0 = Math.max(0, yw - 80), slope = [0, 1, 2].map(k => (modal[yw - 1][k] - modal[y0][k]) / Math.max(1, yw - 1 - y0));
    const water = modal.map((m, y) => y < yw ? m : [0, 1, 2].map(k => modal[yw - 1][k] + slope[k] * (y - yw + 1)));
    const dev = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const wk = water[y]; for (let x = 0; x < W; x++) { const o = at(x, y);
        if (Math.abs(img.px[o] - wk[0]) + Math.abs(img.px[o + 1] - wk[1]) + Math.abs(img.px[o + 2] - wk[2]) > 36) dev[y * W + x] = 1; } }
    const seen = new Uint8Array(W * H), stack = [];
    for (let x = 0; x < W; x++) { const i = (H - 1) * W + x; if (dev[i]) { seen[i] = 1; stack.push(i); } }
    let tall = H;
    while (stack.length) {
        const i = stack.pop(), y = (i / W) | 0, x = i - y * W;
        if (y < tall) tall = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (dev[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    }
    let band = H;                                   // seabed band: highest row where the connected scenery covers >= 60 % of the width
    for (let y = H - 1; y >= 0; y--) { let n = 0; for (let x = 0; x < W; x++) n += seen[y * W + x]; if (n >= W * 0.6) band = y; else break; }
    const pct = v => ((H - v) / H * 100);
    console.log('D backdrop: seabed band top = ' + pct(band).toFixed(1) + ' % of height, tallest scenery connected to the floor = ' + pct(tall).toFixed(1) + ' %');
    report(pct(band) <= 9, 'D8 seabed band <= 9 %');
    report(pct(tall) <= 22, 'D9 tallest kelp/scenery <= 22 %');
}

if (what === 'calm' || what === 'all') { const f0 = calm(); backdrop(f0); }
if (what === 'motion' || what === 'all') motion();
if (what === 'sizes' || what === 'all') sizes();
console.log(fails ? fails + ' check(s) FAILED' : 'all checks passed');
process.exit(fails ? 1 : 0);
