// Measurable acceptance checks of the "gameboy" theme (eye comfort, smooth motion, proportions).
//   node tests/gameboy-measure.js [A|B|C|D|all] [outDir]      exit 77 = qml6 unavailable
// A  calm backdrop   empty sea in real time: <= 2 % of the screen differs between any two frames 0.1..10 s apart,
//                    no texel changes faster than 2 Hz
// B  smooth motion   constant-velocity fish: whole-screen-pixel positions, uniform increments (+-1 px of a straight line)
// C  eye comfort     lightest shade <= 25 % of the day screenshot, no 24x24 px stipple/checker, stress: progressive
//                    inverted share, 1 px tremble, alarm alternation <= 1 Hz
// D  proportions     art bounding boxes of every kind at default settings, seabed and kelp share of the screen
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png');
const { loadLibrary } = require('./harness');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'contents', 'themes', 'gameboy');
const which = (process.argv[2] || 'all').toUpperCase();
const outDir = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'gb-measure-'));
fs.mkdirSync(outDir, { recursive: true });
const ENV = Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' });
const SHADES = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'].map(c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)));
const shadeOf = (r, g, b) => { let best = 0, bd = 1e9; SHADES.forEach((s, i) => { const d = Math.abs(s[0] - r) + Math.abs(s[1] - g) + Math.abs(s[2] - b); if (d < bd) { bd = d; best = i; } }); return best; };

function qml(mode, arg, timeout) {
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'gb-measure.qml'), '--', mode, arg || outDir], { env: ENV, encoding: 'utf8', timeout: timeout || 120000 });
    if (r.error) { console.error('qml6 not available: ' + r.error.message); process.exit(77); }
    const out = (r.stdout + r.stderr).split('\n').map(l => l.replace(/^qml: /, ''));
    const bad = out.filter(l => /warn|error|TypeError|ReferenceError|Cannot|\[boids\]/i.test(l) && !/^(MOT|SIZE|STRESS)/.test(l));
    return { lines: out, warnings: bad };
}
function ppm(file) {
    const b = fs.readFileSync(file);
    const m = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(b.toString('latin1', 0, 30));
    return { W: +m[1], H: +m[2], px: b.subarray(m[0].length) };
}
// texel-centre sample of a screenshot -> Uint8Array of shade indices (virtual screen)
function texels(im, unit) {
    const w = Math.floor(im.W / unit), h = Math.floor(im.H / unit), out = new Uint8Array(w * h), c = unit >> 1;
    const rgba = im.px.length === im.W * im.H * 4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = ((y * unit + c) * im.W + x * unit + c) * (rgba ? 4 : 3);
        out[y * w + x] = shadeOf(im.px[o], im.px[o + 1], im.px[o + 2]);
    }
    return { w, h, t: out };
}
let fail = 0;
const results = [];
function check(ok, msg) { if (!ok) fail++; results.push((ok ? 'ok   ' : 'FAIL ') + msg); console.log(results[results.length - 1]); }

const UNIT = 3;   // 1080p

