.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "amiga" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled AmigaSprite delegates. Same call shape as Boids.sync(sim, parent, component).
// Per tick and entity it only writes properties whose value changed.
//
// Chipset-flavoured rules: sprites sit on the virtual pixel grid (positions snapped to whole
// virtual pixels, so slow fish advance in 1-pixel steps like Amiga sprites); animation is chosen
// frame by frame from sim state (no tweens); the stress "palette swap" picks pre-coloured
// variants; the alarm (stress > 1.2) flips affected fish between two palettes at ~1.25 Hz.

var Z = 1e9;                                       // z band size (layer order, see theme.js kinds[].layer)
var SNAP = true;                                   // false: smooth sub-grid motion (breaks the pixel grid)

function sync(sim, parent, component) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component); } catch (e) { Boids._report('amiga sync', e); }
}

function _sync(sim, parent, component) {
    var cc = sim._c, stress = sim.cpuStress, cell = component.cell;
    var now = Boids._now();
    var sf = Core.stressLevel(stress);
    var hot = stress > 1.2, warm = stress > 0.25;
    var lvl = Math.round(sf * T.STRESS_STEPS);
    var shakeAmp = stress > 0.5 ? Math.min(1.2, (stress - 0.5) * 1.6) : 0;
    var step = hot ? 1 : Math.round(sf * 4) / 4;      // backdrop palette swap (copper list fade, in quarter steps)
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

            var dg = ent.delegate;
            if (!dg) {
                dg = component.createObject(parent, { x: Math.round(ent.x), y: Math.round(ent.y), size: size, type: kd.type,
                                                      spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = kd.layer * Z + dg.z;
                dg.animate = false;
                dg.phase = (ent.x * 7.31 + ent.y * 3.17) % 4;      // desynchronise the beat of a school
                if (kind === 'fish') dg.variant = T.fishVariant(ent.color);
            }
            var px = SNAP ? Math.round(ent.x / cell) * cell : Math.round(ent.x);
            var py = SNAP ? Math.round(ent.y / cell) * cell : Math.round(ent.y);
            if (dg.x !== px) dg.x = px;
            if (dg.y !== py) dg.y = py;
            var cls = kd.classes.length > 1 ? T.classFor(kind, size) : 0;
            if (dg.cls !== cls) dg.cls = cls;

            var fr;
            if (kind === 'fish' || kind === 'angler' || kind === 'orca') {
                var flip = !ent.facingRight;
                if (dg.flip !== flip) dg.flip = flip;
                var spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy), a = A[kind];
                dg.phase += a.base + spd * a.perSpeed;
                fr = Math.floor(dg.phase) & 3;
                if (dg.frame !== fr) dg.frame = fr;
            }
            if (kind === 'fish') {
                if (warm) {
                    var v;
                    if (hot) v = ((Math.floor(now / 400 + dg.phase * 0.25) & 1) ? "alarm" : "red");
                    else v = T.fishStressVariant(ent.color, lvl);
                    if (dg.variant !== v) dg.variant = v;
                    var sx = 0, sy = 0;
                    if (shakeAmp > 0) { sx = Math.round((Core.random() - 0.5) * 2 * shakeAmp); sy = Math.round((Core.random() - 0.5) * 2 * shakeAmp); }
                    if (dg.shakeX !== sx) dg.shakeX = sx;
                    if (dg.shakeY !== sy) dg.shakeY = sy;
                } else {
                    var v0 = T.fishVariant(ent.color);
                    if (dg.variant !== v0) dg.variant = v0;
                    if (dg.shakeX !== 0) dg.shakeX = 0;
                    if (dg.shakeY !== 0) dg.shakeY = 0;
                }
                // newborns spiral out small (birthAnim runs 0..60); sparkle instead of a fade (no alpha on the chipset)
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    dg.tick++;
                    var sp = 1 + ((dg.tick >> 1) & 1);
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else if (dg.sparkle !== 0) dg.sparkle = 0;
            } else if (kind === 'angler') {
                dg.tick++;
                var t = dg.tick * 0.18 + dg.phase * 3.3, f = Math.sin(t) + 0.6 * Math.sin(t * 2.7 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                if (dg.lure !== lv) dg.lure = lv;
                var g = lv === 2 ? 1 : (lv === 1 ? 0.8 : 0.5);
                if (dg.glow !== g) dg.glow = g;
            } else if (kind === 'jelly') {
                fr = Math.floor(ent.wobble * A.jellyRate / 1.5708) & 3;
                if (dg.frame !== fr) dg.frame = fr;
            } else if (kind === 'worm') {
                fr = Math.floor(ent.wiggle / A.wormRate) & 3;
                if (dg.frame !== fr) dg.frame = fr;
                // no alpha on the chipset: a dying worm blinks out instead of fading
                var vis = ent.life > 0.25 || (Math.floor(now / 120) & 1) === 0;
                if (dg.opacity !== (vis ? 1 : 0)) dg.opacity = vis ? 1 : 0;
            }
        }
    }
}
