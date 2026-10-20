import QtQuick
import QtQuick.Window
import org.kde.plasma.plasmoid
import org.kde.ksysguard.sensors 1.0 as Sensors

import "code/boids.js" as Boids
import "code/themes.js" as Themes

WallpaperItem {
    id: wallpaper

    property var sim: null
    property double sensorStress: 0.0

    // ── Pause when nobody can see the simulation ──────────────
    // _covered comes from the occluder (below); it stays false if that is unavailable (fail-open).
    property bool _covered: false
    readonly property bool _pauseEnabled: !wallpaper.configuration
                                          || wallpaper.configuration.pauseWhenCovered !== false
    readonly property bool _hidden: !wallpaper.visible
                                    || (!!Window.window
                                        && (Window.window.visibility === Window.Hidden
                                            || Window.window.visibility === Window.Minimized))
    // Only inside plasmashell: the lock screen greeter (kscreenlocker_greet) loads wallpaper
    // plugins too, and windows behind the lock screen must not freeze its wallpaper.
    property bool _inShell: Qt.application.name === "plasmashell"   // writable only so tests/qml/switch.qml can pose as the shell
    readonly property bool paused: _inShell && _pauseEnabled && (_covered || _hidden)
    property var _occluder: null
    readonly property var _scene: sceneLoader.item       // the active theme's scene (tests)

    // Day/night cycle
    property string _dnTop: "#0f4c75"
    property string _dnBottom: "#051e36"
    property int _dnTick: 0
    property real glimmerLevel: 0.0
    property real _hour: 12            // hour of day, refreshed while the cycle is on
    property real _hourDaylight: 1.0   // 0 night .. 1 day for _hour

    // ── Theme ──
    // The configured id (unknown/empty -> default) and the one actually shown. They differ only
    // for an instant: on a change every delegate of the old theme is released first, then the
    // Loader below swaps the scene. The simulation object is never touched.
    readonly property string themeId: Themes.resolve(wallpaper.configuration ? wallpaper.configuration.theme : "")
    property string activeTheme: themeId
    onThemeIdChanged: {
        if (themeId === activeTheme) return;
        Boids.releaseAll(sim);
        activeTheme = themeId;
    }
    readonly property bool _cycle: !!wallpaper.configuration && !!wallpaper.configuration.dayNightCycle
    readonly property real daylight: _cycle ? _hourDaylight : 1.0
    readonly property string _waterTop: {
        if (_cycle) return _dnTop;
        return (wallpaper.configuration && wallpaper.configuration.waterTop)
                ? wallpaper.configuration.waterTop : "#0f4c75";
    }
    readonly property string _waterBottom: {
        if (_cycle) return _dnBottom;
        return (wallpaper.configuration && wallpaper.configuration.waterBottom)
                ? wallpaper.configuration.waterBottom : "#051e36";
    }
    // own water colours: cycle off and different from the defaults (themes keep their own palette otherwise)
    readonly property bool _customWater: !_cycle && !!wallpaper.configuration
        && !!wallpaper.configuration.waterTop && !!wallpaper.configuration.waterBottom
        && (String(wallpaper.configuration.waterTop).toLowerCase() !== "#0f4c75"
            || String(wallpaper.configuration.waterBottom).toLowerCase() !== "#051e36")

    function getDayNightColors(h) {
        var b = (Math.cos((h - 12) * Math.PI / 12) + 1) / 2;
        var nR1=5,nG1=26,nB1=46, nR2=2,nG2=13,nB2=24;
        var dR1=26,dG1=122,dB1=176, dR2=13,dG2=85,dB2=128;
        var r1=Math.round(nR1+(dR1-nR1)*b), g1=Math.round(nG1+(dG1-nG1)*b), b1=Math.round(nB1+(dB1-nB1)*b);
        var r2=Math.round(nR2+(dR2-nR2)*b), g2=Math.round(nG2+(dG2-nG2)*b), b2=Math.round(nB2+(dB2-nB2)*b);
        // Surface glimmer intensity (sunrise + sunset)
        var sunrise = Math.max(0, 1 - Math.abs(h - 6.5) / 1.5);
        var sunset  = Math.max(0, 1 - Math.abs(h - 18.5) / 1.5);
        return {
            top: "#" + ((1<<24)|(r1<<16)|(g1<<8)|b1).toString(16).slice(1),
            bottom: "#" + ((1<<24)|(r2<<16)|(g2<<8)|b2).toString(16).slice(1),
            glimmer: Math.max(sunrise, sunset),
            daylight: b
        };
    }

    // ── Themed scene: background, ambience and the entity layer ──
    // Scene.qml of the active theme (see code/themes.js for the contract). Sibling of the input
    // layer, which stays on top and gets every event first.
    Loader {
        id: sceneLoader
        anchors.fill: parent
        z: 0
        enabled: false
        source: Qt.resolvedUrl(Themes.sceneFile(wallpaper.activeTheme))
        onLoaded: {
            item.sim = Qt.binding(function () { return wallpaper.sim; });
        }
    }
    Binding { target: sceneLoader.item; property: "paused"; value: wallpaper.paused; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "daylight"; value: wallpaper.daylight; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "hour"; value: wallpaper._hour; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "dayNight"; value: wallpaper._cycle; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "waterTop"; value: wallpaper._waterTop; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "waterBottom"; value: wallpaper._waterBottom; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "customWater"; value: wallpaper._customWater; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "dpr"; value: Screen.devicePixelRatio; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "glimmerLevel"; value: wallpaper.glimmerLevel; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }

    // ── Simulation loop ──
    Timer {
        id: physicsTimer
        interval: 40
        running: !wallpaper.paused
        repeat: true
        triggeredOnStart: true

        onTriggered: {
            // Wait for a real size before creating the simulation
            if (!sim) {
                if (wallpaper.width <= 0 || wallpaper.height <= 0) return;
                sim = Boids.createSimulation(
                    wallpaper.width, wallpaper.height,
                    Screen.devicePixelRatio, wallpaper.configuration);
            }
            Boids.step(sim, 1, wallpaper.configuration);
            if (sceneLoader.item) sceneLoader.item.sync(sim);

            // Smoothed stress
            var intensity = (wallpaper.configuration &&
                             wallpaper.configuration.reactivityIntensity !== undefined)
                            ? wallpaper.configuration.reactivityIntensity : 1.0;
            // Mode 4 = Disabled: sensors stop reporting, so don't keep the last reading
            var sensorsOff = wallpaper.configuration && wallpaper.configuration.sensorMode === 4;
            var targetStress = sensorsOff ? 0.0 : wallpaper.sensorStress * intensity;
            sim.cpuStress += (targetStress - sim.cpuStress) * 0.1;
            if (Math.abs(sim.cpuStress - targetStress) < 0.005) sim.cpuStress = targetStress;
            var targetMul = 1.0 + (sim.cpuStress * 0.4);
            sim.speedMultiplier += (targetMul - sim.speedMultiplier) * 0.1;
            if (Math.abs(sim.speedMultiplier - targetMul) < 0.005) sim.speedMultiplier = targetMul;

            // Day/night cycle
            wallpaper._dnTick++;
            if (wallpaper.configuration && !!wallpaper.configuration.dayNightCycle
                && wallpaper._dnTick % 75 === 1) {
                var now = new Date();
                var h = now.getHours() + now.getMinutes() / 60.0;
                var dnC = wallpaper.getDayNightColors(h);
                wallpaper._hour = h;
                if (Math.abs(wallpaper._hourDaylight - dnC.daylight) > 0.003)
                    wallpaper._hourDaylight = dnC.daylight;
                if (wallpaper._dnTop !== dnC.top) wallpaper._dnTop = dnC.top;
                if (wallpaper._dnBottom !== dnC.bottom) wallpaper._dnBottom = dnC.bottom;
                var newGL = dnC.glimmer;
                if (Math.abs(wallpaper.glimmerLevel - newGL) > 0.005)
                    wallpaper.glimmerLevel = newGL;
            } else if (!(wallpaper.configuration && !!wallpaper.configuration.dayNightCycle)
                       && wallpaper.glimmerLevel > 0) {
                wallpaper.glimmerLevel = 0;
            }
        }
    }

    // Width and height usually change together: coalesce into one resize
    function applyResize() {
        if (sim) Boids.resize(sim, width, height, Screen.devicePixelRatio);
    }
    onWidthChanged:  Qt.callLater(applyResize)
    onHeightChanged: Qt.callLater(applyResize)

    // ── Input Layer (TOPMOST — z:10, sibling of the scene) ──
    // Not inside the scene, so no theme can block it. Gets all events first.
    Item {
        id: inputLayer
        anchors.fill: parent
        z: 10

        // Hover tracking (Qt.NoButton — passes clicks through)
        MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.NoButton

            property int hoverCount: 0

            onPositionChanged: (mouse) => {
                hoverCount = (hoverCount + 1) % 1000000;
                if (sim) { sim.mouse.x = mouse.x; sim.mouse.y = mouse.y; }
                if (sim && hoverCount % 20 === 0) {
                    Boids.forceSpawnBubble(sim,
                        mouse.x + (Math.random() - 0.5) * 20,
                        mouse.y + (Math.random() - 0.5) * 20);
                }
            }

            onExited: {
                if (sim) { sim.mouse.x = -9999; sim.mouse.y = -9999; }
            }
        }

        // Click + left-drag fallback for interaction on primary monitor
        // Short left-click = spawn worm
        // Left-click-and-drag = cursor interaction (fish flee + bubbles)
        // Right-click = bubble burst
        MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.LeftButton | Qt.RightButton

            property bool isDrag: false
            property int moveCount: 0

            onPressed: (mouse) => {
                isDrag = false;
                moveCount = 0;
            }

            onPositionChanged: (mouse) => {
                moveCount++;
                if (moveCount > 3) isDrag = true;
                if (isDrag && sim) {
                    sim.mouse.x = mouse.x; sim.mouse.y = mouse.y;
                    if (moveCount % 10 === 0) {
                        Boids.forceSpawnBubble(sim,
                            mouse.x + (Math.random() - 0.5) * 20,
                            mouse.y + (Math.random() - 0.5) * 20);
                    }
                }
            }

            onReleased: (mouse) => {
                if (!isDrag) {
                    // Short click
                    if (!sim) return;
                    if (mouse.button === Qt.LeftButton) {
                        Boids.forceSpawnWorm(sim, mouse.x, mouse.y);
                    } else if (mouse.button === Qt.RightButton) {
                        for (var i = 0; i < 5; i++) {
                            Boids.forceSpawnBubble(sim,
                                mouse.x + (Math.random() - 0.5) * 30,
                                mouse.y + (Math.random() - 0.5) * 20);
                        }
                    }
                }
                if (sim) { sim.mouse.x = -9999; sim.mouse.y = -9999; }
                isDrag = false;
            }

            // Grab stolen / focus lost: don't leave the cursor or drag state stuck
            onCanceled: {
                if (sim) { sim.mouse.x = -9999; sim.mouse.y = -9999; }
                isDrag = false;
                moveCount = 0;
            }
        }
    }

    // ── Sensors ─────────────────────────────────────────────────
    Sensors.Sensor {
        id: primarySensor
        property int mode: wallpaper.configuration ? wallpaper.configuration.sensorMode : 0
        sensorId: (mode === 3) ? (wallpaper.configuration.sensorId || "cpu/all/usage") :
                  (mode === 2) ? "gpu/all/usage" : "cpu/all/usage"
        updateRateLimit: 500
        enabled: (mode !== 4) && !wallpaper.paused
        onValueChanged: updateStress()
    }

    Sensors.Sensor {
        id: secondarySensor
        property int mode: wallpaper.configuration ? wallpaper.configuration.sensorMode : 0
        sensorId: (mode === 3) ? (wallpaper.configuration.sensorId2 || "") : "gpu/all/usage"
        updateRateLimit: 500
        enabled: ((mode === 0) || (mode === 3 && sensorId !== "")) && !wallpaper.paused
        onValueChanged: updateStress()
    }

    // ── Occlusion detection ─────────────────────────────────────
    // Created dynamically so a missing org.kde.taskmanager / kwindowsystem module (or any
    // error) just leaves _occluder null and the wallpaper running as before.
    // Covered = a non-minimized, non-hidden maximized/fullscreen window on this screen,
    // current virtual desktop and current activity (and the desktop is not being "shown").
    readonly property string _occluderSource: `
import QtQuick
import org.kde.taskmanager as TaskManager
import org.kde.kwindowsystem

Item {
    id: occ
    property rect screenRect: Qt.rect(0, 0, 0, 0)
    property bool covered: false

    TaskManager.VirtualDesktopInfo { id: vdInfo }
    TaskManager.ActivityInfo { id: actInfo }

    TaskManager.TasksModel {
        id: tasks
        filterByScreen: true
        filterByCurrentVirtualDesktop: true
        filterByActivity: true
        filterHidden: true
        filterMinimized: true
        groupMode: TaskManager.TasksModel.GroupDisabled
        screenGeometry: occ.screenRect
        activity: actInfo.currentActivity
    }

    function recompute() {
        var c = false;
        if (screenRect.width > 0 && screenRect.height > 0 && !KWindowSystem.showingDesktop) {
            for (var i = 0; i < tasks.count && !c; i++) {
                var idx = tasks.index(i, 0);
                if (tasks.data(idx, TaskManager.AbstractTasksModel.IsWindow) === true
                    && (tasks.data(idx, TaskManager.AbstractTasksModel.IsMaximized) === true
                        || tasks.data(idx, TaskManager.AbstractTasksModel.IsFullScreen) === true))
                    c = true;
            }
        }
        if (covered !== c) covered = c;
    }
    function schedule() { recomputeTimer.restart(); }

    // Coalesce bursts of model signals into one recompute
    Timer { id: recomputeTimer; interval: 50; onTriggered: occ.recompute() }

    Connections { target: tasks; function onCountChanged() { occ.schedule(); } }
    Connections { target: tasks; function onDataChanged() { occ.schedule(); } }
    Connections { target: tasks; function onRowsInserted() { occ.schedule(); } }
    Connections { target: tasks; function onRowsRemoved() { occ.schedule(); } }
    Connections { target: tasks; function onModelReset() { occ.schedule(); } }
    Connections { target: tasks; function onLayoutChanged() { occ.schedule(); } }
    Connections { target: actInfo; function onCurrentActivityChanged() { occ.schedule(); } }
    Connections { target: vdInfo; function onCurrentDesktopChanged() { occ.schedule(); } }
    Connections { target: KWindowSystem; function onShowingDesktopChanged() { occ.schedule(); } }
    onScreenRectChanged: schedule()
    Component.onCompleted: recompute()
}
`

    Component.onCompleted: {
        if (!_inShell) return;
        try {
            var occ = Qt.createQmlObject(_occluderSource, wallpaper, "occluder");
            occ.screenRect = Qt.binding(function() {
                return Qt.rect(Screen.virtualX, Screen.virtualY, Screen.width, Screen.height);
            });
            _occluder = occ;
        } catch (e) {
            console.warn("Boids: occlusion detection unavailable, pause disabled:", e);
            _occluder = null;
        }
    }
    Connections {
        target: wallpaper._occluder
        ignoreUnknownSignals: true
        function onCoveredChanged() { wallpaper._covered = wallpaper._occluder.covered; }
    }

    function updateStress() {
        if (!sim) return;
        var val1 = primarySensor.value;
        var val2 = (secondarySensor.enabled) ? secondarySensor.value : 0;
        var s1 = normalizeSensor(val1, primarySensor.sensorId);
        var s2 = normalizeSensor(val2, secondarySensor.sensorId);
        wallpaper.sensorStress = Math.max(s1, s2);
    }

    function normalizeSensor(raw, sId) {
        if (raw === undefined || raw === null) return 0.0;
        var idStr = (sId || "").toLowerCase();
        if (idStr.indexOf("usage") !== -1 || idStr.indexOf("load") !== -1) {
            return Math.max(0.0, Math.min(1.0, raw / 100.0));
        }
        return Math.min(Math.max((raw - 40) / 40, 0), 1);
    }
}
