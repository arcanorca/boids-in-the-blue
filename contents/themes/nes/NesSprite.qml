import QtQuick
import "theme.js" as T

// One entity of the "nes" theme: a metasprite baked into one shared texture (frame, palette and size
// class are part of the file name), shown with nearest-neighbour scaling at `px` screen pixels per
// virtual pixel. Same pooling protocol as the other themes' delegates (EntityLayer.createObject/
// release): the property names marked "protocol" must stay. No per-entity layers, effects, timers
// or animations: the adapter (sync.js) picks the frame and palette every tick.
Item {
    id: root
    x: 0
    y: 0

    // EntityLayer / adapter protocol (see BoidSprite.qml); most of it is unused here
    property var spriteData: []
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0                  // in virtual pixels
    property double shakeY: 0
    property string baseColor: "#FFFFFF"
    property string tintColor: "#FF3333"
    property double tintAlpha: 0
    property bool animate: true
    property var pool: null
    function release() { if (pool) pool._release(root); }

    // theme state (written by sync.js)
    property string variant: "aqua"            // fish: colour variant / sprite palette ("alarm-a", "alarm-b" = stress)
    property string cls: "m"                   // size class: fish "m" adult / "s" fry; bubble "s"/"m"/"l"
    property int frame: 0                      // swim / pulse frame
    property int lure: 1                       // angler lure level 0..2
    property int sparkle: 0                    // newborn fish: 0 none, 1/2 = twinkle frames above the head
    property real thr: 0                       // fish: stress threshold of this individual 0..1
    property real phase: 0                     // adapter-private accumulators
    property int tick: 0

    readonly property int px: pool ? pool.px : 4
    readonly property string _kind: T.NAMES[type] || ""
    readonly property bool _ready: T.kinds[_kind] !== undefined
    readonly property var _d: _ready ? T.dims(_kind, cls) : ({ w: 8, h: 8 })
    width: _d.w * px
    height: _d.h * px

    Image {
        x: root.shakeX * root.px
        y: root.shakeY * root.px
        width: root.width
        height: root.height
        visible: root._ready
        smooth: false
        mirror: root.flip
        source: root._ready ? T.DIR + T.spriteFile(root._kind, root.cls, root.variant, root.frame, root.lure) : ""
    }
    // newborn sparkle
    Image {
        visible: root.sparkle > 0
        x: Math.round((root._d.w - 8) / 2) * root.px
        y: -8 * root.px
        width: 8 * root.px
        height: 8 * root.px
        smooth: false
        source: visible ? T.DIR + "sparkle-" + (root.sparkle - 1) + ".png" : ""
    }
}
