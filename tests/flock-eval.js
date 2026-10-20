#!/usr/bin/env node
// Flocking evaluation on the real simulation (core via tests/harness.js, deterministic seeds).
// Measures how a parameter set LOOKS: schooling, spacing, splits/merges, collisions, edge use,
// speed and turning, and prints a table per preset.
//
//   node tests/flock-eval.js                    all presets (flock only: no predators, no cursor)
//   node tests/flock-eval.js --predators        default predators and counts, cursor off
//   node tests/flock-eval.js --json             machine readable
//   node tests/flock-eval.js calm lively        only these presets
//   node tests/flock-eval.js --fish 100         another school size (default 38)
//   node tests/flock-eval.js --seeds 8 --steps 6000 --warmup 1500 --w 1920 --h 1080
//
// Metrics (all averaged over sampled steps, then over seeds; 1 step = 40 ms = 1/25 s):
//   polarization   |mean heading unit vector| of all fish: 0 = everyone different, 1 = one direction
//   nnDist         mean nearest-neighbour distance (px) and in units of the separation distance
//   schools        connected groups of >= 3 fish (neighbours closer than visualRange) per sample
//   inSchools      share of fish that belong to such a group
//   schoolPol      polarization INSIDE the groups (size-weighted): how aligned a school is
//   largest        share of fish in the biggest group
//   changes/min    how often the number of groups changes (a split or a merge) per minute
//   closeRate      share of fish with a neighbour closer than 0.5 * separationDist
//   edge           share of fish within 100 px of a screen edge (uniform spread would be ~ 0.28)
//   speed          mean px/s and the 10th / 90th percentile of fish speeds
//   turn           mean heading change in degrees per second
//   jitter         share of steps where the turn direction flips AND the turn exceeds 3 degrees
//                  (smooth arcs ~ 0, noisy twitching high)
const path = require('path');
const { loadBoids, mulberry32 } = require('./harness');
const fs = require('fs');
const Presets = require('./harness').loadScript(path.join(__dirname, '..', 'contents', 'ui', 'code', 'presets.js'));

// main.xml defaults of the flocking keys
function xmlDefaults() {
    const xml = fs.readFileSync(path.join(__dirname, '..', 'contents', 'config', 'main.xml'), 'utf8');
    const d = {};
    for (const k of Presets.KEYS) d[k] = Number(new RegExp('<entry name="' + k + '"[^>]*>[\\s\\S]*?<default>([^<]*)</default>').exec(xml)[1]);
    return d;
}
function presets() {
    const out = {}, def = xmlDefaults();
    for (const id of Presets.IDS) {
        const v = Presets.VALUES[id], o = {};
        Presets.KEYS.forEach((k, i) => { o[k] = v ? v[i] : def[k]; });
        out[id] = o;
    }
    return out;
}

const STEPS_PER_SEC = 25;

