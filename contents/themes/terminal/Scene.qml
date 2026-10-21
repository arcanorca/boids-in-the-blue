import QtQuick
import "sync.js" as TerminalSync
import "theme.js" as T

// Scene of the "terminal" theme: a green-phosphor terminal showing a sea made of text characters. The backdrop
// (Ambient.qml: a sparse dot lattice, a waves line of tildes, a seabed of ground characters, kelp stalks, a prompt
// line and a load bar) lives in a texel world scaled by a whole number of device pixels (2 px at 1080p) with
// nearest-neighbour textures. Creatures (pooled TerminalSprite) are placed in screen pixels so they glide smoothly
// between simulation ticks while drawn at the same texel scale.
// Scene contract: ui/code/themes.js
Item {
    id: scene

    property bool paused: false
    property real daylight: 1
    property real hour: 12
    property bool dayNight: false
    property string waterTop: "#0f4c75"          // unused: the palette is fixed (usesWaterColors: false)
    property string waterBottom: "#051e36"
    property bool customWater: false
    property real dpr: 1
    property var sim: null
    property real glimmerLevel: 0

    // the screen height as known so far: until the first layout it is 0, so 1080 (the reference) is assumed
    readonly property real _h: height > 0 ? height : 1080
    // screen px per texel (a whole number of DEVICE pixels, so texels are never split)
    readonly property real ps: T.texelDevice(_h * Math.max(1, dpr)) / Math.max(1, dpr)
    // creatures are drawn with larger text: 3 px per texel at 1080p (a 3-cell fish is 54 px wide)
    readonly property real pc: T.creatureTexelDevice(_h * Math.max(1, dpr)) / Math.max(1, dpr)

    // creatures stay below the waves: the simulation's upper limit is the waves line plus the fish's half height
    function sync(s) {
        s.top = T.SURFACE.floor * ps;
        if (ambient.stress !== s.cpuStress) ambient.stress = s.cpuStress;
        TerminalSync.sync(s, entities, entities, pc, Math.max(1, dpr), T.nightSet(daylight), ps);
    }

    clip: true
    Rectangle { anchors.fill: parent; color: T.BG }

    Item {
        id: world
        width: Math.ceil(scene.width / scene.ps)
        height: Math.ceil(scene.height / scene.ps)
        scale: scene.ps
        transformOrigin: Item.TopLeft

        Ambient {
            id: ambient
            anchors.fill: parent
            paused: scene.paused
            daylight: scene.daylight
        }
    }
    EntityLayer { id: entities; anchors.fill: parent; z: 1; enabled: false }
}
