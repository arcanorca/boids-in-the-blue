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
var SPEED_MAX = 0.75;
var SPEED_MIN = 0.25;
var TURN_FACTOR = 0.06;
var VISUAL_RANGE = 130;
var SEPARATION_DIST = 30;
var EDGE_MARGIN = 140;

// Predator-Prey
var PANIC_RANGE = 140;
var ORCA_PANIC_RANGE = 200;
var FEAR_FACTOR = 1.0;

// Boids Factors
var COHESION_FACTOR = 0.005;
var ALIGNMENT_FACTOR = 0.05;
var SEPARATION_FACTOR = 0.05;
var WANDER_FACTOR = 0.015;

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




// Hard bounce safety net - clamp entities that escape past the screen edge
// Hard bounce safety net - clamp entities that escape past the screen edge
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

function resize(sim, w, h, dpr) {
    if (!sim) return;
    sim.resize(w, h, dpr);
}

function paint(ctx, sim, config) {
    if (!sim) return;
    sim.config = config || sim.config;
    sim.paint(ctx);
}

function spawnWorm(sim, x, y) {
    if (!sim) return;
    sim.entities.worms.push(new Worm(x, y));
    // Spawn bubble burst around the worm splash point
    for (var i = 0; i < 5; i++) {
        if (sim.entities.bubbles.length < 60) {
            sim.entities.bubbles.push(new Bubble(
                x + (Math.random() - 0.5) * 30,
                y + (Math.random() - 0.5) * 20
            ));
        }
    }
}

function spawnBubble(sim, x, y) {
    if (!sim) return;
    // LITE MODE: Disable cursor trail bubbles (heavy draw calls)
    if (sim.config.liteMode === true || sim.config.liteMode === "true") return;

    if (sim.entities.bubbles.length > 50) return;
    sim.entities.bubbles.push(new Bubble(x, y));
}

// --- CLASS: SIMULATION ---

var Simulation = function (width, height, dpr, config) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.config = config || {};
    this.respawnTimer = 0;

    this.fishCount = _cfgNum(this.config, 'fishCount', FISH_COUNT);
    this.jellyCount = _cfgNum(this.config, 'jellyCount', JELLY_COUNT);
    this.anglerCount = _cfgNum(this.config, 'anglerCount', ANGLER_COUNT);
    this.orcaCount = _cfgNum(this.config, 'orcaCount', ORCA_COUNT);

    // Lite Mode Removed

    this.entities = { fish: [], anglers: [], orcas: [], jellies: [], worms: [], bubbles: [] };
    this.totalWormsEaten = 0; // Global counter for baby spawning
    this.init();
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
};

Simulation.prototype.step = function (dt) {
    try {
        // Respawn entities that may have been lost (safety net, every ~4 seconds at 30fps)
        this.respawnTimer++;
        if (this.respawnTimer > 120) {
            this.respawnTimer = 0;
            if (this.entities.fish.length < 10) {
                for (var r = 0; r < 5; r++) this.entities.fish.push(new Fish(Math.random() * this.width, Math.random() * this.height, this));
            }
            if (this.entities.anglers.length < 1) {
                this.entities.anglers.push(new Angler(Math.random() * this.width, Math.random() * this.height, this));
            }
            if (this.entities.orcas.length < 1) {
                this.entities.orcas.push(new Orca(Math.random() * this.width, Math.random() * this.height, this));
            }
        }

        var allLists = [this.entities.worms, this.entities.bubbles, this.entities.fish, this.entities.anglers, this.entities.orcas, this.entities.jellies];
        for (var l = 0; l < allLists.length; l++) {
            var list = allLists[l];
            for (var i = list.length - 1; i >= 0; i--) {
                var ent = list[i];
                try { ent.update(this, dt); } catch (ex) { ent.dead = true; }
                if (ent.dead) {
                    list.splice(i, 1);
                } else if (ent.kind !== 'worm' && ent.kind !== 'bubble') {
                    _bounceBoundaries(this, ent);
                }
            }
        }
    } catch (e) { }
};

