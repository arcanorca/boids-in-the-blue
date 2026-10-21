# 1-Bit (woodcut engraving ocean)

Two colours and transparency, nothing else: ink `#0e1520` on ivory paper `#dfd7c2`. Every texel of every
texture in `img/` is one of those two or fully transparent. Nothing is blended, filtered, dithered or noised.
`tests/onebit-theme.test.js` checks the texels, and `tests/onebit-measure.js` measures the comfort criteria on
offscreen renders.

## Palette and scale

- One texel is a whole number of device pixels: the screen is `GRID_ROWS = 360` texels tall (3 px per texel at 1080p).
- Backdrop textures are drawn at that scale in a texel world (`Ambient.qml`); creatures are placed in screen
  pixels so they glide, but are drawn at the same texel size.

## Water: how the volume is built

- `tools/gen-onebit-theme.js` builds six static layers `water-0..5.png` (640x280 texels). Each layer adds one
  step of daylight, so `water-0` is night and `water-5` is full day. A layer changes only when the daylight
  crosses a 1/6 step, so a day/night cycle never flashes.
- Hatching is horizontal, undulating, 1-texel dashes of at least 6 texels, in four depth bands with pitch 5, 5, 7
  and 10 texels and coverage falling with depth. Rows are never closer than 3 texels, and each dash keeps one
  swell offset so it never splits.
- Five diagonal sunbeams add denser hatch in their cores (`beams` in `theme.js`); the cores are about twice as
  dense as the open water, and beams widen with depth.
- A braided wave strip (`surface.png`) closes the top, and the seabed and kelp sit on the bottom.

## Seabed and kelp

- `seabed.png` is a 640x32 layered strip: a paper ridge, sculpted ink boulders, hatch dunes and coral clumps.
  It stays at 8.9 % of the screen height.
- Nine kelp plants (`kelp-<class>-<frame>.png`, three height classes, 17.8 % of the height at most) are placed in
  `Ambient.qml` on the ridge line (`seabedTop`), so their bases sit on the seabed.

## Creatures

- Fish have five size classes and five patterns (stripe, spot, solid, hollow, check). The reference mid fish is
  13x9 texels, 39x27 px at 1080p. Their colour is not used: the variant is the pattern.
- Creatures are paper shapes with ink markings and ink outlines inside their rim, so they stay the heaviest,
  brightest things against the hatch. Orca and angler carry the largest paper areas.
- Orca 114x60 px (about 3 fish long), angler 57x51 px, jelly bell 42 px wide, worm 12x27 px, bubbles 6 and 12 px.

## Motion and rates

- The simulation steps 25 times per second; each sprite interpolates between steps, so motion is smooth.
- Fish animate about 2-3 frames per second; orca and angler slower; jelly bell pulses about 1.4 frames per second.
- The backdrop timer runs every 500 ms. Kelp changes frame every 4 ticks (2 s per frame, 0.5 Hz). Marine snow
  specks sink one texel every 1.5-3 s. Nothing else in the backdrop moves.
- Stress only inverts a growing share of fish from stress 0.25 (ink body, paper pattern), trembles a share by one
  texel from stress 0.5, and above stress 1.2 about a third of the fish alternate between normal and inverted at
  0.8 Hz (at most 2 flips per second per fish). Nothing flashes across the screen, and everything stops on pause.

## Measured (1920x1080, default settings)

- Calm backdrop: at most 0.49 % of pixels differ between frames sampled 0.1-10 s apart (limit 2 %); no pixel
  changes faster than 2 Hz.
- Mean luminance 10-13 % in day, night, crowded, stress, feeding (limit 25 %). No 24x24 px window with a period <= 2 pattern.
- Sizes: see above; seabed 8.9 % and tallest kelp 17.8 % of the screen height.
