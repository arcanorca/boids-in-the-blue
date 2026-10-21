import QtQuick
import "sync.js" as GBSync

// Pooling entity layer of the "gameboy" theme (GBSprite delegates). Pass it to GBSync.sync() as
// the "component": it implements createObject(parent, props) with a per-kind pool and hands out
// delegates whose release() returns them to the pool (called from sim.onRemove, so a removed
// entity's sprite is hidden at once). The pool grows on demand; there is no cap.
//
// Motion: the simulation ticks at 25 Hz and writes each sprite's target; one FrameAnimation glides all
// live sprites linearly from the previous to the new target (GBSync.glide) and rounds them to whole
// physical pixels. It runs only while a glide is in progress and the scene is not paused.
Item {
    id: layer

    property real unit: 1                  // logical px per texel
    property real dpr: 1
    property bool paused: false

    // pool statistics (tests / debugging)
    property int created: 0
    property int live: 0

    // glide state (written by GBSync.sync)
    property double tickAt: 0
    property real tickDur: 40
    property double lastTick: 0
    property bool moving: false
    property var _act: []                  // glide states (sprite.gs) of the live delegates

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    // Stacking: newest on top within a kind (see sync.js for the per-kind band)
    property double _zc: 0

    Component { id: spriteComponent; GBSprite {} }

    FrameAnimation {
        running: layer.moving && !layer.paused
        onTriggered: GBSync.glide(layer)
    }

    function createObject(parent, props) {
        var t = props.type;
        var pool = _free[t];
        var d = pool.length > 0 ? pool.pop() : null;
        if (!d) {
            d = spriteComponent.createObject(layer, { type: t, visible: false });
            if (!d) return null;
            d.pool = layer;
            created++;
        }
        d.z = ++_zc;
        d.animate = false;
        d.flip = false; d.opacity = 1; d.rotation = 0;
        d.pal = 0; d.extra = ""; d.st = -1; d.tick = 0; d.mul = 1;
        for (var k in props) d[k] = props[k];
        d.animate = true;
        d.visible = true;
        if (!d.gs) d.gs = { dg: d, fx: 0, fy: 0, tx: 0, ty: 0, hw: 0, hh: 0, sx: 0, sy: 0, lx: NaN, ly: NaN, ai: 0 };
        d.gs.sx = 0; d.gs.sy = 0; d.gs.lx = NaN; d.gs.ly = NaN;
        d.gs.ai = _act.length;
        _act.push(d.gs);
        live++;
        return d;
    }

    function _release(d) {
        if (!d.visible) return;
        d.visible = false;
        _free[d.type].push(d);
        var last = _act.pop();
        if (last !== d.gs) { _act[d.gs.ai] = last; last.ai = d.gs.ai; }
        live--;
    }
}
