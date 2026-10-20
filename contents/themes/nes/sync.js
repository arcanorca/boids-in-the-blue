.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "nes" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled NesSprite delegates. Same call shape as Boids.sync(sim, parent, component),
// plus `px` (screen pixels per virtual pixel). Per tick and entity it only writes properties whose
// value changed.
//
// Positions are not snapped to the virtual grid: the delegate animates its position over one sim tick
// and draws on whole screen pixels. Animation is 2 frames per creature, derived from sim state (no
// timers): tail beat from speed, jelly pulse from the sim's wobble phase, worm wiggle from its wiggle
// phase, angler lure level from a per-delegate tick counter.
//
// Stress: each fish has a fixed individual threshold; as stress rises more fish get the red
// sprite palette (a palette swap: only the OAM attribute changes), those fish also shake by whole
// virtual pixels. Above 1.2 the alarm palette cycles between two states (palette cycling, 1.25 Hz,
// those sprites only).

var Z = 1e9;                                       // z band size (layer order, see theme.js kinds[].layer)

function sync(sim, parent, component, px) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component, px || 4); } catch (e) { Boids._report('nes sync', e); }
}

function _sync(sim, parent, component, px) {
    var stress = sim.cpuStress;
    var hot = stress > 1.2;
    var frac = stress > 0.25 ? Math.min(1, (stress - 0.25) / 0.95) : 0;      // share of fish gone red
    var alarm = hot ? (Math.floor(Boids._now() / T.ALARM_PERIOD_MS) & 1) : 0;
    var shake = Core.stressShake(stress);
    var K = T.kinds, A = T.anim;
    var lists = sim.allLists;
    for (var l = 0; l < lists.length; l++) {
        var list = lists[l];
        for (var i = 0; i < list.length; i++) {
            var ent = list[i], kind = ent.kind, kd = K[kind];
            if (!kd) continue;

            var dg = ent.delegate, fresh = false;
            if (!dg) {
                dg = component.createObject(parent, { type: kd.type, spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = kd.layer * Z + dg.z;
                dg.phase = (ent.x * 7.31 + ent.y * 3.17) % 4;      // desynchronise the beat of a school
                if (kind === 'fish') dg.thr = (ent.wanderTheta / 6.2831853) % 1;
                fresh = true;
            }
            var cls = 'm';
            if (kind === 'fish') cls = T.fishClass(ent);
            else if (kind === 'bubble') cls = T.bubbleClass(ent.scale);
            if (dg.cls !== cls) dg.cls = cls;

            // top-left corner of the metasprite box, screen px, centred on the simulation position
            var d = T.dims(kind, cls);
            var tx = ent.x - d.w * px / 2, ty = ent.y - d.h * px / 2;
            if (fresh) { dg.animate = false; dg.ax = tx; dg.ay = ty; dg.animate = true; }   // placed, not glided
            else {
                if (dg.ax !== tx) dg.ax = tx;
                if (dg.ay !== ty) dg.ay = ty;
            }

            var fr;
            if (kind === 'fish' || kind === 'angler' || kind === 'orca') {
                var flip = !ent.facingRight;
                if (dg.flip !== flip) dg.flip = flip;
                var spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy), a = A[kind];
                dg.phase += a.base + spd * a.perSpeed;
                fr = Math.floor(dg.phase) & 1;
                if (dg.frame !== fr) dg.frame = fr;
            }
            if (kind === 'fish') {
                dg.tick++;
                var affected = frac > 0 && dg.thr < frac;
                var v = affected ? (alarm ? 'alarm-b' : 'alarm-a') : T.fishVariant(ent.color);
                if (dg.variant !== v) dg.variant = v;
                var shx = 0, shy = 0;
                if (affected && stress > 0.5) {
                    if (dg.tick % 3 === 0) {                       // jitter at ~8 Hz, in whole virtual pixels
                        shx = Math.round((Core.random() - 0.5) * (1 + shake));
                        shy = Math.round((Core.random() - 0.5) * (1 + shake));
                    } else { shx = dg.shakeX; shy = dg.shakeY; }
                }
                if (dg.shakeX !== shx) dg.shakeX = shx;
                if (dg.shakeY !== shy) dg.shakeY = shy;
                // newborns twinkle above the head while they spiral out (birthAnim runs 0..60)
                var sp = 0;
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) sp = 1 + ((dg.tick >> 3) & 1);
                if (dg.sparkle !== sp) dg.sparkle = sp;
            } else if (kind === 'angler') {
                // lure flicker: two incommensurate sines -> 0 dim, 1 lit, 2 flare
                dg.tick++;
                var t = dg.tick * 0.09 + dg.phase * 3.3, f = Math.sin(t) + 0.6 * Math.sin(t * 2.7 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                if (dg.lure !== lv) dg.lure = lv;
            } else if (kind === 'jelly') {
                fr = Math.sin(ent.wobble * A.jellyRate) > 0 ? 1 : 0;
                if (dg.frame !== fr) dg.frame = fr;
            } else if (kind === 'worm') {
                fr = Math.floor(ent.wiggle / A.wormRate) & 1;
                if (dg.frame !== fr) dg.frame = fr;
                // no alpha on the NES: a worm that is giving up blinks instead of fading
                dg.tick++;
                var wo = (ent.life < 0.5 && ((dg.tick >> 3) & 1)) ? 0 : 1;
                if (dg.opacity !== wo) dg.opacity = wo;
            }
        }
    }
}
