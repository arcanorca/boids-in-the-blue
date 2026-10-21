import QtQuick

// Pooling entity layer of the "amiga" theme (AmigaSprite delegates). Pass it to AmigaSync.sync() as
// the "component": createObject(parent, props) hands out pooled sprites whose release() returns them
// to the pool (the adapter calls that from sim.onRemove, so a removed entity vanishes at once).
// `cell` = screen px per art pixel (set by Scene.qml).
//
// Smooth motion: sync.js calls beginTick() once per sim tick; ONE shared tween `t` (0..1, linear, as long
// as the real tick interval) interpolates every sprite between its previous and its new position, and the
// sprite lands on whole screen pixels (Math.round) - never on the art-pixel grid, so slow fish glide
// instead of crawling in 3 px steps. No per-sprite animation objects.
Item {
    id: layer

    property int cell: 3
    property bool paused: false
    property real stressStep: 0            // written by sync.js: palette-swap level 0..1 for the backdrop
    property int created: 0
    property int live: 0
    property real t: 1                     // tween between the last two sim ticks
    property double _last: 0

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    property double _zc: 0                                 // newest sprite on top, as in the other renderers

    Component { id: spriteComponent; AmigaSprite {} }

    NumberAnimation {
        id: tween
        target: layer
        property: "t"
        from: 0
        to: 1
        duration: 40
        running: false
    }

    // called by sync.js at the start of every tick: restart the tween over the real tick interval
    function beginTick() {
        var now = Date.now(), dt = _last > 0 ? now - _last : 40;
        _last = now;
        tween.stop();
        tween.duration = Math.max(16, Math.min(120, dt));
        t = 0;
        if (!paused) tween.start(); else t = 1;
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
        d.flip = false; d.opacity = 1; d.rotation = 0;
        d.sparkle = 0; d.cls = 0; d.frame = 0; d.glow = 1; d.lure = 1;
        for (var k in props) d[k] = props[k];
        d.visible = true;
        live++;
        return d;
    }

    function _release(d) {
        if (!d.visible) return;
        d.visible = false;
        _free[d.type].push(d);
        live--;
    }
}
