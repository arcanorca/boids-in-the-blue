import QtQuick
import "theme.js" as Theme

// Anglerfish: silhouette + a soft pulsing glow on the lure (glowAlpha is driven by sync.js).
SpriteBase {
    id: root
    kind: "angler"
    property double glowAlpha: 0.7

    Image {
        width: root.dispW
        height: root.dispW * root.aspect
        x: 0.5 - width / 2
        y: 0.5 - height / 2
        mirror: root.mirror
        source: Theme.img("angler", root.lod)
    }
    Image {
        // lure bulb at (150, 9) of the 170 x 130 art
        width: root.dispW * 0.62
        height: width
        x: 0.5 + (root.mirror ? -1 : 1) * (150 / 170 - 0.5) * root.dispW - width / 2
        y: 0.5 + (9 / 130 - 0.5) * root.dispW * root.aspect - height / 2
        opacity: root.glowAlpha
        source: Theme.img("glow-warm", 64)
    }
}
