// Flocking presets (contents/ui/code/presets.js): within the main.xml ranges, distinct, and the
// evaluation metrics keep each one's character (see tests/flock-eval.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadScript } = require('./harness');
const E = require('./flock-eval');

const P = loadScript(path.join(__dirname, '..', 'contents', 'ui', 'code', 'presets.js'));
const xml = fs.readFileSync(path.join(__dirname, '..', 'contents', 'config', 'main.xml'), 'utf8');
const range = k => { const m = new RegExp('<entry name="' + k + '"[^>]*>[\\s\\S]*?<min>([^<]*)</min>[\\s\\S]*?<max>([^<]*)</max>').exec(xml); return [Number(m[1]), Number(m[2])]; };

test('every preset value lies inside its main.xml range and min speed <= max speed', () => {
    const all = E.presets();
    for (const id of P.IDS) {
        for (const k of P.KEYS) { const [a, b] = range(k); assert.ok(all[id][k] >= a && all[id][k] <= b, id + '.' + k + ' = ' + all[id][k]); }
        assert.ok(all[id].fishMinSpeed <= all[id].fishMaxSpeed, id);
    }
});

test('presets are distinct and keep their character', () => {
    const m = {};
    for (const id of P.IDS) m[id] = E.evaluate(E.presets()[id], { seeds: 2, steps: 2500 });
    assert.ok(m.calm.speed < m.default.speed && m.default.speed < m.lively.speed, 'speed ladder');
    assert.ok(m.calm.nnDist > m.default.nnDist && m.default.nnDist > m.lively.nnDist, 'calm loosest, lively tightest');
    assert.ok(m.default.schoolPol > 0.85, 'default schools are aligned: ' + m.default.schoolPol);
    assert.ok(m.lively.turnDegS > 1.8 * m.default.turnDegS, 'lively turns more');
    assert.ok(m.chaotic.largest < m.default.largest * 0.7 && m.chaotic.changesMin > 5 * m.default.changesMin, 'chaotic is fragmented and churns');
    for (const id of P.IDS) {
        assert.ok(m[id].closeRate < 0.02, id + ' collisions ' + m[id].closeRate);
        assert.ok(m[id].jitter < 0.35, id + ' jitter ' + m[id].jitter);
        assert.ok(m[id].edge < 0.12, id + ' edge ' + m[id].edge);
    }
});