Simulation.prototype.paint = function (ctx) {
    if (this.width <= 0) return;

    var topRaw = this.config.waterTop;
    var bottomRaw = this.config.waterBottom;
    if (!topRaw || topRaw === "" || topRaw === "undefined") topRaw = DEFAULT_WATER_TOP;
    if (!bottomRaw || bottomRaw === "" || bottomRaw === "undefined") bottomRaw = DEFAULT_WATER_BOTTOM;

    var grad = ctx.createLinearGradient(0, 0, 0, this.height);
    try {
        grad.addColorStop(0, topRaw.toString());
        grad.addColorStop(1, bottomRaw.toString());
    } catch (e) {
        grad.addColorStop(0, DEFAULT_WATER_TOP);
        grad.addColorStop(1, DEFAULT_WATER_BOTTOM);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    var sim = this;
    [this.entities.bubbles, this.entities.jellies, this.entities.orcas, this.entities.anglers, this.entities.fish, this.entities.worms].forEach(function (list) {
        for (var i = 0; i < list.length; i++) list[i].draw(ctx, sim);
    });
};


// ============================================================
// ENTITIES
// ============================================================

// --- WORM (Click to feed, gentle sinking) ---
var Worm = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'worm';
    this.vy = 0.25; this.life = 1.0; this.wiggle = Math.random() * 6.28;
};
Worm.prototype.update = function (sim) {
    this.y += this.vy;
    this.wiggle += 0.06; // Very slow, zen sway
    this.x += Math.sin(this.wiggle) * 0.3; // Gentle drift
    if (this.y > sim.height - 5) { this.y = sim.height - 5; this.life -= 0.01; }
    if (this.life <= 0) this.dead = true;
};
Worm.prototype.draw = function (ctx, sim) {
    var wormScale = _cfgNum(sim.config, 'wormSize', WORM_SIZE);
    ctx.globalAlpha = this.life;
    drawSprite(ctx, SPRITES.WORM, this.x, this.y, wormScale, false, function () { return WORM_COLOR; });
    ctx.globalAlpha = 1.0;
};

// --- BUBBLE (Click burst + cursor trail) ---
var Bubble = function (x, y) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'bubble';
    this.vy = -(0.2 + Math.random() * 0.5); // Slower float up
    this.wobble = Math.random() * 6.28;
    this.scale = 1.5 + Math.random() * 1.5; // Slightly larger
};
Bubble.prototype.update = function (sim) {
    this.y += this.vy;
    this.wobble += 0.08;
    this.x += Math.sin(this.wobble) * 0.4;
    if (this.y < -10) this.dead = true;
};
Bubble.prototype.draw = function (ctx) {
    drawSprite(ctx, SPRITES.BUBBLE, this.x, this.y, this.scale, false, function () { return BUBBLE_COLOR; });
};


// --- FISH (Full Boids + Predator Fear) ---
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
        this.birthAnim = 0; // Animation frame counter
        this.birthX = x; // Center of the birth ceremony
        this.birthY = y;
    }
};

