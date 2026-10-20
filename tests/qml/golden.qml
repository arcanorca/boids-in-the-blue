// Runs golden scenarios inside the real QML engine (V4), importing the KDE
// adapter exactly like main.qml does. Prints "GOLDEN <name> <checkpoint> <hash>"
// lines; tests/qml-golden.js compares them with the Node run of the same code.
// Run:  QT_QPA_PLATFORM=offscreen qml6 tests/qml/golden.qml
import QtQuick
import "../../contents/ui/code/boids.js" as Boids
import "../scenarios.js" as S

QtObject {
    id: root
    property var names: ["defaults", "stress1.5", "worms-births", "config-changes", "resize", "fear4"]

    property var mock: ({
        created: 0, destroyed: 0, live: ({ size: 0 }),
        createObject: function (parent, props) {
            var d = {};
            for (var k in props) d[k] = props[k];
            var self = root.mock, id = self.created++;
            d.destroy = function () { self.destroyed++; self.live.size--; };
            self.live.size++;
            return d;
        }
    })

    Component.onCompleted: {
        var a = 20240607;   // mulberry32 seed, same as tests/harness.js
        var rng = function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        var now = 0;
        Boids.setRandom(rng);
        Boids.setClock(function () { return now; });
        for (var n = 0; n < names.length; n++) {
            var sc = null;
            for (var i = 0; i < S.SCENARIOS.length; i++) if (S.SCENARIOS[i].name === names[n]) sc = S.SCENARIOS[i];
            a = 20240607;
            mock.created = 0; mock.destroyed = 0; mock.live.size = 0;
            var res = S.runScenario(Boids, sc, mock, function (t) { now = t; });
            for (var k in res) console.log("GOLDEN " + sc.name + " " + k + " " + res[k].hash);
        }
        Qt.quit();
    }
}
