# Terminal (green-phosphor ASCII sea)

A green-phosphor terminal showing a calm sea made of text characters. The creatures are drawn from a real pixel
font with larger text than the water; the water is dim and quiet. Nothing blinks, and the backdrop has no fine patterns.

Files: `Scene.qml`, `Ambient.qml` (backdrop), `EntityLayer.qml` (pooling and glide), `TerminalSprite.qml` (one pooled
creature), `sync.js` (simulation state to textures), `theme.js` (sizes, palette, file names), `img/*.png` (566
textures from `tools/gen-terminal-theme.py`), `preview.png`.

## Font, cells and scale

- Font: Terminus 6x12 (`ter-u12n.otb`), a bitmap pixel font, rendered at one texel per font pixel (no anti-aliasing).
- Water and seabed: 2 device px per texel at 1080p, so a text cell is 12 x 24 px and the screen is a 160 x 45 grid.
- Creatures: 3 device px per texel at 1080p (`creatureTexelDevice`), so a creature cell is 18 x 36 px. The creature
  text is 1.5 times the water text, so the creatures are the brightest, most readable things on screen.
- Bubbles belong to the water and are drawn at the water scale.
- Every texture is drawn at an integer scale with nearest-neighbour filtering. Creatures are positioned in screen
  pixels so they can glide; their art is never resampled.
- Block elements (█ ▀ ▄ ▌ ▐ and the eighths) are synthesised exactly on the texel grid; the orca's outline also uses
  the font's own `/ \ _ - ' . | ( ) o` glyphs where they fit. The shades ░ ▒ ▓ are not used: they are dither
  patterns, and the comfort rules forbid them.

## Palette

Three phosphor greens, the amber and red stress tones, and the background `#0a120c`. Each texture belongs to one set:

| set | use | bright | normal | dim |
| --- | --- | --- | --- | --- |
| `g` | day | `#7dffa0` | `#33d86a` | `#1a6b38` |
| `n` | night (one notch dimmer) | `#33d86a` | `#1a6b38` | `#0f4a28` |
| `a` / `an` | amber stress, day / night | `#ffd27a` / `#ffb000` | `#ffb000` / `#8a5a00` | `#8a5a00` / `#4d3300` |
| `r` / `rn` | red stress, day / night | `#ff9a8c` / `#ff4a3a` | `#ff4a3a` / `#8a2418` | `#8a2418` / `#4d1510` |
| `ri` | inverted alarm box (ink on red) | ink `#0a120c` | fill `#ff4a3a` | |

Roles: fish bodies and heads are bright, their tails normal; jellies normal with bright eyes; the orca's body is
normal and its saddle, eye patch and belly are bright; the angler is normal with a bright lure; the water lattice,
the seabed and the kelp are dim. Night is a palette swap of every texture at daylight 0.5; nothing is faded at run time.

## The sea

- Surface: one row of tildes at text row 2 (about 48 px down), under the floating panel. The creatures' centres stay
  below 126 px (the waves plus half of the tallest creature), so nothing swims above the waves.
- Water: a sparse lattice of dim dots, one every 6 cells across and 8 rows down (staggered), fewer below. Static.
- Seabed: four text rows (96 px, 8.9 % of 1080p): ground characters (`_ . /\ \/ (@@)` rocks and mounds), then sparse
  hatch rows of `#` and `=`. The bottom row carries the prompt and the load bar.
- Kelp: nine stalks of 5, 7 or 8 cells (tallest 192 px, 17.8 %) standing on the seabed top. Each swaps between its
  two frames every 2 s (0.5 Hz), out of step with its neighbours.
- Prompt: `$ boids --watch` and a solid block cursor, which never blinks.
- Load bar: `[|||||     ] load  50%` at the bottom right, 20 cells, 5 % steps, re-sampled once per second.

## Creatures (1080p sizes)

- Fish, five variants with their own characters (`<=)` stripe, `<@)` spot, `<#}` solid, `<O]` hollow, `<%}` check),
  in four size classes of body cells. Mid fish: 3 cells, 54 x 36 px. Small 36 px wide, large 72 px. The fry (babies)
  is a tail and a bright dot (`<.`), with a `*` sparkle while it is born.
