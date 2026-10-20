// CPU benchmark of one theme: the real 40 ms sim + sync loop for 15 s in the real QML engine (offscreen).
// Run: QT_QPA_PLATFORM=offscreen qml6 tests/qml/bench.qml -- <theme> "fish=200,stress=0"   (see tests/qml-bench.js)
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
    Loader { id: scene; anchors.fill: parent; source: Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile(win.mode)) }
    onFrameSwapped: frames++
    Timer {
        interval: 40
        repeat: true
        running: true
        onTriggered: {
            var t0 = Date.now();
            Boids.step(win.sim, 1, win.cfg);
            var t1 = Date.now();
            scene.item.sync(win.sim);
            win.stepMs += t1 - t0; win.syncMs += Date.now() - t1; win.ticks++;
        }
    }
    Timer {
        interval: 15000
        running: true
        onTriggered: { console.log("BENCH ticks " + win.ticks + " step_ms " + win.stepMs.toFixed(0) + " sync_ms " + win.syncMs.toFixed(0) + " frames " + win.frames); Qt.quit(); }
    }
    Component.onCompleted: {
        var stress = 0;
        spec.split(",").forEach(function (kv) {
            var p = kv.split("=");
            if (p[0] === "fish") cfg.fishCount = +p[1]; else if (p[0] === "stress") stress = +p[1];
        });
        sim = Boids.createSimulation(1920, 1080, 1, cfg);
        sim.cpuStress = stress;
        scene.item.sim = sim;
    }
}
