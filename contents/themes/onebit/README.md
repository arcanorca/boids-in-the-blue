# 1-Bit

Two colours, nothing else: muted paper `#d9d2bc` on soft ink `#10151f`, light on dark. Every texel of every
texture is one of them (or transparent); there are no blends, no opacity, no filtering, no dither and no noise.
`tests/onebit-theme.test.js` checks that for each PNG, and `tests/onebit-measure.js` measures the comfort
criteria below on real offscreen renders.

## Principles

- **Creatures are the brightest, heaviest things on screen.** Every creature is a SOLID paper shape on the dark
  water with its details in ink inside (eye, gill, stripes, spots, checker, belly line, teeth), and a 1 texel ink
  outline only to separate overlapping sprites. The backdrop stays quiet: few, short, widely spaced dashes.
- **Calm first.** A wallpaper is looked at for hours. The screen is flat dark ink; tone comes from a few static
  horizontal hatch lines (1 texel thick, short irregular dashes, pitch 8-23 texels), never from a stipple. Mean
  luminance is about 11 % (limit 25 %), and no 24x24 px region contains a period-2 pattern.
- **Four bands, three seams.** Near the surface the hatching runs across the screen under a gentle wave line
  and above a solid seam. Below it the same hatching is confined to five narrow diagonal light shafts (lean 1
  column per 2 rows, clean stair-step edges, a dashed diagonal on the lit side), and its pitch widens with depth; the deep water is flat ink. Day shows all six line layers, night only the surface band
  and the shaft edges (layers switch one dash row at a time, so a day/night cycle never flashes).
- **One texel scale.** The screen is 360 texels tall; a texel is a whole number of device pixels (3 px at 1080p).
  Every sprite is drawn at that scale (big size sliders use 2x/3x whole texels, small ones a smaller variant).
- **Silhouette and line weight.** Light from the upper left. Fish are solid paper with ink marks (stripe, spot,
  plain with a gill line, outline = an ink contour line inside the rim, checker); orca = solid paper silhouette with
  an ink back and dorsal-fin core, paper belly, chin, eye patch and saddle and solid flukes; angler = solid paper
  body, ink eye and mouth with paper teeth, a bold stalk and a bright bulb; jelly = solid dome with an ink frill band,
  scalloped rim and 3 clear tentacles; worm and ring bubbles; solid kelp fronds 2-3 texels thick (five plants) and
  a seabed with a 2 texel paper ridge, hatch dashes below it and ink boulders (broken, so passing fish keep contrast).
- **Sizes at 1080p** (default settings): fish 36x27 px (30..42 with the size variation), angler 54x51, orca
  111x60, jelly bell 39 wide, worm 12x24, bubbles 6 and 12 px, seabed 8 % of the height, tallest kelp 16 %.
- **Smooth motion, crisp art.** The simulation ticks at 25 Hz; every sprite glides to its new position with a
  40 ms linear animation (like the classic theme) and `x/y` are rounded to whole *screen* pixels, so textures are
  never blended and motion is uniform at display rate. Positions are not snapped to the texel grid.
- **Few, slow frames.** Fish, orca, angler: 4 tail frames (neutral, up, neutral, down) at 2-3 frames/s. Jelly:
  pulse from the simulation's wobble phase (about 1.4 frames/s). Worm: 4 wiggle frames, shortening in three steps
  as it dies. The backdrop moves only as kelp sway (one texel per step, a step about every 2 s per plant) and a
  few specks sinking one texel every few seconds, from one 2 Hz timer. Nothing moves while `paused`.
- **Stress in 1-bit language** (fish only, never full-screen): from 0.25 a growing share of the fish is
  inverted (ink body, paper pattern, a 2 texel paper contour: they turn hollow and dimmer but still read); from 0.5 a share
  trembles by one texel with a new offset at most every 0.5 s; above 1.2 about a third alternates between
  inverted and normal at 0.8 Hz, each with its own phase.
- **Babies** use the small size classes and show a slow two-frame sparkle (0.8 Hz) while they spiral out.

## What changed from the first version

The first version covered the whole screen with a blue-noise stipple gradient (bright paper at the top), animated
on a 200 ms timer, snapped positions to the art grid and blinked stressed fish at 1.4 Hz. That was tiring,
shimmered, drowned the creatures and made proportions inconsistent. Now: flat ink water with hatch lines, 2 Hz
backdrop, interpolated positions, a slow stress state, and redrawn cast with consistent sizes.

## Files

`theme.js` (descriptor: sizes, classes, backdrop layout), `sync.js` (adapter), `Scene.qml`, `Ambient.qml`,
`EntityLayer.qml` (pool), `OneBitSprite.qml`, `img/` (generated: `node tools/gen-onebit-theme.js`,
`--sheet out.png` for a contact sheet with `SCALE=8`, `--check` to verify), `preview.png` (480x270).
Measurements: `node tests/onebit-measure.js [A B C D S]`.
