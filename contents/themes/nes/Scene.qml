import QtQuick
import "sync.js" as NesSync
import "theme.js" as T

// Scene of the "nes" theme: a low-resolution NES-style picture (virtual pixels scaled by an integer)
// made of a palette-driven background (Ambient.qml) behind the pooled NesSprite layer.
// Scene contract: ui/code/themes.js
Item {
    id: scene

    property bool paused: false
    property real daylight: 1
    property real hour: 12
    property bool dayNight: false
    property string waterTop: "#0f4c75"
    property string waterBottom: "#051e36"
    property bool customWater: false
    property real dpr: 1
    property var sim: null
    property real glimmerLevel: 0

    // screen pixels per virtual pixel
    readonly property int px: T.pxFor(height)

    function sync(s) { NesSync.sync(s, entities, entities, px); }

    Ambient {
        anchors.fill: parent
        z: 0.5
        paused: scene.paused
        daylight: scene.daylight
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false; px: scene.px }
}