Fish.prototype.update = function (sim, dt) {
    var c = sim.config;
    var maxSpeed = _cfgNum(c, 'maxSpeed', SPEED_MAX);
    if (sim.speedMultiplier) maxSpeed *= sim.speedMultiplier; // CPU Load Boost

    var minSpeed = _cfgNum(c, 'minSpeed', SPEED_MIN);
    var turn = _cfgNum(c, 'turnFactor', TURN_FACTOR);
    var vRange = _cfgNum(c, 'visualRange', VISUAL_RANGE);
    var cohF = _cfgNum(c, 'cohesionFactor', COHESION_FACTOR);
    var alignF = _cfgNum(c, 'alignmentFactor', ALIGNMENT_FACTOR);
    var sepF = _cfgNum(c, 'separationFactor', SEPARATION_FACTOR);
    var sepDist = _cfgNum(c, 'separationDist', SEPARATION_DIST);
    var wanderF = _cfgNum(c, 'wanderFactor', WANDER_FACTOR);

    var neighbors = 0;
    var xVelAvg = 0, yVelAvg = 0, xPosAvg = 0, yPosAvg = 0;
    var closeDx = 0, closeDy = 0;
    var panic = false;

    // --- BABY BIRTH CEREMONY (Spiral around tribe) ---
    // Shortened to 60 frames (~2 seconds)
    if (this.isBaby && this.birthAnim < 60) {
        this.birthAnim++;
        var age = this.birthAnim;
        // Spiral out: radius increases with time
        var angle = age * 0.25; // Faster spin for shorter duration
        var radius = 10 + age * 0.8; // 10px -> 58px radius faster

        // Target position on the spiral circle
        var tx = this.birthX + Math.cos(angle) * radius;
        var ty = this.birthY + Math.sin(angle) * radius;

        // Steer strongly towards the spiral path
        var dx = tx - this.x; var dy = ty - this.y;
        this.vx += dx * 0.08;
        this.vy += dy * 0.08;

        // Dampen to keep it smooth
        this.vx *= 0.9; this.vy *= 0.9;

        // Facing updates naturally from velocity
        this.x += this.vx; this.y += this.vy;

        // Growth animation: Pop in from tiny size
        // Start at -3.5 (tiny), end at -1.5 (normal baby size)
        this.sizeVariation = -3.5 + (age / 60.0) * 2.0;

        return; // Skip normal behavior during ceremony
    }

    // --- CURSOR AVOIDANCE (Multi-Level) ---
    // Levels: 0=Off, 1=Zen(180px,0.5), 2=Active(350px,2.0), 3=Strong(350px,3.0), 4=Panic(500px,8.0+Scatter)
    var fearLevel = Math.round(_cfgNum(sim.config, 'cursorFearLevel', 1)); // Default to Zen (1)

    if (fearLevel > 0 && sim.mouse && !panic) {
        var range = 180; // Level 1 (Zen)
        var force = 0.40; // Tuned per user request

        if (fearLevel === 2) { range = 350; force = 2.0; } // Active
        if (fearLevel === 3) { range = 350; force = 3.0; } // Strong
        if (fearLevel === 4) { range = 500; force = 8.0; } // Panic

        var mdx = this.x - sim.mouse.x;
        var mdy = this.y - sim.mouse.y;
        var mdistSq = mdx * mdx + mdy * mdy;

        if (mdistSq < range * range) {
            // Level 4: Natural Interaction Override
            if (fearLevel === 4) {
                maxSpeed *= 2.5; // BOOST speed!
                cohF = 0;        // Break the school
                alignF = 0;      // Chaotic scattering
                sepF *= 5.0;     // Strong separation to prevent clumping
            }

            var mdist = Math.sqrt(mdistSq);
            if (mdist > 1) {
                this.vx += (mdx / mdist) * force;
                this.vy += (mdy / mdist) * force;
            }
        }
    }

    // --- PREDATOR FEAR: Flee from Anglers and Orcas ---
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
                this.vx += (pdx / pdist) * FEAR_FACTOR;
                this.vy += (pdy / pdist) * FEAR_FACTOR;
            }
        }
    }

    // --- BOIDS: Cohesion + Alignment + Separation (only when not panicking) ---
    if (!panic) {
        for (var i = 0; i < sim.entities.fish.length; i++) {
            var other = sim.entities.fish[i];
            if (other === this) continue;
            var dx = this.x - other.x; var dy = this.y - other.y;
            if (Math.abs(dx) > vRange || Math.abs(dy) > vRange) continue;
            var distSq = dx * dx + dy * dy;

            if (distSq < vRange * vRange) {
                xVelAvg += other.vx; yVelAvg += other.vy;
                xPosAvg += other.x; yPosAvg += other.y;
                if (distSq < sepDist * sepDist) {
                    closeDx += dx; closeDy += dy;
                }
                neighbors++;
            }
        }
    }

    if (neighbors > 0 && !panic) {
        xVelAvg /= neighbors; yVelAvg /= neighbors;
        xPosAvg /= neighbors; yPosAvg /= neighbors;
        this.vx += (xVelAvg - this.vx) * alignF;
        this.vy += (yVelAvg - this.vy) * alignF;
        this.vx += (xPosAvg - this.x) * cohF;
        this.vy += (yPosAvg - this.y) * cohF;
    }

    this.vx += closeDx * sepF;
    this.vy += closeDy * sepF;

    // --- WORM ATTRACTION ---
    if (!panic && sim.entities.worms.length > 0) {
        var closestDist = 999999; var closestWorm = null;
        for (var i = 0; i < sim.entities.worms.length; i++) {
            var w = sim.entities.worms[i];
            var wdx = w.x - this.x; var wdy = w.y - this.y;
            var wd2 = wdx * wdx + wdy * wdy;
            if (wd2 < closestDist) { closestDist = wd2; closestWorm = w; }
        }
        if (closestWorm && closestDist < 80000) {
            this.vx += (closestWorm.x - this.x) * 0.005; // Stronger pull
            this.vy += (closestWorm.y - this.y) * 0.005;
            if (closestDist < 400) { // Increased hit radius (20px)
                closestWorm.dead = true;
                sim.totalWormsEaten++;

                // Group effort: Every 10 worms eaten globally spawns a baby!
                // Spawn happens near the eater
                if (sim.totalWormsEaten % 10 === 0) {
                    sim.entities.fish.push(new Fish(
                        this.x + (Math.random() - 0.5) * 20,
                        this.y + (Math.random() - 0.5) * 20,
                        sim,
                        true // isBaby!
                    ));
                }
            }
        }
    }

    // --- BABY FISH: Follow nearest adult ---
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

    // --- WANDER (only when calm) ---
    if (!panic) {
        this.wanderTheta += (Math.random() - 0.5) * 0.1;
        this.vx += Math.cos(this.wanderTheta) * wanderF;
        this.vy += Math.sin(this.wanderTheta) * wanderF;
    }

    // --- EDGE STEERING ---
    if (this.x < EDGE_MARGIN) this.vx += turn;
    if (this.x > sim.width - EDGE_MARGIN) this.vx -= turn;
    if (this.y < EDGE_MARGIN) this.vy += turn;
    if (this.y > sim.height - EDGE_MARGIN) this.vy -= turn;

    // --- SPEED LIMIT ---
    this.vx *= 0.99; this.vy *= 0.99;
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

    this.x += this.vx; this.y += this.vy;
};

