// EntityLayer pool test: delegates are recycled, never leak or linger visible, and the
// pool grows past any fixed size. Prints "POOL <check> <ok|FAIL> <detail>" lines.
// Run: QT_QPA_PLATFORM=offscreen qml6 tests/qml/pool.qml
import QtQuick
import "../../contents/ui" as UI
import "../../contents/ui/code/boids.js" as Boids

Item {
    id: root
    width: 1920
    height: 1080

    UI.EntityLayer { id: layer; anchors.fill: parent }

    function visibleCount() {
        var n = 0;
        for (var i = 0; i < layer.children.length; i++) if (layer.children[i].visible) n++;
        return n;
    }
    function entityCount(sim) {
        var n = 0;
        for (var l = 0; l < sim.allLists.length; l++) n += sim.allLists[l].length;
        return n;
    }
    function withDelegate(sim) {
        var n = 0;
        for (var l = 0; l < sim.allLists.length; l++)
            for (var i = 0; i < sim.allLists[l].length; i++) if (sim.allLists[l][i].delegate) n++;
        return n;
    }
    function check(name, ok, detail) { console.log("POOL " + name + " " + (ok ? "ok" : "FAIL") + " " + detail); }

    Component.onCompleted: {
        var a = 12345;
        Boids.setRandom(function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
        Boids.setClock(function () { return 0; });
        var cfg = { fishCount: 200, anglerCount: 4, orcaCount: 4, jellyCount: 6 };
        var sim = Boids.createSimulation(1920, 1080, 1, cfg);
        var spawned = 0;
        for (var i = 1; i <= 600; i++) {
            if (i % 3 === 0) { Boids.forceSpawnBubble(sim, 100 + (i * 7) % 1700, 1000); spawned++; }
            if (i % 25 === 0) { Boids.forceSpawnWorm(sim, 100 + (i * 13) % 1700, 200); spawned++; }
            Boids.step(sim, 1, cfg);
            Boids.sync(sim, layer, layer);
            if (visibleCount() !== withDelegate(sim) || layer.live !== withDelegate(sim)) {
                check("live-matches-visible", false, "step " + i + " visible=" + visibleCount() + " delegates=" + withDelegate(sim) + " live=" + layer.live);
                Qt.quit(); return;
            }
        }
        check("live-matches-visible", true, "600 steps, " + entityCount(sim) + " entities");
        check("pool-reuses", layer.created < entityCount(sim) + spawned, "created=" + layer.created + " entities=" + entityCount(sim) + " spawned=" + spawned);

        // shrink: removed entities must hide their sprite immediately (no ghosts)
        cfg.fishCount = 20; cfg.anglerCount = 0; cfg.orcaCount = 0; cfg.jellyCount = 0;
        Boids.step(sim, 1, cfg);
        Boids.sync(sim, layer, layer);
        check("trim-no-ghosts", visibleCount() === withDelegate(sim) && visibleCount() === entityCount(sim),
              "visible=" + visibleCount() + " entities=" + entityCount(sim));

        // grow again: pooled sprites are reused, not recreated
        var createdBefore = layer.created;
        cfg.fishCount = 150;
        for (var j = 0; j < 40; j++) { Boids.step(sim, 1, cfg); Boids.sync(sim, layer, layer); }
        check("regrow-reuses", layer.created - createdBefore < 40 && visibleCount() === entityCount(sim),
              "newly created=" + (layer.created - createdBefore) + " visible=" + visibleCount() + " entities=" + entityCount(sim));

        // no cap: far more simultaneous sprites than any plausible fixed pool
        var props = { x: 5, y: 5, size: 2, type: 5, spriteData: Boids.SPRITES.BUBBLE, colorString: "#FFFFFF", rotation: 0 };
        var made = [];
        for (var k = 0; k < 600; k++) made.push(layer.createObject(layer, props));
        var all = true;
        for (var m = 0; m < made.length; m++) if (!made[m] || !made[m].visible) all = false;
        check("no-cap", all, "600 extra bubbles created, visible=" + visibleCount());
        for (var n = 0; n < made.length; n++) made[n].release();
        check("release", visibleCount() === entityCount(sim), "after release visible=" + visibleCount() + " entities=" + entityCount(sim));
        made[0].release();   // double release must not corrupt the pool
        check("double-release", layer.live === withDelegate(sim), "live=" + layer.live);

        // recycled sprite starts clean (no stale flip/shake/opacity/tint)
        var d = layer.createObject(layer, { x: 1, y: 1, size: 4, type: 1, spriteData: Boids.SPRITES.FISH, colorString: "#FF8080", rotation: 0 });
        check("recycled-clean", d.flip === false && d.shakeX === 0 && d.shakeY === 0 && d.opacity === 1 && d.tintAlpha === 0 && d.baseColor === "#FF8080",
              "flip=" + d.flip + " shake=" + d.shakeX + " op=" + d.opacity + " tint=" + d.tintAlpha);
        Qt.quit();
    }
}
