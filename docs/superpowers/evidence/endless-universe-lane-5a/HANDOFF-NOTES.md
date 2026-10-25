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

## Task 10: the orbit map

### Landed

- `src/lib/land/flight/orbitMap.js`: `ORBIT_MAP_SIZE`, `orbitMapSize(tier)` (mid’s for a tier it doesn’t know), `PLANE_WINDOW = 40000`, `groundColour(spec, { h, slope }) → { rgb, water }` and `bakeOrbitMap(spec, { width, height }) → { width, height, rgba, biome }`, to the plan. The rule is `groundLook.js`’s at the mean of its noises, mixed in linear light and written as sRGB bytes; the water is `water.js`’s sheet over it. A round planet reads `sphereField(spec).sample`, a gas or ringed giant is banded, and any other plane is a window of its plane round the flight’s start.
- `orbitMap.test.js` holds each texel of four generated planets to `planetField(chartedAt(spec, dir))` at the chart’s middle, byte for byte (colour, alpha and biome), as the plan asks. It also holds the seeded thirteen’s and the named worlds’ texels to their plane’s window, the same way.
- `planetTables.js` now exports three’s sRGB curves, `linearOf(hex)` and `byteOf(linear)`, and `waterLinearOf(water, accent)`: the sheet’s colour in linear light. `waterColourOf` is that colour written as bytes, unchanged, and `water.test.js` still holds it to `water.js`.
- Where it differs from the lane plan:
  - A gas giant’s band count is drawn from its own salt (`SALT.bands`). Its noise is `noise3For(seed, …)`, as the plan has it. Its colours are `spec.palette`’s: a generated giant’s variety, or Bespin’s own. A cloud deck’s ground palette has no accent for the storms.
  - The water’s colour is mixed in floats, as `water.js`’s material holds it. It isn’t rounded to `waterColourOf`’s `#rrggbb` first.
  - `bakeOrbitMap` gives null for no spec. A size that isn’t a whole number from 1 to 4,096 falls back to 256 × 128, so a bad ask never throws.
- Timings are from Node, taken while other lanes’ browsers ran. A round planet takes 0.8 to 1.2 s at 256 × 128 and 3.3 to 3.8 s at 512 × 256. A plane window takes 0.5 to 0.9 s and 1.7 to 3.3 s. A gas giant takes 0.1 s and 0.3 to 0.4 s. Pictures are in `lab/planets/task10/` (not committed).

### Left

- The map is point-sampled, as the plan’s texel test asks: a texel is the ground at its middle, its slope read over 8 m. A texel spans 180 to 740 m at the equator, so on rough ground the rock colour lands on scattered texels.
  - It shows as salt and pepper over the map: 11.5 % of a ridged rock world’s texels and 6.6 % of a mesa desert’s. On Hoth’s window it shows as thin lines along the ridges.
  - It is the ground’s colour at those points, but it is aliasing. Lane 5b could mip or blur the texture. Or a later change could average the slope over the texel, though that would end the exact texel test on purpose.
- The accent mixes in at `accentCover × 0.5`, an area mean, as the plan asks. At the mean of its noises the shader draws no accent at all: its patches need the noise above 1 − cover.
- A 512 × 256 bake takes about 3.5 s. Task 11’s worker keeps that off the main thread, but on `high` a planet waits that long for its first map.
- Scarif’s window is almost all sea (99.8 % of texels under water). Its islands sit in a sea 40 km wide round the flight’s start.

## Task 11: the bake in a worker, cached in memory

### Landed

- `src/lib/land/flight/orbitMap.worker.js`: given `{ key, spec, width, height }`, it answers `{ key, width, height, rgba, biome }` with both buffers transferred, and ignores `{ type: 'cancel' }`.
- `src/lib/land/flight/orbitMaps.js`: `ORBIT_WORKER = 'flight-orbit-map'`, `makeOrbitWorker()` and `createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) → { get(spec, tier), peek(spec, tier), stats(), dispose() }`, to the plan. Lane 5b calls `createOrbitMaps({ workers: rt.workers })` once and `get(planetSpecOf(id), tier)`; it answers `{ width, height, rgba, biome }`, the same shape as `bakeOrbitMap`, or null.
  - A map is keyed `${spec.id}:${width}x${height}`, so `low` and `mid` share one. A chart (`chartedAt`) doesn’t change the key: the map is the whole sphere’s, and `sphereField` doesn’t read `round.at`.
  - Two asks at once share one bake. It keeps the 16 most recently used, and an ask served from memory or a `peek` counts as a use.
  - It writes nothing anywhere. A test reads `orbitMaps.js`, `orbitMap.js` and the worker for `localStorage`, `indexedDB`, `rt.store` and `rt.saves`.
