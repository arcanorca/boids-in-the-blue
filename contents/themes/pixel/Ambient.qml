import QtQuick
import "theme.js" as T

// Ambient scene for the "pixel" theme: smooth water gradient, drifting surface ripples, a few light
// shafts, sparse marine snow and a sandy seabed silhouette. Everything sits behind the creatures.
//
// Cost: one gradient rectangle, ~5 + ~20 + 1 animated items, all driven by GPU-side
// animators (opacity / x / y), no per-frame JavaScript. Every animation stops while `paused`.
Item {
    id: root

    property bool paused: false
    property real daylight: 1.0        // 0 night .. 1 day (1 when the day/night cycle is off)
    property string customTop: ""      // user-chosen water colours ("" = the theme's own)
    property string customBottom: ""

    // art pixel size on screen: 2 px at 1080p, scaled with the screen like the sprites' physical size
    readonly property int ps: Math.max(2, Math.round(height / 540))
    readonly property real lightK: 0.25 + 0.75 * daylight

    // Animators read their from/to only when they start: wait for a real size and restart them
    // (one event-loop turn off, then on) whenever the size changes, so they follow resolution changes.
    property bool _settled: true
    function _resized() { _settled = false; Qt.callLater(function () { root._settled = true; }); }
    onWidthChanged: _resized()
    onHeightChanged: _resized()
    readonly property bool running: !paused && _settled && width > 0 && height > 0

    clip: true

    // ── water: one smooth vertical gradient (same colours as before, no visible steps) ──
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: T.STOPS[0]; color: T.stopColor(0, root.daylight, root.customTop, root.customBottom) }
            GradientStop { position: T.STOPS[1]; color: T.stopColor(1, root.daylight, root.customTop, root.customBottom) }
            GradientStop { position: T.STOPS[2]; color: T.stopColor(2, root.daylight, root.customTop, root.customBottom) }
        }
    }

    // ── surface ripples: one strip scrolled by a single animator ──
    Item {
        id: surface
        width: root.width
        height: 6 * root.ps
        opacity: 0.55 * root.lightK
        Item {
            id: strip
            width: parent.width + 64 * root.ps
            height: parent.height
            XAnimator on x {
                from: 0
                to: -64 * root.ps
                duration: 26000
                loops: Animation.Infinite
                running: root.running
            }
            Repeater {
                model: Math.ceil(root.width / (64 * root.ps)) + 1
                delegate: Image {
                    x: index * 64 * root.ps
                    width: 64 * root.ps
                    height: 6 * root.ps
                    smooth: false
                    source: T.DIR + "surface.png"
                }
            }
        }
    }

    // ── light shafts ──
    Repeater {
        model: [0.07, 0.26, 0.47, 0.68, 0.88]
        delegate: Item {
            id: shaft
            readonly property real baseX: modelData * root.width - 18 * root.ps
            x: baseX
            width: 36 * root.ps
            height: 200 * root.ps
            opacity: (0.55 + (index % 3) * 0.15) * root.lightK * 0.55
            Image {
                anchors.fill: parent
                smooth: false
                source: T.DIR + "shaft.png"
                OpacityAnimator on opacity {
                    from: 0.45; to: 1.0
                    duration: 7000 + index * 1900
                    easing.type: Easing.InOutSine
                    loops: Animation.Infinite
                    running: root.running
                }
            }
            XAnimator on x {
                from: shaft.baseX - 8 * root.ps; to: shaft.baseX + 8 * root.ps
                duration: 21000 + index * 4300
                easing.type: Easing.SineCurve
                loops: Animation.Infinite
                running: root.running
            }
        }
    }

    // ── seabed ──
    Item {
        id: seabed
        anchors.bottom: parent.bottom
        width: parent.width
        height: T.SEABED.rows * root.ps
        opacity: 0.45 + 0.55 * root.daylight
        Repeater {
            model: Math.ceil(root.width / (T.SEABED.cols * root.ps))
            delegate: Image {
                x: index * T.SEABED.cols * root.ps
                width: T.SEABED.cols * root.ps
                height: T.SEABED.rows * root.ps
                smooth: false
                source: T.DIR + "seabed.png"
            }
        }
    }

    // ── marine snow: 4 slow layers (3-6 specks each, drawn twice one screen apart so the loop is
    //    seamless); one animator per layer instead of one per speck ──
    Repeater {
        model: 4
        delegate: Item {
            id: flakes
            readonly property int layerIndex: index
            width: root.width
            height: root.height * 2
            YAnimator on y {
                from: -root.height; to: 0
                duration: 90000 - index * 17000
                loops: Animation.Infinite
                running: root.running
            }
            XAnimator on x {
                from: -3 * root.ps; to: 3 * root.ps
                duration: 8000 + index * 2300
                easing.type: Easing.SineCurve
                loops: Animation.Infinite
                running: root.running
            }
            Repeater {
                model: 12
                delegate: Rectangle {
                    readonly property int k: index % 6
                    readonly property real seed: flakes.layerIndex * 6 + k
                    width: root.ps * (flakes.layerIndex > 1 ? 2 : 1)
                    height: width
                    x: ((seed * 0.618034 + 0.13) % 1) * root.width
                    y: ((seed * 0.754878 + 0.31) % 1) * root.height + (index >= 6 ? root.height : 0)
                    color: "#d6eeff"
                    opacity: (0.28 + flakes.layerIndex * 0.1) * root.lightK + 0.1
                }
            }
        }
    }
}
