import QtQuick
import "theme.js" as Theme
import "sync.js" as BiolumSync

// Scene of the "biolum" theme (Bioluminescent Deep): three-stop water, Ambient.qml (shafts,
// caustics, snow, sparkles, vignette) and the pooled glow sprites. Scene contract: ui/code/themes.js
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

    // the user's own water colours win over the theme's when set
    readonly property var grad: customWater ? Theme.gradientFrom(waterTop, waterBottom) : Theme.gradient(daylight)

    function sync(s) {
        s.bodyScale = 1.5;          // fish ~42 px wide without the glow halo (10 x 4 x 1.25 = 50 px with it)
        BiolumSync.sync(s, entities, entities);
    }

    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.0; color: scene.grad.top }
            GradientStop { position: 0.55; color: scene.grad.mid }
            GradientStop { position: 1.0; color: scene.grad.bottom }
        }
    }
    Ambient {
        anchors.fill: parent
        z: 0.5
        enabled: false
        stage: scene
        running: !scene.paused
        sim: scene.sim
        daylight: scene.daylight
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false; running: !scene.paused }
}
