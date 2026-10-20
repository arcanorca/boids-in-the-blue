import QtQuick
import "sync.js" as GBSync
import "theme.js" as T
import "atlas.js" as A

// Scene of the "gameboy" theme: a DMG-style virtual screen (Ambient tile map + pooled GBSprite
// layer) scaled up by a whole number of physical pixels, plus an optional static LCD-glass texture.
// Scene contract: ui/code/themes.js
Item {
    id: scene

    property bool paused: false
    property real daylight: 1
    property real hour: 12
    property bool dayNight: false
    property string waterTop: "#0f4c75"          // unused: the theme has its own four shades
    property string waterBottom: "#051e36"
    property bool customWater: false
    property real dpr: 1
    property var sim: null
    property real glimmerLevel: 0

    function sync(s) { GBSync.sync(s, entities, entities); }

    // virtual pixel = `cell` physical pixels; `unit` = the same in logical pixels
    readonly property int cell: T.cellPx(height, dpr)
    readonly property real unit: cell / dpr
    readonly property bool lcdGrid: true                     // static LCD-glass overlay (one texture)

    clip: true

    Item {
        id: screen
        width: Math.ceil(scene.width / scene.unit)
        height: Math.ceil(scene.height / scene.unit)
        scale: scene.unit
        transformOrigin: Item.TopLeft

        Ambient {
            anchors.fill: parent
            z: 0
            paused: scene.paused
            stage: T.stage(scene.daylight)
        }
        EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false; unit: scene.unit }
    }

    // LCD glass: dark lines between virtual pixels. Only when a virtual pixel is a whole number of
    // logical pixels (dpr 1 and similar); its cell comes from a ready-made atlas row.
    Image {
        readonly property int n: Math.round(scene.unit)
        readonly property var _r: n >= 2 && n <= 12 ? A.LCD[n] : null
        anchors.fill: parent
        z: 5
        visible: scene.lcdGrid && _r !== null && Math.abs(scene.unit - n) < 0.01
        fillMode: Image.Tile
        smooth: false
        source: visible ? Qt.resolvedUrl(T.DIR + "lcd.png") : ""
        sourceClipRect: _r ? Qt.rect(_r[0], _r[1], _r[2], _r[3]) : Qt.rect(0, 0, 0, 0)
    }
}
