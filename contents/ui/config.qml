import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.kquickcontrols as KQControls

import "code/themes.js" as Themes
import "code/presets.js" as Presets

// Settings page of the wallpaper, embedded in the shell's wallpaper dialog. Five tabs by topic:
// Appearance (theme cards), Ocean (counts, sizes), Behavior (flocking, cursor, predators),
// Environment (day/night, water) and System (reactivity, power saving).
// Keys and defaults live in contents/config/main.xml; every cfg_<key> and cfg_<key>Default is a
// property of this root item, which is what the shell reads and writes.
ColumnLayout {
    id: root
    spacing: Kirigami.Units.smallSpacing

    // The shell twins its "Layout:" / "Wallpaper type:" labels with these forms (parentLayout is
    // provided by the shell's ConfigurationContainmentAppearance.qml)
    property var formLayout: [oceanForm, behaviorForm, environmentForm, systemForm]

    // ── Config aliases ──
    property string cfg_theme
    property string cfg_themeDefault

    // Ocean
    property alias cfg_fishCount: fishCountSlider.value
    property alias cfg_jellyCount: jellyCountSlider.value
    property alias cfg_anglerCount: anglerCountSlider.value
    property alias cfg_orcaCount: orcaCountSlider.value
    property alias cfg_fishSize: fishSizeSlider.value
    property alias cfg_jellySize: jellySizeSlider.value
    property alias cfg_anglerSize: anglerSizeSlider.value
    property alias cfg_orcaSize: orcaSizeSlider.value
    property alias cfg_wormSize: wormSizeSlider.value

    // Behavior
    property alias cfg_cursorFearLevel: cursorFearSlider.value
    property alias cfg_orcaChase: orcaChaseSlider.value
    property alias cfg_anglerChase: anglerChaseSlider.value
    property alias cfg_anglerSpeed: anglerSpeedSlider.value
    property alias cfg_orcaSpeed: orcaSpeedSlider.value
    property alias cfg_fishMaxSpeed: maxSpeedSlider.value
    property alias cfg_fishMinSpeed: minSpeedSlider.value
    property alias cfg_visualRange: visualRangeSlider.value
    property alias cfg_separationDist: sepDistSlider.value
    property alias cfg_cohesionFactor: cohesionSlider.value
    property alias cfg_alignmentFactor: alignmentSlider.value
    property alias cfg_separationFactor: separationSlider.value
    property alias cfg_wanderFactor: wanderSlider.value
    property alias cfg_turnFactor: turnSlider.value

    // Environment
    property alias cfg_dayNightCycle: dayNightSwitch.checked
    property alias cfg_waterTop: colorTop.color
    property alias cfg_waterBottom: colorBottom.color

    // System
    property alias cfg_sensorMode: sensorTypeCombo.currentIndex
    property alias cfg_reactivityIntensity: reactivitySlider.value
    property alias cfg_sensorId: sensorIdInput.text
    property alias cfg_sensorId2: sensorIdInput2.text
    property alias cfg_pauseWhenCovered: pauseCoveredCheck.checked
    property alias cfg_pauseCoverage: coverageSlider.value

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
    property int cfg_pauseCoverageDefault

    // ── State ──
    // Selected theme (unknown stored values count as the default theme)
    readonly property var theme: Themes.find(Themes.resolve(cfg_theme))
    property bool advancedVisible: false
    property alias currentTab: tabs.currentIndex     // tests and screenshots

    readonly property real _rowMax: Kirigami.Units.gridUnit * 30

    // ── Flocking presets (values: code/presets.js, measured by tests/flock-eval.js) ──
    readonly property var presetNames: [i18nc("@item:inlistbox flocking style", "Calm"),
                                        i18nc("@item:inlistbox flocking style", "Default"),
                                        i18nc("@item:inlistbox flocking style", "Lively"),
                                        i18nc("@item:inlistbox flocking style", "Chaotic")]
    function defaultValues() {
        return [cfg_fishMaxSpeedDefault, cfg_fishMinSpeedDefault, cfg_visualRangeDefault, cfg_separationDistDefault,
                cfg_cohesionFactorDefault, cfg_alignmentFactorDefault, cfg_separationFactorDefault,
                cfg_wanderFactorDefault, cfg_turnFactorDefault];
    }
    function currentValues() {
        return [cfg_fishMaxSpeed, cfg_fishMinSpeed, cfg_visualRange, cfg_separationDist,
                cfg_cohesionFactor, cfg_alignmentFactor, cfg_separationFactor, cfg_wanderFactor, cfg_turnFactor];
    }
    // two values count as equal within 0.4 % of the control's range (slider steps are 1 %)
    readonly property var presetTolerance: [maxSpeedSlider, minSpeedSlider, visualRangeSlider, sepDistSlider,
        cohesionSlider, alignmentSlider, separationSlider, wanderSlider, turnSlider].map(function (s) { return (s.to - s.from) * 0.004; })
    function presetFor(i) { var v = Presets.VALUES[Presets.IDS[i]]; return v ? v : defaultValues(); }
    function applyPreset(i) {
        var v = presetFor(i);
        // the maximum first: a lower maximum would clamp the minimum
        cfg_fishMaxSpeed = v[0]; cfg_fishMinSpeed = v[1]; cfg_visualRange = v[2]; cfg_separationDist = v[3];
        cfg_cohesionFactor = v[4]; cfg_alignmentFactor = v[5]; cfg_separationFactor = v[6];
        cfg_wanderFactor = v[7]; cfg_turnFactor = v[8];
    }
    // index of the preset matching the current values, -1 = custom
    readonly property int presetIndex: {
        var cur = currentValues(), tol = presetTolerance;
        for (var i = 0; i < Presets.IDS.length; i++) {
            var p = presetFor(i), same = true;
            for (var k = 0; k < p.length; k++) if (Math.abs(p[k] - cur[k]) > tol[k]) same = false;
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
        cfg_pauseCoverage = cfg_pauseCoverageDefault;
    }

    function levelName(v) {   // aggression: 0 .. 2
        if (v < 0.1) return i18nc("@item aggression level", "Off");
        if (v < 0.5) return i18nc("@item aggression level", "Gentle");
        if (v < 1.0) return i18nc("@item aggression level", "Moderate");
        if (v < 1.5) return i18nc("@item aggression level", "Active");
        return i18nc("@item aggression level", "Aggressive");
    }
    function multiplier(v) { return i18nc("value multiplier", "%1×", v.toFixed(1)); }
    function percentOf(v, max) { return i18nc("percent", "%1%", Math.round(v / max * 100)); }
    function pixelsPerSecond(v) { return i18nc("speed in pixels per second", "%1 px/s", Math.round(v * 25)); }   // 25 simulation steps per second

    // ═══ TABS ═══════════════════════════════════════════════════
    TabBar {
        id: tabs
        Layout.fillWidth: true
        Layout.leftMargin: Kirigami.Units.smallSpacing
        Layout.rightMargin: Kirigami.Units.smallSpacing
        Accessible.name: i18n("Settings sections")

        // every tab at least as wide as its text; they share the width when there is room
        // (and the bar scrolls when the dialog is very narrow)
        TabButton { text: i18nc("@title:tab", "Appearance"); width: Math.max(implicitWidth, (root.width - 2 * Kirigami.Units.smallSpacing) / 5) }
        TabButton { text: i18nc("@title:tab", "Ocean"); width: Math.max(implicitWidth, (root.width - 2 * Kirigami.Units.smallSpacing) / 5) }
        TabButton { text: i18nc("@title:tab", "Behavior"); width: Math.max(implicitWidth, (root.width - 2 * Kirigami.Units.smallSpacing) / 5) }
        TabButton { text: i18nc("@title:tab", "Environment"); width: Math.max(implicitWidth, (root.width - 2 * Kirigami.Units.smallSpacing) / 5) }
        TabButton { text: i18nc("@title:tab", "System"); width: Math.max(implicitWidth, (root.width - 2 * Kirigami.Units.smallSpacing) / 5) }
    }

    // ═══ APPEARANCE ═════════════════════════════════════════════
    ColumnLayout {
        id: appearancePage
        visible: tabs.currentIndex === 0
        Layout.fillWidth: true
        Layout.maximumWidth: Kirigami.Units.gridUnit * 42
        Layout.alignment: Qt.AlignHCenter
        Layout.margins: Kirigami.Units.largeSpacing
        spacing: Kirigami.Units.largeSpacing

        Kirigami.Heading {
            level: 4
            text: i18nc("@title:group", "Visual theme")
            Layout.fillWidth: true
        }
        GridLayout {
            id: themeGrid
            Layout.fillWidth: true
            readonly property real cardMin: Kirigami.Units.gridUnit * 9
            columns: Math.max(1, Math.floor((width + columnSpacing) / (cardMin + columnSpacing)))
            columnSpacing: Kirigami.Units.largeSpacing
            rowSpacing: Kirigami.Units.largeSpacing
            uniformCellWidths: true

            Repeater {
                model: Themes.THEMES
                delegate: ThemeCard {
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignTop
                    themeId: modelData.id
                    themeName: i18n(modelData.name)
                    description: i18n(modelData.description)
                    previewSource: Qt.resolvedUrl("../themes/" + modelData.id + "/preview.png")
                    checked: Themes.resolve(root.cfg_theme) === modelData.id
                    onClicked: root.cfg_theme = modelData.id
                }
            }
        }
        Label {
            Layout.fillWidth: true
            text: i18n("The theme changes the look only; every theme shows the same school.")
            wrapMode: Text.WordWrap
            font: Kirigami.Theme.smallFont
            opacity: 0.7
        }
    }

    // ═══ OCEAN ══════════════════════════════════════════════════
    Kirigami.FormLayout {
        id: oceanForm
        visible: tabs.currentIndex === 1
        twinFormLayouts: parentLayout
        Layout.fillWidth: true

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "How many"); Kirigami.FormData.isSection: true }
        ValueSlider {
            id: fishCountSlider
            label: i18nc("@label:slider number of creatures", "Fish:")
            help: i18n("Schooling fish. More fish make richer flocks but use more processor time.")
            from: 5; to: 200; stepSize: 1
            format: function (v) { return String(Math.round(v)); }
        }
        ValueSlider {
            id: jellyCountSlider
            label: i18nc("@label:slider number of creatures", "Jellyfish:")
            help: i18n("Slow, translucent drifters.")
            from: 0; to: 50; stepSize: 1
            format: function (v) { return String(Math.round(v)); }
        }
        ValueSlider {
            id: anglerCountSlider
            label: i18nc("@label:slider number of creatures", "Anglerfish:")
            help: i18n("Deep-sea predators with a glowing lure. They hunt fish.")
            from: 0; to: 20; stepSize: 1
            format: function (v) { return String(Math.round(v)); }
        }
        ValueSlider {
            id: orcaCountSlider
            label: i18nc("@label:slider number of creatures", "Orcas:")
            help: i18n("The biggest predators. Fish scatter when one passes.")
            from: 0; to: 10; stepSize: 1
            format: function (v) { return String(Math.round(v)); }
        }

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "How big"); Kirigami.FormData.isSection: true }
        ValueSlider {
            id: fishSizeSlider
            label: i18nc("@label:slider creature size", "Fish:")
            from: 1.0; to: 8.0; stepSize: 0.1
            format: root.multiplier
        }
        ValueSlider {
            id: jellySizeSlider
            label: i18nc("@label:slider creature size", "Jellyfish:")
            from: 1.0; to: 8.0; stepSize: 0.1
            format: root.multiplier
        }
        ValueSlider {
            id: anglerSizeSlider
            label: i18nc("@label:slider creature size", "Anglerfish:")
            from: 1.0; to: 10.0; stepSize: 0.1
            format: root.multiplier
        }
        ValueSlider {
            id: orcaSizeSlider
            label: i18nc("@label:slider creature size", "Orcas:")
            from: 1.0; to: 10.0; stepSize: 0.1
            format: root.multiplier
        }
        ValueSlider {
            id: wormSizeSlider
            label: i18nc("@label:slider creature size", "Worms:")
            help: i18n("Worms appear where you click. Fish that eat enough of them have babies.")
            from: 1.0; to: 10.0; stepSize: 0.5
            format: root.multiplier
        }
    }

    // ═══ BEHAVIOR ═══════════════════════════════════════════════
    Kirigami.FormLayout {
        id: behaviorForm
        visible: tabs.currentIndex === 2
        twinFormLayouts: parentLayout
        Layout.fillWidth: true

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Fish"); Kirigami.FormData.isSection: true }
        RowLayout {
            Kirigami.FormData.label: i18nc("@label:listbox", "Flocking style:")
            Layout.fillWidth: true
            Layout.maximumWidth: root._rowMax
            spacing: Kirigami.Units.smallSpacing

            ComboBox {
                id: presetCombo
                Layout.fillWidth: true
                model: root.presetNames
                displayText: currentIndex < 0 ? i18nc("@item:inlistbox flocking style, values edited by hand", "Custom") : currentText
                onActivated: (index) => root.applyPreset(index)
                Accessible.name: i18n("Flocking style")
            }
            Binding { target: presetCombo; property: "currentIndex"; value: root.presetIndex }
            HelpSlot {
                text: i18n("How the fish school. Calm: slow, loose drifting. Default: clear schools that split and merge. Lively: tight, fast, frequent turns. Chaotic: scattered, erratic bursts. Fine-tune every value under Advanced flocking below.")
                name: i18n("Flocking style")
            }
        }
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

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Predators"); Kirigami.FormData.isSection: true }
        ValueSlider {
            id: orcaChaseSlider
            label: i18nc("@label:slider", "Orca aggression:")
            help: i18n("How eagerly orcas chase fish.")
            from: 0.0; to: 2.0; stepSize: 0.1
            format: root.levelName
        }
        ValueSlider {
            id: orcaSpeedSlider
            label: i18nc("@label:slider", "Orca speed:")
            help: i18n("Swimming speed of orcas, relative to normal.")
            from: 0.1; to: 3.0; stepSize: 0.05
            format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(2)); }
        }
        ValueSlider {
            id: anglerChaseSlider
            label: i18nc("@label:slider", "Angler aggression:")
            help: i18n("How eagerly anglerfish chase fish.")
            from: 0.0; to: 2.0; stepSize: 0.1
            format: root.levelName
        }
        ValueSlider {
            id: anglerSpeedSlider
            label: i18nc("@label:slider", "Angler speed:")
            help: i18n("Swimming speed of anglerfish, relative to normal.")
            from: 0.1; to: 3.0; stepSize: 0.05
            format: function (v) { return i18nc("value multiplier", "%1×", v.toFixed(2)); }
        }

        // ── Advanced flocking: collapsed by default ──
        Kirigami.Separator { Kirigami.FormData.isSection: true }
        Button {
            id: advancedToggle
            Kirigami.FormData.label: " "
            flat: true
            checkable: true
            checked: root.advancedVisible
            onToggled: root.advancedVisible = checked
            text: i18nc("@action:button expands a section of detailed settings", "Advanced flocking")
            icon.name: checked ? "arrow-down" : "arrow-right"
            Accessible.name: i18n("Advanced flocking")
            Accessible.description: checked ? i18n("Expanded. Press to collapse.") : i18n("Collapsed. Press to expand.")
        }

        ValueSlider {
            id: maxSpeedSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Top speed:")
            help: i18n("How fast the fish swim at most. Fish never swim slower than the slowest speed.")
            from: 0.1; to: 3.0; stepSize: 0.05
            format: root.pixelsPerSecond
            onMoved: { if (minSpeedSlider.value > value) minSpeedSlider.value = value; }
        }
        ValueSlider {
            id: minSpeedSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Slowest speed:")
            help: i18n("Fish never swim slower than this. It cannot exceed the top speed.")
            from: 0.05; to: 1.0; stepSize: 0.05
            format: root.pixelsPerSecond
            onMoved: { if (value > maxSpeedSlider.value) value = maxSpeedSlider.value; }
        }
        ValueSlider {
            id: visualRangeSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Vision range:")
            help: i18n("How far each fish sees its neighbours. Short sight breaks the school into many small groups; long sight makes one big school.")
            from: 40; to: 400; stepSize: 10
            format: function (v) { return i18nc("pixels", "%1 px", Math.round(v)); }
        }
        ValueSlider {
            id: sepDistSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Personal space:")
            help: i18n("The gap fish keep from each other, about this many pixels. Larger values make a looser school.")
            from: 10; to: 100; stepSize: 1
            format: function (v) { return i18nc("pixels", "%1 px", Math.round(v)); }
        }
        ValueSlider {
            id: cohesionSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Flock attraction:")
            help: i18n("Pull toward the center of the nearby group. Too much squeezes the fish into a ball.")
            from: 0; to: 0.005; stepSize: 0.00005
            format: function (v) { return root.percentOf(v, 0.005); }
        }
        ValueSlider {
            id: alignmentSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Alignment:")
            help: i18n("How much fish copy the swimming direction of their neighbours. High values make very orderly schools.")
            from: 0; to: 0.15; stepSize: 0.0015
            format: function (v) { return root.percentOf(v, 0.15); }
        }
        ValueSlider {
            id: separationSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Repulsion:")
            help: i18n("Push away from neighbours that are too close. Too little lets fish overlap.")
            from: 0; to: 0.08; stepSize: 0.0008
            format: function (v) { return root.percentOf(v, 0.08); }
        }
        ValueSlider {
            id: wanderSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Random drift:")
            help: i18n("Natural randomness in the movement. High values scatter the schools.")
            from: 0; to: 0.06; stepSize: 0.0006
            format: function (v) { return root.percentOf(v, 0.06); }
        }
        ValueSlider {
            id: turnSlider
            visible: root.advancedVisible
            label: i18nc("@label:slider", "Edge avoidance:")
            help: i18n("How firmly fish turn around when they approach the screen edge.")
            from: 0; to: 0.1; stepSize: 0.001
            format: function (v) { return root.percentOf(v, 0.1); }
        }
    }

    // ═══ ENVIRONMENT ════════════════════════════════════════════
    Kirigami.FormLayout {
        id: environmentForm
        visible: tabs.currentIndex === 3
        twinFormLayouts: parentLayout
        Layout.fillWidth: true

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Time"); Kirigami.FormData.isSection: true }
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

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Water"); Kirigami.FormData.isSection: true }
        Kirigami.InlineMessage {
            Layout.fillWidth: true
            Layout.maximumWidth: root._rowMax
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
            Kirigami.FormData.label: i18nc("@label:chooser", "Surface:")
            showAlphaChannel: false
            enabled: !dayNightSwitch.checked && root.theme.usesWaterColors
            Accessible.name: i18n("Water surface color")
        }
        KQControls.ColorButton {
            id: colorBottom
            Kirigami.FormData.label: i18nc("@label:chooser", "Depths:")
            showAlphaChannel: false
            enabled: !dayNightSwitch.checked && root.theme.usesWaterColors
            Accessible.name: i18n("Water depths color")
        }
        Item {
            Kirigami.FormData.label: i18nc("@label", "Preview:")
            implicitWidth: Kirigami.Units.gridUnit * 16
            implicitHeight: Kirigami.Units.gridUnit * 3
            Layout.fillWidth: true
            Layout.maximumWidth: root._rowMax
            Layout.preferredHeight: Kirigami.Units.gridUnit * 3
            Accessible.ignored: true
            Rectangle {
                anchors.fill: parent
                radius: Kirigami.Units.cornerRadius
                opacity: colorTop.enabled ? 1.0 : 0.4
                border.width: 1
                border.color: Qt.alpha(Kirigami.Theme.textColor, 0.2)
                gradient: Gradient {
                    GradientStop { position: 0.0; color: colorTop.color }
                    GradientStop { position: 1.0; color: colorBottom.color }
                }
            }
        }
    }

    // ═══ SYSTEM ═════════════════════════════════════════════════
    Kirigami.FormLayout {
        id: systemForm
        visible: tabs.currentIndex === 4
        twinFormLayouts: parentLayout
        Layout.fillWidth: true

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Reactivity"); Kirigami.FormData.isSection: true }
        RowLayout {
            Kirigami.FormData.label: i18nc("@label:listbox", "React to:")
            Layout.fillWidth: true
            Layout.maximumWidth: root._rowMax
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
            help: i18n("How strongly system load affects the creatures: 25% is barely noticeable, 100% normal, 200% extreme.")
            visible: sensorTypeCombo.currentIndex !== 4
            from: 0.25; to: 2.0; stepSize: 0.25
            format: function (v) { return i18nc("percent", "%1%", Math.round(v * 100)); }
        }
        RowLayout {
            Kirigami.FormData.label: i18nc("@label:textbox", "Main sensor:")
            visible: sensorTypeCombo.currentIndex === 3
            Layout.fillWidth: true
            Layout.maximumWidth: root._rowMax
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
            Layout.maximumWidth: root._rowMax
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

        Kirigami.Separator { Kirigami.FormData.label: i18nc("@title:group", "Power saving"); Kirigami.FormData.isSection: true }
        RowLayout {
            Kirigami.FormData.label: i18nc("@label", "When covered:")
            spacing: Kirigami.Units.smallSpacing
            CheckBox {
                id: pauseCoveredCheck
                text: i18n("Pause the animation")
            }
            HelpSlot {
                text: i18n("Stops the animation (and the sensors) while windows hide the wallpaper, and when the screen is off. It resumes as soon as the desktop is visible again. A maximized or fullscreen window always counts as covering.")
                name: i18n("Pause when covered")
            }
        }
        ValueSlider {
            id: coverageSlider
            label: i18nc("@label:slider", "Covered from:")
            help: i18n("Pause when open windows hide at least this much of the screen, even if none is maximized, for example several tiled windows. 100% pauses only when the whole screen is covered.")
            enabled: pauseCoveredCheck.checked
            from: 50; to: 100; stepSize: 5
            format: function (v) { return i18nc("percent", "%1%", Math.round(v)); }
        }
    }

    // ═══ RESET ══════════════════════════════════════════════════
    Kirigami.Separator { Layout.fillWidth: true; Layout.topMargin: Kirigami.Units.smallSpacing }
    Button {
        Layout.alignment: Qt.AlignRight
        Layout.rightMargin: Kirigami.Units.smallSpacing
        Layout.bottomMargin: Kirigami.Units.smallSpacing
        flat: true
        text: i18nc("@action:button", "Reset to Defaults")
        icon.name: "edit-undo"
        onClicked: root.resetToDefaults()
        Accessible.name: i18n("Reset all settings to defaults")
    }
}
