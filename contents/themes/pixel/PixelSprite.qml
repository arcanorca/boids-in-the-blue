import QtQuick
import "theme.js" as T

// One entity of the "pixel" theme. Same pooling protocol as the other renderers (EntityLayer
// createObject/release; the property names below must stay), plus the theme state sync.js writes each
// tick (variant, cls, frame, ...).
//
// Sprites are shared textures shown with nearest-neighbour filtering at `cell * mul` px per texel, so every
// creature uses the same art-pixel grid. The position is interpolated between the two last sim ticks by the
// layer's frame loop and then rounded to WHOLE SCREEN PIXELS (not art pixels): smooth glide.
// Fish = body image + (stress) tint image; angler = glow + body + lure; the rest = one image.
// No per-entity layers, effects, timers or animation objects: frames are chosen by the adapter.
Item {
    id: root
    width: 1
    height: 1

    // EntityLayer / adapter protocol
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

    property var rec: null                 // glide record owned by the layer (targets, pool slot)

    // theme state (written by sync.js)
    property string variant: "aqua"        // fish: colour ramp of the body image
    property string tintVariant: "alarm"   // fish: ramp of the alarm overlay (stress > 1.2)
    property real tintOpacity: 0           // fish: overlay strength 0..1
    property int cls: 0                    // size class (theme.js kinds[].classes)
    property int frame: 0
    property int lure: 1                   // angler: lure intensity 0..2
    property real glow: 0.4                // angler: halo opacity
    property real phase: 0                 // animation phase accumulators (adapter-private)
    property int tick: 0
    property int sparkle: 0                // newborn fish: 0 none, 1/2 = two slow positions of the star

    readonly property real cell: pool ? pool.cell : 2
    readonly property string _kind: T.NAMES[type] || ""
    readonly property var _k: T.kinds[_kind]
    readonly property bool _ready: _k !== undefined
    readonly property var _cl: _ready ? _k.classes[Math.min(cls, _k.classes.length - 1)] : null
    readonly property int _art: _cl ? _cl.art : 0
    readonly property int _px: _cl ? _cl.mul * cell : cell                   // screen px per art texel
    readonly property int _w: _cl ? _k.arts[_art].cols * _px : 1
    readonly property int _h: _cl ? _k.arts[_art].rows * _px : 1
    readonly property int _ox: -Math.floor(_w / 2) + shakeX
    readonly property int _oy: -Math.floor(_h / 2) + shakeY
    readonly property bool _fish: _kind === "fish"
    readonly property bool _angler: _kind === "angler"
    readonly property var _lure: _angler ? T.LURE[_art][frame] : null

    // mirror about the sprite's own centre (the pixel grid stays aligned)
    transform: Scale { origin.x: root._ox + root._w / 2; xScale: root.flip ? -1 : 1 }

    // angler lure halo (shared soft glow texture, centred on the bulb)
    Image {
        readonly property int s: T.GLOW_SIZE * root._px
        visible: root._angler
        x: root._ox + (root._angler ? root._lure.x * root._px + Math.floor(root._px / 2) : 0) - Math.floor(s / 2)
        y: root._oy + (root._angler ? root._lure.y * root._px + Math.floor(root._px / 2) : 0) - Math.floor(s / 2)
        width: s
        height: s
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
        smooth: false
        source: root._ready ? T.DIR + T.frameFile(root._kind, root._art, root.variant, root.frame) : ""
    }
    // fish stress overlay: the same frame in the alarm ramp
    Image {
        x: root._ox
        y: root._oy
        width: root._w
        height: root._h
        visible: root._fish && root.tintOpacity > 0
        opacity: root.tintOpacity
        smooth: false
        source: visible ? T.DIR + T.frameFile("fish", root._art, root.tintVariant, root.frame) : ""
    }
    // angler lure bulb
    Image {
        visible: root._angler
        x: root._ox + (root._angler ? (root._lure.x - 2) * root._px : 0)
        y: root._oy + (root._angler ? (root._lure.y - 2) * root._px : 0)
        width: T.LURE_SIZE * root._px
        height: width
        smooth: false
        source: visible ? T.DIR + "lure-" + root.lure + ".png" : ""
    }
    // newborn sparkle: a small star above the head
    Image {
        visible: root.sparkle > 0
        opacity: root.sparkle === 1 ? 1 : 0.6
        x: root._ox + Math.floor(root._w / 2) - Math.floor(T.SPARK_SIZE * root.cell / 2)
        y: root._oy - (T.SPARK_SIZE + (root.sparkle === 1 ? 0 : 1)) * root.cell
        width: T.SPARK_SIZE * root.cell
        height: width
        smooth: false
        source: visible ? T.DIR + "spark.png" : ""
    }
}
