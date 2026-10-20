import QtQuick
import "sync.js" as PixelSync

// Scene of the "pixel" theme (Refined Pixel): smooth water + ambience (Ambient.qml) behind the
// pooled PixelSprite layer. Scene contract: ui/code/themes.js
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

    function sync(s) { PixelSync.sync(s, entities, entities); }

    Ambient {
        anchors.fill: parent
        z: 0.5
        paused: scene.paused
        daylight: scene.daylight
        customTop: scene.customWater ? scene.waterTop : ""
        customBottom: scene.customWater ? scene.waterBottom : ""
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false }
}
