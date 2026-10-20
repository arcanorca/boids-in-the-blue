import QtQuick
import "theme.js" as Theme

// Common protocol of every illustrated sprite (the pool in Layer.qml hands these out and
// sync.js writes the properties). The root is a 1x1 item at the entity position; the
// artwork is centred on it, so rotation (tilt) pivots about the sprite centre.
Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    property string kind: "fish"
    property int type: 0
    property double size: 1.0          // simulation size units (config slider +- variation)
    property double depth: 0.5         // stable pseudo-depth: 0 far .. 1 near
    property double dpr: 1
    property bool mirror: false
    property double shakeX: 0
    property double shakeY: 0
    property string colorKey: ""
    property double tiltS: 0           // smoothed tilt (deg), kept by sync.js

    // on-screen width in px (depth shrinks far entities)
    readonly property double dispW: Math.max(1, size * Theme.KINDS[kind].unit * Theme.depthScale(depth))
    readonly property double aspect: Theme.KINDS[kind].aspect
    readonly property int lod: Theme.lodOf(Theme.KINDS[kind].lods, dispW * dpr)

    property var pool: null
    function release() { if (pool) pool._release(root); }
    // false while the pool re-places a recycled item, so it does not glide in from its old spot
    property bool animate: true

    Behavior on x { enabled: root.animate; NumberAnimation { duration: 40; easing.type: Easing.Linear } }
    Behavior on y { enabled: root.animate; NumberAnimation { duration: 40; easing.type: Easing.Linear } }
}
