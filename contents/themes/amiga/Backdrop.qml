import QtQuick
import "theme.js" as T

// Backdrop of the "amiga" theme, back to front:
//   copper lists (night | dusk | day | stress, cross-faded only when the scene changes, never pulsing),
//   static soft light shafts, far hills, hazy back plants, kelp, sand (+ rocks, corals), marine snow.
// Everything is static art except: the plants sway slowly (one 14 s loop, a few whole pixels), a few specks of
// marine snow drift down. Nothing is colour-cycled, nothing flashes; all of it stops when `paused`.
Item {
    id: root
    objectName: "backdrop"

    property int vp: 3
    property bool paused: false
    property real daylight: 1
    property real stress: 0                // palette-swap step 0..1 (quarters)
    property real sway: 0                  // 0..1, one slow loop (plants)

    clip: true

    readonly property var w: T.copperWeights(daylight)
    readonly property bool running: !paused && width > 0

    // the plants' sway clock (one 14 s loop), updated 10x/s: their offsets are whole screen pixels anyway
    Timer {
        interval: 100
        repeat: true
        running: root.running
        triggeredOnStart: true
        onTriggered: root.sway = (Date.now() % 14000) / 14000
    }
    // the specks' sideways drift (smooth, one 7 s loop)
    property real drift: 0
    NumberAnimation on drift {
        from: 0
        to: 1
        duration: 7000
        loops: Animation.Infinite
        running: root.running
    }

    // copper lists: a 1-texel-wide strip of 540 scanlines stretched over the screen height. Day/dusk/night are
    // cross-faded by `daylight` (slowly, hours); only the layers that can be seen are drawn (an opaque list hides
    // everything below it). The stress colour swap shows ONE opaque pre-mixed list (stress-<base>-<k>) that
    // fades in over 1.5 s when the level changes: no full-screen blend in the steady state, no pulsing.
    readonly property int stressIdx: Math.round(Math.max(0, Math.min(1, stress)) * T.COPPER.stressSteps)
    readonly property string stressBase: T.stressList(daylight)
    property bool settled: true            // stress fades finished: the lists below are hidden
    onStressIdxChanged: { settled = false; settleTimer.restart(); }
    onStressBaseChanged: { settled = false; settleTimer.restart(); }
    Timer { id: settleTimer; interval: 1700; onTriggered: root.settled = true }
    readonly property bool baseVisible: !(settled && stressIdx > 0)

    Repeater {
        model: ["night", "dusk", "day"]
        delegate: Image {
            required property int index
            required property string modelData
            readonly property real k: index === 1 ? root.w.dusk : (index === 2 ? root.w.day : 1)
            anchors.fill: parent
            smooth: false
            opacity: k
            visible: root.baseVisible && k > 0.002 && (index === 2 || (index === 1 ? root.w.day < 0.999 : (root.w.day < 0.999 && root.w.dusk < 0.999)))
            source: visible ? T.DIR + "copper-" + modelData + ".png" : ""
        }
    }
    Repeater {
        model: 12
        delegate: Image {
            required property int index
            readonly property string base: T.COPPER.lists[Math.floor(index / T.COPPER.stressSteps)]
            readonly property int step: index % T.COPPER.stressSteps + 1
            anchors.fill: parent
            smooth: false
            opacity: (base === root.stressBase && step === root.stressIdx) ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: 1500 } }
            visible: opacity > 0.002
            source: visible ? T.DIR + "copper-stress-" + base + "-" + step + ".png" : ""
        }
    }
    // static soft light shafts (smooth alpha, no stipple)
    Image {
        anchors.fill: parent
        smooth: true
        opacity: 0.2 + 0.8 * root.daylight
        source: T.DIR + "rays.png"
    }
    TileStrip {
        vp: root.vp; tw: T.FAR.tw; h: T.FAR.h
        anchors.bottomMargin: 4 * root.vp
        source: T.DIR + "far.png"
    }
    Repeater {
        model: root.width > 0 ? T.layout("back", Math.ceil(root.width / root.vp)) : []
        delegate: Stalk {
            required property var modelData
            species: modelData.n
            vp: root.vp
            sway: root.sway
            ph: modelData.ph
            flip: modelData.flip
            lean: 0.02
            x: modelData.x * root.vp
            y: root.height - 7 * root.vp
        }
    }
    Repeater {
        model: root.width > 0 ? T.layout("front", Math.ceil(root.width / root.vp)) : []
        delegate: Stalk {
            required property var modelData
            species: modelData.n
            vp: root.vp
            sway: root.sway
            ph: modelData.ph
            flip: modelData.flip
            x: modelData.x * root.vp
            y: root.height - 4 * root.vp
        }
    }
    TileStrip {
        vp: root.vp; tw: T.GROUND.tw; h: T.GROUND.h
        source: T.DIR + "ground.png"
    }
    // marine snow: a few specks drifting down slowly with a gentle sideways sway (whole screen pixels)
    Repeater {
        model: root.width > 0 ? 20 : 0
        delegate: Rectangle {
            required property int index
            readonly property real bx: ((index * 389) % 997) / 997 * root.width
            readonly property real speed: 7 + (index * 53 % 11)                      // px/s
            property real p: 0
            readonly property real range: root.height - 8 * root.vp
            width: root.vp
            height: root.vp
            color: "#cfe"
            opacity: 0.22 + 0.2 * ((index * 7) % 5) / 4
            x: Math.round(bx + 7 * Math.sin(6.2831853 * (root.drift + index * 0.137)))
            y: Math.round(((p + index * 0.1618) % 1) * range)
            NumberAnimation on p {
                from: 0
                to: 1
                duration: Math.max(1000, range / speed * 1000)
                loops: Animation.Infinite
                running: root.running
            }
        }
    }
    // night: the scenery sinks into the water's own deep blue (soft top edge, bottom third only)
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 90 * root.vp
        opacity: 0.6 * (1 - T.smooth(0.0, 0.5, root.daylight))
        visible: opacity > 0.002
        gradient: Gradient {
            GradientStop { position: 0; color: "#00001a33" }
            GradientStop { position: 1; color: "#ff001a33" }
        }
    }
}
