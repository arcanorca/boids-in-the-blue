.pragma library
// Theme descriptor: "illustrated" (C: Soft Illustrated).
//
// THEME CONTRACT (shared by all themes; contents/themes/<themeId>/):
//   theme.js    this file: per-kind sprite data, colour strategy, layer order, sky gradients
//   Stage.qml   root item main.qml loads for this theme. Properties set by main.qml:
//                 paused (bool), dayNight (bool), hour (real 0..24), dpr (real)
//               and it must provide:  function sync(sim)  (write entity state to sprites)
//   Ambient.qml optional ambient layer (rays, seabed, kelp) used by Stage.qml
// "classic" is not a theme folder: it is the legacy-geometry renderer in contents/ui.
//
// Art lives in img/ (rasterised by tools/gen-illustrated.js from svg/). Every sprite faces
// right and is a single shared texture per (name, LOD): nothing is painted per entity.

var id = "illustrated";

// delegate type ids (shared with the classic renderer)
var T_FISH = 1, T_JELLY = 2, T_ORCA = 3, T_ANGLER = 4, T_BUBBLE = 5, T_WORM = 6;

// Per kind:
//   unit    on-screen px of sprite width per sim "size" unit (config size slider) at depth scale 1
//   aspect  height / width of the (main) texture
//   lods    texture widths available; the smallest one >= needed px (x dpr) is used
//   depth   [min, max] range of the stable pseudo-depth (0 = far, 1 = near)
//   tilt    max pitch (deg) from vertical velocity (0 = none)
var KINDS = {
    fish:   { type: 1, tex: "fish",       unit: 12.5, aspect: 80 / 120,  lods: [48, 84, 144],   depth: [0, 1],      tilt: 16 },
    jelly:  { type: 2, tex: "jelly-bell", unit: 16,   aspect: 0.7,       lods: [48, 88, 160],   depth: [0.1, 1],    tilt: 0 },
    orca:   { type: 3, tex: "orca",       unit: 24,   aspect: 105 / 240, lods: [96, 180, 320],  depth: [0.2, 0.85], tilt: 7 },
    angler: { type: 4, tex: "angler",     unit: 16.5, aspect: 130 / 170, lods: [64, 120, 220],  depth: [0.2, 0.9],  tilt: 8 },
    bubble: { type: 5, tex: "bubble",     unit: 5.2,  aspect: 1,         lods: [24, 48],        depth: [0, 1],      tilt: 0 },
    worm:   { type: 6, tex: "worm",       unit: 3.4,  aspect: 2,         lods: [24, 48],        depth: [0.55, 1],   tilt: 0 }
};
var BY_TYPE = [null, "fish", "jelly", "orca", "angler", "bubble", "worm"];

// Colour strategy: the simulation's FISH_PALETTE entries map to muted art colours (the sprite
// is one pre-coloured texture per colour; stress adds a red/wine silhouette overlay on top).
var FISH_COLOR = {
    "#FF8080": "coral", "#FFB34D": "apricot", "#E6E666": "lemon", "#4DCCE6": "teal", "#CC99E6": "lilac"
};
function fishKey(simColor) { return FISH_COLOR[String(simColor).toUpperCase()] || "coral"; }

// Layer order, back to front (z space of the entity layer; see Layer.qml)
var Z = {
    seabedFar: -50, kelpFar: -40,
    bin: [0, 10000, 20000],          // delegate z = bin*... + counter
    haze: [9500, 19500],             // fog planes between depth bins
    rays: 19800, front: 40000
};
var HAZE_ALPHA = [0.23, 0.13];        // far entities sit behind both planes, mid behind the second

// ── textures ───────────────────────────────────────────────
function lodFor(kind, px) {
    var l = KINDS[kind].lods, i = 0;
    while (i < l.length - 1 && l[i] < px * 0.92) i++;
    return l[i];
}
function lodOf(lods, px) {
    var i = 0;
    while (i < lods.length - 1 && lods[i] < px * 0.92) i++;
    return lods[i];
}
function img(name, w) { return "img/" + name + "-" + w + ".png"; }

// ── depth ──────────────────────────────────────────────────
// Stable pseudo-depth in [0,1) from an integer identity (Knuth multiplicative hash + mix)
function hash01(n) {
    var h = Math.imul(n | 0, 0x9E3779B1);
    h ^= h >>> 15; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13;
    return ((h >>> 0) % 100000) / 100000;
}
function depthFor(kind, n) {
    var r = KINDS[kind].depth;
    return r[0] + (r[1] - r[0]) * hash01(n);
}
function depthScale(d) { return 0.7 + 0.42 * d; }                  // far 0.70 .. near 1.12
function depthBin(d) { return d < 0.34 ? 0 : (d < 0.67 ? 1 : 2); }

