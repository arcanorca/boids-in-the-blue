.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "onebit" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled OneBitSprite delegates (the classic adapter, boids.js, is untouched).
// Same call shape as Boids.sync(sim, parent, component) plus `ps` (screen px per texel).
// Positions are rounded to whole texels (the world is scaled by an integer), so every sprite sits on
// the same grid as the dithered water. Per tick and entity only changed properties are written.
//
// Animation comes from sim state, no timers: tail beat from speed, jelly pulse from the sim's wobble
// phase, worm wiggle from its wiggle phase, angler lure flicker from a per-delegate tick counter.
//
// Stress in 1-bit language (fish only): from 0.25 a growing share of the fish is INVERTED (ink body,
// paper outline; which fish is fixed per fish), from 0.5 they shake by a texel; above 1.2 every fish
// blinks between normal and inverted at ~1.4 Hz, half of them in antiphase, so there is never a
// full-screen flash.

var Z = 1e9;                                       // z band size (layer order, T.LAYER)
var _seed = 123457;                                // own generator: never touches the simulation's random stream
function _rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }

function sync(sim, parent, component, ps) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component, ps > 0 ? ps : 3); } catch (e) { Boids._report('onebit sync', e); }
}

function _sync(sim, parent, component, ps) {
    var cc = sim._c, stress = sim.cpuStress, now = Boids._now();
    var hot = stress > 1.2;
    var share = Math.max(0, Math.min(0.97, (stress - 0.25)));          // share of inverted fish below the alarm
    var beat = Math.floor(now / 360) & 1;                              // alarm blink phase
    var shakeP = stress > 0.5 ? Math.min(1, (stress - 0.5) * 1.6) : 0;
    var A = T.ANIM, inv1 = 1 / ps;
    var lists = sim.allLists;
    for (var l = 0; l < lists.length; l++) {
        var list = lists[l];
        for (var i = 0; i < list.length; i++) {
            var ent = list[i], kind = ent.kind, layer = T.LAYER[kind], size;
            if (layer === undefined) continue;
            if (kind === 'fish') size = cc.fishSize + ent.sizeVariation;
            else if (kind === 'orca') size = cc.orcaSize;
            else if (kind === 'angler') size = cc.anglerSize;
            else if (kind === 'jelly') size = cc.jellySize + ent.sizeVariation;
            else if (kind === 'bubble') size = ent.scale;
            else size = cc.wormSize;

            var dg = ent.delegate;
            if (!dg) {
                dg = component.createObject(parent, { x: Math.round(ent.x * inv1), y: Math.round(ent.y * inv1), size: size, type: T.NAMES.indexOf(kind),
                                                      spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = layer * Z + dg.z;
                dg.seed = _rnd();
                dg.phase = dg.seed * 4;                  // desynchronise the beat of a school
                dg.frame = -1;                           // force the first texture
                dg.key = "";
            }
            // whole-texel positions keep every sprite on the shared grid
            var px = Math.round(ent.x * inv1), py = Math.round(ent.y * inv1);
            if (dg.x !== px) dg.x = px;
            if (dg.y !== py) dg.y = py;

            var fr, src, dims;
            if (kind === 'fish') {
                var cls = T.fishClass(size), mag = T.fishMag(size), c = T.FISH_CLASSES[cls];
                var flip = !ent.facingRight;
                if (dg.flip !== flip) dg.flip = flip;
                var spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
                dg.phase += A.fish.base + spd * A.fish.perSpeed;
                fr = Math.floor(dg.phase) & 3;
                var inv = hot ? ((beat ^ (dg.seed < 0.5 ? 1 : 0)) === 1) : dg.seed < share;
                var sx = 0, sy = 0;
                if (shakeP > 0 && _rnd() < shakeP) { sx = _rnd() < 0.5 ? -1 : 1; sy = _rnd() < 0.35 ? (_rnd() < 0.5 ? -1 : 1) : 0; }
                if (dg.shakeX !== sx) dg.shakeX = sx;
                if (dg.shakeY !== sy) dg.shakeY = sy;
                var key = cls + ':' + ent.color + ':' + fr + (inv ? 'i' : '');
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.fishFile(cls, T.fishVariant(ent.color), fr, inv);
                    if (dg.cw !== c.cols) dg.cw = c.cols;
                    if (dg.ch !== c.rows) dg.ch = c.rows;
                    if (dg.mag !== mag) dg.mag = mag;
                }
                // newborns twinkle while spiralling out (birthAnim runs 0..60)
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    dg.tick++;
                    var sp = 1 + ((dg.tick >> 2) & 1);
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else if (dg.sparkle !== 0) dg.sparkle = 0;
            } else if (kind === 'orca' || kind === 'angler') {
                var flipA = !ent.facingRight;
                if (dg.flip !== flipA) dg.flip = flipA;
                var spdA = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy), a = A[kind], d = kind === 'orca' ? T.ORCA : T.ANGLER;
                dg.phase += a.base + spdA * a.perSpeed;
                fr = Math.floor(dg.phase) & 3;
                if (dg.frame !== fr) {
                    dg.frame = fr;
                    dg.src = kind + '-' + fr + '.png';
                    if (dg.cw !== d.cols) dg.cw = d.cols;
                    if (dg.ch !== d.rows) dg.ch = d.rows;
                }
                if (kind === 'angler') {
                    // lure flicker: two incommensurate sines -> 0 dim, 1 lit, 2 flare
                    dg.tick++;
                    var t = dg.tick * 0.18 + dg.seed * 12, f = Math.sin(t) + 0.6 * Math.sin(t * 2.7 + 1.3);
                    var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                    if (dg.lureLevel !== lv) { dg.lureLevel = lv; dg.glowLevel = lv; }
                    var lp = T.LURE[fr];
                    if (dg.lureX !== lp.x) dg.lureX = lp.x;
                    if (dg.lureY !== lp.y) dg.lureY = lp.y;
                }
            } else if (kind === 'jelly') {
                var jc = T.jellyClass(size);
                fr = Math.floor(ent.wobble * A.jellyRate / 1.5708) & 3;
                var jk = jc + ':' + fr;
                if (dg.key !== jk) {
                    dg.key = jk;
                    dg.src = T.jellyFile(jc, fr);
                    dg.cw = T.JELLY[jc].cols; dg.ch = T.JELLY[jc].rows;
                }
            } else if (kind === 'worm') {
                fr = Math.floor(ent.wiggle / A.wormRate) & 3;
                var wf = T.wormFile(ent.life, fr);
                if (dg.src !== wf) { dg.src = wf; dg.cw = T.WORM.cols; dg.ch = T.WORM.rows; }
            } else if (kind === 'bubble') {
                var bf = T.bubbleFile(ent.scale);
                if (dg.src !== bf) { dg.src = bf; dg.cw = ent.scale < 2.25 ? 5 : 7; dg.ch = dg.cw; }
            }
        }
    }
}
