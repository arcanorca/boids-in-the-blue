// GENERATED from core/boids-core.js by tools/build.js - do not edit.

// Boids in the Blue - shared simulation core (single source of truth).
// Pure logic: no QML/DOM/GJS APIs, no rendering. Hosts keep their own sprites
// and call step(); entities removed by the core are reported via
// sim.onRemove(entity). Only top-level function/var declarations (plus
// prototype assignments) so tools/build.js can emit KDE / ESM / web builds.

// --- DEFAULTS (v0.2) ---
var FISH_COUNT = 38;
var JELLY_COUNT = 5;
var ANGLER_COUNT = 3;
var ORCA_COUNT = 3;

var FISH_SIZE = 4.0;
var ANGLER_SIZE = 4.2;
var ORCA_SIZE = 5.5;
var JELLY_SIZE = 3.0;
var WORM_SIZE = 4;

// Hard caps so click/hover spam cannot flood the scene with sprites
var MAX_BUBBLES = 120;
var MAX_WORMS = 40;
var MIN_GRID_CELL = 150;
var MAX_BORN_EXTRA = 20;   // max babies that may raise the population above the configured fish count

// Per-frame speeds (no dt scaling, matching original architecture)
var SPEED_MAX = 0.8;
var SPEED_MIN = 0.2;

var TURN_FACTOR = 0.06;
var VISUAL_RANGE = 130;
var SEPARATION_DIST = 35;
var EDGE_MARGIN = 140;

var PANIC_RANGE = 140;
var ORCA_PANIC_RANGE = 200;
var FEAR_FACTOR = 1.0;
var PANIC_RANGE_SQ = PANIC_RANGE * PANIC_RANGE;
var ORCA_PANIC_RANGE_SQ = ORCA_PANIC_RANGE * ORCA_PANIC_RANGE;

// Flocking (per-frame — exact original values)
var COHESION_FACTOR = 0.005;
var ALIGNMENT_FACTOR = 0.05;
var SEPARATION_FACTOR = 0.05;
var WANDER_FACTOR = 0.015;

var FISH_PALETTE = ['#FF8080', '#FFB34D', '#E6E666', '#4DCCE6', '#CC99E6'];
var BUBBLE_COLOR = "rgba(200, 230, 255, 0.4)";
var WORM_COLOR = "#FF9999";

