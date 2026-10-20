import QtQuick
import "theme.js" as T

// One entity of the "amiga" theme. Same pooling protocol as the other renderers (EntityLayer
// createObject/release; the property names below must stay), plus the theme state sync.js writes
// each tick (variant, cls, frame, ...).
//
// Sprites are shared textures shown with nearest-neighbour filtering at `cell` px per texel, so the
// art stays on the virtual pixel grid. Fish = one body image (the stress "palette swap" is a
// different pre-coloured variant); angler = glow + body + lure; the rest = one image.
// No per-entity layers, effects, timers or animations: frames are chosen by the adapter.
Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    // EntityLayer / adapter protocol
    property var spriteData: []
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0              // whole virtual pixels (sync.js)
    property double shakeY: 0
    property bool animate: true
    property var pool: null
    function release() { if (pool) pool._release(root); }

    // theme state (written by sync.js)
    property string variant: "aqua"
    property int cls: 0                    // size class (theme.js kinds[].classes)
    property int frame: 0
    property int lure: 1                   // angler: lure intensity 0..2
    property real glow: 1                  // angler: halo opacity
    property real phase: 0                 // animation phase accumulators (adapter-private)
    property int tick: 0
    property int sparkle: 0                // newborn fish: 0 none, 1/2 = twinkle frames above the head

    readonly property real cell: pool ? pool.cell : 4
    readonly property string _kind: T.NAMES[type] || ""
    readonly property var _k: T.kinds[_kind]
    readonly property bool _ready: _k !== undefined
    readonly property var _cl: _ready ? _k.classes[Math.min(cls, _k.classes.length - 1)] : null
    readonly property int _w: _cl ? _cl.cols * cell : 1
    readonly property int _h: _cl ? _cl.rows * cell : 1
    readonly property int _ox: -Math.floor(_cl ? _cl.cols / 2 : 0) * cell + shakeX * cell
    readonly property int _oy: -Math.floor(_cl ? _cl.rows / 2 : 0) * cell + shakeY * cell
    readonly property bool _angler: _kind === "angler"

    // mirror about the sprite's own centre (the integer grid stays aligned)
    transform: Scale { origin.x: root._ox + root._w / 2; xScale: root.flip ? -1 : 1 }

    // angler lure halo (shared stippled glow texture, centred on the bulb)
    Image {
        readonly property int s: T.GLOW_SIZE * root.cell
        visible: root._angler
        x: root._ox + T.LURE[root.frame].x * root.cell + Math.floor(root.cell / 2) - Math.floor(s / 2)
        y: root._oy + T.LURE[root.frame].y * root.cell + Math.floor(root.cell / 2) - Math.floor(s / 2)
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
        source: root._ready ? T.DIR + T.frameFile(root._kind, root.cls, root.variant, root.frame) : ""
    }
    // angler lure bulb
    Image {
        visible: root._angler
        x: root._ox + (T.LURE[root.frame].x - 1) * root.cell
        y: root._oy + (T.LURE[root.frame].y - 1) * root.cell
        width: T.LURE_SIZE * root.cell
        height: width
        smooth: false
        source: visible ? T.DIR + "lure-" + root.lure + ".png" : ""
    }
    // newborn sparkle: a four-point star above the head
    Image {
        visible: root.sparkle > 0
        x: root._ox + Math.floor(root._w / 2 / root.cell) * root.cell - Math.floor(T.SPARK_SIZE / 2) * root.cell
        y: root._oy - (T.SPARK_SIZE + (root.sparkle === 1 ? 0 : 1)) * root.cell
        width: T.SPARK_SIZE * root.cell
        height: width
        smooth: false
        source: visible ? T.DIR + "spark.png" : ""
    }
}
