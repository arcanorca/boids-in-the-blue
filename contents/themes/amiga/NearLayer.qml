import QtQuick
import "theme.js" as T

// Foreground plants in front of the creatures: few, short, dark and slightly translucent so they never
// fight the fish for attention. They lean slowly with the same sway clock as the kelp.
Item {
    id: root
    objectName: "nearLayer"
    property int vp: 3
    property real sway: 0
    clip: true
    Repeater {
        model: root.width > 0 ? T.layout("fg", Math.ceil(root.width / root.vp)) : []
        delegate: Stalk {
            required property var modelData
            species: modelData.n
            vp: root.vp
            sway: root.sway
            ph: modelData.ph + 0.3
            flip: modelData.flip
            amp: 0.03
            x: modelData.x * root.vp
            y: root.height + 2 * root.vp
        }
    }
}