// --- SPRITES ---
var SPRITES = {
    FISH: [[0,0,0,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,2,0],[1,1,1,1,1,1,0],[0,1,1,1,0,0,0],[0,0,1,0,0,0,0]],
    ANGLER: [[0,0,0,0,0,0,2,2,0,0],[0,0,0,0,0,0,1,1,0,0],[0,0,0,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,0],[0,1,1,1,1,3,3,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0,0,0],[0,0,1,0,0,1,0,0,0,0]],
    ORCA: [[0,0,0,0,0,1,0,0,0,0,0],[0,0,0,0,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,1,0],[1,1,2,1,1,1,1,1,1,1,1],[1,1,1,2,2,2,1,0,1,0,1],[0,0,0,0,1,1,0,0,0,0,0]],
    JELLY: [[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[2,0,2,0,2],[2,0,2,0,2],[0,0,2,0,0]],
    WORM: [[1,0],[0,1],[1,0],[0,1]],
    BUBBLE: [[0,1,0],[1,0,1],[0,1,0]]
};

// --- UTILS ---
function _cfgNum(cfg, name, def) {
    if (cfg && cfg[name] !== undefined) {
        var v = Number(cfg[name]);
        return isFinite(v) ? v : def;
    }
    return def;
}

// Entity counts: non-negative integers
function _cfgCount(cfg, name, def) {
    return Math.max(0, Math.floor(_cfgNum(cfg, name, def)));
}

var _blendCache = {};
function _blendCached(c1, c2, f) {
    var key = c1 + c2 + f;
    var r = _blendCache[key];
    if (r === undefined) r = _blendCache[key] = _blendHex(c1, c2, f);
    return r;
}

function _finite(e) {
    return isFinite(e.x) && isFinite(e.y) && isFinite(e.vx || 0) && isFinite(e.vy || 0);
}

function _blendHex(c1, c2, f) {
    if (f <= 0) return c1;
    if (f >= 1) return c2;
    var r1 = parseInt(c1.substring(1,3),16), g1 = parseInt(c1.substring(3,5),16), b1 = parseInt(c1.substring(5,7),16);
    var r2 = parseInt(c2.substring(1,3),16), g2 = parseInt(c2.substring(3,5),16), b2 = parseInt(c2.substring(5,7),16);
    var r = Math.round(r1+(r2-r1)*f), g = Math.round(g1+(g2-g1)*f), b = Math.round(b1+(b2-b1)*f);
    return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function _bounceBoundaries(sim, ent) {
    if (ent.x < 0) { ent.x = 2; ent.vx = Math.abs(ent.vx) * 0.3 + 0.05; }
    if (ent.x > sim.width) { ent.x = sim.width - 2; ent.vx = -(Math.abs(ent.vx) * 0.3 + 0.05); }
    var top = sim.top || 0;       // optional upper limit (a theme with a water surface line sets it; default 0)
    if (ent.y < top) { ent.y = top + 2; ent.vy = Math.abs(ent.vy) * 0.3 + 0.05; }
    if (ent.y > sim.height) { ent.y = sim.height - 2; ent.vy = -(Math.abs(ent.vy) * 0.3 + 0.05); }
}

// Log each distinct error once instead of swallowing it silently
var _seenErrors = {};
function _report(where, e) {
    var key = where + ': ' + (e && e.message ? e.message : e);
    if (_seenErrors[key]) return;
    _seenErrors[key] = true;
    console.warn('[boids] ' + key + (e && e.lineNumber ? ' (line ' + e.lineNumber + ')' : ''));
}

function _addBubble(sim, x, y) {
    if (sim.entities.bubbles.length >= MAX_BUBBLES) return;
    sim.entities.bubbles.push(new Bubble(x, y));
}

// Shrink a list to `target`, notifying the host of the removed entities
function _trimTo(sim, list, target) {
    while (list.length > target) {
        var e = list.pop();
        e.dead = true;
        _removed(sim, e);
    }
}

// Random source: Math.random by default; setRandom(fn) injects a seeded one
var _rand = Math.random;
function setRandom(fn) { _rand = (typeof fn === 'function') ? fn : Math.random; }
function random() { return _rand(); }

// Entity removal notification: the host (renderer) sets sim.onRemove(entity)
// to release whatever it attached to the entity (e.g. a QML delegate)
function _removed(sim, ent) { if (sim.onRemove) sim.onRemove(ent); }

// --- Stress (CPU load) tint: pure helpers, hosts apply the result to their sprites ---
// pulse: quantised 0..1 red/blue throb above 1.2; level: quantised 0..1 red blend from 0.25
function stressPulse(stress, nowMs) {
    return stress > 1.2 ? Math.round((Math.sin(nowMs / 300) + 1) * 4) / 8 : 0;
}
function stressLevel(stress) {
    var raw = (stress - 0.25) / 0.75;
    return Math.round(Math.min(1.0, raw * raw) * 16) / 16;
}
function stressTint(color, stress, pulse, level) {
    if (stress > 1.2) return _blendCached("#FF0000", "#000080", pulse);
    return _blendCached(color, "#FF3333", level);
}
function stressShake(stress) { return stress > 0.5 ? (stress - 0.5) * 3.0 : 0; }

// --- API ---
function createSimulation(w, h, dpr, cfg) { return new Simulation(w, h, dpr, cfg); }
function step(sim, dt, cfg) { if (!sim) return; sim.config = cfg || sim.config; sim.step(dt); }
function resize(sim, w, h, dpr) { if (!sim) return; sim.resize(w, h, dpr); }

function forceSpawnWorm(sim, x, y) {
    if (!sim || sim.entities.worms.length >= MAX_WORMS) return;
    sim.entities.worms.push(new Worm(x, y));
    for (var i = 0; i < 6; i++) {
        _addBubble(sim,
            x + (_rand() - 0.5) * 40,
            y + (_rand() - 0.5) * 30);
    }
}

function forceSpawnBubble(sim, x, y) {
    if (!sim) return;
    _addBubble(sim, x, y);
}

// --- SPATIAL GRID ---
var SpatialGrid = function (w, h, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(w / cellSize);
    this.rows = Math.ceil(h / cellSize);
    this.cells = new Array(this.cols * this.rows);
    for (var i = 0; i < this.cells.length; i++) this.cells[i] = [];
};
SpatialGrid.prototype.clear = function () {
    for (var i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
};
SpatialGrid.prototype.insert = function (ent) {
    if (!isFinite(ent.x) || !isFinite(ent.y) || this.cells.length === 0) return;
    var c = Math.floor(ent.x / this.cellSize);
    var r = Math.floor(ent.y / this.cellSize);
    if (c < 0) c = 0; else if (c >= this.cols) c = this.cols - 1;
    if (r < 0) r = 0; else if (r >= this.rows) r = this.rows - 1;
    this.cells[r * this.cols + c].push(ent);
};

// --- SIMULATION ---
var Simulation = function (w, h, dpr, cfg) {
    this.width = w; this.height = h; this.dpr = dpr;
    this.config = cfg || {};
    this.cpuStress = 0.0;
    this.speedMultiplier = 1.0;
    this.mouse = { x: -9999, y: -9999 };
    this.entities = { fish: [], anglers: [], orcas: [], jellies: [], worms: [], bubbles: [] };
    this.allLists = [this.entities.worms, this.entities.bubbles, this.entities.fish,
                     this.entities.anglers, this.entities.orcas, this.entities.jellies];
    this.totalWormsEaten = 0;
    this.bornExtra = 0;
    this.grid = new SpatialGrid(w, h, MIN_GRID_CELL);
    this.init();
};

Simulation.prototype.init = function () {
    var fc = _cfgCount(this.config, 'fishCount', FISH_COUNT);
    var ac = _cfgCount(this.config, 'anglerCount', ANGLER_COUNT);
    var oc = _cfgCount(this.config, 'orcaCount', ORCA_COUNT);
    var jc = _cfgCount(this.config, 'jellyCount', JELLY_COUNT);
    this._lastFishBase = fc;
    for (var i = 0; i < fc; i++) this.entities.fish.push(new Fish(_rand()*this.width, _rand()*this.height, this));
    for (var i = 0; i < ac; i++) this.entities.anglers.push(new Angler(_rand()*this.width, _rand()*this.height));
    for (var i = 0; i < oc; i++) this.entities.orcas.push(new Orca(_rand()*this.width, _rand()*this.height));
    for (var i = 0; i < jc; i++) this.entities.jellies.push(new Jelly(_rand()*this.width, _rand()*this.height));
};

Simulation.prototype.resize = function (w, h, dpr) {
    var wasEmpty = !(this.width > 0 && this.height > 0);
    this.width = w; this.height = h; this.dpr = dpr;
    if (!(w > 0 && h > 0)) return;
    var cs = this.grid.cellSize;
    if (this.grid.cols !== Math.ceil(w / cs) || this.grid.rows !== Math.ceil(h / cs) || this.grid.cells.length === 0)
        this.grid = new SpatialGrid(w, h, cs);
    for (var l = 0; l < this.allLists.length; l++) {
        var list = this.allLists[l];
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (wasEmpty) { e.x = _rand() * w; e.y = _rand() * h; }
            else if (e.kind === 'worm' || e.kind === 'bubble') continue;
            else { e.x = Math.min(Math.max(e.x, 0), w); e.y = Math.min(Math.max(e.y, 0), h); }
        }
    }
};

Simulation.prototype.step = function (dt) {
    if (!(this.width > 0 && this.height > 0)) return;
    try {
        var baseFish = _cfgCount(this.config, 'fishCount', FISH_COUNT);
        // Babies add to the population (bornExtra); lowering the configured count resets that bonus
        if (baseFish < this._lastFishBase) this.bornExtra = 0;
        this._lastFishBase = baseFish;
        var targetFish = baseFish + this.bornExtra;
        while (this.entities.fish.length < targetFish) this.entities.fish.push(new Fish(_rand()*this.width, _rand()*this.height, this));
        // Remove excess fish but NEVER kill actively-animating babies
        while (this.entities.fish.length > targetFish) {
            var removeIdx = -1;
            for (var fi = this.entities.fish.length - 1; fi >= 0; fi--) {
                var ff = this.entities.fish[fi];
                if (!(ff.isBaby && ff.birthAnim !== undefined && ff.birthAnim < 60)) {
                    removeIdx = fi; break;
                }
            }
            if (removeIdx < 0) break;
            var f = this.entities.fish[removeIdx];
            f.dead = true;
            _removed(this, f);
            this.entities.fish.splice(removeIdx, 1);
        }

        var targetAnglers = _cfgCount(this.config, 'anglerCount', ANGLER_COUNT);
        while (this.entities.anglers.length < targetAnglers) this.entities.anglers.push(new Angler(_rand()*this.width, _rand()*this.height));
        _trimTo(this, this.entities.anglers, targetAnglers);

        var targetOrcas = _cfgCount(this.config, 'orcaCount', ORCA_COUNT);
        while (this.entities.orcas.length < targetOrcas) this.entities.orcas.push(new Orca(_rand()*this.width, _rand()*this.height));
        _trimTo(this, this.entities.orcas, targetOrcas);

        var targetJellies = _cfgCount(this.config, 'jellyCount', JELLY_COUNT);
        while (this.entities.jellies.length < targetJellies) this.entities.jellies.push(new Jelly(_rand()*this.width, _rand()*this.height));
        _trimTo(this, this.entities.jellies, targetJellies);

        // Cache config once per step (eliminates ~430 QML property lookups/frame)
        var c = this.config;
        if (!this._c) this._c = {};
        var cc = this._c;
        cc.maxSpeed = _cfgNum(c, 'fishMaxSpeed', SPEED_MAX);
        cc.minSpeed = Math.min(_cfgNum(c, 'fishMinSpeed', SPEED_MIN), cc.maxSpeed);
        cc.turn = _cfgNum(c, 'turnFactor', TURN_FACTOR);
        cc.vRange = _cfgNum(c, 'visualRange', VISUAL_RANGE);
        cc.cohF = _cfgNum(c, 'cohesionFactor', COHESION_FACTOR);
        cc.alignF = _cfgNum(c, 'alignmentFactor', ALIGNMENT_FACTOR);
        cc.sepF = _cfgNum(c, 'separationFactor', SEPARATION_FACTOR);
        cc.sepDist = _cfgNum(c, 'separationDist', SEPARATION_DIST);
        cc.wanderF = _cfgNum(c, 'wanderFactor', WANDER_FACTOR);
        cc.fearLevel = Math.round(_cfgNum(c, 'cursorFearLevel', 2));
        cc.anglerChase = _cfgNum(c, 'anglerChase', 0.7);
        cc.anglerSpeed = _cfgNum(c, 'anglerSpeed', 1.0);
        cc.orcaChase = _cfgNum(c, 'orcaChase', 0.7);
        cc.orcaSpeed = _cfgNum(c, 'orcaSpeed', 1.0);
        cc.fishSize = _cfgNum(c, 'fishSize', FISH_SIZE);
        cc.orcaSize = _cfgNum(c, 'orcaSize', ORCA_SIZE);
        cc.anglerSize = _cfgNum(c, 'anglerSize', ANGLER_SIZE);
        cc.jellySize = _cfgNum(c, 'jellySize', JELLY_SIZE);
        cc.wormSize = _cfgNum(c, 'wormSize', WORM_SIZE);

        // The 3x3 neighbourhood only covers one cell in each direction,
        // so a cell must be at least as wide as the vision range.
        var cell = Math.max(MIN_GRID_CELL, Math.ceil(cc.vRange));
        if (this.grid.cellSize !== cell) this.grid = new SpatialGrid(this.width, this.height, cell);
        this.grid.clear();
        for (var i = 0; i < this.entities.fish.length; i++) this.grid.insert(this.entities.fish[i]);

        var allLists = this.allLists;
        for (var l = 0; l < allLists.length; l++) {
            var list = allLists[l];
            for (var i = list.length - 1; i >= 0; i--) {
                var ent = list[i];
                try { ent.update(this, dt); } catch (ex) { _report(ent.kind + '.update', ex); ent.dead = true; }
                if (ent.dead) {
                    _removed(this, ent);
                    list.splice(i, 1);
                } else if (!_finite(ent)) {
                    if (ent.kind === 'worm' || ent.kind === 'bubble') {
                        ent.dead = true;
                        _removed(this, ent);
                        list.splice(i, 1);
                    } else {
                        ent.x = _rand() * this.width; ent.y = _rand() * this.height;
                        ent.vx = 0; ent.vy = 0;
                    }
                } else if (ent.kind !== 'worm' && ent.kind !== 'bubble') {
                    _bounceBoundaries(this, ent);
                }
            }
        }

        // Predator separation (prevents orca/angler overlap)
        var anglers = this.entities.anglers, orcas = this.entities.orcas;
        var predCount = anglers.length + orcas.length;
        for (var pi = 0; pi < predCount; pi++) {
            var pa = pi < anglers.length ? anglers[pi] : orcas[pi - anglers.length];
            for (var pj = pi + 1; pj < predCount; pj++) {
                var pb = pj < anglers.length ? anglers[pj] : orcas[pj - anglers.length];
                var pdx = pb.x - pa.x, pdy = pb.y - pa.y;
                var pDistSq = pdx*pdx + pdy*pdy;
                if (pDistSq < 3600 && pDistSq > 0.01) {
                    var pDist = Math.sqrt(pDistSq);
                    var pf = (60 - pDist) * 0.02;
                    var pnx = pdx/pDist, pny = pdy/pDist;
                    pa.vx -= pnx*pf; pa.vy -= pny*pf;
                    pb.vx += pnx*pf; pb.vy += pny*pf;
                }
            }
        }

    } catch (e) { _report('step', e); }
};

// ============================================================
// ENTITIES
// ============================================================

// --- WORM (per-frame, no dt) ---
var Worm = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'worm';
    this.vy = 0.25; this.life = 1.0; this.wiggle = _rand() * 6.28;
};
Worm.prototype.update = function (sim) {
    this.y += this.vy;
    this.wiggle += 0.06;
    this.x += Math.sin(this.wiggle) * 0.3;
    this.rotation = 0;
    if (this.y > sim.height - 5) { this.y = sim.height - 5; this.life -= 0.01; }
    if (this.life <= 0) this.dead = true;
};

// --- BUBBLE (per-frame, no dt) ---
var Bubble = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'bubble';
    this.vy = -(0.2 + _rand() * 0.5);
    this.wobble = _rand() * 6.28;
    this.scale = 1.5 + _rand() * 1.5;
};
Bubble.prototype.update = function (sim) {
    this.y += this.vy;
    this.wobble += 0.08;
    this.x += Math.sin(this.wobble) * 0.4;
    if (this.y < (sim.top || 0) - 10) this.dead = true;
};

