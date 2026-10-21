.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "amiga" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled AmigaSprite delegates. Same call shape as Boids.sync(sim, parent, component).
// Per tick and entity it only writes properties whose value changed.
//
// Calm-wallpaper rules: positions are NOT snapped to the art grid; each tick writes the new target and
// the layer's shared tween glides the sprite there (EntityLayer.beginTick, AmigaSprite x/y). Animation
// frames advance from private phase accumulators at <= 3 frames/s (theme.js anim); lure and stress
// effects are slow (<= 1 Hz) and touch only the affected sprites; the stress "palette swap" picks
// pre-coloured variants.

var Z = 1e9;                                       // z band size (layer order, see theme.js kinds[].layer)
var TAU = 6.2831853;

function sync(sim, parent, component) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component); } catch (e) { Boids._report('amiga sync', e); }
}

function _sync(sim, parent, component) {
    var cc = sim._c, stress = sim.cpuStress, cell = component.cell;
    var t0 = component.t;                          // tween progress of the tick that is ending
    component.beginTick();
    var now = Boids._now();
    var sf = stress > 0.25 ? Core.stressLevel(stress) : 0;     // (stressLevel() of a calm sim is not 0)
    var hot = stress > 1.2, warm = stress > 0.25;
    var lvl = Math.round(sf * T.STRESS_STEPS);
    var trem = stress > 0.5 ? Math.min(1, (stress - 0.5) * 2) * cell : 0;      // tremble: up to 1 art pixel, smooth
    var step = hot ? 1 : Math.round(sf * 4) / 4;      // backdrop palette swap (faded in slowly by Backdrop.qml)
    if (component.stressStep !== step) component.stressStep = step;
    var K = T.kinds, A = T.anim;
    var lists = sim.allLists;
    for (var l = 0; l < lists.length; l++) {
        var list = lists[l];
        for (var i = 0; i < list.length; i++) {
            var ent = list[i], kind = ent.kind, kd = K[kind], size;
            if (!kd) continue;
            if (kind === 'fish') size = cc.fishSize + ent.sizeVariation;
            else if (kind === 'orca') size = cc.orcaSize;
            else if (kind === 'angler') size = cc.anglerSize;
            else if (kind === 'jelly') size = cc.jellySize + ent.sizeVariation;
            else if (kind === 'bubble') size = ent.scale;
            else size = cc.wormSize;

            var tx = ent.x, ty = ent.y;
            var dg = ent.delegate;
            if (!dg) {
                dg = component.createObject(parent, { ax0: tx, ay0: ty, ax1: tx, ay1: ty, size: size, type: kd.type,
                                                      spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = kd.layer * Z + dg.z;
                dg.phase = (ent.x * 7.31 + ent.y * 3.17) % 4;      // desynchronise the beat of a school
                if (kind === 'fish') dg.variant = T.fishVariant(ent.color);
            }
            var shx = 0, shy = 0;
            if (kind === 'fish' && trem > 0 && warm) {
                var tp = now / 1000 * TAU * A.shakeHz + dg.phase * 2.1;
                shx = Math.sin(tp) * trem; shy = Math.cos(tp * 0.8) * trem * 0.6;
            }
            tx += shx; ty += shy;
            var cx = dg.ax0 + (dg.ax1 - dg.ax0) * t0, cy = dg.ay0 + (dg.ay1 - dg.ay0) * t0;
            if (Math.abs(tx - cx) > 160 || Math.abs(ty - cy) > 160) { cx = tx; cy = ty; }      // teleport: no streak
            dg.ax0 = cx; dg.ay0 = cy; dg.ax1 = tx; dg.ay1 = ty;
            var cls = kd.classes.length > 1 ? T.classFor(kind, size) : 0;
            if (dg.cls !== cls) dg.cls = cls;

            var fr, a;
            if (kind === 'fish' || kind === 'angler' || kind === 'orca') {
                var flip = !ent.facingRight;
                if (dg.flip !== flip) dg.flip = flip;
                var spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
                a = A[kind];
                dg.phase += Math.min(a.max, a.base + spd * a.perSpeed);
                fr = Math.floor(dg.phase) & 3;
                if (dg.frame !== fr) dg.frame = fr;
            }
            if (kind === 'fish') {
                var v;
                if (warm) {
                    if (hot) v = ((Math.floor(now / (500 / A.stressHz) + dg.phase * 0.25) & 1) ? "alarm" : "red");
                    else v = T.fishStressVariant(ent.color, lvl);
                } else v = T.fishVariant(ent.color);
                if (dg.variant !== v) dg.variant = v;
                // newborns spiral out small (birthAnim runs 0..60): a star above the head, two slow positions
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    var sp = 1 + ((ent.birthAnim / 12 | 0) & 1);
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else if (dg.sparkle !== 0) dg.sparkle = 0;
            } else if (kind === 'angler') {
                dg.tick++;
                var t = dg.tick * A.lure.rate + dg.phase * 3.3, f = Math.sin(t) + 0.6 * Math.sin(t * 1.7 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                if (dg.lure !== lv) dg.lure = lv;
                var g = lv === 2 ? 1 : (lv === 1 ? 0.75 : 0.5);
                if (dg.glow !== g) dg.glow = g;
            } else if (kind === 'jelly') {
                dg.phase += A.jelly.base;
                fr = Math.floor(dg.phase) & 3;
                if (dg.frame !== fr) dg.frame = fr;
            } else if (kind === 'worm') {
                dg.phase += A.worm.base;
                fr = Math.floor(dg.phase) & 3;
                if (dg.frame !== fr) dg.frame = fr;
                var op = Math.min(1, ent.life * 4);           // a settled worm fades out smoothly
                if (dg.opacity !== op) dg.opacity = op;
            }
        }
    }
}
