import QtQuick
import "sync.js" as GBSync
import "theme.js" as T

// Scene of the "gameboy" theme: a DMG-style virtual screen (Ambient tile map) scaled up by a whole
// number of physical pixels, with the pooled sprite layer on top. The sprites are not scaled with the
// screen: they are texel-sized images that glide between simulation ticks and land on whole physical
// pixels. There is no LCD-glass overlay (a faint pixel grid over the whole screen reads as noise).
// Scene contract: ui/code/themes.js
Item {
    id: scene

    property bool paused: false
    property real daylight: 1
    property real hour: 12
    property bool dayNight: false
    property string waterTop: "#0f4c75"          // unused: the theme has its own four shades
    property string waterBottom: "#051e36"
    property bool customWater: false
    property real dpr: 1
    property var sim: null
    property real glimmerLevel: 0

    function sync(s) {
        s.bodyScale = 12 * unit / 28; // fish 12 art px wide (36 px at 1080p)
        GBSync.sync(s, entities, entities);
    }

    // texel = `cell` physical pixels; `unit` = the same in logical pixels
    readonly property int cell: T.cellPx(height, dpr)
    readonly property real unit: cell / dpr

    clip: true

    Item {
        id: screen
        width: Math.ceil(scene.width / scene.unit)
        height: Math.ceil(scene.height / scene.unit)
        scale: scene.unit
        transformOrigin: Item.TopLeft

        Ambient {
            anchors.fill: parent
            paused: scene.paused
            stage: T.stage(scene.daylight)
        }
    }
    EntityLayer {
        id: entities
        anchors.fill: parent
        z: 1
        enabled: false
        unit: scene.unit
        dpr: scene.dpr
        paused: scene.paused
    }
}