// --- FISH (original + zen harmonics) ---
var Fish = function (x, y, sim, isBaby) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'fish';
    this.vx = (_rand() - 0.5);
    this.vy = (_rand() - 0.5);
    this.color = FISH_PALETTE[Math.floor(_rand() * FISH_PALETTE.length)];
    this.isBaby = isBaby || false;
    this.sizeVariation = this.isBaby ? -1.5 : (_rand() * 2 - 1);
    this.personality = this.isBaby ? (1.1 + _rand() * 0.3) : (0.8 + _rand() * 0.4);
    this.wanderTheta = _rand() * Math.PI * 2;
    this.facingRight = this.vx >= 0;
    if (this.isBaby) {
        this.birthAnim = 0;
        this.birthX = x;
        this.birthY = y;
    }
};

Fish.prototype.update = function (sim) {
    var cc = sim._c;
    var maxSpeed = cc.maxSpeed;
    if (sim.speedMultiplier) maxSpeed *= sim.speedMultiplier;

    var minSpeed = cc.minSpeed;
    var turn = cc.turn;
    var vRange = cc.vRange;
    var cohF = cc.cohF;
    var alignF = cc.alignF;
    var sepF = cc.sepF;
    var sepDist = cc.sepDist;
    var wanderF = cc.wanderF;

    var neighbors = 0;
    var xVelAvg = 0, yVelAvg = 0, xPosAvg = 0, yPosAvg = 0;
    var closeDx = 0, closeDy = 0;
    var panic = false;

    // --- BABY BIRTH CEREMONY (matches original: 60 frames) ---
    if (this.isBaby && this.birthAnim < 60) {
        this.birthAnim++;
        var age = this.birthAnim;
        var angle = age * 0.25;
        var radius = 10 + age * 0.8;
        var tx = this.birthX + Math.cos(angle) * radius;
        var ty = this.birthY + Math.sin(angle) * radius;
        var dx = tx - this.x; var dy = ty - this.y;
        this.vx += dx * 0.08;
        this.vy += dy * 0.08;
        this.vx *= 0.9; this.vy *= 0.9;
        this.x += this.vx; this.y += this.vy;
        this.sizeVariation = -3.5 + (age / 60.0) * 2.0;
        return;
    }

    // --- CURSOR FEAR (matches original exactly) ---
    var fearLevel = cc.fearLevel;

    if (fearLevel > 0 && sim.mouse) {
        var range = 180;
        var force = 0.40;
        if (fearLevel === 2) { range = 350; force = 2.0; }
        if (fearLevel === 3) { range = 350; force = 3.0; }
        if (fearLevel === 4) { range = 500; force = 8.0; }

        var mdx = this.x - sim.mouse.x;
        var mdy = this.y - sim.mouse.y;
        var mdistSq = mdx * mdx + mdy * mdy;

        if (mdistSq < range * range) {
            if (fearLevel === 4) {
                maxSpeed *= 2.5;
                cohF = 0; alignF = 0; sepF *= 5.0;
            }
            var mdist = Math.sqrt(mdistSq);
            if (mdist > 1) {
                this.vx += (mdx / mdist) * force;
                this.vy += (mdy / mdist) * force;
            }
        }
    }

    // --- PREDATOR FEAR (no concat — iterate directly) ---
    var panicRangeSq = PANIC_RANGE_SQ;
    var orcaRangeSq = ORCA_PANIC_RANGE_SQ;
    for (var p = 0; p < sim.entities.anglers.length; p++) {
        var pred = sim.entities.anglers[p];
        var pdx = this.x - pred.x; var pdy = this.y - pred.y;
        var pdistSq = pdx * pdx + pdy * pdy;
        if (pdistSq < panicRangeSq) {
            panic = true;
            var pdist = Math.sqrt(pdistSq);
            if (pdist > 0.01) { this.vx += (pdx/pdist)*FEAR_FACTOR; this.vy += (pdy/pdist)*FEAR_FACTOR; }
        }
    }
    for (var p = 0; p < sim.entities.orcas.length; p++) {
        var pred = sim.entities.orcas[p];
        var pdx = this.x - pred.x; var pdy = this.y - pred.y;
        var pdistSq = pdx*pdx + pdy*pdy;
        if (pdistSq < orcaRangeSq) {
            panic = true;
            var pdist = Math.sqrt(pdistSq);
            if (pdist > 0.01) { this.vx += (pdx/pdist)*FEAR_FACTOR; this.vy += (pdy/pdist)*FEAR_FACTOR; }
        }
    }

    // --- BOIDS FLOCKING (spatial grid, matches original: raw separation, no neighbor limit) ---
    var grid = sim.grid;
    var cellCol = Math.floor(this.x / grid.cellSize);
    var cellRow = Math.floor(this.y / grid.cellSize);
    var vRangeSq = vRange * vRange;
    var sepDistSq = sepDist * sepDist;
    var startC = Math.max(0, cellCol - 1), endC = Math.min(grid.cols - 1, cellCol + 1);
    var startR = Math.max(0, cellRow - 1), endR = Math.min(grid.rows - 1, cellRow + 1);

    for (var r = startR; r <= endR; r++) {
        for (var gc = startC; gc <= endC; gc++) {
            var cell = grid.cells[r * grid.cols + gc];
            for (var k = 0; k < cell.length; k++) {
                var other = cell[k];
                if (other === this) continue;
                var fdx = this.x - other.x; var fdy = this.y - other.y;
                var distSq = fdx*fdx + fdy*fdy;
                if (distSq < vRangeSq) {
                    xVelAvg += other.vx; yVelAvg += other.vy;
                    xPosAvg += other.x; yPosAvg += other.y;
                    if (distSq < sepDistSq) {
                        closeDx += fdx; closeDy += fdy;
                    }
                    neighbors++;
                }
            }
        }
    }

    if (neighbors > 0) {
        xVelAvg /= neighbors; yVelAvg /= neighbors;
        xPosAvg /= neighbors; yPosAvg /= neighbors;
        this.vx += (xVelAvg - this.vx) * alignF;
        this.vy += (yVelAvg - this.vy) * alignF;
        this.vx += (xPosAvg - this.x) * cohF;
        this.vy += (yPosAvg - this.y) * cohF;
    }
    this.vx += closeDx * sepF;
    this.vy += closeDy * sepF;

    // --- WORM EATING (matches original) ---
    if (!panic && sim.entities.worms.length > 0) {
        var closestDist = 999999; var closestWorm = null;
        for (var i = 0; i < sim.entities.worms.length; i++) {
            var w = sim.entities.worms[i];
            if (w.dead) continue;
            var wdx = w.x - this.x; var wdy = w.y - this.y;
            var wd2 = wdx*wdx + wdy*wdy;
            if (wd2 < closestDist) { closestDist = wd2; closestWorm = w; }
        }
        if (closestWorm && closestDist < 80000) {
            this.vx += (closestWorm.x - this.x) * 0.005;
            this.vy += (closestWorm.y - this.y) * 0.005;
            if (closestDist < 400) {
                closestWorm.dead = true;
                sim.totalWormsEaten++;
                if (sim.totalWormsEaten % 10 === 0 && sim.bornExtra < MAX_BORN_EXTRA) {
                    sim.bornExtra++;
                    sim.entities.fish.push(new Fish(
                        this.x + (_rand()-0.5)*20,
                        this.y + (_rand()-0.5)*20, sim, true));
                }
                for (var eb = 0; eb < 3; eb++) {
                    _addBubble(sim,
                        this.x + (_rand()-0.5)*15,
                        this.y + (_rand()-0.5)*10);
                }
            }
        }
    }

    // --- BABY FOLLOW ADULTS ---
    if (this.isBaby && !panic) {
        var nearestAdult = null; var nearestAdultDist = 999999;
        for (var i = 0; i < sim.entities.fish.length; i++) {
            var a = sim.entities.fish[i];
            if (a === this || a.isBaby) continue;
            var adx = a.x - this.x; var ady = a.y - this.y;
            var ad2 = adx*adx + ady*ady;
            if (ad2 < nearestAdultDist) { nearestAdultDist = ad2; nearestAdult = a; }
        }
        if (nearestAdult && nearestAdultDist < 250*250) {
            this.vx += (nearestAdult.x - this.x) * 0.008;
            this.vy += (nearestAdult.y - this.y) * 0.008;
        }
    }

    // --- WANDER (matches original) ---
    if (!panic) {
        this.wanderTheta += (_rand() - 0.5) * 0.1;
        this.vx += Math.cos(this.wanderTheta) * wanderF;
        this.vy += Math.sin(this.wanderTheta) * wanderF;
    }

    // --- EDGE STEERING (matches original: simple, not progressive) ---
    if (this.x < EDGE_MARGIN) this.vx += turn;
    if (this.x > sim.width - EDGE_MARGIN) this.vx -= turn;
    var top = sim.top || 0;
    if (this.y - top < EDGE_MARGIN) this.vy += turn;
    if (this.y > sim.height - EDGE_MARGIN) this.vy -= turn;

    // Smooth U-turn near walls (shark turn — arc away instead of bounce)
    var UT = 75, f;
    var eL = Math.max(0, (UT - this.x) / UT);
    var eR = Math.max(0, (this.x - (sim.width - UT)) / UT);
    var eT = Math.max(0, (UT - (this.y - top)) / UT);
    var eB = Math.max(0, (this.y - (sim.height - UT)) / UT);
    if (eL > 0) { f = eL * eL * 0.15; this.vx += f; this.vy += (this.vy >= 0 ? 1 : -1) * f * 0.5; }
    if (eR > 0) { f = eR * eR * 0.15; this.vx -= f; this.vy += (this.vy >= 0 ? 1 : -1) * f * 0.5; }
    if (eT > 0) { f = eT * eT * 0.15; this.vy += f; this.vx += (this.vx >= 0 ? 1 : -1) * f * 0.5; }
    if (eB > 0) { f = eB * eB * 0.15; this.vy -= f; this.vx += (this.vx >= 0 ? 1 : -1) * f * 0.5; }

    // --- SPEED LIMIT (matches original) ---
    this.vx *= 0.99; this.vy *= 0.99;
    var speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    var curMax = panic ? maxSpeed * 1.6 : maxSpeed * this.personality;
    var curMin = minSpeed * this.personality;

    if (speed > curMax) {
        this.vx = (this.vx/speed) * curMax;
        this.vy = (this.vy/speed) * curMax;
    } else if (speed < curMin && speed > 0.01) {
        this.vx = (this.vx/speed) * (speed + 0.015);
        this.vy = (this.vy/speed) * (speed + 0.015);
    }

    this.x += this.vx; this.y += this.vy;

    // --- FACING (matches original threshold) ---
    if (this.vx > 0.35) this.facingRight = true;
    else if (this.vx < -0.35) this.facingRight = false;
    this.rotation = 0;
};