Fish.prototype.draw = function (ctx, sim) {
    if (this.vx > 0.35) this.facingRight = true;
    else if (this.vx < -0.35) this.facingRight = false;
    var col = this.color;
    var dx = 0, dy = 0;

    // STRESS: Color & Tremble
    if (sim.cpuStress > 0.1) {
        if (sim.cpuStress > 0.05) {
            // Panic Color Logic (Volatile "Ambulance" Effect) - Only at >1.6 stress (175%+)
            if (sim.cpuStress > 1.6) {
                // Smooth Pulse between RED and NAVY BLUE (Safer for epilepsy)
                // Cycle: approx 4 seconds
                var pulse = (Math.sin(Date.now() / 650) + 1) * 0.5; // 0.0 to 1.0
                col = _blendHex("#FF0000", "#000080", pulse);
            } else {
                // Normal Stress Gradient (White -> Red)
                var stressFactor = (sim.cpuStress > 1.0) ? 1.0 : sim.cpuStress;
                col = _blendHex(col, "#FF3333", stressFactor);
            }

            // Tremble (starts at 30%, max 3px shake)
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


// --- ANGLER (Wanders + Fears Orcas) ---
var Angler = function (x, y, sim) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'angler';
    this.vx = (Math.random() - 0.5) * 0.9;
    this.vy = (Math.random() - 0.5) * 0.9;
    this.facingRight = this.vx >= 0;
};

Angler.prototype.update = function (sim, dt) {
    // Fear orcas
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

    // MOB FEAR: If 20+ fish nearby, angler flees from the swarm!
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
        var sdx = this.x - swarmCx; var sdy = this.y - swarmCy;
        var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sdist > 0.01) {
            this.vx += (sdx / sdist) * 0.15; // Gentle flee
            this.vy += (sdy / sdist) * 0.15;
        }
    }

    this.vx *= 0.995; this.vy *= 0.995;
    this.vx += (Math.random() - 0.5) * 0.04;
    this.vy += (Math.random() - 0.5) * 0.04;

    // Edge steering - REMOVED to allow hard bounce
    // if (this.x < EDGE_MARGIN) this.vx += 0.04;
    // if (this.x > sim.width - EDGE_MARGIN) this.vx -= 0.04;
    // if (this.y < EDGE_MARGIN) this.vy += 0.04;
    // if (this.y > sim.height - EDGE_MARGIN) this.vy -= 0.04;

    this.x += this.vx; this.y += this.vy;
};

Angler.prototype.draw = function (ctx, sim) {
    if (this.vx > 0.15) this.facingRight = true;
    else if (this.vx < -0.15) this.facingRight = false;
    var scale = _cfgNum(sim.config, 'anglerSize', ANGLER_SIZE);
    drawSprite(ctx, SPRITES.ANGLER, this.x, this.y, scale, this.facingRight, function (val) {
        return (val === 1) ? '#403359' : (val === 2) ? '#FFFF99' : '#FF3333';
    });
};


