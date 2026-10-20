.pragma library
// Deterministic sim states for the visual regression test (tests/qml-render.js).
// Plain ES5, loaded by tests/qml/render.qml. Each scenario: w,h,cfg,steps, actions {step: fn(sim,cfg,B)}

var SCENARIOS = [];
function add(name, cfg, steps, actions) {
    SCENARIOS.push({ name: name, w: 1920, h: 1080, cfg: cfg, steps: steps, actions: actions || {} });
}
function stress(v, mul) {
    var a = {};
    a[1] = function (sim) { sim.cpuStress = v; sim.speedMultiplier = mul; };
    return a;
}
function spawnAll(sim, B) {
    var f = sim.entities.fish;
    for (var i = 0; i < 40; i++) B.forceSpawnWorm(sim, 100 + (i * 97) % 1700, 80 + (i * 211) % 900);
    for (var j = 0; j < 120; j++) B.forceSpawnBubble(sim, 50 + (j * 131) % 1800, 100 + (j * 53) % 900);
}

add('defaults', {}, 300);
add('stress0.3', { fishCount: 70 }, 300, stress(0.3, 1.1));
add('stress0.6', {}, 300, stress(0.6, 1.24));
add('stress0.9', { fishCount: 70 }, 300, stress(0.9, 1.36));
add('stress1.5', {}, 300, stress(1.5, 1.6));
add('crowded', { fishCount: 200, anglerCount: 8, orcaCount: 8, jellyCount: 12 }, 400);
add('crowded-stress0.6', { fishCount: 200, anglerCount: 8, orcaCount: 8, jellyCount: 12 }, 300, stress(0.6, 1.24));
add('crowded-stress1.5', { fishCount: 200 }, 300, stress(1.5, 1.6));
add('worms-bubbles', { fishCount: 38 }, 200, { 100: function (sim, cfg, B) { spawnAll(sim, B); } });
(function () {
    // eaten worms -> babies; the capture lands while many are mid-birth-animation
    var acts = {};
    for (var s = 5; s < 330; s += 12) (function (s) {
        acts[s] = function (sim, cfg, B) {
            var f = sim.entities.fish[s % sim.entities.fish.length];
            if (s % 24 === 5) sim.totalWormsEaten = sim.totalWormsEaten - (sim.totalWormsEaten % 10) + 9;
            B.forceSpawnWorm(sim, f.x, f.y);
        };
    })(s);
    add('babies', { fishCount: 120, anglerCount: 0, orcaCount: 0, jellyCount: 0 }, 345, acts);
})();
add('orca-angler-jelly', { fishCount: 10, anglerCount: 10, orcaCount: 10, jellyCount: 14 }, 300);
