import QtQuick
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// Contextual help button at the end of a settings row; keeps its space (invisible) when there is no
// help text, so the controls of all rows line up.
Item {
    id: root
    property string text: ""
    property string name: ""
    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight
    Layout.preferredWidth: implicitWidth
    Layout.alignment: Qt.AlignVCenter

    Kirigami.ContextualHelpButton {
        id: button
        anchors.fill: parent
        visible: root.text !== ""
        toolTipText: root.text
        Accessible.name: root.name !== "" ? i18nc("@info:tooltip accessible name; %1 is a setting", "Help: %1", root.name) : i18n("Help")
    }
}
