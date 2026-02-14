.pragma library

// --- DEFAULTS ---
var FISH_COUNT = 38;
var JELLY_COUNT = 5;
var ANGLER_COUNT = 3;
var ORCA_COUNT = 3;

var FISH_SIZE = 4.0;
var ANGLER_SIZE = 4.0;
var ORCA_SIZE = 5.5;
var JELLY_SIZE = 2.5;
var WORM_SIZE = 4;

// Speed
// V3.0: Boosted Base Speed
var SPEED_MAX = 0.45; // Was 0.30
var SPEED_MIN = 0.15; // Was 0.10


var TURN_FACTOR = 0.015;
var VISUAL_RANGE = 220;
var SEPARATION_DIST = 70;
var EDGE_MARGIN = 100;

// Predator-Prey
var PANIC_RANGE = 120;
var ORCA_PANIC_RANGE = 180;
var FEAR_FACTOR = 0.15; // Extra soft avoidance

// Boids Factors (Micro-Tuned for 25Hz - V3.0 Re-Calibration)
var COHESION_FACTOR = 0.0010; // Was 0.0006
var ALIGNMENT_FACTOR = 0.004; // Was 0.003
var SEPARATION_FACTOR = 0.025; // Boosted
var WANDER_FACTOR = 0.012; // Doubled (Need more roaming!)





var FISH_PALETTE = ['#FF8080', '#FFB34D', '#E6E666', '#4DCCE6', '#CC99E6'];
var BUBBLE_COLOR = "rgba(200, 230, 255, 0.4)";
var WORM_COLOR = "#FF9999";

var DEFAULT_WATER_TOP = "#021a30";
var DEFAULT_WATER_BOTTOM = "#000510";

// --- SPRITES ---
var SPRITES = {
    FISH: [[0, 0, 0, 1, 1, 0, 0], [0, 1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 2, 0], [1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0]],
    ANGLER: [[0, 0, 0, 0, 0, 0, 2, 2, 0, 0], [0, 0, 0, 0, 0, 0, 1, 1, 0, 0], [0, 0, 0, 1, 1, 1, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 1, 1, 3, 3, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 1, 1, 1, 1, 0, 0, 0], [0, 0, 1, 0, 0, 1, 0, 0, 0, 0]],
    ORCA: [[0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0], [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 2, 2, 2, 1, 0, 1, 0, 1], [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]],
    JELLY: [[0, 1, 1, 1, 0], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [2, 0, 2, 0, 2], [2, 0, 2, 0, 2], [0, 0, 2, 0, 0]],
    WORM: [[1, 0], [0, 1], [1, 0], [0, 1]],
    BUBBLE: [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
};

// --- UTILS ---
function _cfgNum(cfg, name, def) {
    if (cfg && cfg[name] !== undefined) return Number(cfg[name]);
    return def;
}

// Blend hex colors: c1, c2, factor (0..1)
function _blendHex(c1, c2, f) {
    if (f <= 0) return c1;
    if (f >= 1) return c2;
    var r1 = parseInt(c1.substring(1, 3), 16);
    var g1 = parseInt(c1.substring(3, 5), 16);
    var b1 = parseInt(c1.substring(5, 7), 16);
    var r2 = parseInt(c2.substring(1, 3), 16);
    var g2 = parseInt(c2.substring(3, 5), 16);
    var b2 = parseInt(c2.substring(5, 7), 16);
    var r = Math.round(r1 + (r2 - r1) * f);
    var g = Math.round(g1 + (g2 - g1) * f);
    var b = Math.round(b1 + (b2 - b1) * f);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Draw Sprite (Optimized Batching)
function drawSprite(ctx, sprite, x, y, size, flip, colorFunc) {
    var rows = sprite.length;
    var cols = sprite[0].length;
    // Bleed to prevent gaps between pixels (Increased to 0.4 for solid look)
    var w = size + 0.4;
    var h = size + 0.4;

    // Identify unique values (colors) in the sprite first?
    // Optimization: Most sprites have few colors. We can just iterate the matrix map.
    // However, to batch, we must call beginPath() -> rects -> fill() per color.
    // Hardcoded max values for our sprites (1, 2, 3).

    // Pass 1: Value 1
    ctx.beginPath();
    var has1 = false;
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            if (sprite[i][j] === 1) {
                var px = x + (flip ? (cols - 1 - j) : j) * size;
                var py = y + i * size;
                ctx.rect(px, py, w, h);
                has1 = true;
            }
        }
    }
    if (has1) {
        ctx.fillStyle = colorFunc(1);
        ctx.fill();
    }

    // Pass 2: Value 2 (if present in sprite type)
    // Optimization: Check if sprite *has* 2s before looping? 
    // Actually, just looping is fast in JS. Draw calls are the bottleneck.
    ctx.beginPath();
    var has2 = false;
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            if (sprite[i][j] === 2) {
                var px = x + (flip ? (cols - 1 - j) : j) * size;
                var py = y + i * size;
                ctx.rect(px, py, w, h);
                has2 = true;
            }
        }
    }
    if (has2) {
        ctx.fillStyle = colorFunc(2);
        ctx.fill();
    }

    // Pass 3: Value 3 (Angler Mouth)
    ctx.beginPath();
    var has3 = false;
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            if (sprite[i][j] === 3) {
                var px = x + (flip ? (cols - 1 - j) : j) * size;
                var py = y + i * size;
                ctx.rect(px, py, w, h);
                has3 = true;
            }
        }
    }
    if (has3) {
        ctx.fillStyle = colorFunc(3);
        ctx.fill();
    }
}

