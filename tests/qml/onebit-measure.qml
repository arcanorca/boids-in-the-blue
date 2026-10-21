// Measurement scene for the "onebit" theme (driven by tests/onebit-measure.js). Modes:
//   calm   <outDir>   no creatures, ambient running: 1920x1080 grabs over ~10 s (FRAME lines)
//   motion <outDir>   one fish at constant velocity: its on-screen x on every rendered frame (MOTION lines)
//   stress <outDir>   40 fish at stress 1.5: per-sprite state changes over time (STRESS line)
// Run: QT_QPA_PLATFORM=offscreen qml6 tests/qml/onebit-measure.qml -- <mode> <outDir>
import QtQuick
import QtQuick.Window
import "../../contents/ui/code/boids.js" as Boids
import "../../contents/ui/code/themes.js" as Themes

Window {
    id: win
    width: 1920
    height: 1080
    visible: true
    color: "black"

    readonly property var args: Qt.application.arguments
    readonly property string mode: args[args.length - 2]
    readonly property string outDir: args[args.length - 1]
    property var sim: null
    property var cfg: ({})
    property double t0: Date.now()
    property int n: 0
    property var times: []
    property var stats: ({})
    property double vx: 4.0               // motion mode: px per 40 ms tick

    Loader {
        id: scene
        anchors.fill: parent
        source: Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile("onebit"))
    }

    // the real 40 ms loop (calm / stress: the simulation; motion: a scripted entity)
    Timer {
        id: tick
        interval: 40
        repeat: true
        running: false
        onTriggered: {
            if (win.mode === "motion") {
                var f = win.sim.entities.fish[0];
                f.x += win.vx; f.vx = win.vx; f.vy = 0; f.facingRight = true;
            } else Boids.step(win.sim, 1, win.cfg);
            scene.item.sync(win.sim);
            if (win.mode === "stress") win.sampleStress();
        }
    }

    // calm: grab every 100 ms for 10.5 s
    Timer {
        id: grabber
        interval: 100
        repeat: true
        running: false
        onTriggered: {
            var ms = Date.now() - win.t0, idx = win.n++;
            scene.item.grabToImage(function (r) {
                var file = win.outDir + "/calm-" + idx + ".png";
                r.saveToFile(file);
                console.log("FRAME " + idx + " " + ms + " " + file);
            });
            if (ms > 10300) { grabber.stop(); finish.start(); }
        }
    }
    Timer { id: finish; interval: 1500; onTriggered: Qt.quit() }

    // motion: sample the sprite on every rendered frame
    FrameAnimation {
        running: win.mode === "motion"
        onTriggered: {
            var f = win.sim ? win.sim.entities.fish[0] : null;
            if (!f || !f.delegate || tick.running === false) return;
            var p = f.delegate.mapToItem(null, 0, 0);
            console.log("MOTION " + (Date.now() - win.t0) + " " + p.x.toFixed(3) + " " + p.y.toFixed(3));
        }
    }
    Timer { id: motionEnd; interval: 3800; onTriggered: Qt.quit() }

    // stress: per fish, count changes of the inverted flag and of the tremble offset
    property var prev: ({})
    property var flips: ({})
    property var shakes: ({})
    function sampleStress() {
        var fish = sim.entities.fish;
        for (var i = 0; i < fish.length; i++) {
            var d = fish[i].delegate;
            if (!d) continue;
            var inv = /-i\.png$/.test(d.src) ? 1 : 0, sh = d.shakeX * 7 + d.shakeY;
            var pv = prev[i];
            if (pv !== undefined) {
                if (pv[0] !== inv) flips[i] = (flips[i] || 0) + 1;
                if (pv[1] !== sh) shakes[i] = (shakes[i] || 0) + 1;
            }
            prev[i] = [inv, sh];
        }
        stats.samples = (stats.samples || 0) + 1;
        var inv0 = 0;
        for (var j = 0; j < fish.length; j++) if (prev[j] && prev[j][0]) inv0++;
        stats.invShare = inv0 / fish.length;
    }
    Timer {
        id: stressEnd
        interval: 8000
        onTriggered: {
            var fl = 0, sk = 0, flN = 0, skN = 0, k;
            for (k in flips) { fl = Math.max(fl, flips[k]); flN++; }
            for (k in shakes) { sk = Math.max(sk, shakes[k]); skN++; }
            var secs = stats.samples * 0.04;
            console.log("STRESS secs " + secs.toFixed(2) + " maxFlipsPerSec " + (fl / secs).toFixed(2) + " flippingFish " + flN +
                        " maxShakeChangesPerSec " + (sk / secs).toFixed(2) + " shakingFish " + skN + " invShare " + stats.invShare.toFixed(2) + " fish " + sim.entities.fish.length);
            Qt.quit();
        }
    }

    Component.onCompleted: {
        if (mode === "calm") { cfg.fishCount = 0; cfg.anglerCount = 0; cfg.orcaCount = 0; cfg.jellyCount = 0; }
        else if (mode === "motion") { cfg.fishCount = 1; cfg.anglerCount = 0; cfg.orcaCount = 0; cfg.jellyCount = 0; }
        else { cfg.fishCount = 40; cfg.anglerCount = 0; cfg.orcaCount = 0; cfg.jellyCount = 0; }
        sim = Boids.createSimulation(1920, 1080, 1, cfg);
        scene.item.sim = sim;
        if (mode === "motion") {
            for (var s3 = 0; s3 < 5; s3++) Boids.step(sim, 1, cfg);
            var f = sim.entities.fish[0];
            f.x = 200; f.y = 540; f.vx = vx; f.vy = 0; f.facingRight = true;
            scene.item.sync(sim);
            tick.start();
            motionEnd.start();
        } else if (mode === "stress") {
            for (var s = 0; s < 100; s++) Boids.step(sim, 1, cfg);
            sim.cpuStress = 1.5; sim.speedMultiplier = 1.6;
            tick.start();
            stressEnd.start();
        } else {
            for (var s2 = 0; s2 < 50; s2++) Boids.step(sim, 1, cfg);
            scene.item.sync(sim);
            tick.start();
            win.t0 = Date.now();
            grabber.start();
        }
    }
}
