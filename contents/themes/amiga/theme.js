.pragma library
// Theme descriptor: "amiga" (Commodore Amiga, OCS/ECS era look), calm wallpaper edition.
//
// The art is authored on a virtual low-res grid and shown with nearest-neighbour filtering at `vp`
// screen px per art pixel, where vp is an INTEGER derived from the screen height (see vpFor): 1080p
// -> 3 (640x360 art pixels, a "hires" Amiga screen). ONE art-pixel scale is used for every sprite and
// every piece of scenery; only the user's size sliders pick another hand-drawn class or an integer
// multiple (`mul`) of one. All colours in all textures are 12-bit (each channel a multiple of 0x11, like
// the OCS palette registers; alpha is free); tools/gen-amiga-theme.js enforces this and is the single
// source of the PNGs.
//
// Contract (shared by all themes): id, NAMES (delegate type -> kind), kinds{} (sprite sizes,
// frames, layer). See ui/code/themes.js for the Scene contract.

var id = "amiga";
var DIR = "img/";                                  // relative to AmigaSprite.qml / Backdrop.qml
var NAMES = ["", "fish", "jelly", "orca", "angler", "bubble", "worm"];   // by delegate type

// Art pixel size on screen: integer, so 1 art pixel = vp x vp screen px. 1080p -> 3, 1440p -> 4, 2160p -> 6.
function vpFor(height) { return Math.max(Math.round(height / 360), 1); }

// Sprite size classes. `arts` = the hand-drawn bitmaps (cols x rows incl. outline); `classes` map a
// config size (`below` = the class applies to sizes < below) to an art and an integer magnification `mul`.
// At 1080p (vp 3) the defaults are: fish 12x9 art px = 36x27 px, angler 18x14 = 54 px long (1.5 fish),
// orca 37x17 = 111 px (3 fish), jelly bell 12 wide, worm 3x4, bubbles 2-4.
// kind -> { type, frames, layer (draw order band, low = behind), arts [{cols, rows}], classes [{art, mul, below}] }
var kinds = {
    fish:   { type: 1, frames: 4, layer: 4,
        arts: [{ cols: 5, rows: 4 }, { cols: 7, rows: 5 }, { cols: 10, rows: 7 }, { cols: 12, rows: 9 }, { cols: 14, rows: 10 }],
        classes: [
            { art: 0, mul: 1, below: 1.6 },        // newborns spiralling out
            { art: 1, mul: 1, below: 2.8 },
            { art: 2, mul: 1, below: 3.5 },        // -17 %
            { art: 3, mul: 1, below: 4.5 },        // the default fish
            { art: 4, mul: 1, below: 5.6 },        // +17 %
            { art: 2, mul: 2, below: 7.0 },        // size sliders far above the default: integer magnification
            { art: 3, mul: 2, below: 8.4 },
            { art: 4, mul: 2, below: 1e9 }] },
    jelly:  { type: 2, frames: 4, layer: 1,
        arts: [{ cols: 10, rows: 17 }, { cols: 12, rows: 20 }, { cols: 14, rows: 22 }, { cols: 16, rows: 24 }],
        classes: [
            { art: 0, mul: 1, below: 2.4 },
            { art: 1, mul: 1, below: 3.8 },        // default jelly: bell as wide as a fish is long
            { art: 2, mul: 1, below: 4.6 },
            { art: 3, mul: 1, below: 6.0 },
            { art: 1, mul: 2, below: 8.0 },
            { art: 3, mul: 2, below: 1e9 }] },
    orca:   { type: 3, frames: 4, layer: 6,
        arts: [{ cols: 22, rows: 10 }, { cols: 37, rows: 17 }],
        classes: [
            { art: 0, mul: 1, below: 3.7 },
            { art: 1, mul: 1, below: 8.2 },
            { art: 1, mul: 2, below: 1e9 }] },
    angler: { type: 4, frames: 4, layer: 5,
        arts: [{ cols: 12, rows: 10 }, { cols: 18, rows: 14 }],
        classes: [
            { art: 0, mul: 1, below: 3.0 },
            { art: 1, mul: 1, below: 6.1 },
            { art: 1, mul: 2, below: 1e9 }] },
    bubble: { type: 5, frames: 1, layer: 2,
        arts: [{ cols: 2, rows: 2 }, { cols: 3, rows: 3 }, { cols: 4, rows: 4 }],
        classes: [
            { art: 0, mul: 1, below: 2.0 },
            { art: 1, mul: 1, below: 2.5 },
            { art: 2, mul: 1, below: 1e9 }] },
    worm:   { type: 6, frames: 4, layer: 3,
        arts: [{ cols: 3, rows: 3 }, { cols: 3, rows: 4 }],
        classes: [
            { art: 0, mul: 1, below: 2.5 },
            { art: 1, mul: 1, below: 5.5 },
            { art: 1, mul: 2, below: 8.0 },
            { art: 1, mul: 3, below: 1e9 }] }
};
function classFor(kind, size) {
    var cl = kinds[kind].classes;
    for (var i = 0; i < cl.length - 1; i++) if (size < cl[i].below) return i;
    return cl.length - 1;
}

// Angler lure: bulb centre per art and body frame (art pixels, unflipped, from the sprite's top-left).
// The stalk in the body art ends there; the bulb itself is an overlay (lure-<n>.png, 2x2).
var LURE = [
    [{ x: 9, y: 1 }, { x: 9, y: 2 }, { x: 9, y: 1 }, { x: 9, y: 2 }],
    [{ x: 14, y: 2 }, { x: 14, y: 3 }, { x: 14, y: 2 }, { x: 14, y: 1 }]
];
var LURE_SIZE = 2;
var SPARK_SIZE = 3;
var GLOW_SIZE = 15;                                // glow.png: banded soft disc, centred on the lure