// --- ANGLER ---
var Angler = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'angler';
    this.vx = (_rand()-0.5)*0.9; this.vy = (_rand()-0.5)*0.9;
    this.facingRight = this.vx >= 0;
};
Angler.prototype.update = function (sim) {
    var chaseMul = sim._c.anglerChase;

    // Flee from orcas
    for (var i = 0; i < sim.entities.orcas.length; i++) {
        var orca = sim.entities.orcas[i];
        var dx = this.x - orca.x; var dy = this.y - orca.y;
        var distSq = dx*dx + dy*dy;
        if (distSq < ORCA_PANIC_RANGE_SQ) {
            var dist = Math.sqrt(distSq);
            if (dist > 0.01) { this.vx += (dx/dist)*0.5; this.vy += (dy/dist)*0.5; }
        }
    }

    // Single-pass: mob detection + closest fish
    if (chaseMul > 0.05) {
        var MOB = 200; var MOBsq = MOB*MOB;
        var nearbyFish = 0; var sx = 0, sy = 0;
        var closestFish = null; var closestDist = 999999;
        for (var i = 0; i < sim.entities.fish.length; i++) {
            var f = sim.entities.fish[i];
            var fdx = f.x-this.x; var fdy = f.y-this.y;
            var fd2 = fdx*fdx+fdy*fdy;
            if (fd2 < MOBsq) { nearbyFish++; sx += f.x; sy += f.y; }
            if (fd2 < closestDist) { closestDist = fd2; closestFish = f; }
        }
        if (nearbyFish >= 15) {
            sx /= nearbyFish; sy /= nearbyFish;
            var sdx = sx-this.x; var sdy = sy-this.y;
            var sd = Math.sqrt(sdx*sdx+sdy*sdy);
            if (sd > 0.01) { this.vx += (sdx/sd)*0.05*chaseMul; this.vy += (sdy/sd)*0.05*chaseMul; }
        } else if (closestFish && closestDist < 150*150) {
            var cdist = Math.sqrt(closestDist);
            if (cdist > 0.01) {
                this.vx += ((closestFish.x-this.x)/cdist)*0.03*chaseMul;
                this.vy += ((closestFish.y-this.y)/cdist)*0.03*chaseMul;
            }
        }
    }

    // Wander
    this.vx += (_rand()-0.5)*0.04; this.vy += (_rand()-0.5)*0.04;
    this.vx *= 0.995; this.vy *= 0.995;

    // Speed limit
    var anglerSpeedMul = sim._c.anglerSpeed;
    var aSpd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    var aMax = 0.5 * anglerSpeedMul;
    if (aSpd > aMax) { this.vx = (this.vx/aSpd)*aMax; this.vy = (this.vy/aSpd)*aMax; }

    this.x += this.vx; this.y += this.vy;
    if (this.vx > 0.15) this.facingRight = true;
    else if (this.vx < -0.15) this.facingRight = false;
    this.rotation = 0;
};

