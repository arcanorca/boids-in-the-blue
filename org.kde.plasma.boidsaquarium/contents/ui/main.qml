import QtQuick
import QtQuick.Window
import org.kde.plasma.plasmoid
import org.kde.ksysguard.sensors 1.0 as Sensors

import "code/boids.js" as Boids

WallpaperItem {
    id: wallpaper

    Canvas {
        id: canvas
        anchors.fill: parent

        // Watch config keys that need a full simulation re-creation.
        // Creature counts AND sizes need re-init (sizes are baked into entities).
        // Physics/factors/colors are read live each frame from wallpaper.configuration.
        property var configTrigger: wallpaper.configuration ? [
            wallpaper.configuration.fishCount,
            wallpaper.configuration.anglerCount,
            wallpaper.configuration.orcaCount,
            wallpaper.configuration.jellyCount,
            wallpaper.configuration.fishSize,
            wallpaper.configuration.anglerSize,
            wallpaper.configuration.orcaSize,
            wallpaper.configuration.jellySize,
            wallpaper.configuration.wormSize
        ] : []

        onConfigTriggerChanged: {
             if (sim && Boids && Boids.createSimulation) {
                 canvas.sim = Boids.createSimulation(width, height, 1, wallpaper.configuration);
                 requestPaint();
             }
        }

        property var sim: null

        Timer {
            id: tick
            // FPS reads live from config
            interval: {
                var fps = wallpaper.configuration.fps || 30;
                fps = Math.max(15, Math.min(120, fps));
                return Math.round(1000 / fps);
            }
            repeat: true
            running: true
            triggeredOnStart: true
            onTriggered: {
                if (!canvas.sim) {
                    canvas.sim = Boids.createSimulation(canvas.width, canvas.height, 1, wallpaper.configuration);
                    canvas.requestPaint();
                    return;
                }

                var dt = interval / 1000.0;
                Boids.step(canvas.sim, dt, wallpaper.configuration);
                canvas.requestPaint();
            }
        }

        onWidthChanged:  { if (sim) Boids.resize(sim, width, height, 1); }
        onHeightChanged: { if (sim) Boids.resize(sim, width, height, 1); }

        onPaint: {
            if (!sim) return;
            var ctx = getContext("2d");
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            Boids.paint(ctx, sim, wallpaper.configuration);
        }
        
        // Hover-only layer for cursor bubbles (does NOT consume clicks)
        MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.NoButton  // Pass all clicks through!
            
            property int hoverCount: 0
            
            onPositionChanged: (mouse) => {
                hoverCount++;
                if (canvas.sim) {
                    canvas.sim.mouse = { x: mouse.x, y: mouse.y };
                }
                // Spawn a bubble only every 28th hover event — zen amount
                if (canvas.sim && hoverCount % 28 === 0) {
                    Boids.spawnBubble(canvas.sim, mouse.x, mouse.y);
                }
            }
        }

        // Click layer for worm feeding
        MouseArea {
            anchors.fill: parent
            
            onClicked: (mouse) => {
                if (canvas.sim) {
                    Boids.spawnWorm(canvas.sim, mouse.x, mouse.y);
                }
            }
        }
    }

    // --- SENSOR LOGIC ---
    // Mode: 0=Hybrid, 1=CPU, 2=GPU, 3=Custom, 4=Passive
    
    // PRIMARY SENSOR
    Sensors.Sensor {
        id: primarySensor
        property int mode: wallpaper.configuration.sensorMode
        
        // Mode 3 (Custom): Uses config.
        // Mode 2 (GPU): Uses GPU Default.
        // Mode 0 (Hybrid) or 1 (CPU): Uses CPU Default.
        sensorId: (mode === 3) ? wallpaper.configuration.sensorId : 
                  (mode === 2) ? "gpu/all/usage" : "cpu/all/usage"
        
        updateRateLimit: 500
        // Enable unless Passive(4)
        enabled: (mode !== 4)

        onValueChanged: {
            updateStress();
        }
    }

    // SECONDARY SENSOR
    Sensors.Sensor {
        id: secondarySensor
        property int mode: wallpaper.configuration.sensorMode
        
        // Mode 3 (Custom): Uses config2.
        // Mode 0 (Hybrid): Uses GPU Default.
        sensorId: (mode === 3) ? wallpaper.configuration.sensorId2 : "gpu/all/usage"
        
        updateRateLimit: 500
        // Enable if Hybrid(0) OR (Custom(3) AND ID is not empty)
        enabled: (mode === 0) || (mode === 3 && wallpaper.configuration.sensorId2 !== "")

        onValueChanged: {
            updateStress();
        }
    }

    function updateStress() {
        if (!canvas.sim) return;
        
        var val1 = primarySensor.value;
        var val2 = (secondarySensor.enabled) ? secondarySensor.value : 0;
        
        // Normalize both
        var s1 = normalizeSensor(val1, primarySensor.sensorId);
        var s2 = normalizeSensor(val2, secondarySensor.sensorId);
        
        // Take the MAXIMUM stress (If CPU or GPU is high, fish panic)
        // Apply Intensity Multiplier
        var intensity = wallpaper.configuration.reactivityIntensity;
        // Default to 1.0 if undefined
        if (intensity === undefined) intensity = 1.0;
        
        var totalStress = Math.max(s1, s2) * intensity;
        
        canvas.sim.cpuStress = totalStress;
        canvas.sim.speedMultiplier = 1.0 + (totalStress * 0.6);
    }

    function normalizeSensor(raw, sId) {
        if (raw === undefined) return 0;
        var idStr = sId.toLowerCase();
        // Load Mode (0-100 or 0-1)
        if (idStr.indexOf("usage") !== -1 || idStr.indexOf("load") !== -1 || raw <= 1.0) {
            return (raw <= 1.0) ? raw : (raw / 100.0);
        }
        // Temp Mode (40-80)
        return Math.min(Math.max((raw - 40) / 40, 0), 1);
    }
}
