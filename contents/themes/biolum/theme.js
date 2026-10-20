.pragma library
// "Bioluminescent Deep" theme descriptor (see tools/gen-biolum.py for the art).
//
// A theme is a self-contained folder contents/themes/<id>/ holding its textures, this
// descriptor and QML (EntityLayer.qml = pooling delegate factory, Ambient.qml = optional
// ambience). All sizes are in "u": a texture is shown at (u * entity.size * k) px, k = kind.k.

var id = "biolum";
var name = "Bioluminescent Deep";
var DIR = "images/";

// Per kind: delegate type (see EntityLayer), canvas size in u, texels per u, display factor k,
// layer (back -> front draw order), frames, and the tint strategy.
//  fish   3 tail frames played as seq at tickMs (phase-shifted per fish); stress = crossfade
//         of a second glow texture (stress / alarm / flash) over the fish hue
//  orca   1 texture, drawn facing LEFT (the sim mirrors it when moving right)
//  angler body + separate pulsing lure overlay (GPU opacity/scale animators)
//  jelly  bell + tentacles, 3 hues picked from the entity size; GPU scale/rotation sway
//  worm / bubble  1 texture each
var kinds = {
    fish:   { type: 1, w: 10, h: 8,  ppu: 4, k: 1.25, layer: 5, frames: 3, seq: [0, 1, 0, 2], tickMs: 230 },
    jelly:  { type: 2, w: 12, h: 8,  ppu: 6, k: 1.15, layer: 2, bell: { w: 12, h: 8, y: -4.3 }, tent: { w: 12, h: 11, y: 2.4 }, hues: ["aqua", "rose", "lilac"], opacity: 0.88 },
    orca:   { type: 3, w: 17, h: 11, ppu: 6, k: 1.0, layer: 1, file: "orca.png" },
    angler: { type: 4, w: 16, h: 13, ppu: 6, k: 1.0, layer: 3, file: "angler.png", lure: { file: "angler-lure.png", w: 8, h: 8, x: 3.7, y: -4.6 } },
    bubble: { type: 5, w: 5,  h: 5,  ppu: 8, k: 1.0, layer: 6, file: "bubble.png" },
    worm:   { type: 6, w: 6,  h: 7,  ppu: 6, k: 1.0, layer: 4, file: "worm.png" }
};
var BY_TYPE = [null, kinds.fish, kinds.jelly, kinds.orca, kinds.angler, kinds.bubble, kinds.worm];

// The sim hands fish colours as hex; map them (palette + stress tints) to textures
var FISH_KEYS = {
    "FF8080": "magenta", "FFB34D": "amber", "E6E666": "lime", "4DCCE6": "cyan", "CC99E6": "violet",
    "FF3333": "stress",      // stress < 1.2 overlay: angry red-orange
    "FF0000": "alarm",       // stress > 1.2: base
    "000080": "flash"        // stress > 1.2: pulse partner (hot white-pink)
};
function fishSource(hex, frame) {
    var key = FISH_KEYS[String(hex).substring(1).toUpperCase()] || "cyan";
    return DIR + "fish-" + key + "-" + frame + ".png";
}
function sparkKey(hex) {
    var k = FISH_KEYS[String(hex).substring(1).toUpperCase()];
    return (!k || k === "stress" || k === "alarm" || k === "flash") ? "cyan" : k;
}
function jellyHue(size) { return kinds.jelly.hues[Math.floor(size * 37) % 3]; }

// Water: day (dim twilight blue) -> night (near black). b = daylight 0..1 (main.qml: cosine of the hour)
var GRADIENT = {
    day:   { top: [8, 46, 76],   mid: [8, 23, 62], bottom: [2, 6, 26] },
    night: { top: [3, 11, 24],   mid: [2, 6, 19],  bottom: [1, 2, 9] }
};
function _hex(c) { return "#" + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1); }
function _mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
function gradient(b) {
    var d = GRADIENT.day, n = GRADIENT.night;
    return { top: _hex(_mix(n.top, d.top, b)), mid: _hex(_mix(n.mid, d.mid, b)), bottom: _hex(_mix(n.bottom, d.bottom, b)) };
}
// Same, from user-chosen top/bottom colours (config waterTop/waterBottom) when they are not the classic defaults
function _rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function gradientFrom(top, bottom) {
    var t = _rgb(top), bt = _rgb(bottom);
    return { top: _hex(t), mid: _hex(_mix(t, bt, 0.5)), bottom: _hex(bt) };
}

// Every file the theme can ask for (tests/theme-biolum.test.js checks they exist)
function allFiles() {
    var out = [], i, f;
    var keys = ["magenta", "amber", "lime", "cyan", "violet", "stress", "alarm", "flash"];
    for (i = 0; i < keys.length; i++) for (f = 0; f < 3; f++) out.push(DIR + "fish-" + keys[i] + "-" + f + ".png");
    out.push(DIR + kinds.orca.file, DIR + kinds.angler.file, DIR + kinds.angler.lure.file, DIR + kinds.bubble.file, DIR + kinds.worm.file);
    for (i = 0; i < 3; i++) out.push(DIR + "jelly-bell-" + kinds.jelly.hues[i] + ".png", DIR + "jelly-tent-" + kinds.jelly.hues[i] + ".png");
    var amb = ["snow-s", "snow-m", "snow-bokeh", "shaft", "vignette", "caustic", "spark-cyan", "spark-magenta", "spark-lime", "spark-amber", "spark-violet"];
    for (i = 0; i < amb.length; i++) out.push(DIR + amb[i] + ".png");
    return out;
}
