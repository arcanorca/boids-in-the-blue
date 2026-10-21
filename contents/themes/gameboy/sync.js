.pragma library
.import "../../ui/code/boids-core.js" as Core
.import "../../ui/code/boids.js" as Boids
.import "theme.js" as T
.import "atlas.js" as A

// Adapter for the "gameboy" theme: reads the shared simulation's entity state and writes the theme
// state on the pooled GBSprite delegates (same call shape as Boids.sync(sim, parent, component)).
//
// Motion: the simulation ticks at 25 Hz. sync() stores each sprite's new target centre and the centre it
// is gliding from; glide() (called once per rendered frame by the layer's FrameAnimation) moves the sprite
// linearly between them and rounds it to a whole physical pixel, so art stays crisp but moves at display
// rate. Per tick and entity only changed properties are written. Animation comes from sim state, no timers.

var Z = 1e9;                                       // z band per kind (T.LAYER)
var _tick = 0, _seed = 12345;

function sync(sim, parent, component) {
    if (!sim || sim.width <= 0) return;
    try { _sync(sim, parent, component); } catch (e) { Boids._report('gameboy sync', e); }
}

// cheap local PRNG: the simulation's own random stream must stay untouched
function _rnd() { _seed = (Math.imul(_seed, 1664525) + 1013904223) >>> 0; return _seed / 4294967296; }

// Glide state of a delegate lives in a plain JS object (dg.gs, created by the layer) so the per-frame loop
// never reads QML properties: {dg, fx, fy, tx, ty (centres, logical px), hw, hh (half size), sx, sy (tremble,
// physical px), lx, ly (last written position)}.
// draw position for glide fraction `a`: centre -> top-left, whole physical pixels
function _pos(g, a, dpr) {
    var nx = (Math.round((g.fx + (g.tx - g.fx) * a - g.hw) * dpr) + g.sx) / dpr;
    var ny = (Math.round((g.fy + (g.ty - g.fy) * a - g.hh) * dpr) + g.sy) / dpr;
    if (g.lx !== nx) { g.lx = nx; g.dg.x = nx; }
    if (g.ly !== ny) { g.ly = ny; g.dg.y = ny; }
}

// once per rendered frame while a glide is in progress
function glide(layer) {
    var a = (Date.now() - layer.tickAt) / layer.tickDur;
    if (a >= 1) { a = 1; layer.moving = false; }
    var act = layer._act, dpr = layer.dpr || 1;
    for (var i = 0; i < act.length; i++) _pos(act[i], a, dpr);
}

