.pragma library

// Theme registry: the single list of themes, used by main.qml (which scene to load) and
// config.qml (the chooser). To add a theme: create contents/themes/<id>/Scene.qml
// (contract below) and add an entry here.
//
// Scene.qml contract (set by main.qml; all optional to use):
//   bool paused         - the wallpaper is covered/hidden: stop every animation and timer
//   real daylight       - 0 night .. 1 day (1 while the day/night cycle is off)
//   real hour           - hour of day 0..24 (12 while the cycle is off)
//   bool dayNight       - the day/night cycle option is on
//   string waterTop, waterBottom - effective classic water colours (cycle colours or the user's)
//   bool customWater    - the user picked own water colours (cycle off, differ from defaults)
//   real dpr            - device pixel ratio
//   var sim             - the simulation (read only)
//   real glimmerLevel   - sunrise/sunset shimmer 0..1 (only the classic scene shows it)
//   function sync(sim)  - draw the simulation: create/update the delegates of its entities
// Delegates must offer release() (pooled) or be destroy()-able: Boids.releaseAll() hands them back.
//
// usesDayNight / usesWaterColors tell the settings page which options have an effect.

var DEFAULT_THEME = "pixel";

var THEMES = [
    {
        id: "pixel",
        name: "Refined Pixel",
        description: "Crisp pixel-art sea life with animated sprites, smooth water and drifting light shafts.",
        usesDayNight: true,
        usesWaterColors: true
    },
    {
        id: "classic",
        name: "Classic",
        description: "The original look: hand-drawn blocky sprites on a smooth blue gradient.",
        usesDayNight: true,
        usesWaterColors: true
    },
    {
        id: "biolum",
        name: "Bioluminescent Deep",
        description: "Glowing creatures in dark deep water, with marine snow, light shafts and sparkles.",
        usesDayNight: true,
        usesWaterColors: true
    },
    {
        id: "nes",
        name: "NES",
        description: "8-bit console look: the 2C02 palette, tile-built sprites, palette-swapped day and night and a scrolling waterline.",
        usesDayNight: true,
        usesWaterColors: false
    },
    {
        id: "amiga",
        name: "Amiga",
        description: "Late-80s Commodore Amiga look: 12-bit palette, copper-list water gradients, dithered DPaint sprites and parallax.",
        usesDayNight: true,
        usesWaterColors: false
    },
    {
        id: "gameboy",
        name: "Game Boy",
        description: "The sea on a 1989 handheld: four LCD greens, 8x8 tiles and sprites, stepped scrolling water.",
        usesDayNight: true,
        usesWaterColors: false
    },
    {
        id: "onebit",
        name: "1-Bit",
        description: "Two colours only: warm paper and deep ink, ordered-dither water, patterned fish, inverted when stressed.",
        usesDayNight: true,
        usesWaterColors: false
    }
];

function find(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
}
// Unknown, empty or non-string values fall back to the default theme
function resolve(id) { return find(String(id)) ? String(id) : DEFAULT_THEME; }
function indexOf(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return i;
    return 0;
}
function sceneFile(id) { return "../themes/" + resolve(id) + "/Scene.qml"; }   // relative to contents/ui