function evaluate(flock, opts) {
    opts = Object.assign({ seeds: 6, steps: 6000, warmup: 1500, w: 1920, h: 1080, sample: 10, predators: false }, opts || {});
    const acc = {};
    const add = (k, v) => { (acc[k] = acc[k] || []).push(v); };
    for (let seed = 1; seed <= opts.seeds; seed++) {
        const B = loadBoids({ random: mulberry32(seed * 7919) });
        const cfg = Object.assign({ cursorFearLevel: 0 }, opts.predators ? {} : { anglerCount: 0, orcaCount: 0, jellyCount: 0 }, flock, opts.extra || {});
        const sim = B.createSimulation(opts.w, opts.h, 1, cfg);
        const vr = Number(cfg.visualRange), sd = Number(cfg.separationDist);
        let lastGroups = -1, changes = 0, sampled = 0;
        const S = { spol: 0, pol: 0, nn: 0, nnRel: 0, groups: 0, inSchools: 0, largest: 0, close: 0, edge: 0, turn: 0, jit: 0, jitN: 0, turnN: 0 };
        const speeds = [];
        let prevHead = null, prevTurn = null;
        for (let t = 0; t < opts.warmup + opts.steps; t++) {
            B.step(sim, 1, cfg);
            const fish = sim.entities.fish;
            const n = fish.length;
            // heading change statistics every step (fish indices are stable apart from births)
            if (t >= opts.warmup) {
                const head = fish.map(f => Math.atan2(f.vy, f.vx));
                if (prevHead && prevHead.length === head.length) {
                    const turn = head.map((h, i) => { let d = h - prevHead[i]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; });
                    for (let i = 0; i < n; i++) {
                        S.turn += Math.abs(turn[i]); S.turnN++;
                        if (prevTurn && prevTurn.length === n && Math.abs(turn[i]) > 0.052 && Math.abs(prevTurn[i]) > 0.052) {
                            S.jitN++;
                            if (turn[i] * prevTurn[i] < 0) S.jit++;
                        }
                    }
                    prevTurn = turn;
                }
                prevHead = head;
            }
            if (t < opts.warmup || (t - opts.warmup) % opts.sample) continue;
            sampled++;
            let sx = 0, sy = 0, closeFish = 0, edge = 0, nnSum = 0;
            const parent = fish.map((_, i) => i);
            const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
            for (let i = 0; i < n; i++) {
                const a = fish[i], sp = Math.hypot(a.vx, a.vy);
                if (sp > 0) { sx += a.vx / sp; sy += a.vy / sp; }
                speeds.push(sp * STEPS_PER_SEC);
                if (a.x < 100 || a.x > opts.w - 100 || a.y < 100 || a.y > opts.h - 100) edge++;
                let nn = 1e9;
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const d = Math.hypot(a.x - fish[j].x, a.y - fish[j].y);
                    if (d < nn) nn = d;
                    if (j > i && d < vr) parent[find(i)] = find(j);
                }
                nnSum += nn;
                if (nn < 0.5 * sd) closeFish++;
            }
            const sizes = {}, gx = {}, gy = {};
            for (let i = 0; i < n; i++) {
                const r = find(i), sp = Math.hypot(fish[i].vx, fish[i].vy);
                sizes[r] = (sizes[r] || 0) + 1;
                if (sp > 0) { gx[r] = (gx[r] || 0) + fish[i].vx / sp; gy[r] = (gy[r] || 0) + fish[i].vy / sp; }
            }
            let sp3 = 0, sn3 = 0;
            for (const r in sizes) if (sizes[r] >= 3) { sp3 += Math.hypot(gx[r] || 0, gy[r] || 0); sn3 += sizes[r]; }
            S.spol += sn3 ? sp3 / sn3 : 0;
            const big = Object.values(sizes).filter(s => s >= 3);
            S.pol += Math.hypot(sx, sy) / n;
            S.nn += nnSum / n; S.nnRel += nnSum / n / sd;
            S.groups += big.length;
            S.inSchools += big.reduce((a, b) => a + b, 0) / n;
            S.largest += (big.length ? Math.max.apply(null, big) : 0) / n;
            S.close += closeFish / n;
            S.edge += edge / n;
            if (lastGroups >= 0 && big.length !== lastGroups) changes++;
            lastGroups = big.length;
        }
        speeds.sort((a, b) => a - b);
        const q = p => speeds[Math.min(speeds.length - 1, Math.floor(p * speeds.length))];
        const minutes = (opts.steps / STEPS_PER_SEC) / 60;
        add('polarization', S.pol / sampled); add('schoolPol', S.spol / sampled);
        add('nnDist', S.nn / sampled); add('nnRel', S.nnRel / sampled);
        add('schools', S.groups / sampled); add('inSchools', S.inSchools / sampled); add('largest', S.largest / sampled);
        add('changesMin', changes / minutes);
        add('closeRate', S.close / sampled);
        add('edge', S.edge / sampled);
        add('speed', speeds.reduce((a, b) => a + b, 0) / speeds.length);
        add('speedP10', q(0.1)); add('speedP90', q(0.9));
        add('turnDegS', (S.turn / S.turnN) * 180 / Math.PI * STEPS_PER_SEC);
        add('jitter', S.jitN ? S.jit / S.jitN : 0);
    }
    const out = {};
    for (const k in acc) out[k] = acc[k].reduce((a, b) => a + b, 0) / acc[k].length;
    return out;
}

function fmt(m) {
    const f = (v, d) => v.toFixed(d);
    return {
        polar: f(m.polarization, 2), 'schPol': f(m.schoolPol, 2), 'nn px': f(m.nnDist, 0), 'nn/sep': f(m.nnRel, 1), schools: f(m.schools, 1),
        inSch: f(m.inSchools * 100, 0) + '%', largest: f(m.largest * 100, 0) + '%', 'chg/min': f(m.changesMin, 1),
        close: f(m.closeRate * 100, 1) + '%', edge: f(m.edge * 100, 0) + '%',
        'px/s': f(m.speed, 0), 'p10': f(m.speedP10, 0), 'p90': f(m.speedP90, 0), 'turn°/s': f(m.turnDegS, 0), jitter: f(m.jitter * 100, 0) + '%'
    };
}

function table(rows) {
    const names = Object.keys(rows);
    const cols = ['preset'].concat(Object.keys(rows[names[0]]));
    const data = names.map(n => [n].concat(Object.values(rows[n])));
    const w = cols.map((c, i) => Math.max(c.length, ...data.map(r => String(r[i]).length)));
    const line = r => r.map((c, i) => String(c).padEnd(w[i])).join('  ');
    return [line(cols)].concat(data.map(line)).join('\n');
}

if (require.main === module) {
    const args = process.argv.slice(2), opts = {}, names = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--json') opts.json = true;
        else if (a === '--predators') opts.predators = true;
        else if (a === '--fish') opts.extra = { fishCount: Number(args[++i]) };
        else if (/^--(seeds|steps|warmup|w|h|sample)$/.test(a)) opts[a.slice(2)] = Number(args[++i]);
        else names.push(a);
    }
    const all = presets();
    const pick = names.length ? names : Object.keys(all);
    const rows = {}, raw = {};
    for (const n of pick) {
        if (!all[n]) { console.error('unknown preset ' + n + ' (known: ' + Object.keys(all).join(', ') + ')'); process.exit(2); }
        raw[n] = evaluate(all[n], opts);
        rows[n] = fmt(raw[n]);
    }
    console.log(opts.json ? JSON.stringify(raw, null, 1) : table(rows));
}

module.exports = { evaluate, fmt, table, presets };