- In Chromium on the dev server (software GL, the page’s real pool and a real module worker), an ocean (`e:3,-2:5:0`) took 1.0 to 1.4 s at 256 × 128, two asks at once shared one bake, and `low` was served from memory. A lava world, Hoth’s plane window and a gas giant took 1.7 to 2.1 s together, and the ocean at 512 × 256 took 3.1 to 4.2 s. Over those seconds the page’s longest gap between frames was 120 to 580 ms (the container was busy with other browsers), never the length of a bake, so the bake is off the main thread. `dispose()` left the pool with no group and the cache empty. There were no page errors. Picture in `lab/orbit-check/` (not committed).
- Where it differs from the lane plan:
  - A bake the worker can’t make (no spec, or a ground that throws) is answered with `{ key }` alone, and the worker lives on. Without that a throw would end the worker through the pool’s `onerror`.
  - `get` never throws or rejects. A missing spec or id, a pool whose `request` throws or rejects, an answer with no map, or an ask after `dispose` each give null. A map that lands after `dispose` isn’t kept.

### Left

- Nothing imports `orbitMaps.js` yet, so `npm run build` doesn’t bundle the worker. It’s the same `new Worker(new URL(…, import.meta.url), { type: 'module' })` form the terrain worker builds with. Lane 5b’s first import of it should be checked in a production build.
- There’s no `cancel`. A planet that leaves view keeps its bake going, and with one worker the next planet waits behind it. With a 512 × 256 bake taking about 3.5 s, lane 5b may want `get` to pass a priority, or a `cancel(spec, tier)` that calls the pool’s.

## Task 12: worlds you can’t build on

### Landed

- `src/components/expanse/flight/shared.js` reads `readOnly = spec.buildable === false`. On such a world (every planet and moon past the fifty, as `generated.js` sets it) the shared world never reaches the durable world: no client (not the dev hook either), no loader, no sign-in, no read or write.
  - B toasts “Nothing can be built on this world.” and places nothing, not even a turret of the visit’s own. It says so on a generated cloud deck too, before the cloud deck’s own line.
  - `prompt()` gives `build: false`, `unbuild: false` and `kept: false`, so the HUD offers neither B nor X. X, pressed anyway, finds none of yours.
  - The room (poses, shots, the hints) works as before.
  - A spec with no `buildable` key, as the tests’ hand-made ones, and the fifty’s `buildable: true` are as they were.
- `shared.test.js` has 5 new tests: the plan’s 3 (the first run with and without a durable layer, the second also holding that no loader is made and no sign-in asked), a generated cloud deck, and X with nothing to take down. Every existing test is unchanged.
- `docs/architecture.md`’s durable-world section says a planet nothing may be built on has the room alone.
- In Chromium on the dev server (`/fly/…` at `low`, software GL), with `scripts/lib/fake-durable.mjs`’s hook attached and every call through it counted:
  - On a generated forest (`e:3,-2:4:0`), held 20 m over its ground 1 km out and clear of its places, B pressed as a visitor presses it made no call through the hook at all, not even for a sign-in. B toasted the sentence, nothing was placed or held, and the prompt read `build: false, unbuild: false, kept: false`. There was no page error.
  - On Hoth, the control, the same hook signed in, read cells and took the insert, and B toasted “Turret built.”. Pictures are in `lab/planets/task12/` (not committed).

### Left

