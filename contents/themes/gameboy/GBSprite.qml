import QtQuick
import "theme.js" as T
import "atlas.js" as A

// One entity of the "gameboy" theme: a metasprite cut from a shared OBJ atlas (one atlas file per
// palette register mapping), shown with nearest-neighbour filtering at a whole number of physical pixels
// per texel. An optional second 8x8 tile (angler lure, newborn sparkle) is a child. No per-entity layers,
// effects, timers or animations: the adapter (sync.js) picks sprite, palette and target, the layer glides.
// The protocol properties below are the pooling/adapter contract shared with the other themes.
Image {
    id: root
    x: 0
    y: 0

    // EntityLayer / adapter protocol (most are unused by this theme)
    property var spriteData: []
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0
    property double shakeY: 0
    property bool animate: true
    property var pool: null
    function release() { if (pool) pool._release(root); }

    // theme state (written by sync.js)
    property string sprite: ""          // key in atlas.js OBJ
    property int pal: 0                 // 0 normal, 1 dimmed, 2 inverted (OBJ palette register)
    property int mul: 1                 // whole-number texel multiplier (extreme size settings only)
    property string extra: ""           // second tile (lure / sparkle), "" = none
    property int exX: 0                 // its offset in texels
    property int exY: 0
    property real phase: 0              // adapter-private animation state
    property real thr: 0
    property int st: -1
    property int tick: 0
    property int _ai: 0                 // index in the layer's live list
    property real fx: 0                 // glide: centre at the last tick, target centre, last drawn centre
    property real fy: 0
    property real tx: 0
    property real ty: 0
    property real curX: 0
    property real curY: 0

    readonly property real _t: (pool ? pool.unit : 3) * mul        // logical px per texel
    readonly property var _r: sprite !== "" ? A.OBJ[sprite] : null

    source: _r ? T.DIR + T.OBJ_FILES[pal] : ""
    sourceClipRect: _r ? Qt.rect(_r[0], _r[1], _r[2], _r[3]) : Qt.rect(0, 0, 0, 0)
    width: _r ? _r[2] * _t : 0
    height: _r ? _r[3] * _t : 0
    mirror: flip
    smooth: false
    cache: true
    asynchronous: false

    Image {
        readonly property var _e: root.extra !== "" ? A.OBJ[root.extra] : null
        visible: _e !== null
        x: root.exX * root._t
        y: root.exY * root._t
        width: _e ? _e[2] * root._t : 0
        height: _e ? _e[3] * root._t : 0
        mirror: root.flip && root.sprite.indexOf("ang-") === 0
        smooth: false
        source: _e ? T.DIR + T.OBJ_FILES[root.pal === 2 ? 0 : root.pal] : ""
        sourceClipRect: _e ? Qt.rect(_e[0], _e[1], _e[2], _e[3]) : Qt.rect(0, 0, 0, 0)
    }
}
