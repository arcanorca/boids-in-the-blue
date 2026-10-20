// Runtime theme switching of the REAL main.qml (stub Plasma modules in tests/qml/stubs):
// cycles every theme (+ an unknown value), checks after each switch that
//   * the simulation object is the same,
//   * every delegate of the old theme was released immediately and fresh ones are made,
//   * the right scene is loaded (unknown value -> "pixel").
// Then, per theme, covers the wallpaper and saves two screenshots 500 ms apart (must be identical:
// every animation stopped) and two while running (must differ: sanity check of the method).
// Prints "SWITCH ..." lines and writes <outDir>/<theme>-{run0,run1,paused0,paused1}.png.
// Run: QT_QPA_PLATFORM=offscreen qml6 -I tests/qml/stubs tests/qml/switch.qml -- <outDir>
import QtQuick
import QtQuick.Window
import "../../contents/ui/code/themes.js" as Themes

Window {
    id: win
    width: 640
    height: 360
    visible: true
    color: "black"

    readonly property string outDir: Qt.application.arguments[Qt.application.arguments.length - 1]
    property var order: ["pixel", "classic", "biolum", "nes", "pixel", "bogus", "nes", "classic", "biolum", ""]
    property int idx: -1
    property var firstSim: null
    property var oldDelegates: []
    property string phaseTheme: ""
    property int phase: 0
    property var pauseOrder: ["pixel", "classic", "biolum", "nes"]
    property int pidx: -1

    QtObject {
        id: cfg
        property string theme: "pixel"
        property bool pauseWhenCovered: true
        property int pauseCoverage: 90
        property bool dayNightCycle: false
        property string waterTop: "#0f4c75"
        property string waterBottom: "#051e36"
        property int sensorMode: 4
        property int fishCount: 30
    }
    Loader {
        id: ld
        anchors.fill: parent
        source: "../../contents/ui/main.qml"
        onLoaded: { item.configuration = cfg; item._inShell = true; }
    }

    function entities() {
        var out = [], s = ld.item.sim;
        for (var l = 0; l < s.allLists.length; l++) for (var i = 0; i < s.allLists[l].length; i++) out.push(s.allLists[l][i]);
        return out;
    }
    function say(ok, what) { console.log("SWITCH " + (ok ? "ok " : "FAIL ") + what); }

    Timer {   // wait for the sim and the first sync
        id: boot
        interval: 800
        running: true
        onTriggered: {
            if (!ld.item || !ld.item.sim) { say(false, "no simulation after start"); Qt.quit(); return; }
            win.firstSim = ld.item.sim;
            say(ld.item.activeTheme === "pixel", "default theme is pixel");
            nextSwitch.start();
        }
    }

    Timer {
        id: nextSwitch
        interval: 600
        repeat: true
        onTriggered: {
            if (win.idx >= 0) check();
            win.idx++;
            if (win.idx >= win.order.length) { nextSwitch.stop(); startPause(); return; }
            var ents = win.entities(), old = [];
            for (var i = 0; i < ents.length; i++) if (ents[i].delegate) old.push(ents[i].delegate);
            win.oldDelegates = old;
            var before = ld.item.activeTheme;
            cfg.theme = win.order[win.idx];
            var left = 0, e2 = win.entities();
            for (var j = 0; j < e2.length; j++) if (e2[j].delegate) left++;
            var want = Themes.resolve(win.order[win.idx]);
            // released right away when the theme changed (nothing left over); untouched otherwise
            if (want !== before) say(left === 0, "'" + win.order[win.idx] + "': " + old.length + " delegates of '" + before + "' released at once (left " + left + ")");
        }
    }
    function check() {
        var want = Themes.resolve(order[idx]), it = ld.item, ents = entities(), have = 0, reused = 0;
        for (var i = 0; i < ents.length; i++) if (ents[i].delegate) have++;
        var changed = idx === 0 ? false : Themes.resolve(order[idx - 1]) !== want;
        if (changed) for (var k = 0; k < ents.length; k++) if (oldDelegates.indexOf(ents[k].delegate) >= 0) reused++;
        say(it.sim === firstSim && it.activeTheme === want && have === ents.length && reused === 0,
            "'" + order[idx] + "' -> " + want + ": same sim " + (it.sim === firstSim) + ", delegates " + have + "/" + ents.length + ", reused old " + reused
            + ", scene " + String(it._scene).split("(")[0]);
    }

    function startPause() { pidx = -1; phase = 0; cfg.theme = "pixel"; pauseStep.start(); }
    function grab(name, next) {
        ld.item.grabToImage(function (r) { r.saveToFile(outDir + "/" + name + ".png"); next(); });
    }
    Timer {
        id: pauseStep
        interval: 700
        onTriggered: {
            if (phase === 0) {            // pick the next theme, running
                pidx++;
                if (pidx >= pauseOrder.length) {
                    ld.item._covered = false;
                    startFrames();
                    return;
                }
                ld.item._covered = false;
                cfg.theme = pauseOrder[pidx];
                phase = 1; pauseStep.restart();
            } else if (phase === 1) {
                grab(pauseOrder[pidx] + "-run0", function () { phase = 2; pauseStep.interval = 500; pauseStep.restart(); });
            } else if (phase === 2) {
                grab(pauseOrder[pidx] + "-run1", function () {
                    ld.item._covered = true;
                    say(ld.item.paused && ld.item._scene.paused === true, pauseOrder[pidx] + ": covered -> main.paused and scene.paused");
                    phase = 3; pauseStep.interval = 700; pauseStep.restart();
                });
            } else if (phase === 3) {
                grab(pauseOrder[pidx] + "-paused0", function () { phase = 4; pauseStep.interval = 500; pauseStep.restart(); });
            } else if (phase === 4) {
                grab(pauseOrder[pidx] + "-paused1", function () { phase = 0; pauseStep.interval = 100; pauseStep.restart(); });
            }
        }
    }

    // ── frame-driven simulation ──
    // 1. rate: ~25 simulation steps per second (the tick counter of main.qml), whatever the frame rate
    // 2. frames stop (FrameAnimation paused = what a compositor that stops presenting does):
    //    the simulation stops, the watchdog flags idle after 2 s and the scene's animations stop
    // 3. frames return: simulation and scene resume at once, no burst of catch-up steps
    property int t0: 0
    property double tMs: 0
    function startFrames() {
        cfg.theme = "pixel";
        say(ld.item._frameDriven === true && ld.item._frameAnim !== null, "FrameAnimation drives the simulation");
        framePhase = 0; frameStep.interval = 800; frameStep.start();
    }
    property int framePhase: 0
    Timer {
        id: frameStep
        onTriggered: {
            var it = ld.item;
            if (framePhase === 0) { t0 = it._dnTick; tMs = Date.now(); framePhase = 1; frameStep.interval = 2000; frameStep.restart(); }
            else if (framePhase === 1) {
                var steps = it._dnTick - t0, rate = steps / ((Date.now() - tMs) / 1000);
                say(rate > 20 && rate < 30, "simulation rate " + rate.toFixed(1) + " steps/s (want ~25)");
                say(!it.renderIdle && !it._scene.paused, "frames arriving: not idle");
                it._frameAnim.paused = true;                       // frames stop
                t0 = it._dnTick; framePhase = 2; frameStep.interval = 1200; frameStep.restart();
            } else if (framePhase === 2) {
                say(it._dnTick === t0, "no frames -> no simulation steps (" + (it._dnTick - t0) + ")");
                say(!it.renderIdle, "not yet idle after 1.2 s");
                framePhase = 3; frameStep.interval = 2200; frameStep.restart();
            } else if (framePhase === 3) {
                say(it.renderIdle && it.suspended && !it.paused && it._scene.paused === true, "idle after >2 s without frames: scene animations suspended");
                var before = it._dnTick;
                it._frameAnim.paused = false;                      // frames return
                t0 = before; framePhase = 4; frameStep.interval = 400; frameStep.restart();
            } else if (framePhase === 4) {
                var n = it._dnTick - t0;
                say(!it.renderIdle && it._scene.paused === false, "frames back: idle cleared, scene running");
                say(n >= 1 && n <= 14, "no catch-up burst after the gap (" + n + " steps in 0.4 s)");
                say(true, "finished");
                Qt.quit();
            }
        }
    }
}
