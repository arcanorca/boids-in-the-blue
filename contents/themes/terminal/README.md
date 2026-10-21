# Terminal (green-phosphor CRT ASCII sea)

A calm aquarium drawn entirely from text characters on a phosphor-green CRT: dim swell strokes in the water, bright
character-art creatures with a soft baked glow, a static vignette and scanline glass over everything, a kelp seabed, a
prompt line and an htop-style load bar that turns the fish amber and red under stress.

## Critique of the previous Terminal theme (pass 3), why it was redone

- Fish were one-line glyph clumps (`<@)`, `{#>`), 3 cells wide: no body, no readable face, and the five variants
  were told apart by single characters.
- Schools piled up into unreadable text soup; each glyph was drawn at 18 x 36 px, too coarse to hold any shape.
- The orca was a boat-like `<___o___>` line drawing: no dorsal fin that read, no white belly, no eye patch.
- Jellies (`(o)` + `/|\`) and the angler (`(@@@|`) were weak, the lure was the only thing that said angler.
- The scene was sparse, dim and cheap next to the pixel / NES / Amiga themes: a dot lattice for water, a flat
  background, nothing that said "beautiful CRT".

## What it is now

- One identity: green phosphor on a near-black green water (`#08120b`), four tones (bright, normal, mid, dim) plus a
  soft glow baked into the sprite pixels; amber and red are only the stress colours.
- One cell: Terminus 6 x 12 (a bitmap font), one texel = 1 device px at 1080p (2 at 4K), the screen is a 320 x 90
  cell grid, creatures and water are drawn at the same integer scale, nearest-neighbour. No `Text` items, no runtime
  font, shared textures, pooled delegates (`EntityLayer.qml`), glide to whole screen pixels (not snapped to cells).
- Glass (`Scene.qml`): one static layer with a vignette, a little depth darkening and a faint green lift of the water
  (4 px blocks, one alpha level per step; dimmer at night in two steps) and one dark scanline in six rows. It sits
  over the creatures too, so the water-coloured creature boxes stay invisible. Nothing in it animates.

## How the sprites are made (image to ASCII, then by hand)

1. `tools/terminal-img2ascii.py` converts a Refined Pixel sprite (`contents/themes/pixel/img/`: orca, fish, angler,
   jelly) to a draft character grid. A 6 x 12 cell is one source pixel wide and two tall, so each cell is a (top,
   bottom) pixel pair and the glyph follows from the pair and its neighbours (fill glyph by tone class: dark `#`,
   grey `=`, white `@`; edge cells `' . _ ( )`), plus a tone letter per cell.
2. The drafts were cleaned by hand into `tools/terminal-art.txt` (right-facing text rows, optional tone rows): fin
   `|#\`, eye patch, white belly, flukes, mouths and teeth, jelly domes and tentacles, kelp leaves.
3. `tools/gen-terminal-theme.py` renders the grids with Terminus at one cell size, fills the cells with the water
   colour (opaque boxes; empty rows and columns trimmed so boxes erase no more than they must), bakes the glow into
   the pixels, and mirrors the CHARACTER GRID for left-facing art (`( <-> )`, `/ <-> \`, `< <-> >`, `' <-> `` ` ``...). Silhouette
   fill glyphs are drawn in the normal tone and interior fill in dim, so shading is both density and brightness.
   `--sheet out.png --scale 4 [--only orca,fish]` writes a contact sheet; `--check` compares files with a regeneration;
   `--lure` prints the lure cell for `theme.js`.

## Sizes at 1080p (px)

| creature | size | |
| --- | --- | --- |
| mid fish | 66 x 48 (11 x 4 cells) | small 48 x 36, large 96 x 60, fry 24 x 24 |
| angler | 108 x 72 | 1.6 fish long, lure cell on the stalk |
| orca | 192 x 108 (32 x 9 cells) | 2.9 fish long |
| jelly bell | 72 x 72 (mid) | small 36 x 48, large 78 x 84 |
| worm | 18 wide (3 cells) | 3 stages: 36, 24, 12 px tall |
| bubbles | 5 x 6 and 9 x 8 | |
| seabed | 96 (8.9 %) | tallest kelp 204 px (18.9 %) |

Size sliders switch the nearest class and magnify by 2 (whole texels) above the default range.

## Palette (`theme.js`, tests compare it with the generator)

| set | use | bright | normal | mid | dim |
| --- | --- | --- | --- | --- | --- |
| `g` | day | `#e0ffe9` | `#6bf59b` | `#3cc873` | `#217f4a` |
| `n` | night (one notch dimmer) | `#6bf59b` | `#3cc873` | `#217f4a` | `#124c2d` |
| `a` / `an` | amber stress, day / night | `#ffe0a0` / `#ffb000` | `#ffb000` / `#c47f00` | `#c47f00` / `#7a4d00` | `#7a4d00` / `#4d3000` |
| `r` / `rn` | red stress, day / night | `#ffb4a8` / `#ff5040` | `#ff5040` / `#c03024` | `#c03024` / `#7a1c14` | `#7a1c14` / `#4d1510` |
| `ri` | reverse-video alarm box | ink `#ffc8bc` | fill `#5e170f` | | |

## The sea

- Waves: two text rows at y 48..72 (under the floating panel, which covers about 54 px); the simulation's floor is
  126 px, so even the orca (108 px tall) stays below them.
- Swell: sparse strokes (`~ - . '` strands, longer and denser near the surface, fewer and shorter with depth), a few
  drifting specks. One static 1920 x 792 opaque texture, tiled sideways.
- Seabed: 8 text rows: boulders `(==:)`, `/^\` mounds, coral tufts, sand, dim ripples. The last row carries the prompt
  `$ boids --watch` with a block cursor that never blinks, and the load bar `[|||     ] load  50%` (5 % steps, sampled once a second).
- Kelp: ten plants of 9, 13 or 17 cells, stalk and paired leaves, swapping leaf sides every 2 s (0.5 Hz).

## Stress, day/night, facing

- Stress: from 0.25 a growing share of fish turns amber, from 0.6 red; from 0.5 a share trembles by one cell, at most
  every 0.48 s; above 1.2 a third of the red fish alternate with the reverse-video box at about 0.8 Hz. Nothing flashes
  across the screen.
- Night is a palette swap at daylight 0.5, and the glass haze dims in one step.
- Fish and angler show the right-facing file when `ent.facingRight` is true; the orca's flag is inverted, so it shows
  the right-facing file when the flag is false. QML never mirrors a texture. `tests/terminal-measure.js F` checks both.

## Measured (1920 x 1080, offscreen)

See the final report in the commit message; `node tests/terminal-measure.js` prints: calm backdrop 0.07 % of pixels
differ between frames 0.1 to 10 s apart (limit 2 %), nothing above 2 Hz; smooth glide residual 0.68 px on whole
pixels; mean luminance 6 to 9 % in day, night, crowded, stress and feeding; busy 24 x 24 windows in the creature-free
backdrop 0 (max share 38 %, limit 50 %); alarm alternation at most 1.6 flips per second; tremble 2.1 changes per second.

## Files

`Scene.qml`, `Ambient.qml` (backdrop), `EntityLayer.qml` (pooling and glide), `TerminalSprite.qml` (one pooled
creature, sized from its texture), `sync.js` (simulation state to textures), `theme.js`, `img/*.png`, `preview.png`;
generators in `tools/` (`gen-terminal-theme.py`, `terminal-img2ascii.py`, `terminal-art.txt`).
