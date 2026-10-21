import QtQuick
import "theme.js" as T

// One entity of the "terminal" theme. Same pooling protocol as the other themes (EntityLayer.createObject /
// release; the protocol property names must stay). sync.js writes the state: `src` (the text-art texture, already
// chosen for its facing, frame and palette set), cw/ch (its size in texels), mag (whole-texel magnification),
// ps (screen px per texel), sparkle (newborns), lureLevel / lureSrc / lureX / lureY (angler).
// Shared textures, nearest-neighbour, no opacity, no effects, no timers, no mirror transform: facing is the file.
//
// Motion: the layer (EntityLayer.qml) glides every sprite between its last two simulation targets with a 40 ms
// linear interpolation and rounds x/y to whole SCREEN pixels, so the text stays crisp while it moves at display rate.
Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    // EntityLayer / adapter protocol (see the classic BoidSprite); this theme uses few of them
    property var spriteData: []
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0                       // tremble in texels
    property double shakeY: 0
    property string baseColor: "#FFFFFF"
    property string tintColor: "#FF3333"
    property double tintAlpha: 0
    property bool animate: true
    property var pool: null
    function release() { if (pool) pool._release(root); }

    // theme state (written by sync.js)
    property string src: ""
    property int mag: 1                 // whole-texel magnification of the sprite
    property real ps: 2                 // screen px per texel
    property real phase: 0              // adapter-private animation accumulators
    property int tick: 0
    property real seed: 0               // per-delegate random in 0..1 (stress order, desync)
    property int frame: 0
    property string key: ""             // adapter-private: last texture key
    property int sparkle: 0             // newborn fish: 0 none, 1/2 = the two sparkle frames above the head
    property string sparkleSrc: ""
    property int lureLevel: -1          // angler: lure intensity 0..2 (-1 = not an angler)
    property string lureSrc: ""
    property real lureX: 0              // angler lure cell, in sprite texels (left, top)
    property real lureY: 0

    property var rec: null              // glide record owned by the layer (targets, pool slot)

    readonly property real _u: ps * mag                    // screen px per texel of this sprite
    // the box is trimmed to the ink, so every texture brings its own size; the sprite is centred on it
    readonly property real _w: body.implicitWidth * _u
    readonly property real _h: body.implicitHeight * _u
    readonly property real _ox: -Math.floor(body.implicitWidth / 2) * _u + shakeX * ps
    readonly property real _oy: -Math.floor(body.implicitHeight / 2) * _u + shakeY * ps

    // body: the art texture (its facing is in the file name)
    Image {
        id: body
        x: root._ox
        y: root._oy
        width: root._w
        height: root._h
        visible: root.src !== ""
        smooth: false
        source: visible ? T.DIR + root.src : ""
    }
    // angler lure: one text cell (a '*' in three intensities, with its glow) on the tip of the stalk
    Image {
        id: lure
        visible: root.lureLevel >= 0
        x: root._ox + (root.lureX - T.LURE_PAD) * root._u
        y: root._oy + (root.lureY - T.LURE_PAD) * root._u
        width: lure.implicitWidth * root._u
        height: lure.implicitHeight * root._u
        smooth: false
        source: visible ? T.DIR + root.lureSrc : ""
    }
    // newborn sparkle: one text cell above the head
    Image {
        id: sparkleImg
        visible: root.sparkle > 0
        x: root._ox + (root._w - T.CELL_W * root._u) / 2
        y: root._oy - T.CELL_H * root._u
        width: sparkleImg.implicitWidth * root._u
        height: sparkleImg.implicitHeight * root._u
        smooth: false
        source: visible ? T.DIR + root.sparkleSrc : ""
    }
}
