.pragma library

// Fixed-step accumulator: turns the irregular frame times of a render-driven loop into whole
// simulation steps, so the simulation advances at 1000 / STEP_MS (25) steps per second on any
// display (30 / 60 / 120 / 144 Hz ...) and stops by itself when frames stop.
//
//   var t = Ticker.create();
//   var n = Ticker.advance(t, frameTimeMs);   // how many simulation steps to run for this frame
//
// - Time is carried over between frames (no drift: long-run rate is exact).
// - At most MAX_CATCHUP steps per frame; a bigger backlog is dropped, not replayed.
// - A gap above MAX_GAP_MS (suspend, lid, DPMS, covered window) drops the accumulated time and
//   gives exactly one step, so nothing jumps or fast-forwards after the resume.

var STEP_MS = 40;
var MAX_CATCHUP = 3;
var MAX_GAP_MS = 250;

function create() { return { acc: 0 }; }

function reset(t) { t.acc = 0; }

function advance(t, dtMs) {
    if (!(dtMs > 0) || !isFinite(dtMs)) return 0;          // 0, negative, NaN: no time passed
    if (dtMs > MAX_GAP_MS) { t.acc = 0; return 1; }
    t.acc += dtMs;
    var n = Math.floor(t.acc / STEP_MS);
    if (n <= 0) return 0;
    t.acc -= n * STEP_MS;
    if (n > MAX_CATCHUP) n = MAX_CATCHUP;                   // drop the rest of the backlog
    return n;
}
