import QtQuick
import "theme.js" as Theme

// Orca, worm, bubble: one baked texture. (Orca art faces left; the sim mirrors it, as for the classic one.)
BaseSprite {
    id: root
    readonly property var _k: Theme.BY_TYPE[type]
    readonly property real _w: _k.w * size * _k.k
    readonly property real _h: _k.h * size * _k.k

    Image {
        x: 0.5 - width / 2
        y: 0.5 - height / 2
        width: root._w
        height: root._h
        smooth: true
        source: Theme.DIR + root._k.file
    }
}
