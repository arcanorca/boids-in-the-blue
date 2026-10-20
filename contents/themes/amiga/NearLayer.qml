import QtQuick
import "theme.js" as T

// Foreground plants in front of the creatures (4 sway frames, slightly faster drift than the kelp).
Item {
    id: root
    property int vp: 4
    property int tick: 0
    clip: true
    TileStrip {
        vp: root.vp; tw: T.NEAR.tw; h: T.NEAR.h
        offset: Math.floor(root.tick * T.DRIFT.near / 5)
        source: T.DIR + "near-" + ((Math.floor(root.tick / 3) + 2) % T.NEAR.frames) + ".png"
    }
}
