import QtQuick
import "theme.js" as T

// Backdrop of the "onebit" theme, in texel space (see Scene.qml). Dark ink water; tone only from static
// horizontal hatch lines (water-<n>.png layers, more of them by day; below the surface band they are confined
// to diagonal light shafts), a wave line at the top, a seabed silhouette and line-art kelp. Nothing here flickers or
// scrolls: the only motion is the kelp swaying one texel at a time (a step about every 2 s per plant) and a
// few specks sinking one texel every few seconds. One Timer at 2 Hz drives it; nothing animates while `paused`.
// Cost: 1 water strip, 1 wave strip, 8 kelp, 2 seabed tiles, 16 specks (all shared textures).
Item {
    id: root

    property bool paused: false
    property real daylight: 1.0                    // 0 night .. 1 day
    // daylight in 1/16 steps: the layers only change on a visible step
    readonly property real dl: Math.round(daylight * 16) / 16
    property int tick: 0

    clip: true

    Timer {
        interval: 500
        repeat: true
        running: !root.paused && root.width > 0
        onTriggered: root.tick++
    }

    // ── water: hatch lines; water-<n>.png holds the layers 0..n, n follows the daylight ──
    Image {
        width: root.width
        height: T.WATER.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + T.waterFile(T.waterLevel(root.dl))
    }
    // wave line at the surface
    Image {
        width: root.width
        height: T.SURFACE.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + "surface.png"
    }

    // ── kelp: stands on the seabed ridge, swaying whole texels ──
    Repeater {
        model: [[0.05, 1], [0.15, 0], [0.30, 2], [0.43, 0], [0.57, 1], [0.69, 2], [0.82, 0], [0.94, 1]]
        delegate: Image {
            readonly property int kx: Math.round(modelData[0] * root.width)
            x: kx - Math.floor(T.KELP[modelData[1]].cols / 2)
            y: root.height - T.SEABED.rows + T.seabedTop(kx) - T.KELP[modelData[1]].rows + 7
            smooth: false
            source: T.DIR + "kelp-" + modelData[1] + "-" + ((Math.floor(root.tick / 4) + index) & 3) + ".png"
        }
    }

    // ── specks (marine snow): one texel, sinking one texel every few seconds ──
    Repeater {
        model: 16
        delegate: Rectangle {
            readonly property real sx: ((index * 0.618034 + 0.13) % 1)
            readonly property real sy: ((index * 0.754878 + 0.31) % 1)
            readonly property int every: 3 + (index % 4)                          // ticks per texel
            width: 1
            height: 1
            color: T.PAPER
            x: Math.floor(sx * root.width) + [0, 1, 1, 0, -1, -1][(Math.floor(root.tick / (7 + index % 5)) + index) % 6]
            y: (Math.floor(sy * root.height) + Math.floor(root.tick / every)) % Math.max(1, root.height - T.SEABED.rows - 8)
        }
    }

    // ── seabed ──
    Repeater {
        model: Math.ceil(root.width / T.SEABED.cols)
        delegate: Image {
            x: index * T.SEABED.cols
            y: root.height - T.SEABED.rows
            smooth: false
            source: T.DIR + "seabed.png"
        }
    }
}
