.pragma library
// Golden-test scenarios. Plain ES5 so the same file runs in Node (via the vm
// harness) and in the QML engine (tests/qml/golden.qml).
// B = the KDE adapter API; mock = {createObject(parent, props)} with counters.

function hashStr(s) {
    var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0xabcdef;
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        h1 ^= c; h1 = (h1 * 16777619) >>> 0;
        h2 = (h2 * 33 + c) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}

var ENT_KEYS = ['kind', 'x', 'y', 'vx', 'vy', 'facingRight', 'dead', 'color', 'isBaby',
                'sizeVariation', 'personality', 'birthAnim', 'life', 'scale', 'wiggle', 'wobble',
                'angle', 'chasing', 'wanderTheta', 'speed', 'direction'];
var DG_KEYS = ['x', 'y', 'size', 'type', 'flip', 'colorString', 'shakeX', 'shakeY', 'opacity', 'rotation'];

function serialize(sim, mock) {
    var out = [sim.width, sim.height, sim.totalWormsEaten, sim.bornExtra, mock.created, mock.destroyed, mock.live.size];
    var lists = sim.allLists;
    for (var l = 0; l < lists.length; l++) {
        out.push('#' + lists[l].length);
        for (var i = 0; i < lists[l].length; i++) {
            var e = lists[l][i], row = [];
            for (var k = 0; k < ENT_KEYS.length; k++) row.push(e[ENT_KEYS[k]]);
            var d = e.delegate;
            if (d) for (var j = 0; j < DG_KEYS.length; j++) row.push(d[DG_KEYS[j]]);
            else row.push('nodel');
            out.push(row.join(','));
        }
    }
    return out.join('\n');
}

function summary(sim, mock) {
    var f = sim.entities.fish[0];
    return { fish: sim.entities.fish.length, anglers: sim.entities.anglers.length, orcas: sim.entities.orcas.length,
             jellies: sim.entities.jellies.length, worms: sim.entities.worms.length, bubbles: sim.entities.bubbles.length,
             eaten: sim.totalWormsEaten, born: sim.bornExtra, live: mock.live.size,
             f0: f ? [f.x, f.y] : null };
}

function _mouse(sim, x, y) { sim.mouse.x = x; sim.mouse.y = y; }

// Each scenario: w,h,cfg, steps, actions: {step: fn(sim,cfg,B)} applied before that step's update
var SCENARIOS = [];
function add(name, w, h, cfg, steps, actions) {
    SCENARIOS.push({ name: name, w: w, h: h, cfg: cfg, steps: steps, actions: actions || {} });
}

