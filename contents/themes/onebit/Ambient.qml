import QtQuick
import "theme.js" as T

// Backdrop of the "onebit" theme, in texel space (see Scene.qml). Deep ink ocean with woodcut swell-hatch
// water layers and 5 volumetric diagonal sunbeams (water-<n>.png layers, more of them by day), a braided
// surface wave strip, a 2-layer reef seabed with boulders/corals/starfish, and 9 botanical kelp plants
// arranged in multi-depth reef groves.
// Nothing here flickers or scrolls: the only motion is the kelp swaying one texel at a time (one frame
// step every 2 s per plant = 0.5 Hz) and 16 marine-snow specks sinking one texel every few seconds.
// One Timer at 2 Hz drives it; nothing animates while `paused`.
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

    // ── water: woodcut swell-hatch lines & sunbeams; water-<n>.png holds layers 0..n by daylight ──
    Image {
        width: root.width
        height: T.WATER.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + T.waterFile(T.waterLevel(root.dl))
    }

    // ── braided wave line at the surface ──
    Image {
        width: root.width
        height: T.SURFACE.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + "surface.png"
    }

    // ── kelp forests: 9 plants in 3 depth/height classes standing on the seabed ridges ──
    Repeater {
        model: [
            [0.05, 1], [0.09, 2],
            [0.25, 0], [0.29, 1],
            [0.49, 2], [0.54, 0],
            [0.72, 1],
            [0.88, 2], [0.93, 0]
        ]
        delegate: Image {
            readonly property int kx: Math.round(modelData[0] * root.width)
            readonly property int cls: modelData[1]
            x: kx - Math.floor(T.KELP[cls].cols / 2)
            y: root.height - T.SEABED.rows + T.seabedTop(kx) - T.KELP[cls].rows + 6
            smooth: false
            source: T.DIR + "kelp-" + cls + "-" + ((Math.floor(root.tick / 4) + index) & 3) + ".png"
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

    // ── layered reef & dune seabed ──
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
