import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// A labelled number field for Kirigami.FormLayout: a SpinBox (keyboard: arrows, Page Up/Down,
// typing; mouse wheel) for integers and decimals, with an optional unit suffix and help button.
RowLayout {
    id: root

    property string label: ""
    property string help: ""
    property real value: 0
    property real min: 0
    property real max: 100
    property real step: 1
    property int precision: 0
    property string suffix: ""

    readonly property real _factor: Math.pow(10, precision)

    Kirigami.FormData.label: label
    spacing: Kirigami.Units.smallSpacing

    SpinBox {
        id: spin
        editable: true
        // from/to first: a SpinBox clamps whatever value it gets to its range
        from: Math.round(root.min * root._factor)
        to: Math.round(root.max * root._factor)
        stepSize: Math.max(1, Math.round(root.step * root._factor))
        value: Math.round(root.value * root._factor)
        Layout.preferredWidth: Kirigami.Units.gridUnit * 9
        Layout.minimumWidth: Kirigami.Units.gridUnit * 6
        Accessible.name: root.label
        Accessible.description: root.help

        textFromValue: function (v, locale) {
            return Number(v / root._factor).toLocaleString(locale, "f", root.precision) + (root.suffix !== "" ? " " + root.suffix : "");
        }
        valueFromText: function (text, locale) {
            // accept "0.005" and "0,005", ignore a trailing unit; garbage keeps the old value
            var t = text.replace(root.suffix, "").trim().replace(",", ".");
            var v = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? parseFloat(t) : NaN;
            return isNaN(v) ? spin.value : Math.round(Math.max(root.min, Math.min(root.max, v)) * root._factor);
        }
        onValueModified: root.value = Number((value / root._factor).toFixed(root.precision))
    }
    HelpSlot { text: root.help; name: root.label }
}
