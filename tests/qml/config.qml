// Loads the settings page (staged copy, see tests/qml-config.js) and checks it like the shell would
// use it: every cfg_ alias resolves and round-trips, the main.xml ranges are reachable, presets set
// the right values, Reset restores the defaults, theme-dependent controls follow the theme.
// Prints "CONFIG ok|FAIL ..." lines. Args: <collapsedPng> <expandedPng> [width]
import QtQuick
import QtQuick.Window
import org.kde.kirigami as Kirigami
import "L.js" as L
import "defaults.js" as D

Window {
    id: win
    readonly property var args: Qt.application.arguments
    readonly property int pageWidth: args.length > 3 && Number(args[args.length - 1]) > 0 ? Number(args[args.length - 1]) : 600
    width: pageWidth
    height: 3000
    visible: true
    color: "#eff0f1"

    // the shell's dialog form: config.qml twins its labels with it
    property var parentLayout: shellForm
    Kirigami.FormLayout { id: shellForm; visible: false }

    Rectangle {
        id: sheet
        width: parent.width
        height: ld.height
        color: Kirigami.Theme.backgroundColor
        Loader {
            id: ld
            width: parent.width
            height: item ? item.implicitHeight : 0
            source: "config.qml"
        }
    }

    function say(ok, what) { console.log("CONFIG " + (ok ? "ok   " : "FAIL ") + what); }
    function near(a, b) { return typeof b === "string" ? String(a).toLowerCase() === b.toLowerCase() : Math.abs(Number(a) - Number(b)) < 1e-6; }
    function setDefaults(p) { for (var k in D.DEFAULTS) p["cfg_" + k + "Default"] = D.DEFAULTS[k]; }

    function run() {
        var p = ld.item;
        if (!p) { say(false, "config.qml did not load"); Qt.quit(); return; }
        setDefaults(p);
        var keys = Object.keys(D.DEFAULTS), bad;

        // 1. every key has an alias/property and a Default property
        bad = [];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (p["cfg_" + k] === undefined) bad.push("cfg_" + k);
            if (p["cfg_" + k + "Default"] === undefined) bad.push("cfg_" + k + "Default");
        }
        say(bad.length === 0, keys.length + " main.xml keys all have cfg_ and cfg_Default properties" + (bad.length ? ": missing " + bad.join(", ") : ""));

        // 2. Reset restores the defaults; 3. a saved default value survives the controls unchanged
        p.resetToDefaults();
        bad = [];
        for (i = 0; i < keys.length; i++) if (!near(p["cfg_" + keys[i]], D.DEFAULTS[keys[i]])) bad.push(keys[i] + "=" + p["cfg_" + keys[i]] + " (default " + D.DEFAULTS[keys[i]] + ")");
        say(bad.length === 0, "Reset to Defaults restores every key" + (bad.length ? ": " + bad.join(", ") : ""));
        say(p.cfg_theme === "pixel", "default theme is pixel");

        // 4. every key's min and max (main.xml) is accepted by its control unchanged (no silent clamping)
        bad = [];
        for (i = 0; i < keys.length; i++) {
            var r = D.RANGES[keys[i]];
            if (!r) continue;
            p["cfg_" + keys[i]] = r[0];
            if (!near(p["cfg_" + keys[i]], r[0])) bad.push(keys[i] + " min " + r[0] + " -> " + p["cfg_" + keys[i]]);
            p["cfg_" + keys[i]] = r[1];
            if (!near(p["cfg_" + keys[i]], r[1])) bad.push(keys[i] + " max " + r[1] + " -> " + p["cfg_" + keys[i]]);
        }
        say(bad.length === 0, "main.xml minimum and maximum of every numeric key reachable" + (bad.length ? ": " + bad.join(", ") : ""));
        p.resetToDefaults();

        // 5. presets
        bad = [];
        var names = ["Calm", "Default", "Lively", "Chaotic"];
        for (var n = 0; n < 4; n++) {
            p.applyPreset(n);
            var want = p.presetFor(n), cur = p.currentValues();
            for (var c = 0; c < want.length; c++) if (!near(want[c], cur[c])) bad.push(names[n] + "[" + c + "] " + cur[c] + " != " + want[c]);
            if (p.presetIndex !== n) bad.push(names[n] + " presetIndex " + p.presetIndex);
        }
        say(bad.length === 0, "presets Calm/Default/Lively/Chaotic set their values and are recognised" + (bad.length ? ": " + bad.join(", ") : ""));
        p.applyPreset(1);
        var dflt = true;
        for (i = 0; i < keys.length; i++) if (!near(p["cfg_" + keys[i]], D.DEFAULTS[keys[i]]) && ["fishMaxSpeed","fishMinSpeed","visualRange","separationDist","cohesionFactor","alignmentFactor","separationFactor","wanderFactor","turnFactor"].indexOf(keys[i]) >= 0) dflt = false;
        say(dflt, "preset Default equals main.xml defaults for the flocking block");
        p.applyPreset(2);
        p.cfg_visualRange = 200;
        say(p.presetIndex === -1, "editing one flocking value after a preset means Custom");
        p.applyPreset(0);
        say(p.cfg_orcaCount === D.DEFAULTS.orcaCount && p.cfg_fishCount === D.DEFAULTS.fishCount, "presets leave counts alone");

        // 6. theme-dependent controls
        p.resetToDefaults();
        p.cfg_theme = "illustrated";   // archived theme: a saved value falls back to the default
        var gotIll = p.theme.id;
        p.cfg_theme = "bogus";
        var gotBogus = p.theme.id;
        p.cfg_theme = "classic";
        say(gotIll === "pixel" && gotBogus === "pixel" && p.theme.id === "classic", "selected theme follows cfg_theme (unknown -> pixel)");

        // 7. screenshots: collapsed, then expanded
        p.resetToDefaults();
        p.advancedVisible = false;
        Qt.callLater(function () { shot(args[args.length - (args.length > 3 && Number(args[args.length - 1]) > 0 ? 3 : 2)], function () {
            p.advancedVisible = true;
            Qt.callLater(function () { shot(args[args.length - (args.length > 3 && Number(args[args.length - 1]) > 0 ? 2 : 1)], function () { say(true, "finished"); Qt.quit(); }); });
        }); });
    }
    function shot(file, next) {
        shotTimer.file = file; shotTimer.next = next; shotTimer.restart();
    }
    Timer {
        id: shotTimer
        interval: 500
        property string file: ""
        property var next: null
        onTriggered: sheet.grabToImage(function (r) { r.saveToFile(file); next(); })
    }
    Timer { interval: 600; running: true; onTriggered: win.run() }
}
