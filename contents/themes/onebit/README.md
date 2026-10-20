# 1-Bit

Two colours, nothing else: warm paper `#f3ead3` and deep ink `#141a2e`. Every texel of every texture is
one of them (or transparent); there are no blends, no opacity, no filtering. `tests/onebit-theme.test.js`
checks that for each PNG.

## Principles applied

- **Texel grid.** The scene is 360 texels tall and scaled by a whole number of device pixels (3 px per texel
  at 1080p, never fewer than 2), nearest-neighbour. Sprites, water, specks and shaft dots all sit on the same
  grid; positions are rounded to whole texels. Huge configured fish sizes use a 2x magnification, never a
  fractional scale.
- **Silhouette and line weight.** One-texel outline on everything, in the opposite tone to the fill (ink around
  paper creatures, paper around ink ones), so a sprite reads on bright and on dark water and the weight never
  changes. Each kind is told apart by outline alone: fish (oval, forked tail), anglerfish (round head, open toothy
  mouth, stalk), orca (tall fin, belly line, eye patch), jelly (dome, trailing strands), worm (squiggle), bubble (ring).
- **Pattern, not colour.** The five fish variants: stripes, spots, plain (gill line), outline (hollow, paper rim
  between two ink lines) and checker. Five size classes (mote, baby, small, mid, large) keep detail honest:
  the tiny ones only carry one telling mark.
- **Tone by dither.** The water is a blue-noise stipple (16x16 void-and-cluster matrix, cut into 8-texel bands
  at 65 densities, so there is no banding and no grid artefacts). The density follows a logistic ramp so the busy
  mid-tones are crossed quickly: calm bright haze up top, calm dark water below. Light shafts are paper dots
  from the same matrix, aligned to its lattice so they merge with the water. Sprite shading uses hand-placed
  patterns and small Bayer patches (belly dither, jelly bell, lure glow).
- **Negative space.** Few ambient things: five shafts, eight kelp, one wave line, fourteen one-texel specks, a
  seabed with rocks and a starfish. Specks switch tone with the water behind them.
- **Few-frame animation.** Fish, orca, angler: 4 tail frames driven by speed. Jelly: 4 pulse frames from the
  simulation's wobble phase. Worm: 4 wiggle frames, dissolving through two dither densities as it dies instead of
  fading. Ambience steps about 5 times a second from one timer (kelp 3 frames, the wave line scrolls a texel at a
  time, shafts breathe between two densities). Nothing moves while the wallpaper is paused.
- **Stress in 1-bit language** (fish only). From stress 0.25 a growing share of the fish is inverted (ink body,
  paper outline and pattern); from 0.5 they shake by a texel; above 1.2 every fish blinks between normal and
  inverted at about 1.4 Hz, half of them in antiphase, so small areas change and never the whole screen.
- **Babies** use the small size classes and twinkle with a two-frame sparkle while they spiral out.
- **Day and night** only move the water density (and the shaft strength): the palette never changes.

## Files

`theme.js` (descriptor: sizes, classes, water ramp), `sync.js` (adapter), `Scene.qml`, `Ambient.qml`,
`EntityLayer.qml` (pool), `OneBitSprite.qml`, `img/` (generated: `node tools/gen-onebit-theme.js`,
`--sheet out.png` for an 8x contact sheet, `--check` to verify), `preview.png` (480x270, 1 px per texel).
