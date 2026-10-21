import QtQuick
import "theme.js" as T

// Backdrop of the "ukiyoe" theme, in texel space (see Scene.qml): a bokashi sea (deep indigo at the floor, lighter
// Prussian blue at the surface) printed with the Seigaiha wave-scale pattern in its upper part (water-<n>.png,
// three variants by daylight), a Hokusai-style surface strip of curling crests and foam claws, 9 wakame kelp
// plants and a Matsushima seabed of rocks, pines, coral and dunes. All flat colour, no lines of water strokes.
// Nothing here flickers or scrolls: the only motion is the kelp swaying one texel at a time (one frame
// step every 2 s per plant = 0.5 Hz). There are no drifting specks.
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

    // ── water: bokashi + Seigaiha; one of three baked variants (night, dusk, day) ──
    readonly property int level: T.waterLevel(root.dl)
    Image {
        width: root.width
        height: T.WATER.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + T.waterFile(root.level)
    }

    // ── surface: curling wave crests with foam claws (same variant, so it melts into the sea) ──
    Image {
        y: T.SURFACE.y
        width: root.width
        height: T.SURFACE.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + T.surfaceFile(root.level)
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

    // ── night: the sea floor and the plants sink into the indigo (steps with daylight, static) ──
    Rectangle {
        anchors.bottom: parent.bottom
        width: root.width
        height: T.SEABED.rows + 80
        color: T.DEEP
        opacity: 0.4 * (1 - root.dl)
        visible: opacity > 0
    }
}
