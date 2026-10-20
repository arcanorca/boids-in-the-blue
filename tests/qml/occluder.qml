// Loads the real Occluder.qml (org.kde.taskmanager + kwindowsystem from the system) offscreen:
// no windows exist there, so it must load without errors, report coverage 0 and not covered,
// and react to pauseCoverage/screenRect changes. Prints "OCC ok|FAIL ..."; exit via Qt.quit().
import QtQuick
import QtQuick.Window

Window {
    width: 200; height: 100; visible: true
    Loader {
        id: ld
        source: "../../contents/ui/Occluder.qml"
        onLoaded: { item.screenRect = Qt.rect(0, 0, 1920, 1080); item.pauseCoverage = 50; }
    }
    function say(ok, what) { console.log("OCC " + (ok ? "ok " : "FAIL ") + what); }
    Timer {
        interval: 600; running: true
        onTriggered: {
            var o = ld.item;
            if (!o) { say(false, "Occluder.qml did not load"); Qt.quit(); return; }
            say(o.covered === false && o.coverage === 0 && o.maximizedCover === false, "no windows: not covered, coverage 0");
            o.pauseCoverage = 100; o.screenRect = Qt.rect(0, 0, 1280, 720);
            say(true, "finished");
            Qt.quit();
        }
    }
}