// Hard bounce safety net
function _bounceBoundaries(sim, ent) {
    if (ent.x < 0) { ent.x = 5; ent.vx = Math.abs(ent.vx) + 0.5; }
    if (ent.x > sim.width) { ent.x = sim.width - 5; ent.vx = -(Math.abs(ent.vx) + 0.5); }
    if (ent.y < 0) { ent.y = 5; ent.vy = Math.abs(ent.vy) + 0.5; }
    if (ent.y > sim.height) { ent.y = sim.height - 5; ent.vy = -(Math.abs(ent.vy) + 0.5); }
}

// --- API FUNCTIONS ---

function createSimulation(width, height, dpr, config) {
    return new Simulation(width, height, dpr, config);
}

function step(sim, dt, config) {
    if (!sim) return;
    sim.config = config || sim.config;
    sim.step(dt);
}

function updateMouse(sim, x, y) {
    if (sim && sim.updateMouse) {
        sim.updateMouse(x, y);
    }
}



function resize(sim, w, h, dpr) {
    if (!sim) return;
    sim.resize(w, h, dpr);
}

function paint(ctx, sim, config) {
    // Deprecated
}

function sync(sim, parent, component) {
    if (!sim) return;
    sim.sync(parent, component);
}

// --- FORCE INPUT FUNCTIONS (Nuclear Option) ---
function forceSpawnWorm(sim, x, y) {
    if (!sim) return;
    // DIRECT INJECTION
    sim.entities.worms.push(new Worm(x, y));
    // Spawn burst of bubbles
    for (var i = 0; i < 8; i++) {
        sim.entities.bubbles.push(new Bubble(
            x + (Math.random() - 0.5) * 40,
            y + (Math.random() - 0.5) * 30
        ));
    }
}

function forceSpawnBubble(sim, x, y) {
    if (!sim) return;
    // NO CHECKS - JUST SPAWN
    sim.entities.bubbles.push(new Bubble(x, y));
}

function forceRepulse(sim, x, y) {
    if (!sim) return;
    sim.mouse.x = x;
    sim.mouse.y = y;
}

function spawnWorm(sim, x, y) {
    forceSpawnWorm(sim, x, y); // Redirect to force
}

function spawnBubble(sim, x, y) {
    if (!sim) return;
    if (sim.config.liteMode === true || sim.config.liteMode === "true") return;
    if (sim.entities.bubbles.length > 100) return;
    sim.entities.bubbles.push(new Bubble(x, y));
}


// --- SPATIAL GRID ---
var SpatialGrid = function (width, height, cellSize) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows);
    for (var i = 0; i < this.cells.length; i++) {
        this.cells[i] = [];
    }
};

SpatialGrid.prototype.clear = function () {
    for (var i = 0; i < this.cells.length; i++) {
        this.cells[i].length = 0;
    }
};

SpatialGrid.prototype.insert = function (ent) {
    var c = Math.floor(ent.x / this.cellSize);
    var r = Math.floor(ent.y / this.cellSize);
    // Clamp to be safe
    if (c < 0) c = 0; else if (c >= this.cols) c = this.cols - 1;
    if (r < 0) r = 0; else if (r >= this.rows) r = this.rows - 1;
    this.cells[r * this.cols + c].push(ent);
};

// --- CLASS: SIMULATION ---

var Simulation = function (width, height, dpr, config) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.config = config || {};
    this.respawnTimer = 0;

    // Stress properties
    this.cpuStress = 0.0;
    this.speedMultiplier = 1.0;
    this.mouse = { x: -2000, y: -2000 }; // Far away initial

    this.fishCount = _cfgNum(this.config, 'fishCount', FISH_COUNT);
    this.jellyCount = _cfgNum(this.config, 'jellyCount', JELLY_COUNT);
    this.anglerCount = _cfgNum(this.config, 'anglerCount', ANGLER_COUNT);
    this.orcaCount = _cfgNum(this.config, 'orcaCount', ORCA_COUNT);

    this.entities = { fish: [], anglers: [], orcas: [], jellies: [], worms: [], bubbles: [] };

    // CACHE LIST FOR STEP LOOP (No GC)
    this.allLists = [this.entities.worms, this.entities.bubbles, this.entities.fish, this.entities.anglers, this.entities.orcas, this.entities.jellies];

    this.totalWormsEaten = 0;

    this.grid = new SpatialGrid(width, height, 150);

    this.init();
};

Simulation.prototype.updateMouse = function (x, y) {
    if (this.mouse) {
        this.mouse.x = x;
        this.mouse.y = y;
    }
};


