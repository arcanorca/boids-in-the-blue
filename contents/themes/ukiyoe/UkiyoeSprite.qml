import QtQuick
import "theme.js" as T

// One entity of the "ukiyoe" theme. Same pooling protocol as the other themes (EntityLayer.createObject /
// release; the protocol property names must stay). sync.js writes the state: `src` (body texture file),
// cw/ch (its size in texels), mag (whole-texel magnification), ps (screen px per texel), sparkle (newborns),
// lureLevel (angler). Shared textures, nearest-neighbour, no opacity, no effects, no timers.
//
// Motion: the layer (EntityLayer.qml) moves every sprite between its last two simulation targets (25 Hz) with a
// 40 ms linear interpolation on each rendered frame (like the classic theme's Behavior, but one JS loop instead of
// two animations per sprite) and rounds x/y to whole SCREEN pixels, so the art stays crisp (never blended) while
// it glides at display rate. Positions are deliberately not snapped to the texel grid.
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
    property int cw: 1                  // body texture size in texels
    property int ch: 1
    property int mag: 1                 // whole-texel magnification of the sprite
    property real ps: 3                 // screen px per texel
    property real phase: 0              // adapter-private animation accumulators
    property int tick: 0
    property real seed: 0               // per-delegate random in 0..1 (stress order, desync)
    property int frame: 0
    property string key: ""             // adapter-private: last texture key
    property int sparkle: 0             // newborn fish: 0 none, 1/2 = the two twinkle frames above the head
    property int lureLevel: -1          // angler: lure intensity 0..2 (-1 = not an angler)
    property real lureX: 0              // angler lure centre in sprite texels
    property real lureY: 0

    property var rec: null              // glide record owned by the layer (targets, pool slot)

    readonly property real _u: ps * mag                    // screen px per texel of this sprite
    readonly property real _w: cw * _u
    readonly property real _h: ch * _u
    readonly property real _ox: -Math.floor(cw / 2) * _u + shakeX * ps
    readonly property real _oy: -Math.floor(ch / 2) * _u + shakeY * ps

    // mirror about the sprite's own centre
    transform: Scale { origin.x: root._ox + root._w / 2; xScale: root.flip ? -1 : 1 }

    // body
    Image {
        x: root._ox
        y: root._oy
        width: root._w
        height: root._h
        visible: root.src !== ""
        smooth: false
        source: visible ? T.DIR + root.src : ""
    }
    // angler lure bulb & lantern halo
    Image {
        visible: root.lureLevel >= 0
        x: root._ox + (root.lureX - Math.floor(T.LURE_SIZE / 2)) * root._u
        y: root._oy + (root.lureY - Math.floor(T.LURE_SIZE / 2)) * root._u
        width: T.LURE_SIZE * root._u
        height: T.LURE_SIZE * root._u
        smooth: false
        source: visible ? T.DIR + "lure-" + root.lureLevel + ".png" : ""
    }
    // newborn sparkle
    Image {
        visible: root.sparkle > 0
        x: root._ox + Math.floor(root.cw * 0.5) * root._u - Math.floor(T.SPARKLE_SIZE / 2) * root.ps
        y: root._oy - (T.SPARKLE_SIZE + 1) * root.ps
        width: T.SPARKLE_SIZE * root.ps
        height: T.SPARKLE_SIZE * root.ps
        smooth: false
        source: visible ? T.DIR + "sparkle-" + (root.sparkle - 1) + ".png" : ""
    }
}
