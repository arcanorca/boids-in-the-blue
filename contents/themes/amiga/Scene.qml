import QtQuick
import "sync.js" as AmigaSync
import "theme.js" as T

// Scene of the "amiga" theme: copper-list water + calm backdrop (Backdrop.qml), the pooled sprite layer
// (positions glide at display rate between the 25 Hz sim ticks) and the near plants.
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

    // px per art pixel (integer), see theme.js vpFor
    readonly property int vp: T.vpFor(height)

    function sync(s) { AmigaSync.sync(s, entities, entities); }

    Backdrop {
        id: backdrop
        anchors.fill: parent
        z: 0
        vp: scene.vp
        paused: scene.paused
        daylight: scene.daylight
        stress: entities.stressStep
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false; cell: scene.vp; paused: scene.paused }
    NearLayer {
        anchors.fill: parent
        z: 2
        vp: scene.vp
        sway: (backdrop.sway + 0.37) % 1
    }
}
