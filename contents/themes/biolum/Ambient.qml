import QtQuick
import "theme.js" as Theme

// Ambience of the deep: far light shafts + a faint caustic web (behind the animals), drifting
// marine snow with three depth tiers (the nearest, out-of-focus tier passes in front), pooled
// bioluminescent sparkles where fish swim, and a vignette.
//
// Budget: ~60 small items, all motion on GPU-side animators; two slow Timers (shafts/caustics at
// 3 Hz, sparkles at ~4 Hz). Everything stops when running is false (wallpaper paused).
//
// Host contract (main.qml / tests/qml/render.qml): fill the wallpaper, set `stage` to the item the
// front layer should be drawn in (so it can be stacked above the entities), and bind
// running / sim / daylight (0 night .. 1 day).
Item {
    id: ambient

    property bool running: true
    property var sim: null
    property real daylight: 1.0
    property Item stage: ambient

    property bool _on: true                    // toggled on resize so animators restart with the new height
    onHeightChanged: { _on = false; Qt.callLater(function () { ambient._on = true; }); }
    readonly property bool _go: running && _on && height > 0
    onRunningChanged: if (!running) for (var i = 0; i < sparks.count; i++) sparks.itemAt(i).halt()

    function rnd(i, salt) { var x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); }

    // ── light from far above ─────────────────────────────────
    Repeater {
        id: shafts
        model: 3
        delegate: Image {
            readonly property real x0: ambient.width * (0.12 + 0.34 * index + 0.06 * (index % 2))
            x: x0
            y: -ambient.height * 0.04
            width: ambient.width * (0.20 + 0.05 * index)
            height: ambient.height * 1.0
            source: Theme.DIR + "shaft.png"
            opacity: 0.0
            smooth: true
        }
    }
    Image {
        id: web1
        readonly property real tileW: 512 * height / 320
        width: ambient.width * 1.2
        height: ambient.height * 0.42
        fillMode: Image.TileHorizontally
        source: Theme.DIR + "caustic.png"
        opacity: 0
    }
    Image {
        id: web2
        readonly property real tileW: 512 * height / 320
        width: ambient.width * 1.2
        height: ambient.height * 0.42
        fillMode: Image.TileHorizontally
        source: Theme.DIR + "caustic.png"
        opacity: 0
    }
    property double _t: 0
    Timer {
        interval: 330
        repeat: true
        running: ambient.running
        triggeredOnStart: true
        onTriggered: {
            ambient._t += 0.33;
            var t = ambient._t, dl = 0.18 + 0.82 * ambient.daylight;
            for (var i = 0; i < 3; i++) {
                var s = shafts.itemAt(i);
                if (!s) continue;
                s.opacity = (0.075 + 0.04 * Math.sin(t * (0.21 + 0.07 * i) + i * 2.1)) * dl;
                s.x = s.x0 + Math.sin(t * 0.06 + i * 1.7) * ambient.width * 0.025;
            }
            web1.opacity = (0.075 + 0.030 * Math.sin(t * 0.35)) * dl;
            web2.opacity = (0.065 + 0.030 * Math.cos(t * 0.29)) * dl;
            web1.x = -(t * 2.2) % web1.tileW;
            web2.x = -web2.tileW + (t * 1.5) % web2.tileW;
            web1.y = web2.y = 0;
        }
    }

    // ── marine snow, far + mid tiers (behind the animals) ──
    Repeater {
        id: snowBack
        model: 44
        delegate: Image {
            id: p
            readonly property bool far: index < 30
            readonly property real r1: ambient.rnd(index, 1)
            readonly property real r2: ambient.rnd(index, 2)
            readonly property real r3: ambient.rnd(index, 3)
            readonly property real x0: r1 * ambient.width
            readonly property real y0: r2 * ambient.height
            readonly property real amp: far ? 10 + 14 * r3 : 18 + 26 * r3
            readonly property int dur: (far ? 130000 : 80000) + r3 * 50000
            source: Theme.DIR + (far ? "snow-s.png" : "snow-m.png")
            width: (far ? 3.6 : 7.5) * (0.65 + 0.7 * r3)
            height: width
            smooth: true
            opacity: far ? 0.30 + 0.35 * r3 : 0.38 + 0.35 * r2
            x: x0
            y: y0
            SequentialAnimation {
                running: ambient._go
                YAnimator { target: p; from: p.y0; to: ambient.height + 20; duration: Math.max(1, p.dur * (ambient.height + 20 - p.y0) / (ambient.height + 40)) }
                SequentialAnimation {
                    loops: Animation.Infinite
                    YAnimator { target: p; from: -20; to: ambient.height + 20; duration: p.dur }
                }
            }
            SequentialAnimation {
                running: ambient._go
                loops: Animation.Infinite
                XAnimator { target: p; from: p.x0 - p.amp; to: p.x0 + p.amp; duration: 9000 + p.r1 * 9000; easing.type: Easing.InOutSine }
                XAnimator { target: p; from: p.x0 + p.amp; to: p.x0 - p.amp; duration: 9000 + p.r1 * 9000; easing.type: Easing.InOutSine }
            }
        }
    }

    // ── front layer (drawn on `stage`, above the animals): near bokeh snow, sparkles, vignette ──
    Item {
        id: front
        parent: ambient.stage
        anchors.fill: parent
        z: 2.5
        enabled: false

        Repeater {
            id: snowFront
            model: 7
            delegate: Image {
                id: q
                readonly property real r1: ambient.rnd(index + 100, 1)
                readonly property real r2: ambient.rnd(index + 100, 2)
                readonly property real r3: ambient.rnd(index + 100, 3)
                readonly property real x0: r1 * ambient.width
                readonly property real y0: r2 * ambient.height
                readonly property int dur: 45000 + r3 * 25000
                source: Theme.DIR + "snow-bokeh.png"
                width: 26 + 40 * r3
                height: width
                smooth: true
                opacity: 0.16 + 0.18 * r1
                x: x0
                y: y0
                SequentialAnimation {
                    running: ambient._go
                    YAnimator { target: q; from: q.y0; to: ambient.height + 40; duration: Math.max(1, q.dur * (ambient.height + 40 - q.y0) / (ambient.height + 80)) }
                    SequentialAnimation {
                        loops: Animation.Infinite
                        YAnimator { target: q; from: -40; to: ambient.height + 40; duration: q.dur }
                    }
                }
                SequentialAnimation {
                    running: ambient._go
                    loops: Animation.Infinite
                    XAnimator { target: q; from: q.x0 - 30; to: q.x0 + 30; duration: 12000 + q.r2 * 8000; easing.type: Easing.InOutSine }
                    XAnimator { target: q; from: q.x0 + 30; to: q.x0 - 30; duration: 12000 + q.r2 * 8000; easing.type: Easing.InOutSine }
                }
            }
        }

        Repeater {
            id: sparks
            model: 16
            delegate: Image {
                id: sp
                property string key: "cyan"
                width: 52
                height: 52
                smooth: true
                opacity: 0
                scale: 0.5
                source: Theme.DIR + "spark-" + key + ".png"
                function fire(px, py, k, sc) {
                    key = k; width = height = 52 * sc; x = px - width / 2; y = py - height / 2;
                    anim.restart();
                }
                // the wallpaper is paused: a sparkle in flight just disappears
                function halt() { anim.stop(); opacity = 0; }
                // plain (GUI-thread) animations: at most a handful run at once, one-shot
                ParallelAnimation {
                    id: anim
                    SequentialAnimation {
                        NumberAnimation { target: sp; property: "opacity"; from: 0; to: 0.9; duration: 220; easing.type: Easing.OutQuad }
                        NumberAnimation { target: sp; property: "opacity"; from: 0.9; to: 0; duration: 1500; easing.type: Easing.InQuad }
                    }
                    NumberAnimation { target: sp; property: "scale"; from: 0.45; to: 1.1; duration: 1720; easing.type: Easing.OutQuad }
                }
            }
        }

        Image {
            anchors.fill: parent
            source: Theme.DIR + "vignette.png"
            smooth: true
        }
    }

    // sparkles: where a moving fish was a moment ago (plankton disturbed by the wake)
    property int _si: 0
    Timer {
        interval: 240
        repeat: true
        running: ambient.running && !!ambient.sim
        onTriggered: {
            var fish = ambient.sim.entities.fish;
            if (!fish || fish.length === 0) return;
            for (var tries = 0; tries < 4; tries++) {
                var f = fish[Math.floor(Math.random() * fish.length)];
                var sp2 = f.vx * f.vx + f.vy * f.vy;
                if (sp2 < 0.09 || f.x < 0 || f.y < 0) continue;
                var s = sparks.itemAt(ambient._si);
                ambient._si = (ambient._si + 1) % 16;
                if (s) s.fire(f.x - f.vx * 16 + (Math.random() - 0.5) * 10, f.y - f.vy * 16 + (Math.random() - 0.5) * 10,
                              Theme.sparkKey(f.color), 0.9 + Math.random() * 0.8);
                break;
            }
        }
    }
}