// ── sky / water colour grading ─────────────────────────────
// 5 vertical stops (0, .25, .55, .8, 1). Day, night, and a dawn/dusk warm wash on top.
var SKY_DAY   = ["#4aa6ad", "#348fa0", "#237391", "#185a7c", "#113f60"];
var SKY_NIGHT = ["#243f66", "#1a3358", "#122546", "#0c1a35", "#070f23"];
var SKY_WARM  = ["#f6b295", "#e4908f", "#a67ba5", "#46567f", "#15264a"];   // peach/rose sunrise wash
var WARM_AMT  = [0.55, 0.42, 0.22, 0.08, 0.0];
var STOPS = [0, 0.25, 0.55, 0.8, 1];

function _mix(a, b, t) {
    var r = [], i;
    for (i = 0; i < 3; i++) {
        var x = parseInt(a.substr(1 + i * 2, 2), 16), y = parseInt(b.substr(1 + i * 2, 2), 16);
        r.push(Math.round(x + (y - x) * t));
    }
    return "#" + ((1 << 24) | (r[0] << 16) | (r[1] << 8) | r[2]).toString(16).slice(1);
}

// Returns { stops:[5 colours], day:0..1, warmth:0..1 }.  With the cycle off: full day.
function sky(hour, dayNight) {
    var b = 1, w = 0;
    if (dayNight) {
        b = (Math.cos((hour - 12) * Math.PI / 12) + 1) / 2;
        w = Math.max(Math.max(0, 1 - Math.abs(hour - 6.5) / 1.6), Math.max(0, 1 - Math.abs(hour - 18.5) / 1.6));
    }
    var out = [];
    for (var i = 0; i < 5; i++) {
        var c = _mix(SKY_NIGHT[i], SKY_DAY[i], b);
        out.push(w > 0.01 ? _mix(c, SKY_WARM[i], w * WARM_AMT[i]) : c);
    }
    // fog colour: the water colour lifted toward a light sea-glass so warm sprites stay clean, not muddy
    var haze = [];
    for (var j = 0; j < 5; j++) haze.push(_mix(out[j], "#8fd6d0", 0.22 * b + 0.04));
    return { stops: out, haze: haze, day: b, warmth: w };
}

// ── ambient ────────────────────────────────────────────────
// x, h: fraction of width / height; v: kelp texture variant; a: sway amplitude (deg); d: period (ms)
var KELP_FAR = [
    { x: 0.04, h: 0.26, v: 1, a: 3, d: 6200 }, { x: 0.17, h: 0.20, v: 3, a: 3.5, d: 5400 },
    { x: 0.33, h: 0.24, v: 2, a: 3, d: 6800 }, { x: 0.52, h: 0.18, v: 1, a: 3, d: 5800 },
    { x: 0.69, h: 0.25, v: 3, a: 3.5, d: 6400 }, { x: 0.83, h: 0.21, v: 2, a: 3, d: 5600 },
    { x: 0.94, h: 0.27, v: 1, a: 3, d: 7000 }
];
var KELP_FRONT = [
    { x: -0.01, h: 0.52, v: 2, a: 3.5, d: 7400 }, { x: 0.035, h: 0.40, v: 1, a: 4, d: 6200 },
    { x: 0.075, h: 0.30, v: 3, a: 4, d: 5600 }, { x: 0.90, h: 0.34, v: 3, a: 4, d: 6600 },
    { x: 0.945, h: 0.48, v: 1, a: 3.5, d: 7800 }, { x: 0.985, h: 0.38, v: 2, a: 4, d: 5900 }
];
// light rays: x centre (fraction of width), width (fraction), lean (deg), opacity at full day, period
var RAYS = [
    { x: 0.10, w: 0.20, lean: 10, o: 0.20, a: 2.2, d: 13000 },
    { x: 0.30, w: 0.26, lean: 7,  o: 0.26, a: 1.8, d: 16000 },
    { x: 0.52, w: 0.17, lean: 11, o: 0.17, a: 2.4, d: 11000 },
    { x: 0.71, w: 0.24, lean: 6,  o: 0.24, a: 2.0, d: 14500 },
    { x: 0.90, w: 0.19, lean: 9,  o: 0.18, a: 2.2, d: 12000 }
];
