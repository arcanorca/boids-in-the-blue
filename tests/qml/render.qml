// Themes: mode "illustrated" renders the same scenario with contents/themes/illustrated (Stage.qml);
// scenarios may carry an "hour" (forces the day/night cycle on at that hour; else full day).
// Renders one scenario with either the ORIGINAL per-entity Canvas renderer
// ("legacy": tests/qml/legacy/BoidDelegate.qml + Canvas gradient, as main.qml had it) or
// the new one ("new": EntityLayer + Rectangle gradient), then saves a PNG.
// Run:  QT_QPA_PLATFORM=offscreen qml6 tests/qml/render.qml -- <legacy|new> <scenario> <out.png> [bench]
// With "bench" no PNG is written: it runs the real 40 ms sim+sync loop for 20 s and prints
// BENCH lines (used by tests/qml-bench.js).
import QtQuick
import QtQuick.Window
import "../../contents/ui" as UI
import "../../contents/ui/code/boids.js" as Boids
import "render-scenarios.js" as RS
import "legacy" as Legacy
import "../../contents/themes/illustrated" as Illustrated

Window {
    id: win
    width: 1920
    height: 1080
    visible: true
    color: "black"

    readonly property var args: Qt.application.arguments
    readonly property string mode: args[args.length - 3] === "bench" ? args[args.length - 4] : args[args.length - 3]
    property string scenarioName: ""
    property string outFile: ""
    property bool bench: false
    property var sim: null
    readonly property string rhi: GraphicsInfo.api === GraphicsInfo.Software ? "software" : (GraphicsInfo.api === GraphicsInfo.OpenGL ? "opengl" : "api" + GraphicsInfo.api)
    property var scenario: null
    property int step: 0
    property double clockMs: 0
    property var cfg: ({})

    // ── scenes ──────────────────────────────────────────────
    Component {
        id: legacyScene
        Item {
            property alias ents: ent
            property var factory: legacyComp
            Canvas {
                anchors.fill: parent
                onPaint: {
                    var ctx = getContext("2d");
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, width, height);
                    var grad = ctx.createLinearGradient(0, 0, 0, height);
                    grad.addColorStop(0, "#0f4c75");
                    grad.addColorStop(1, "#051e36");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, width, height);
                }
            }
            Item { id: ent; anchors.fill: parent; z: 1 }
            // the new adapter also writes the stress-overlay props; the untouched legacy delegate just ignores them
            Component { id: legacyComp; Legacy.BoidDelegate { property string baseColor; property string tintColor; property double tintAlpha } }
        }
    }
    Component {
        id: newScene
        Item {
            property alias ents: ent
            property var factory: ent
            Rectangle {
                anchors.fill: parent
                gradient: Gradient {
                    GradientStop { position: 0.0; color: "#0f4c75" }
                    GradientStop { position: 1.0; color: "#051e36" }
                }
            }
            UI.EntityLayer { id: ent; anchors.fill: parent; z: 1 }
        }
    }
    property real sceneHour: 12
    property bool sceneDayNight: false
    Component {
        id: illustratedScene
        Item {
            property alias stage: st
            Illustrated.Stage {
                id: st
                anchors.fill: parent
                dpr: 1
                hour: win.sceneHour
                dayNight: win.sceneDayNight
            }
        }
    }
    Loader {
        id: scene
        anchors.fill: parent
        sourceComponent: win.mode === "legacy" ? legacyScene : (win.mode === "illustrated" ? illustratedScene : newScene)
    }
    // one sim -> sprites step for whichever renderer is active
    function doSync() {
        if (win.mode === "illustrated") {
            scene.item.stage.nowOverride = win.clockMs;
            scene.item.stage.sync(win.sim);
        } else {
            Boids.sync(win.sim, scene.item.ents, scene.item.factory);
        }
    }

    // ── deterministic driver ────────────────────────────────
    function rng(seed) {
        var a = seed;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function advance() {
        step++;
        var act = scenario.actions[step];
        if (act) act(sim, cfg, Boids);
        clockMs = step * 40;
        Boids.step(sim, 1, cfg);
        doSync();
    }
    function setup(name, cfgOverride) {
        scenario = null;
        for (var i = 0; i < RS.SCENARIOS.length; i++) if (RS.SCENARIOS[i].name === name) scenario = RS.SCENARIOS[i];
        if (!scenario) { console.log("RENDER unknown scenario " + name); Qt.quit(); return false; }
        Boids.setRandom(rng(20240607));
        Boids.setClock(function () { return win.clockMs; });
        cfg = {};
        for (var k in scenario.cfg) cfg[k] = scenario.cfg[k];
        for (var k2 in cfgOverride) cfg[k2] = cfgOverride[k2];
        sim = Boids.createSimulation(scenario.w, scenario.h, 1, cfg);
        if (scenario.hour !== undefined) { sceneHour = scenario.hour; sceneDayNight = true; }
        step = 0;
        return true;
    }

    Timer {   // snapshot: run all steps at once, let the 40 ms Behaviors and Canvas settle, grab
        id: settle
        interval: 600
        onTriggered: {
            scene.item.grabToImage(function (r) {
                r.saveToFile(win.outFile);
                console.log("RENDER saved " + win.outFile);
                Qt.quit();
            });
        }
    }

    // bench: the real loop (physicsTimer in main.qml)
    property int ticks: 0
    property double stepMs: 0
    property double syncMs: 0
    property int frames: 0
    property bool churn: false
    property bool ramp: false
    onFrameSwapped: frames++
    property double cpuStart: 0
    Timer {
        id: loop
        interval: 40
        repeat: true
        triggeredOnStart: true
        onTriggered: {
            if (!win.bench) return;
            if (win.step >= win.scenario.steps) { win.step = 0; }   // keep stress/actions simple: just keep stepping
            if (win.churn) {
                Boids.forceSpawnBubble(win.sim, 100 + (win.ticks * 37) % 1700, 900);
                Boids.forceSpawnBubble(win.sim, 100 + (win.ticks * 53) % 1700, 950);
                if (win.ticks % 10 === 0) Boids.forceSpawnWorm(win.sim, 100 + (win.ticks * 71) % 1700, 100);
            }
            if (win.ramp) win.sim.cpuStress = 0.6 + 0.6 * Math.sin(win.ticks * 0.05);   // 0 .. 1.2: sweeps the tint levels
            var t0 = Date.now();
            Boids.step(win.sim, 1, win.cfg);
            win.clockMs += 40;
            var t1 = Date.now();
            win.doSync();
            win.stepMs += t1 - t0;
            win.syncMs += Date.now() - t1;
            win.ticks++;
        }
    }
    Timer {
        id: benchEnd
        interval: 20000
        onTriggered: { console.log("BENCH ticks " + win.ticks + " step_ms " + win.stepMs.toFixed(0) + " sync_ms " + win.syncMs.toFixed(0) + " frames " + win.frames + " api " + win.rhi + " entities " + (win.sim.entities.fish.length + win.sim.entities.worms.length + win.sim.entities.bubbles.length + win.sim.entities.anglers.length + win.sim.entities.orcas.length + win.sim.entities.jellies.length)); Qt.quit(); }
    }

    Component.onCompleted: {
        // args: ... <mode> <scenario> <out|bench-key> [bench]
        var n = args.length;
        var isBench = args[n - 1] === "bench";
        win.bench = isBench;
        var off = isBench ? 1 : 0;
        scenarioName = args[n - 2 - off];
        outFile = args[n - 1 - off];
        var ov = {};
        if (isBench) {   // outFile carries "fish=200,stress=0.6"
            var parts = outFile.split(",");
            for (var i = 0; i < parts.length; i++) { var kv = parts[i].split("="); ov[kv[0]] = Number(kv[1]); }
        }
        var stressV = ov.stress !== undefined ? ov.stress : -1;
        win.churn = ov.churn === 1; win.ramp = ov.ramp === 1;
        delete ov.churn; delete ov.ramp;
        if (ov.fish !== undefined) ov.fishCount = ov.fish;
        delete ov.fish; delete ov.stress;
        if (!setup(scenarioName, ov)) return;
        if (isBench) {
            scenario.actions = {};
            if (stressV >= 0) { sim.cpuStress = stressV; sim.speedMultiplier = 1 + stressV * 0.4; }
            for (var w = 0; w < 100; w++) { Boids.step(sim, 1, cfg); clockMs += 40; doSync(); }
            loop.start();
            benchEnd.start();
        } else {
            while (step < scenario.steps) advance();
            settle.start();
        }
    }
}
