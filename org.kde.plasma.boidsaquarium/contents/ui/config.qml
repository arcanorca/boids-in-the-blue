import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.kquickcontrols as KQControls

Kirigami.FormLayout {
    id: root

    // --- ALL Config Aliases ---
    
    property alias cfg_fps: fpsSlider.value
    // Lite Mode Removed
    property alias cfg_sensorMode: sensorTypeCombo.currentIndex

    // Entity Counts
    property alias cfg_fishCount: fishCountInput.value
    property alias cfg_jellyCount: jellyCountInput.value
    property alias cfg_anglerCount: anglerCountInput.value
    property alias cfg_orcaCount: orcaCountInput.value

    // Sizes
    property alias cfg_fishSize: fishSizeSlider.value
    property alias cfg_jellySize: jellySizeSlider.value
    property alias cfg_anglerSize: anglerSizeSlider.value
    property alias cfg_orcaSize: orcaSizeSlider.value
    property alias cfg_wormSize: wormSizeSlider.value
    property alias cfg_cursorFearLevel: cursorFearSlider.value

    // Physics
    property alias cfg_maxSpeed: maxSpeedSlider.value
    property alias cfg_minSpeed: minSpeedSlider.value
    property alias cfg_visualRange: visualRangeInput.value
    property alias cfg_separationDist: sepDistInput.value
    property alias cfg_cohesionFactor: cohesionInput.value
    property alias cfg_alignmentFactor: alignmentInput.value
    property alias cfg_separationFactor: separationInput.value
    property alias cfg_wanderFactor: wanderInput.value
    property alias cfg_turnFactor: turnInput.value

    // Colors
    property alias cfg_waterTop: colorTop.color
    property alias cfg_waterBottom: colorBottom.color

    // System Monitor
    property alias cfg_sensorId: sensorIdInput.text
    property alias cfg_sensorId2: sensorIdInput2.text
    property alias cfg_reactivityIntensity: reactivitySlider.value

    function resetToDefaults() {
        cfg_fps = 30;
        
        cfg_fishCount = 38;
        cfg_jellyCount = 5;
        cfg_anglerCount = 3;
        cfg_orcaCount = 3;
        
        cfg_liteMode = false;

        cfg_fishSize = 4.0;
        cfg_jellySize = 2.5;
        cfg_anglerSize = 4.0;
        cfg_orcaSize = 5.5;
        cfg_wormSize = 4;

        cfg_maxSpeed = 0.75;
        cfg_minSpeed = 0.25;
        cfg_visualRange = 130;
        cfg_separationDist = 30;
        cfg_cohesionFactor = 0.005;
        cfg_alignmentFactor = 0.05;
        cfg_separationFactor = 0.05;
        cfg_wanderFactor = 0.015;
        cfg_turnFactor = 0.03;

        cfg_waterTop = "#052A45";
        cfg_waterBottom = "#001020";

        
        cfg_sensorId = "cpu/all/usage";
        cfg_sensorId2 = "gpu/all/usage";
        cfg_reactivityIntensity = 1.0;
    }

    // ============================================================
    //  HEADER
    // ============================================================

    Button {
        Layout.alignment: Qt.AlignRight
        text: i18n("Reset All Defaults")
        icon.name: "edit-reset"
        onClicked: root.resetToDefaults()
    }

    // Lite Mode Removed

    Kirigami.Separator { Kirigami.FormData.label: i18n("🌊 Boids in the Blue") }

    Label {
        text: i18n("Dive into a computational abyss. Watch complex schooling patterns arise from simple rules. The ecosystem breathes with your PC.")
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
        Layout.maximumWidth: 400 // Limit width to prevent stretching
        font.italic: true
        opacity: 0.7
    }

    // ============================================================
    //  POPULATION
    // ============================================================
    Kirigami.Separator { Kirigami.FormData.label: i18n("Population") }

    NumberInput {
        id: fishCountInput
        label: i18n("Fish")
        min: 5; max: 200; step: 1; precision: 0
    }
    NumberInput {
        id: jellyCountInput
        label: i18n("Jellyfish")
        min: 0; max: 50; step: 1; precision: 0
    }
    NumberInput {
        id: anglerCountInput
        label: i18n("Anglers")
        min: 0; max: 20; step: 1; precision: 0
    }
    NumberInput {
        id: orcaCountInput
        label: i18n("Orcas")
        min: 0; max: 10; step: 1; precision: 0
    }

    // ============================================================
    //  CREATURE SCALE (Sliders for easy adjustment)
    // ============================================================
    Kirigami.Separator { Kirigami.FormData.label: i18n("Creature Scale") }

    RowLayout {
        Kirigami.FormData.label: i18n("Fish")
        Slider {
            id: fishSizeSlider
            from: 1.0; to: 8.0; stepSize: 0.1
            Layout.fillWidth: true
        }
        Label {
            text: fishSizeSlider.value.toFixed(1) + "×"
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Jellyfish")
        Slider {
            id: jellySizeSlider
            from: 1.0; to: 8.0; stepSize: 0.1
            Layout.fillWidth: true
        }
        Label {
            text: jellySizeSlider.value.toFixed(1) + "×"
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Angler")
        Slider {
            id: anglerSizeSlider
            from: 1.0; to: 10.0; stepSize: 0.1
            Layout.fillWidth: true
        }
        Label {
            text: anglerSizeSlider.value.toFixed(1) + "×"
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Orca")
        Slider {
            id: orcaSizeSlider
            from: 1.0; to: 10.0; stepSize: 0.1
            Layout.fillWidth: true
        }
        Label {
            text: orcaSizeSlider.value.toFixed(1) + "×"
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Worm")
        Slider {
            id: wormSizeSlider
            from: 1.0; to: 10.0; stepSize: 0.5
            Layout.fillWidth: true
        }
        Label {
            text: wormSizeSlider.value.toFixed(1) + "×"
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }

    // ============================================================
    //  BEHAVIOR
    // ============================================================
    Kirigami.Separator { Kirigami.FormData.label: i18n("Behavior") }

    RowLayout {
        Kirigami.FormData.label: i18n("FPS")
        Slider {
            id: fpsSlider
            from: 15; to: 120; stepSize: 5
            Layout.fillWidth: true
        }
        Label {
            text: Math.round(fpsSlider.value).toString()
            Layout.preferredWidth: 30
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Max Speed")
        Slider {
            id: maxSpeedSlider
            from: 0.1; to: 3.0; stepSize: 0.05
            Layout.fillWidth: true
        }
        Label {
            text: maxSpeedSlider.value.toFixed(2)
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Min Speed")
        Slider {
            id: minSpeedSlider
            from: 0.05; to: 1.5; stepSize: 0.05
            Layout.fillWidth: true
        }
        Label {
            text: minSpeedSlider.value.toFixed(2)
            Layout.preferredWidth: 40
            horizontalAlignment: Text.AlignRight
        }
    }

    NumberInput {
        id: visualRangeInput
        label: i18n("Flocking Range")
        min: 30; max: 500; step: 10; precision: 0
    }
    NumberInput {
        id: sepDistInput
        label: i18n("Personal Space")
        min: 5; max: 100; step: 5; precision: 0
    }

    
    RowLayout {
        Kirigami.FormData.label: i18n("Cursor Panic")
        Slider {
            id: cursorFearSlider
            from: 0; to: 4; stepSize: 1
            snapMode: Slider.SnapAlways
            Layout.fillWidth: true
        }
        Label {
            // 0=Off, 1=Zen, 2=Active, 3=Strong, 4=Panic
            text: {
                var v = cursorFearSlider.value;
                if (v === 0) return i18n("None");
                if (v === 1) return i18n("Zen");
                if (v === 2) return i18n("Active");
                if (v === 3) return i18n("Strong");
                return i18n("Panic");
            }
            Layout.preferredWidth: 60
            horizontalAlignment: Text.AlignRight
        }
    }

    // ============================================================
    //  FLOCKING FACTORS (Advanced)
    // ============================================================
    Kirigami.Separator { Kirigami.FormData.label: i18n("Flocking Factors") }

    NumberInput {
        id: cohesionInput
        label: i18n("Cohesion")
        min: 0; max: 0.05; step: 0.001; precision: 3
    }
    NumberInput {
        id: alignmentInput
        label: i18n("Alignment")
        min: 0; max: 0.2; step: 0.005; precision: 3
    }
    NumberInput {
        id: separationInput
        label: i18n("Separation")
        min: 0; max: 0.2; step: 0.005; precision: 3
    }
    NumberInput {
        id: wanderInput
        label: i18n("Wander")
        min: 0; max: 0.1; step: 0.005; precision: 3
    }
    NumberInput {
        id: turnInput
        label: i18n("Edge Turn")
        min: 0; max: 0.2; step: 0.005; precision: 3
    }

    // ============================================================
    //  COLORS
    // ============================================================
    Kirigami.Separator { Kirigami.FormData.label: i18n("Water Colors") }

    KQControls.ColorButton {
        id: colorTop
        Kirigami.FormData.label: i18n("Surface")
        showAlphaChannel: false
    }
    KQControls.ColorButton {
        id: colorBottom
        Kirigami.FormData.label: i18n("Deep")
        showAlphaChannel: false
    }

    // ============================================================
    //  ECOSYSTEM REACTIVITY
    // ============================================================
    Kirigami.Separator { Kirigami.FormData.label: i18n("Ecosystem Reactivity") }

    ComboBox {
        id: sensorTypeCombo
        Kirigami.FormData.label: i18n("Input Source")
        model: [
            i18n("Hybrid System Load (Default)"), 
            i18n("CPU Load"), 
            i18n("GPU Load"), 
            i18n("Custom Path"),
            i18n("None (Passive)")
        ]
        Layout.fillWidth: true
        // 0=Hybrid, 1=CPU, 2=GPU, 3=Custom, 4=Passive
    }

    // Response Intensity Slider (Hidden if Passive)
    RowLayout {
        Kirigami.FormData.label: i18n("Response Intensity")
        visible: sensorTypeCombo.currentIndex !== 4
        Slider {
            id: reactivitySlider
            from: 0.25; to: 2.0; stepSize: 0.25
            snapMode: Slider.SnapAlways
            Layout.fillWidth: true
        }
        Label {
            text: {
                var v = Math.round(reactivitySlider.value * 100);
                var mood = "";
                if (v <= 25) mood = i18n("Damped");
                else if (v <= 50) mood = i18n("Subtle");
                else if (v <= 100) mood = i18n("Organic");
                else if (v <= 150) mood = i18n("Nervous");
                else mood = i18n("Volatile");
                return v + "% (" + mood + ")";
            }
            Layout.preferredWidth: 150
            horizontalAlignment: Text.AlignRight
        }
    }

    TextField {
        id: sensorIdInput
        visible: sensorTypeCombo.currentIndex === 3
        Kirigami.FormData.label: i18n("Primary Sensor ID")
        placeholderText: "cpu/all/usage"
        Layout.fillWidth: true
    }

    TextField {
        id: sensorIdInput2
        visible: sensorTypeCombo.currentIndex === 3
        Kirigami.FormData.label: i18n("Secondary Sensor ID (Optional)")
        placeholderText: "gpu/all/usage"
        Layout.fillWidth: true
    }
}
