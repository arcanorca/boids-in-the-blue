import QtQuick
import QtQuick.Window
import org.kde.plasma.plasmoid
import org.kde.ksysguard.sensors 1.0 as Sensors

import "code/boids.js" as Boids

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
    readonly property bool _inShell: Qt.application.name === "plasmashell"
    readonly property bool paused: _inShell && _pauseEnabled && (_covered || _hidden)
    property var _occluder: null

    // Day/night cycle
    property string _dnTop: "#0f4c75"
    property string _dnBottom: "#051e36"
    property int _dnTick: 0
    property real glimmerLevel: 0.0

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
            glimmer: Math.max(sunrise, sunset)
        };
    }

    // ── Background + Input Canvas ─────────────────────────────
    // CRITICAL: This Canvas must have ZERO visual Item children.
    // Original plugin: Canvas renders bg + entities, MouseAreas are children.
    // Canvas = QQuickPaintedItem (has ItemHasContents flag).
    // Having BoidDelegate (also QQuickPaintedItem) children inside Canvas
    // causes Qt Quick hit-testing to route hover to delegates instead of MouseAreas.
    // FIX: entityLayer is a SEPARATE sibling Item OUTSIDE Canvas.
    Canvas {
        id: mainCanvas
        anchors.fill: parent

        property string _waterTop: {
            if (wallpaper.configuration && !!wallpaper.configuration.dayNightCycle)
                return wallpaper._dnTop;
            return (wallpaper.configuration && wallpaper.configuration.waterTop)
                    ? wallpaper.configuration.waterTop : "#0f4c75";
        }
        property string _waterBottom: {
            if (wallpaper.configuration && !!wallpaper.configuration.dayNightCycle)
                return wallpaper._dnBottom;
            return (wallpaper.configuration && wallpaper.configuration.waterBottom)
                    ? wallpaper.configuration.waterBottom : "#051e36";
        }
        on_WaterTopChanged: requestPaint()
        on_WaterBottomChanged: requestPaint()

        onPaint: {
            var ctx = getContext("2d");
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, width, height);
            var grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, _waterTop);
            grad.addColorStop(1, _waterBottom);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // Timer inside Canvas (matches original structure)
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
                Boids.sync(sim, entityLayer, boidComponent);

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

        onWidthChanged:  { requestPaint(); Qt.callLater(applyResize); }
        onHeightChanged: { requestPaint(); Qt.callLater(applyResize); }
    }

    // ── Entity Layer ──
    Item {
        id: entityLayer
        anchors.fill: parent
        z: 1
        enabled: false
    }

    // ── Surface Glimmer (golden shimmer at water surface during sunrise/sunset) ──
    Item {
        id: surfaceGlimmer
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: parent.height * 0.10
        z: 2
        visible: wallpaper.glimmerLevel > 0.01 && !wallpaper.paused
        opacity: wallpaper.glimmerLevel * 0.8

        Rectangle {
            anchors.fill: parent
            gradient: Gradient {
                GradientStop { position: 0.0; color: "#30ff8c42" }
                GradientStop { position: 0.4; color: "#18ff7a30" }
                GradientStop { position: 1.0; color: "#00000000" }
            }
        }

        Repeater {
            model: 20
            delegate: Rectangle {
                width: 2 + (index % 3)
                height: width
                radius: width / 2
                color: index % 3 === 0 ? "#ffa060" : (index % 3 === 1 ? "#ff8c42" : "#ff7a30")
                opacity: 0
                // Golden-ratio spread: deterministic, follows resizes
                x: ((index * 0.618034) % 1) * surfaceGlimmer.width
                y: ((index * 0.754878) % 1) * surfaceGlimmer.height * 0.7
                SequentialAnimation on opacity {
                    loops: Animation.Infinite
                    paused: wallpaper.paused
                    PauseAnimation { duration: 400 + (index * 731) % 3500 }
                    NumberAnimation { to: 0.25 + (index % 5) * 0.1; duration: 600 + (index % 4) * 200; easing.type: Easing.InOutSine }
                    NumberAnimation { to: 0; duration: 800 + (index % 3) * 300; easing.type: Easing.InOutSine }
                }
            }
        }
    }

    // ── Input Layer (TOPMOST — z:10, sibling of Canvas & entityLayer) ──
    // Not inside Canvas. Not blocked by entityLayer. Gets all events first.
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

    Component {
        id: boidComponent
        BoidDelegate {}
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