- Orca: 9 x 2 cells, 162 x 72 px (3 fish long). A hand-drawn map of 18 x 16 units, each 6 x 12 cell quantised to the
  best block shape with two colours. Tall dorsal fin, eye patch and white belly bright, black body normal, notched
  flukes. Frame 1 lifts the flukes one unit.
- Angler: 5 x 3 cells, 90 x 108 px. A stalk and a two-row head with a mouth. The lure is one cell (`*`, `+` on the
  flare) in bright; the stalk is normal green.
- Jelly: 3 cells wide for the mid bell (54 px) with eyes and `/|\` tentacles; small 2 rows, large 5 cells wide with
  `.-"-.` and `(o o)`. Two frames pulse the bell and sway the tentacles.
- Worm: one cell wide (18 px), a stack of `S s ~` that dissolves through three stages as its life drains.
- Bubbles: `°` (6 px) and `o` (10 px), at the water scale.

## Stress and day/night

- Fish only. From stress 0.25 a growing share of fish switch to amber; from 0.6 a growing share switch to red. Each
  fish has a fixed threshold, so the change spreads through the school.
- From 0.5 a share of the fish trembles by one cell (18 px), at most every 0.48 s.
- Above 1.2, a third of the red fish alternate between red and the inverted alarm box at about 0.8 Hz.

## Facing: the file, not a mirror

Left-facing art is generated from the right-facing character rows (characters mirrored, columns reversed); QML
never mirrors a texture, it picks the file.

- Fish and angler: right-facing art when `ent.facingRight` is true.
- Orca: its simulation flag is inverted (false while it swims right), so the right-facing art is used when
  `ent.facingRight` is false. `tests/terminal-measure.js F` checks this at run time, for both directions.

## Motion and rates

- The simulation steps 25 times per second; each sprite glides to its newest target in about one tick (40 ms,
  linear) and lands on whole screen pixels.
- Fish tail beat: two frames, about two changes per second at speed. Orca and angler: under one per second.
  Jelly: about 1.4 per second. Worm: about 1.5 per second.
- The backdrop timer runs at 500 ms and advances only the kelp; the load bar samples once per second.
- Nothing animates while `paused`.

## Measured (1920 x 1080, default settings)

- Calm backdrop: at most 0.23 % of pixels differ between frames 0.1 to 10 s apart (limit 2 %); the fastest pixel
  changes 0.49 times per second (limit 2 Hz).
- Glide: residual from a straight line 0.68 px, frame-to-frame error 0.70 px (limit 1 px); whole pixels.
- Luminance: mean 7.1 to 10.9 % (crowded is the densest scene; limit 25 %). No busy 24 x 24 window on the water
  texel in any scene. Creature-scale glyph windows (0.2 to 1.2 % of the windows, where the creatures stand) are
  reported as information, not as backdrop noise.
- Proportions: mid fish 54 x 36 px; angler 90 x 108 px (1.67 fish); orca 162 x 72 px (3.0 fish, height limit 75);
  jelly bell 54 px (one fish); worm 18 px (0.33 fish); bubbles 6 and 10 px; seabed 8.9 %; tallest kelp 17.8 %.
- Stress 1.5: at most 1.63 alarm flips per second per fish (limit 2); tremble changes at most 2.13 per second (limit 4).
- CPU (`node tests/qml-bench.js`, user + sys, 12 s runs): 38 fish 2.09 s (pixel 2.99 s, onebit 1.83 s); 200 fish
  5.15 s (pixel 5.14 s, onebit 4.86 s): level with pixel at 200 fish, not below it.

## Known limits

- The orca is a whale-like black-and-white block silhouette with a tall fin, a white belly and two flukes. It is
  recognisable at scene size, but it is not a crisp orca: a 9 x 2 cell grid cannot carry a true eye patch and saddle.
- Creature glyphs are fine detail at their own texel scale, so windows with creatures score as busy on that scale.
- Sliders: integer magnification only; a smaller slider does not shrink the orca or the angler below their default size.
- Night is a palette swap, so the difference from day is modest.
