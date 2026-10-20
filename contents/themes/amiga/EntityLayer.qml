import QtQuick

// Pooling entity layer of the "amiga" theme (AmigaSprite delegates). Pass it to AmigaSync.sync() as
// the "component": createObject(parent, props) hands out pooled sprites whose release() returns them
// to the pool (the adapter calls that from sim.onRemove, so a removed entity vanishes at once).
// `cell` = screen px per virtual pixel (set by Scene.qml); sprites follow it through a binding.
Item {
    id: layer

    property int cell: 4
    property real stressStep: 0            // written by sync.js: palette-swap level 0..1 for the backdrop
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]       // indexed by delegate type
    property double _zc: 0                                 // newest sprite on top, as in the other renderers

    Component { id: spriteComponent; AmigaSprite {} }

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
        d.sparkle = 0; d.cls = 0; d.frame = 0;
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
