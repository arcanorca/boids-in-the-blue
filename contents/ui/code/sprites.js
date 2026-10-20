.pragma library
// Maps an entity (type, size, colours) to the pre-generated sprite textures in
// contents/images/sprites (see tools/gen-sprites.js). To change the art, edit the
// generator's SPRITES/colours and rerun it; nothing here depends on the pixel data.

var Q = 16;                            // size classes per px (class n = size n/Q)
// largest size generated per delegate type (config max + variation); larger sizes reuse the last class
var MAX_SIZE = [0, 9, 10, 10, 10, 3.5, 10];
var NAMES = ["", "fish", "jelly", "orca", "angler", "bubble", "worm"];   // by delegate type
var DIR = "../images/sprites/";

// size -> size class (units of 1/Q px) (the 1 px cell overlap is baked per class)
function sizeClass(type, size) {
    var n = Math.round(size * Q), mx = MAX_SIZE[type] * Q;
    return n < 1 ? 1 : (n > mx ? mx : n);
}

// Layer-1 / composite texture. Fish take a colour (hex, any case); other species are fixed.
function baseSource(type, size, hexColor) {
    var n = sizeClass(type, size);
    if (type === 1) return DIR + "fish-" + String(hexColor).substring(1).toUpperCase() + "-" + n + ".png";
    return DIR + NAMES[type] + "-" + n + ".png";
}

// Fish layers 2+3 (eye); other species have everything in baseSource
function topSource(size) { return DIR + "fish-top-" + sizeClass(1, size) + ".png"; }

// Size an Image so the texture lands where the old Canvas content did. The old Canvas drew
// at the exact size into a round(W) x round(H) tile and stretched that tile over W x H; our
// texture was drawn at the size class (round(cols*sc) x round(rows*sc) texels), so every
// texel is scaled by (size / classSize) * (W / roundedTile).
function imageSize(type, cols, rows, size) {
    var n = sizeClass(type, size), sc = n / Q;
    var w = Math.max(1, cols * size), h = Math.max(1, rows * size);
    var tw = Math.max(1, Math.round(cols * sc)), th = Math.max(1, Math.round(rows * sc));
    var lw = Math.max(1, Math.round(w)), lh = Math.max(1, Math.round(h));
    return { w: tw * (size / sc) * (w / lw), h: th * (size / sc) * (h / lh) };
}