function _sync(sim, layer, component) {
    var cc = sim._c, stress = sim.cpuStress, now = Date.now();
    // glide bookkeeping: where every sprite is right now becomes the start of its next segment
    var aPrev = Math.min(1, (now - layer.tickAt) / layer.tickDur);
    var iv = now - layer.lastTick;
    if (iv >= 15 && iv <= 150) layer.tickDur = layer.tickDur * 0.8 + iv * 0.2;
    layer.lastTick = now; layer.tickAt = now; layer.moving = true;
    var dpr = layer.dpr || sim.dpr || 1;

    var warm = stress > 0.25, hot = stress > 1.2;
    var lvl = warm ? Core.stressLevel(stress) : 0;
    var flash = Math.floor(now / T.FLASH_MS) & 1;
    var amp = hot ? 2 : 1, trem = stress > 0.5;
    _tick++;
    var shakeTick = (_tick % 3) === 0;
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

            var dg = ent.delegate, fresh = false, g;
            if (!dg) {
                dg = component.createObject(layer, { x: 0, y: 0, size: size, type: type, spriteData: [], colorString: "#FFFFFF", rotation: 0 });
                ent.delegate = dg;
                if (!dg) continue;
                dg.z = T.LAYER[kind] * Z + dg.z;
                dg.animate = false;
                dg.phase = (ent.x * 7.31 + ent.y * 3.17) % 4;       // desynchronise a school's beat
                dg.thr = _rnd();                                   // stress threshold of this fish
                dg.st = -1;
                fresh = true;
            }
            g = dg.gs;
            var pal = T.PAL_NORMAL, key, mul = 1, sx = 0, sy = 0;

            if (kind === 'fish') {
                var variant = T.fishVariant(ent.color), pk = T.fishPick(size), pc = T.PACE.fish;
                mul = pk[1];
                dg.phase += pc.base + Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy) * pc.perSpeed;
                var fl = !ent.facingRight;
                if (dg.flip !== fl) dg.flip = fl;
                // stress: share of the school on the inverted OBJ palette, 1 px tremble, slow alarm swap
                var inv = false;
                if (warm && lvl > dg.thr) {
                    inv = hot ? ((dg.thr < 0.5 ? flash : 1 - flash) === 1) : true;
                    if (inv) pal = T.PAL_INV;
                    if (trem && inv) {
                        if (shakeTick) { g.sx = Math.round((_rnd() * 2 - 1) * amp); g.sy = Math.round((_rnd() * 2 - 1) * amp); }
                        sx = g.sx; sy = g.sy;
                    }
                }
                if (!sx && !sy) { g.sx = 0; g.sy = 0; }
                key = T.fishKey(variant, pk[0], Math.floor(dg.phase));
                // newborns twinkle while they spiral out (birthAnim runs 0..60)
                if (ent.isBaby && ent.birthAnim !== undefined && ent.birthAnim < 60) {
                    dg.tick++;
                    var sp = "spark-" + ((Math.floor(dg.tick / 18)) & 1);
                    if (dg.extra !== sp) dg.extra = sp;
                    if (dg.exX !== 0) dg.exX = 0;
                    if (dg.exY !== -6) dg.exY = -6;
                } else if (dg.extra !== "") dg.extra = "";
            } else if (kind === 'angler') {
                var fa = !ent.facingRight;
                if (dg.flip !== fa) dg.flip = fa;
                var pa = T.PACE.angler;
                dg.phase += pa.base + Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy) * pa.perSpeed;
                var fr = T.SEQ[Math.floor(dg.phase) & 3];
                mul = T.anglerMul(size);
                key = "ang-" + fr;
                // lure glow: two slow sines -> 0 dim, 1 lit, 2 flare (a change at most every ~0.5 s)
                dg.tick++;
                var t = dg.tick * T.LURE_RATE + dg.phase * 3.3, f = Math.sin(t) + 0.5 * Math.sin(t * 2.3 + 1.3);
                var lv = f > 0.8 ? 2 : (f > -0.4 ? 1 : 0);
                var L = A.LURE[fr], ex = L.x - 3, ey = L.y - 3, w8 = A.OBJ[key][2];
                if (fa) ex = w8 - 8 - ex;
                var ek = "lure-" + lv;
                if (dg.extra !== ek) dg.extra = ek;
                if (dg.exX !== ex) dg.exX = ex;
                if (dg.exY !== ey) dg.exY = ey;
            } else if (kind === 'orca') {
                var fo = ent.facingRight;   // the simulation's orca flag is inverted (false while swimming right) and this art faces right
                if (dg.flip !== fo) dg.flip = fo;
                var po = T.PACE.orca;
                dg.phase += po.base + Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy) * po.perSpeed;
                key = "orca-" + T.SEQ[Math.floor(dg.phase) & 3];
                mul = T.orcaMul(size);
            } else if (kind === 'jelly') {
                dg.phase += T.PACE.jelly.base;
                var jp = T.jellyPick(size);
                key = jp[0] + T.SEQ[Math.floor(dg.phase) & 3];
                mul = jp[1];
            } else if (kind === 'worm') {
                dg.phase += T.PACE.worm.base;
                key = "worm-" + (Math.floor(dg.phase) % 3);
                mul = T.wormMul(size);
                // a worm that has landed on the seabed dims (OBP1) before it dissolves
                pal = ent.life < 0.55 ? T.PAL_DIM : T.PAL_NORMAL;
            } else {                                        // bubble
                key = T.bubbleKey(size);
            }
            if (dg.sprite !== key) dg.sprite = key;
            if (dg.mul !== mul) dg.mul = mul;
            if (dg.pal !== pal) dg.pal = pal;

            // glide: continue from where the sprite is now; a teleport (reset, wrap) jumps
            g.hw = dg.width / 2; g.hh = dg.height / 2;
            var tx = ent.x, ty = ent.y;
            if (fresh) { g.fx = tx; g.fy = ty; }
            else {
                var cx = g.fx + (g.tx - g.fx) * aPrev, cy = g.fy + (g.ty - g.fy) * aPrev;
                var jump = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy) > 40000;
                g.fx = jump ? tx : cx; g.fy = jump ? ty : cy;
            }
            g.tx = tx; g.ty = ty;
            if (fresh) _pos(g, 1, dpr);
        }
    }
}
