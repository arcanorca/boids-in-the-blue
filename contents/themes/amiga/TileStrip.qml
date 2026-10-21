import QtQuick

// A static horizontally tiling strip glued to the bottom edge; tw/h in art pixels, shown at vp px each.
Item {
    id: root
    property int vp: 3
    property int tw: 640
    property int h: 26
    property string source: ""
    anchors.bottom: parent.bottom
    width: parent.width
    height: h * vp

    Repeater {
        model: Math.ceil(root.width / (root.tw * root.vp))
        delegate: Image {
            required property int index
            x: index * root.tw * root.vp
            width: root.tw * root.vp
            height: root.h * root.vp
            smooth: false
            source: root.source
        }
    }
}
