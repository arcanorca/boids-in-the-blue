import QtQuick
import "theme.js" as Theme

// Jellyfish: translucent glowing bell (breathing scale) over a tentacle sheet that sways from the rim.
// Both are animated by GPU-side animators; the hue is picked from the entity size.
BaseSprite {
    id: root
    readonly property var _k: Theme.kinds.jelly
    readonly property string _hue: Theme.jellyHue(size)
    readonly property real _f: size * _k.k
    readonly property int _d: 2600 + (phase % 4) * 330

    Image {
        id: tent
        width: root._k.tent.w * root._f
        height: root._k.tent.h * root._f
        x: 0.5 - width / 2
        y: 0.5 + root._k.tent.y * root._f - height / 2
        smooth: true
        transformOrigin: Item.Top
        source: Theme.DIR + "jelly-tent-" + root._hue + ".png"
    }
    Image {
        id: bell
        width: root._k.bell.w * root._f
        height: root._k.bell.h * root._f
        x: 0.5 - width / 2
        y: 0.5 + root._k.bell.y * root._f - height / 2
        smooth: true
        source: Theme.DIR + "jelly-bell-" + root._hue + ".png"
    }
    SequentialAnimation {
        running: root.active
        loops: Animation.Infinite
        ScaleAnimator { target: bell; from: 1.0; to: 0.92; duration: root._d * 0.55; easing.type: Easing.InOutSine }
        ScaleAnimator { target: bell; from: 0.92; to: 1.0; duration: root._d * 0.75; easing.type: Easing.InOutSine }
    }
    SequentialAnimation {
        running: root.active
        loops: Animation.Infinite
        RotationAnimator { target: tent; from: -4; to: 4; duration: root._d * 0.65; easing.type: Easing.InOutSine }
        RotationAnimator { target: tent; from: 4; to: -4; duration: root._d * 0.65; easing.type: Easing.InOutSine }
    }
}
