#!/usr/bin/env node
// Overlap + jitter evaluation on the real simulation (core via tests/harness.js, seeded RNG).
//
//   node tests/overlap-eval.js                         presets x fish 38/100/200 x 2 screens x 6 seeds
//   node tests/overlap-eval.js --predators             with default predators (cursor stays off)
//   node tests/overlap-eval.js --fish 38,200 --seeds 3 --steps 3000 --warmup 1000
//   node tests/overlap-eval.js --screens 1920x1080     only these screens (comma list)
//   node tests/overlap-eval.js --json calm default
//   node tests/overlap-eval.js --bodyscale 1.5        wider fish (sim.bodyScale; overlap is measured with the scaled body)
//   node tests/overlap-eval.js --stress                300 fish on 1366x768 (vibration / clumping / edge pinning)
//
// Body width = 7 * (fishSize + sizeVariation) px (the classic sprite). Two fish OVERLAP when their
// centre distance is below 0.8 * the mean body width of the pair.
//   pairs%     overlapping pairs / all pairs               (all-pairs fraction, depends on density)
//   nbrPairs%  overlapping pairs / pairs closer than 2 body widths ("how many close encounters are collisions")
//   fish%      share of fish with at least one overlapping neighbour
//   depth      mean penetration of overlapping pairs, 0 = touching at the threshold, 1 = same centre
// Jitter (heading of each fish, every step, 1 step = 1/25 s):
//   mean/p95   mean and 95th percentile of |heading change| in degrees per step
//   rev/min    heading reversals per fish per minute (signed change flips sign, both |changes| > 2 deg)
//   hf         variance of the second difference of the heading (deg^2): high-frequency energy
//   turn       mean heading change in deg/s (same as flock-eval)
//   straight   share of fish-windows of 2 s (50 steps) whose net heading change is below 15 degrees (1 = everyone flies straight)
//   close.*    the same four numbers for fish within 1.2 body widths of another fish
//   free.*     ... and for the others
// Stress extras: clump (share of fish with >= 6 neighbours within half a body width), pinned (fish within 12 px
// of a screen edge for more than 90 % of the sampled steps), vib (mean per-step position change of fish that
// moved less than 0.15 px/step net over 25 steps: standing still and shaking).
const path = require('path');
const { loadBoids, mulberry32 } = require('./harness');
const { presets } = require('./flock-eval');

const STEPS_PER_SEC = 25;
const BODY_PX = 7;   // times opts.bodyScale (the theme's fish width / 28)
const RAD2DEG = 180 / Math.PI;
const wrap = d => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

function newJ() { return { sum: 0, n: 0, abs: [], rev: 0, revN: 0, hf: 0, hfN: 0 }; }

