.pragma library
// Descriptor of the "nes" theme: everything a renderer (and the generator, tools/gen-nes-theme.js)
// needs to know about this theme's hardware model. Single source of truth for sizes, palettes and
// animation pacing; the textures in img/ are baked from it.
//
// Hardware model (Nintendo Entertainment System, 2C02 PPU):
//   * 64-entry master palette (NES below), 4 sprite palettes + 4 background palettes of 3 colours
//     each, colour 0 transparent (sprites) or the one universal backdrop colour (background)
//   * sprites are metasprites of 8x8 tiles, picked per frame; flips are per sprite
//   * the background is a nametable of 8x8 tiles; the 4 BG palettes are assigned per 16x16 area
//   * everything lives on a virtual pixel grid that is scaled by an integer (see pxFor)

var id = "nes";
var DIR = "img/";                                  // relative to NesSprite.qml / Ambient.qml
var NAMES = ["", "fish", "jelly", "orca", "angler", "bubble", "worm"];   // by delegate type

// ── the 2C02 master palette ─────────────────────────────────
// The widely circulated "classic" NTSC set (as shipped by FCEUX and listed on the NESdev wiki),
// $00..$3F. $0D..$0F, $1D..$1F, $2E/$2F, $3E/$3F are black.
var NES = [
    "#7C7C7C", "#0000FC", "#0000BC", "#4428BC", "#940084", "#A80020", "#A81000", "#881400",
    "#503000", "#007800", "#006800", "#005800", "#004058", "#000000", "#000000", "#000000",
    "#BCBCBC", "#0078F8", "#0058F8", "#6844FC", "#D800CC", "#E40058", "#F83800", "#E45C10",
    "#AC7C00", "#00B800", "#00A800", "#00A844", "#008888", "#000000", "#000000", "#000000",
    "#F8F8F8", "#3CBCFC", "#6888FC", "#9878F8", "#F878F8", "#F85898", "#F87858", "#FCA044",
    "#F8B800", "#B8F818", "#58D854", "#58F898", "#00E8D8", "#787878", "#000000", "#000000",
    "#FCFCFC", "#A4E4FC", "#B8B8F8", "#D8B8F8", "#F8B8F8", "#F8A4C0", "#F0D0B0", "#FCE0A8",
    "#F8D878", "#D8F878", "#B8F8B8", "#B8F8D8", "#00FCFC", "#F8D8F8", "#000000", "#000000"
];

// ── sprite palettes (OAM attribute 0..3), colours 1..3; colour 0 is transparent ──
// Shared by every creature: sea = orca, aqua fish, bubbles; sun = coral/amber/lemon fish, worm,
// angler lure; alarm = the stress palette (only fish ever use it); violet = orchid fish, angler, jelly.
var SPR_PAL = {
    sea:    [0x0F, 0x21, 0x30],
    sun:    [0x16, 0x27, 0x38],
    alarm:  [0x0F, 0x15, 0x35],
    violet: [0x03, 0x23, 0x33]
};
var SPR_PAL_ORDER = ["sea", "sun", "alarm", "violet"];
// palette cycling of the alarm palette above stress 1.2: it alternates between its two states
var ALARM_STATES = [[0x0F, 0x15, 0x35], [0x0F, 0x06, 0x16]];
var ALARM_PERIOD_MS = 400;                         // one state lasts 400 ms: 1.25 Hz, well under 2 Hz

// ── background palettes (attribute table, per 16x16 area) ──
// u = the universal backdrop colour ($3F00); pal[n] = BG palette n colours 1..3.
//   0 water   the three water shades (top .. deep); the deepest shade is the universal colour
//   1 sand    sand, rocks
//   2 kelp    weed
//   3 surface foam of the waterline (colour 1 = the top water shade so it joins seamlessly)
function _fade(c) { return c >= 0x10 ? c - 0x10 : 0x0F; }          // the classic NES fade step
var BG_DAY = { u: 0x02, pal: [[0x21, 0x11, 0x12], [0x18, 0x27, 0x37], [0x0A, 0x1A, 0x2A], [0x21, 0x31, 0x30]] };
// dusk: the water palette rotates one shade deeper, the others take the NES brightness fade
var BG_DUSK = { u: 0x02, pal: [[0x11, 0x12, 0x02], BG_DAY.pal[1].map(_fade), BG_DAY.pal[2].map(_fade), BG_DAY.pal[3].map(_fade)] };
var BG_NIGHT = { u: 0x02, pal: [[0x02, 0x02, 0x02], [0x0F, 0x08, 0x18], [0x0F, 0x0B, 0x0A], [0x02, 0x12, 0x21]] };
var BG = { day: BG_DAY, dusk: BG_DUSK, night: BG_NIGHT };
var BG_STATES = ["day", "dusk", "night"];
// daylight (0 night .. 1 day) -> palette state
function bgState(daylight) { return daylight > 0.7 ? "day" : (daylight > 0.35 ? "dusk" : "night"); }

function hexOf(idx) { return NES[idx & 0x3F]; }

// ── virtual screen ──
// One virtual pixel = pxFor() screen pixels (an integer), so the picture is 240..~360 lines tall
// like the real thing (1080p: 4x -> 480x270, 1440p: 6x -> 427x240).
function pxFor(height) { return Math.max(2, Math.floor(height / 240)); }

