.pragma library
// Theme descriptor: "terminal" (Terminal), an amber-free green-phosphor CRT showing a calm sea of text.
//
// Every texture in img/ is made of text cells of Terminus 6x12 (a bitmap font) at ONE cell size, 1 texel = 1 device
// pixel at 1080p, by tools/gen-terminal-theme.py from the hand-cleaned character grids in tools/terminal-art.txt
// (first drafts: tools/terminal-img2ascii.py, a pixel-pair converter of the Refined Pixel sprites). Left-facing art
// is the mirrored CHARACTER GRID, generated, never a mirrored texture. This file holds the shared sizes, palette sets
// and names, and the tests check it against the generator and the files.
//
// Scale: ONE whole number of device pixels per texel for everything (1 at 1080p, 2 at 4K), so a text cell is
// 6 x 12 px at 1080p and the screen is a 320 x 90 cell grid. The backdrop (Ambient.qml) lives in a texel world
// scaled by that integer; creatures (TerminalSprite.qml) are placed in screen pixels so they glide, and are
// drawn at the same scale. Texture sizes are not listed here: creature boxes are trimmed to their ink, so every
// sprite takes its size from its own image.

var id = "terminal";
var DIR = "img/";                                  // relative to the QML files
var BG = "#08120b";                                // the water: near-black, green-tinted; the only background colour
var CELL_W = 6;                                    // one text cell in texels (Terminus 6x12)
var CELL_H = 12;
var ROWS = 90;                                     // cell rows at 1080p (the prompt and load bar sit on the last one)
var NAMES = ["", "fish", "jelly", "orca", "angler", "bubble", "worm"];   // by delegate type

// device pixels per texel for a screen of the given height (device px); at least 1 (1 at 1080p, 2 at 4K)
function texelDevice(heightDevicePx) { return Math.max(1, Math.round(heightDevicePx / 1080)); }
// creatures use the same scale as the water: one cell size everywhere
function creatureTexelDevice(heightDevicePx) { return texelDevice(heightDevicePx); }

// ── palette sets: one set per texture family (see PAL in tools/gen-terminal-theme.py) ──
// Four tones on BG: b highlight, n normal, m mid, d dim. Stress recolours fish with the amber and red sets, and 'ri'
// is the inverted red alarm box (ink on red). Night = one notch dimmer per tone. Glow pixels are blends of BG and a tone.
var PALETTE = {
    g:  { b: "#e0ffe9", n: "#6bf59b", m: "#3cc873", d: "#217f4a" },     // day: phosphor green
    n:  { b: "#6bf59b", n: "#3cc873", m: "#217f4a", d: "#124c2d" },     // night: one notch dimmer
    a:  { b: "#ffe0a0", n: "#ffb000", m: "#c47f00", d: "#7a4d00" },     // amber (warm stress)
    an: { b: "#ffb000", n: "#c47f00", m: "#7a4d00", d: "#4d3000" },
    r:  { b: "#ffb4a8", n: "#ff5040", m: "#c03024", d: "#7a1c14" },     // red (hot stress)
    rn: { b: "#ff5040", n: "#c03024", m: "#7a1c14", d: "#4d1510" },
    ri: { ink: BG, fill: "#ff5040" }                      // inverted alarm: ink on a red box (above stress 1.2)
};
// the palette set for a state: 0 normal, 1 amber, 2 red, 3 inverted red alarm
function fishSet(night, state) {
    if (state === 3) return "ri";
    if (state === 2) return night ? "rn" : "r";
    if (state === 1) return night ? "an" : "a";
    return night ? "n" : "g";
}
function baseSet(night) { return night ? "n" : "g"; }
// two steps by daylight (steps only when the value crosses 0.5, so the change is visible once)
function nightSet(daylight) { return daylight < 0.5; }

// ── fish: size classes (fry, small, mid, large); the mid fish is the reference: 11 x 4 cells = 66 x 48 px ──
var FISH_CLASSES = [
    { name: "fry",   below: 2.9 },
    { name: "small", below: 3.4 },
    { name: "mid",   below: 4.5 },
    { name: "large", below: 1e9 }
];
var FISH_FRAMES = 2;
// the five variants are told apart by their body characters; the simulation's colour picks the variant
var FISH_VARIANT = {
    "#FF8080": "stripe", "#FFB34D": "spot", "#E6E666": "solid",
    "#4DCCE6": "hollow", "#CC99E6": "check"
};
var FISH_VARIANTS = ["stripe", "spot", "solid", "hollow", "check"];
function fishVariant(color) { return FISH_VARIANT[String(color).toUpperCase()] || "solid"; }
// class by simulation size (babies are born at about 2.5; adults range 3..5 at the default size)
function fishClass(size) {
    if (size >= 6.2) return size < 7.4 ? 2 : 3;
    for (var i = 0; i < FISH_CLASSES.length - 1; i++) if (size < FISH_CLASSES[i].below) return i;
    return FISH_CLASSES.length - 1;
}
function fishMag(size) { return size >= 6.2 ? 2 : 1; }
// face: "r" (art faces right) or "l" (the mirrored character grid, generated)
function fishFile(cls, variant, frame, face, set) {
    var c = FISH_CLASSES[cls];
    if (c.name === "fry") return "fish-fry-" + frame + "-" + face + "-" + set + ".png";
    return "fish-" + c.name + "-" + variant + "-" + frame + "-" + face + "-" + set + ".png";
}

