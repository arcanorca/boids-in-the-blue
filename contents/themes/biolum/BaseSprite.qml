import QtQuick

// Base of every biolum delegate: the property protocol the KDE adapter (code/boids.js sync())
// writes, the 40 ms position smoothing and the flip transform. The kind-specific images are
// children (Fish.qml, Angler.qml, Jelly.qml, Plain.qml).
Item {
    id: root
    x: 0
    y: 0
    width: 1
    height: 1

    property var spriteData: []              // classic protocol, unused here
    property string colorString: "#FFFFFF"
    property bool flip: false
    property double size: 1.0
    property int type: 0
    property double shakeX: 0
    property double shakeY: 0

    // stress overlay (fish): base glow + tint glow at tintAlpha
    property string baseColor: "#FFFFFF"
    property string tintColor: "#FF3333"
    property double tintAlpha: 0

    property double jellyOpacity: 0.88       // read by the adapter instead of its classic 0.25
    property int phase: 0                    // de-synchronises the shared animation tick

    property var pool: null                  // owning EntityLayer
    function release() { if (pool) pool._release(root); }
    readonly property bool active: visible && !!pool && pool.running

    property bool animate: true

    transform: Scale { origin.x: 0.5; xScale: root.flip ? -1 : 1 }

    Behavior on x { enabled: root.animate; NumberAnimation { duration: 40; easing.type: Easing.Linear } }
    Behavior on y { enabled: root.animate; NumberAnimation { duration: 40; easing.type: Easing.Linear } }
}
