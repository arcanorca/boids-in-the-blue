import QtQuick
import "sync.js" as TerminalSync
import "theme.js" as T

// Scene of the "terminal" theme: a green-phosphor CRT showing a calm sea made of text. The backdrop (Ambient.qml: a sparse
// swell of dim strokes, two rows of waves, a seabed of ground characters, kelp, a prompt line and a load bar) lives in
// a texel world scaled by a whole number of device pixels (1 at 1080p) with nearest-neighbour textures. Creatures
// (pooled TerminalSprite) are placed in screen pixels so they glide smoothly between simulation ticks while drawn at the
// same texel scale. A static vignette and scanline layer sits over everything (no animation).
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

    // creatures stay below the waves: the simulation's upper limit is the waves line plus the fish's half height
    function sync(s) {
        s.top = T.SURFACE.floor * ps;
        if (ambient.stress !== s.cpuStress) ambient.stress = s.cpuStress;
        TerminalSync.sync(s, entities, entities, ps, Math.max(1, dpr), T.nightSet(daylight), ps);
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

    // the CRT glass, static and above everything (so the water-coloured creature boxes stay invisible): a vignette with
    // a little depth darkening, stretched smoothly over the screen, and one dark scanline in four at a whole-texel scale.
    Image {
        anchors.fill: parent
        z: 2
        source: T.DIR + "shade.png"
        smooth: true
        fillMode: Image.Stretch
    }
    Image {
        z: 3
        width: Math.ceil(scene.width / scene.ps)
        height: Math.ceil(scene.height / scene.ps)
        scale: scene.ps
        transformOrigin: Item.TopLeft
        source: T.DIR + "scan.png"
        fillMode: Image.Tile
        smooth: false
    }
}
