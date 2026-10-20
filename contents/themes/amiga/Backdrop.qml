import QtQuick
import "theme.js" as T

// Backdrop of the "amiga" theme, back to front:
//   copper lists (night | dusk | day | stress palette swap), colour-cycled light shafts,
//   far rocks, kelp + corals (sway frames), sand.
// Everything is a handful of textures on the virtual pixel grid; a single 5 Hz tick (stopped while
// `paused`) steps the cycle/sway frames and the slow parallax drift, in whole virtual pixels.
Item {
    id: root

    property int vp: 4
    property bool paused: false
    property real daylight: 1
    property real stress: 0                // palette-swap step 0..1 (quarters)
    property int tick: 0

    clip: true

    readonly property var w: T.copperWeights(daylight)
    readonly property real lightK: 0.3 + 0.7 * daylight

    Timer {
        interval: 200
        repeat: true
        running: !root.paused && root.width > 0
        onTriggered: root.tick++
    }

    // copper lists: 1 texel = 1 virtual pixel, top-aligned (the bottom scanlines are behind the sand)
    Repeater {
        model: [["night", 1], ["dusk", 0], ["day", 0], ["stress", 0]]
        delegate: Image {
            readonly property real k: index === 1 ? root.w.dusk : (index === 2 ? root.w.day : (index === 3 ? root.stress * 0.8 : 1))
            width: Math.max(T.COPPER.w * root.vp, root.width)
            height: T.COPPER.h * root.vp
            smooth: false
            opacity: k
            visible: k > 0.002
            source: visible ? T.DIR + "copper-" + modelData[0] + ".png" : ""
        }
    }
    // colour-cycled light shafts + surface ripples (6 frames, ~2.5 fps)
    Image {
        width: Math.max(T.CAUSTICS.w * root.vp, root.width)
        height: T.CAUSTICS.h * root.vp
        smooth: false
        opacity: 0.2 + 0.7 * root.daylight
        source: T.DIR + "caustics-" + (Math.floor(root.tick / 2) % T.CAUSTICS.frames) + ".png"
    }
    TileStrip {
        vp: root.vp; tw: T.FAR.tw; h: T.FAR.h
        offset: Math.floor(root.tick * T.DRIFT.far / 5)
        anchors.bottomMargin: 12 * root.vp
        source: T.DIR + "far.png"
    }
    TileStrip {
        vp: root.vp; tw: T.KELP.tw; h: T.KELP.h
        offset: Math.floor(root.tick * T.DRIFT.mid / 5)
        source: T.DIR + "kelp-" + (Math.floor(root.tick / 3) % T.KELP.frames) + ".png"
    }
    TileStrip {
        vp: root.vp; tw: T.GROUND.tw; h: T.GROUND.h
        offset: Math.floor(root.tick * T.DRIFT.mid / 5)
        source: T.DIR + "ground.png"
    }
}
