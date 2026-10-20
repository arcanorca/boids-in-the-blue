.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "pixel" theme: reads the shared simulation's entity state and writes the
// theme state on the pooled PixelSprite delegates (the classic adapter, boids.js, is untouched).
// Same call shape as Boids.sync(sim, parent, component). Per tick and entity it only writes
// properties whose value changed, so a delegate re-evaluates only when it must.
//
// Animation is derived from sim state, no timers: tail beat from speed, jelly bell pulse from
// the sim's wobble phase, worm wiggle from its wiggle phase, angler lure flicker from a
// per-delegate tick counter.

var Z = 1e9;                                       // z band size (layer order, see theme.js kinds[].layer)

function sync(sim, parent, component) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component); } catch (e) { Boids._report('pixel sync', e); }
}

function _sync(sim, parent, component) {
    var cc = sim._c, stress = sim.cpuStress;
    var pulse = Core.stressPulse(stress, Boids._now());
    var sf = Core.stressLevel(stress);
    var hot = stress > 1.2, warm = stress > 0.25;
    var shake = Core.stressShake(stress);
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
            // integer pixel positions keep the sprite grid crisp
            var px = Math.round(ent.x), py = Math.round(ent.y);
            if (dg.x !== px) dg.x = px;
            if (dg.y !== py) dg.y = py;
            var cell = T.cellFor(kind, size);
            if (dg.cell !== cell) dg.cell = cell;

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
                    // colour -> red in 4 clean steps (see theme.js); above 1.2 red <-> crimson by pulse
                    var base = hot ? "red" : T.fishStressVariant(ent.color, Math.round(sf * 4)), ta = hot ? pulse : 0;
                    if (dg.variant !== base) dg.variant = base;
                    if (dg.tintOpacity !== ta) dg.tintOpacity = ta;
                    var sx = 0, sy = 0;
                    if (stress > 0.5) { sx = Math.round((Core.random() - 0.5) * shake); sy = Math.round((Core.random() - 0.5) * shake); }
                    if (dg.shakeX !== sx) dg.shakeX = sx;
                    if (dg.shakeY !== sy) dg.shakeY = sy;
                } else {
                    var v = T.fishVariant(ent.color);
                    if (dg.variant !== v) dg.variant = v;
                    if (dg.tintOpacity !== 0) dg.tintOpacity = 0;
                    if (dg.shakeX !== 0) dg.shakeX = 0;
                    if (dg.shakeY !== 0) dg.shakeY = 0;
                }
                // newborns fade in as they spiral out (birthAnim runs 0..60)
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    var bo = 0.35 + 0.65 * ent.birthAnim / 60;
                    if (dg.opacity !== bo) dg.opacity = bo;
                    dg.tick++;
                    var sp = 1 + ((dg.tick >> 1) & 1);          // twinkle while spiralling out
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else {
                    if (dg.opacity !== 1) dg.opacity = 1;
                    if (dg.sparkle !== 0) dg.sparkle = 0;
                }
            } else if (kind === 'angler') {
                // lure flicker: two incommensurate sines -> 0 dim, 1 lit, 2 flare
                dg.tick++;
                var t = dg.tick * 0.18 + dg.phase * 3.3, f = Math.sin(t) + 0.6 * Math.sin(t * 2.7 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                if (dg.lure !== lv) dg.lure = lv;
                var g = lv === 2 ? 0.62 : (lv === 1 ? 0.42 : 0.26);
                if (dg.glow !== g) dg.glow = g;
            } else if (kind === 'jelly') {
                fr = Math.floor(ent.wobble * A.jellyRate / 1.5708) & 3;
                if (dg.frame !== fr) dg.frame = fr;
                if (dg.opacity !== 0.95) dg.opacity = 0.95;
            } else if (kind === 'worm') {
                fr = Math.floor(ent.wiggle / A.wormRate) & 3;
                if (dg.frame !== fr) dg.frame = fr;
                if (dg.opacity !== ent.life) dg.opacity = ent.life;
            }
        }
    }
}
