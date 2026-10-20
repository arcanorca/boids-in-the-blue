import QtQuick
import "sync.js" as OneBitSync
import "theme.js" as T

// Scene of the "onebit" theme (1-Bit): two colours only. The world is a grid of texels
// (GRID_ROWS tall, ps screen px per texel, ps an integer number of device pixels) shown by
// scaling one Item with nearest-neighbour textures: dithered water + ambience (Ambient.qml)
// behind the pooled OneBitSprite layer. Scene contract: ui/code/themes.js
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

    function sync(s) { OneBitSync.sync(s, entities, entities, ps); }

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
            z: 0.5
            paused: scene.paused
            daylight: scene.daylight
        }
        EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false }
    }
}