// ── A: calm backdrop ──
function measureA() {
    const dir = path.join(outDir, 'backdrop');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const r = qml('backdrop', dir, 60000);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ppm')).sort();
    if (files.length < 30) { check(false, 'A backdrop frames captured (' + files.length + ')'); return; }
    const frames = files.map(f => { const tx = texels(ppm(path.join(dir, f)), UNIT); return { ms: +/-(\d+)\.ppm/.exec(f)[1], w: tx.w, h: tx.h, t: tx.t }; });
    const N = frames[0].t.length;
    let worst = 0, worstPair = '';
    for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
        const dt = frames[j].ms - frames[i].ms;
        if (dt < 90 || dt > 10200) continue;
        let d = 0; const a = frames[i].t, b = frames[j].t;
        for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) d++;
        if (d / a.length > worst) { worst = d / a.length; worstPair = i + '-' + j + ' dt=' + dt + 'ms'; }
    }
    check(worst <= 0.02, 'A1 max screen share that differs between two frames 0.1-10 s apart: ' + (worst * 100).toFixed(2) + ' % (limit 2 %, ' + worstPair + ')');
    // frequency: the 100 ms cadence segment (first 31 frames)
    const seg = frames.filter(f => f.ms <= frames[0].ms + 3050);
    const T = (seg[seg.length - 1].ms - seg[0].ms) / 1000;
    let maxHz = 0, fast = 0;
    for (let k = 0; k < N; k++) {
        let tr = 0; for (let i = 1; i < seg.length; i++) if (seg[i].t[k] !== seg[i - 1].t[k]) tr++;
        const hz = tr / (2 * T); if (hz > maxHz) maxHz = hz; if (hz > 2) fast++;
    }
    check(maxHz <= 2, 'A2 fastest texel: ' + maxHz.toFixed(2) + ' Hz (limit 2 Hz; ' + fast + ' texels above)');
    // scene-wide update cadence: how many 100 ms steps contain any change
    let steps = 0, changed = 0;
    for (let i = 1; i < seg.length; i++) { steps++; let any = false; for (let k = 0; k < N; k++) if (seg[i].t[k] !== seg[i - 1].t[k]) { any = true; break; } if (any) changed++; }
    console.log('     (info) 100 ms steps with any change: ' + changed + '/' + steps);
    // shade usage of the empty sea
    const last = frames[frames.length - 1], cnt = [0, 0, 0, 0];
    for (const v of last.t) cnt[v]++;
    console.log('     (info) empty sea shade shares: ' + cnt.map(c => (100 * c / N).toFixed(1) + '%').join(' '));
    // stipple on the empty sea
    const st = stipple(last);
    check(st.worst < 0.20, 'A3 densest 24x24 px window of the empty sea: ' + (st.worst * 100).toFixed(0) + ' % isolated texels (limit 20 %)');
    if (r.warnings.length) check(false, 'A warnings: ' + r.warnings[0]);
}

// share of texels whose four neighbours all differ in an 8x8-texel (24x24 px) window (checker/stipple), worst window
function stipple(tx) {
    const { w, h, t } = tx, iso = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const v = t[y * w + x];
        iso[y * w + x] = (t[y * w + x - 1] !== v && t[y * w + x + 1] !== v && t[(y - 1) * w + x] !== v && t[(y + 1) * w + x] !== v) ? 1 : 0;
    }
    // integral image
    const I = new Int32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += iso[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    let worst = 0, at = '';
    for (let y = 0; y + 8 <= h; y += 2) for (let x = 0; x + 8 <= w; x += 2) {
        const s = I[(y + 8) * (w + 1) + x + 8] - I[y * (w + 1) + x + 8] - I[(y + 8) * (w + 1) + x] + I[y * (w + 1) + x];
        if (s / 64 > worst) { worst = s / 64; at = x + ',' + y; }
    }
    return { worst, at };
}

// ── B: smooth motion ──
function measureB() {
    const r = qml('motion', '-', 60000);
    const by = {};
    for (const l of r.lines) { const m = /^MOT (\d) (\S+) (\S+) (\S+)/.exec(l); if (m) (by[m[1]] = by[m[1]] || []).push({ t: +m[2], x: +m[3], y: +m[4] }); }
    const spec = { 0: 3 * 25, 1: -1.2 * 25, 2: 0.5 * 25 };   // px per second (1080p sim px = screen px)
    for (const id of Object.keys(by)) {
        const s = by[id].filter(p => p.t > 900 && p.t < 4300);
        if (s.length < 60) { check(false, 'B fish ' + id + ': only ' + s.length + ' samples'); continue; }
        // least-squares line
        const n = s.length, mt = s.reduce((a, p) => a + p.t, 0) / n, mx = s.reduce((a, p) => a + p.x, 0) / n;
        let sxy = 0, sxx = 0; for (const p of s) { sxy += (p.t - mt) * (p.x - mx); sxx += (p.t - mt) * (p.t - mt); }
        const b = sxy / sxx, a = mx - b * mt;
        let resid = 0, nonInt = 0, maxInc = 0;
        for (const p of s) { resid = Math.max(resid, Math.abs(p.x - (a + b * p.t))); if (!Number.isInteger(p.x)) nonInt++; }
        for (let i = 1; i < s.length; i++) maxInc = Math.max(maxInc, Math.abs((s[i].x - s[i - 1].x) - b * (s[i].t - s[i - 1].t)));
        check(Math.abs(b * 1000 - spec[id]) <= 0.05 * Math.abs(spec[id]), 'B fish ' + id + ' speed ' + (b * 1000).toFixed(1) + ' px/s (sim ' + spec[id] + ')');
        check(resid <= 1.0 && nonInt === 0 && maxInc <= 1.5, 'B fish ' + id + ': max deviation from a straight line ' + resid.toFixed(2) + ' px (limit 1), max increment error ' + maxInc.toFixed(2) + ' px (limit 1.5), non-integer x: ' + nonInt);
    }
    if (r.warnings.length) check(false, 'B warnings: ' + r.warnings[0]);
}

