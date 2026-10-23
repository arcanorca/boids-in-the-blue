.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "pixel" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled PixelSprite delegates (the classic adapter, boids.js, is untouched).
// Same call shape as Boids.sync(sim, parent, component). Per tick and entity it only writes
// properties whose value changed, so a delegate re-evaluates only when it must.
//
// Calm-wallpaper rules: positions are not snapped to the art grid; each tick writes the new target and
// the layer's shared tween glides the sprite there (EntityLayer.beginTick, PixelSprite x/y, whole screen
// pixels). Animation is derived from sim state with no timers: tail beat from speed (capped, about 4
// frames/s at most), jelly bell pulse and worm wiggle from slow private phases, angler lure flicker from a
// per-delegate tick counter. The stress flush picks pre-coloured variants.

var Z = 1e9;                                       // z band size (layer order, see theme.js kinds[].layer)
var TAU = 6.2831853;

function sync(sim, parent, component) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component); } catch (e) { Boids._report('pixel sync', e); }
}

function _sync(sim, parent, component) {
    var cc = sim._c, stress = sim.cpuStress, cell = component.cell;
    component.beginTick();
    var now = Boids._now();
    var pulse = Core.stressPulse(stress, now);
    var sf = Core.stressLevel(stress);
    var hot = stress > 1.2, warm = stress > 0.25;
    var trem = stress > 0.5 ? Math.min(1, (stress - 0.5) * 2) * cell : 0;      // tremble: up to 1 texel, smooth
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
                dg = component.createObject(parent, { size: size, type: kd.type, spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = kd.layer * Z + dg.z;
                dg.phase = (ent.x * 7.31 + ent.y * 3.17) % 4;      // desynchronise the beat of a school
                if (kind === 'fish') dg.variant = T.fishVariant(ent.color);
                component.place(dg, ent.x, ent.y);                 // no glide from a stale pooled position
            } else {
                component.target(dg, ent.x, ent.y);
            }
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
                if (warm) {
                    // colour -> red in 4 clean steps (see theme.js); above 1.2 red + a crimson overlay pulse
                    var base = hot ? "red" : T.fishStressVariant(ent.color, Math.round(sf * 4)), ta = hot ? pulse : 0;
                    if (dg.variant !== base) dg.variant = base;
                    if (dg.tintOpacity !== ta) dg.tintOpacity = ta;
                    var sx = 0, sy = 0;
                    if (trem > 0) {
                        var tp = now / 1000 * TAU * 3 + dg.phase * 2.1;
                        sx = Math.round(Math.sin(tp) * trem); sy = Math.round(Math.cos(tp * 0.8) * trem * 0.6);
                    }
                    if (dg.shakeX !== sx) dg.shakeX = sx;
                    if (dg.shakeY !== sy) dg.shakeY = sy;
                } else {
                    var v = T.fishVariant(ent.color);
                    if (dg.variant !== v) dg.variant = v;
                    if (dg.tintOpacity !== 0) dg.tintOpacity = 0;
                    if (dg.shakeX !== 0) dg.shakeX = 0;
                    if (dg.shakeY !== 0) dg.shakeY = 0;
                }
                // newborns fade in as they spiral out (birthAnim runs 0..60) with a star above the head
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    var bo = 0.35 + 0.65 * ent.birthAnim / 60;
                    if (dg.opacity !== bo) dg.opacity = bo;
                    var sp = 1 + ((ent.birthAnim / 12 | 0) & 1);
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else {
                    if (dg.opacity !== 1) dg.opacity = 1;
                    if (dg.sparkle !== 0) dg.sparkle = 0;
                }
            } else if (kind === 'angler') {
                // lure flicker: two incommensurate sines -> 0 dim, 1 lit, 2 flare
                dg.tick++;
                var t = dg.tick * A.lureRate + dg.phase * 3.3, f = Math.sin(t) + 0.6 * Math.sin(t * 1.7 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                if (dg.lure !== lv) dg.lure = lv;
                var g = lv === 2 ? 0.62 : (lv === 1 ? 0.42 : 0.26);
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
