import QtQuick
import "theme.js" as Theme

// Ambient layer of the illustrated theme. Instantiated three times inside the entity layer
// (part: "back" = far seabed + far kelp, "rays" = surface light, "front" = foreground sand +
// kelp) so each part gets its own z between the creature depth bins. A small, fixed number of
// items (5 rays, 13 kelp blades, 2 seabed strips) animated by GPU-side rotations.
// On the software renderer the kelp sways at a 5 Hz update rate and the big translucent rays stay
// still (every moving pixel there is a CPU repaint); real GPU backends get the continuous animation.
Item {
    id: amb
    property string part: "back"
    property bool paused: false
    property double daylight: 1       // 0 night .. 1 day
    property double warmth: 0         // dawn / dusk 0..1
    readonly property bool _sw: GraphicsInfo.api === GraphicsInfo.Software
    property double clock: 0                                      // seconds; only ticks on the software renderer
    Timer {
        interval: 200
        repeat: true
        running: amb._sw && !amb.paused && amb.visible && amb.part !== "rays"
        onTriggered: amb.clock += 0.2
    }

    // ── far seabed + kelp (behind the far creatures, fogged by the haze planes) ──
    Image {
        visible: amb.part === "back"
        width: amb.width
        height: amb.width * 300 / 1920 * 0.9
        y: amb.height - height + 4
        opacity: 0.35 + 0.55 * amb.daylight          // fades toward the (dark) water at night
        source: "img/seabed-far-1920.png"
        fillMode: Image.Stretch
    }
    Repeater {
        model: amb.part === "back" ? Theme.KELP_FAR : []
        delegate: Kelp { spec: modelData; own: amb }
    }

    // ── light rays ──
    Repeater {
        model: amb.part === "rays" ? Theme.RAYS : []
        delegate: Image {
            required property var modelData
            required property int index
            source: "img/ray-128.png"
            width: amb.width * modelData.w * 1.6
            height: amb.height * 0.98
            x: amb.width * modelData.x - width / 2
            y: -amb.height * 0.04
            transformOrigin: Item.Top
            rotation: modelData.lean
            opacity: modelData.o * (0.12 + 0.88 * amb.daylight * amb.daylight) * (1 + amb.warmth * 0.5)
            visible: opacity > 0.01
            SequentialAnimation on rotation {
                loops: Animation.Infinite
                running: !amb.paused && amb.visible && !amb._sw
                NumberAnimation { to: modelData.lean + modelData.a; duration: modelData.d; easing.type: Easing.InOutSine }
                NumberAnimation { to: modelData.lean - modelData.a; duration: modelData.d; easing.type: Easing.InOutSine }
            }
        }
    }

    // soft glow where the light enters at the surface
    Rectangle {
        visible: amb.part === "rays"
        width: amb.width
        height: amb.height * 0.24
        opacity: 0.05 + 0.15 * amb.daylight
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#ffffff" }
            GradientStop { position: 1.0; color: "#00ffffff" }
        }
    }

    // marine snow: a couple of dozen tiny motes (drift on GPU backends, still on software)
    Repeater {
        model: amb.part === "rays" ? 26 : 0
        delegate: Rectangle {
            id: mote
            required property int index
            readonly property double bx: ((index * 0.618034) % 1) * amb.width
            readonly property double by: ((index * 0.754878 + 0.13) % 1) * amb.height * 0.92
            width: 1.6 + (index % 3) * 0.9
            height: width
            radius: width / 2
            color: "#eafcff"
            opacity: (0.14 + (index % 4) * 0.06) * (0.35 + 0.65 * amb.daylight)
            x: bx
            y: by
            property real dy: 0
            transform: Translate { y: mote.dy }
            SequentialAnimation on dy {
                loops: Animation.Infinite
                running: !amb._sw && amb.visible && !amb.paused
                NumberAnimation { to: -26; duration: 9000 + (mote.index * 977) % 6000; easing.type: Easing.InOutSine }
                NumberAnimation { to: 18;  duration: 9000 + (mote.index * 613) % 6000; easing.type: Easing.InOutSine }
            }
        }
    }

    // ── foreground: near sand + big kelp (in front of the near creatures) ──
    Image {
        visible: amb.part === "front"
        width: amb.width
        height: amb.width * 260 / 1920 * 0.7
        y: amb.height - height + 2
        opacity: 0.55 + 0.45 * amb.daylight
        source: "img/seabed-near-1920.png"
        fillMode: Image.Stretch
    }
    Repeater {
        model: amb.part === "front" ? Theme.KELP_FRONT : []
        delegate: Kelp { spec: modelData; own: amb; front: true }
    }
}
