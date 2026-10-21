import QtQuick
import "theme.js" as T

// Backdrop of the "terminal" theme, in texel space (see Scene.qml). Everything here is static text except the kelp,
// which sways one 2-frame step every 2 s (0.5 Hz) and the load bar, which changes at most once per second and only
// when its 5 % step changes. The prompt cursor is a plain block that never blinks.
// One Timer at 2 Hz drives the kelp sway, one at 1 Hz the load bar; nothing animates while `paused`.
Item {
    id: root

    property bool paused: false
    property real daylight: 1.0                    // 0 night .. 1 day
    property real stress: 0                        // sim.cpuStress, sampled by Scene.sync
    readonly property bool night: T.nightSet(daylight)
    readonly property string set: T.baseSet(night)  // the palette set of the backdrop: day green or night green
    property int tick: 0
    property int shownLevel: -1                    // the load bar level on screen (5 % steps, sampled at 1 Hz)

    clip: true

    Timer {
        interval: 500
        repeat: true
        running: !root.paused && root.width > 0
        onTriggered: root.tick++
    }
    Timer {
        interval: 1000
        repeat: true
        running: !root.paused && root.width > 0
        triggeredOnStart: true
        onTriggered: root.shownLevel = T.loadLevel(root.stress)
    }

    // ── the waves: one row of tildes at the top, under the floating panel ──
    Image {
        y: T.SURFACE.y
        width: root.width
        height: T.SURFACE.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + "waves-" + root.set + ".png"
    }

    // ── the dot lattice: sparse, regular, dimmer and thinner with depth ──
    Repeater {
        model: T.DOTS
        delegate: Image {
            y: modelData.y
            width: root.width
            height: modelData.rows
            fillMode: Image.Tile
            smooth: false
            source: T.DIR + "dots-" + modelData.name + "-" + root.set + ".png"
        }
    }

    // ── kelp: stalks standing on the seabed top; each plant swaps its 2 frames every 2 s, out of step ──
    Repeater {
        model: T.KELP_PLANTS
        delegate: Image {
            readonly property int cls: modelData[1]
            x: Math.round(modelData[0] * root.width) - Math.floor(T.CELL_W / 2)
            y: T.SEABED_TOP_Y - T.KELP[cls].rows * T.CELL_H
            smooth: false
            source: T.DIR + T.kelpFile(cls, (Math.floor(root.tick / 4) + index) & 1, root.set)
        }
    }

    // ── the seabed: four text rows of ground; the bottom one carries the prompt and the load bar ──
    Image {
        y: T.SEABED.y
        width: root.width
        height: T.SEABED.rows
        fillMode: Image.Tile
        smooth: false
        source: T.DIR + "seabed-" + root.set + ".png"
    }

    // ── prompt line at the bottom left, a plain block cursor (no blink) ──
    Image {
        x: T.PROMPT.x
        y: T.PROMPT.y
        smooth: false
        source: T.DIR + "prompt-" + root.set + ".png"
    }

    // ── htop-style load bar at the bottom right ──
    Image {
        x: root.width - T.STATUS.cols * T.CELL_W - T.CELL_W
        y: T.STATUS.y
        smooth: false
        source: T.DIR + T.statusFile(root.shownLevel, root.set)
    }
}
