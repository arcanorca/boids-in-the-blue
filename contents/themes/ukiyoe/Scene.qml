import QtQuick
import "sync.js" as UkiyoeSync
import "theme.js" as T

// Scene of the "ukiyoe" theme (Ukiyo-e, nishiki-e): flat traditional pigments with sumi keyblock outlines.
// The backdrop (Ambient.qml: bokashi sea with the Seigaiha pattern, Hokusai wave crests, wakame kelp,
// Matsushima seabed) lives in a world of texels scaled by a whole number of device pixels (3 px per texel at
// 1080p) with nearest-neighbour textures. Creatures (pooled UkiyoeSprite) are placed in screen pixels
// so they glide smoothly between simulation ticks while rendering at the exact same texel scale.
// Scene contract: ui/code/themes.js
Item {
    id: scene

    property bool paused: false
    property real daylight: 1
    property real hour: 12
    property bool dayNight: false
    property string waterTop: "#0f4c75"          // unused: the palette is fixed (usesWaterColors: false)
    property string waterBottom: "#051e36"
    property bool customWater: false
    property real dpr: 1
    property var sim: null
    property real glimmerLevel: 0

    // screen px per texel (a whole number of DEVICE pixels, so texels are never split)
    readonly property real ps: T.texelDevice(height * Math.max(1, dpr)) / Math.max(1, dpr)

    // creatures stay below the waves: the simulation's upper limit is the wave strip plus the fish's half height
    function sync(s) {
        // ps from the simulation's own height until the scene has been laid out (height is 0 on the first frames)
        var p = height > 0 ? ps : T.texelDevice((s.height > 0 ? s.height : 1080) * Math.max(1, dpr)) / Math.max(1, dpr);
        s.top = T.SURFACE.floor * p;
        UkiyoeSync.sync(s, entities, entities, p, Math.max(1, dpr));
    }

    clip: true
    Rectangle { anchors.fill: parent; color: T.DEEP }

    Item {
        id: world
        width: Math.ceil(scene.width / scene.ps)
        height: Math.ceil(scene.height / scene.ps)
        scale: scene.ps
        transformOrigin: Item.TopLeft

        Ambient {
            anchors.fill: parent
            paused: scene.paused
            daylight: scene.daylight
        }
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false }
}
