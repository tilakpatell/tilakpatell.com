# Endless universe, lane 5a: notes for the hand-off

The coordinator folds these into `docs/superpowers/HANDOFF-universe.md`. This lane doesn’t edit that file.

## Task 6: the variety

What `src/lib/land/flight/variety.js` gives Tasks 8 to 13, where it differs from the lane plan.

### Landed

- `varietyOf(row)`, `FAMILIES`, `SLOT_JITTER`, `colourDistance` and `dominantOf`, to the plan, and `paletteOf(family, [h°, l], r)`: the palette drawn round a colour, its saturation and the rest from `r`.
- The sibling guarantee is on the colours a visitor sees. `dominant` is read back from the palette, `dominantOf(palette, an ocean’s water)`, as the plan defines it. The palette is drawn round the slot nudged by up to `SLOT_JITTER`. `low` is `hsl(h − 3, s, l − 0.05)` and `high` is whatever makes the mix of the two the aim, to the half step a mix of two `#rrggbb`s can hit, so it comes out near `hsl(h + 3, s, l + 0.05)`. The plan had `high` at `hsl(h + 6, 0.9s, l + 0.05)`, whose mix leans off the slot. Where rounding would carry the mix past the jitter, the palette is drawn round the slot’s own colour (about 2 % of planets), which a test holds inside the jitter at every saturation each family draws.
- So siblings are at least 1 apart by `colourDistance` in what’s drawn, and a generated planet at least 1 + jitter from a seeded sibling’s template. Over `randomSystems(30000, 11)`’s 59,929 sibling pairs the nearest is 1.17. Before this, with the guarantee on the jittered slot only, 3 pairs of pale ice planets met under 1 in what was drawn, the nearest 0.70, and the drawn hue drifted up to 9.2° off the slot.
- Ice’s saturation floor is 0.25 (was 0.15) and gas’s 0.3 (was 0.25), so a pale slot’s hue survives `#rrggbb`. The other families keep the plan’s.
- A gas or ringed giant’s only exotic is `'glowing'`. It’s rare as often as any planet, from the same draws of the exotic stream; crystals, floating islands and spires need ground.
- `varietyOf` gives null for a row whose seed isn’t a whole number (a string of digits, a whole number or a bigint), as for a type no family knows. Every `rowOf` and `moonRowOf` row has one.
- Each aspect’s salt is its own across the flight’s lib: the sky’s was `sphereField.js`’s hills’, and a test now reads every `SALT` table under `src/lib/land/flight/`.
- `variety.test.js` has 19 tests: the plan’s 7, 7 more with the first commit and 5 with the review’s fixes (each slot’s colour through `#rrggbb`, siblings in the colours drawn, a seeded system’s planets given slots of their own, the gas giant’s exotic and the salts).

### Left

- Task 8: a seeded ocean’s template colour is its sand’s mix, `[45°, 0.93]`. A generated ocean is held by its water, though, and the seeded ocean’s sea (`#1f5a6e` moved 0.15 toward its accent, about `[190°, 0.31]`) sits within 1 + 2·jitter of three ocean slots. None is kept out of `e:1,0:1` or `e:1,0:2`, so a generated ocean there could sit about 0.3 from the seeded one’s water. Nothing shows it today: those systems’ generated planets are a ringed giant, a lava world and an ice world. Once Task 8 moves `WATER_LOOKS` into `planetTables.js`, read the seeded ocean’s `TEMPLATE` as `dominantOf(palette, { colour })` with that sea’s colour, mixed as `water.js` mixes it.
- Task 8: `exotic` is only ever `'glowing'` or null on a gas giant, so the crystal and spire clutter rows never land on a cloud deck. Glowing still adds its trunk row, which a gas giant never lands to see.
