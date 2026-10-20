import QtQuick
import "theme.js" as Theme

// Luminous fish: one glow texture per hue and tail frame (shared, atlased). Stress adds a second
// texture of the same shape (angry red-orange) cross-faded in; above 1.2 the sim pulses red <-> hot white.
BaseSprite {
    id: root
    readonly property var _k: Theme.kinds.fish
    readonly property int _frame: pool ? _k.seq[(pool.tick + phase) & 3] : 0
    readonly property bool _flash: tintColor === "#000080"
    readonly property real _w: _k.w * size * _k.k
    readonly property real _h: _k.h * size * _k.k

    Image {
        x: 0.5 - width / 2 + root.shakeX
        y: 0.5 - height / 2 + root.shakeY
        width: root._w
        height: root._h
        smooth: true
        opacity: root._flash ? 1 : 1 - Math.min(1, root.tintAlpha * 1.6) * 0.85
        source: Theme.fishSource(root.baseColor, root._frame)
    }
    Image {
        x: 0.5 - width / 2 + root.shakeX
        y: 0.5 - height / 2 + root.shakeY
        width: root._w
        height: root._h
        smooth: true
        visible: root.tintAlpha > 0
        opacity: root._flash ? root.tintAlpha : Math.min(1, root.tintAlpha * 1.6)
        source: visible ? Theme.fishSource(root.tintColor, root._frame) : ""
    }
}
