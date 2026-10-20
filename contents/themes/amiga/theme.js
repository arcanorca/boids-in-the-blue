.pragma library
// Theme descriptor: "amiga" (Commodore Amiga, OCS/ECS era look).
//
// The art is authored on a virtual low-res grid (~320x256 PAL playfield, widened to the screen's
// aspect) and shown with nearest-neighbour filtering at `vp` screen px per virtual pixel, where
// vp is an INTEGER derived from the screen height (see vpFor). Every sprite is positioned on that
// grid. All colours in all textures are 12-bit (each channel a multiple of 0x11, like the OCS
// palette registers); tools/gen-amiga-theme.js enforces this and is the single source of the PNGs.
//
// Contract (shared by all themes): id, NAMES (delegate type -> kind), kinds{} (sprite sizes,
// frames, layer), optional Ambient/Sprite files. See ui/code/themes.js for the Scene contract.

var id = "amiga";
var DIR = "img/";                                  // relative to AmigaSprite.qml / Backdrop.qml
var NAMES = ["", "fish", "jelly", "orca", "angler", "bubble", "worm"];   // by delegate type

// Virtual pixel size on screen: integer, so 1 art texel = vp x vp physical-grid pixels.
// 1080p -> 4 (480x270 virtual), 1440p -> 6, 2160p -> 8. The cap keeps the copper textures (320 lines) enough.
function vpFor(height) { return Math.max(Math.ceil(height / 320), Math.round(height / 256), 1); }

// Sprite size classes: art is never scaled (that would break the pixel grid), so a creature's
// config size picks a hand-drawn class instead. `below` = the class applies to sizes < below.
// kind -> { type, frames, layer (draw order band, low = behind), classes [{cols, rows, below}] }
var kinds = {
    fish:   { type: 1, frames: 4, layer: 4, classes: [
        { cols: 6,  rows: 5,  below: 1.6 },        // newborns spiralling out
        { cols: 9,  rows: 7,  below: 3.4 },
        { cols: 12, rows: 9,  below: 4.4 },
        { cols: 15, rows: 10, below: 1e9 }] },
    jelly:  { type: 2, frames: 4, layer: 1, classes: [
        { cols: 11, rows: 19, below: 4.0 },
        { cols: 15, rows: 25, below: 1e9 }] },
    orca:   { type: 3, frames: 4, layer: 6, classes: [{ cols: 26, rows: 13, below: 1e9 }] },
    angler: { type: 4, frames: 4, layer: 5, classes: [{ cols: 15, rows: 12, below: 1e9 }] },
    bubble: { type: 5, frames: 1, layer: 2, classes: [
        { cols: 4, rows: 4, below: 2.0 },
        { cols: 6, rows: 6, below: 2.5 },
        { cols: 8, rows: 8, below: 1e9 }] },
    worm:   { type: 6, frames: 4, layer: 3, classes: [{ cols: 5, rows: 11, below: 1e9 }] }
};
function classFor(kind, size) {
    var cl = kinds[kind].classes;
    for (var i = 0; i < cl.length - 1; i++) if (size < cl[i].below) return i;
    return cl.length - 1;
}

// Angler lure: bulb centre per body frame (texels, unflipped, from the sprite's top-left).
var LURE = [{ x: 12, y: 2 }, { x: 12, y: 3 }, { x: 12, y: 2 }, { x: 12, y: 1 }];
var LURE_SIZE = 3;
var GLOW_SIZE = 17;                                // glow.png: stippled disc, centred on the lure

// Fish: the simulation's classic palette colour -> this theme's ramp.
var FISH_VARIANT = {
    "#FF8080": "coral", "#FFB34D": "amber", "#E6E666": "lemon",
    "#4DCCE6": "aqua",  "#CC99E6": "orchid"
};
var FISH_BASE = ["coral", "amber", "lemon", "aqua", "orchid"];
var FISH_VARIANTS = FISH_BASE.concat(["red", "alarm"]);
function fishVariant(color) { return FISH_VARIANT[String(color).toUpperCase()] || "aqua"; }
// Stress palette swap: level 0 = own colours, 1..2 = ramp 1/3, 2/3 of the way to red, 3 = red.
// Above stress 1.2 the sprite flips between "red" and the hot "alarm" palette (see sync.js).
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

// Animation pacing (per 40 ms sim tick): frame phase += base + speed * perSpeed
var anim = {
    fish:   { base: 0.07, perSpeed: 0.5 },
    angler: { base: 0.05, perSpeed: 0.45 },
    orca:   { base: 0.035, perSpeed: 0.3 },
    jellyRate: 2.2,
    wormRate: 0.4
};

// File name of a frame, relative to DIR
function frameFile(kind, cls, variant, frame) {
    if (kind === "fish") return "fish-" + cls + "-" + variant + "-" + frame + ".png";
    if (kind === "jelly") return "jelly-" + cls + "-" + frame + ".png";
    if (kind === "bubble") return "bubble-" + cls + ".png";
    return kind + "-" + frame + ".png";
}

// ── Backdrop (Backdrop.qml) ──────────────────────────────────
// COPPER: one 800x320 texture per copper list (a colour per scanline, ordered-dithered between
// adjacent 12-bit levels), 1 texel = 1 virtual pixel, top-aligned (the bottom lines are hidden by the seabed).
var COPPER = { w: 800, h: 320, lists: ["night", "dusk", "day", "stress"] };
var CAUSTICS = { w: 640, h: 320, frames: 6 };      // colour-cycled light shafts + surface ripples
// Parallax strips tile horizontally: far rocks, ground (sand), mid kelp (swaying), near plants (swaying)
var FAR    = { tw: 512, h: 104 };
var GROUND = { tw: 512, h: 30 };
var KELP   = { tw: 512, h: 112, frames: 4 };
var NEAR   = { tw: 512, h: 84,  frames: 4 };
// drift: virtual pixels per second (slow parallax scroll), sway frame period in seconds
var DRIFT = { far: 0.4, mid: 0.8, near: 1.6 };

function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// Copper list weights for a daylight value: night is always the base; dusk fades in, then day covers it
function copperWeights(daylight) {
    return { dusk: smooth(0.08, 0.4, daylight), day: smooth(0.58, 0.88, daylight) };
}
