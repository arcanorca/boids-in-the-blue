import QtQuick

// Pooling entity layer of the "nes" theme (NesSprite delegates). Pass it to NesSync.sync() as the
// "component": it implements createObject(parent, props) with a per-kind pool and hands out
// delegates whose release() returns them to the pool (Boids.releaseAll / sim.onRemove call that, so
// a removed entity's sprite is hidden immediately and no ghosts remain). The pool grows on demand.
Item {
    id: layer

    property int px: 4                                     // screen pixels per virtual pixel

    // pool statistics (tests / debugging)
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    // Stacking: the old renderer created one child per entity, so the newest was always on top.
    // Reusing a pooled sprite gives it a fresh z so that order is unchanged.
    property double _zc: 0

    Component { id: spriteComponent; NesSprite {} }

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
        d.flip = false; d.shakeX = 0; d.shakeY = 0; d.opacity = 1; d.rotation = 0;
        d.tintAlpha = 0; d.sparkle = 0; d.lure = 1; d.frame = 0; d.tick = 0;
        if (props.colorString !== undefined) d.baseColor = props.colorString;
        for (var k in props) d[k] = props[k];
        d.animate = true;
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
