import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

// One selectable visual theme: preview thumbnail, name and a one-line description. Behaves as a
// radio button (keyboard: Tab to focus, Space / Enter to choose).
AbstractButton {
    id: card

    property string themeId: ""
    property string themeName: ""
    property string description: ""
    property url previewSource: ""

    // `checked` is only shown (bound by the page to the chosen theme); a click just requests it
    hoverEnabled: true
    padding: Kirigami.Units.smallSpacing
    activeFocusOnTab: true

    Accessible.role: Accessible.RadioButton
    Accessible.name: themeName
    Accessible.description: description
    Accessible.checked: checked

    contentItem: ColumnLayout {
        spacing: Kirigami.Units.smallSpacing

        // 16:9 thumbnail; a neutral placeholder while a theme has no preview.png
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: width * 9 / 16
            radius: Kirigami.Units.cornerRadius
            color: Kirigami.Theme.alternateBackgroundColor
            clip: true
            Image {
                id: thumb
                anchors.fill: parent
                source: card.previewSource
                fillMode: Image.PreserveAspectCrop
                asynchronous: true
                smooth: true
                visible: status === Image.Ready
            }
            Kirigami.Icon {
                anchors.centerIn: parent
                width: Kirigami.Units.iconSizes.large
                height: width
                source: "preferences-desktop-wallpaper"
                opacity: 0.5
                visible: thumb.status !== Image.Ready
            }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing
            Kirigami.Icon {
                source: "emblem-ok-symbolic"
                implicitWidth: Kirigami.Units.iconSizes.small
                implicitHeight: Kirigami.Units.iconSizes.small
                opacity: card.checked ? 1 : 0          // keeps the name aligned across cards
                color: Kirigami.Theme.highlightColor
            }
            Label {
                Layout.fillWidth: true
                text: card.themeName
                font.bold: true
                elide: Text.ElideRight
                Accessible.ignored: true
            }
        }
        Label {
            Layout.fillWidth: true
            text: card.description
            wrapMode: Text.WordWrap
            maximumLineCount: 3
            elide: Text.ElideRight
            font: Kirigami.Theme.smallFont
            opacity: 0.75
            Accessible.ignored: true
        }
        Item { Layout.fillHeight: true }
    }

    background: Rectangle {
        radius: Kirigami.Units.cornerRadius + card.padding / 2
        color: card.hovered ? Qt.alpha(Kirigami.Theme.highlightColor, 0.08) : "transparent"
        border.width: card.checked ? 2 : 1
        border.color: card.checked ? Kirigami.Theme.highlightColor
                                   : (card.visualFocus ? Kirigami.Theme.focusColor : Qt.alpha(Kirigami.Theme.textColor, 0.2))
        Behavior on border.color { ColorAnimation { duration: Kirigami.Units.shortDuration } }
    }
}