// ── C: eye comfort ──
function renderDay(scene, file) {
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'render.qml'), '--', 'gameboy', scene, file], { env: ENV, encoding: 'utf8', timeout: 240000 });
    if (r.error) { console.error('qml6 not available'); process.exit(77); }
    return png.decode(fs.readFileSync(file));
}
function measureC() {
    const day = renderDay('defaults', path.join(outDir, 'day.png'));
    const tx = texels(day, UNIT), N = tx.w * tx.h, cnt = [0, 0, 0, 0];
    for (const v of tx.t) cnt[v]++;
    check(cnt[3] / N <= 0.25, 'C1 lightest shade on the day screenshot: ' + (100 * cnt[3] / N).toFixed(1) + ' % (limit 25 %); shares ' + cnt.map(c => (100 * c / N).toFixed(1)).join('/ '));
    const st = stipple(tx);
    check(st.worst < 0.20, 'C2 densest 24x24 px stipple window (day screenshot): ' + (st.worst * 100).toFixed(0) + ' % isolated texels at ' + st.at + ' (limit 20 %)');
    const r = qml('stress', '-', 60000);
    const lv = {}, fr = {};
    for (const l of r.lines) {
        let m = /^STRESS (\S+) (\d+) (\d+) (\d+)/.exec(l); if (m) (lv[m[1]] = lv[m[1]] || []).push(+m[3] / +m[4]);
        m = /^STRESSF (\S+) (\d+) (\d+) (\d+) (\S+) (\S+)/.exec(l); if (m) ((fr[m[1]] = fr[m[1]] || {})[m[2]] = fr[m[1]][m[2]] || []).push({ k: +m[3], pal: +m[4], x: +m[5], y: +m[6] });
    }
    const shares = Object.keys(lv).filter(k => +k < 1.2).sort((a, b) => a - b).map(k => lv[k].reduce((a, b) => a + b, 0) / lv[k].length);
    check(shares.every((v, i) => i === 0 || v >= shares[i - 1]) && shares[0] < 0.2 && shares[shares.length - 1] > 0.5 && shares[shares.length - 1] < 1, 'C3 inverted share is progressive below 1.2: ' + shares.map(v => (v * 100).toFixed(0) + '%').join(' < '));
    // tremble amplitude (below the alarm level), measured on the inverted fish
    let amp = 0;
    for (const k of Object.keys(fr).filter(k => +k < 1.2 && +k >= 0.7)) for (const id of Object.keys(fr[k])) {
        const s = fr[k][id]; if (!s.some(p => p.pal === 2)) continue;
        const xs = s.map(p => p.x), ys = s.map(p => p.y);
        amp = Math.max(amp, (Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...ys) - Math.min(...ys)) / 2);
    }
    check(amp <= 1.0 && amp > 0, 'C4 tremble amplitude of stressed fish: +-' + amp.toFixed(1) + ' screen px (limit 1)');
    // alarm (1.5): per fish minimum time between palette swaps, and the whole-school share over time
    let minHold = 1e9, shareMin = 1, shareMax = 0;
    for (const id of Object.keys(fr['1.5'])) {
        const s = fr['1.5'][id]; let last = s[0].pal, since = 0;
        for (let i = 1; i < s.length; i++) if (s[i].pal !== last) { if (since > 0 || true) minHold = Math.min(minHold, (s[i].k - since) * 40); last = s[i].pal; since = s[i].k; }
    }
    for (const v of lv['1.5']) { shareMin = Math.min(shareMin, v); shareMax = Math.max(shareMax, v); }
    check(minHold >= 500, 'C5 alarm: a fish holds one palette for >= ' + (minHold === 1e9 ? 'inf' : minHold) + ' ms (alternation <= 1 Hz needs >= 500 ms); school share ' + (shareMin * 100).toFixed(0) + '-' + (shareMax * 100).toFixed(0) + ' %');
    if (r.warnings.length) check(false, 'C warnings: ' + r.warnings[0]);
}

