# Terminal (green-phosphor ASCII sea)

A green-phosphor terminal showing a calm sea made of text characters. Every creature is a short block of
characters from a real pixel font, drawn on a fixed cell grid. The look is quiet: a near-black green screen,
three phosphor greens, nothing that blinks, and no fine patterns anywhere.

Files: `Scene.qml`, `Ambient.qml` (backdrop), `EntityLayer.qml` (pooling and glide), `TerminalSprite.qml`
(one pooled creature), `sync.js` (simulation state to textures), `theme.js` (sizes, palette, file names),
`img/*.png` (566 textures from `tools/gen-terminal-theme.py`), `preview.png`.

## Font, cell and scale

- Font: Terminus 6x12 (`ter-u12n.otb`), a bitmap pixel font. One font pixel is one texel. PIL renders the glyphs
  at 1 texel per pixel, so no anti-aliasing is ever involved.
- The screen is `GRID_ROWS = 540` texel rows tall, and a texel is `round(height / 540)` device pixels: 2 px at 1080p.
  A text cell is 6 x 12 texels = 12 x 24 px at 1080p, and the sea is a 160 x 45 cell grid.
- Every texture is drawn at that integer scale with nearest-neighbour filtering. Creatures are positioned in screen
  pixels so they can glide, but their art is never resampled.
- Block elements (█ ▀ ▄ ▌ ▐ and the eighths) are synthesised exactly on the texel grid. The shades ░ ▒ ▓ are not
  used: they are dither patterns, and the comfort rules forbid them.

## Palette

Three phosphor greens, the amber and red stress tones, and the screen background. Each texture belongs to one palette set:

| set | use | bright | normal | dim |
| --- | --- | --- | --- | --- |
| `g` | day | `#7dffa0` | `#33d86a` | `#1a6b38` |
| `n` | night (one notch dimmer) | `#33d86a` | `#1a6b38` | `#0f4a28` |
| `a` / `an` | amber stress, day / night | `#ffd27a` / `#ffb000` | `#ffb000` / `#8a5a00` | `#8a5a00` / `#4d3300` |
| `r` / `rn` | red stress, day / night | `#ff9a8c` / `#ff4a3a` | `#ff4a3a` / `#8a2418` | `#8a2418` / `#4d1510` |
| `ri` | inverted alarm box (ink on red) | ink `#0a120c` | fill `#ff4a3a` | |

Background: `#0a120c`. Creatures use only the bright, normal and dim roles of their set; a texel is either one
of those colours or fully clear. Night is a palette swap of every texture (two steps, at daylight 0.5); nothing
is faded at run time.

## The sea

- Surface: one row of tildes at text row 2 (about 48 px down), under the floating panel. Creatures never swim above
  the line: the simulation's upper limit is set to the surface's floor (`SURFACE.floor`).
- Water: a sparse lattice of dim dots, one every 6 cells across and 8 rows down (staggered), fewer below, none in the
  bottom 15 %. Static.
- Seabed: four text rows (96 px, 8.9 % of 1080p): ground characters (`_ . /\ \/ (@@)` rocks and mounds), then hatch
  rows of `#` and `=`, sparse. The bottom row carries the prompt and the load bar.
- Kelp: nine stalks of 5, 7 or 8 cells (tallest 192 px, 17.8 %), standing on the seabed top. Each swaps between its
  two frames every 2 s (0.5 Hz), out of step with its neighbours.
- Prompt: `$ boids --watch` followed by a solid block cursor. The cursor never blinks.
- Load bar: `[|||||     ] load  50%` at the bottom right, 20 cells, 5 % steps. It is re-sampled once per second and
  changes only when its 5 % step changes.

## Creatures

- Fish, five variants with their own characters and four size classes. The variant comes from the simulation's
  colour (the same five colours as before): `stripe` `<=)`, `spot` `<o)`, `solid` `<#}`, `hollow` `<-]`, `check` `<%}`
  for a 3-cell mid fish; the size class adds body cells (`<==)` large), and the smallest class has no body at all.
  Babies are a 2-cell fry with a bright dot (`<.`) and a `*` sparkle over them while they are born. Fish are
  36 x 24 px at mid size (3 cells), 24 px and 48 px for the small and large classes.
