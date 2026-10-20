.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T
.import "atlas.js" as A

// Adapter for the "gameboy" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled GBSprite delegates (same call shape as Boids.sync(sim, parent, component)).
// Sprites sit on the virtual pixel grid (layer.unit logical px per virtual pixel): positions are
// whole virtual pixels, like OAM coordinates. Per tick and entity only changed properties are written.
// Animation comes from sim state, no timers.

var Z = 1e9;                                       // z band per kind (T.LAYER)
var _tick = 0, _seed = 12345;

function sync(sim, parent, component) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component); } catch (e) { Boids._report('gameboy sync', e); }
}

// cheap local PRNG: the simulation's own random stream must stay untouched
function _rnd() { _seed = (Math.imul(_seed, 1664525) + 1013904223) >>> 0; return _seed / 4294967296; }

function _place(dg, ent, u, w, h, sx, sy) {
    var px = Math.round(ent.x / u) - (w >> 1) + sx, py = Math.round(ent.y / u) - (h >> 1) + sy;
    if (dg.x !== px) dg.x = px;
    if (dg.y !== py) dg.y = py;
}

function _sync(sim, parent, component) {
    var cc = sim._c, stress = sim.cpuStress, now = Boids._now();
    // same virtual-pixel size the scene uses (derived from the simulation, so it is right even before the scene is laid out)
    var dpr = sim.dpr || 1, u = T.cellPx(sim.height, dpr) / dpr;
    var warm = stress > 0.25, hot = stress > 1.2;
    var lvl = warm ? Core.stressLevel(stress) : 0;
    var flash = Math.floor(now / T.FLASH_MS) & 1;
    var amp = hot ? 2 : 1, trem = stress > 0.5;
    _tick++;
    var shakeTick = (_tick & 1) === 0;
    var lists = sim.allLists;
    for (var l = 0; l < lists.length; l++) {
        var list = lists[l];
        for (var i = 0; i < list.length; i++) {
            var ent = list[i], kind = ent.kind, size;
            var type = T.TYPE[kind];
            if (!type) continue;
            if (kind === 'fish') size = cc.fishSize + ent.sizeVariation;
            else if (kind === 'orca') size = cc.orcaSize;
            else if (kind === 'angler') size = cc.anglerSize;
            else if (kind === 'jelly') size = cc.jellySize + ent.sizeVariation;
            else if (kind === 'bubble') size = ent.scale;
            else size = cc.wormSize;

            var dg = ent.delegate;
            if (!dg) {
                dg = component.createObject(parent, { x: 0, y: 0, size: size, type: type, spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = T.LAYER[kind] * Z + dg.z;
                dg.animate = false;
                dg.phase = (ent.x * 7.31 + ent.y * 3.17) % 4;       // desynchronise a school's beat
                dg.thr = _rnd();                                   // stress threshold of this fish
                dg.st = -1;
            }
            var key = "", st = 0, w = 8, h = 8, sx = 0, sy = 0, pal = T.PAL_NORMAL, r;

            if (kind === 'fish') {
                var variant = T.fishVariant(ent.color);
                dg.phase += 0.05 + Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy) * 0.18;
                var ph = Math.floor(dg.phase) & 3;
                var fl = !ent.facingRight;
                if (dg.flip !== fl) dg.flip = fl;
                // stress: inverted OBJ palette, trembling, alarm flash (fish only)
                var inv = false;
                if (warm) {
                    inv = hot ? ((dg.thr < 0.5 ? flash : 1 - flash) === 1) : lvl > dg.thr;
                    if (inv) pal = T.PAL_INV;
                    if (trem && inv) {
                        if (shakeTick) { dg.shakeX = Math.round((_rnd() * 2 - 1) * amp); dg.shakeY = Math.round((_rnd() * 2 - 1) * amp); }
                        sx = dg.shakeX; sy = dg.shakeY;
                    } else if (dg.shakeX !== 0 || dg.shakeY !== 0) { dg.shakeX = 0; dg.shakeY = 0; }
                } else if (dg.shakeX !== 0 || dg.shakeY !== 0) { dg.shakeX = 0; dg.shakeY = 0; }
                st = ((size < T.LARVA_BELOW ? 0 : (size < T.FRY_BELOW ? 1 : 2)) * 8 + T.FISH_VARIANTS.indexOf(variant)) * 8 + (size < T.LARVA_BELOW ? ph & 1 : T.SEQ[ph]);
                if (dg.st !== st) { dg.st = st; dg.sprite = T.fishKey(variant, size, ph); }
                r = A.OBJ[dg.sprite]; w = r[2]; h = r[3];
                // newborns twinkle while they spiral out (birthAnim runs 0..60)
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    dg.tick++;
                    var sp = "spark-" + ((dg.tick >> 4) & 1);
                    if (dg.extra !== sp) dg.extra = sp;
                    if (dg.exX !== ((w - 8) >> 1)) dg.exX = (w - 8) >> 1;
                    if (dg.exY !== -7) dg.exY = -7;
                } else if (dg.extra !== "") dg.extra = "";
            } else if (kind === 'angler') {
                var fa = ent.facingRight ? false : true;
                if (dg.flip !== fa) dg.flip = fa;
                dg.phase += 0.04 + Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy) * 0.15;
                var pa = Math.floor(dg.phase) & 3;
                var fr = T.SEQ[pa];
                if (dg.st !== fr) { dg.st = fr; dg.sprite = "ang-" + fr; }
                r = A.OBJ[dg.sprite]; w = r[2]; h = r[3];
                // lure flicker: two incommensurate sines -> 0 dim, 1 lit, 2 flare
                dg.tick++;
                var t = dg.tick * 0.13 + dg.phase * 3.3, f = Math.sin(t) + 0.6 * Math.sin(t * 2.7 + 1.3);
                var lv = f > 1.0 ? 2 : (f > -0.6 ? 1 : 0);
                var L = A.LURE[fr], ex = L.x - 3, ey = L.y - 3;
                if (fa) ex = w - 8 - ex;
                var ek = "lure-" + lv;
                if (dg.extra !== ek) dg.extra = ek;
                if (dg.exX !== ex) dg.exX = ex;
                if (dg.exY !== ey) dg.exY = ey;
            } else if (kind === 'orca') {
                var fo = !ent.facingRight;
                if (dg.flip !== fo) dg.flip = fo;
                dg.phase += 0.03 + Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy) * 0.12;
                var fro = T.SEQ[Math.floor(dg.phase) & 3];
                if (dg.st !== fro) { dg.st = fro; dg.sprite = "orca-" + fro; }
                r = A.OBJ[dg.sprite]; w = r[2]; h = r[3];
            } else if (kind === 'jelly') {
                var frj = T.SEQ[Math.floor(ent.wobble * 2.2 / 1.5708) & 3];
                var wide = size >= T.JELLY_SMALL_BELOW;
                st = (wide ? 4 : 0) + frj;
                if (dg.st !== st) { dg.st = st; dg.sprite = (wide ? "j16-" : "j8-") + frj; }
                r = A.OBJ[dg.sprite]; w = r[2]; h = r[3];
            } else if (kind === 'worm') {
                var frw = T.SEQ[Math.floor(ent.wiggle / 0.5) & 3];
                // a worm that has landed on the seabed dims (OBP1) before it dissolves
                pal = ent.life < 0.55 ? T.PAL_DIM : T.PAL_NORMAL;
                if (dg.st !== frw) { dg.st = frw; dg.sprite = "worm-" + frw; }
                r = A.OBJ[dg.sprite]; w = r[2]; h = r[3];
            } else {                                        // bubble
                var big = size >= T.BUBBLE_BIG_FROM ? 1 : 0;
                if (dg.st !== big) { dg.st = big; dg.sprite = "bub-" + big; }
                r = A.OBJ[dg.sprite]; w = r[2]; h = r[3];
            }
            if (dg.pal !== pal) dg.pal = pal;
            _place(dg, ent, u, w, h, sx, sy);
        }
    }
}
