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

## Task 7: the flight’s field on a round planet

### Landed

- `planetField(spec)` in `src/lib/land/flight/field.js` has a round branch first: for a spec with `round`, `heightAt(x, z)` and `biomeAt(x, z)` are `sphereField(spec)`’s, read at `chartOf(spec.round.at, spec.round.radius).toDir(x, z)`. Pits and `step` are the plane’s alone. A spec with no `round` (the fifty, and every spec today but the fixture’s) takes the old path untouched, and `the roster` lock still holds.
- `fieldKey(spec)`: `spec.id` for a plane, `` `${spec.id}@${spec.round.at.join(',')}` `` for a round spec. The terrain worker keeps its fields by it, so one planet landed at two spots never shares a chart.
- `field.test.js` holds a round ice planet to the chart’s middle being the spot, to 2πR coming round to the same ground any way it flies, to finite and within 60 m in 4 m out to three turns, to no step on a metre-by-metre line through the far side, and to its biome being the sphere’s. `mapWorker.test.js` holds the worker to two spots’ different heights.
- A 33 × 33 leaf on a round planet costs about what one on Hoth does in Node (10 to 13 ms against 20 ms, timed while the suite ran).

### Left

- Lane 5b: a leaf’s clutter is seeded by `spec.id` and the leaf’s chart key (`leafMesh.js`), so it’s placed in the chart, not on the sphere. The same ground reached from two landing spots carries different rocks and trees. Nothing shows it within one flight.

## Task 8: generated specs

### Landed

- `src/lib/land/flight/generated.js`: `generatedSpecOf(row, family = familyOf(row.type))`, `groundRadius(row)`, `POI_NAMES`, `clutterOf(family, flora, exotic)` and `chartedAt(spec, dir)`. `planetSpecOf`’s branch for any planet or moon past the fifty now returns `generatedSpecOf`, so a typed `/fly/e:…` flies a round planet in its own colours. The fifty take the same paths as before, and `the roster` lock and `TERRAIN_VERSION` don’t move.
- A generated spec has the fifty’s 17 keys and `ROSTER_EXTRA`’s, and is plain data (a JSON round trip gives it back). A gas or ringed giant is a plane cloud deck, recoloured. Every other planet, and every moon, is round: a radius of 15 to 60 km, its places set on the sphere, and the chart starting at the first place, or at the first dry, gentle candidate where it has none.
- Over 1,180 landable planets from `randomSystems(1500, 7)`, every place kind the variety asked for was set (1,920 of 1,920), and every chart starts on dry, gentle land. A spec takes about 2.3 ms in Node.
- `WATER_LOOKS` moved unchanged into `planetTables.js`, beside `waterColourOf(water, accent)`: the `#rrggbb` a water sheet is drawn in, mixed in linear light with three’s own curves. `water.test.js` holds it to `water.js`’s material, byte for byte, for every one of the fifty with water and for a generated sea. `water.js` draws a spec’s own `water.colour` where it has one. Task 10’s orbit map can read the same helper.
- From Task 6’s “Left”: a seeded ocean is now held by its sea as well as its sand, in the colour `waterColourOf` gives. Four ocean slots give way in `e:1,0:1` and `e:1,0:2`; no planet the generator makes today moves (those systems’ generated planets are a ringed giant, a lava world and an ice world).
- Where it differs from the lane plan:
  - A lava planet’s and an ocean’s ground keep their template’s accent. Their variety accent is the glow and the sea, which drew navy puddles over an ocean’s beaches in the browser.
  - An exotic’s clutter row takes the place of a template row of its kind at its depth, because two such rows are seeded alike in `leafMesh.js` and stand on each other. A glowing or floating planet that already has trees keeps its own.
  - A gas giant gets no exotic clutter. Its only exotic is glowing (Task 6), and a cloud deck has no ground for trees.
  - A moon’s `parent` is read from its canonical id, as Task 5’s branch did, not from `row.parent`. The two agree for every row `moonRowOf` makes.