// --- ORCA (with orcaChase config) ---
var Orca = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'orca';
    this.angle = _rand() * 6.28;
    this.vx = 0; this.vy = 0; this.chasing = false;
    this.facingRight = true;
};
Orca.prototype.update = function (sim) {
    var chaseMul = sim._c.orcaChase;

    // Cursor attraction — orca actively chases cursor
    this._chasingCursor = false;
    if (sim.mouse && sim.mouse.x > -9000) {
        var cdx = sim.mouse.x - this.x;
        var cdy = sim.mouse.y - this.y;
        var cdistSq = cdx * cdx + cdy * cdy;
        if (cdistSq < 450 * 450 && cdistSq > 400) {
            this._chasingCursor = true;
            var cdist = Math.sqrt(cdistSq);
            var cursorForce = 0.09 + (1.0 - cdist / 450) * 0.09;
            this.vx += (cdx / cdist) * cursorForce;
            this.vy += (cdy / cdist) * cursorForce;
        }
    }

    // Single-pass: mob detection + closest fish
    var MOB = 250; var MOBsq = MOB*MOB;
    var nearbyFish = 0; var sx = 0, sy = 0;
    var closestFish = null; var closestDist = 999999;
    for (var i = 0; i < sim.entities.fish.length; i++) {
        var f = sim.entities.fish[i];
        var fdx = f.x-this.x; var fdy = f.y-this.y;
        var fd2 = fdx*fdx+fdy*fdy;
        if (fd2 < MOBsq) { nearbyFish++; sx += f.x; sy += f.y; }
        if (fd2 < closestDist) { closestDist = fd2; closestFish = f; }
    }
    if (nearbyFish >= 30) {
        sx /= nearbyFish; sy /= nearbyFish;
        var sdx = sx-this.x; var sdy = sy-this.y;
        var sd = Math.sqrt(sdx*sdx+sdy*sdy);
        if (sd > 0.01) {
            this.vx += (sdx/sd) * 0.08 * chaseMul;
            this.vy += (sdy/sd) * 0.08 * chaseMul;
        }
    }
    var CHASE = 180;
    if (chaseMul > 0.05 && closestFish && closestDist < CHASE*CHASE) {
        this.chasing = true;
        var dist = Math.sqrt(closestDist);
        if (dist > 0.01) {
            this.vx += ((closestFish.x-this.x)/dist) * 0.03 * chaseMul;
            this.vy += ((closestFish.y-this.y)/dist) * 0.03 * chaseMul;
        }
    } else {
        this.chasing = false;
        this.angle += 0.005;
        this.vx += Math.cos(this.angle) * 0.02;
        this.vy += Math.sin(this.angle * 0.7) * 0.01;
    }
    this.vx *= 0.98; this.vy *= 0.98;
    var orcaSpeed = Math.sqrt(this.vx*this.vx+this.vy*this.vy);
    var orcaMax = (this.chasing ? 0.6 : (this._chasingCursor ? 1.0 : 0.4)) * sim._c.orcaSpeed;
    if (orcaSpeed > orcaMax) {
        this.vx = (this.vx/orcaSpeed)*orcaMax;
        this.vy = (this.vy/orcaSpeed)*orcaMax;
    }
    this.x += this.vx; this.y += this.vy;
    if (this.vx >= 0) this.facingRight = false;
    else this.facingRight = true;
    this.rotation = 0;
};