// ── sprites ──
// kind -> metasprite size in virtual pixels (multiples of 8), swim/pulse frames, draw layer
var kinds = {
    fish:   { type: 1, frames: 2, layer: 4, m: { w: 16, h: 8 }, s: { w: 8, h: 8 } },
    jelly:  { type: 2, frames: 2, layer: 1, m: { w: 8,  h: 16 } },
    orca:   { type: 3, frames: 2, layer: 6, m: { w: 24, h: 16 } },
    angler: { type: 4, frames: 2, layer: 5, m: { w: 16, h: 24 }, lureLevels: 3 },
    bubble: { type: 5, frames: 1, layer: 2, m: { w: 8,  h: 8 } },
    worm:   { type: 6, frames: 2, layer: 3, m: { w: 8,  h: 8 } }
};
var FISH_VARIANT = {
    "#FF8080": "coral", "#FFB34D": "amber", "#E6E666": "lemon",
    "#4DCCE6": "aqua",  "#CC99E6": "orchid"
};
var FISH_VARIANTS = ["coral", "amber", "lemon", "aqua", "orchid"];
function fishVariant(color) { return FISH_VARIANT[String(color).toUpperCase()] || "aqua"; }
// sprite palette of each fish variant (OAM attribute); stress swaps it to the alarm palette
var FISH_PALETTE = { coral: "sun", amber: "sun", lemon: "sun", aqua: "sea", orchid: "violet", "alarm-a": "alarm", "alarm-b": "alarm" };
// adult fish are 16x8, fry (babies and the smallest adults) a single 8x8 tile
function fishClass(ent) { return (ent.isBaby || ent.sizeVariation < -0.45) ? "s" : "m"; }
function bubbleClass(scale) { return scale < 2.0 ? "s" : (scale < 2.5 ? "m" : "l"); }
function dims(kind, cls) { var k = kinds[kind]; return (cls && k[cls]) ? k[cls] : k.m; }

// Animation pacing (per 40 ms sim tick): frame phase += base + speed * perSpeed
var anim = {
    fish:   { base: 0.03, perSpeed: 0.12 },
    angler: { base: 0.025, perSpeed: 0.1 },
    orca:   { base: 0.02, perSpeed: 0.08 },
    jellyRate: 3.0,                                // pulse frame = sign of sin(wobble * jellyRate)
    wormRate: 0.5
};

// File names (relative to DIR)
function spriteFile(kind, cls, variant, frame, extra) {
    switch (kind) {
    case "fish":   return "fish-" + cls + "-" + variant + "-" + frame + ".png";
    case "bubble": return "bubble-" + cls + ".png";
    case "angler": return "angler-" + frame + "-" + extra + ".png";    // extra = lure level
    default:       return kind + "-" + frame + ".png";
    }
}

// ── background layout (virtual pixels / tiles) ──
var TILE = 8;
var SEABED = { cols: 64, rows: 10 };               // seabed nametable (2 screens wide), bottom aligned
var SURFACE = { cols: 32, rows: 2 };               // waterline nametable, scrolls horizontally
var STRIP_COLS = 128;                              // water transition strips are this many tiles wide

function seabedFile(state, frame) { return "seabed-" + state + "-" + frame + ".png"; }
function surfaceFile(state) { return "surface-" + state + ".png"; }
function glintFile(state, f) { return "glint-" + state + "-" + f + ".png"; }
function ditherFile(state, k) { return "dither-" + state + "-" + k + ".png"; }   // k = 0..2

// ── water bands (in tile rows) ──
// Three water shades separated by two-row dither transitions, ending right above the seabed.
// rows = total tile rows of the screen. Returns [{row, rows, shade}] bands and [{row, k}] transitions.
function waterLayout(rows) {
    var top = SURFACE.rows, bottom = rows - SEABED.rows;
    var span = Math.max(8, bottom - top), trans = 2 * 3, free = Math.max(3, span - trans);
    var b0 = Math.round(free * 0.26), b1 = Math.round(free * 0.34), b2 = Math.max(1, free - b0 - b1);
    var r = top, bands = [], tr = [];
    bands.push({ row: r, rows: b0, shade: 0 }); r += b0;
    tr.push({ row: r, k: 0 }); r += 2;
    bands.push({ row: r, rows: b1, shade: 1 }); r += b1;
    tr.push({ row: r, k: 1 }); r += 2;
    bands.push({ row: r, rows: b2, shade: 2 }); r += b2;
    tr.push({ row: r, k: 2 }); r += 2;
    return { bands: bands, trans: tr, end: r };
}

// ambient bubbles rising from the seabed: [tile column of the 64-tile bed, speed class]
var VENTS = [[7, 5], [8, 3], [23, 4], [37, 6], [38, 4], [51, 5]];
// water glints: [x as a fraction of the width, y as a fraction of the height, phase offset in ticks]
var GLINTS = [[0.06, 0.07, 0], [0.19, 0.17, 7], [0.33, 0.1, 13], [0.47, 0.3, 4], [0.61, 0.13, 17], [0.72, 0.38, 9], [0.84, 0.22, 21], [0.93, 0.08, 11]];
