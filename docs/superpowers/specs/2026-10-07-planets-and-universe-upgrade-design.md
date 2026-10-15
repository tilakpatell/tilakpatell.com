# The planets and the universe, upgraded: the design

Date: 2026-10-07. Written after a pass over every unmerged branch (see "The branches" at the end), the universe handoffs (`HANDOFF-universe.md`, `HANDOFF-universe.md`, `HANDOFF-universe.md`, `HANDOFF-galaxy.md`, `HANDOFF-galaxy.md`) and the research on why other sites look expensive (`docs/research/2026-10-06-why-theirs-look-expensive.md`, on branch `claude/zen-maxwell-k827h7`), and a look at every fandom planet in `scripts/preview/planets.html` and from the Falcon at parking distance.

## Where things stand

The universe map's render pipeline is finished (the visuals lane's eight checkpoints: one light, real air, pitted rock, burning wrecks, a sharp sky as of PR #474). The planets themselves are the weak link now. Looked at from the ship, parked 2.4 radii out, where every visitor sees them:

| Planet | What it reads as | What is wrong |
|---|---|---|
| Middle-earth | a green and brown globe with clouds | The 1024 map is magnified about 2.5× at parking distance, so the coasts and rivers blur. Tolkien's ranges read as smooth sausages (the handoff's "Harad's ranges"). Mordor's wall is a square. The forests are flat green. |
| Breaking Bad | a plain brown ball | New Mexico isn't recognisable: no Rio Grande valley, no Sandias, no white sands, no city grid by day. Low contrast. |
| The Caribbean | a navy ball with white blotches | The islands are noise-shaped, not the Antilles arc; no turquoise shallows, no Cuba, Florida or Yucatán silhouettes to anchor it. |
| The Office | a white faceted snowball | The letterhead is unreadable: the crumples are too many and too small, the logo and ruled lines too faint. |
| C-137 | the show's world, inked | Good. The reference for how a style should land. |
| Dot Matrix | a Game Boy globe | Good. |
| Cybertron | a lit mechanical world | Good, though its 1024 colour map is soft close in. |
| Invincible | a red-veined dark world | Fine. Veins read well; the ground under them is soft. |
| Music, Marvel | gas giants | Fine. Recoloured 4096 maps, so they're sharp. |
| Earth | Earth | Fine. |

Three causes, in order of effect:

1. **Resolution.** Every planet loads its maps up front at lib/detail's level: 1024 on `high`, 2048 only on `ultra` (`planets.js`'s `loadTextures`, `mapFile`). A planet filling 600 screen pixels at parking distance shows about 90° of its surface, which is 256 texels of a 1024 map: 2.3× magnification, and on a 2× screen 4.7×. The handoff's open item 1 ("load each planet's maps only as it comes near") is the fix, and it unlocks 2048 on `high` and 4096 on `ultra` without the 145 MB up-front budget.
2. **Geometry.** The planet sphere is 64 × 40 segments (`buildPlanet`'s `seg`). At parking distance its rim is about 1,900 pixels round, 30 pixels a chord: the limb is visibly polygonal against the air.
3. **The maps' own content.** Breaking Bad, the Caribbean and the Office are not accurate enough to the thing they stand for. The bake kit (`scripts/planets/sphere.mjs`) can draw real geography (Middle-earth proves it); those three never got it.

Beside the planets, two more things hold the universe back:

4. **The landings don't match the maps.** Fly down onto Mordor and you stand on Shire grass (`landings.js`'s one `ground` per planet). The handoff's item 4.
5. **The galaxy's worlds are soft from orbit** (`HANDOFF-galaxy.md`: "procedural noise per pixel, `bodies.js`: a normal or a finer octave for the near view").

## The plan, in three lanes

Three lanes, each its own worktree, branch and PRs, each on files the others never touch. They can run at once.

### Lane 1: the fandom planets, sharp and accurate (`universe/planets.js`, `scripts/planets/`)

**1a. Maps by distance.** `loadTextures` keeps loading the `-sm` or standard set for every planet (what the map shows from afar). New: `nearMaps(u, level)` loads a planet's `-hq` set (and on `ultra` an `-xl` 4096 colour map) when the ship comes within `NEAR = 6` radii, and swaps the material's `map`, `normalMap`, `roughnessMap`, `emissiveMap` and the cloud layer's map in place when they arrive (same UVs, same transforms). At most `RESIDENT = 2` planets hold their near set; the furthest is dropped (`texture.dispose()`) when a third comes near. Loading is through `lib/three/textures.js`'s `loadTexture`, which already decodes off the main thread and caches by URL. Nothing changes on `low`.