function evaluateRun(flock, o) {
    const B = loadBoids({ random: mulberry32(o.seed * 7919) });
    const cfg = Object.assign({ cursorFearLevel: 0 }, o.predators ? {} : { anglerCount: 0, orcaCount: 0, jellyCount: 0 }, flock, { fishCount: o.fish });
    const sim = B.createSimulation(o.w, o.h, 1, cfg);
    const fs = Number(cfg.fishSize !== undefined ? cfg.fishSize : 4);
    const bs = o.bodyScale || 1;
    const BP = BODY_PX * bs;
    const prev = new Map();            // fish -> { h, d }  (last heading, last signed change)
    const close = newJ(), free = newJ(), all = newJ();
    let strN = 0, strOk = 0;
    let pairsAll = 0, pairsNear = 0, pairsOv = 0, depthSum = 0, fishOv = 0, fishN = 0, samples = 0, clump = 0;
    let pinnedCount = null, pinnedSteps = 0;
    const pos0 = new Map(); let vibSum = 0, vibN = 0;
    for (let t = 0; t < o.warmup + o.steps; t++) {
        sim.bodyScale = bs;
        B.step(sim, 1, cfg);
        const fish = sim.entities.fish, n = fish.length;
        const measure = t >= o.warmup;
        // nearest neighbour in body widths (for the close / free split) every step: O(n^2) but n <= 300
        const nnw = new Array(n);
        if (measure) {
            for (let i = 0; i < n; i++) {
                const a = fish[i], wa = BP * Math.max(0.5, fs + a.sizeVariation);
                let best = 1e9;
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const b = fish[j], wb = BP * Math.max(0.5, fs + b.sizeVariation);
                    const d = Math.hypot(a.x - b.x, a.y - b.y) / (0.5 * (wa + wb));
                    if (d < best) best = d;
                }
                nnw[i] = best;
            }
        }
        for (let i = 0; i < n; i++) {
            const f = fish[i];
            if (f.isBaby && f.birthAnim < 60) { prev.delete(f); continue; }
            const h = Math.atan2(f.vy, f.vx), p = prev.get(f);
            if (measure && p) {
                const d = wrap(h - p.h) * RAD2DEG;
                const bucket = nnw[i] < 1.2 ? close : free;
                for (const J of [all, bucket]) {
                    J.sum += Math.abs(d); J.n++; J.abs.push(Math.abs(d));
                    if (p.d !== null) {
                        if (Math.abs(d) > 2 && Math.abs(p.d) > 2) { J.revN++; if (d * p.d < 0) J.rev++; }
                        J.hf += (d - p.d) * (d - p.d); J.hfN++;
                    }
                }
                p.d = d;
            }
            if (p) {
                p.h = h; p.hist.push(h);
                if (p.hist.length > 51) {
                    p.hist.shift();
                    if (measure) { strN++; if (Math.abs(wrap(h - p.hist[0])) * RAD2DEG < 15) strOk++; }
                }
            } else prev.set(f, { h: h, d: null, hist: [h] });
        }
        if (!measure) continue;
        if (o.stress) {
            if (pinnedCount === null) pinnedCount = new Map();
            pinnedSteps++;
            for (const f of fish) if (f.x < 12 || f.x > o.w - 12 || f.y < 12 || f.y > o.h - 12) pinnedCount.set(f, (pinnedCount.get(f) || 0) + 1);
            if ((t - o.warmup) % 25 === 0) pos0.set(t, fish.map(f => [f, f.x, f.y]));
            const t0 = t - 25;
            if (pos0.has(t0)) {
                for (const [f, x0, y0] of pos0.get(t0)) {
                    if (Math.hypot(f.x - x0, f.y - y0) < 0.15 * 25) vibSum += Math.hypot(f.vx, f.vy), vibN++;
                }
                pos0.delete(t0);
            }
        }
        if ((t - o.warmup) % o.sample) continue;
        samples++;
        const hit = new Array(n).fill(false);
        for (let i = 0; i < n; i++) {
            const a = fish[i], wa = BP * Math.max(0.5, fs + a.sizeVariation);
            let half = 0;
            for (let j = i + 1; j < n; j++) {
                const b = fish[j], wb = BP * Math.max(0.5, fs + b.sizeVariation), wm = 0.5 * (wa + wb);
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                pairsAll++;
                if (d < 2 * wm) pairsNear++;
                if (d < 0.8 * wm) { pairsOv++; depthSum += 1 - d / (0.8 * wm); hit[i] = hit[j] = true; }
            }
        }
        for (let i = 0; i < n; i++) { if (hit[i]) fishOv++; fishN++; }
        if (o.stress) {
            for (let i = 0; i < n; i++) {
                const a = fish[i], wa = BP * Math.max(0.5, fs + a.sizeVariation);
                let c = 0;
                for (let j = 0; j < n; j++) if (j !== i && Math.hypot(a.x - fish[j].x, a.y - fish[j].y) < 0.5 * wa) c++;
                if (c >= 6) clump++;
            }
        }
    }
    const summ = J => {
        const s = J.abs.slice().sort((a, b) => a - b);
        return { mean: J.n ? J.sum / J.n : 0, p95: s.length ? s[Math.floor(0.95 * (s.length - 1))] : 0,
                 rev: J.revN ? J.rev : 0, revMin: J.n ? J.rev / (J.n / STEPS_PER_SEC / 60) : 0,
                 hf: J.hfN ? J.hf / J.hfN : 0, turn: J.n ? J.sum / J.n * STEPS_PER_SEC : 0, n: J.n };
    };
    const out = {
        pairsPct: 100 * pairsOv / Math.max(1, pairsAll), nbrPairsPct: 100 * pairsOv / Math.max(1, pairsNear),
        straight: strN ? strOk / strN : 0,
        fishPct: 100 * fishOv / Math.max(1, fishN), depth: pairsOv ? depthSum / pairsOv : 0,
        all: summ(all), close: summ(close), free: summ(free)
    };
    if (o.stress) {
        let pinned = 0;
        if (pinnedCount) for (const c of pinnedCount.values()) if (c > 0.9 * pinnedSteps) pinned++;
        out.clumpPct = 100 * clump / Math.max(1, samples * sim.entities.fish.length);
        out.pinnedPct = 100 * pinned / sim.entities.fish.length;
        out.vib = vibN ? vibSum / vibN : 0;
        out.vibN = vibN;
    }
    return out;
}