Simulation.prototype.init = function () {
    for (var i = 0; i < this.fishCount; i++) this.entities.fish.push(new Fish(Math.random() * this.width, Math.random() * this.height, this));
    for (var i = 0; i < this.anglerCount; i++) this.entities.anglers.push(new Angler(Math.random() * this.width, Math.random() * this.height, this));
    for (var i = 0; i < this.orcaCount; i++) this.entities.orcas.push(new Orca(Math.random() * this.width, Math.random() * this.height, this));
    var jSize = _cfgNum(this.config, 'jellySize', JELLY_SIZE);
    for (var i = 0; i < this.jellyCount; i++) this.entities.jellies.push(new Jelly(Math.random() * this.width, Math.random() * this.height, jSize));
};

Simulation.prototype.resize = function (w, h, dpr) {
    this.width = w; this.height = h; this.dpr = dpr;
    this.grid = new SpatialGrid(w, h, 150);
};

Simulation.prototype.step = function (dt) {
    try {
        // Instant Population Adjustment
        var targetFish = _cfgNum(this.config, 'fishCount', FISH_COUNT);
        while (this.entities.fish.length < targetFish) this.entities.fish.push(new Fish(Math.random() * this.width, Math.random() * this.height, this));
        while (this.entities.fish.length > targetFish) this.entities.fish.pop().dead = true;

        var targetAnglers = _cfgNum(this.config, 'anglerCount', ANGLER_COUNT);
        while (this.entities.anglers.length < targetAnglers) this.entities.anglers.push(new Angler(Math.random() * this.width, Math.random() * this.height, this));
        while (this.entities.anglers.length > targetAnglers) this.entities.anglers.pop().dead = true;

        var targetOrcas = _cfgNum(this.config, 'orcaCount', ORCA_COUNT);
        while (this.entities.orcas.length < targetOrcas) this.entities.orcas.push(new Orca(Math.random() * this.width, Math.random() * this.height, this));
        while (this.entities.orcas.length > targetOrcas) this.entities.orcas.pop().dead = true;

        var targetJellies = _cfgNum(this.config, 'jellyCount', JELLY_COUNT);
        var jSize = _cfgNum(this.config, 'jellySize', JELLY_SIZE);
        while (this.entities.jellies.length < targetJellies) this.entities.jellies.push(new Jelly(Math.random() * this.width, Math.random() * this.height, jSize));
        while (this.entities.jellies.length > targetJellies) this.entities.jellies.pop().dead = true;

        this.grid.clear();
        for (var i = 0; i < this.entities.fish.length; i++) {
            this.grid.insert(this.entities.fish[i]);
        }

        // USE CACHED LIST (Zero Allocation)
        var allLists = this.allLists;
        for (var l = 0; l < allLists.length; l++) {
            var list = allLists[l];
            for (var i = list.length - 1; i >= 0; i--) {
                var ent = list[i];
                try { ent.update(this, dt); } catch (ex) { ent.dead = true; }
                if (ent.dead) {
                    // If delegate exists, destroy it
                    if (ent.delegate) {
                        ent.delegate.destroy();
                        ent.delegate = null;
                    }
                    list.splice(i, 1);
                } else if (ent.kind !== 'worm' && ent.kind !== 'bubble') {
                    _bounceBoundaries(this, ent);
                }
            }
        }
    } catch (e) { }
};