**1b. 4096 shipped for `ultra`.** The bakers already bake at 4096 and ship 2048 as `-hq`. Add an `-xl` size (4096, colour map only, q 80) to `sphere.mjs`'s `save` sizes for the seven baked planets. Ship as KTX2 (`scripts/ktx2.mjs convert`, UASTC for colour; `loadTexture` already routes `.ktx2` through the shared loader) so GPU memory stays about a quarter of raw. If KTX2 of a 4096 map comes out over 6 MB, ship WebP instead and say so in the handoff.

**1c. The sphere's segments by distance.** `buildPlanet` makes the body at `[64, 40]`. Add a near geometry at `[160, 100]` (`[96, 60]` on `mid`) made lazily with the near maps, swapped in with them and back out when they go. The air shell and halo already have their own segment counts; leave them.

**1d. The maps, accurate.** Rebake with real geography, each from authored data in the planet's own `.mjs`:
- **Breaking Bad** (`breakingbad.mjs`): New Mexico as the whole visible face, with the Rio Grande from the San Juans to El Paso, the Sandia and Manzano ranges as ridged relief, the Jemez caldera, White Sands as a bright field, the Llano Estacado flat and pale to the east, the Chihuahuan desert's reds south, the Gila's forests south-west, and Albuquerque's grid at the river bend by day (grey-tan blocks, the Big I's cross) as well as at night. Contrast lifted so the valley reads at parking distance.
- **The Caribbean** (`caribbean.mjs`): the Greater and Lesser Antilles as an arc from Cuba to Trinidad, with Florida, the Bahamas' banks (pale turquoise shallows, the real reason the sea there is two colours), Hispaniola, Jamaica, Puerto Rico and the Yucatán at their real shapes (hand-traced polygons in a `caribbean-geo.mjs`, on the kit's `curve`), reefs as light rims, Tortuga and Isla de Muerta where the films put them, the hurricane kept.
- **The Office** (`office.mjs`): the letterhead readable: "Dunder Mifflin Paper Company, Inc." and the Scranton address at a size that reads at parking distance (the sheet's title about a sixth of the sphere's height), the ruled lines, a coffee ring, a "World's Best Boss" mug stain, a few big crumples (6 to 10, not dozens), and the faceted geometry kept inside the sphere.
- **Middle-earth** (`middleearth-geo.mjs`): Harad's ranges as two or three offset ridged strokes each (handoff item 2); Ephel Dúath's bend with more points (item 3); forests as a canopy texture (dark green cells with a lighter edge) not flat fill; the relief normal map's strength doubled on the `-hq` set.

Each rebake is checked in `scripts/preview/planets.html` at `dist=2.4` (parking distance) and a screenshot of each goes in the PR.

**1e. Evidence.** `scripts/universe-check.mjs` poses `rickmorty`, `gaming`, `caribbean` already exist; add `middleearth`, `breakingbad`, `office` poses at `dist: 2.4` and run the three tiers against the baseline in `lab/universe/baseline/`. Budget: at most +40 draw calls and +0.35 M triangles on `high` at a planet pose (the near geometry), nothing on `low`.

### Lane 2: the galaxy's worlds from orbit, and the ship and NPC pace (`galaxy/bodies.js`, `bodyShaders.js`; the `claude/universe-ship-pace` branch)

**2a. Finish `claude/universe-ship-pace`.** It's the second PR of the lane that landed PR #474 (26 files, hunters, NPCs and traffic flying at the ship's new pace), written before PR 1's fixes. Rebase it on `origin/main`, make its tests pass, check a dogfight in a browser (`scripts/universe-check.mjs`'s poses, a hunt set off with `window.__universe().pose`) and merge it. Do this first: it unblocks everything that touches `universe/ship.js`.

**2b. The galaxy's planets, sharp from orbit.** In `bodyShaders.js` the surface is fbm per pixel with octaves by footprint. From orbit (the body 300 to 900 pixels tall) the footprint allows more octaves than the shader's cap gives it. Raise the cap on `high` and `ultra` by two octaves when the body's screen height is over 300 pixels, and add a normal from the height field's analytic finite difference (two extra fbm taps, only in that near band) so the terrain catches the sun from orbit the way the fandom planets' normal maps do. Not on `low`, not on water. Evidence: `scripts/galaxy-check.mjs` at Tatooine, Hoth and Endor parked; frame time within 1 ms of before on `high`.

