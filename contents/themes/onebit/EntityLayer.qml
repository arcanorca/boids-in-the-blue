import QtQuick

// Pooling entity layer of the "onebit" theme (OneBitSprite delegates). Pass it to OneBitSync.sync()
// as the "component": it implements createObject(parent, props) with a per-kind pool and hands out
// delegates whose release() returns them to the pool (called from sim.onRemove, so a removed
// entity's sprite is hidden immediately). The pool grows on demand; there is no cap.
Item {
    id: layer

    // pool statistics (tests / debugging)
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    // newest entity on top (reused sprites get a fresh z so the order is unchanged)
    property double _zc: 0

    Component { id: spriteComponent; OneBitSprite {} }

    // ── gliding: every live sprite moves from where it is to its newest target in about one tick (40 ms), one loop per frame ──
    property var _live: []                      // glide records of the visible sprites
    property double _t0: 0                      // time of the newest simulation tick (ms)
    property real _dpr: 1
    property bool _moving: false
    property real _dur: 40                      // glide time: the smoothed interval between simulation ticks (ms)
    function beginTick(dpr) {
        var now = Date.now(), dt = now - _t0;
        if (dt > 15 && dt < 120) _dur += (Math.max(30, Math.min(60, dt)) - _dur) * 0.3;
        _t0 = now; _dpr = dpr; _moving = true;
    }
    function place(d, x, y) {                  // jump (new entity): no glide from a stale position
        var r = d.rec;
        r.x0 = r.x1 = r.cx = x; r.y0 = r.y1 = r.cy = y;
        d.x = Math.round(x * _dpr) / _dpr; d.y = Math.round(y * _dpr) / _dpr;
    }
    function target(d, x, y) { var r = d.rec; r.x0 = r.cx; r.y0 = r.cy; r.x1 = x; r.y1 = y; }   // continue from where the sprite is now
    FrameAnimation {
        running: layer._moving
        onTriggered: {
            var t = (Date.now() - layer._t0) / layer._dur, k = layer._dpr, live = layer._live;
            // past the target (a late tick) keep gliding at the same speed for a moment instead of stalling
            if (t >= 1.3) { t = 1.3; layer._moving = false; }
            for (var i = 0; i < live.length; i++) {
                var r = live[i], d = r.d;
                r.cx = r.x0 + (r.x1 - r.x0) * t; r.cy = r.y0 + (r.y1 - r.y0) * t;
                var nx = Math.round(r.cx * k) / k, ny = Math.round(r.cy * k) / k;
                if (d.x !== nx) d.x = nx;
                if (d.y !== ny) d.y = ny;
            }
        }
    }

    function createObject(parent, props) {
        var t = props.type;
        var pool = _free[t];
        var d = pool.length > 0 ? pool.pop() : null;
        if (!d) {
            d = spriteComponent.createObject(layer, { type: t, visible: false });
            if (!d) return null;
            d.pool = layer;
            d.rec = { d: d, i: -1, x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0 };
            created++;
        }
        d.z = ++_zc;
        d.flip = false; d.shakeX = 0; d.shakeY = 0; d.rotation = 0;
        d.src = ""; d.sparkle = 0; d.lureLevel = -1; d.mag = 1; d.key = "";
        for (var k in props) d[k] = props[k];
        d.visible = true;
        d.rec.i = _live.length; _live.push(d.rec);
        live++;
        return d;
    }

    function _release(d) {
        if (!d.visible) return;
        d.visible = false;
        var r = d.rec, last = _live.pop();                 // swap-remove from the glide list
        if (last !== r) { _live[r.i] = last; last.i = r.i; }
        r.i = -1;
        _free[d.type].push(d);
        live--;
    }
}