Simulation.prototype.sync = function (parent, component) {
    if (this.width <= 0) return;

    try {
        // Iterate all entities
        var allLists = this.allLists;
        for (var l = 0; l < allLists.length; l++) {
            var list = allLists[l];
            for (var i = 0; i < list.length; i++) {
                var ent = list[i];

                // Create Delegate if missing
                if (!ent.delegate) {
                    var props = {
                        x: ent.x,
                        y: ent.y,
                        size: 1.0,
                        type: 0,
                        spriteData: [],
                        colorString: "#FFFFFF",
                        rotation: 0
                    };

                    // Map Entity Type to Props
                    if (ent.kind === 'fish') {
                        props.type = 1;
                        props.spriteData = SPRITES.FISH;
                        props.colorString = ent.color || "#FFFFFF";
                        props.size = _cfgNum(this.config, 'fishSize', FISH_SIZE) + ent.sizeVariation;
                    } else if (ent.kind === 'orca') {
                        props.type = 3;
                        props.spriteData = SPRITES.ORCA;
                        props.size = _cfgNum(this.config, 'orcaSize', ORCA_SIZE);
                        props.colorString = "#4D6680"; // Correct Orca Tint
                    } else if (ent.kind === 'angler') {
                        props.type = 4;
                        props.spriteData = SPRITES.ANGLER;
                        props.size = _cfgNum(this.config, 'anglerSize', ANGLER_SIZE);
                        props.colorString = "#403359";
                    } else if (ent.kind === 'jelly') {
                        props.type = 2;
                        props.spriteData = SPRITES.JELLY;
                        props.size = _cfgNum(this.config, 'jellySize', JELLY_SIZE) + ent.sizeVariation;
                        props.colorString = "rgba(204, 179, 255, 0.3)";
                    } else if (ent.kind === 'bubble') {
                        props.type = 5;
                        props.spriteData = SPRITES.BUBBLE;
                        props.size = ent.scale;
                        props.colorString = BUBBLE_COLOR;
                    } else if (ent.kind === 'worm') {
                        props.type = 6;
                        props.spriteData = SPRITES.WORM;
                        props.size = _cfgNum(this.config, 'wormSize', WORM_SIZE);
                        props.colorString = WORM_COLOR;
                    }

                    ent.delegate = component.createObject(parent, props);

                    if (ent.delegate === null) {
                        // console.log("Error creating object for " + ent.kind);
                    }
                }

                // Update Delegate
                if (ent.delegate) {
                    ent.delegate.x = ent.x;
                    ent.delegate.y = ent.y;

                    // INSTANT SIZE UPDATE
                    if (ent.kind === 'fish') {
                        ent.delegate.size = _cfgNum(this.config, 'fishSize', FISH_SIZE) + ent.sizeVariation;
                    } else if (ent.kind === 'orca') {
                        ent.delegate.size = _cfgNum(this.config, 'orcaSize', ORCA_SIZE);
                    } else if (ent.kind === 'angler') {
                        ent.delegate.size = _cfgNum(this.config, 'anglerSize', ANGLER_SIZE);
                    } else if (ent.kind === 'jelly') {
                        ent.delegate.size = _cfgNum(this.config, 'jellySize', JELLY_SIZE) + ent.sizeVariation;
                    } else if (ent.kind === 'worm') {
                        ent.delegate.size = _cfgNum(this.config, 'wormSize', WORM_SIZE);
                    }

                    // Side-View Logic: No Rotation, Just Flip
                    if (ent.kind === 'fish' || ent.kind === 'angler' || ent.kind === 'orca') {
                        ent.delegate.flip = !ent.facingRight;
                        ent.delegate.rotation = 0; // Force Zero Rotation
                    }


                    // Specific updates
                    if (ent.kind === 'fish') {
                        // Stress color update (Lower threshold to 0.01)
                        if (this.cpuStress > 0.01) {
                            var col = ent.color;
                            if (this.cpuStress > 1.2) { // Pulse at very high stress
                                var pulse = (Math.sin(Date.now() / 300) + 1) * 0.5;
                                col = _blendHex("#FF0000", "#000080", pulse);
                            } else {
                                // Linear blend from Normal to Red
                                // Boost stressFactor for visibility at low levels
                                var visualStress = Math.min(1.0, this.cpuStress * 2.0);
                                col = _blendHex(ent.color, "#FF0000", visualStress); // Pure Red target
                            }
                            ent.delegate.colorString = col;

                            // Tremble (Lower threshold to 0.1)
                            if (this.cpuStress > 0.1) {
                                var shake = ((this.cpuStress - 0.1) * 4.0) + 1.0;
                                ent.delegate.x += (Math.random() - 0.5) * shake;
                                ent.delegate.y += (Math.random() - 0.5) * shake;
                            }
                        } else {
                            // Reset color if no stress
                            if (ent.delegate.colorString !== ent.color) ent.delegate.colorString = ent.color;
                        }
                    }

                    // Worm alpha
                    if (ent.kind === 'worm') {
                        ent.delegate.opacity = ent.life;
                    }
                }
            }
        }
    } catch (e) {
        // console.log("SYNC ERROR: " + e);
    }
};

// ============================================================
// ENTITIES
// ============================================================

var Worm = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'worm';
    this.vy = 0.25; this.life = 1.0; this.wiggle = Math.random() * 6.28;
};
Worm.prototype.update = function (sim, dt) {
    var d = (dt === undefined) ? 1.0 : dt;
    this.y += this.vy * d;
    this.wiggle += 0.06 * d;
    this.rotation = 0;
    if (this.y > sim.height - 5) { this.y = sim.height - 5; this.life -= 0.01 * d; }
    if (this.life <= 0) this.dead = true;
};
Worm.prototype.draw = function (ctx, sim) {
    var wormScale = _cfgNum(sim.config, 'wormSize', WORM_SIZE);
    ctx.globalAlpha = this.life;
    drawSprite(ctx, SPRITES.WORM, this.x, this.y, wormScale, false, function () { return WORM_COLOR; });
    ctx.globalAlpha = 1.0;
};

var Bubble = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'bubble';
    this.vy = -(0.2 + Math.random() * 0.5);
    this.wobble = Math.random() * 6.28;
    this.scale = 1.5 + Math.random() * 1.5;
};
Bubble.prototype.update = function (sim, dt) {
    var d = (dt === undefined) ? 1.0 : dt;
    this.y += this.vy * d;
    this.wobble += 0.08 * d;
    this.x += Math.sin(this.wobble) * 0.4 * d;
    if (this.y < -10) this.dead = true;
};
Bubble.prototype.draw = function (ctx) {
    drawSprite(ctx, SPRITES.BUBBLE, this.x, this.y, this.scale, false, function () { return BUBBLE_COLOR; });
};

