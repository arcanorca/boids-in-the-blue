import QtQuick
import "theme.js" as T
import "atlas.js" as A

// Background of the "gameboy" theme, a BG tile map on the virtual screen (this item is texel-sized, the
// scene scales it up). Composed like a real DMG underwater screen: big FLAT tone zones (lit layer, open
// water, deep water) joined by one clean 3-row dither seam each, a surface line with foam, a few wide
// flat light shafts in the lit layer, a sand strip with boulders and corals, and kelp clumps that sway
// in two frames. Nothing else moves: there is no scrolling and no noise.
//
// Cost: ~30 static images sharing one atlas, one 500 ms timer for the kelp (stopped when `paused`).
Item {
    id: root

    property bool paused: false
    property int stage: 0                          // BGP fade: 0 day, 1 dusk/dawn, 2 night

    readonly property var geom: A.GEOM
    readonly property int cols: Math.ceil(width)
    readonly property int rows: Math.ceil(height)
    readonly property int zoneA: Math.round(rows * geom.zoneA)           // bottom of the lit layer
    readonly property int zoneB: Math.round(rows * geom.seamB)           // bottom of the open water
    readonly property int sandTop: rows - geom.sandRows
    property int beat: 0
    readonly property url atlas: Qt.resolvedUrl(T.DIR + T.BG_FILES[stage])

    clip: true

    Timer {
        interval: 500
        repeat: true
        running: !root.paused && root.width > 0
        onTriggered: root.beat++
    }

    component Piece: Image {
        property var r: [0, 0, 0, 0]
        width: r[2]
        height: r[3]
        smooth: false
        source: root.atlas
        sourceClipRect: Qt.rect(r[0], r[1], r[2], r[3])
    }
    component Strip: Piece {                        // tiled across the screen
        width: root.cols
        fillMode: Image.TileHorizontally
    }
    component Flat: Piece {                         // one flat shade stretched
        width: root.cols
        fillMode: Image.Stretch
    }

    // water: lit layer, seam, open water, seam, deep water
    Flat { r: A.BG.flat[2]; y: 0; height: root.zoneA }
    Strip { r: A.BG.seam21; y: root.zoneA }
    Flat { r: A.BG.flat[1]; y: root.zoneA + 3; height: root.zoneB - root.zoneA - 3 }
    Strip { r: A.BG.seam10; y: root.zoneB }
    Flat { r: A.BG.flat[0]; y: root.zoneB + 3; height: root.rows - root.zoneB - 3 }

    // light shafts: wide flat bands, only inside the lit layer
    Item {
        y: 0
        width: root.cols
        height: root.zoneA
        clip: true
        Strip { r: A.BG.shafts; y: 0 }
    }
    // surface line + foam
    Strip { r: A.BG.surf; y: 0 }

    // seabed
    Strip { r: A.BG.sand; y: root.sandTop }

    Repeater {
        model: A.LAYOUT.filter(function (e) { return e.k === "kelp"; })
        delegate: Piece {
            readonly property var _p: A.BG.kelp[modelData.v]
            readonly property int _ph: (index * 3 + 1) % 4
            r: _p[((root.beat + _ph) >> 2) & 1]
            x: Math.round(root.cols * modelData.fx - width / 2)
            y: root.sandTop + 5 - height
            mirror: !!modelData.m
        }
    }
    Repeater {
        model: A.LAYOUT.filter(function (e) { return e.k === "prop"; })
        delegate: Piece {
            r: A.BG.props[modelData.v]
            x: Math.round(root.cols * modelData.fx - width / 2)
            y: root.sandTop + 6 - height
            mirror: !!modelData.m
        }
    }
}
