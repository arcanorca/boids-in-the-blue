import QtQuick
import "theme.js" as Theme

// Entity lay of the illustrated theme. Same pooling protocol as ui/EntityLayer.qml
// (createObject(parent, props) + release()), but entities are placed in three depth bins with
// translucent "fog" planes of the water colour between them, so far creatures are lighter,
// lower-contrast and tinted toward the water without any per-entity effect. Ambient items
// (seabed, rays, foreground kelp) are children of this lay so they interleave by z.
Item {
    id: lay

    property var sky: ["#4aa6ad", "#348fa0", "#237391", "#185a7c", "#113f60"]   // fog colours (see theme.js sky().haze)
    property double dpr: 1

    // pool statistics (tests / debugging)
    property int created: 0
    property int live: 0

    property var _free: [[], [], [], [], [], [], []]       // by delegate type
    property double _zc: 0

    Component { id: fishC;   FishSprite {} }
    Component { id: jellyC;  JellySprite {} }
    Component { id: anglerC; AnglerSprite {} }
    Component { id: simpleC; SimpleSprite {} }

    function _component(t) { return t === 1 ? fishC : (t === 2 ? jellyC : (t === 4 ? anglerC : simpleC)); }

    function createObject(parent, props) {
        var t = props.type;
        var pool = _free[t];
        var d = pool.length > 0 ? pool.pop() : null;
        if (!d) {
            d = _component(t).createObject(lay, { type: t, kind: Theme.BY_TYPE[t], visible: false });
            if (!d) return null;
            d.pool = lay;
            created++;
        }
        d.animate = false;
        d.mirror = false; d.shakeX = 0; d.shakeY = 0; d.opacity = 1; d.rotation = 0; d.tiltS = 0;
        d.dpr = dpr;
        for (var k in props) d[k] = props[k];
        d.z = Theme.Z.bin[Theme.depthBin(d.depth)] + (++_zc % 9000) + 1;
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

    // Fog planes: a copy of the water gradient at partial opacity, drawn over the creatures behind it
    Repeater {
        model: 2
        Rectangle {
            anchors.fill: parent
            z: Theme.Z.haze[index]
            opacity: Theme.HAZE_ALPHA[index]
            gradient: Gradient {
                GradientStop { position: 0.0;  color: lay.sky[0] }
                GradientStop { position: 0.25; color: lay.sky[1] }
                GradientStop { position: 0.55; color: lay.sky[2] }
                GradientStop { position: 0.8;  color: lay.sky[3] }
                GradientStop { position: 1.0;  color: lay.sky[4] }
            }
        }
    }
}
