import QtQuick
import "theme.js" as Theme

// Anglerfish: an almost invisible body, a cold eye, and the lure, a separate glow that breathes
// with GPU-side opacity/scale animators (inside the mirrored root, so it follows the flip).
BaseSprite {
    id: root
    readonly property var _k: Theme.kinds.angler
    readonly property real _w: _k.w * size
    readonly property real _h: _k.h * size

    Image {
        x: 0.5 - width / 2
        y: 0.5 - height / 2
        width: root._w
        height: root._h
        smooth: true
        source: Theme.DIR + root._k.file
    }
    Image {
        id: lure
        width: root._k.lure.w * root.size
        height: root._k.lure.h * root.size
        x: 0.5 + root._k.lure.x * root.size - width / 2
        y: 0.5 + root._k.lure.y * root.size - height / 2
        smooth: true
        opacity: 0.7
        source: Theme.DIR + root._k.lure.file
    }
    SequentialAnimation {
        running: root.active
        loops: Animation.Infinite
        ParallelAnimation {
            OpacityAnimator { target: lure; from: 0.4; to: 1.0; duration: 1300 + (root.phase % 4) * 210; easing.type: Easing.InOutSine }
            ScaleAnimator { target: lure; from: 0.85; to: 1.12; duration: 1300 + (root.phase % 4) * 210; easing.type: Easing.InOutSine }
        }
        ParallelAnimation {
            OpacityAnimator { target: lure; from: 1.0; to: 0.4; duration: 1900 + (root.phase % 4) * 150; easing.type: Easing.InOutSine }
            ScaleAnimator { target: lure; from: 1.12; to: 0.85; duration: 1900 + (root.phase % 4) * 150; easing.type: Easing.InOutSine }
        }
    }
}