- X on a world nothing may be built on says “None of yours within 30 m.”: true, but it’s the general line. The HUD never offers X there, so only a visitor who knows the key sees it.
- `prompt().kept` is sent four times a second, but nothing in `Fly.jsx` or `FlightHud.jsx` reads it. A visitor learns that a world keeps nothing when they press B, not before.
- For browser checks: with this container’s Chromium (`chromium-1243`), `--use-gl=swiftshader` (the flags `scripts/online-check.mjs` launches with) left `/fly/hoth` at “Coming down over Hoth…” for 15 minutes. `autopilot-check.mjs`’s `--use-angle=swiftshader --enable-unsafe-swiftshader` brought the flight on in 8 s. `online-check.mjs --fly` itself wasn’t run here.

## Task 13: the contact sheet

### Landed

- `scripts/planet-contact-sheet.mjs`: `node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--out lab/planets/contact]`, to the plan. It writes `n-orbit.png` (the map at 512 × 256), `n-ground.png` (the chart’s middle 3 km at 8 m a pixel, lit from the north-west 40° up), `sheet.png` (six to a row, each orbit map at 384 × 192 over its ground, captioned) and `index.json`. It prints `lab/planets/contact: 24 planets`, and exits 1 when it finds fewer than it was asked for. 24 planets took 2 min 34 s here: 5 to 8 s a planet, after about 18 s for Vite to start.
- `--system E:sx,sz:i` lays out one system’s planets that land, in its order.
- The draw, the light and the arguments (`KEEP`, `drawPlanets`, `systemPlanets`, `SUN`, `lightOf`, `argsOf`) are exported and tested in `scripts/planet-contact-sheet.test.mjs`: 12 tests on fake sectors, under a second.
- `ISLAND.files` lists the script and its test, so they go when the flight goes. `node scripts/flight-island.mjs --check` says ok, with 172 files on the island.
- Where it differs from the lane plan:
  - `--system` isn’t in the plan. A draw over about 3,700 sectors put no two planets of one system on the sheet. The plan’s first check needs siblings side by side, so they’re laid out on purpose.
  - The orbit PNGs are written opaque. The map’s alpha is 0 under the water, which would hide the sea’s colour; the colour under it is the water’s.
  - The light multiplies the colour in linear light, not the sRGB bytes.
  - The test file isn’t in the plan’s file table.
- The plan’s four checks, on the default draw (8 rock, 7 ice, 4 desert, 3 forest, 1 lava, 1 ocean; one exotic, a crystal ice world), and on two systems’ sheets, `E:7,7:14` (six ice and an ocean) and `E:-5,-8:6` (six rock). Nothing needed tuning.
  1. No two siblings read as one planet recoloured. Each has its own land shapes and its own hue.
  2. Every map shows land. The forest, ocean and lava worlds show their sea or lava, over 21 to 60 % of their texels. Rock, ice and desert worlds have no sea by type.
  3. No ground is a flat plane. Once each window’s best-fit plane is taken out, 34 to 803 m of relief is left (a standard deviation of 5 to 161 m).
  4. The orbit map’s colours are the ground’s. Over each 3 km window, the mean of the map’s texels and the mean of the ground’s own colours are within 5 of 255 on every channel, and within 2 on 23 of the 24.
- Pictures are in `lab/planets/contact/`, `lab/planets/system-ice/` and `lab/planets/system-rock/` (not committed).

### Left

- The palest ice siblings (`E:7,7:14`’s third, sixth and seventh) are near white. They keep the variety’s guaranteed colour distance, but at that lightness a hue gap barely shows. A lower lightness for some of ice’s slots would make the guarantee visible.
- Siblings of one family and one character share a recipe. `E:-5,-8:6`’s three rock canyon worlds differ in shape and colour but read as one kind of place. More characters per family would widen that.
- A planet’s chart starts at a gentle spot, so a ground tile shows the plain round its first place. The ice continents and the plateaus look smooth at 8 m a pixel under this light, with 34 to 177 m of rolling relief over 3 km. The flight’s own light, detail and clutter show more of it.
- `node scripts/stack-census.mjs --check` was already stale on `main`. This script adds one more importer of `sharp` for the census’s next write.

## Task 14: verification and pictures

### Landed

