import QtQuick
import QtQuick.Window
import org.kde.plasma.plasmoid
import org.kde.ksysguard.sensors 1.0 as Sensors

import "code/boids.js" as Boids

WallpaperItem {
    id: wallpaper

    // --- FPS & LAG CONTROL (ROOT LEVEL) ---
    // Safe access to configuration
    property int targetFps: {
        if (!wallpaper.configuration) return 25;
        return Math.max(15, Math.min(120, wallpaper.configuration.fps || 25));
    }
    property int targetFrameTime: Math.round(1000 / targetFps)

    // Stress Variables
    property double sensorStress: 0.0
    property double lagStress: 0.0

    // --- NATIVE GPU BACKGROUND ---
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { 
                position: 0.0
                color: wallpaper.configuration && wallpaper.configuration.waterTop ? wallpaper.configuration.waterTop : "#021a30"
            }
            GradientStop { 
                position: 1.0
                color: wallpaper.configuration && wallpaper.configuration.waterBottom ? wallpaper.configuration.waterBottom : "#000510"
            }
        }
    }

    // --- ENTITY LAYER ---
    Item {
        id: entityLayer
        anchors.fill: parent
    }







    Component {
        id: boidComponent
        BoidDelegate {
            Component.onCompleted: {
                 // console.log("BoidDelegate created");
            }
        }
    }

    property var sim: null

    Timer {
        id: physicsTimer
        // OPTIMIZATION: Fixed Physics Tick (25 Hz). Visuals smoothed by BoidDelegate.
        interval: 40 
        running: true
        repeat: true
        property double lastExecutionTime: 0
        property int ignoreFrames: 0

        onTriggered: {
            var now = Date.now();
            var realDt = (lastExecutionTime > 0) ? (now - lastExecutionTime) : interval;
            lastExecutionTime = now;

            if (!sim) {
                var dpr = Screen.devicePixelRatio;
                sim = Boids.createSimulation(wallpaper.width, wallpaper.height, dpr, wallpaper.configuration);
            }
            
            // Update Config
            sim.config = wallpaper.configuration;
            
            // Physics Step
            var dt = interval / 16.6; 
            Boids.step(sim, dt, wallpaper.configuration);
            
            // View Sync (Create/Update/Destroy QML Objects)
            Boids.sync(sim, entityLayer, boidComponent);
            
            // --- STRESS LOGIC ---
            // Ensure sensorStress is updated from sensors
            var totalStress = Math.max(wallpaper.sensorStress, wallpaper.lagStress);
            var intensity = wallpaper.configuration.reactivityIntensity !== undefined ? wallpaper.configuration.reactivityIntensity : 1.0;
            totalStress *= intensity;
            
            sim.cpuStress = totalStress; 
            // Only affect speed if high stress
            sim.speedMultiplier = 1.0 + (totalStress * 0.6);
        }
    }

    onWidthChanged:  { if (sim) Boids.resize(sim, width, height, 1); }
    onHeightChanged: { if (sim) Boids.resize(sim, width, height, 1); }

    // --- SENSOR LOGIC ---
    Sensors.Sensor {
        id: primarySensor
        property int mode: wallpaper.configuration ? wallpaper.configuration.sensorMode : 0
        sensorId: (mode === 3) ? (wallpaper.configuration.sensorId || "cpu/all/usage") : 
                  (mode === 2) ? "gpu/all/usage" : "cpu/all/usage"
        updateRateLimit: 500
        enabled: (mode !== 4)
        onValueChanged: updateStress()
    }

    Sensors.Sensor {
        id: secondarySensor
        property int mode: wallpaper.configuration ? wallpaper.configuration.sensorMode : 0
        sensorId: (mode === 3) ? (wallpaper.configuration.sensorId2 || "") : "gpu/all/usage"
        updateRateLimit: 500
        enabled: (mode === 0) || (mode === 3 && sensorId !== "")
        onValueChanged: updateStress()
    }

    // NUCLEAR INPUT REWRITE (The "Dumb" Layer)
    // No logic checks. No state validation. Just RAW INPUT.
    MouseArea {
        anchors.fill: parent
        anchors.margins: 0 
        z: 99999 // Over 9000 prioritization
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton

        // DEBUG VISUAL: Flash Red on Click to PROVE input is working
        Rectangle {
            id: debugFlash
            anchors.fill: parent
            color: "#FF0000"
            opacity: 0.0
            z: 1
            
            NumberAnimation on opacity {
                id: flashAnim
                from: 0.3; to: 0.0; duration: 200
                running: false
            }
        }

        onClicked: (mouse) => {
            console.log("FORCE CLICK at: " + mouse.x + ", " + mouse.y);
            flashAnim.running = true; // TRIGGER FLASH
            
            if (sim) {
                // DIRECT CALL - NO IF STATEMENTS checking settings
                Boids.forceSpawnBubble(sim, mouse.x, mouse.y); 
                if (mouse.button === Qt.LeftButton) {
                    Boids.forceSpawnWorm(sim, mouse.x, mouse.y);
                }
            }
        }


        onPositionChanged: (mouse) => {
            if (sim) {
                 Boids.forceRepulse(sim, mouse.x, mouse.y);
            }
        }
        
        onExited: {
             if (sim) {
                 sim.mouse.x = -9999;
                 sim.mouse.y = -9999;
             }
        }
    }



    function updateStress() {
        if (!wallpaper.sim) return;
        var val1 = primarySensor.value;
        var val2 = (secondarySensor.enabled) ? secondarySensor.value : 0;
        var s1 = normalizeSensor(val1, primarySensor.sensorId);
        var s2 = normalizeSensor(val2, secondarySensor.sensorId);
        wallpaper.sensorStress = Math.max(s1, s2);
    }

    function normalizeSensor(raw, sId) {
        if (raw === undefined || raw === null) return 0.0;
        var idStr = sId.toLowerCase();
        
        // Correctly handle percentage usage (0-100)
        if (idStr.indexOf("usage") !== -1 || idStr.indexOf("load") !== -1) {
            return Math.max(0.0, Math.min(1.0, raw / 100.0));
        }
        
        // Dynamic range for other sensors (e.g. Temp)
        return Math.min(Math.max((raw - 40) / 40, 0), 1);
    }

}
