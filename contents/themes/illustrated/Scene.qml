import QtQuick

// Scene of the "illustrated" theme (Soft Illustrated): Stage.qml does the work.
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
    property alias nowOverride: stg.nowOverride   // deterministic clock for tests (ms), -1 = real time

    function sync(s) { stg.sync(s); }

    Stage {
        id: stg
        anchors.fill: parent
        paused: scene.paused
        dayNight: scene.dayNight
        hour: scene.hour
        dpr: scene.dpr
    }
}