- `docs/superpowers/evidence/endless-universe-lane-5a/README.md`: the before and after of `/fly/hoth`, `/fly/e:3,-2:1:0` (Zurktar, the first rock planet of sector (3, −2), as the plan names it) and `/fly/e:3,-2:1:1` (Trigkre, the next, which has a place ahead of its spawn), with the numbers, and Task 13’s contact sheet. Before is `main` at cc5e2eaf; after is the lane’s head. Pictures are webp, 19 to 141 kB.
- `/fly/hoth` is the same. Held still at its spawn, the lane’s first shot is pixel for pixel `main`’s first two (0 pixels differ, canvas and whole page). It draws 188 to 189 calls on both sides, and 540,928 to 540,996 triangles on `main` (three runs) against 540,928 to 541,144 on the lane (two runs). The ground’s 166 meshes, Echo Base, the trench, the sky and the ship hash alike; only the life, the events and the ion cannon change from run to run, on both sides, by 17 to 18 pixels.
- The two generated planets change on purpose: round, in their own colours, with their own fauna. Zurktar draws 81 calls and 1,041,344 triangles (81 to 82 and 1.10 M on `main`). Trigkre draws 91 calls and 723,398 triangles (79 and 1,060,606 on `main`).
- The gates on the lane’s head:
  - `npm run lint`: clean.
  - `npm test`: every file green, in three goes. The whole run took 44 minutes at a load of 20 to 34 on four cores (`main`’s baseline took 11): 1,887 files passed, and 74 failed on time alone: each of their 119 tests timed out or missed a time budget. One is the flight’s (`ground.test.js`’s first crash test, 5,079 ms against 5,000), and it passed when run again; the rest are other worlds’. Run again together, 47 of the 74 passed; the other 27 passed one file at a time (857 tests). `the roster`, `TERRAIN_VERSION`, `planets.test.js` and `stack.test.js` passed in the whole run, and again on their own.
  - `npm run build`: built. Its `prebuild` rewrote a line of `public/github.json`, which was put back, not being the lane’s.
  - `node scripts/health.mjs --check --skip build`: within budget, every metric as on `main`.
  - `node scripts/flight-island.mjs --check`: `ok 172 files on the island, 39 marked rows, 62 references`.
  - `node scripts/autopilot-check.mjs --only smoke --quality mid --routes /fly/hoth,/fly/e:3%2C-2:1:0,/fly/e:3%2C-2:1:1`: the three flights ok in 13 to 15 s, and the eight flat core pages ok. `/` was “no canvas: the 3D never started” at 103 s, twice. Lane 6a’s evidence finds the same on `main`’s build in this container today: the canvas comes after the check’s 90 s. Nothing on `/`’s way to its canvas changed in this lane; the one module of the lane’s it reaches is `worlds/packs.js`’s flight pack, a list of files, two longer.
- Where it differs from the lane plan:
  - The pictures and counts are of a flight held still (the governor held, the ship at its spawn, every step at `dt` 0, the ground streamed in), not the smoke’s shot after 8 s of flying. A flight left to fly in this container never drew the same frame twice. The method is in the README; the script that ran it was a scratch file, not committed (the task makes no new file).
  - `autopilot-check.mjs --only smoke` wasn’t run on `main`: it serves a `dist/`, `main`’s checkout has none, and a 1.6 GB build didn’t fit the container’s disk. The held-still runs on `main`’s dev server stand for it on the two fly routes: no page error and no console error outside the noise list. The after smoke ran as written, on the lane’s build.
  - An id’s comma is written `%2C` in `--routes` (`/fly/e:3%2C-2:1:0`), because the script splits that list on commas; the router decodes it.
  - Browser checks at `mid` only, by the coordinator’s budget. No pull request: the coordinator opens one for every lane.

### Left

- Trigkre draws 12 more calls than on `main`, so “draw calls no higher at any checked route” doesn’t hold on a generated planet with a place in view. 8 are its signal, a place it didn’t have; 2 are the events, which vary from run to run. Its triangles fall by a third. Whether a place may cost its calls is the owner’s call.
- A generated planet with a place and its own fauna has 15 to 16 shader programs where `main`’s template had 12. `late pipelines` was measured on Hoth only (4 on both sides). Lane 5b could run `FLY=e:3,-2:1:1 node scripts/perf-probe.mjs fly` to see whether those compile mid-flight.
- `perf-probe.mjs fly`’s phase counts don’t compare in this container: frames of 30 to 130 s stalled both runs, so the ship flew a different path each time. The probe wants a real graphics chip, before and after.
- Even held still, Hoth moves by 17 to 18 pixels from run to run: the life (`life.js` draws with `Math.random`) and the events (the wall clock) aren’t held. A pixel check of the flight should hide `flight-life` and `flight-occurrences`, or seed them.

