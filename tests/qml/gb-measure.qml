// Measurement harness of the "gameboy" theme (driven by tests/gameboy-measure.js).
//   qml6 tests/qml/gb-measure.qml -- backdrop <outDir>   empty sea, real time: PPM frames at 100 ms (3 s) then 500 ms (7 s)
//   qml6 tests/qml/gb-measure.qml -- motion               constant-velocity fish: per-frame on-screen position
//   qml6 tests/qml/gb-measure.qml -- sizes                every creature kind at default settings: sprite + on-screen rectangle
//   qml6 tests/qml/gb-measure.qml -- stress               40 still fish: inverted share per stress level, alarm alternation, tremble
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
    property var cfg: ({ fishCount: 0, anglerCount: 0, orcaCount: 0, jellyCount: 0 })
    property double t0: 0
    property int shots: 0
    property bool busy: false
    property var mock: []
    property int ticks: 0

    Loader {
        id: scene
        anchors.fill: parent
        source: Qt.resolvedUrl("../../contents/ui/" + Themes.sceneFile("gameboy"))
    }

    function mkFish(x, y, vx) {
        return { kind: "fish", x: x, y: y, vx: vx, vy: 0, facingRight: vx >= 0, color: "#4DCCE6", sizeVariation: 0, isBaby: false, delegate: null };
    }

    Timer {   // 25 Hz simulation tick, like main.qml's fixed step
        id: ticker
        interval: 40
        repeat: true
        running: false
        onTriggered: {
            for (var i = 0; i < win.mock.length; i++) { win.mock[i].x += win.mock[i].vx; win.mock[i].y += win.mock[i].vy; }
            win.ticks++;
            scene.item.sync(win.sim);
        }
    }

    // backdrop capture schedule (ms after start)
    property var schedule: []
    Timer {
        id: shooter
        interval: 25
        repeat: true
        running: false
        onTriggered: {
            var now = Date.now() - win.t0;
            if (win.busy || win.shots >= win.schedule.length || now < win.schedule[win.shots]) return;
            win.busy = true;
            var name = win.outDir + "/f" + String(win.shots).padStart(3, "0") + "-" + Math.round(now) + ".ppm";
            win.shots++;
            scene.item.grabToImage(function (r) {
                r.saveToFile(name);
                win.busy = false;
                if (win.shots >= win.schedule.length) { console.log("MEASURE done " + win.shots); Qt.quit(); }
            });
        }
    }

    // motion: log the on-screen x of each mock fish every rendered frame
    FrameAnimation {
        id: frames
        running: false
        onTriggered: {
            var t = Date.now() - win.t0;
            for (var i = 0; i < win.mock.length; i++) {
                var dg = win.mock[i].delegate;
                if (!dg) continue;
                var p = dg.mapToItem(null, 0, 0);
                console.log("MOT " + i + " " + t.toFixed(1) + " " + p.x + " " + p.y);
            }
        }
    }
    Timer { id: endMotion; interval: 4500; onTriggered: { console.log("MEASURE done motion"); Qt.quit(); } }

    // stress: fixed fish; each stress level for 2.4 s at the 25 Hz tick; log palette + position per tick
    property var levels: [0.3, 0.5, 0.7, 0.9, 1.1, 1.5]
    property int lvIdx: 0
    property int lvTick: 0
    Timer {
        id: stressTimer
        interval: 40
        repeat: true
        onTriggered: {
            var lv = win.levels[win.lvIdx];
            win.sim.cpuStress = lv; win.sim.speedMultiplier = 1 + lv * 0.4;
            scene.item.sync(win.sim);
            var inv = 0;
            for (var i = 0; i < win.mock.length; i++) {
                var dg = win.mock[i].delegate;
                if (dg.pal === 2) inv++;
                if (i < 8) { var p = dg.mapToItem(null, 0, 0); console.log("STRESSF " + lv + " " + i + " " + win.lvTick + " " + dg.pal + " " + p.x + " " + p.y); }
            }
            console.log("STRESS " + lv + " " + win.lvTick + " " + inv + " " + win.mock.length);
            if (++win.lvTick >= 60) { win.lvTick = 0; if (++win.lvIdx >= win.levels.length) { console.log("MEASURE done stress"); Qt.quit(); } }
        }
    }

    function report(kind, ent) {
        var dg = ent.delegate;
        if (!dg) { console.log("SIZE " + kind + " none"); return; }
        var a = dg.mapToItem(null, 0, 0), b = dg.mapToItem(null, dg.width, dg.height);
        console.log("SIZE " + kind + " " + dg.sprite + " " + (b.x - a.x) + " " + (b.y - a.y) + " " + dg.width + " " + dg.height);
    }
    Timer {
        id: sizesTimer
        interval: 600
        onTriggered: {
            var E = win.sim.entities, k = ["fish", "anglers", "orcas", "jellies", "worms", "bubbles"], n = ["fish", "angler", "orca", "jelly", "worm", "bubble"];
            for (var i = 0; i < k.length; i++) for (var j = 0; j < E[k[i]].length; j++) win.report(n[i] + (j > 0 ? j : ""), E[k[i]][j]);
            console.log("MEASURE done sizes");
            Qt.quit();
        }
    }

    Component.onCompleted: {
        sim = Boids.createSimulation(1920, 1080, 1, cfg);
        Boids.step(sim, 1, cfg);                          // fills the cached config (sim._c)
        sim.entities.bubbles.length = 0; sim.entities.worms.length = 0;
        scene.item.sim = sim;
        scene.item.daylight = 1;
        if (mode === "backdrop") {
            for (var i = 0; i < 3; i++) scene.item.sync(sim);
            var s = [];
            for (var a = 0; a <= 3000; a += 100) s.push(1000 + a);       // 100 ms cadence for 3 s (after 1 s warm-up)
            for (var b = 3500; b <= 10000; b += 500) s.push(1000 + b);   // then 500 ms to 10 s
            schedule = s;
            t0 = Date.now();
            shooter.start();
        } else if (mode === "motion") {
            var f1 = mkFish(300, 400, 3), f2 = mkFish(1500, 700, -1.2), f3 = mkFish(300, 900, 0.5);
            mock = [f1, f2, f3];
            for (var m = 0; m < mock.length; m++) sim.entities.fish.push(mock[m]);
            scene.item.sync(sim);
            t0 = Date.now();
            ticker.start();
            frames.start();
            endMotion.start();
        } else if (mode === "stress") {
            var arr = [];
            for (var q = 0; q < 40; q++) arr.push(mkFish(200 + (q % 10) * 150, 200 + Math.floor(q / 10) * 200, 0));
            mock = arr;
            for (var m2 = 0; m2 < mock.length; m2++) sim.entities.fish.push(mock[m2]);
            scene.item.sync(sim);
            stressTimer.start();
        } else if (mode === "sizes") {
            var c2 = { fishCount: 1, anglerCount: 1, orcaCount: 1, jellyCount: 1, fishSize: 4.0 };
            // default sizes, a stable sample: one of each kind, then a worm and a bubble
            Boids.setRandom(function () { return 0.5; });
            sim = Boids.createSimulation(1920, 1080, 1, c2);
            scene.item.sim = sim;
            Boids.step(sim, 1, c2);
            sim.entities.fish[0].sizeVariation = 0;
            sim.entities.jellies[0].sizeVariation = 0;
            Boids.forceSpawnWorm(sim, 900, 500);
            Boids.forceSpawnBubble(sim, 800, 500);
            sim.entities.bubbles[0].scale = 2.25;
            scene.item.sync(sim);
            sizesTimer.start();
        }
    }
}
