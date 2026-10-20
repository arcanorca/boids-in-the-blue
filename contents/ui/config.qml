import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.kquickcontrols as KQControls

import "code/themes.js" as Themes

Kirigami.FormLayout {
    id: root

    // Align labels with the Layout / Wallpaper type combos of the shell dialog
    // (parentLayout is provided by the shell's ConfigurationContainmentAppearance.qml)
    twinFormLayouts: parentLayout
    property alias formLayout: root

    // ── Config aliases (keys and defaults live in contents/config/main.xml) ──
    property string cfg_theme
    property string cfg_themeDefault

    // Ocean
    property alias cfg_fishCount: fishCountInput.value
    property alias cfg_jellyCount: jellyCountInput.value
    property alias cfg_anglerCount: anglerCountInput.value
    property alias cfg_orcaCount: orcaCountInput.value

    // Behavior
    property alias cfg_cursorFearLevel: cursorFearSlider.value
    property alias cfg_orcaChase: orcaChaseSlider.value
    property alias cfg_anglerChase: anglerChaseSlider.value

    // Environment
    property alias cfg_dayNightCycle: dayNightSwitch.checked
    property alias cfg_waterTop: colorTop.color
    property alias cfg_waterBottom: colorBottom.color

    // System reactivity
    property alias cfg_sensorMode: sensorTypeCombo.currentIndex
    property alias cfg_reactivityIntensity: reactivitySlider.value
    property alias cfg_sensorId: sensorIdInput.text
    property alias cfg_sensorId2: sensorIdInput2.text

    // Performance
    property alias cfg_pauseWhenCovered: pauseCoveredCheck.checked

    // Advanced: sizes
    property alias cfg_fishSize: fishSizeSlider.value
    property alias cfg_jellySize: jellySizeSlider.value
    property alias cfg_anglerSize: anglerSizeSlider.value
    property alias cfg_orcaSize: orcaSizeSlider.value
    property alias cfg_wormSize: wormSizeSlider.value
    // Advanced: speeds
    property alias cfg_fishMaxSpeed: maxSpeedSlider.value
    property alias cfg_fishMinSpeed: minSpeedSlider.value
    property alias cfg_anglerSpeed: anglerSpeedSlider.value
    property alias cfg_orcaSpeed: orcaSpeedSlider.value
    // Advanced: flocking
    property alias cfg_visualRange: visualRangeInput.value
    property alias cfg_separationDist: sepDistInput.value
    property alias cfg_cohesionFactor: cohesionInput.value
    property alias cfg_alignmentFactor: alignmentInput.value
    property alias cfg_separationFactor: separationInput.value
    property alias cfg_wanderFactor: wanderInput.value
    property alias cfg_turnFactor: turnInput.value

    // Defaults from main.xml, populated by the shell
    property int cfg_sensorModeDefault
    property int cfg_fishCountDefault
    property int cfg_jellyCountDefault
    property int cfg_anglerCountDefault
    property int cfg_orcaCountDefault
    property double cfg_fishSizeDefault
    property double cfg_jellySizeDefault
    property double cfg_anglerSizeDefault
    property double cfg_orcaSizeDefault
    property double cfg_wormSizeDefault
    property int cfg_cursorFearLevelDefault
    property double cfg_anglerSpeedDefault
    property double cfg_orcaSpeedDefault
    property double cfg_orcaChaseDefault
    property double cfg_anglerChaseDefault
    property double cfg_fishMaxSpeedDefault
    property double cfg_fishMinSpeedDefault
    property int cfg_visualRangeDefault
    property int cfg_separationDistDefault
    property double cfg_cohesionFactorDefault
    property double cfg_alignmentFactorDefault
    property double cfg_separationFactorDefault
    property double cfg_wanderFactorDefault
    property double cfg_turnFactorDefault
    property bool cfg_dayNightCycleDefault
    property string cfg_waterTopDefault
    property string cfg_waterBottomDefault
    property string cfg_sensorIdDefault
    property string cfg_sensorId2Default
    property double cfg_reactivityIntensityDefault
    property bool cfg_pauseWhenCoveredDefault

    // ── Selected theme (unknown stored values count as the default theme) ──
    readonly property var theme: Themes.find(Themes.resolve(cfg_theme))
    property bool advancedVisible: false

    // ── Flocking presets ──
    // Order of the values: max speed, min speed, vision range, personal space, flock attraction,
    // direction matching, repulsion, random drift, edge avoidance. "Default" reads main.xml.
    readonly property var presetNames: [i18nc("@item:inlistbox flocking style", "Calm"),
                                        i18nc("@item:inlistbox flocking style", "Default"),
                                        i18nc("@item:inlistbox flocking style", "Lively"),
                                        i18nc("@item:inlistbox flocking style", "Chaotic")]
    readonly property var presetValues: [
        [0.5, 0.15, 150, 40, 0.004, 0.06, 0.04, 0.008, 0.05],
        null,
        [1.2, 0.3, 130, 30, 0.008, 0.06, 0.06, 0.025, 0.07],
        [2.0, 0.5, 90, 25, 0.003, 0.02, 0.08, 0.04, 0.10]
    ]
    function defaultValues() {
        return [cfg_fishMaxSpeedDefault, cfg_fishMinSpeedDefault, cfg_visualRangeDefault, cfg_separationDistDefault,
                cfg_cohesionFactorDefault, cfg_alignmentFactorDefault, cfg_separationFactorDefault,
                cfg_wanderFactorDefault, cfg_turnFactorDefault];
    }
    function currentValues() {
        return [cfg_fishMaxSpeed, cfg_fishMinSpeed, cfg_visualRange, cfg_separationDist,
                cfg_cohesionFactor, cfg_alignmentFactor, cfg_separationFactor, cfg_wanderFactor, cfg_turnFactor];
    }
    function presetFor(i) { return presetValues[i] ? presetValues[i] : defaultValues(); }
    function applyPreset(i) {
        var v = presetFor(i);
        // minimum first would be clamped by a lower maximum: set the maximum first
        cfg_fishMaxSpeed = v[0]; cfg_fishMinSpeed = v[1]; cfg_visualRange = v[2]; cfg_separationDist = v[3];
        cfg_cohesionFactor = v[4]; cfg_alignmentFactor = v[5]; cfg_separationFactor = v[6];
        cfg_wanderFactor = v[7]; cfg_turnFactor = v[8];
    }
    // index of the preset matching the current values, -1 = custom
    readonly property int presetIndex: {
        var cur = currentValues();
        for (var i = 0; i < presetValues.length; i++) {
            var p = presetFor(i), same = true;
            for (var k = 0; k < p.length; k++) if (Math.abs(p[k] - cur[k]) > 0.00049) same = false;
            if (same) return i;
        }
        return -1;
    }

    function resetToDefaults() {
        cfg_theme = cfg_themeDefault;
        cfg_sensorMode = cfg_sensorModeDefault;
        cfg_fishCount = cfg_fishCountDefault;
        cfg_jellyCount = cfg_jellyCountDefault;
        cfg_anglerCount = cfg_anglerCountDefault;
        cfg_orcaCount = cfg_orcaCountDefault;
        cfg_fishSize = cfg_fishSizeDefault;
        cfg_jellySize = cfg_jellySizeDefault;
        cfg_anglerSize = cfg_anglerSizeDefault;
        cfg_orcaSize = cfg_orcaSizeDefault;
        cfg_wormSize = cfg_wormSizeDefault;
        cfg_cursorFearLevel = cfg_cursorFearLevelDefault;
        cfg_anglerSpeed = cfg_anglerSpeedDefault;
        cfg_orcaSpeed = cfg_orcaSpeedDefault;
        cfg_orcaChase = cfg_orcaChaseDefault;
        cfg_anglerChase = cfg_anglerChaseDefault;
        cfg_fishMaxSpeed = cfg_fishMaxSpeedDefault;
        cfg_fishMinSpeed = cfg_fishMinSpeedDefault;
        cfg_visualRange = cfg_visualRangeDefault;
        cfg_separationDist = cfg_separationDistDefault;
        cfg_cohesionFactor = cfg_cohesionFactorDefault;
        cfg_alignmentFactor = cfg_alignmentFactorDefault;
        cfg_separationFactor = cfg_separationFactorDefault;
        cfg_wanderFactor = cfg_wanderFactorDefault;
        cfg_turnFactor = cfg_turnFactorDefault;
        cfg_dayNightCycle = cfg_dayNightCycleDefault;
        cfg_waterTop = cfg_waterTopDefault;
        cfg_waterBottom = cfg_waterBottomDefault;
        cfg_sensorId = cfg_sensorIdDefault;
        cfg_sensorId2 = cfg_sensorId2Default;
        cfg_reactivityIntensity = cfg_reactivityIntensityDefault;
        cfg_pauseWhenCovered = cfg_pauseWhenCoveredDefault;
    }

    function levelName(v) {   // aggression: 0 .. 2
        if (v < 0.1) return i18nc("@item aggression level", "Off");
        if (v < 0.5) return i18nc("@item aggression level", "Gentle");
        if (v < 1.0) return i18nc("@item aggression level", "Moderate");
        if (v < 1.5) return i18nc("@item aggression level", "Active");
        return i18nc("@item aggression level", "Aggressive");
    }

    // ═══ THEME ══════════════════════════════════════════════════
    ColumnLayout {
        Kirigami.FormData.label: i18nc("@label:listbox", "Theme:")
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 30
        spacing: Kirigami.Units.smallSpacing

        ComboBox {
            id: themeCombo
            Layout.fillWidth: true
            textRole: "name"
            model: {
                var m = [];
                for (var i = 0; i < Themes.THEMES.length; i++) m.push({ name: i18n(Themes.THEMES[i].name), id: Themes.THEMES[i].id });
                return m;
            }
            currentIndex: Themes.indexOf(Themes.resolve(root.cfg_theme))
            onActivated: (index) => { root.cfg_theme = Themes.THEMES[index].id; }
            Accessible.name: i18n("Theme")
        }
        Label {
            text: i18n(root.theme.description)
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
            font: Kirigami.Theme.smallFont
            opacity: 0.7
        }
    }

    // ═══ OCEAN ══════════════════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Ocean"); Kirigami.FormData.isSection: true }

    NumberInput {
        id: fishCountInput
        label: i18nc("@label:spinbox number of creatures", "Fish:")
        help: i18n("Schooling fish. More fish make richer flocks but use more processor time.")
        min: 5; max: 200; step: 1; precision: 0
    }
    NumberInput {
        id: jellyCountInput
        label: i18nc("@label:spinbox number of creatures", "Jellyfish:")
        help: i18n("Slow, translucent drifters.")
        min: 0; max: 50; step: 1; precision: 0
    }
    NumberInput {
        id: anglerCountInput
        label: i18nc("@label:spinbox number of creatures", "Anglerfish:")
        help: i18n("Deep-sea predators with a glowing lure. They hunt fish.")
        min: 0; max: 20; step: 1; precision: 0
    }
    NumberInput {
        id: orcaCountInput
        label: i18nc("@label:spinbox number of creatures", "Orcas:")
        help: i18n("The biggest predators. Fish scatter when one passes.")
        min: 0; max: 10; step: 1; precision: 0
    }

    // ═══ BEHAVIOR ═══════════════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Behavior"); Kirigami.FormData.isSection: true }

    ValueSlider {
        id: cursorFearSlider
        label: i18nc("@label:slider", "Cursor reaction:")
        help: i18n("How strongly fish swim away from your mouse pointer. Off ignores the pointer.")
        from: 0; to: 4; stepSize: 1
        format: function (v) {
            return [i18nc("@item cursor reaction", "Off"), i18nc("@item cursor reaction", "Gentle"),
                    i18nc("@item cursor reaction", "Moderate"), i18nc("@item cursor reaction", "Strong"),
                    i18nc("@item cursor reaction", "Panic")][Math.round(v)];
        }
    }
    ValueSlider {
        id: orcaChaseSlider
        label: i18nc("@label:slider", "Orca aggression:")
        help: i18n("How eagerly orcas chase fish.")
        from: 0.0; to: 2.0; stepSize: 0.1
        format: root.levelName
    }
    ValueSlider {
        id: anglerChaseSlider
        label: i18nc("@label:slider", "Angler aggression:")
        help: i18n("How eagerly anglerfish chase fish.")
        from: 0.0; to: 2.0; stepSize: 0.1
        format: root.levelName
    }
    RowLayout {
        Kirigami.FormData.label: i18nc("@label:listbox", "Fish flocking:")
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 30
        spacing: Kirigami.Units.smallSpacing

        ComboBox {
            id: presetCombo
            Layout.fillWidth: true
            model: root.presetNames
            displayText: currentIndex < 0 ? i18nc("@item:inlistbox flocking style, values edited by hand", "Custom") : currentText
            onActivated: (index) => root.applyPreset(index)
            Accessible.name: i18n("Fish flocking style")
        }
        Binding { target: presetCombo; property: "currentIndex"; value: root.presetIndex }
        HelpSlot {
            text: i18n("Presets for how fish school: speed, vision and the pull between neighbours. Fine-tune each value under Advanced.")
            name: i18n("Fish flocking style")
        }
    }

    // ═══ ENVIRONMENT ════════════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Environment"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18nc("@label", "Day and night:")
        spacing: Kirigami.Units.smallSpacing
        CheckBox {
            id: dayNightSwitch
            text: i18n("Follow the time of day")
            enabled: root.theme.usesDayNight
        }
        HelpSlot { text: i18n("The water brightens and darkens with the clock, with a golden shimmer at sunrise and sunset."); name: i18n("Day and night") }
    }

    Kirigami.InlineMessage {
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 30
        visible: !root.theme.usesWaterColors || dayNightSwitch.checked || !root.theme.usesDayNight
        type: Kirigami.MessageType.Information
        text: !root.theme.usesDayNight
              ? i18n("%1 has no day and night cycle.", i18n(root.theme.name))
              : (!root.theme.usesWaterColors
                 ? i18n("%1 paints its own water, so the water colors below are not used.", i18n(root.theme.name))
                 : i18n("The water colors follow the time of day while the cycle is on."))
    }

    KQControls.ColorButton {
        id: colorTop
        Kirigami.FormData.label: i18nc("@label:chooser", "Water surface:")
        showAlphaChannel: false
        enabled: !dayNightSwitch.checked && root.theme.usesWaterColors
        Accessible.name: i18n("Water surface color")
    }
    KQControls.ColorButton {
        id: colorBottom
        Kirigami.FormData.label: i18nc("@label:chooser", "Water depths:")
        showAlphaChannel: false
        enabled: !dayNightSwitch.checked && root.theme.usesWaterColors
        Accessible.name: i18n("Water depths color")
    }

    // ═══ SYSTEM REACTIVITY ══════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "System reactivity"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18nc("@label:listbox", "React to:")
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 30
        spacing: Kirigami.Units.smallSpacing

        ComboBox {
            id: sensorTypeCombo
            Layout.fillWidth: true
            model: [
                i18n("Processor and graphics card"),
                i18n("Processor only"),
                i18n("Graphics card only"),
                i18n("Custom sensor"),
                i18n("Nothing")
            ]
            Accessible.name: i18n("React to")
        }
        HelpSlot {
            text: i18n("The sea gets restless when your computer is busy: fish turn reddish, swim faster and shake.")
            name: i18n("React to")
        }
    }
    ValueSlider {
        id: reactivitySlider
        label: i18nc("@label:slider", "Intensity:")
        help: i18n("How strongly system load affects the creatures.")
        visible: sensorTypeCombo.currentIndex !== 4
        from: 0.25; to: 2.0; stepSize: 0.25
        format: function (v) {
            var p = Math.round(v * 100);
            if (p <= 25) return i18nc("@item intensity: percent, description", "%1% (barely)", p);
            if (p <= 50) return i18nc("@item intensity: percent, description", "%1% (mild)", p);
            if (p <= 100) return i18nc("@item intensity: percent, description", "%1% (normal)", p);
            if (p <= 150) return i18nc("@item intensity: percent, description", "%1% (strong)", p);
            return i18nc("@item intensity: percent, description", "%1% (extreme)", p);
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18nc("@label:textbox", "Main sensor:")
        visible: sensorTypeCombo.currentIndex === 3
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 30
        spacing: Kirigami.Units.smallSpacing
        TextField {
            id: sensorIdInput
            Layout.fillWidth: true
            placeholderText: "cpu/all/usage"
            Accessible.name: i18n("Main sensor")
        }
        HelpSlot {
            text: i18n("A sensor ID from System Monitor, for example cpu/all/usage or gpu/all/usage. Percent sensors use 0 to 100, temperatures 40 to 80 degrees.")
            name: i18n("Main sensor")
        }
    }
    RowLayout {
        Kirigami.FormData.label: i18nc("@label:textbox", "Second sensor:")
        visible: sensorTypeCombo.currentIndex === 3
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 30
        spacing: Kirigami.Units.smallSpacing
        TextField {
            id: sensorIdInput2
            Layout.fillWidth: true
            placeholderText: "gpu/all/usage"
            Accessible.name: i18n("Second sensor")
        }
        HelpSlot {
            text: i18n("Optional. The busier of the two sensors drives the effect. Leave empty to use only the main sensor.")
            name: i18n("Second sensor")
        }
    }

    // ═══ PERFORMANCE ════════════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Performance"); Kirigami.FormData.isSection: true }

    RowLayout {
        Kirigami.FormData.label: i18nc("@label", "Power saving:")
        spacing: Kirigami.Units.smallSpacing
        CheckBox {
            id: pauseCoveredCheck
            text: i18n("Pause when the desktop is covered")
        }
        HelpSlot {
            text: i18n("Stops the animation while a maximized or fullscreen window hides the wallpaper. It resumes as soon as the desktop is visible again.")
            name: i18n("Pause when the desktop is covered")
        }
    }

    // ═══ ADVANCED ═══════════════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.isSection: true }

    Button {
        id: advancedToggle
        Kirigami.FormData.label: " "
        flat: true
        checkable: true
        checked: root.advancedVisible
        onToggled: root.advancedVisible = checked
        text: i18nc("@action:button expands a section of detailed settings", "Advanced settings")
        icon.name: checked ? "arrow-down" : "arrow-right"
        Accessible.name: i18n("Advanced settings")
        Accessible.description: checked ? i18n("Expanded. Press to collapse.") : i18n("Collapsed. Press to expand.")
    }

    Kirigami.Separator { visible: root.advancedVisible; Kirigami.FormData.label: i18nc("@title:group", "Sizes"); Kirigami.FormData.isSection: true }

    ValueSlider {
        id: fishSizeSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider creature size", "Fish:")
        from: 1.0; to: 8.0; stepSize: 0.1
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(1)); }
    }
    ValueSlider {
        id: jellySizeSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider creature size", "Jellyfish:")
        from: 1.0; to: 8.0; stepSize: 0.1
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(1)); }
    }
    ValueSlider {
        id: anglerSizeSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider creature size", "Anglerfish:")
        from: 1.0; to: 10.0; stepSize: 0.1
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(1)); }
    }
    ValueSlider {
        id: orcaSizeSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider creature size", "Orcas:")
        from: 1.0; to: 10.0; stepSize: 0.1
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(1)); }
    }
    ValueSlider {
        id: wormSizeSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider creature size", "Worms:")
        help: i18n("Worms appear where you click. Fish that eat enough of them have babies.")
        from: 1.0; to: 10.0; stepSize: 0.5
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(1)); }
    }

    Kirigami.Separator { visible: root.advancedVisible; Kirigami.FormData.label: i18nc("@title:group", "Speed"); Kirigami.FormData.isSection: true }

    ValueSlider {
        id: maxSpeedSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider", "Fish top speed:")
        help: i18n("Higher is faster. Fish never swim slower than the minimum speed.")
        from: 0.1; to: 3.0; stepSize: 0.05
        format: function (v) { return v.toFixed(2); }
        onMoved: { if (minSpeedSlider.value > value) minSpeedSlider.value = value; }
    }
    ValueSlider {
        id: minSpeedSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider", "Fish min. speed:")
        help: i18n("Fish never swim slower than this. It cannot exceed the top speed.")
        from: 0.05; to: 1.0; stepSize: 0.05
        format: function (v) { return v.toFixed(2); }
        onMoved: { if (value > maxSpeedSlider.value) value = maxSpeedSlider.value; }
    }
    ValueSlider {
        id: anglerSpeedSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider", "Anglerfish speed:")
        from: 0.1; to: 3.0; stepSize: 0.05
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(2)); }
    }
    ValueSlider {
        id: orcaSpeedSlider
        visible: root.advancedVisible
        label: i18nc("@label:slider", "Orca speed:")
        from: 0.1; to: 3.0; stepSize: 0.05
        format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(2)); }
    }

    Kirigami.Separator { visible: root.advancedVisible; Kirigami.FormData.label: i18nc("@title:group", "Flocking"); Kirigami.FormData.isSection: true }

    NumberInput {
        id: visualRangeInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Vision range:")
        help: i18n("How far each fish can see its neighbours.")
        min: 40; max: 400; step: 10; precision: 0; suffix: i18nc("pixels", "px")
    }
    NumberInput {
        id: sepDistInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Personal space:")
        help: i18n("Minimum gap between fish. Higher values make a looser school.")
        min: 10; max: 100; step: 1; precision: 0; suffix: i18nc("pixels", "px")
    }
    NumberInput {
        id: cohesionInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Flock attraction:")
        help: i18n("Pull toward the center of the nearby group.")
        min: 0; max: 0.02; step: 0.001; precision: 3
    }
    NumberInput {
        id: alignmentInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Alignment:")
        help: i18n("How much fish copy the swimming direction of their neighbours.")
        min: 0; max: 0.15; step: 0.005; precision: 3
    }
    NumberInput {
        id: separationInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Repulsion:")
        help: i18n("Push away from neighbours that are too close.")
        min: 0; max: 0.2; step: 0.005; precision: 3
    }
    NumberInput {
        id: wanderInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Random drift:")
        help: i18n("Natural randomness in the movement.")
        min: 0; max: 0.05; step: 0.002; precision: 3
    }
    NumberInput {
        id: turnInput
        visible: root.advancedVisible
        label: i18nc("@label:spinbox", "Edge avoidance:")
        help: i18n("How firmly fish turn around when they approach the screen edge.")
        min: 0; max: 0.15; step: 0.005; precision: 3
    }

    // ═══ RESET ══════════════════════════════════════════════════
    Kirigami.Separator { Kirigami.FormData.isSection: true }

    Button {
        Kirigami.FormData.label: " "
        flat: true
        text: i18nc("@action:button", "Reset to Defaults")
        icon.name: "edit-undo"
        onClicked: root.resetToDefaults()
    }
}