var Fish = function (x, y, sim, isBaby) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'fish';
    this.vx = (Math.random() - 0.5);
    this.vy = (Math.random() - 0.5);
    this.color = FISH_PALETTE[Math.floor(Math.random() * FISH_PALETTE.length)];
    this.isBaby = isBaby || false;
    this.sizeVariation = this.isBaby ? -1.5 : (Math.random() * 2 - 1);
    this.personality = this.isBaby ? (1.1 + Math.random() * 0.3) : (0.8 + Math.random() * 0.4);
    this.wanderTheta = Math.random() * Math.PI * 2;
    this.facingRight = this.vx >= 0;
    if (this.isBaby) {
        this.birthAnim = 0;
        this.birthX = x;
        this.birthY = y;
    }
};

Fish.prototype.update = function (sim, dt) {
    var c = sim.config;
    // V3.0: Hard Bind - Always read fresh from config
    var maxSpeed = (c && c.fishMaxSpeed !== undefined) ? Number(c.fishMaxSpeed) : SPEED_MAX;
    // Apply stress multiplier
    if (sim.speedMultiplier) maxSpeed *= sim.speedMultiplier;



    // Visual Polish: Normalize speed for large dt (prevent teleporting)
    if (dt > 2.5) dt = 2.5;

    var minSpeed = _cfgNum(c, 'fishMinSpeed', SPEED_MIN);
    var turnThreshold = _cfgNum(c, 'turnThreshold', 0.20);
    var turn = _cfgNum(c, 'turnFactor', TURN_FACTOR);
    var vRange = _cfgNum(c, 'visualRange', VISUAL_RANGE);
    var cohF = _cfgNum(c, 'cohesionFactor', COHESION_FACTOR);
    var alignF = _cfgNum(c, 'alignmentFactor', ALIGNMENT_FACTOR);
    var sepF = _cfgNum(c, 'separationFactor', SEPARATION_FACTOR);
    var sepDist = _cfgNum(c, 'separationDist', SEPARATION_DIST);
    var wanderF = _cfgNum(c, 'wanderFactor', WANDER_FACTOR);

    // Forces scaled by dt (Normalization)
    var aF = alignF * dt;
    var cF = cohF * dt;
    var sF = sepF * dt;
    var wF = wanderF * dt;
    var tF = turn * dt;


    var neighbors = 0;
    var xVelAvg = 0, yVelAvg = 0, xPosAvg = 0, yPosAvg = 0;
    var closeDx = 0, closeDy = 0;
    var panic = false;

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

    var fearLevel = Math.round(_cfgNum(sim.config, 'cursorFearLevel', 1));
    // V3.5: Force Fear Level 1 (Flee) if undefined, ensuring cursor interaction
    if (fearLevel === undefined) fearLevel = 1;

    if (fearLevel > 0 && sim.mouse && !panic) {
        var range = 180;
        var force = 0.60; // V3.5: Stronger base repulsion

        if (fearLevel === 2) { range = 350; force = 2.0; }
        if (fearLevel === 3) { range = 350; force = 3.0; }
        if (fearLevel === 4) { range = 500; force = 8.0; }

        var mdx = this.x - sim.mouse.x;
        var mdy = this.y - sim.mouse.y;


        var mdistSq = mdx * mdx + mdy * mdy;

        if (mdistSq < range * range) {
            if (fearLevel === 4) {
                maxSpeed *= 2.5;
                cohF = 0;
                alignF = 0;
                sepF *= 5.0;
            }
            var mdist = Math.sqrt(mdistSq);
            if (mdist > 1) {
                this.vx += (mdx / mdist) * force * dt;
                this.vy += (mdy / mdist) * force * dt;
            }
        }
    }

    var predators = sim.entities.anglers.concat(sim.entities.orcas);
    for (var p = 0; p < predators.length; p++) {
        var pred = predators[p];
        var pdx = this.x - pred.x; var pdy = this.y - pred.y;
        var rangeSq = (pred.kind === 'orca') ? (ORCA_PANIC_RANGE * ORCA_PANIC_RANGE) : (PANIC_RANGE * PANIC_RANGE);
        var pdistSq = pdx * pdx + pdy * pdy;

        if (pdistSq < rangeSq) {
            panic = true;
            var pdist = Math.sqrt(pdistSq);
            if (pdist > 0.01) {
                this.vx += (pdx / pdist) * FEAR_FACTOR * dt;
                this.vy += (pdy / pdist) * FEAR_FACTOR * dt;
            }
        }
    }

    if (true) {
        var grid = sim.grid;
        var cellCol = Math.floor(this.x / grid.cellSize);
        var cellRow = Math.floor(this.y / grid.cellSize);
        var vRangeSq = vRange * vRange;
        var sepDistSq = sepDist * sepDist;

        var startC = Math.max(0, cellCol - 1);
        var endC = Math.min(grid.cols - 1, cellCol + 1);
        var startR = Math.max(0, cellRow - 1);
        var endR = Math.min(grid.rows - 1, cellRow + 1);
        var neighborsChecked = 0;

        for (var r = startR; r <= endR; r++) {
            for (var c = startC; c <= endC; c++) {
                var cell = grid.cells[r * grid.cols + c];
                for (var k = 0; k < cell.length; k++) {
                    var other = cell[k];
                    if (other === this) continue;
                    var dx = this.x - other.x;
                    var dy = this.y - other.y;
                    if (Math.abs(dx) > vRange || Math.abs(dy) > vRange) continue;
                    var distSq = dx * dx + dy * dy;

                    if (distSq < vRangeSq) {
                        xVelAvg += other.vx; yVelAvg += other.vy;
                        xPosAvg += other.x; yPosAvg += other.y;
                        if (distSq < sepDistSq) {
                            closeDx += dx; closeDy += dy;
                        }
                        neighbors++;
                        if (neighbors >= 10) break;
                    }
                }
                if (neighbors >= 10) break;
            }
            if (neighbors >= 10) break;
        }
    }

    if (neighbors > 0) {
        xVelAvg /= neighbors; yVelAvg /= neighbors;
        xPosAvg /= neighbors; yPosAvg /= neighbors;
        this.vx += (xVelAvg - this.vx) * aF;
        this.vy += (yVelAvg - this.vy) * aF;
        this.vx += (xPosAvg - this.x) * cF;
        this.vy += (yPosAvg - this.y) * cF;
    }

    this.vx += closeDx * sF;
    this.vy += closeDy * sF;

    if (!panic && sim.entities.worms.length > 0) {
        var closestDist = 999999; var closestWorm = null;
        for (var i = 0; i < sim.entities.worms.length; i++) {
            var w = sim.entities.worms[i];
            var wdx = w.x - this.x; var wdy = w.y - this.y;
            var wd2 = wdx * wdx + wdy * wdy;
            if (wd2 < closestDist) { closestDist = wd2; closestWorm = w; }
        }
        if (closestWorm && closestDist < 120000) { // Increased range (Zen distance)
            // Gentle but responsive attraction
            var adt = (dt === undefined) ? 1.0 : dt;
            this.vx += (closestWorm.x - this.x) * 0.002 * adt;
            this.vy += (closestWorm.y - this.y) * 0.002 * adt;
            if (closestDist < 1200) { // Eating radius (~35px)
                closestWorm.dead = true;
                sim.totalWormsEaten++;
                if (sim.totalWormsEaten % 10 === 0) {
                    sim.entities.fish.push(new Fish(
                        this.x + (Math.random() - 0.5) * 20,
                        this.y + (Math.random() - 0.5) * 20,
                        sim,
                        true
                    ));
                }
            }
        }
    }



    if (this.isBaby && !panic) {
        var nearestAdult = null; var nearestAdultDist = 999999;
        for (var i = 0; i < sim.entities.fish.length; i++) {
            var a = sim.entities.fish[i];
            if (a === this || a.isBaby) continue;
            var adx = a.x - this.x; var ady = a.y - this.y;
            var ad2 = adx * adx + ady * ady;
            if (ad2 < nearestAdultDist) { nearestAdultDist = ad2; nearestAdult = a; }
        }
        if (nearestAdult && nearestAdultDist < 250 * 250) {
            this.vx += (nearestAdult.x - this.x) * 0.008;
            this.vy += (nearestAdult.y - this.y) * 0.008;
        }
    }

    if (!panic) {
        this.wanderTheta += (Math.random() - 0.5) * 0.1;
        this.vx += Math.cos(this.wanderTheta) * wanderF;
        this.vy += Math.sin(this.wanderTheta) * wanderF;
    }

    if (this.x < EDGE_MARGIN) this.vx += turn;
    if (this.x > sim.width - EDGE_MARGIN) this.vx -= turn;
    if (this.y < EDGE_MARGIN) this.vy += turn;
    if (this.y > sim.height - EDGE_MARGIN) this.vy -= turn;

    this.vx *= 0.99; this.vy *= 0.99; // V3.0: Relaxed Friction (Was 0.98)

    var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    var curMax = panic ? maxSpeed * 1.6 : maxSpeed * this.personality;
    var curMin = minSpeed * this.personality;

    if (speed > curMax) {
        this.vx = (this.vx / speed) * curMax;
        this.vy = (this.vy / speed) * curMax;
    } else if (speed < curMin && speed > 0.01) {
        this.vx = (this.vx / speed) * (speed + 0.015);
        this.vy = (this.vy / speed) * (speed + 0.015);
    }

    // TIME-STEP INTEGRATION
    // TIME-STEP INTEGRATION
    var d = (dt === undefined) ? 1.0 : dt;
    if (d > 12.0) d = 12.0; // Allow 8Hz (dt ~7.5)
    this.x += this.vx * d; this.y += this.vy * d;

    // UX Polish: Weighted Harmonic Facing (Fix "Outlier" visual bug)
    // If aligning strongly, face the flock direction even if drifting backwards.
    // V2.9: Reduced weight to 0.5 to prevent "Hive Mind" robotic turning.
    var visualX = this.vx + (xVelAvg - this.vx) * 0.5;


    // V3.5: "Sticky" Directional Latching (Re-Applied)
    // Lowered to 0.1 to prevent "Drifting/Stuck" at low speeds.
    var latchThreshold = 0.1;

    if (this.facingRight) {
        if (visualX < -latchThreshold) this.facingRight = false;
    } else {
        if (visualX > latchThreshold) this.facingRight = true;
    }


    this.rotation = 0;

};

