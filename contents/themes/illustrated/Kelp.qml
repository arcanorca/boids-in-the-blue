import QtQuick
import "theme.js" as Theme

// One swaying kelp blade (rotates about its base).
Image {
    id: k
    property var spec
    property Item own
    property bool front: false
    source: "img/kelp" + spec.v + "-" + (height > 150 ? 120 : 60) + ".png"
    height: own.height * spec.h
    width: height * 0.2
    x: own.width * spec.x
    y: own.height - height + (front ? 6 : 8)
    transformOrigin: Item.Bottom
    opacity: (front ? 0.95 : 0.85) * (0.45 + 0.55 * own.daylight)
    property real swing: 0
    rotation: swing
    // GPU backends: continuous animation, paused with the wallpaper
    SequentialAnimation on swing {
        loops: Animation.Infinite
        running: !own._sw && own.visible && !own.paused   // stopped (not paused) while covered: no setPaused() warnings
        NumberAnimation { to: k.spec.a; duration: k.spec.d; easing.type: Easing.InOutSine }
        NumberAnimation { to: -k.spec.a; duration: k.spec.d; easing.type: Easing.InOutSine }
    }
    // software renderer: every moving pixel is a CPU repaint, so sway from a shared 5 Hz clock instead
    Binding {
        target: k; property: "swing"; when: own._sw
        value: k.spec.a * Math.sin(own.clock * 2 * Math.PI / (k.spec.d * 2 / 1000) + k.spec.x * 9)
    }
}