- In the browser (`/fly/…` on the dev server, software GL), an ocean (`e:3,-2:5:0`), a lava world (`e:3,-2:8:2`), a forest (`e:3,-2:4:0`), a moon (`e:3,-2:1:1:0`) and a gas giant (`e:3,-2:5:4`) each streamed their ground with no page error. The only console errors were the dev server’s 403s on fonts outside the worktree, the same on Hoth.

### Left

- Trees stand in the sea. `leafMesh.js` places clutter with no check of the water level, so a generated forest’s 79 m trunks rise out of the shallows along every coast (seen on `e:3,-2:4:0`). The fifty’s lakes and seas do the same today. A rule in `clutterFor` that only round specs take would leave the fifty alone.
- The flight’s own map (`expanse/flight/mapRules.js`) colours a sea by its own `WATER` table, not by `water.colour`. A generated ocean’s sea there is the kind’s map colour. Task 10’s `groundColour` reads `water.colour`.
- A ground’s `mark` (footprints) and `wet` colours stay the template’s.

## Task 9: life and places from the variety

### Landed

- `expanseLife(type, biomes, system, fauna = null)` in `src/lib/land/flight/lifeTables.js`, and `lifeFor` passes `spec.fauna ?? null`. A generated planet’s own fauna takes the place of its type’s beasts: each plan is a code-built `grazer`, `skimmer` or `strider` in its tint, `0.3 × density` a km², a flyer at 6 to 50 m; a density of 0 walks none. Factions and pirates are as they were. The fifty have `fauna` null and keep their rows, and `the roster` lock holds.
- `src/lib/land/flight/landmarkTables.js`: `POI_KITS` (ruins, wreck, outpost, monolith, signal, each at least `LANDMARK_MIN` things and within 60 m of its middle, the least `r` a generated place has), `landmarkRowsOf(spec, poi)`, `FLORA_TRUNKS` (the four green trees already in the tables) and `EXOTIC_KIT`. `clutterKitOf(spec)` is its type’s kit, then its own, then its flora’s tree (a forest or temperate flora, by `pick`, a pick of 1 clamped to the last), then its exotic’s.
- `src/components/expanse/flight/landmarks.js` stands a POI on `landmarkRowsOf(spec, poi)`, so a generated planet’s places now have their things.
- The flight’s install pack (`src/components/expanse/flight/pack.js`) gains `/kit/space/spaceship.glb` (the wreck) and `/kit/space/tree.glb` (the exotic trees). `landmarkFiles.test.js` holds a generated forest with every kind of place, and each exotic, to the pack at every level.
- Where it differs from the lane plan:
  - `EXOTIC_KIT`’s sizes are 21 (`Tree_Light_1`), 17 (`Tree_Floating_1`) and 5.8 (`Tree_Spikes_2`), not 3, 3 and 1.4. A size is the model’s scale for a row of scale 1 so it stands as tall as the code-built shape it replaces (79 m for a trunk, 26 m for a spire). The plan’s stood a glowing tree 11 m tall on `mid` where `low` draws the code-built one 79 m tall. A test holds each to within a tenth of its shape’s height.
  - `clutterKitOf` gives a gas or ringed giant no exotic kit, as `generated.js` gives a cloud deck no exotic clutter; otherwise a glowing giant would fetch a tree file it never draws.
  - The moon test in `lifeTables.test.js` that held an icy moon to ice’s tauntauns now holds it to its own fauna (that moon’s is a flock of skimmers), as the plan’s change means.
- In the browser (`/fly/…` on the dev server at `mid`, software GL), a generated forest (`e:2,-3:0:1`, a monolith), a glowing desert (`e:2,-3:1:3`, ruins), a spired rock world (`e:2,-3:5:3`, a signal) and a floating ice world (`e:2,-3:8:3`, ruins) each stood their first place with no stand-ins (4 to 9 meshes) and no page error; the console’s only errors were three failed resource loads a page. The forest’s trees came in as the kit’s green trees and the glowing world’s as the kit’s glowing trees. Pictures in `lab/planets/task9/` (not committed).

### Left

- The two new kit files add about 0.68 MB to the flight’s install pack (`spaceship.glb` 187 KB, `tree.glb` 493 KB). `WORLD_MB['/fly']` is measured over the fifty’s landmark files (`landmarkFiles.test.js`), so it doesn’t count a generated planet’s places.
