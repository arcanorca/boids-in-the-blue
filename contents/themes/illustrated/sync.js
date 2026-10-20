.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "theme.js" as Theme

// Writes the simulation state (read only) to the illustrated sprites. The counterpart of
// ui/code/boids.js:sync() for this theme. Entity identity for the pseudo-depth is the order in
// which delegates are created (stable for an entity's whole life; never touches the sim).

var _n = 0;
var _seen = {};
function _report(e) {
    var key = String(e && e.message ? e.message : e);
    if (_seen[key]) return;
    _seen[key] = true;
    console.warn("[boids/illustrated] " + key + (e && e.lineNumber ? " (line " + e.lineNumber + ")" : ""));
}

function _create(layer, kind, ent, size, extra) {
    var props = { kind: kind, type: Theme.KINDS[kind].type, size: size,
                  depth: Theme.depthFor(kind, ++_n), x: ent.x, y: ent.y };
    for (var k in extra) props[k] = extra[k];
    return layer.createObject(layer, props);
}

// pitch (deg) of the motion direction relative to the facing direction, clamped and smoothed
function _tilt(d, ent, faceRight, maxDeg) {
    var vx = Math.abs(ent.vx), t = 0;
    if (maxDeg > 0) {
        t = Math.atan2(ent.vy, Math.max(vx, 0.25)) * 57.29578;
        t = (faceRight ? 1 : -1) * Math.max(-maxDeg, Math.min(maxDeg, t));
    }
    var cur = d.tiltS;
    cur += (t - cur) * 0.12;
    d.tiltS = cur;
    var q = Math.round(cur * 0.7) / 0.7;       // ~1.4 degree steps: avoids re-rasterising on every tick
    if (d.rotation !== q) d.rotation = q;
}

function sync(sim, layer, nowMs) {
    if (sim.width <= 0) return;
    try {
        var cc = sim._c, stress = sim.cpuStress;
        var pulse = Core.stressPulse(stress, nowMs);
        var sf = Core.stressLevel(stress);
        var lists = sim.allLists;
        for (var l = 0; l < lists.length; l++) {
            var list = lists[l];
            for (var i = 0; i < list.length; i++) {
                var ent = list[i], d = ent.delegate, kind = ent.kind;
                if (!d) {
                    if (kind === "fish") d = _create(layer, kind, ent, cc.fishSize + ent.sizeVariation, { colorKey: Theme.fishKey(ent.color), baseKey: Theme.fishKey(ent.color) });
                    else if (kind === "orca") d = _create(layer, kind, ent, cc.orcaSize, {});
                    else if (kind === "angler") d = _create(layer, kind, ent, cc.anglerSize, {});
                    else if (kind === "jelly") d = _create(layer, kind, ent, cc.jellySize + ent.sizeVariation, {});
                    else if (kind === "bubble") d = _create(layer, kind, ent, ent.scale, {});
                    else if (kind === "worm") d = _create(layer, kind, ent, cc.wormSize, {});
                    ent.delegate = d;
                    if (!d) continue;
                }
                d.x = ent.x;
                d.y = ent.y;

                if (kind === "fish") {
                    var sz = cc.fishSize + ent.sizeVariation;
                    if (d.size !== sz) d.size = sz;
                    var fr = ent.facingRight;
                    if (d.mirror === fr) d.mirror = !fr;           // art faces right
                    _tilt(d, ent, fr, 16);

                    var halo = 0, haloKey = "white";
                    if (stress > 0.25) {
                        var hot = stress > 1.2;
                        var base = hot ? "hot" : d.colorKey, over = hot ? "alarm" : "hot", ta = hot ? pulse : sf;
                        if (d.baseKey !== base) d.baseKey = base;
                        if (d.overKey !== over) d.overKey = over;
                        if (d.tintAlpha !== ta) d.tintAlpha = ta;
                        if (hot) { halo = 0.25 + 0.5 * pulse; haloKey = "red"; }
                        if (stress > 0.5) {
                            var shake = Core.stressShake(stress);
                            d.shakeX = (Core.random() - 0.5) * shake;
                            d.shakeY = (Core.random() - 0.5) * shake;
                        } else {
                            if (d.shakeX !== 0) d.shakeX = 0;
                            if (d.shakeY !== 0) d.shakeY = 0;
                        }
                    } else {
                        if (d.baseKey !== d.colorKey) d.baseKey = d.colorKey;
                        if (d.tintAlpha !== 0) d.tintAlpha = 0;
                        if (d.shakeX !== 0) d.shakeX = 0;
                        if (d.shakeY !== 0) d.shakeY = 0;
                    }
                    if (halo === 0 && ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                        halo = 0.9 * (1 - ent.birthAnim / 60) + 0.1;     // soft glow while the baby grows into the school
                    }
                    if (d.haloAlpha !== halo) d.haloAlpha = halo;
                    if (halo > 0 && d.haloKey !== haloKey) d.haloKey = haloKey;
                } else if (kind === "orca") {
                    if (d.size !== cc.orcaSize) d.size = cc.orcaSize;
                    var om = ent.facingRight;                      // orca: facingRight is inverted in the sim
                    if (d.mirror !== om) d.mirror = om;
                    _tilt(d, ent, !om, 7);
                } else if (kind === "angler") {
                    if (d.size !== cc.anglerSize) d.size = cc.anglerSize;
                    var am = !ent.facingRight;
                    if (d.mirror !== am) d.mirror = am;
                    _tilt(d, ent, !am, 8);
                    d.glowAlpha = 0.62 + 0.3 * Math.sin(nowMs / 650 + d.depth * 40);
                } else if (kind === "jelly") {
                    var js = cc.jellySize + ent.sizeVariation;
                    if (d.size !== js) d.size = js;
                    d.phase = ent.wobble;
                    if (d.opacity !== 0.88) d.opacity = 0.88;
                } else if (kind === "worm") {
                    if (d.size !== cc.wormSize) d.size = cc.wormSize;
                    d.opacity = ent.life;
                    d.rotation = Math.round(Math.sin(ent.wiggle) * 14);
                } else if (kind === "bubble") {
                    if (d.size !== ent.scale) d.size = ent.scale;
                }
            }
        }
    } catch (e) { _report(e); }
}
