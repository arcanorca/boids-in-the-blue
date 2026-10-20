import QtQuick
import "theme.js" as T

// One entity of the "pixel" theme. Same pooling protocol as the classic BoidSprite
// (EntityLayer.createObject/release, so the property names below must stay), plus the
// theme state that sync.js writes each tick (variant, frame, cell, ...).
//
// Sprites are shared textures shown with nearest-neighbour filtering at `cell` px per texel.
// Fish = body image + (stress) tint image; angler = glow + body + lure; the rest = one image.
// No per-entity layers, effects, timers or animations: frames are chosen by the adapter.
Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    // EntityLayer / adapter protocol (see BoidSprite.qml); the pixel theme ignores most of it
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

    // pixel theme state (written by sync.js)
    property string variant: "aqua"        // fish: colour ramp of the body image
    property string tintVariant: "alarm"   // fish: ramp of the alarm overlay (stress > 1.2)
    property real tintOpacity: 0           // fish: overlay strength 0..1
    property int frame: 0
    property real cell: 2                  // px per texel
    property int lure: 1                   // angler: lure intensity 0..2
    property real glow: 0.4                // angler: halo opacity
    property real phase: 0                 // animation phase accumulators (adapter-private)
    property int tick: 0
    property int sparkle: 0                // newborn fish: 0 none, 1/2 = twinkle frames above the head

    readonly property string _kind: T.NAMES[type] || ""
    readonly property var _k: T.kinds[_kind]
    readonly property bool _ready: _k !== undefined
    readonly property int _w: _ready ? Math.round(_k.cols * cell) : 1
    readonly property int _h: _ready ? Math.round(_k.rows * cell) : 1
    readonly property int _ox: -Math.floor(_w / 2) + shakeX
    readonly property int _oy: -Math.floor(_h / 2) + shakeY
    readonly property bool _fish: _kind === "fish"
    readonly property bool _angler: _kind === "angler"

    // mirror about the sprite's own centre (integer pixel grid stays aligned)
    transform: Scale { origin.x: root._ox + root._w / 2; xScale: root.flip ? -1 : 1 }

    // angler lure halo (shared 33x33 glow texture, centred on the bulb)
    Image {
        readonly property real s: Math.max(2, Math.round(root.cell * 1.5))
        visible: root._angler
        x: root._ox + Math.round(T.LURE[root.frame].x * root.cell) - Math.round(T.GLOW_SIZE * s / 2)
        y: root._oy + Math.round(T.LURE[root.frame].y * root.cell) - Math.round(T.GLOW_SIZE * s / 2)
        width: T.GLOW_SIZE * s
        height: T.GLOW_SIZE * s
        smooth: false
        opacity: root.glow
        source: visible ? T.DIR + "glow.png" : ""
    }
    // body
    Image {
        x: root._ox
        y: root._oy
        width: root._w
        height: root._h
        visible: root._ready
        smooth: root.cell < 1
        source: root._ready ? T.DIR + T.frameFile(root._kind, root.variant, root.frame) : ""
    }
    // fish stress overlay: the same frame in the stress ramp
    Image {
        x: root._ox
        y: root._oy
        width: root._w
        height: root._h
        visible: root._fish && root.tintOpacity > 0
        opacity: root.tintOpacity
        smooth: root.cell < 1
        source: visible ? T.DIR + T.frameFile("fish", root.tintVariant, root.frame) : ""
    }
    // angler lure bulb
    Image {
        visible: root._angler
        readonly property int n: T.LURE_SIZE
        x: root._ox + Math.round((T.LURE[root.frame].x - 2) * root.cell)
        y: root._oy + Math.round((T.LURE[root.frame].y - 2) * root.cell)
        width: Math.round(n * root.cell)
        height: Math.round(n * root.cell)
        smooth: false
        source: visible ? T.DIR + "lure-" + root.lure + ".png" : ""
    }
    // newborn sparkle (shares the lure star texture)
    Image {
        visible: root.sparkle > 0
        opacity: root.sparkle === 1 ? 1 : 0.55
        x: root._ox + Math.round(root._w / 2 - T.LURE_SIZE * root.cell)
        y: root._oy - Math.round(T.LURE_SIZE * root.cell * 1.1)
        width: Math.round(T.LURE_SIZE * root.cell * 2)
        height: width
        smooth: false
        source: visible ? T.DIR + "lure-2.png" : ""
    }
}
