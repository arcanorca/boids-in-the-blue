import QtQuick
import "sync.js" as AmigaSync
import "theme.js" as T

// Scene of the "amiga" theme: copper-list water + parallax backdrop (Backdrop.qml), the pooled
// sprite layer, the near plants and a palette-fade for night. Scene contract: ui/code/themes.js
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

    // px per virtual pixel (integer), see theme.js vpFor
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
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false; cell: scene.vp }
    NearLayer {
        anchors.fill: parent
        z: 2
        vp: scene.vp
        tick: backdrop.tick
    }
    // night = a palette fade towards deep blue over everything (one blended quad)
    Rectangle {
        anchors.fill: parent
        z: 3
        color: "#002"
        opacity: 0.42 * (1 - T.smooth(0.0, 0.5, scene.daylight))
        visible: opacity > 0.001
    }
}
