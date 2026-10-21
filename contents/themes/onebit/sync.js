.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T

// Adapter for the "onebit" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled OneBitSprite delegates (the classic adapter, boids.js, is untouched).
// Same call shape as Boids.sync(sim, parent, component) plus `ps` (screen px per texel) and `dpr`.
// Per tick and entity only changed properties are written.
//
// Positions: the target (tx, ty) in screen pixels is written once per tick; the sprite glides there in
// 40 ms and lands on whole screen pixels (see OneBitSprite.qml). Nothing is snapped to the texel grid.
//
// Animation comes from sim state, no timers: tail beat from speed (2-3 frames/s), jelly pulse from the
// sim's wobble phase, worm wiggle from its wiggle phase, angler lure from a slow per-delegate counter.
//
// Stress in 1-bit language (fish only), nothing ever blinks full-screen: from 0.25 a growing share of the
// fish is INVERTED (ink body, paper outline and pattern; which fish is fixed per fish); from 0.5 a share
// trembles by one texel (a new offset at most every ~0.5 s); above 1.2 about a third of the fish
// alternates between inverted and normal at 0.8 Hz, each with its own phase.

var Z = 1e9;                                       // z band size (layer order, T.LAYER)
var _seed = 123457;                                // own generator: never touches the simulation's random stream
function _rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
var TREMBLE = [0, 1, 0, -1];

function sync(sim, parent, component, ps, dpr) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component, ps > 0 ? ps : 3, dpr > 0 ? dpr : 1); } catch (e) { Boids._report('onebit sync', e); }
}

function _sync(sim, parent, component, ps, dpr) {
    var cc = sim._c, stress = sim.cpuStress, now = Boids._now();
    var hot = stress > 1.2;
    var share = Math.max(0, Math.min(0.95, stress - 0.25));            // share of inverted fish
    var trembleP = stress > 0.5 ? Math.min(1, (stress - 0.5) * 1.6) : 0;
    var A = T.ANIM;
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
                dg.place(ent.x, ent.y);                  // no glide from a stale pooled position
            } else {
                if (dg.tx !== ent.x) dg.tx = ent.x;
                if (dg.ty !== ent.y) dg.ty = ent.y;
            }
            if (dg.ps !== ps) dg.ps = ps;
            if (dg.dpr !== dpr) dg.dpr = dpr;

            var fr, mag, d;
            if (kind === 'fish') {
                var cls = T.fishClass(size), c = T.FISH_CLASSES[cls];
                mag = T.fishMag(size);
                var flip = !ent.facingRight;
                if (dg.flip !== flip) dg.flip = flip;
                var spd = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
                dg.phase += A.fish.base + spd * A.fish.perSpeed;
                fr = Math.floor(dg.phase) & 3;
                var inv = dg.seed < share;
                if (hot && dg.seed < 0.35) inv = (Math.floor((now + dg.seed * 3571) / 625) & 1) === 1;
                var sx = 0;
                if (trembleP > 0 && ((dg.seed * 7.31) % 1) < trembleP) sx = TREMBLE[Math.floor(now / 480 + dg.seed * 8) & 3];
                if (dg.shakeX !== sx) dg.shakeX = sx;
                var key = cls + ':' + mag + ':' + ent.color + ':' + fr + (inv ? 'i' : '');
                if (dg.key !== key) {
                    dg.key = key;
                    dg.src = T.fishFile(cls, T.fishVariant(ent.color), fr, inv);
                    if (dg.cw !== c.cols) dg.cw = c.cols;
                    if (dg.ch !== c.rows) dg.ch = c.rows;
                    if (dg.mag !== mag) dg.mag = mag;
                }
                // newborns twinkle while spiralling out (birthAnim runs 0..60), slowly: about 0.8 Hz
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    dg.tick++;
                    var sp = 1 + ((dg.tick >> 4) & 1);
                    if (dg.sparkle !== sp) dg.sparkle = sp;
                } else if (dg.sparkle !== 0) dg.sparkle = 0;
            } else if (kind === 'orca' || kind === 'angler') {
                var flipA = !ent.facingRight;
                if (dg.flip !== flipA) dg.flip = flipA;
                var spdA = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy), a = A[kind];
                var v = T.kindVariant(kind, size);
                mag = T.kindMag(kind, size);
                dg.phase += a.base + spdA * a.perSpeed;
                fr = Math.floor(dg.phase) & 3;
                var kk = v + ':' + mag + ':' + fr;
                if (dg.key !== kk) {
                    dg.key = kk;
                    d = kind === 'orca' ? T.ORCA[v] : T.ANGLER[v];
                    dg.src = kind === 'orca' ? T.orcaFile(v, fr) : T.anglerFile(v, fr);
                    dg.cw = d.cols; dg.ch = d.rows; dg.mag = mag;
                    if (kind === 'angler') { var lp = T.LURE[v][fr]; dg.lureX = lp.x; dg.lureY = lp.y; }
                }
                if (kind === 'angler') {
                    // lure: two slow incommensurate sines -> 0 dim, 1 lit, 2 flare (a change every few seconds)
                    dg.tick++;
                    var t = dg.tick * 0.04 + dg.seed * 12, f = Math.sin(t) + 0.6 * Math.sin(t * 2.3 + 1.3);
                    var lv = f > 1.0 ? 2 : (f > -0.4 ? 1 : 0);
                    if (dg.lureLevel !== lv) dg.lureLevel = lv;
                }
            } else if (kind === 'jelly') {
                var jc = T.jellyClass(size);
                mag = T.jellyMag(size);
                fr = Math.floor(ent.wobble * A.jellyRate / 1.5708) & 3;
                var jk = jc + ':' + mag + ':' + fr;
                if (dg.key !== jk) {
                    dg.key = jk;
                    dg.src = T.jellyFile(jc, fr);
                    dg.cw = T.JELLY[jc].cols; dg.ch = T.JELLY[jc].rows; dg.mag = mag;
                }
            } else if (kind === 'worm') {
                mag = T.wormMag(size);
                fr = Math.floor(ent.wiggle / A.wormRate) & 3;
                var wf = T.wormFile(ent.life, fr);
                if (dg.src !== wf || dg.mag !== mag) { dg.src = wf; dg.cw = T.WORM.cols; dg.ch = T.WORM.rows; dg.mag = mag; }
            } else if (kind === 'bubble') {
                var bc = T.bubbleClass(ent.scale), bf = T.bubbleFile(ent.scale);
                if (dg.src !== bf) { dg.src = bf; dg.cw = T.BUBBLE[bc].cols; dg.ch = T.BUBBLE[bc].rows; }
            }
        }
    }
}
