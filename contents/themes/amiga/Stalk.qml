import QtQuick
import "theme.js" as T

// One plant: a stack of 6-row slices that are shifted sideways by WHOLE SCREEN PIXELS (0 at the base, up to
// `tip` px at the top, slowly), so it sways a few pixels without any texture resampling or shearing (which
// shimmers). The root item's origin is the plant's base (bottom centre of the art). `sway` (0..1, one slow
// loop) comes from the owner, which stops updating it when paused.
Item {
    id: s
    property string species: "kelpA"
    property int vp: 3
    property real sway: 0
    property real ph: 0
    property bool flip: false
    property real lean: 0.025                    // tip travel in px per px of plant height
    readonly property var spec: T.PLANTS[species]
    readonly property int n: spec.h / T.SLICE_H
    readonly property int sh: T.SLICE_H * vp                   // slice height (screen px)
    readonly property int iw: spec.w * vp
    readonly property real tip: lean * spec.h * vp
    readonly property real wave: {
        var p = 6.2831853 * (sway + ph);
        return Math.sin(p) + 0.45 * Math.sin(2 * p + 1);
    }
    width: iw
    height: 0
    transform: Scale { origin.x: s.iw / 2; xScale: s.flip ? -1 : 1 }

    Repeater {
        model: s.n
        delegate: Image {
            required property int index
            x: Math.round(s.tip * s.wave * Math.pow(index / Math.max(1, s.n - 1), 1.5))
            y: -(index + 1) * s.sh - s.vp
            width: s.iw
            height: s.sh + s.vp                  // 1 art row of overlap with the slice above
            smooth: false
            source: T.DIR + T.plantFile(s.species, index)
        }
    }
}
