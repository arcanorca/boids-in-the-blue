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
        
        function applyValue() {
            var v = parseFloat(text);
            if (isNaN(v)) {
                text = value.toFixed(precision);
                return;
            }
            if (v < min) v = min;
            if (v > max) v = max;
            value = Number(v.toFixed(precision));
        }
        
        onAccepted: { applyValue(); focus = false; }
        onActiveFocusChanged: { if (!activeFocus) applyValue(); }
    }
    
    Button {
        text: "+"
        onClicked: {
            var v = value + step;
            if (v > max) v = max;
            value = Number(v.toFixed(precision));
        }
        enabled: value < max
        Layout.preferredWidth: 40
    }
}
