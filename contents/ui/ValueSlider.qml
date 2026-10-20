import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// A labelled slider row for Kirigami.FormLayout: slider, a value label of FIXED width (so all
// sliders line up whatever the text), and an optional contextual help button.
// `format(value)` returns the text shown in the value label.
RowLayout {
    id: root

    property string label: ""
    property string help: ""
    property alias value: slider.value
    property alias from: slider.from
    property alias to: slider.to
    property alias stepSize: slider.stepSize
    property var format: function (v) { return v.toFixed(1); }
    property real valueLabelWidth: Kirigami.Units.gridUnit * 7   // same for every row so the sliders line up
    signal moved()

    Kirigami.FormData.label: label
    Layout.fillWidth: true
    Layout.maximumWidth: Kirigami.Units.gridUnit * 30
    spacing: Kirigami.Units.smallSpacing

    Slider {
        id: slider
        snapMode: Slider.SnapAlways
        Layout.fillWidth: true
        Layout.minimumWidth: Kirigami.Units.gridUnit * 4
        Accessible.name: root.label
        Accessible.description: root.help
        onMoved: root.moved()
    }
    Label {
        text: root.format(slider.value)
        Layout.preferredWidth: root.valueLabelWidth
        Layout.minimumWidth: root.valueLabelWidth
        horizontalAlignment: Text.AlignRight
        elide: Text.ElideRight
        Accessible.ignored: true
    }
    HelpSlot { text: root.help; name: root.label }
}
