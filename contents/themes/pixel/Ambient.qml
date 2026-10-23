import QtQuick
import "theme.js" as T

// Ambient scene for the "pixel" theme, back to front: a smooth water gradient (no steps), a few static
// light shafts (two of them breathe very slowly), the bright waterline with a drifting ripple strip, the
// distant hills, the plants and the sand of the seabed (all pre-baked, tiled textures on the integer art-pixel
// grid) and sparse marine snow. Everything sits behind the creatures.
//
// Calm by design: apart from the ripple strip and the snow nothing moves faster than a slow fade; the cost
// is one gradient rectangle and a few dozen items, with GPU-side animators (opacity / x / y), no per-frame
// JavaScript. Every animation stops while `paused`.
Item {
    id: root

    property int ps: 2                 // art pixel size on screen (see theme.js psFor)
    property bool paused: false
    property real daylight: 1.0        // 0 night .. 1 day (1 when the day/night cycle is off)
    property string customTop: ""      // user-chosen water colours ("" = the theme's own)
    property string customBottom: ""

    readonly property real lightK: 0.25 + 0.75 * daylight
    readonly property real floorK: 0.24 + 0.76 * daylight        // plants and sand fade into the dark at night

    // Animators read their from/to only when they start: wait for a real size and restart them
    // (one event-loop turn off, then on) whenever the size changes, so they follow resolution changes.
    property bool _settled: true
    function _resized() { _settled = false; Qt.callLater(function () { root._settled = true; }); }
    onWidthChanged: _resized()
    onHeightChanged: _resized()
    onPsChanged: _resized()
    readonly property bool running: !paused && _settled && width > 0 && height > 0

    clip: true

    // ── water: one smooth vertical gradient ──
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: T.STOPS[0]; color: T.stopColor(0, root.daylight, root.customTop, root.customBottom) }
            GradientStop { position: T.STOPS[1]; color: T.stopColor(1, root.daylight, root.customTop, root.customBottom) }
            GradientStop { position: T.STOPS[2]; color: T.stopColor(2, root.daylight, root.customTop, root.customBottom) }
            GradientStop { position: T.STOPS[3]; color: T.stopColor(3, root.daylight, root.customTop, root.customBottom) }
            GradientStop { position: T.STOPS[4]; color: T.stopColor(4, root.daylight, root.customTop, root.customBottom) }
        }
    }

    // ── light shafts: soft leaning bars, static except for two that breathe over about a minute ──
    Repeater {
        model: [0.06, 0.2, 0.37, 0.55, 0.7, 0.86]
        delegate: Image {
            required property int index
            required property real modelData
            readonly property bool wide: index % 2 === 0
            x: Math.round(modelData * root.width) - Math.round(width / 2)
            width: T.SHAFT.cols * root.ps
            height: T.SHAFT.rows * root.ps * (wide ? 1.0 : 0.82)
            fillMode: Image.Stretch
            mirror: index % 3 === 1
            smooth: false
            source: T.DIR + "shaft.png"
            opacity: (wide ? 0.5 : 0.34) * root.lightK
            OpacityAnimator on opacity {
                from: (wide ? 0.5 : 0.34) * root.lightK; to: (wide ? 0.5 : 0.34) * root.lightK * 0.62
                duration: 56000 + index * 9000
                easing.type: Easing.InOutSine
                loops: Animation.Infinite
                running: root.running && index < 2
            }
        }
    }

    // ── waterline (static) and the drifting ripple strip under it ──
    Item {
        width: root.width
        height: 4 * root.ps
        opacity: 0.35 + 0.65 * root.lightK
        Repeater {
            model: Math.ceil(root.width / (96 * root.ps))
            delegate: Image {
                x: index * 96 * root.ps
                width: 96 * root.ps
                height: 4 * root.ps
                smooth: false
                source: T.DIR + "waterline.png"
            }
        }
    }
    Item {
        y: 3 * root.ps
        width: root.width
        height: T.SURFACE.rows * root.ps
        opacity: 0.55 * root.lightK
        Item {
            width: parent.width + T.SURFACE.cols * root.ps
            height: parent.height
            XAnimator on x {
                from: 0
                to: -T.SURFACE.cols * root.ps
                duration: 34000
                loops: Animation.Infinite
                running: root.running
            }
            Repeater {
                model: Math.ceil(root.width / (T.SURFACE.cols * root.ps)) + 1
                delegate: Image {
                    x: index * T.SURFACE.cols * root.ps
                    width: T.SURFACE.cols * root.ps
                    height: T.SURFACE.rows * root.ps
                    smooth: false
                    source: T.DIR + "surface.png"
                }
            }
        }
    }

    // ── seabed: distant hills, plants, sand (each tiled; the plants stand behind the sand so their roots are hidden) ──
    Repeater {
        model: T.SEABED_LAYERS
        delegate: Item {
            id: tile
            required property var modelData
            readonly property int cols: modelData.cols
            readonly property int rows: modelData.rows
            readonly property string tex: modelData.tex
            anchors.bottom: parent.bottom
            width: root.width
            height: rows * root.ps
            opacity: modelData.k * root.floorK
            Repeater {
                model: Math.ceil(root.width / (tile.cols * root.ps))
                delegate: Image {
                    x: index * tile.cols * root.ps
                    width: tile.cols * root.ps
                    height: tile.rows * root.ps
                    smooth: false
                    source: T.DIR + tile.tex
                }
            }
        }
    }

    // ── marine snow: 3 slow layers (a few specks each, drawn twice one screen apart so the loop is
    //    seamless); one animator per layer instead of one per speck ──
    Repeater {
        model: 3
        delegate: Item {
            id: flakes
            readonly property int layerIndex: index
            width: root.width
            height: root.height * 2
            YAnimator on y {
                from: -root.height; to: 0
                duration: 110000 - index * 22000
                loops: Animation.Infinite
                running: root.running
            }
            XAnimator on x {
                from: -3 * root.ps; to: 3 * root.ps
                duration: 9000 + index * 2600
                easing.type: Easing.SineCurve
                loops: Animation.Infinite
                running: root.running
            }
            Repeater {
                model: 14
                delegate: Rectangle {
                    readonly property int k: index % 7
                    readonly property real seed: flakes.layerIndex * 7 + k
                    width: root.ps * (flakes.layerIndex > 0 && k % 3 === 0 ? 2 : 1)
                    height: width
                    x: ((seed * 0.618034 + 0.13) % 1) * root.width
                    y: ((seed * 0.754878 + 0.31) % 1) * root.height + (index >= 7 ? root.height : 0)
                    color: "#d6eeff"
                    opacity: (0.22 + flakes.layerIndex * 0.1) * root.lightK + 0.08
                }
            }
        }
    }
}
