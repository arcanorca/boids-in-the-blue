// CPU benchmark of a theme's Scene: runs the real 40 ms sim + sync loop (500 ticks = 20 s) in the
// offscreen QML engine and prints a BENCH line for tests/qml-bench.js.
// Run: QT_QPA_PLATFORM=offscreen qml6 tests/qml/bench.qml -- <theme> <fish=N,stress=S[,churn=1]>
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
    readonly property string spec: args[args.length - 1]
    property var sim: null
    property var cfg: ({})
    property int ticks: 0
    property int frames: 0
    property double stepMs: 0
    property double syncMs: 0
    property double stress: 0
    property bool churn: false

    Loader {
        id: scene
        anchors.fill: parent
        source: Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile(win.mode))
    }
    onAfterRendering: frames++

    Timer {
        id: loop
        interval: 40
        repeat: true
        running: false
        onTriggered: {
            var t0 = Date.now();
            if (win.churn && win.ticks % 3 === 0) {
                Boids.forceSpawnWorm(win.sim, 100 + (win.ticks * 37) % 1700, 60 + (win.ticks * 53) % 400);
                Boids.forceSpawnBubble(win.sim, 80 + (win.ticks * 71) % 1800, 700 + (win.ticks * 29) % 300);
            }
            Boids.step(win.sim, 1, win.cfg);
            var t1 = Date.now();
            scene.item.sync(win.sim);
            var t2 = Date.now();
            win.stepMs += t1 - t0; win.syncMs += t2 - t1;
            win.ticks++;
            if (win.ticks >= 500) {
                console.log("BENCH ticks " + win.ticks + " step_ms " + Math.round(win.stepMs) + " sync_ms " + Math.round(win.syncMs) + " frames " + win.frames + " api " + (GraphicsInfo.api === GraphicsInfo.Software ? "software" : "api" + GraphicsInfo.api));
                Qt.quit();
            }
        }
    }

    Component.onCompleted: {
        var parts = spec.split(",");
        cfg.fishCount = 38;
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split("=");
            if (kv[0] === "fish") cfg.fishCount = parseInt(kv[1]);
            else if (kv[0] === "stress") stress = parseFloat(kv[1]);
            else if (kv[0] === "churn") churn = kv[1] === "1";
        }
        Boids.setRandom((function () { var a = 20240607; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })());
        sim = Boids.createSimulation(1920, 1080, 1, cfg);
        sim.cpuStress = stress;
        sim.speedMultiplier = 1 + stress * 0.4;
        scene.item.sim = sim;
        loop.start();
    }
}
