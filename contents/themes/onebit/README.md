# 1-Bit (woodcut engraving ocean)

Two colours and transparency, nothing else: ink `#0e1520` on ivory paper `#dfd7c2`. Every texel of every
texture in `img/` is one of those two or fully transparent. Nothing is blended, filtered, dithered or noised.
`tests/onebit-theme.test.js` checks the texels, and `tests/onebit-measure.js` measures the comfort criteria on
offscreen renders.

## Palette and scale

- One texel is a whole number of device pixels: the screen is `GRID_ROWS = 360` texels tall (3 px per texel at 1080p).
- Backdrop textures are drawn at that scale in a texel world (`Ambient.qml`); creatures are placed in screen
  pixels so they glide, but are drawn at the same texel size.

## Water: dots, not lines

The water is built only from single-texel and small dots on a fixed lattice or fixed candidate set, with no
randomness. Tone is carried by dot count and dot size, and nothing forms a stroke. `BACKGROUND_STYLE` in
`theme.js` picks one of two looks; the default is `"contours"`.

- `"contours"` (default): a smooth swell field (three low-frequency sines, periods that divide the 648-texel
  tile) is drawn as isolines in steps of 0.25. Each isoline is made of single-texel dots, at least 4 texels
  apart (greedy, strongest first). A second set of diagonal isolines appears inside the five sunbeams. Contours
  fade with depth and are empty below 62 % of the screen height.
- `"halftone"`: a Ben-Day halftone on a 45-degree lattice (x and y multiples of 6 with (x/6 + y/6) even, so
  neighbours are 8.5 texels apart). Dot size 0 to 3 (none, single texel, plus of 5, solid 3x3) comes from a
  smooth tone field: strongest just under the surface, boosted in the sunbeams, faded to nothing below 62 % of
  the height, with a gentle low-frequency swell.

Daylight: `water-0.png` (night) .. `water-5.png` (full day) are six nested layers. Layer n holds the dots that
show at tone scale `waterScale(n)` (0.4 at night rising linearly to 1.0 in day), so a dot appears once and never moves, and the night layer keeps a faint pattern near the surface and the beam edges. Every
layer is a fixed texture; nothing in the backdrop animates except the slow kelp sway.

Measured: paper share of the full-day water 0.63 % (contours) or 2.55 % (halftone); no dot shape larger than
3x3 texels; distinct dots at least 4 texels apart centre to centre (3 empty texels between solid dots).

## Seabed and kelp

- `seabed.png` is a 640x32 layered strip: a paper ridge, sculpted ink boulders, hatch dunes and coral clumps.
  It stays at 8.9 % of the screen height.
- Nine kelp plants (`kelp-<class>-<frame>.png`, three height classes, 17.8 % of the height at most) are placed in
  `Ambient.qml` on the ridge line (`seabedTop`), so their bases sit on the seabed.

## Creatures

- Fish have five size classes and five patterns (stripe, spot, solid, hollow, check). The reference mid fish is
  13x9 texels, 39x27 px at 1080p. Their colour is not used: the variant is the pattern.
- Creatures are paper shapes with ink markings and ink outlines inside their rim, so they stay the heaviest,
  brightest things against the dots.
- Orca (40x23 texels, 120x69 px, about 3 fish long) follows the owner's reference, hand-drawn texel by texel: a
  straight, streamlined black body (about 3.5:1) with a blunt rounded head, a tall back-swept dorsal fin in the
  middle of the back, a slim tail stock that stays level with the body and ends in small swept flukes, a broad
  paddle flipper hanging down-back between the white throat and the white belly, a slanted white eye patch, a
  white saddle behind the fin and the belly patch hooking up toward the flank. The black body is ink on ink water,
  so it is framed by a 1-texel paper outline with a 2-texel rim light along the back in front of the fin (light
  from above). Frames: neutral, flukes tilted up, neutral, flukes tilted down. The small variant (25x15) is
  hand-drawn too.
- Angler 57x51 px, jelly bell 42 px wide, worm 12x27 px, bubbles 6 and 12 px.

## Motion and rates

- The simulation steps 25 times per second; each sprite interpolates between steps, so motion is smooth.
- Fish animate about 2-3 frames per second; orca and angler slower; jelly bell pulses about 1.4 frames per second.
- The backdrop timer runs every 500 ms and only advances the kelp frames: each plant changes frame every 2 s
  (0.5 Hz). Nothing else in the backdrop moves; there are no drifting specks.
- Stress only inverts a growing share of fish from stress 0.25 (ink body, paper pattern), trembles a share by one
  texel from stress 0.5, and above stress 1.2 about a third of the fish alternate between normal and inverted at
  0.8 Hz (at most 2 flips per second per fish). Nothing flashes across the screen, and everything stops on pause.

## Measured (1920x1080, default settings)

- Calm backdrop: at most 0.49 % of pixels differ between frames sampled 0.1-10 s apart (limit 2 %); no pixel
  changes faster than 2 Hz.
- Mean luminance 10-13 % in day, night, crowded, stress, feeding (limit 25 %). No 24x24 px window with a period <= 2 pattern.
- Sizes: see above; seabed 8.9 % and tallest kelp 17.8 % of the screen height.