// ── the rest of the cast ──
// Reference at 1080p (see the README for the measured sizes): orca about 32 x 9 cells, angler about 16 x 6, jelly bell
// about one fish wide, worm 3 cells wide (0.3 fish), bubbles 6 to 14 px.
var ANGLER_LURE = { r: { x: 0, y: 0 }, l: { x: 0, y: 0 } };   // lure cell (col, row) of the trimmed art per face; generated: python3 tools/gen-terminal-theme.py --lure
var LURE_PAD = 6;                                  // the lure texture has this many texels of glow around its cell
var JELLY_CLASSES = ["small", "mid", "large"];
var WORM_STAGES = 3;
var LURE_LEVELS = 3;

// draw order (low = behind) per kind
var LAYER = { jelly: 1, bubble: 2, worm: 3, fish: 4, angler: 5, orca: 6 };

// animation pacing per 40 ms sim tick: frame phase += base + speed * perSpeed (2 frames: about 2 changes per second)
var ANIM = {
    fish:   { base: 0.04, perSpeed: 0.03 },
    angler: { base: 0.02, perSpeed: 0.012 },
    orca:   { base: 0.02, perSpeed: 0.015 },
    jellyRate: 2.2,                                 // bell: radians of sim wobble -> frame phase (about 1.4 changes/s)
    wormRate: 1.0                                   // wiggle step per frame change
};
// default config sizes (core/boids-core.js): the sliders scale creatures by whole texels around these
var DEFAULT_SIZE = { orca: 5.5, angler: 4.2, worm: 4 };
function kindMag(kind, size) { return size / DEFAULT_SIZE[kind] >= 1.6 ? 2 : 1; }
function orcaFile(frame, face, set) { return "orca-" + frame + "-" + face + "-" + set + ".png"; }
function anglerFile(frame, face, set) { return "angler-" + frame + "-" + face + "-" + set + ".png"; }
function lureFile(level, set) { return "lure-" + level + "-" + set + ".png"; }
// jelly size = config size 3 + 0..2 variation: small when far below, large when far above
function jellyClass(size) { return size < 2.6 ? 0 : (size < 4.4 ? 1 : 2); }
function jellyMag(size) { return size >= 6.4 ? 2 : 1; }
function jellyFile(cls, frame, set) { return "jelly-" + JELLY_CLASSES[cls] + "-" + frame + "-" + set + ".png"; }
function wormMag(size) { return size >= 6.4 ? 2 : 1; }
// the worm dissolves through three stages (3, 2, 1 cells) as its life drains
function wormStage(life) { return life > 0.66 ? 0 : (life > 0.33 ? 1 : 2); }
function wormFile(stage, frame, set) { return "worm-" + stage + "-" + frame + "-" + set + ".png"; }
function bubbleClass(scale) { return scale < 2.25 ? 0 : 1; }
function bubbleFile(scale, set) { return bubbleClass(scale) ? "bubble-b-" + set + ".png" : "bubble-s-" + set + ".png"; }
function sparkleFile(frame, set) { return "sparkle-" + frame + "-" + set + ".png"; }

// ── backdrop, in texels (1080p: 1 texel = 1 px) ───────────
var SURFACE = { y: 48, rows: 24, floor: 126 };    // waves: cell rows 4-5 (y 48..72, under the floating panel of about 54 px);
                                                  // the creatures' centres stay below floor (126): waves bottom + half the orca (54)
var WATER = { y: 72, rows: 792 };                 // the swell texture: cell rows 6..71 (tiled sideways)
var SEABED = { rows: 96, y: 984 };                // 8 cell rows on the bottom: 96 px = 8.9 % of 1080 (the last row: prompt and load bar)
var PROMPT = { x: CELL_W, y: 1068 };              // "$ boids --watch " + a block cursor that never blinks
var STATUS = { cols: 32, y: 1068 };               // "[||||| ... ] load  50%" at the bottom right
var KELP = [{ rows: 9 }, { rows: 13 }, { rows: 17 }];       // stalks of 9, 13 and 17 text rows (tallest 18.9 %)
// ten plants: [x as a fraction of the width, class]; the foot sits in the seabed's second row
var KELP_PLANTS = [[0.04, 1], [0.08, 0], [0.12, 2], [0.26, 2], [0.30, 1], [0.47, 0], [0.52, 2], [0.71, 1], [0.86, 0], [0.92, 2]];
var SEABED_TOP_Y = SEABED.y;
var KELP_FOOT_Y = SEABED.y + 18;
function kelpFile(cls, frame, set) { return "kelp-" + cls + "-" + frame + "-" + set + ".png"; }
function statusFile(level, set) {
    var v = Math.max(0, Math.min(100, Math.round(level / 5) * 5));
    return "status-" + (v < 100 ? (v < 10 ? "00" : "0") : "") + v + "-" + set + ".png";
}
// load percent (0..100, 5 % steps) from the smoothed stress: 1.5 is a full bar
function loadLevel(stress) { return Math.max(0, Math.min(100, Math.round(stress / 1.5 * 20) * 5)); }
