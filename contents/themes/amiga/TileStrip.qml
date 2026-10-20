import QtQuick
import "theme.js" as T

// A horizontally tiling strip glued to the bottom edge, scrolled in whole virtual pixels.
// `source` is the texture to show (the owner switches it per animation frame); tw/h in texels.
Item {
    id: root
    property int vp: 4
    property int tw: 512
    property int h: 100
    property string source: ""
    property int offset: 0                 // virtual px scrolled left (wraps at tw)
    anchors.bottom: parent.bottom
    width: parent.width
    height: h * vp

    Repeater {
        model: Math.ceil(root.width / (root.tw * root.vp)) + 1
        delegate: Image {
            x: index * root.tw * root.vp - (root.offset % root.tw) * root.vp
            width: root.tw * root.vp
            height: root.h * root.vp
            smooth: false
            source: root.source
        }
    }
}
