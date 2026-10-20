import QtQuick
import "theme.js" as T

// One entity of the "onebit" theme, living in texel space (the scene scales the whole world by an
// integer, so 1 unit here = 1 art texel = ps x ps screen pixels). Same pooling protocol as the other
// themes (EntityLayer.createObject/release; the protocol property names must stay). sync.js writes
// the state: `src` (body texture file), cw/ch (its size in texels), sparkle (newborns), lureLevel /
// glowLevel (angler). Shared textures, nearest-neighbour, no opacity, no effects, no timers.
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
    property double shakeX: 0
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
    property int mag: 1                 // integer magnification of the whole sprite
    property real phase: 0              // adapter-private animation accumulators
    property int tick: 0
    property real seed: 0               // per-delegate random in 0..1 (stress inversion order, desync)
    property int frame: 0
    property string key: ""              // adapter-private: last texture key
    property int sparkle: 0             // newborn fish: 0 none, 1/2 = the two twinkle frames above the head
    property int lureLevel: -1          // angler: lure intensity 0..2 (-1 = not an angler)
    property int glowLevel: -1
    property int lureX: 0               // angler lure centre in sprite texels
    property int lureY: 0

    readonly property int _w: cw * mag
    readonly property int _h: ch * mag
    readonly property int _ox: -Math.floor(_w / 2) + shakeX
    readonly property int _oy: -Math.floor(_h / 2) + shakeY

    // mirror about the sprite's own centre (stays on the texel grid)
    transform: Scale { origin.x: root._ox + root._w / 2; xScale: root.flip ? -1 : 1 }

    // angler lure halo: dithered paper dots, behind the body
    Image {
        readonly property int s: root.glowLevel >= 0 ? T.GLOW_SIZES[root.glowLevel] : 1
        visible: root.glowLevel >= 0
        x: root._ox + root.lureX * root.mag - Math.floor(s / 2)
        y: root._oy + root.lureY * root.mag - Math.floor(s / 2)
        width: s
        height: s
        smooth: false
        source: visible ? T.DIR + "glow-" + root.glowLevel + ".png" : ""
    }
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
    // angler lure bulb
    Image {
        visible: root.lureLevel >= 0
        x: root._ox + root.lureX * root.mag - Math.floor(T.LURE_SIZE / 2)
        y: root._oy + root.lureY * root.mag - Math.floor(T.LURE_SIZE / 2)
        width: T.LURE_SIZE
        height: T.LURE_SIZE
        smooth: false
        source: visible ? T.DIR + "lure-" + root.lureLevel + ".png" : ""
    }
    // newborn sparkle
    Image {
        visible: root.sparkle > 0
        x: root._ox + Math.floor(root._w * 0.55)
        y: root._oy - T.SPARKLE_SIZE - 1
        width: T.SPARKLE_SIZE
        height: T.SPARKLE_SIZE
        smooth: false
        source: visible ? T.DIR + "sparkle-" + (root.sparkle - 1) + ".png" : ""
    }
}