// ── D: proportions ──
function measureD() {
    const A = loadLibrary(path.join(DIR, 'atlas.js')), T = loadLibrary(path.join(DIR, 'theme.js'));
    const im = png.decode(fs.readFileSync(path.join(DIR, 'img', T.OBJ_FILES[0])));
    const bbox = key => {
        const [x, y, w, h] = A.OBJ[key]; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (im.px[((y + j) * im.W + x + i) * 4 + 3]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
        return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    const r = qml('sizes', '-', 60000);
    const got = {};
    for (const l of r.lines) { const m = /^SIZE (\w+) (\S+) (\S+) (\S+) (\S+) (\S+)/.exec(l); if (m && !got[m[1]]) got[m[1]] = { key: m[2], sw: +m[3], sh: +m[4], rw: +m[5], rh: +m[6] }; }
    const px = {};
    for (const k of ['fish', 'angler', 'orca', 'jelly', 'worm', 'bubble']) {
        const g = got[k]; if (!g || g.key === 'none') { check(false, 'D ' + k + ' sprite missing'); continue; }
        const b = bbox(g.key), s = g.sw / g.rw;
        px[k] = { w: b.w * s, h: b.h * s, key: g.key, scale: s };
        console.log('     (info) ' + k + ' ' + g.key + ': art ' + b.w + 'x' + b.h + ' texels = ' + (b.w * s) + 'x' + (b.h * s) + ' px (texel ' + s + ' px)');
    }
    const near = (v, want, tol, msg) => check(Math.abs(v - want) <= want * tol, msg + ': ' + v.toFixed(0) + ' px vs ' + want.toFixed(0) + ' +-' + (tol * 100) + '%');
    if (px.fish) {
        near(px.fish.w, 36, 0.15, 'D1 fish length'); near(px.fish.h, 26, 0.15, 'D1 fish height');
        if (px.angler) near(px.angler.w, 1.5 * px.fish.w, 0.15, 'D2 angler length (1.5 x fish)');
        if (px.orca) { near(px.orca.w, 3 * px.fish.w, 0.15, 'D3 orca length (3 x fish)'); }
        if (px.jelly) near(px.jelly.w, px.fish.w, 0.15, 'D4 jelly bell width (= fish length)');
        if (px.worm) near(Math.max(px.worm.w, px.worm.h), 0.3 * px.fish.w, 0.2, 'D5 worm length (0.3 x fish)');
    }
    // one texel scale for every kind
    const scales = new Set(Object.values(px).map(p => p.scale));
    check(scales.size === 1, 'D6 one texel scale for all sprites: ' + [...scales].join(','));
    // bubbles 6..14 px over every size class
    let bmin = 1e9, bmax = 0;
    if (px.bubble) for (const k of Object.keys(A.OBJ).filter(k => /^bub-/.test(k))) { const b = bbox(k), s = px.bubble.scale; bmin = Math.min(bmin, Math.min(b.w, b.h) * s); bmax = Math.max(bmax, Math.max(b.w, b.h) * s); }
    check(bmin >= 6 && bmax <= 14, 'D7 bubble sizes ' + bmin + '..' + bmax + ' px (6..14)');
    // background geometry (declared by theme.js GEOM, in virtual rows of the 360-row screen)
    const G = T.GEOM || { seabedRows: 32, kelpRows: 88, note: 'old theme: 4 sand tile rows, 11-tile kelp' };
    check(G.seabedRows / T.SCREEN_ROWS <= 0.09, 'D8 seabed band ' + (100 * G.seabedRows / T.SCREEN_ROWS).toFixed(1) + ' % of the screen height (limit 9 %)');
    check(G.kelpRows / T.SCREEN_ROWS <= 0.18, 'D9 tallest kelp ' + (100 * G.kelpRows / T.SCREEN_ROWS).toFixed(1) + ' % of the screen height (limit 18 %)');
    if (r.warnings.length) check(false, 'D warnings: ' + r.warnings[0]);
}

const run = { A: measureA, B: measureB, C: measureC, D: measureD };
for (const k of which === 'ALL' ? ['A', 'B', 'C', 'D'] : which.split('')) { console.log('── ' + k); run[k](); }
console.log(fail ? fail + ' check(s) failed' : 'all checks passed');
process.exit(fail ? 1 : 0);
