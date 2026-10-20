import QtQuick

// Renders the simulation's entities. Pass this item to Boids.sync() as the "component":
// it implements createObject(parent, props) with a per-kind pool and hands out delegates
// whose release() returns them to the pool (the adapter calls that from sim.onRemove, so
// a removed entity's sprite is hidden immediately and no ghosts remain).
// The pool grows on demand; there is no cap.
Item {
    id: layer

    // pool statistics (tests / debugging)
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    // Stacking: the old renderer created one child per entity, so the newest was always on top.
    // Reusing a pooled sprite gives it a fresh z so that order is unchanged.
    property double _zc: 0

    Component { id: spriteComponent; BoidSprite {} }

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
        d.tintAlpha = 0;
        if (props.colorString !== undefined) d.baseColor = props.colorString;   // before spriteData: no stray texture lookups
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