// Fish: the simulation's classic palette colour -> this theme's ramp.
var FISH_VARIANT = {
    "#FF8080": "coral", "#FFB34D": "amber", "#E6E666": "lemon",
    "#4DCCE6": "aqua",  "#CC99E6": "orchid"
};
var FISH_BASE = ["coral", "amber", "lemon", "aqua", "orchid"];
var FISH_VARIANTS = FISH_BASE.concat(["red", "alarm"]);
function fishVariant(color) { return FISH_VARIANT[String(color).toUpperCase()] || "aqua"; }
// Stress palette swap: level 0 = own colours, 1..2 = ramp 1/3, 2/3 of the way to red, 3 = red.
// Above stress 1.2 the sprite slowly alternates between "red" and the hot "alarm" palette (see sync.js).
var STRESS_STEPS = 3;
function fishStressVariant(color, level) {
    var v = fishVariant(color);
    return level <= 0 ? v : (level >= STRESS_STEPS ? "red" : v + "-w" + level);
}
function allFishVariants() {
    var out = FISH_VARIANTS.slice();
    for (var i = 0; i < FISH_BASE.length; i++) for (var k = 1; k < STRESS_STEPS; k++) out.push(FISH_BASE[i] + "-w" + k);
    return out;
}

// Animation pacing, all deliberately slow (frames per 40 ms sim tick = phase += base + speed * perSpeed, capped):
// a fish at cruising speed flaps its tail about once a second, nothing steps faster than 3 frames/s.
var anim = {
    fish:   { base: 0.025, perSpeed: 0.10, max: 0.12 },
    angler: { base: 0.02,  perSpeed: 0.08, max: 0.08 },
    orca:   { base: 0.012, perSpeed: 0.05, max: 0.05 },
    jelly:  { base: 0.045, perSpeed: 0, max: 0.045 },   // bell pulse
    worm:   { base: 0.07,  perSpeed: 0, max: 0.07 },
    lure:   { rate: 0.05 },                              // radians per tick of the lure flicker (about 0.2 Hz)
    stressHz: 1,                                         // alarm palette alternation, at most 1 cycle per second
    shakeHz: 3                                           // stress tremble
};

// File name of a frame, relative to DIR (`art` = kinds[k].classes[cls].art)
function frameFile(kind, art, variant, frame) {
    if (kind === "fish") return "fish-" + art + "-" + variant + "-" + frame + ".png";
    if (kind === "jelly") return "jelly-" + art + "-" + frame + ".png";
    if (kind === "bubble") return "bubble-" + art + ".png";
    if (kind === "worm") return "worm-" + art + "-" + frame + ".png";
    if (kind === "angler") return "angler-" + art + "-" + frame + ".png";
    return kind + "-" + art + "-" + frame + ".png";
}

// ── Backdrop (Backdrop.qml) ──────────────────────────────────
// COPPER: one RGB strip per copper list, 1 texel wide, ROWS scanlines, stretched over the screen height.
// Each scanline is one 12-bit colour; neighbouring levels are only mixed in a narrow (<= 8 line) seam.
var COPPER = { w: 4, h: 540, lists: ["night", "dusk", "day", "stress"] };
var RAYS = { w: 480, h: 270 };                     // static soft light shafts (alpha), stretched over the screen
// Static strips (tile horizontally, bottom aligned): far hills, seabed
var FAR    = { tw: 640, h: 26 };
var GROUND = { tw: 640, h: 26 };
// Plants are stacks of SLICE_H-row slices; QML shifts each slice sideways by whole screen pixels (0..~5 px at
// the tip, slowly) so the plant sways without any texture resampling.
var SLICE_H = 6;
// species -> { w, h (art px, per whole plant), layer: back | front | fg }
var PLANTS = {
    kelpA:  { w: 16, h: 66, layer: "front" },
    kelpB:  { w: 14, h: 48, layer: "front" },
    kelpC:  { w: 12, h: 36, layer: "front" },
    weedA:  { w: 12, h: 24, layer: "front" },
    hazeA:  { w: 14, h: 42, layer: "back" },
    hazeB:  { w: 12, h: 36, layer: "back" },
    fgA:    { w: 18, h: 42, layer: "fg" },
    fgB:    { w: 14, h: 36, layer: "fg" }
};
function sliceCount(name) { return PLANTS[name].h / SLICE_H; }
function plantFile(name, slice) { return "plant-" + name + "-" + slice + ".png"; }

// Deterministic placement of plants over `wArt` art pixels of width: [{n, x, flip, ph}] (x = left edge, art px)
function _rng(seed) { var a = seed >>> 0; return function () { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
function layout(layer, wArt) {
    var cfg = {
        back:  { names: ["hazeA", "hazeB"], gap: [22, 40], seed: 11 },
        front: { names: ["kelpA", "kelpB", "kelpC", "weedA", "kelpB", "kelpC"], gap: [30, 64], seed: 29 },
        fg:    { names: ["fgA", "fgB"], gap: [150, 260], seed: 71 }
    }[layer];
    var r = _rng(cfg.seed), out = [], x = layer === "fg" ? 10 : Math.round(r() * 18);
    while (x < wArt) {
        var name = cfg.names[Math.floor(r() * cfg.names.length)];
        out.push({ n: name, x: x, flip: r() < 0.5, ph: r() });
        x += PLANTS[name].w + cfg.gap[0] + Math.round(r() * (cfg.gap[1] - cfg.gap[0]));
    }
    return out;
}

function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// Copper list weights for a daylight value: night is always the base; dusk fades in, then day covers it
function copperWeights(daylight) {
    return { dusk: smooth(0.08, 0.4, daylight), day: smooth(0.58, 0.88, daylight) };
}
