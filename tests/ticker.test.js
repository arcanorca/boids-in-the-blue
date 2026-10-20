// Fixed-step accumulator (contents/ui/code/ticker.js): the simulation must advance at 25 steps/s
// whatever the display rate, never burst after a gap, and stop when frames stop.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { loadScript, mulberry32 } = require('./harness');

const K = loadScript(path.join(__dirname, '..', 'contents', 'ui', 'code', 'ticker.js'));

function run(hz, seconds, jitter, seed) {
    const t = K.create(), rnd = mulberry32(seed || 1);
    let steps = 0, maxPerFrame = 0, frames = 0;
    for (let now = 0; now < seconds * 1000; ) {
        const dt = (1000 / hz) * (1 + (rnd() - 0.5) * 2 * jitter);
        now += dt; frames++;
        const n = K.advance(t, dt);
        steps += n; if (n > maxPerFrame) maxPerFrame = n;
    }
    return { steps, maxPerFrame, frames };
}

test('constants: 25 steps per second, 3 catch-up steps, 250 ms gap', () => {
    assert.strictEqual(K.STEP_MS, 40); assert.strictEqual(K.MAX_CATCHUP, 3); assert.strictEqual(K.MAX_GAP_MS, 250);
});

test('25 steps/s on 24/30/48/60/75/120/144/165/240 Hz displays (exact long-run rate)', () => {
    for (const hz of [24, 30, 48, 60, 75, 120, 144, 165, 240]) {
        const r = run(hz, 60, 0);
        assert.ok(Math.abs(r.steps - 1500) <= 1, hz + ' Hz: ' + r.steps + ' steps in 60 s');
        assert.ok(r.maxPerFrame <= 2, hz + ' Hz max steps per frame ' + r.maxPerFrame);
    }
});

test('rate holds with +-30 % frame time jitter', () => {
    for (const hz of [60, 120, 144]) {
        const r = run(hz, 60, 0.3, hz);
        assert.ok(Math.abs(r.steps - 1500) <= 2, hz + ' Hz jitter: ' + r.steps);
    }
});

test('a 60 Hz frame sequence steps every 2nd or 3rd frame, never twice in a row on 144 Hz', () => {
    const t = K.create(); const out = [];
    for (let i = 0; i < 12; i++) out.push(K.advance(t, 1000 / 144));
    assert.strictEqual(out.reduce((a, b) => a + b, 0), 2);   // 12 frames x 6.94 ms = 83 ms
});

test('catch-up is capped at 3 steps per frame and the backlog is dropped', () => {
    const t = K.create();
    assert.strictEqual(K.advance(t, 200), 3);       // 5 steps worth, 200 ms is below the gap limit
    assert.ok(t.acc < K.STEP_MS, 'leftover below one step: ' + t.acc);
    assert.strictEqual(K.advance(t, 5), 0);         // nothing replayed afterwards
    assert.strictEqual(K.advance(t, 130), 3);
});

test('long gaps (> 250 ms) give one step and discard the accumulated time', () => {
    const t = K.create();
    K.advance(t, 30);                                // 30 ms banked
    assert.strictEqual(K.advance(t, 251), 1);
    assert.strictEqual(t.acc, 0);
    assert.strictEqual(K.advance(t, 5000), 1);       // 5 s sleep: no fast-forward
    assert.strictEqual(K.advance(t, 16), 0);
    assert.strictEqual(K.advance(t, 16), 0);
    assert.strictEqual(K.advance(t, 16), 1);
    assert.strictEqual(K.advance(t, 250), 3);        // exactly at the limit is a normal frame
});

test('bad frame times produce no steps and no state damage', () => {
    const t = K.create();
    for (const d of [0, -5, NaN, Infinity, undefined, null, 'x']) assert.strictEqual(K.advance(t, d), 0, String(d));
    assert.strictEqual(t.acc, 0);
    assert.strictEqual(K.advance(t, 40), 1);
});

test('stopped frames mean stopped simulation: no frames, no steps', () => {
    const t = K.create(); let steps = 0;
    for (let i = 0; i < 60; i++) steps += K.advance(t, 16.7);
    const before = steps;
    // output off: the compositor delivers nothing for 10 minutes, then one frame arrives
    steps += K.advance(t, 600000);
    assert.strictEqual(steps - before, 1);
});
