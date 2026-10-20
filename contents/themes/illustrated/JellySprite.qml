import QtQuick
import "theme.js" as Theme

// Jellyfish: translucent bell that pulses and wavy tentacles that sway. `phase` is the
// simulation's wobble angle, so every jelly moves out of step without any per-item animation.
SpriteBase {
    id: root
    kind: "jelly"
    property double phase: 0
    readonly property double bellH: dispW * 0.7

    Image {
        id: tent
        width: root.dispW
        height: root.dispW
        x: 0.5 - width / 2
        y: 0.5 - root.dispW * 0.78 + root.dispW * 0.56
        transformOrigin: Item.Top
        rotation: 5 * Math.sin(root.phase * 2.3 + 1.0)
        source: Theme.img("jelly-tent", root.lod)
    }
    Image {
        width: root.dispW
        height: root.bellH
        x: 0.5 - width / 2
        y: 0.5 - root.dispW * 0.78
        transform: Scale {
            origin.x: root.dispW / 2
            origin.y: 0
            xScale: 1 - 0.035 * Math.sin(root.phase * 3.0)
            yScale: 1 + 0.07 * Math.sin(root.phase * 3.0)
        }
        source: Theme.img("jelly-bell", root.lod)
    }
}
