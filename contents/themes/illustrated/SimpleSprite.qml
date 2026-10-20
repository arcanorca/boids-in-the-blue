import QtQuick
import "theme.js" as Theme

// Orca, worm and bubble: one texture each.
SpriteBase {
    id: root
    Image {
        width: root.dispW
        height: root.dispW * root.aspect
        x: 0.5 - width / 2
        y: 0.5 - height / 2
        mirror: root.mirror
        source: Theme.img(Theme.KINDS[root.kind].tex, root.lod)
    }
}