add('defaults', 1920, 1080, {}, 1500);
add('crowded', 1920, 1080, { fishCount: 200, anglerCount: 8, orcaCount: 8, jellyCount: 12 }, 1500);
for (var lvl = 0; lvl <= 4; lvl++) (function (lvl) {
    var acts = {};
    var pts = [[960, 540], [300, 300], [1500, 800], [960, 540], [-9999, -9999], [200, 900], [1700, 200], [960, 540]];
    for (var i = 0; i < pts.length; i++) (function (p) { acts[1 + i * 190] = function (s) { _mouse(s, p[0], p[1]); }; })(pts[i]);
    add('fear' + lvl, 1920, 1080, { cursorFearLevel: lvl, fishCount: 80 }, 1500, acts);
})(lvl);
(function () {
    var acts = {};
    for (var s = 5; s < 1400; s += 40) (function (s) {
        acts[s] = function (sim, cfg, B) {
            var f = sim.entities.fish[s % sim.entities.fish.length];
            if (s % 120 === 5) sim.totalWormsEaten = sim.totalWormsEaten - (sim.totalWormsEaten % 10) + 9;
            B.forceSpawnWorm(sim, f.x, f.y);
            B.forceSpawnWorm(sim, 400 + s % 500, 100);
            B.forceSpawnBubble(sim, 50, 50 + s % 700);
        };
    })(s);
    add('worms-births', 1920, 1080, { fishCount: 60, anglerCount: 0, orcaCount: 0, jellyCount: 3 }, 1500, acts);
})();
(function () {
    var acts = {};
    for (var s = 5; s < 600; s += 15) (function (s) {
        acts[s] = function (sim, cfg, B) { B.forceSpawnWorm(sim, 100 + s * 2, 200 + (s % 300)); };
    })(s);
    acts[700] = function (sim, cfg) { cfg.fishCount = 10; };   // lower count while babies exist
    add('worms-then-trim', 1280, 720, { fishCount: 40, anglerCount: 1, orcaCount: 1, jellyCount: 2 }, 1100, acts);
})();
function stress(name, v, mul) {
    var acts = {};
    acts[1] = function (sim) { sim.cpuStress = v; sim.speedMultiplier = mul; };
    add(name, 1920, 1080, { fishCount: 70 }, 1000, acts);
}
stress('stress0.3', 0.3, 1.1);
stress('stress0.6', 0.6, 1.24);
stress('stress0.9', 0.9, 1.36);
stress('stress1.5', 1.5, 1.6);
(function () {
    var acts = {};
    acts[1] = function (sim) { sim.cpuStress = 0.0; };
    acts[300] = function (sim) { sim.cpuStress = 0.7; };
    acts[600] = function (sim) { sim.cpuStress = 1.4; };
    acts[900] = function (sim) { sim.cpuStress = 0.2; };
    add('stress-ramp', 1920, 1080, { fishCount: 50, jellyCount: 4 }, 1300, acts);
})();
(function () {
    var acts = {};
    acts[300] = function (sim, cfg, B) { B.resize(sim, 800, 600, 1); };
    acts[600] = function (sim, cfg, B) { B.resize(sim, 2560, 1440, 2); };
    acts[900] = function (sim, cfg, B) { B.resize(sim, 2560, 1440, 1); };
    acts[1100] = function (sim, cfg, B) { B.resize(sim, 1000, 3000, 1); };
    add('resize', 1920, 1080, { fishCount: 90 }, 1500, acts);
})();
add('resize-from-zero', 0, 0, { fishCount: 30 }, 40, {
    20: function (sim, cfg, B) { B.resize(sim, 1600, 900, 1); } });
(function () {
    var acts = {};
    acts[200] = function (s, cfg) { cfg.fishCount = 10; cfg.anglerCount = 0; cfg.orcaCount = 1; };
    acts[400] = function (s, cfg) { cfg.fishCount = 120; cfg.anglerCount = 5; cfg.orcaCount = 4; cfg.jellyCount = 9; };
    acts[700] = function (s, cfg) { cfg.visualRange = 400; cfg.cohesionFactor = 0.01; cfg.fishMaxSpeed = 1.2; };
    acts[900] = function (s, cfg) { cfg.jellyCount = 0; cfg.fishCount = 30; cfg.fishSize = 6; cfg.orcaSize = 8; };
    acts[1100] = function (s, cfg) { cfg.anglerChase = 0; cfg.orcaChase = 1.5; cfg.cursorFearLevel = 4; _mouse(s, 900, 500); };
    add('config-changes', 1920, 1080, { fishCount: 38 }, 1500, acts);
})();

function runScenario(B, sc, mock, setTime) {
    var cfg = {}, k;
    for (k in sc.cfg) cfg[k] = sc.cfg[k];
    var sim = B.createSimulation(sc.w, sc.h, 1, cfg);
    var parent = {};
    var checkpoints = {}, order = [];
    var every = Math.max(1, Math.floor(sc.steps / 6));
    for (var i = 1; i <= sc.steps; i++) {
        if (sc.actions[i]) sc.actions[i](sim, cfg, B);
        setTime(i * 40);
        B.step(sim, 1, cfg);
        B.sync(sim, parent, mock);
        if (i % every === 0 || i === sc.steps) {
            var key = 's' + i;
            order.push(key);
            checkpoints[key] = { hash: hashStr(serialize(sim, mock)), summary: summary(sim, mock) };
        }
    }
    return checkpoints;
}
