import QtQuick
import "sync.js" as OneBitSync
import "theme.js" as T

// Scene of the "onebit" theme (1-Bit): two colours only, light on dark. The backdrop (Ambient.qml: hatch-line
// water, shafts, kelp, seabed) lives in a world of texels that is scaled by a whole number of device pixels
// (3 px per texel at 1080p) with nearest-neighbour textures. The creatures (pooled OneBitSprite) are placed in
// screen pixels, so they glide smoothly between simulation ticks, but are drawn with the same texel size.
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

    function sync(s) { OneBitSync.sync(s, entities, entities, ps, Math.max(1, dpr)); }

    clip: true
    Rectangle { anchors.fill: parent; color: T.INK }

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
