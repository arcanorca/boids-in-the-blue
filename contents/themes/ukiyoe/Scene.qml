import QtQuick
import "sync.js" as UkiyoeSync
import "theme.js" as T

// Scene of the "ukiyoe" theme (Ukiyo-e): Bero-ai indigo ink on washi paper (two colours by default; the
// Nishiki-e pigment set is selected by theme.js PALETTE_SET).
// The backdrop (Ambient.qml: wave-hatched water, volumetric sunbeams, botanical kelp forests, layered
// reef seabed) lives in a world of texels scaled by a whole number of device pixels (3 px per texel at
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
        s.top = T.SURFACE.floor * ps;
        UkiyoeSync.sync(s, entities, entities, ps, Math.max(1, dpr));
    }

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