**2c. Three more universe events** (`HANDOFF-universe.md`'s "Steps left" 3 to 5): a minefield across a lane (shoot or weave), an escort (a freighter asks to be seen to the next place; pirates come), an eclipse (a planet crossing the sun, the key light dimming through it); a rift's exit prefers places you haven't seen (`state.saw`); the leviathans' `busy` drops once the pod is past the ship. Each is a `director.js` kind with its `happen()` in `scene.js`, the rules pure and tested.

### Lane 3: the landings match the maps (`universe/landings/`)

**3a. A biome per landing spot.** `landings.js` gets, per planet, `biomes`: a list of `{ id, match, ground, sky, scatter }` where `match` is a colour class on the planet's own `-sm` colour map (sampled in a canvas at the entry spot's UV: `entry.js`'s `entrySpot` gives the point on the sphere, `toUv` from `sphere.mjs`'s inverse is three lines in `foot.js`). `biomeAt(planetId, point) -> biome` is pure and tested with a stub sampler. The first biome whose match holds wins, the last is the fallback (today's one ground).
- Middle-earth: Shire grass (greens), Mordor ash (dark greys, the glow), Harad sand (tans), the Misty Mountains' rock (greys with snow), sea (blues: the spot moves to the nearest land, `entrySpot`'s "leaned toward the day" already moves it; add "toward land").
- Breaking Bad: the desert (reds and tans), the city grid (greys: the landing furnishes the ABQ lot), the mountains, the white sands.
- The Caribbean: a beach (always land: a sea spot moves to the nearest island), a reef flat, Tortuga's town.
- Invincible, C-137, Earth: two biomes each (city and country; the show's purple hills and its teal lakes; land and ice).

**3b. The landing's ground and sky take the biome.** `furnish.js` and `ground.js` read `biome.ground` and `biome.sky` in place of the planet's; the scatter list is the biome's. The day's sky still moves with the sun (`sky.js`).

**3c. Evidence.** `node scripts/landing-check.mjs middleearth` with three forced spots (a `?spot=lat,lon` DEV query on the landing) and a screenshot each: Shire green, Mordor ash under a red glow, Harad sand.

## Not in this round

- WebGPU (PR #371's design): the pipeline is finished on WebGL 2 and the research says engine speed isn't the problem.
- The house material across every world (the research's item 1): a cross-site lane of its own.
- New planets or moons: the map has its places; make the ones there true first.

## The branches

Unmerged branches that touch the universe or the galaxy, and what this design does with them:

| Branch | What it is | Here |
|---|---|---|
| `claude/universe-sharp-sky` (PR #474) | sharp sky, no wall round places | merged 2026-10-07 |
| `claude/universe-ship-pace` (local) | WIP, hunters and NPCs at the new pace | Lane 2a finishes it |
| `claude/galaxy-solid-ships` (PR #413) | solid Star Destroyers, a softer picture, every crew armed | independent; merge on its own |
| `claude/sharp-carson-h9c6mp` (PR #383) | Varykino's cypresses, Mustafar's rock, undergrowth patches | independent; merge on its own |
| `claude/happy-clarke-uahdd1` (PR #469) | Scarif, Endor, Geonosis: the look, the Death Stars, the war | independent; merge on its own |
| `claude/festive-meitner-ctyhqf` (PR #453) | Kashyyyk battle, 3D portal jump | independent |
| `claude/eloquent-darwin-foskak` | Meshy landmarks and crew for the galaxy's worlds | independent |
| `claude/three-worlds-plan-9dc25b`, `inspiring-cerf-3q8ufe` | three galaxy worlds, Bruno's grass, one wind | independent; the house-material lane's ancestor |
| `claude/inspiring-bell-ikse2c`, `vigilant-meitner-ju253t` | the rack: the same guns everywhere | independent |
| `claude/galaxy-perf-task11-wip` | near shadow casters and zones | `HANDOFF-galaxy.md` item 2; untouched here |
| `claude/webgpu-3d-graphics-6r6ufb` (draft #371) | the WebGPU design | not this round |
| `claude/zen-maxwell-k827h7`, `weather-research` (draft #335) | research only | read; cited |
| `claude/gpu-detail-quality`, `wip/*` | WIP dumps | ignored |