Fish.prototype.draw = function (ctx, sim) {
    // Deprecated? No, Fish.sync uses props, but this method is vestigial or used by paint?
    // We removed paint call. We can leave this or ignore it.
    // We removed paint call. We can leave this or ignore it.
    // Use facingRight from update() logic
    // if (this.vx > 0.35) this.facingRight = true;
    // else if (this.vx < -0.35) this.facingRight = false;
    var col = this.color;
    var dx = 0, dy = 0;

    if (sim.cpuStress > 0.1) {
        if (sim.cpuStress > 0.05) {
            if (sim.cpuStress > 1.6) {
                var pulse = (Math.sin(Date.now() / 650) + 1) * 0.5;
                col = _blendHex("#FF0000", "#000080", pulse);
            } else {
                var stressFactor = (sim.cpuStress > 1.0) ? 1.0 : sim.cpuStress;
                col = _blendHex(col, "#FF3333", stressFactor);
            }
            if (sim.cpuStress > 0.3) {
                var shake = (sim.cpuStress - 0.3) * 3.0;
                dx = (Math.random() - 0.5) * shake;
                dy = (Math.random() - 0.5) * shake;
            }
        }
    }

    var scale = _cfgNum(sim.config, 'fishSize', FISH_SIZE) + this.sizeVariation;
    drawSprite(ctx, SPRITES.FISH, this.x + dx, this.y + dy, scale, this.facingRight, function (val) {
        return (val === 1) ? col : '#FFF';
    });
};

