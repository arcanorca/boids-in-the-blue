import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

RowLayout {
    property string label: ""
    property real value: 0
    property real min: 0
    property real max: 100
    property real step: 1
    property int precision: 0

    Kirigami.FormData.label: label
    
    Button {
        text: "-"
        Accessible.name: i18n("Decrease")
        onClicked: {
            var v = value - step;
            if (v < min) v = min;
            value = Number(v.toFixed(precision));
        }
        enabled: value > min
        Layout.preferredWidth: 40
    }
    
    
    TextField {
        id: field
        text: value.toFixed(precision)
        Layout.minimumWidth: 60
        horizontalAlignment: Text.AlignHCenter
        
        function stepBy(delta) {
            var v = value + delta;
            if (v < min) v = min;
            if (v > max) v = max;
            value = Number(v.toFixed(precision));
            text = value.toFixed(precision);
        }

        function applyValue() {
            // Accept both "0.005" and "0,005"; reject trailing garbage like "12abc"
            var t = text.trim().replace(",", ".");
            var v = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? parseFloat(t) : NaN;
            if (!isNaN(v)) {
                if (v < min) v = min;
                if (v > max) v = max;
                value = Number(v.toFixed(precision));
            }
            // Always resync: valueChanged does not fire when the value is unchanged
            text = value.toFixed(precision);
        }

        Keys.onUpPressed: stepBy(step)
        Keys.onDownPressed: stepBy(-step)

        onAccepted: { applyValue(); focus = false; }
        onActiveFocusChanged: { if (!activeFocus) applyValue(); }
    }
    
    onValueChanged: {
        if (!field.activeFocus) {
            field.text = value.toFixed(precision)
        }
    }
    
    Button {
        text: "+"
        Accessible.name: i18n("Increase")
        onClicked: {
            var v = value + step;
            if (v > max) v = max;
            value = Number(v.toFixed(precision));
        }
        enabled: value < max
        Layout.preferredWidth: 40
    }
}
