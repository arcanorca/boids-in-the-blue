import QtQuick
import "theme.js" as T

// Ambience of the "onebit" theme, in texel space (see Scene.qml): the water as a dithered
// gradient (8-texel bands cut from a 16x16 blue-noise matrix, so the stipple is continuous across
// bands), a wave line, a few dithered light shafts, a kelp stand, a seabed silhouette and a handful
// of drifting specks. One Timer (about 5 steps a second) drives every movement in whole texels;
// nothing animates while `paused`.
// Cost: ~50 static band images, 5 shafts, 12 wave tiles, 8 kelp, 3 seabed tiles, 14 specks.
Item {
    id: root

    property bool paused: false
    property real daylight: 1.0                    // 0 night .. 1 day
    // daylight in 1/16 steps: the bands only swap textures on a visible change
    readonly property real dl: Math.round(daylight * 16) / 16
    property int tick: 0

    clip: true

    Timer {
        interval: 200
        repeat: true
        running: !root.paused && root.width > 0
        onTriggered: root.tick++
    }

    // ── water: dithered gradient, 8-texel bands ──
    Repeater {
        model: Math.ceil(root.height / 8)
        delegate: Image {
            x: 0
            y: index * 8
            width: Math.ceil(root.width / 16) * 16
            height: 8
            fillMode: Image.Tile
            smooth: false
            source: T.DIR + T.waterFile(root.dl, (index * 8 + 4) / root.height, index)
        }
    }

    // ── light shafts: paper dots on the noise lattice (positions are multiples of 16 texels so the
    //    dots merge with the water pattern); a slow two-step breathing ──
    Repeater {
        model: [0.04, 0.27, 0.5, 0.73, 0.94]
        delegate: Image {
            x: Math.round((modelData * root.width - 48) / 16) * 16
            y: 0
            smooth: false
            source: T.DIR + "shaft-" + Math.min(T.SHAFT.levels - 1, Math.round(root.dl * 2) + (Math.floor(root.tick / (30 + 8 * index)) + index & 1)) + ".png"
        }
    }

    // ── wave line, scrolling one texel per two steps ──
    Item {
        id: surface
        width: root.width
        height: T.SURFACE.rows
        Item {
            x: -(Math.floor(root.tick / 2) % T.SURFACE.cols)
            width: root.width + 2 * T.SURFACE.cols
            height: parent.height
            Repeater {
                model: Math.ceil(root.width / T.SURFACE.cols) + 2
                delegate: Image {
                    x: index * T.SURFACE.cols
                    smooth: false
                    source: T.DIR + "surface.png"
                }
            }
        }
    }

    // ── kelp ──
    Repeater {
        model: [[0.06, 1], [0.15, 0], [0.31, 2], [0.43, 0], [0.58, 1], [0.69, 2], [0.82, 0], [0.93, 1]]
        delegate: Image {
            x: Math.round(modelData[0] * root.width)
            y: root.height - T.SEABED.rows + 10 - T.KELP[modelData[1]].rows
            smooth: false
            source: T.DIR + "kelp-" + modelData[1] + "-" + [0, 1, 2, 1][(Math.floor(root.tick / 4) + index) & 3] + ".png"
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

    // ── specks: one texel each, sinking slowly, swaying; the colour follows the water tone behind ──
    Repeater {
        model: 14
        delegate: Rectangle {
            readonly property real sx: ((index * 0.618034 + 0.13) % 1)
            readonly property real sy: ((index * 0.754878 + 0.31) % 1)
            readonly property real spd: 0.04 + (index % 4) * 0.025
            readonly property real py: (sy * root.height + root.tick * spd) % (root.height - T.SEABED.rows + 4)
            width: 1
            height: 1
            x: Math.floor(sx * root.width) + ((Math.floor(root.tick / (9 + index % 5)) + index) % 3) - 1
            y: Math.floor(py)
            color: T.waterDensity(root.dl, py / root.height) > 0.5 ? T.INK : T.PAPER
        }
    }
}
