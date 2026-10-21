import QtQuick
import QtQuick.Window
import org.kde.plasma.plasmoid
import org.kde.ksysguard.sensors 1.0 as Sensors

import "code/boids.js" as Boids
import "code/themes.js" as Themes
import "code/ticker.js" as Ticker

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
    // ── Frame-driven simulation ──
    // The simulation is stepped from the render loop (FrameAnimation + a fixed-step accumulator,
    // code/ticker.js), so it stops by itself when the compositor stops presenting this screen
    // (output off, lid-closed internal display, window not exposed); every screen has its own
    // WallpaperItem, so an external monitor keeps running. `renderIdle` is set by a 1 Hz watchdog
    // when no frame arrived for 2 s and switches off the sensors and the scene's ambient
    // animations (`suspended`). If FrameAnimation is unavailable the old 40 ms Timer drives it.
    property bool renderIdle: false
    property bool _frameDriven: false          // true once the FrameAnimation exists
    property double _lastFrameMs: 0
    property var _ticker: Ticker.create()
    property var _frameAnim: null
    readonly property bool suspended: paused || renderIdle
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
    Binding { target: sceneLoader.item; property: "paused"; value: wallpaper.suspended; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "daylight"; value: wallpaper.daylight; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "hour"; value: wallpaper._hour; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "dayNight"; value: wallpaper._cycle; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "waterTop"; value: wallpaper._waterTop; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "waterBottom"; value: wallpaper._waterBottom; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "customWater"; value: wallpaper._customWater; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "dpr"; value: Screen.devicePixelRatio; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }
    Binding { target: sceneLoader.item; property: "glimmerLevel"; value: wallpaper.glimmerLevel; when: sceneLoader.item !== null; restoreMode: Binding.RestoreNone }

    // ── Simulation loop ──
    // One simulation step = 40 ms of simulated time (25 steps/s whatever the display rate).
    // Returns false while there is no usable size yet.
    function simStep() {
        // Wait for a real size before creating the simulation
        if (!sim) {
            if (wallpaper.width <= 0 || wallpaper.height <= 0) return false;
            sim = Boids.createSimulation(
                wallpaper.width, wallpaper.height,
                Screen.devicePixelRatio, wallpaper.configuration);
        }
        Boids.step(sim, 1, wallpaper.configuration);

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
        return true;
    }

    // One frame of the render loop; dtMs = time since the previous frame.
    function onFrame(dtMs) {
        wallpaper._lastFrameMs = Date.now();
        if (wallpaper.renderIdle) wallpaper.renderIdle = false;
        var n = Ticker.advance(wallpaper._ticker, dtMs);
        if (!sim && n < 1) n = 1;                    // create the simulation without waiting a step
        var stepped = false;
        for (var i = 0; i < n; i++) {
            if (!simStep()) break;
            stepped = true;
        }
        if (stepped && sceneLoader.item) { sim.top = 0; sim.bodyScale = 1; sceneLoader.item.sync(sim); }   // draw once per frame, not per catch-up step; a scene may set sim.top and sim.bodyScale
    }

    // Fallback driver, only while the FrameAnimation is unavailable
    Timer {
        id: physicsTimer
        interval: 40
        running: !wallpaper.paused && !wallpaper._frameDriven
        repeat: true
        triggeredOnStart: true
        onTriggered: {
            if (wallpaper.simStep() && sceneLoader.item) { sim.top = 0; sim.bodyScale = 1; sceneLoader.item.sync(sim); }
        }
    }

    // Created dynamically (Qt >= 6.4): a missing type just keeps the Timer above in charge.
    // frameTime is in seconds. Not running while paused; the first frame after (re)starting
    // begins with a clean accumulator.
    function _startFrameLoop() {
        try {
            var fa = Qt.createQmlObject(
                'import QtQuick\nFrameAnimation { }', wallpaper, "frameloop");
            fa.running = Qt.binding(function () { return !wallpaper.paused; });
            fa.triggered.connect(function () { wallpaper.onFrame(fa.frameTime * 1000); });
            fa.runningChanged.connect(function () {
                if (fa.running) { Ticker.reset(wallpaper._ticker); wallpaper._lastFrameMs = Date.now(); }
            });
            wallpaper._lastFrameMs = Date.now();
            wallpaper._frameAnim = fa;
            wallpaper._frameDriven = true;
        } catch (e) {
            console.warn("Boids: FrameAnimation unavailable, using a timer:", e);
            wallpaper._frameAnim = null;
            wallpaper._frameDriven = false;
        }
    }

    // Idle watchdog: no frame for 2 s while we expect them (frame-driven, not paused) = nobody is
    // presenting this screen; stop the sensors and ambient animations until frames return.
    Timer {
        id: idleWatchdog
        interval: 1000
        repeat: true
        running: wallpaper._frameDriven && !wallpaper.paused
        onTriggered: {
            if (!wallpaper.renderIdle && Date.now() - wallpaper._lastFrameMs > 2000) wallpaper.renderIdle = true;
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
        enabled: (mode !== 4) && !wallpaper.suspended
        onValueChanged: updateStress()
    }

    Sensors.Sensor {
        id: secondarySensor
        property int mode: wallpaper.configuration ? wallpaper.configuration.sensorMode : 0
        sensorId: (mode === 3) ? (wallpaper.configuration.sensorId2 || "") : "gpu/all/usage"
        updateRateLimit: 500
        enabled: ((mode === 0) || (mode === 3 && sensorId !== "")) && !wallpaper.suspended
        onValueChanged: updateStress()
    }

    // ── Occlusion detection (Occluder.qml) ──
    // Created dynamically so a missing org.kde.taskmanager / kwindowsystem module (or any
    // error) just leaves _occluder null and the wallpaper running as before (fail-open).
    // Covered = a maximized/fullscreen window, or visible windows hiding at least `pauseCoverage`
    // percent of this screen, on the current virtual desktop and activity (desktop not "shown").
    function _startOccluder() {
        try {
            var comp = Qt.createComponent(Qt.resolvedUrl("Occluder.qml"), Component.PreferSynchronous);
            if (comp.status !== Component.Ready) throw new Error(comp.errorString());
            var occ = comp.createObject(wallpaper);
            if (!occ) throw new Error("could not create the occluder");
            occ.screenRect = Qt.binding(function() {
                return Qt.rect(Screen.virtualX, Screen.virtualY, Screen.width, Screen.height);
            });
            occ.pauseCoverage = Qt.binding(function() {
                var v = wallpaper.configuration ? Number(wallpaper.configuration.pauseCoverage) : 90;
                return (v >= 50 && v <= 100) ? Math.round(v) : 90;
            });
            _occluder = occ;
        } catch (e) {
            console.warn("Boids: occlusion detection unavailable, pause disabled:", e);
            _occluder = null;
        }
    }

    Component.onCompleted: {
        _startFrameLoop();
        if (_inShell) _startOccluder();
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