var Angler = function (x, y, sim) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'angler';
    this.vx = (Math.random() - 0.5) * 0.9;
    this.vy = (Math.random() - 0.5) * 0.9;
    this.facingRight = this.vx >= 0;
};

Angler.prototype.update = function (sim, dt) {
    for (var i = 0; i < sim.entities.orcas.length; i++) {
        var orca = sim.entities.orcas[i];
        var dx = this.x - orca.x; var dy = this.y - orca.y;
        var distSq = dx * dx + dy * dy;
        if (distSq < ORCA_PANIC_RANGE * ORCA_PANIC_RANGE) {
            var dist = Math.sqrt(distSq);
            if (dist > 0.01) {
                this.vx += (dx / dist) * 0.5;
                this.vy += (dy / dist) * 0.5;
            }
        }
    }

    var MOB_RANGE_A = 200;
    var nearbyFish = 0;
    var swarmCx = 0, swarmCy = 0;
    for (var i = 0; i < sim.entities.fish.length; i++) {
        var f = sim.entities.fish[i];
        var fdx = f.x - this.x; var fdy = f.y - this.y;
        if (fdx * fdx + fdy * fdy < MOB_RANGE_A * MOB_RANGE_A) {
            nearbyFish++;
            swarmCx += f.x; swarmCy += f.y;
        }
    }
    if (nearbyFish >= 20) {
        swarmCx /= nearbyFish; swarmCy /= nearbyFish;
        var sdx = swarmCx - this.x; var sdy = swarmCy - this.y;
        var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sdist > 0.01) {
            this.vx += (sdx / sdist) * 0.08;
            this.vy += (sdy / sdist) * 0.08;
        }
    } else {
        var CHASE_RANGE_A = 120;
        var closestFish = null;
        var closestDist = 999999;
        for (var i = 0; i < sim.entities.fish.length; i++) {
            var f = sim.entities.fish[i];
            var dx = f.x - this.x; var dy = f.y - this.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < closestDist) { closestDist = d2; closestFish = f; }
        }

        if (closestFish && closestDist < CHASE_RANGE_A * CHASE_RANGE_A) {
            var dist = Math.sqrt(closestDist);
            if (dist > 0.01) {
                this.vx += ((closestFish.x - this.x) / dist) * 0.02;
                this.vy += ((closestFish.y - this.y) / dist) * 0.02;
            }
        }
    }

    this.vx *= 0.995; this.vy *= 0.995;
    this.vx += (Math.random() - 0.5) * 0.04;
    this.vy += (Math.random() - 0.5) * 0.04;

    // Apply Angler Speed Multiplier
    var aSpeed = _cfgNum(sim.config, 'anglerSpeed', 1.0);
    this.vx *= aSpeed; this.vy *= aSpeed;

    var d = (dt === undefined) ? 1.0 : dt;
    if (d > 2.5) d = 2.5;
    this.x += this.vx * d; this.y += this.vy * d;
    // Side-View: Snap Flip with Hysteresis (Dynamic Deadzone)
    var tThreshold = _cfgNum(sim.config, 'turnThreshold', 0.20);
    if (this.vx > tThreshold) this.facingRight = true;
    else if (this.vx < -tThreshold) this.facingRight = false;
    this.rotation = 0;
};

