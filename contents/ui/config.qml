import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.kquickcontrols as KQControls

Kirigami.FormLayout {
    id: root

    // --- ALL Config Aliases ---
    
    // FPS Slider Removed for optimization
    // property alias cfg_fps: fpsSlider.value
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

    // Predator Speeds
    property alias cfg_anglerSpeed: anglerSpeedSlider.value
    property alias cfg_orcaSpeed: orcaSpeedSlider.value
    property alias cfg_orcaChase: orcaChaseSlider.value
    property alias cfg_anglerChase: anglerChaseSlider.value

    // Physics
    property alias cfg_fishMaxSpeed: maxSpeedSlider.value
    property alias cfg_fishMinSpeed: minSpeedSlider.value
    property alias cfg_visualRange: visualRangeInput.value

    property alias cfg_separationDist: sepDistInput.value
    property alias cfg_cohesionFactor: cohesionInput.value
    property alias cfg_alignmentFactor: alignmentInput.value
    property alias cfg_separationFactor: separationInput.value
    property alias cfg_wanderFactor: wanderInput.value
    property alias cfg_turnFactor: turnInput.value

    // Colors
    property alias cfg_dayNightCycle: dayNightSwitch.checked
    property alias cfg_waterTop: colorTop.color
    property alias cfg_waterBottom: colorBottom.color

    // System Monitor
    property alias cfg_sensorId: sensorIdInput.text
    property alias cfg_sensorId2: sensorIdInput2.text
    property alias cfg_reactivityIntensity: reactivitySlider.value



    // ─── HEADER ─────────────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.isSection: true }

    Label {
        text: i18n("Dive into a computational abyss.\nSchooling patterns arise from simple rules — the ecosystem breathes with your PC.")
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
        Layout.maximumWidth: 420
        Layout.bottomMargin: 8
        font.italic: true
        opacity: 0.6
    }

    // ─── CREATURES ────────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Creatures"); Kirigami.FormData.isSection: true }

    NumberInput { id: fishCountInput;   label: i18n("Fish");      min: 5;  max: 200; step: 1; precision: 0 }
    NumberInput { id: jellyCountInput;  label: i18n("Jellyfish");  min: 0;  max: 50;  step: 1; precision: 0 }
    NumberInput { id: anglerCountInput; label: i18n("Anglers");    min: 0;  max: 20;  step: 1; precision: 0 }
    NumberInput { id: orcaCountInput;   label: i18n("Orcas");      min: 0;  max: 10;  step: 1; precision: 0 }

    // ─── SIZE ─────────────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Size"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18n("Fish")
        Slider { id: fishSizeSlider; from: 1.0; to: 8.0; stepSize: 0.1; Layout.fillWidth: true }
        Label { text: fishSizeSlider.value.toFixed(1) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Jellyfish")
        Slider { id: jellySizeSlider; from: 1.0; to: 8.0; stepSize: 0.1; Layout.fillWidth: true }
        Label { text: jellySizeSlider.value.toFixed(1) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Angler")
        Slider { id: anglerSizeSlider; from: 1.0; to: 10.0; stepSize: 0.1; Layout.fillWidth: true }
        Label { text: anglerSizeSlider.value.toFixed(1) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Orca")
        Slider { id: orcaSizeSlider; from: 1.0; to: 10.0; stepSize: 0.1; Layout.fillWidth: true }
        Label { text: orcaSizeSlider.value.toFixed(1) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Worm")
        Slider { id: wormSizeSlider; from: 1.0; to: 10.0; stepSize: 0.5; Layout.fillWidth: true }
        Label { text: wormSizeSlider.value.toFixed(1) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }

    // ─── SPEED & MOVEMENT ─────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Speed & Movement"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18n("Max Speed")
        Slider { id: maxSpeedSlider; from: 0.1; to: 3.0; stepSize: 0.05; Layout.fillWidth: true }
        Label { text: maxSpeedSlider.value.toFixed(2); Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Min Speed")
        Slider { id: minSpeedSlider; from: 0.05; to: 1.0; stepSize: 0.05; Layout.fillWidth: true }
        Label { text: minSpeedSlider.value.toFixed(2); Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }

    // ─── PREDATORS ────────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Predators"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18n("Angler Speed")
        Slider { id: anglerSpeedSlider; from: 0.1; to: 3.0; stepSize: 0.05; Layout.fillWidth: true }
        Label { text: anglerSpeedSlider.value.toFixed(2) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Orca Speed")
        Slider { id: orcaSpeedSlider; from: 0.1; to: 3.0; stepSize: 0.05; Layout.fillWidth: true }
        Label { text: orcaSpeedSlider.value.toFixed(2) + "×"; Layout.preferredWidth: 50; horizontalAlignment: Text.AlignRight }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Orca Aggression")
        Slider { id: orcaChaseSlider; from: 0.0; to: 2.0; stepSize: 0.1; Layout.fillWidth: true }
        Label {
            text: {
                var v = orcaChaseSlider.value;
                if (v < 0.1) return i18n("Off");
                if (v < 0.5) return i18n("Gentle");
                if (v < 1.0) return i18n("Subtle");
                if (v < 1.5) return i18n("Active");
                return i18n("Aggressive");
            }
            Layout.preferredWidth: 80
            horizontalAlignment: Text.AlignRight
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18n("Angler Aggression")
        Slider { id: anglerChaseSlider; from: 0.0; to: 2.0; stepSize: 0.1; Layout.fillWidth: true }
        Label {
            text: {
                var v = anglerChaseSlider.value;
                if (v < 0.1) return i18n("Off");
                if (v < 0.5) return i18n("Gentle");
                if (v < 1.0) return i18n("Subtle");
                if (v < 1.5) return i18n("Active");
                return i18n("Aggressive");
            }
            Layout.preferredWidth: 80
            horizontalAlignment: Text.AlignRight
        }
    }

    // ─── INTERACTION ──────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Interaction"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18n("Cursor Panic")
        Slider {
            id: cursorFearSlider
            from: 0; to: 4; stepSize: 1
            snapMode: Slider.SnapAlways
            Layout.fillWidth: true
        }
        Label {
            text: {
                var v = cursorFearSlider.value;
                if (v === 0) return i18n("None");
                if (v === 1) return i18n("Zen");
                if (v === 2) return i18n("Zen+");
                if (v === 3) return i18n("Strong");
                return i18n("Panic");
            }
            Layout.preferredWidth: 80
            horizontalAlignment: Text.AlignRight
        }
    }

    // ─── FLOCKING BEHAVIOR ──────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Flocking Behavior"); Kirigami.FormData.isSection: true }

    Label {
        text: i18n("Controls how fish school together. These values are interconnected — small changes have visible effects.")
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
        Layout.maximumWidth: 420
        Layout.bottomMargin: 4
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.55
    }

    NumberInput { id: sepDistInput;     label: i18n("Personal Space");         min: 10;  max: 100; step: 1;     precision: 0 }
    Label {
        text: i18n("Minimum gap between fish. Higher = looser school.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
        Layout.bottomMargin: 6
    }

    NumberInput { id: visualRangeInput; label: i18n("Vision Range");           min: 40;  max: 400; step: 10;    precision: 0 }
    Label {
        text: i18n("How far each fish can see its neighbors.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
        Layout.bottomMargin: 6
    }

    NumberInput { id: cohesionInput;    label: i18n("Flock Attraction");       min: 0;   max: 0.02; step: 0.001; precision: 3 }
    Label {
        text: i18n("Pull toward center of nearby group.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
        Layout.bottomMargin: 6
    }

    NumberInput { id: alignmentInput;   label: i18n("Direction Matching");     min: 0;   max: 0.15; step: 0.005; precision: 3 }
    Label {
        text: i18n("Match swimming direction with neighbors.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
        Layout.bottomMargin: 6
    }

    NumberInput { id: separationInput;  label: i18n("Repulsion Force");        min: 0;   max: 0.2;  step: 0.005; precision: 3 }
    Label {
        text: i18n("Push away from too-close neighbors.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
        Layout.bottomMargin: 6
    }

    NumberInput { id: wanderInput;      label: i18n("Random Drift");           min: 0;   max: 0.05; step: 0.002; precision: 3 }
    Label {
        text: i18n("Natural randomness in movement.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
        Layout.bottomMargin: 6
    }

    NumberInput { id: turnInput;        label: i18n("Edge Avoidance");         min: 0;   max: 0.15; step: 0.005; precision: 3 }
    Label {
        text: i18n("Turn strength when approaching screen edges.")
        Kirigami.FormData.label: " "
        font.pointSize: Kirigami.Theme.smallFont.pointSize
        opacity: 0.45
    }

    // ─── ENVIRONMENT ──────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("Environment"); Kirigami.FormData.isSection: true }

    CheckBox {
        id: dayNightSwitch
        Kirigami.FormData.label: i18n("Day/Night Cycle")
        text: i18n("Sync water colors with time of day")
    }

    KQControls.ColorButton {
        id: colorTop
        Kirigami.FormData.label: i18n("Water Surface")
        showAlphaChannel: false
        enabled: !dayNightSwitch.checked
        opacity: dayNightSwitch.checked ? 0.4 : 1.0
    }
    KQControls.ColorButton {
        id: colorBottom
        Kirigami.FormData.label: i18n("Water Deep")
        showAlphaChannel: false
        enabled: !dayNightSwitch.checked
        opacity: dayNightSwitch.checked ? 0.4 : 1.0
    }

    // ─── SYSTEM REACTIVITY ────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.label: i18n("System Reactivity"); Kirigami.FormData.isSection: true }

    ComboBox {
        id: sensorTypeCombo
        Kirigami.FormData.label: i18n("Source")
        model: [
            i18n("Hybrid (CPU + GPU)"),
            i18n("CPU Only"),
            i18n("GPU Only"),
            i18n("Custom Sensor"),
            i18n("Disabled")
        ]
        Layout.fillWidth: true
    }

    RowLayout {
        Kirigami.FormData.label: i18n("Intensity")
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
                if (v <= 25) return v + "% " + i18n("Damped");
                if (v <= 50) return v + "% " + i18n("Subtle");
                if (v <= 100) return v + "% " + i18n("Organic");
                if (v <= 150) return v + "% " + i18n("Nervous");
                return v + "% " + i18n("Volatile");
            }
            Layout.preferredWidth: 110
            horizontalAlignment: Text.AlignRight
        }
    }

    TextField {
        id: sensorIdInput
        visible: sensorTypeCombo.currentIndex === 3
        Kirigami.FormData.label: i18n("Primary Sensor")
        placeholderText: "cpu/all/usage"
        Layout.fillWidth: true
    }

    TextField {
        id: sensorIdInput2
        visible: sensorTypeCombo.currentIndex === 3
        Kirigami.FormData.label: i18n("Secondary Sensor")
        placeholderText: "gpu/all/usage"
        Layout.fillWidth: true
    }

    // ─── RESET ────────────────────────────────────────────────
    Kirigami.Separator { Kirigami.FormData.isSection: true }

    Button {
        text: i18n("Reset All to Defaults")
        icon.name: "edit-undo"
        Kirigami.FormData.label: " "
        onClicked: {
            fishCountInput.value = 38;
            jellyCountInput.value = 5;
            anglerCountInput.value = 3;
            orcaCountInput.value = 3;
            fishSizeSlider.value = 4.0;
            jellySizeSlider.value = 3.0;
            anglerSizeSlider.value = 4.2;
            orcaSizeSlider.value = 5.5;
            wormSizeSlider.value = 4.0;
            cursorFearSlider.value = 2;
            maxSpeedSlider.value = 0.8;
            minSpeedSlider.value = 0.2;
            anglerSpeedSlider.value = 1.0;
            orcaSpeedSlider.value = 1.0;
            orcaChaseSlider.value = 0.7;
            anglerChaseSlider.value = 0.7;
            sepDistInput.value = 35;
            visualRangeInput.value = 130;
            cohesionInput.value = 0.005;
            alignmentInput.value = 0.05;
            separationInput.value = 0.05;
            wanderInput.value = 0.015;
            turnInput.value = 0.06;
            dayNightSwitch.checked = false;
            colorTop.color = "#0f4c75";
            colorBottom.color = "#051e36";
            sensorTypeCombo.currentIndex = 0;
            reactivitySlider.value = 1.0;
            sensorIdInput.text = "cpu/all/usage";
            sensorIdInput2.text = "gpu/all/usage";
        }
    }
}
