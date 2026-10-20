import QtQuick
import "theme.js" as Theme

// Biolum entity layer: same contract as contents/ui/EntityLayer.qml (pass it to Boids.sync() as
// the delegate factory; per-kind pools; release() returns a sprite to its pool), but the
// delegates are the glow sprites of this theme.
Item {
    id: layer

    property bool running: true          // false while the wallpaper is paused: animations + tail tick stop
    property int tick: 0                 // shared tail-frame clock (fish)
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]
    property double _zc: 0

    Timer {
        interval: Theme.kinds.fish.tickMs
        repeat: true
        running: layer.running
        onTriggered: layer.tick = (layer.tick + 1) & 0xffff
    }

    Component { id: fishC; Fish {} }
    Component { id: jellyC; Jelly {} }
    Component { id: plainC; Plain {} }
    Component { id: anglerC; Angler {} }
    function _comp(t) { return t === 1 ? fishC : (t === 2 ? jellyC : (t === 4 ? anglerC : plainC)); }

    function createObject(parent, props) {
        var t = props.type;
        var pool = _free[t];
        var d = pool.length > 0 ? pool.pop() : null;
        if (!d) {
            d = _comp(t).createObject(layer, { type: t, visible: false });
            if (!d) return null;
            d.pool = layer;
            d.phase = created;
            created++;
        }
        // kinds are stacked back to front (orca, jelly, angler, worm, fish, bubble); within a kind the newest is on top
        d.z = Theme.BY_TYPE[t].layer + (++_zc % 100000) / 100000;
        d.animate = false;
        d.flip = false; d.shakeX = 0; d.shakeY = 0; d.opacity = 1; d.rotation = 0;
        d.tintAlpha = 0;
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
