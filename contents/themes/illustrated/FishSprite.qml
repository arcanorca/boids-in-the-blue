import QtQuick
import "theme.js" as Theme

// Fish: body texture in its palette colour, a same-silhouette stress overlay (red / wine) at
// tintAlpha, and a soft halo (white while a baby is being born, red in the alarm state).
SpriteBase {
    id: root
    kind: "fish"

    property string baseKey: "coral"        // body texture colour
    property string overKey: "hot"          // overlay texture colour
    property double tintAlpha: 0
    property string haloKey: "white"
    property double haloAlpha: 0

    Image {
        visible: root.haloAlpha > 0
        opacity: root.haloAlpha
        width: root.dispW * 3.0
        height: width
        x: 0.5 - width / 2
        y: 0.5 - height / 2
        source: visible ? Theme.img("glow-" + root.haloKey, 64) : ""
    }
    Image {
        width: root.dispW
        height: root.dispW * root.aspect
        x: 0.5 - width / 2 + root.shakeX
        y: 0.5 - height / 2 + root.shakeY
        mirror: root.mirror
        source: Theme.img("fish-" + root.baseKey, root.lod)
    }
    Image {
        visible: root.tintAlpha > 0
        opacity: root.tintAlpha
        width: root.dispW
        height: root.dispW * root.aspect
        x: 0.5 - width / 2 + root.shakeX
        y: 0.5 - height / 2 + root.shakeY
        mirror: root.mirror
        source: visible ? Theme.img("fish-" + root.overKey, root.lod) : ""
    }
}
