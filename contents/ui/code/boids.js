.pragma library
.import "boids-core.js" as Core

// KDE adapter: the simulation lives in boids-core.js (generated from
// core/boids-core.js). This file only owns the QML delegates and exposes the
// API main.qml uses: createSimulation, step, resize, sync, forceSpawnWorm,
// forceSpawnBubble (+ optional setRandom/setClock for deterministic tests).

var SPRITES = Core.SPRITES;
var BUBBLE_COLOR = Core.BUBBLE_COLOR;
var WORM_COLOR = Core.WORM_COLOR;

var _clock = null;
function _now() { return _clock ? _clock() : Date.now(); }
function setClock(fn) { _clock = (typeof fn === 'function') ? fn : null; }
function setRandom(fn) { Core.setRandom(fn); }

// Log each distinct error once instead of swallowing it silently
var _seenErrors = {};
function _report(where, e) {
    var key = where + ': ' + (e && e.message ? e.message : e);
    if (_seenErrors[key]) return;
    _seenErrors[key] = true;
    console.warn('[boids] ' + key + (e && e.lineNumber ? ' (line ' + e.lineNumber + ')' : ''));
}

// Core reports every entity it removes (dead, trimmed, non-finite); free its delegate
function _releaseDelegate(ent) {
    var d = ent.delegate;
    if (d) {
        // pooled sprites (EntityLayer) are recycled; anything else is destroyed
        if (typeof d.release === 'function') d.release(); else d.destroy();
        ent.delegate = null;
    }
}

// --- API ---
function createSimulation(w, h, dpr, cfg) {
    var sim = Core.createSimulation(w, h, dpr, cfg);
    sim.onRemove = _releaseDelegate;
    return sim;
}
function step(sim, dt, cfg) { if (!sim) return; Core.step(sim, dt, cfg); }
function resize(sim, w, h, dpr) { if (!sim) return; Core.resize(sim, w, h, dpr); }
function sync(sim, parent, component) { if (!sim) return; _syncSim(sim, parent, component); }
function forceSpawnWorm(sim, x, y) { Core.forceSpawnWorm(sim, x, y); }
function forceSpawnBubble(sim, x, y) { Core.forceSpawnBubble(sim, x, y); }

function _syncSim(sim, parent, component) {
    if (sim.width <= 0) return;
    try {
        var cc = sim._c;
        var allLists = sim.allLists;
        var stress = sim.cpuStress;
        var pulse = Core.stressPulse(stress, _now());
        var sf = Core.stressLevel(stress);
        for (var l = 0; l < allLists.length; l++) {
            var list = allLists[l];
            for (var i = 0; i < list.length; i++) {
                var ent = list[i];

                if (!ent.delegate) {
                    var props = { x: ent.x, y: ent.y, size: 1.0, type: 0,
                                  spriteData: [], colorString: "#FFFFFF", rotation: 0 };

                    if (ent.kind === 'fish') {
                        props.type = 1; props.spriteData = SPRITES.FISH;
                        props.colorString = ent.color || "#FFFFFF";
                        props.size = cc.fishSize + ent.sizeVariation;
                    } else if (ent.kind === 'orca') {
                        props.type = 3; props.spriteData = SPRITES.ORCA;
                        props.size = cc.orcaSize;
                        props.colorString = "#4D6680";
                    } else if (ent.kind === 'angler') {
                        props.type = 4; props.spriteData = SPRITES.ANGLER;
                        props.size = cc.anglerSize;
                        props.colorString = "#403359";
                    } else if (ent.kind === 'jelly') {
                        props.type = 2; props.spriteData = SPRITES.JELLY;
                        props.size = cc.jellySize + ent.sizeVariation;
                        props.colorString = "#8B7BB5";
                    } else if (ent.kind === 'bubble') {
                        props.type = 5; props.spriteData = SPRITES.BUBBLE;
                        props.size = ent.scale; props.colorString = BUBBLE_COLOR;
                    } else if (ent.kind === 'worm') {
                        props.type = 6; props.spriteData = SPRITES.WORM;
                        props.size = cc.wormSize;
                        props.colorString = WORM_COLOR;
                    }

                    ent.delegate = component.createObject(parent, props);
                }

                if (ent.delegate) {
                    var dg = ent.delegate;
                    dg.x = ent.x;
                    dg.y = ent.y;

                    if (ent.kind === 'fish') {
                        dg.size = cc.fishSize + ent.sizeVariation;
                    } else if (ent.kind === 'orca') {
                        dg.size = cc.orcaSize;
                    } else if (ent.kind === 'angler') {
                        dg.size = cc.anglerSize;
                    } else if (ent.kind === 'jelly') {
                        dg.size = cc.jellySize + ent.sizeVariation;
                    } else if (ent.kind === 'worm') {
                        dg.size = cc.wormSize;
                    }

                    if (ent.kind === 'fish' || ent.kind === 'angler' || ent.kind === 'orca') {
                        var flip = !ent.facingRight;
                        if (dg.flip !== flip) dg.flip = flip;
                        if (dg.rotation !== 0) dg.rotation = 0;
                    }

                    if (ent.kind === 'fish') {
                        if (stress > 0.25) {
                            // Quantised so the sprite is only repainted when the colour visibly changes
                            var col = Core.stressTint(ent.color, stress, pulse, sf);
                            if (dg.colorString !== col) dg.colorString = col;
                            // same colour as a layer-1 overlay: base + tint at alpha == the blend
                            // (stress > 1.2: red -> navy by pulse; else base -> #FF3333 by sf)
                            var hot = stress > 1.2;
                            var tc = hot ? "#000080" : "#FF3333", ta = hot ? pulse : sf;
                            var bc = hot ? "#FF0000" : ent.color;
                            if (dg.baseColor !== bc) dg.baseColor = bc;
                            if (dg.tintColor !== tc) dg.tintColor = tc;
                            if (dg.tintAlpha !== ta) dg.tintAlpha = ta;
                            if (stress > 0.5) {
                                var shake = Core.stressShake(stress);
                                dg.shakeX = (Core.random() - 0.5) * shake;
                                dg.shakeY = (Core.random() - 0.5) * shake;
                            } else {
                                if (dg.shakeX !== 0) dg.shakeX = 0;
                                if (dg.shakeY !== 0) dg.shakeY = 0;
                            }
                        } else {
                            if (dg.colorString !== ent.color) dg.colorString = ent.color;
                            if (dg.baseColor !== ent.color) dg.baseColor = ent.color;
                            if (dg.tintAlpha !== 0) dg.tintAlpha = 0;
                            if (dg.shakeX !== 0) dg.shakeX = 0;
                            if (dg.shakeY !== 0) dg.shakeY = 0;
                        }
                    }

                    if (ent.kind === 'worm') {
                        dg.opacity = ent.life;
                    }
                    if (ent.kind === 'jelly') {
                        dg.opacity = 0.25;
                    }
                }
            }
        }
    } catch (e) { _report('sync', e); }
}
