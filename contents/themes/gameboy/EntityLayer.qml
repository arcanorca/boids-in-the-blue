import QtQuick

// Pooling entity layer of the "gameboy" theme (GBSprite delegates). Pass it to GBSync.sync() as
// the "component": it implements createObject(parent, props) with a per-kind pool and hands out
// delegates whose release() returns them to the pool (called from sim.onRemove, so a removed
// entity's sprite is hidden at once). The pool grows on demand; there is no cap.
// It lives inside the scene's scaled virtual screen: `unit` = logical px per virtual pixel.
Item {
    id: layer

    property real unit: 1

    // pool statistics (tests / debugging)
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    // Stacking: newest on top within a kind (see sync.js for the per-kind band)
    property double _zc: 0

    Component { id: spriteComponent; GBSprite {} }

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
        d.pal = 0; d.extra = ""; d.st = -1; d.tick = 0;
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