Angler.prototype.draw = function (ctx, sim) {
    // Use update() hysteresis logic
    // if (this.vx > 0.15) this.facingRight = true;
    // else if (this.vx < -0.15) this.facingRight = false;
    var scale = _cfgNum(sim.config, 'anglerSize', ANGLER_SIZE);
    drawSprite(ctx, SPRITES.ANGLER, this.x, this.y, scale, this.facingRight, function (val) {
        return (val === 1) ? '#403359' : (val === 2) ? '#FFFF99' : '#FF3333';
    });
};

var Orca = function (x, y, sim) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'orca';
    this.angle = Math.random() * 6.28;
    this.vx = 0; this.vy = 0;
    this.chasing = false;
};
Orca.prototype.update = function (sim, dt) {
    var MOB_RANGE_O = 250;
    var nearbyFish = 0;
    var swarmCx = 0, swarmCy = 0;
    for (var i = 0; i < sim.entities.fish.length; i++) {
        var f = sim.entities.fish[i];
        var fdx = f.x - this.x; var fdy = f.y - this.y;
        if (fdx * fdx + fdy * fdy < MOB_RANGE_O * MOB_RANGE_O) {
            nearbyFish++;
            swarmCx += f.x; swarmCy += f.y;
        }
    }

    if (nearbyFish >= 30) {
        swarmCx /= nearbyFish; swarmCy /= nearbyFish;
        var sdx = swarmCx - this.x; var sdy = swarmCy - this.y;
        var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sdist > 0.01) {
            this.vx += (sdx / sdist) * 0.12;
            this.vy += (sdy / sdist) * 0.12;
        }
    }

    var CHASE_RANGE = 130;
    var closestFish = null;
    var closestDist = 999999;
    for (var i = 0; i < sim.entities.fish.length; i++) {
        var f = sim.entities.fish[i];
        var dx = f.x - this.x; var dy = f.y - this.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < closestDist) { closestDist = d2; closestFish = f; }
    }

    if (closestFish && closestDist < CHASE_RANGE * CHASE_RANGE) {
        this.chasing = true;
        var dist = Math.sqrt(closestDist);
        if (dist > 0.01) {
            this.vx += ((closestFish.x - this.x) / dist) * 0.05;
            this.vy += ((closestFish.y - this.y) / dist) * 0.05;
        }
    } else {
        this.chasing = false;
        this.angle += 0.005;
        this.vx += Math.cos(this.angle) * 0.02;
        this.vy += Math.sin(this.angle * 0.7) * 0.01;
    }

    this.vx *= 0.98; this.vy *= 0.98;

    var orcaSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    var orcaMax = (this.chasing ? 0.6 : 0.4) * _cfgNum(sim.config, 'orcaSpeed', 0.7);
    this.vx = (this.vx / orcaSpeed) * orcaMax;
    this.vy = (this.vy / orcaSpeed) * orcaMax;

    var d = (dt === undefined) ? 1.0 : dt;
    if (d > 2.5) d = 2.5;
    this.x += this.vx * d; this.y += this.vy * d;
    // Side-View: Snap Flip with Hysteresis (Dynamic Deadzone)
    var tThreshold = _cfgNum(sim.config, 'turnThreshold', 0.20);
    if (this.vx > tThreshold) this.facingRight = false; // Inverted for Orca
    else if (this.vx < -tThreshold) this.facingRight = true;
    this.rotation = 0;
};
Orca.prototype.draw = function (ctx, sim) {
    var scale = _cfgNum(sim.config, 'orcaSize', ORCA_SIZE);
    drawSprite(ctx, SPRITES.ORCA, this.x, this.y, scale, this.facingRight, function (val) {
        return (val === 1) ? '#4D6680' : '#E6E6E6';
    });
};

var Jelly = function (x, y, size) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'jelly';
    this.sizeVariation = Math.random() * 2;
    this.speed = 0.2 + Math.random() * 0.2;
    this.wobble = Math.random() * 6.28;
    this.direction = (Math.random() > 0.5) ? 1 : -1;
    this.vx = 0; this.vy = this.speed * this.direction;
};
Jelly.prototype.update = function (sim) {
    this.y += this.vy;
    this.wobble += 0.04;
    this.x += Math.sin(this.wobble) * 0.4;

    if (Math.abs(this.vy) > this.speed) {
        this.vy *= 0.95;
    }
};
Jelly.prototype.draw = function (ctx, sim) {
    var scale = _cfgNum(sim.config, 'jellySize', JELLY_SIZE) + this.sizeVariation;
    // Match Gnome Port: Single transparent pass (RGBA 0.8, 0.7, 1.0, 0.3)
    ctx.fillStyle = "rgba(204, 179, 255, 0.3)";
    ctx.beginPath();

    var sprite = SPRITES.JELLY;
    var rows = sprite.length;
    var cols = sprite[0].length;

    // Bleed for Jelly too (Solid look)
    var w = scale + 0.4;
    var h = scale + 0.4;

    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            if (sprite[r][c] > 0) {
                var px = this.x + c * scale;
                var py = this.y + r * scale;
                // Use rect to add to path, float coords
                ctx.rect(px, py, w, h);
            }
        }
    }
    ctx.fill();
};
