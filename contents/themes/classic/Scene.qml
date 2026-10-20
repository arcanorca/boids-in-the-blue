import QtQuick
import "../../ui/code/boids.js" as Boids

// The "classic" theme: the original renderer, unchanged. A smooth Canvas gradient, one Canvas
// BoidDelegate per entity, and the golden sunrise/sunset shimmer. Scene contract: ui/code/themes.js
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

    function sync(s) { Boids.sync(s, entityLayer, boidComponent); }

    // CRITICAL: this Canvas must have ZERO visual Item children. The entities live in the
    // sibling Item below: BoidDelegate is a QQuickPaintedItem, and as a child of a Canvas it
    // would take hover away from the MouseAreas.
    Canvas {
        id: mainCanvas
        anchors.fill: parent

        property string _waterTop: scene.waterTop
        property string _waterBottom: scene.waterBottom
        on_WaterTopChanged: requestPaint()
        on_WaterBottomChanged: requestPaint()

        onPaint: {
            var ctx = getContext("2d");
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, width, height);
            var grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, _waterTop);
            grad.addColorStop(1, _waterBottom);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
    }

    Item {
        id: entityLayer
        anchors.fill: parent
        z: 1
        enabled: false
    }

    Component {
        id: boidComponent
        BoidDelegate {}
    }

    // ── Surface glimmer (golden shimmer at the water surface during sunrise/sunset) ──
    Item {
        id: surfaceGlimmer
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: parent.height * 0.10
        z: 2
        visible: scene.glimmerLevel > 0.01 && !scene.paused
        opacity: scene.glimmerLevel * 0.8

        Rectangle {
            anchors.fill: parent
            gradient: Gradient {
                GradientStop { position: 0.0; color: "#30ff8c42" }
                GradientStop { position: 0.4; color: "#18ff7a30" }
                GradientStop { position: 1.0; color: "#00000000" }
            }
        }

        Repeater {
            model: 20
            delegate: Rectangle {
                width: 2 + (index % 3)
                height: width
                radius: width / 2
                color: index % 3 === 0 ? "#ffa060" : (index % 3 === 1 ? "#ff8c42" : "#ff7a30")
                opacity: 0
                // Golden-ratio spread: deterministic, follows resizes
                x: ((index * 0.618034) % 1) * surfaceGlimmer.width
                y: ((index * 0.754878) % 1) * surfaceGlimmer.height * 0.7
                SequentialAnimation on opacity {
                    loops: Animation.Infinite
                    paused: scene.paused
                    PauseAnimation { duration: 400 + (index * 731) % 3500 }
                    NumberAnimation { to: 0.25 + (index % 5) * 0.1; duration: 600 + (index % 4) * 200; easing.type: Easing.InOutSine }
                    NumberAnimation { to: 0; duration: 800 + (index % 3) * 300; easing.type: Easing.InOutSine }
                }
            }
        }
    }
}
