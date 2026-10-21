// Measurable calm/comfort/proportion criteria of the "onebit" theme (needs qml6; exit 77 = unavailable).
//   node tests/onebit-measure.js [A] [B] [C] [D] [S] [--out dir]
//   A  calm backdrop      no creatures, ambient running: pixels differing between frames 0.1-10 s apart,
//                         and the fastest per-pixel change rate (Hz), from 1920x1080 grabs
//   B  smooth motion      constant-velocity fish: residual of its on-screen x against a straight line
//   C  eye comfort        mean luminance and "busy" (period <= 2 texel) 24x24 px windows in day / night /
//                         crowded / stress / feeding renders
//   D  proportions        sprite sizes in screen px at 1080p, default settings (from the generated textures)
//   S  stress             inverted share, flips and trembles per second under stress 1.5
// Prints numbers; exits 1 when a criterion fails.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png');
const { loadScript } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'onebit');
const T = loadScript(path.join(DIR, 'theme.js'));
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args.splice(oi, 2)[1] : fs.mkdtempSync(path.join(os.tmpdir(), 'onebit-measure-'));
const want = args.length ? args : ['A', 'B', 'C', 'D', 'S'];
const quiet = !!process.env.QUIET;
let fail = 0;
const check = (ok, msg) => { if (!ok) fail++; if (!quiet || !ok) console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const env = Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' });

function qml(file, argv, timeout) {
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', file), '--'].concat(argv), { env, encoding: 'utf8', timeout: timeout || 120000 });
    if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
    return r.stdout + r.stderr;
}
const png32 = file => { const im = png.decode(fs.readFileSync(file)); return { W: im.W, H: im.H, px: im.px, u: new Uint32Array(im.px.buffer, im.px.byteOffset, im.W * im.H) }; };

// ── A: calm backdrop ─────────────────────────────────────────
function measureA() {
    const dir = path.join(OUT, 'calm'); fs.mkdirSync(dir, { recursive: true });
    const out = qml('onebit-measure.qml', ['calm', dir], 90000);
    const fr = out.split('\n').map(l => /FRAME (\d+) (\d+) (\S+)/.exec(l)).filter(Boolean).map(m => ({ i: +m[1], ms: +m[2], file: m[3] }));
    if (fr.length < 20) { console.log('FAIL A: only ' + fr.length + ' frames grabbed\n' + out.slice(-400)); fail++; return; }
    fr.sort((a, b) => a.i - b.i);
    const img = fr.map(f => png32(f.file)), N = img[0].W * img[0].H;
    // (1) pairs 0.1-10 s apart
    let worst = 0, wp = '';
    for (let a = 0; a < fr.length; a += 4) for (let b = a + 1; b < fr.length; b++) {
        const dt = fr[b].ms - fr[a].ms;
        if (dt < 90 || dt > 10200) continue;
        let d = 0; const x = img[a].u, y = img[b].u;
        for (let k = 0; k < N; k++) if (x[k] !== y[k]) d++;
        if (d / N > worst) { worst = d / N; wp = (dt / 1000).toFixed(1) + ' s'; }
    }
    // (2) per-pixel change rate between consecutive grabs
    const changes = new Uint16Array(N);
    for (let a = 1; a < fr.length; a++) { const x = img[a - 1].u, y = img[a].u; for (let k = 0; k < N; k++) if (x[k] !== y[k]) changes[k]++; }
    const secs = (fr[fr.length - 1].ms - fr[0].ms) / 1000;
    let maxc = 0, fast = 0;
    for (let k = 0; k < N; k++) { if (changes[k] > maxc) maxc = changes[k]; if (changes[k] / secs > 2) fast++; }
    console.log('A  frames ' + fr.length + ' over ' + secs.toFixed(1) + ' s');
    check(worst <= 0.02, 'A1 worst pair of frames 0.1-10 s apart: ' + (worst * 100).toFixed(3) + '% of pixels differ (' + wp + '), limit 2%');
    check(fast === 0, 'A2 fastest pixel: ' + (maxc / secs).toFixed(2) + ' changes/s, pixels above 2 Hz: ' + fast + ' (grabs every ~' + Math.round(secs * 1000 / (fr.length - 1)) + ' ms)');
}

// ── B: smooth motion ─────────────────────────────────────────
function measureB() {
    const out = qml('onebit-measure.qml', ['motion', OUT], 60000);
    const s = out.split('\n').map(l => /MOTION (\d+) (\S+) (\S+)/.exec(l)).filter(Boolean).map(m => ({ t: +m[1], x: +m[2] }));
    const use = s.filter(p => p.t > s[0].t + 800);                       // skip start-up
    if (use.length < 30) { console.log('FAIL B: only ' + use.length + ' samples\n' + out.slice(-400)); fail++; return; }
    const n = use.length, mt = use.reduce((a, p) => a + p.t, 0) / n, mx = use.reduce((a, p) => a + p.x, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of use) { sxy += (p.t - mt) * (p.x - mx); sxx += (p.t - mt) * (p.t - mt); }
    const slope = sxy / sxx;                                             // px per ms
    let res = 0;
    for (const p of use) res = Math.max(res, Math.abs(p.x - (mx + slope * (p.t - mt))));
    let inc = 0, steps = 0, pos = 0;
    for (let i = 1; i < n; i++) {
        const dx = use[i].x - use[i - 1].x, dt = use[i].t - use[i - 1].t;
        inc = Math.max(inc, Math.abs(dx - slope * dt));
        if (dx > 0) pos++;
        steps++;
    }
    const whole = use.every(p => Math.abs(p.x - Math.round(p.x)) < 1e-6);
    console.log('B  frames ' + n + ', speed ' + (slope * 1000).toFixed(1) + ' px/s (expected 100)');
    check(res <= 1.0, 'B1 residual of on-screen x against a straight line: max ' + res.toFixed(2) + ' px, limit 1');
    check(inc <= 1.0 + 1e-9 || false, 'B2 frame-to-frame increment minus ideal: max ' + inc.toFixed(2) + ' px, limit 1 (' + pos + '/' + steps + ' frames moved)');
    check(whole, 'B3 sprite lands on whole screen pixels: ' + whole);
}

// ── C: eye comfort ───────────────────────────────────────────
function lumaStats(im) {
    let g = 0, l = 0; const N = im.W * im.H, lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const cache = new Map();
    for (let k = 0; k < N; k++) {
        const key = im.u[k]; let v = cache.get(key);
        if (!v) { const r = im.px[k * 4], gg = im.px[k * 4 + 1], b = im.px[k * 4 + 2];
            v = [(0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255, 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b)]; cache.set(key, v); }
        g += v[0]; l += v[1];
    }
    return { gamma: g / N, linear: l / N, colours: cache.size };
}
// busy(x,y): the pixel is part of an alternation of period <= 2 texels (q px per texel): a sample q px
// away differs and the one after that differs again, along x or along y. Checker, stipple and 2-texel
// hatching make nearly every pixel busy; 1-texel lines at a pitch of 3+ texels make at most a third.
function busyWindows(im, q, win) {
    const W = im.W, H = im.H, u = im.u, busy = new Uint8Array(W * H);
    for (let y = 0; y < H - 2 * q; y++) for (let x = 0; x < W - 2 * q; x++) {
        const a = u[y * W + x], b = u[y * W + x + q], c = u[y * W + x + 2 * q], d = u[(y + q) * W + x], e = u[(y + 2 * q) * W + x];
        if ((a !== b && b !== c) || (a !== d && d !== e)) busy[y * W + x] = 1;
    }
    const S = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += busy[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    let max = 0, flagged = 0, total = 0, at = '', list = [];
    for (let y = 0; y + win <= H; y += win / 2) for (let x = 0; x + win <= W; x += win / 2) {
        const n = S[(y + win) * (W + 1) + x + win] - S[y * (W + 1) + x + win] - S[(y + win) * (W + 1) + x] + S[y * (W + 1) + x];
        const f = n / (win * win); total++;
        if (f > max) { max = f; at = x + ',' + y; }
        if (f >= 0.5) { flagged++; if (list.length < 6) list.push(x + ',' + y); }
    }
    return { max, flagged, total, at, list };
}
const SCENES = [['day', 'defaults'], ['night', 'night'], ['crowded', 'crowded'], ['stress0.9', 'stress0.9'], ['feeding', 'feeding'], ['stress1.5', 'stress1.5']];
function renderScenes() {
    const dir = path.join(OUT, 'scenes'); fs.mkdirSync(dir, { recursive: true });
    const files = {};
    for (const [name, sc] of SCENES) {
        const f = path.join(dir, name + '.png');
        try { fs.unlinkSync(f); } catch (e) {}
        qml('render.qml', ['onebit', sc, f], 240000);
        files[name] = f;
    }
    return files;
}
function measureC() {
    const files = renderScenes();
    const q = Math.max(2, Math.round(1080 / T.GRID_ROWS));
    console.log('C  1920x1080, texel = ' + q + ' px');
    for (const name in files) {
        const im = png32(files[name]), L = lumaStats(im), B = busyWindows(im, q, 24);
        check(L.gamma < 0.25 && B.flagged === 0, 'C ' + name.padEnd(9) + ' mean luma ' + (L.gamma * 100).toFixed(1) + '% (linear ' + (L.linear * 100).toFixed(1) + '%), colours ' + L.colours +
              ', busy 24x24 windows: ' + B.flagged + '/' + B.total + ' (max busy share ' + (B.max * 100).toFixed(0) + '% at ' + B.at + ')' + (B.flagged ? ' flagged at ' + B.list.join(' ') : ''));
    }
}

// ── D: proportions ───────────────────────────────────────────
function pngSize(f) { const im = png.decode(fs.readFileSync(path.join(DIR, T.DIR, f))); return { w: im.W, h: im.H }; }
function measureD() {
    const q = Math.max(2, Math.round(1080 / T.GRID_ROWS));
    const px = (f, mag) => { const s = pngSize(f); return { w: s.w * q * (mag || 1), h: s.h * q * (mag || 1) }; };
    const fishOf = size => { const c = T.fishClass(size); return px(T.fishFile(c, 'solid', 0, false), T.fishMag(size)); };
    const fish = fishOf(4);
    const lo = fishOf(3), hi = fishOf(5);
    const jc = T.jellyClass(4);
    const rows = {
        fish: fish, 'fish (size 3)': lo, 'fish (size 5)': hi,
        angler: px('angler-0.png'), orca: px('orca-0.png'), jelly: px(T.jellyFile(jc, 0)),
        worm: px(T.wormFile(1, 0)), 'bubble small': px(T.bubbleFile(1.5)), 'bubble big': px(T.bubbleFile(3))
    };
    console.log('D  screen px at 1080p, default settings (fish ' + fish.w + 'x' + fish.h + ')');
    for (const k in rows) console.log('     ' + k.padEnd(14) + rows[k].w + ' x ' + rows[k].h + '  (' + (rows[k].w / fish.w).toFixed(2) + ' x fish length)');
    const within = (v, ref) => Math.abs(v / ref - 1) <= 0.15;
    check(within(fish.w, 36) && within(fish.h, 26), 'D1 fish ' + fish.w + 'x' + fish.h + ' vs 36x26');
    check(within(rows.angler.w, 1.5 * fish.w), 'D2 angler length ' + rows.angler.w + ' vs 1.5 x fish ' + (1.5 * fish.w));
    check(within(rows.orca.w, 3 * fish.w), 'D3 orca length ' + rows.orca.w + ' vs 3 x fish ' + (3 * fish.w));
    check(within(rows.jelly.w, fish.w), 'D4 jelly bell width ' + rows.jelly.w + ' vs fish length ' + fish.w);
    check(within(rows.worm.w, 0.3 * fish.w), 'D5 worm width ' + rows.worm.w + ' vs 0.3 x fish ' + (0.3 * fish.w).toFixed(0));
    check(rows['bubble small'].w >= 6 && rows['bubble big'].w <= 14, 'D6 bubbles ' + rows['bubble small'].w + '-' + rows['bubble big'].w + ' px (6-14)');
    check(Math.abs(lo.w / fish.w - 1) <= 0.25 && Math.abs(hi.w / fish.w - 1) <= 0.25, 'D7 fish variation ' + lo.w + '..' + hi.w + ' px around ' + fish.w);
    const seabed = T.SEABED.visible !== undefined ? T.SEABED.visible : T.SEABED.rows;
    const kelp = Math.max.apply(null, T.KELP.map(k => k.rows));
    check(seabed / T.GRID_ROWS <= 0.09, 'D8 seabed ' + (seabed / T.GRID_ROWS * 100).toFixed(1) + '% of the height (limit 9%)');
    check(kelp / T.GRID_ROWS <= 0.20, 'D9 tallest kelp ' + (kelp / T.GRID_ROWS * 100).toFixed(1) + '% of the height (limit 20%)');
}

// ── S: stress ────────────────────────────────────────────────
function measureS() {
    const out = qml('onebit-measure.qml', ['stress', OUT], 60000);
    const m = /STRESS secs (\S+) maxFlipsPerSec (\S+) flippingFish (\d+) maxShakeChangesPerSec (\S+) shakingFish (\d+) invShare (\S+) fish (\d+)/.exec(out);
    if (!m) { console.log('FAIL S: no result\n' + out.slice(-400)); fail++; return; }
    console.log('S  stress 1.5, ' + m[1] + ' s, ' + m[7] + ' fish');
    check(+m[2] <= 2.0, 'S1 inverted/normal alternation: max ' + m[2] + ' per second per fish (' + m[3] + ' fish alternate), i.e. <= 1 Hz = 2 flips/s');
    check(+m[4] <= 4.0, 'S2 tremble: max ' + m[4] + ' offset changes per second per fish (limit 4)');
}

if (want.includes('A')) measureA();
if (want.includes('B')) measureB();
if (want.includes('C')) measureC();
if (want.includes('D')) measureD();
if (want.includes('S')) measureS();
console.log(fail ? fail + ' criterion check(s) failed' : 'all criteria met');
process.exit(fail ? 1 : 0);
