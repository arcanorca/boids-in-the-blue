import QtQuick
import "theme.js" as T

// Background of the "nes" theme, built like an NES screen: a universal backdrop colour, a water gradient
// (a dithered texture of two NES teal / navy entries, see theme.js WATER), a static waterline and a seabed nametable. The day /
// dusk / night looks are palette swaps (textures baked per palette state). It is calm: the water,
// the waterline and the seabed never move. One 2 Hz tick (a Timer that stops while `paused`) steps
// the kelp sway (a bank switch, 1 Hz), the glints and the few ambient bubbles, in whole virtual
// pixels and never faster than 2 Hz; nothing else animates.
//
// Cost: one water texture + a few surface/seabed tiles + 8 glints + 6 bubbles, no per-frame
// JavaScript beyond the 2 Hz tick.
Item {
    id: root

    property bool paused: false
    property real daylight: 1.0        // 0 night .. 1 day (1 when the day/night cycle is off)

    readonly property int ps: T.pxFor(height)                   // screen px per virtual px
    readonly property int vw: Math.ceil(width / ps)
    readonly property int vh: Math.ceil(height / ps)
    readonly property string state: T.bgState(daylight)
    readonly property var pal: T.BG[state]

    property int tick: 0
    readonly property int kelpFrame: (tick >> 1) & 1            // kelp sways every 2 ticks (1 s per frame)
    readonly property int groundV: vh - (T.SEABED.rows * 8 - 64)

    clip: true

    Timer {
        interval: 500                                           // 2 Hz: the slowest rate the calm scene uses
        repeat: true
        running: !root.paused && root.width > 0 && root.height > 0
        onTriggered: root.tick++
    }

    // water: one dithered gradient texture per palette state (see gen-nes-theme.js, T.WATER)
    Image {
        anchors.fill: parent
        smooth: false
        source: T.DIR + T.waterFile(root.state)
    }

    // waterline: 256-px nametable, static
    Item {
        x: 0
        y: 0
        width: root.width
        height: 16 * root.ps
        Repeater {
            model: Math.ceil(root.width / (T.SURFACE.cols * 8 * root.ps))
            delegate: Image {
                x: index * T.SURFACE.cols * 8 * root.ps
                width: T.SURFACE.cols * 8 * root.ps
                height: 16 * root.ps
                smooth: false
                source: T.DIR + T.surfaceFile(root.state)
            }
        }
    }

    // water glints: a tile that twinkles for 2 of every 8 ticks (4 s cycle, 1 s lit; the large
    // frame on the first lit tick)
    Repeater {
        model: T.GLINTS
        delegate: Image {
            readonly property int phase: (root.tick + modelData[2]) % 8
            x: Math.round(modelData[0] * root.vw) * root.ps
            y: Math.round(modelData[1] * root.vh) * root.ps
            width: 8 * root.ps
            height: 8 * root.ps
            smooth: false
            visible: phase < 2
            source: visible ? T.DIR + T.glintFile(root.state, phase === 0 ? 1 : 0) : ""
        }
    }

    // ambient bubbles rising from the seabed (sprites, 2 Hz steps of 0.5 or 1 virtual px)
    Repeater {
        model: T.VENTS
        delegate: Image {
            readonly property real seed: index * 37 + modelData[0] * 5
            readonly property int rise: Math.max(40, root.groundV - 24)
            readonly property int off: (root.tick * (modelData[1] > 4 ? 1 : 0.5) + seed) % rise
            x: (modelData[0] * 8 + Math.round(Math.sin(root.tick / 6 + seed) * 1.2)) * root.ps
            y: (root.groundV - 8 - Math.floor(off)) * root.ps
            width: 8 * root.ps
            height: 8 * root.ps
            smooth: false
            visible: x < root.width
            source: T.DIR + "bubble-" + (index % 2 ? "m" : "s") + ".png"
        }
    }

    // seabed nametable, bottom aligned, repeated across wide screens
    Item {
        anchors.bottom: parent.bottom
        width: parent.width
        height: T.SEABED.rows * 8 * root.ps
        Repeater {
            model: Math.ceil(root.width / (T.SEABED.cols * 8 * root.ps))
            delegate: Image {
                x: index * T.SEABED.cols * 8 * root.ps
                width: T.SEABED.cols * 8 * root.ps
                height: T.SEABED.rows * 8 * root.ps
                smooth: false
                source: T.DIR + T.seabedFile(root.state, root.kelpFrame)
            }
        }
    }
}
