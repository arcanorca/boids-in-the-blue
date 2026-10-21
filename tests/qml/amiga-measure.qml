// Measurement harness for the "amiga" redesign (driven by tests/amiga-measure.js; any theme works).
//   QT_QPA_PLATFORM=offscreen qml6 tests/qml/amiga-measure.qml -- <theme> <calm|sizes|motion> <outDir>
//   calm    no creatures, ambient running: frames every 100 ms for 3 s, then every 500 ms to 10 s (f###.png)
//   sizes   one entity of every kind per case, plus an empty baseline (sizes-<case>.png, sizes-base.png)
//   motion  one fish at constant velocity: per display frame its on-screen x (prints MOTION <json>)
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
    readonly property string theme: args[args.length - 3]
    readonly property string modeArg: args[args.length - 2]
    readonly property string mode: modeArg.split(":")[0]
    readonly property string outDir: args[args.length - 1]
    property var sim: null
    property var cfg: ({ fishCount: 0, anglerCount: 0, orcaCount: 0, jellyCount: 0 })
    property int n: 0
    property double t0: 0
    property var samples: []
    property var fish: null
    property real vx: 3

    Loader {
        id: scene
        anchors.fill: parent
        source: Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile(win.theme))
    }

    function save(name, done) {
        scene.item.grabToImage(function (r) { r.saveToFile(win.outDir + "/" + name + ".png"); if (done) done(); });
    }
    function syncNow() { scene.item.sync(sim); }

    // ── calm: ambient only ──
    Timer {
        id: tick
        interval: 40
        repeat: true
        running: win.sim !== null
        onTriggered: {
            if (win.mode === "motion" && win.fish) { win.fish.x += win.vx; }
            else if (win.mode === "calm") Boids.step(win.sim, 1, win.cfg);
            win.syncNow();
        }
    }
    Timer {
        id: grab
        interval: 100
        repeat: true
        onTriggered: {
            var i = win.n++;
            if (i === 0) win.t0 = Date.now();
            win.save("f" + String(i).padStart(3, "0"));
            console.log("FRAME " + i + " " + (Date.now() - win.t0));
            if (i >= 29) { interval = 500; }
            if (i >= 43) { stop(); quitT.start(); }
        }
    }
    Timer { id: quitT; interval: 800; onTriggered: Qt.quit() }

    // ── sizes ──
    property var cases: [
        { name: "default", fishSize: 4, orcaSize: 5.5, anglerSize: 4.2, jellySize: 3, wormSize: 4, fv: 0, jv: 0.5, bs: 2.25 },
        { name: "small", fishSize: 4, orcaSize: 5.5, anglerSize: 4.2, jellySize: 3, wormSize: 4, fv: -1, jv: 0, bs: 1.5 },
        { name: "large", fishSize: 4, orcaSize: 5.5, anglerSize: 4.2, jellySize: 3, wormSize: 4, fv: 1, jv: 2, bs: 3 },
        { name: "baby", fishSize: 4, orcaSize: 5.5, anglerSize: 4.2, jellySize: 3, wormSize: 4, fv: -3.5, jv: 0, bs: 1.5 },
        { name: "huge", fishSize: 8, orcaSize: 10, anglerSize: 10, jellySize: 8, wormSize: 10, fv: 0, jv: 0, bs: 3 },
        { name: "tiny", fishSize: 1, orcaSize: 1, anglerSize: 1, jellySize: 1, wormSize: 1, fv: 0, jv: 0, bs: 1.5 }
    ]
    property int ci: -2
    Timer {
        id: sizes
        interval: 450
        repeat: true
        onTriggered: {
            if (win.ci >= win.cases.length) { stop(); quitT.start(); return; }
            var cur = win.ci;
            var cs = cur >= 0 ? win.cases[cur] : win.cases[0];
            var cc = win.sim._c, E = win.sim.entities;
            cc.fishSize = cs.fishSize; cc.orcaSize = cs.orcaSize; cc.anglerSize = cs.anglerSize; cc.jellySize = cs.jellySize; cc.wormSize = cs.wormSize;
            var on = cur >= 0, ox = on ? 0 : -3000;
            function put(e, x, y) { e.x = x + ox; e.y = y; e.vx = 0; e.vy = 0; }
            E.fish[0].sizeVariation = cs.fv; put(E.fish[0], 300, 400); E.fish[0].facingRight = true;
            put(E.orcas[0], 760, 400);
            put(E.anglers[0], 1160, 400); E.anglers[0].facingRight = true;
            E.jellies[0].sizeVariation = cs.jv; put(E.jellies[0], 1560, 420);
            put(E.worms[0], 300, 700);
            for (var b = 0; b < E.bubbles.length; b++) { E.bubbles[b].scale = cs.bs; put(E.bubbles[b], 700 + b * 60, 700); E.bubbles[b].wobble = 0; }
            win.syncNow();
            win.ci++;
            // grab on the next timer tick (the 40 ms position tween has settled by then)
            if (cur >= -1) win.save("sizes-" + (cur < 0 ? "base" : cs.name));
        }
    }

    Component.onCompleted: {
        Boids.setClock(function () { return Date.now(); });
        var c = {};
        for (var k in cfg) c[k] = cfg[k];
        if (mode === "sizes") { c.fishCount = 1; c.anglerCount = 1; c.orcaCount = 1; c.jellyCount = 1; }
        if (mode === "motion") { c.fishCount = 1; }
        cfg = c;
        sim = Boids.createSimulation(1920, 1080, 1, cfg);
        Boids.step(sim, 1, cfg);
        if (mode === "sizes") {
            Boids.forceSpawnWorm(sim, 300, 700);
            while (sim.entities.bubbles.length > 3) sim.entities.bubbles.pop();
            sizes.start();
        } else if (mode === "motion") {
            fish = sim.entities.fish[0];
            fish.x = 300; fish.y = 500; fish.vx = vx; fish.vy = 0; fish.facingRight = true;
            if (modeArg.indexOf(":") > 0) vx = Number(modeArg.split(":")[1]);
            fish.vx = vx;
            motionT.start();
        } else {
            grab.start();
        }
    }

    // ── motion: record the on-screen x of the fish sprite on every display frame ──
    Timer {
        id: motionT
        interval: 1000
        onTriggered: { win.recording = true; stopT.start(); }
    }
    Timer { id: stopT; interval: 4000; onTriggered: { win.recording = false; console.log("MOTION " + JSON.stringify({ vx: win.vx, tick: 40, s: win.samples })); Qt.quit(); } }
    property bool recording: false
    onAfterAnimating: {
        if (recording && fish && fish.delegate) samples.push([Date.now(), fish.delegate.x, fish.x]);
    }
}
