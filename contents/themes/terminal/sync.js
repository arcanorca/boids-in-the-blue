.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "terminal" theme: reads the shared simulation's entity state and writes the theme state on the
// pooled TerminalSprite delegates (the classic adapter, boids.js, is untouched). Same call shape as
// Boids.sync(sim, parent, component) plus `ps` (screen px per texel), `dpr` and `night` (the palette step).
// Per tick and entity only changed properties are written.
//
// Positions: the target in screen pixels is handed to the layer once per tick; the layer glides the sprite there
// in 40 ms and it lands on whole screen pixels (see EntityLayer.qml). Nothing is snapped to the text grid.
//
// Facing is the file, never a mirror: a fish or an angler shows its right-facing art when ent.facingRight is true;
// the orca is inverted in the simulation (its flag is false while it swims right), so it shows its right-facing
// art when ent.facingRight is FALSE.
//
// Animation comes from sim state, no timers: the tail beat from speed (2 frames), jelly pulse from the sim's
// wobble phase, worm wiggle from its wiggle phase, the angler lure from a slow per-delegate counter.
//
// Stress in text language (fish only): from 0.25 a growing share of the fish turns AMBER, from 0.6 a growing share
// turns RED, and the trembling share moves one cell from 0.5 at most every ~0.5 s. Above 1.2 a third of the red
// fish alternate between red and the inverted alarm box at about 0.8 Hz; nothing flashes across the screen.

var Z = 1e9;                                       // z band size (layer order, T.LAYER)
var _seed = 123457;                                // own generator: never touches the simulation's random stream
function _rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
var TREMBLE = [0, 1, 0, -1];                       // offsets in cells (scaled by T.CELL_W texels)

function _clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function sync(sim, parent, component, ps, dpr, night, psBg) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component, ps > 0 ? ps : 3, dpr > 0 ? dpr : 1, !!night, psBg > 0 ? psBg : 2); } catch (e) { Boids._report('terminal sync', e); }
}

function _sync(sim, parent, component, ps, dpr, night, psBg) {
    component.beginTick(dpr);
    var cc = sim._c, stress = sim.cpuStress, now = Boids._now();
    var hot = stress > 1.2;
    var amberShare = _clamp((stress - 0.25) / 0.8, 0, 0.9);      // share of fish that turn amber (from 0.25)
    var redShare = _clamp((stress - 0.6) / 0.8, 0, 0.9);         // share of fish that turn red (from 0.6)
    var trembleP = stress > 0.5 ? _clamp((stress - 0.5) * 1.6, 0, 1) : 0;
    var A = T.ANIM;
    var set0 = T.baseSet(night);
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
                dg = component.createObject(parent, { size: size, type: T.NAMES.indexOf(kind), spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = layer * Z + dg.z;
                dg.seed = _rnd();
                dg.phase = dg.seed * 4;                  // desynchronise the beat of a school
                dg.tick = 0;
                component.place(dg, ent.x, ent.y);       // no glide from a stale pooled position
            } else {
                component.target(dg, ent.x, ent.y);
            }
            if (dg.ps !== ps) dg.ps = ps;                  // one cell scale for everything

            var fr, mag, face, key, spd, a;
            if (kind === 'fish') {
                var cls = T.fishClass(size);
                mag = T.fishMag(size);
                face = ent.facingRight ? 'r' : 'l';
                spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
                dg.phase += A.fish.base + spd * A.fish.perSpeed;
                fr = Math.floor(dg.phase) & 1;
                // stress state of this fish (fixed per fish by its seed): 0 normal, 1 amber, 2 red, 3 inverted alarm
                var state = 0;
                if (stress >= 0.6 && dg.seed < redShare) state = 2;
                else if (stress >= 0.25 && dg.seed < amberShare) state = 1;
                if (hot && state === 2 && dg.seed < 0.35) state = (Math.floor((now + dg.seed * 3571) / 625) & 1) ? 3 : 2;
                var sx = 0;
                if (trembleP > 0 && ((dg.seed * 7.31) % 1) < trembleP) sx = TREMBLE[Math.floor(now / 480 + dg.seed * 8) & 3] * T.CELL_W;
                if (dg.shakeX !== sx) dg.shakeX = sx;
                var variant = T.fishVariant(ent.color), set = T.fishSet(night, state);
                key = cls + ':' + mag + ':' + variant + ':' + fr + ':' + face + ':' + set;
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.fishFile(cls, variant, fr, face, set);
                    if (dg.mag !== mag) dg.mag = mag;
                }
                // newborns sparkle while spiralling out (birthAnim runs 0..60), slowly: about 0.8 Hz
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    dg.tick++;
                    var sp = 1 + ((dg.tick >> 4) & 1);
                    var sf = T.sparkleFile(sp - 1, set0);           // the source first: the image never shows an empty name
                    if (dg.sparkleSrc !== sf) dg.sparkleSrc = sf;
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else if (dg.sparkle !== 0) dg.sparkle = 0;
            } else if (kind === 'orca') {
                // the simulation's orca flag is inverted: the right-facing art is shown when ent.facingRight is false
                face = ent.facingRight ? 'l' : 'r';
                spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
                a = A.orca;
                mag = size / T.DEFAULT_SIZE.orca >= 1.6 ? 2 : 1;
                dg.phase += a.base + spd * a.perSpeed;
                fr = Math.floor(dg.phase) & 1;
                key = 'orca:' + fr + ':' + face + ':' + mag + ':' + set0;
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.orcaFile(fr, face, set0);
                    dg.mag = mag;
                }
            } else if (kind === 'angler') {
                face = ent.facingRight ? 'r' : 'l';
                spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
                a = A.angler;
                mag = size / T.DEFAULT_SIZE.angler >= 1.6 ? 2 : 1;
                dg.phase += a.base + spd * a.perSpeed;
                fr = Math.floor(dg.phase) & 1;
                key = 'angler:' + fr + ':' + face + ':' + mag + ':' + set0;
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.anglerFile(fr, face, set0);
                    dg.mag = mag;
                    var lp = T.ANGLER_LURE[face];
                    dg.lureX = lp.x * T.CELL_W; dg.lureY = lp.y * T.CELL_H;
                }
                // lure: two slow incommensurate sines -> 0 dim, 1 normal, 2 bright (a change every few seconds)
                dg.tick++;
                var t = dg.tick * 0.04 + dg.seed * 12, f = Math.sin(t) + 0.6 * Math.sin(t * 2.3 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.4 ? 1 : 0);
                if (dg.lureLevel !== lv) {
                    var lf = T.lureFile(lv, set0);
                    if (dg.lureSrc !== lf) dg.lureSrc = lf;   // source first, then the level that shows it
                    dg.lureLevel = lv;
                }
            } else if (kind === 'jelly') {
                var jc = T.jellyClass(size);
                mag = T.jellyMag(size);
                fr = Math.floor(ent.wobble * A.jellyRate / 1.5708) & 1;
                key = 'jelly:' + jc + ':' + mag + ':' + fr + ':' + set0;
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.jellyFile(jc, fr, set0);
                    dg.mag = mag;
                }
            } else if (kind === 'worm') {
                mag = T.wormMag(size);
                var stage = T.wormStage(ent.life);
                fr = Math.floor(ent.wiggle / A.wormRate) & 1;
                key = 'worm:' + stage + ':' + fr + ':' + mag + ':' + set0;
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.wormFile(stage, fr, set0);
                    dg.mag = mag;
                }
            } else if (kind === 'bubble') {
                var bf = T.bubbleFile(ent.scale, set0);
                if (dg.src !== bf) dg.src = bf;
            }
        }
    }
}
