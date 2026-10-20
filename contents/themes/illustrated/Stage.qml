import QtQuick
import "theme.js" as Theme
import "sync.js" as ThemeSync

// Root of the illustrated theme: graded water gradient, entity layer (with depth fog and the
// ambient parts interleaved by z) and a night toning overlay. main.qml (and the offscreen
// render harness) only set paused / dayNight / hour / dpr and call sync(sim).
Item {
    id: stage

    property bool paused: false
    property bool dayNight: false
    property real hour: 12
    property real dpr: 1
    property double nowOverride: -1        // deterministic clock for tests (ms); -1 = real time
    property alias entities: ents
    readonly property var grade: Theme.sky(hour, dayNight)

    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.0;  color: stage.grade.stops[0] }
            GradientStop { position: 0.25; color: stage.grade.stops[1] }
            GradientStop { position: 0.55; color: stage.grade.stops[2] }
            GradientStop { position: 0.8;  color: stage.grade.stops[3] }
            GradientStop { position: 1.0;  color: stage.grade.stops[4] }
        }
    }

    Layer {
        id: ents
        anchors.fill: parent
        sky: stage.grade.haze
        dpr: stage.dpr

        Ambient { anchors.fill: parent; part: "back";  z: Theme.Z.seabedFar; paused: stage.paused; daylight: stage.grade.day; warmth: stage.grade.warmth }
        Ambient { anchors.fill: parent; part: "rays";  z: Theme.Z.rays;      paused: stage.paused; daylight: stage.grade.day; warmth: stage.grade.warmth }
        Ambient { anchors.fill: parent; part: "front"; z: Theme.Z.front;     paused: stage.paused; daylight: stage.grade.day; warmth: stage.grade.warmth }
    }

    // dawn / dusk: warm wash at the surface
    Rectangle {
        anchors.left: parent.left; anchors.right: parent.right; anchors.top: parent.top
        height: parent.height * 0.3
        visible: stage.grade.warmth > 0.02
        opacity: stage.grade.warmth * 0.4
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#f2b08a" }
            GradientStop { position: 1.0; color: "#00f2b08a" }
        }
    }

    // night: tone everything (creatures included) toward deep blue
    Rectangle {
        anchors.fill: parent
        visible: stage.grade.day < 0.97
        color: "#050d24"
        opacity: (1 - stage.grade.day) * 0.34
    }

    function sync(sim) {
        ThemeSync.sync(sim, ents, nowOverride >= 0 ? nowOverride : Date.now());
    }
}