// --- JELLY ---
var Jelly = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'jelly';
    this.sizeVariation = _rand() * 2;
    this.speed = 0.2 + _rand() * 0.2;
    this.wobble = _rand() * 6.28;
    this.direction = (_rand() > 0.5) ? 1 : -1;
    this.vx = 0; this.vy = this.speed * this.direction;
};
Jelly.prototype.update = function (sim) {
    this.y += this.vy;
    this.wobble += 0.04;
    this.x += Math.sin(this.wobble) * 0.4;
    // Wall bounces damp vy (see _bounceBoundaries); ease back to cruising speed
    this.vy += ((this.vy >= 0 ? 1 : -1) * this.speed - this.vy) * 0.05;
};

/* @exports-begin
createSimulation step resize forceSpawnWorm forceSpawnBubble
setRandom random
stressPulse stressLevel stressTint stressShake
SPRITES FISH_PALETTE BUBBLE_COLOR WORM_COLOR
FISH_COUNT JELLY_COUNT ANGLER_COUNT ORCA_COUNT
FISH_SIZE ANGLER_SIZE ORCA_SIZE JELLY_SIZE WORM_SIZE
MAX_BUBBLES MAX_WORMS MAX_BORN_EXTRA
Simulation
@exports-end */

export { createSimulation, step, resize, forceSpawnWorm, forceSpawnBubble, setRandom, random, stressPulse, stressLevel, stressTint, stressShake, SPRITES, FISH_PALETTE, BUBBLE_COLOR, WORM_COLOR, FISH_COUNT, JELLY_COUNT, ANGLER_COUNT, ORCA_COUNT, FISH_SIZE, ANGLER_SIZE, ORCA_SIZE, JELLY_SIZE, WORM_SIZE, MAX_BUBBLES, MAX_WORMS, MAX_BORN_EXTRA, Simulation };
