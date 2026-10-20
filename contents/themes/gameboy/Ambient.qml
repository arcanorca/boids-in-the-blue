import QtQuick
import "theme.js" as T
import "atlas.js" as A

// Background of the "gameboy" theme, built like a BG tile map on the virtual screen (this item is
// virtual-pixel sized, the scene scales it): banded dithered water tiles (one row = one Image tiled
// across), slanted dithered light rays, two parallax rows of water-surface tiles scrolled in whole-pixel steps (the way a DMG
// game scrolls scanlines), and a 64x14-tile seabed with rocks and swaying kelp.
//
// Cost: ~35 static tile rows + 4 images; one shared 8 Hz tick advances the scroll offsets and the
// kelp frame. The tick stops while `paused`.
Item {
    id: root

    property bool paused: false
    property int stage: 0                          // BGP fade: 0 day, 1 dusk/dawn, 2 night

    readonly property int rows: Math.ceil(height / T.TILE)
    property int beat: 0
    readonly property url atlas: Qt.resolvedUrl(T.DIR + T.BG_FILES[stage])

    clip: true

    Timer {
        interval: 125
        repeat: true
        running: !root.paused && root.width > 0
        onTriggered: root.beat++
    }

    // water: one Image per tile row, its 8x8 tile repeated across
    Repeater {
        model: root.rows
        delegate: Image {
            readonly property var _r: A.BG.water[T.waterTile(index, root.rows)]
            y: index * T.TILE
            width: root.width
            height: T.TILE
            fillMode: Image.TileHorizontally
            smooth: false
            source: root.atlas
            sourceClipRect: Qt.rect(_r[0], _r[1], _r[2], _r[3])
        }
    }

    // light rays: one slanted, dithered tile drifting sideways a pixel at a time
    Image {
        readonly property var _r: A.BG.rays
        x: -(Math.floor(root.beat / 6) % 256)
        y: 2 * T.TILE
        width: root.width + 256
        height: _r[3]
        fillMode: Image.TileHorizontally
        smooth: false
        source: root.atlas
        sourceClipRect: Qt.rect(_r[0], _r[1], _r[2], _r[3])
    }

    // surface: two rows of wave tiles scrolling in opposite directions
    Image {
        readonly property var _r: A.BG.surf[0]
        x: -(Math.floor(root.beat / 2) % 16)
        y: 0
        width: root.width + 16
        height: T.TILE
        fillMode: Image.TileHorizontally
        smooth: false
        source: root.atlas
        sourceClipRect: Qt.rect(_r[0], _r[1], _r[2], _r[3])
    }
    Image {
        readonly property var _r: A.BG.surf[1]
        x: -(15 - Math.floor(root.beat / 3) % 16)
        y: T.TILE
        width: root.width + 16
        height: T.TILE
        fillMode: Image.TileHorizontally
        smooth: false
        source: root.atlas
        sourceClipRect: Qt.rect(_r[0], _r[1], _r[2], _r[3])
    }

    // seabed: the tile map in its two kelp frames (swapped every 5 ticks)
    Image {
        readonly property var _r: (Math.floor(root.beat / 5) & 1) ? A.BG.seaB : A.BG.seaA
        y: root.height - _r[3]
        width: root.width
        height: _r[3]
        fillMode: Image.TileHorizontally
        smooth: false
        source: root.atlas
        sourceClipRect: Qt.rect(_r[0], _r[1], _r[2], _r[3])
    }
}
