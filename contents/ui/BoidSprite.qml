import QtQuick

// One entity (fish, orca, angler, jelly, bubble, worm), drawn from shared pre-rendered
// textures instead of its own Canvas. Same property protocol as the old BoidDelegate,
// plus the stress overlay (baseColor / tintColor / tintAlpha, fish only).
//
// Fish are 3 images: layer 1 in baseColor, the same layer-1 mask in tintColor at
// opacity tintAlpha (source-over == the old linear colour blend), then the eye layers.
// Every other species is one pre-composited image, so item opacity (jelly, worm) applies
// to the whole sprite exactly as it did to the Canvas.
import "code/sprites.js" as Sprites

Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    property var spriteData: []
    property string colorString: "#FFFFFF"   // tinted colour (kept for the delegate protocol)
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0
    property double shakeY: 0

    // stress overlay (fish): layer 1 = baseColor, then tintColor at tintAlpha
    property string baseColor: "#FFFFFF"
    property string tintColor: "#FF3333"
    property double tintAlpha: 0

    // owning EntityLayer; release() hands the sprite back to its pool
    property var pool: null
    function release() { if (pool) pool._release(root); }

    // false while the pool re-places a recycled item, so it does not glide in from its old spot
    property bool animate: true

    readonly property int _cols: spriteData && spriteData[0] ? spriteData[0].length : 0
    readonly property int _rows: spriteData ? spriteData.length : 0
    readonly property double _w: Math.max(1, _cols > 0 ? _cols * size : 10)
    readonly property double _h: Math.max(1, _rows * size)
    readonly property var _img: _cols > 0 ? Sprites.imageSize(type, _cols, _rows, size) : ({ w: 1, h: 1 })
    readonly property bool _fish: type === 1
    readonly property bool _ready: _cols > 0 && type > 0

    // same mirror transform as the old delegate: its snapping/filtering matches too
    transform: Scale { origin.x: 0.5; xScale: root.flip ? -1 : 1 }

    Behavior on x { enabled: root.animate; NumberAnimation { duration: 40; easing.type: Easing.Linear } }
    Behavior on y { enabled: root.animate; NumberAnimation { duration: 40; easing.type: Easing.Linear } }

    // Same placement as the old centred Canvas: centred on the 1x1 root, mirrored in place
    Image {
        x: Math.ceil((1 - root._w) / 2) + root.shakeX
        y: Math.ceil((1 - root._h) / 2) + root.shakeY
        width: root._img.w
        height: root._img.h
        visible: root._ready
        source: root._ready ? Sprites.baseSource(root.type, root.size, root._fish ? root.baseColor : "") : ""
    }
    Image {
        x: Math.ceil((1 - root._w) / 2) + root.shakeX
        y: Math.ceil((1 - root._h) / 2) + root.shakeY
        width: root._img.w
        height: root._img.h
        visible: root._fish && root.tintAlpha > 0
        opacity: root.tintAlpha
        source: visible ? Sprites.baseSource(1, root.size, root.tintColor) : ""
    }
    Image {
        x: Math.ceil((1 - root._w) / 2) + root.shakeX
        y: Math.ceil((1 - root._h) / 2) + root.shakeY
        width: root._img.w
        height: root._img.h
        visible: root._fish && root._ready
        source: visible ? Sprites.topSource(root.size) : ""
    }
}