- Orca, 9 x 3 cells (108 x 72 px, about three fish long). Drawn as an 18 x 24 unit map (3 texels across, 1.5 down),
  then each 6 x 12 cell is quantised to the best block shape (all quadrant patterns and the eighths) with two colours.
  Black body normal, saddle and eye patch and belly bright. Two frames: the flukes lift one unit.
- Angler, 5 x 3 cells (60 x 72 px): a stalk, a two-row head and a mouth. The lure is a separate cell (`*` in three
  intensities) that changes with two slow sines, a few seconds per step.
- Jelly, three sizes (2, 3 and 5 cells wide): a dome, a body with `*` and tentacles `/|\` and `\|/`. Two frames pulse
  the bell (about 1.4 changes per second, from the simulation's wobble).
- Worm, one cell wide: a stack of `S s ~`. It dissolves through three stages (3, 2 and 1 cells tall) as its life
  drains, and wiggles between two frames.
- Bubbles: a small `°` and a big `o`, one cell each (a capital `O` read as a row of zeros in a busy sea).

## Stress and day/night

- Fish only. From stress 0.25 a growing share of fish switch to amber; from 0.6 a growing share switch to red. Each
  fish has a fixed threshold, so the change spreads through the school rather than flipping all at once.
- From 0.5 a share of the fish trembles by one cell, at most every 0.48 s.
- Above 1.2, a third of the red fish alternate between red and the inverted alarm box at about 0.8 Hz. Nothing flashes
  across the screen; the box is per fish.

## Facing: the file, not a mirror

Left-facing art is generated from the right-facing character rows: characters mirrored (`<` to `>`, `(` to `)`,
`/` to `\`, `}` to `{`, ...) and the columns reversed. QML never mirrors a texture; it picks the file.

- Fish and angler: right-facing art when `ent.facingRight` is true.
- Orca: the simulation's orca flag is inverted (false while it swims right), so the right-facing art is used when
  `ent.facingRight` is false. `tests/terminal-measure.js F` checks this at run time for fish and orca, both ways.

## Motion and rates

- The simulation steps 25 times per second. Each sprite glides from its last position to its newest target in about
  one tick (40 ms, linear), and lands on whole screen pixels, as in the 1-bit theme.
- Fish: a two-frame tail beat about two changes per second, driven by speed (at most three per second).
- Orca and angler: slower (under one change per second). Jelly: about 1.4 per second. Worm: about 1.5 per second.
- The backdrop timer runs at 500 ms and advances only the kelp. The load bar samples once per second.
- Nothing animates while `paused`; the scene stops with the wallpaper.

## Measured (1920 x 1080, default settings, `node tests/terminal-measure.js`)

- Calm backdrop: at most 0.23 % of pixels differ between frames 0.1 to 10 s apart (limit 2 %); the fastest pixel
  changes 0.49 times per second (limit 2 Hz).
- Glide: residual of on-screen x from a straight line 0.61 px, frame-to-frame error 0.70 px (limit 1 px); every
  sprite lands on whole pixels.
- Comfort: mean luminance 6.5 to 6.9 % in day, night, crowded, stress and feeding renders (limit 25 %); no 24 x 24 px
  window is busy (0 of 14151).
- Proportions: mid fish 36 x 24 px; angler 60 x 72 (1.67 fish); orca 108 x 72 (3.0 fish; height limit 75); jelly bell
  36 px; worm 12 px; bubbles 12 px boxes; seabed 8.9 %; tallest kelp 17.8 %.
- Stress 1.5: at most 1.63 alarm-box flips per second per fish (limit 2); tremble changes at most 2.13 per second
  (limit 4).
- CPU (`node tests/qml-bench.js`, 12 s runs, user + sys): 38 fish 1.52 s (pixel 3.05 s, onebit 1.71 s); 200 fish
  4.74 s (pixel 5.08 s, onebit 5.02 s).

## Known limits

- Orca: the fluke and eye patch are at the limit of a 12 x 24 px cell, so the orca reads as a black-backed cetacean
  with a white belly and fin, more than as a crisp orca at scene size.
- Sliders: integer magnification only. Smaller slider settings do not shrink the orca or the angler below their
  default size; larger settings enlarge them by 2x.
- Night: a palette swap, so the difference from day is subtle with a sparse sea; the background stays the same.