// Mean over seeds of every numeric field (recursively)
function meanOf(list) {
    if (typeof list[0] === 'number') return list.reduce((a, b) => a + b, 0) / list.length;
    const o = {};
    for (const k of Object.keys(list[0])) o[k] = meanOf(list.map(x => x[k]));
    return o;
}

function evaluate(flock, opts) {
    const o = Object.assign({ seeds: 6, steps: 3000, warmup: 1000, w: 1920, h: 1080, fish: 38, sample: 5, predators: false }, opts || {});
    const runs = [];
    for (let seed = 1; seed <= o.seeds; seed++) runs.push(evaluateRun(flock, Object.assign({}, o, { seed: seed })));
    return meanOf(runs);
}

function table(rows, cols) {
    const data = rows.map(r => cols.map(c => String(r[c])));
    const w = cols.map((c, i) => Math.max(c.length, ...data.map(r => r[i].length)));
    const line = r => r.map((c, i) => c.padEnd(w[i])).join('  ');
    return [line(cols)].concat(data.map(line)).join('\n');
}

if (require.main === module) {
    const args = process.argv.slice(2), opts = {}, names = [];
    let fishList = [38, 100, 200], screens = [[1920, 1080], [1366, 768]], json = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--json') json = true;
        else if (a === '--predators') opts.predators = true;
        else if (a === '--bodyscale') opts.bodyScale = Number(args[++i]);
        else if (a === '--stress') { opts.stress = true; fishList = [300]; screens = [[1366, 768]]; }
        else if (a === '--fish') fishList = args[++i].split(',').map(Number);
        else if (a === '--screens') screens = args[++i].split(',').map(s => s.split('x').map(Number));
        else if (/^--(seeds|steps|warmup|sample)$/.test(a)) opts[a.slice(2)] = Number(args[++i]);
        else names.push(a);
    }
    const all = presets();
    const pick = names.length ? names : Object.keys(all);
    const rows = [], f = (v, d) => v.toFixed(d);
    for (const n of pick) {
        if (!all[n]) { console.error('unknown preset ' + n); process.exit(2); }
        for (const [w, h] of screens) for (const fish of fishList) {
            const m = evaluate(all[n], Object.assign({}, opts, { w: w, h: h, fish: fish }));
            const row = { preset: n, screen: w + 'x' + h, fish: fish,
                'pairs%': f(m.pairsPct, 3), 'nbrPairs%': f(m.nbrPairsPct, 2), 'fish%': f(m.fishPct, 2), depth: f(m.depth, 2),
                mean: f(m.all.mean, 2), p95: f(m.all.p95, 2), 'rev/min': f(m.all.revMin, 1), hf: f(m.all.hf, 2), 'turn/s': f(m.all.turn, 0), 'straight': f(m.straight, 2),
                'c.mean': f(m.close.mean, 2), 'c.p95': f(m.close.p95, 2), 'c.rev': f(m.close.revMin, 1), 'c.hf': f(m.close.hf, 2),
                'f.mean': f(m.free.mean, 2), 'f.p95': f(m.free.p95, 2), 'f.rev': f(m.free.revMin, 1), 'f.hf': f(m.free.hf, 2) };
            if (m.clumpPct !== undefined) Object.assign(row, { 'clump%': f(m.clumpPct, 2), 'pinned%': f(m.pinnedPct, 2), vib: f(m.vib, 3) });
            row.raw = m;
            rows.push(row);
        }
    }
    if (json) console.log(JSON.stringify(rows.map(r => ({ preset: r.preset, screen: r.screen, fish: r.fish, m: r.raw })), null, 1));
    else {
        const cols = Object.keys(rows[0]).filter(k => k !== 'raw');
        console.log(table(rows, cols.slice(0, 7).concat(['mean', 'p95', 'rev/min', 'hf', 'turn/s', 'straight'])));
        console.log('\nclose-contact (within 1.2 body widths) vs free fish:');
        console.log(table(rows, ['preset', 'screen', 'fish'].concat(cols.slice(13))));
        if (opts.stress) console.log('\n' + table(rows, ['preset', 'clump%', 'pinned%', 'vib']));
    }
}

module.exports = { evaluate, evaluateRun, BODY_PX };
