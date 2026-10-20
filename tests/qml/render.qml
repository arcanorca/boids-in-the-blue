// Renders one deterministic scenario offscreen and saves a PNG. Modes:
//   legacy   - the ORIGINAL renderer as fix/technical-bugs had it (frozen copy: legacy/BoidDelegate.qml)
//   <theme>  - the Scene.qml of a theme from the registry (classic | pixel | biolum | illustrated | onebit),
//              driven exactly like main.qml drives it (scene.sync(sim), daylight/hour/paused)
// Run: QT_QPA_PLATFORM=offscreen qml6 tests/qml/render.qml -- <mode> <scenario> <out.png>
import QtQuick
import QtQuick.Window
import "../../contents/ui/code/boids.js" as Boids
import "../../contents/ui/code/themes.js" as Themes
import "render-scenarios.js" as RS
import "legacy" as Legacy

Window {
    id: win
    width: 1920
    height: 1080
    visible: true
    color: "black"

    readonly property var args: Qt.application.arguments
    readonly property string mode: args[args.length - 3]
    readonly property string scenarioName: args[args.length - 2]
    readonly property string outFile: args[args.length - 1]
    property var sim: null
    property var scenario: null
    property int step: 0
    property double clockMs: 0
    property var cfg: ({})

    Component {
        id: legacyScene
        Item {
            property var sync: function (s) { Boids.sync(s, ent, legacyComp); }
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
            Component { id: legacyComp; Legacy.BoidDelegate {} }
        }
    }
    Loader {
        id: scene
        anchors.fill: parent
        source: win.mode === "legacy" ? "" : Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile(win.mode))
        sourceComponent: win.mode === "legacy" ? legacyScene : null
    }

    function rng(seed) {
        var a = seed;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function sync() {
        var it = scene.item;
        if (it.nowOverride !== undefined) it.nowOverride = win.clockMs;   // illustrated: deterministic clock
        it.sync(sim);
    }
    function advance() {
        step++;
        var act = scenario.actions[step];
        if (act) act(sim, cfg, Boids);
        clockMs = step * 40;
        Boids.step(sim, 1, cfg);
        sync();
    }

    Timer {   // run all steps at once, let the 40 ms Behaviors/animations settle, grab
        id: settle
        interval: win.mode === "biolum" ? 2500 : 700
        onTriggered: {
            scene.item.grabToImage(function (r) {
                r.saveToFile(win.outFile);
                console.log("RENDER saved " + win.outFile);
                Qt.quit();
            });
        }
    }

    Component.onCompleted: {
        for (var i = 0; i < RS.SCENARIOS.length; i++) if (RS.SCENARIOS[i].name === scenarioName) scenario = RS.SCENARIOS[i];
        if (!scenario) { console.log("RENDER unknown scenario " + scenarioName); Qt.quit(); return; }
        if (win.mode !== "legacy" && !Themes.find(win.mode)) { console.log("RENDER unknown mode " + win.mode); Qt.quit(); return; }
        Boids.setRandom(rng(20240607));
        Boids.setClock(function () { return win.clockMs; });
        for (var k in scenario.cfg) cfg[k] = scenario.cfg[k];
        sim = Boids.createSimulation(scenario.w, scenario.h, 1, cfg);
        if (scenario.hour !== undefined && win.mode !== "legacy") {
            scene.item.hour = scenario.hour;
            scene.item.dayNight = true;
            scene.item.daylight = (Math.cos((scenario.hour - 12) * Math.PI / 12) + 1) / 2;
        }
        if (win.mode !== "legacy") scene.item.sim = sim;
        while (step < scenario.steps) advance();
        settle.start();
    }
}
