import QtQuick
import "sync.js" as PixelSync
import "theme.js" as T

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

    // px per art texel (integer), see theme.js psFor
    readonly property int ps: T.psFor(height)

    function sync(s) {
        s.top = 20 * ps;            // creatures stay below the surface strip (the orca is 34 texels tall)
        s.bodyScale = 16 * ps / 28; // adult fish 16 texels wide (32 px at 1080p; the classic fish is 28)
        PixelSync.sync(s, entities, entities);
    }

    Ambient {
        anchors.fill: parent
        z: 0.5
        ps: scene.ps
        paused: scene.paused
        daylight: scene.daylight
        customTop: scene.customWater ? scene.waterTop : ""
        customBottom: scene.customWater ? scene.waterBottom : ""
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false; cell: scene.ps; dpr: Math.max(1, scene.dpr); paused: scene.paused }
}