// --- ORCA (Patrols + Chases nearby fish) ---
var Orca = function (x, y, sim) {
    this.x = x; this.y = y; this.dead = false; this.kind = 'orca';
    this.angle = Math.random() * 6.28;
    this.vx = 0; this.vy = 0;
    this.chasing = false;
};
Orca.prototype.update = function (sim, dt) {
    // MOB FEAR: If 30+ fish nearby, orca flees!
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
        // Orca is scared of the mob!
        this.chasing = false;
        swarmCx /= nearbyFish; swarmCy /= nearbyFish;
        var sdx = this.x - swarmCx; var sdy = this.y - swarmCy;
        var sdist = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sdist > 0.01) {
            this.vx += (sdx / sdist) * 0.2;
            this.vy += (sdy / sdist) * 0.2;
        }
    } else {
        // Check for nearby fish to chase
        var CHASE_RANGE = 180;
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
                this.vx += ((closestFish.x - this.x) / dist) * 0.03;
                this.vy += ((closestFish.y - this.y) / dist) * 0.03;
            }
        } else {
            this.chasing = false;
            this.angle += 0.005;
            this.vx += Math.cos(this.angle) * 0.02;
            this.vy += Math.sin(this.angle * 0.7) * 0.01;
        }
    }

    // Drag
    this.vx *= 0.98; this.vy *= 0.98;

    // Speed limit for orca (slower than panicking fish)
    var orcaSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    var orcaMax = this.chasing ? 0.6 : 0.4;
    if (orcaSpeed > orcaMax) {
        this.vx = (this.vx / orcaSpeed) * orcaMax;
        this.vy = (this.vy / orcaSpeed) * orcaMax;
    }

    // Edge steering - REMOVED for hard bounce
    // if (this.x < EDGE_MARGIN) this.vx += 0.03;
    // if (this.x > sim.width - EDGE_MARGIN) this.vx -= 0.03;
    // if (this.y < EDGE_MARGIN) this.vy += 0.03;
    // if (this.y > sim.height - EDGE_MARGIN) this.vy -= 0.03;

    this.x += this.vx; this.y += this.vy;
};
Orca.prototype.draw = function (ctx, sim) {
    var scale = _cfgNum(sim.config, 'orcaSize', ORCA_SIZE);
    drawSprite(ctx, SPRITES.ORCA, this.x, this.y, scale, (this.vx >= 0), function (val) {
        return (val === 1) ? '#4D6680' : '#E6E6E6';
    });
};


// --- JELLY (Drifts vertically, wraps) ---
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

    // Dampen excess velocity from bounces (prevent ping-pong effect)
    if (Math.abs(this.vy) > this.speed) {
        this.vy *= 0.95;
    }
    // this.vy used to be overwritten here, preventing bounce. Removed!
    // Wrap removed to allow bounce. 
};
Jelly.prototype.draw = function (ctx, sim) {
    var scale = _cfgNum(sim.config, 'jellySize', JELLY_SIZE) + this.sizeVariation;
    drawSprite(ctx, SPRITES.JELLY, this.x, this.y, scale, false, function () { return 'rgba(200, 180, 255, 0.25)'; });
};


// --- DRAW SPRITE ---
function drawSprite(ctx, grid, x, y, scale, flip, colorFunc) {
    if (x < -50 || x > 4000 || y < -50 || y > 4000) return;
    var iX = Math.floor(x); var iY = Math.floor(y);
    for (var r = 0; r < grid.length; r++) {
        for (var c = 0; c < grid[r].length; c++) {
            var val = grid[r][c];
            if (!val) continue;
            ctx.fillStyle = colorFunc(val);
            var drawC = flip ? c : (grid[r].length - 1 - c);
            ctx.fillRect(iX + (drawC * scale), iY + (r * scale), scale, scale);
        }
    }
}

// --- DRAW SPRITE with 3D rotation (X squeeze) ---
function drawSpriteRotated(ctx, grid, x, y, scale, xSqueeze, opacity, color) {
    if (x < -50 || x > 4000 || y < -50 || y > 4000) return;
    var cols = (grid.length > 0) ? grid[0].length : 0;
    var centerX = x;
    var scaledW = scale * xSqueeze; // Squeeze width for rotation effect
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    for (var r = 0; r < grid.length; r++) {
        for (var c = 0; c < grid[r].length; c++) {
            var val = grid[r][c];
            if (!val) continue;
            var px = centerX + (c - cols / 2) * scaledW;
            var py = y + r * scale;
            ctx.fillRect(Math.floor(px), Math.floor(py), Math.max(1, Math.ceil(scaledW)), scale);
        }
    }
    ctx.globalAlpha = 1.0;
}
