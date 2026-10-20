// CPU benchmark scene: the real 40 ms sim + sync loop of a theme for 12 s (used by tests/qml-bench.js).
// Run: QT_QPA_PLATFORM=offscreen qml6 tests/qml/bench.qml -- <theme> fish=38,stress=0
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
    property var sim: null
    property var cfg: ({})
    property int ticks: 0
    property int frames: 0
    property double syncMs: 0
    onFrameSwapped: frames++

    Loader {
        id: scene
        anchors.fill: parent
        source: Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile(win.args[win.args.length - 2]))
    }
    Timer {
        interval: 40
        repeat: true
        running: true
        triggeredOnStart: true
        onTriggered: {
            Boids.step(win.sim, 1, win.cfg);
            var t0 = Date.now();
            scene.item.sync(win.sim);
            win.syncMs += Date.now() - t0;
            win.ticks++;
        }
    }
    Timer {
        interval: 12000
        running: true
        onTriggered: { console.log("BENCH ticks " + win.ticks + " sync_ms " + win.syncMs.toFixed(0) + " frames " + win.frames + " api " + GraphicsInfo.api); Qt.quit(); }
    }
    Component.onCompleted: {
        var parts = args[args.length - 1].split(","), ov = {}, stress = 0;
        for (var i = 0; i < parts.length; i++) { var kv = parts[i].split("="); ov[kv[0]] = Number(kv[1]); }
        if (ov.fish !== undefined) cfg.fishCount = ov.fish;
        if (ov.stress !== undefined) stress = ov.stress;
        sim = Boids.createSimulation(1920, 1080, 1, cfg);
        sim.cpuStress = stress; sim.speedMultiplier = 1 + stress * 0.4;
        scene.item.sim = sim;
        for (var s = 0; s < 100; s++) Boids.step(sim, 1, cfg);
    }
}
