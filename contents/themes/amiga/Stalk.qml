import QtQuick
import "theme.js" as T

// One plant: SLICES stacked textures, each sheared a little around its own base, so the plant bends
// smoothly (a few pixels at the tip, well below 0.5 Hz). The root item's origin is the plant's base
// (bottom centre of the art). Positions stay on whole screen pixels where the texture is placed; only the
// lean is continuous. `sway` (0..1, one slow loop) comes from the owner and stops with it when paused.
Item {
    id: s
    property string species: "kelpA"
    property int vp: 3
    property real sway: 0
    property real ph: 0
    property bool flip: false
    property real amp: 0.025                      // lean per slice: px of sideways travel per px of height
    readonly property var spec: T.PLANTS[species]
    readonly property int sh: spec.h / T.SLICES * vp          // slice height (screen px)
    readonly property int iw: spec.w * vp
    readonly property int ih: sh + vp                            // image height: 1 art row of overlap
    width: iw
    height: 0
    transform: Scale { origin.x: s.iw / 2; xScale: s.flip ? -1 : 1 }

    function lean(i) {
        var p = 6.2831853 * (sway + ph);
        return amp * (Math.sin(p + i * 0.8) + 0.45 * Math.sin(2 * p + i * 1.3 + 1));
    }
    Item {
        id: l0
        transform: Matrix4x4 { matrix: Qt.matrix4x4(1, -s.lean(0), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1) }
        Image { y: -s.ih; width: s.iw; height: s.ih; smooth: false; source: T.DIR + T.plantFile(s.species, 0) }
        Item {
            id: l1
            y: -s.sh
            transform: Matrix4x4 { matrix: Qt.matrix4x4(1, -s.lean(1), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1) }
            Image { y: -s.ih; width: s.iw; height: s.ih; smooth: false; source: T.DIR + T.plantFile(s.species, 1) }
            Item {
                id: l2
                y: -s.sh
                transform: Matrix4x4 { matrix: Qt.matrix4x4(1, -s.lean(2), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1) }
                Image { y: -s.ih; width: s.iw; height: s.ih; smooth: false; source: T.DIR + T.plantFile(s.species, 2) }
            }
        }
    }
}