## For lane 5b: what this lane hands over

What was built, where it differs from the plan’s list.

- **Planet spec fields.**
  - Every spec has `kind` (`'planet'` or `'moon'`), `parent` (a moon’s planet id, or null), `buildable`, `round`, `character`, `sky`, `weather`, `flora`, `fauna` and `exotic`, beside today’s 17. The fifty have `ROSTER_EXTRA`’s fixed values (`planetSpec.js`).
  - `round` is `{ radius, at }` on every generated planet and moon that isn’t a gas or ringed giant (radius 15,000 to 60,000 m), and null on the fifty and on gas giants. A gas giant’s spec is a plane cloud deck (`soft: true`), recoloured.
  - `character` is `{ kind, sea, peaks }`, kind one of `characters.js`’s `CHARACTERS`, or null.
  - `sky` is `{ low, high, haze, clouds, cloudColour, rings, moons }`: the orbit shader’s atmosphere and clouds. `fog` is set from the haze.
  - `weather` is `{ kind, amount }`. `flora` is `{ family (lib/land/flora.js’s floraFor key), density, pick }` or null. `fauna` is `{ density, plans: [{ body, role, tint, group }] }` or null. `exotic` is null, `'crystal'`, `'glowing'`, `'floating'` or `'spires'`.
  - A generated spec is plain data (a JSON round trip gives it back) and `buildable: false`.
- **Landing at a spot.** `chartedAt(planetSpecOf(id), dirOfLatLon(lat, lon))` (`generated.js`, `sphere.js`) gives the spec whose chart origin, `(0, 0)` in the flight, is the spot dived at, its places charted round it. It gives the spec back unchanged for a spec that isn’t round or a direction that isn’t one.
- **Charts and directions** (`sphere.js`).
  - `chartOf(at, radius)` → `{ at, radius, frame, toDir(x, z), toChart(dir) }`, chart +x east and −z north. `toChart` reads back inside the first turn (under πR) and the far side as `[πR, 0]`. Take-off back to orbit reads the ship’s `(x, z)` through `toDir`.
  - `latLonOfDir`, `dirOfLatLon`, `uvOfDir`, `dirOfUv`, `frameAt`, `unit` and `angleBetween`, on `landings/biomes.js`’s layout.
- **The ground.** `sphereField(spec)` → `{ heightAt(dir), biomeAt(dir), climateAt(dir), sample(dir) → { h, slope, biome } }`. `planetField(spec)` is unchanged in shape, and the terrain worker keys fields by `fieldKey(spec)` (`id@at` for a round spec).
- **The orbit map.**
  - `bakeOrbitMap(spec, { width, height })` → `{ width, height, rgba (sRGB, alpha 0 under water), biome }`, or null with no spec (`orbitMap.js`).
  - `createOrbitMaps({ workers: rt.workers })` → `{ get(spec, tier), peek(spec, tier), stats(), dispose() }` (`orbitMaps.js`). `get` makes the map in a worker, keeps the 16 last used in memory, and gives the same shape or null; it never throws. `orbitMapSize(tier)` gives the size: 256 × 128 on `low` and `mid`, 512 × 256 on `high` and `ultra`.
  - The texture is sRGB, laid as three’s `SphereGeometry` lays it. A gas giant’s is banded; the fifty’s are a 40 km window of their plane.
  - Nothing imports `orbitMaps.js` yet: lane 5b’s first import should be checked in a production build.
- **Places and life.** `landmarkRowsOf(spec, poi)` (`landmarkTables.js`) stands a generated place; `POI_NAMES` names its kind. `expanseLife(type, biomes, system, fauna)` walks a spec’s own fauna.
- **The read-only flag.** `spec.buildable === false` turns the shared world read-only (`shared.js`): no sign-in, no read or write, B answers with a sentence.
- **Islands.** The universe importing `lib/land/flight/*` counts as an island reference: lane 5b marks those rows `// planet flight` and lists the files in `ISLAND.rows`.
