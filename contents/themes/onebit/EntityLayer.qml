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
        d.flip = false; d.shakeX = 0; d.shakeY = 0; d.rotation = 0;
        d.src = ""; d.sparkle = 0; d.lureLevel = -1; d.glowLevel = -1;
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
