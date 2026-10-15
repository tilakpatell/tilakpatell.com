# Kit worlds: the Quaternius packs as one site-wide kit, Bruno Simon's living layer on it, planets as data, crowds baked. The design

Date: 2026-10-08. Status: design, written from the owner's brief by an architecting session, for an implementation session (phases in order, one pull request each). The plan is `docs/superpowers/plans/2026-10-08-kit-worlds.md`; the hand-off is `docs/superpowers/HANDOFF-worlds.md`; the reading behind it is `docs/research/2026-10-08-folio-2025-assets-foliage-and-quaternius-packs.md` (his assets, his GPU foliage, the packs, every number) and `docs/research/2026-10-08-site-planets-generation-rigging-today.md` (where the site is).

## What the owner asked

"Go through Bruno Simon's page (folio-2025) and see how he uses his assets and how he renders his things so smoothly like leaves and stuff. Go through both repos with the new assets. Look at how we can improve all the planets, generation, and other things with the assets and rigging. Architect how we can implement this site wide."

Four things, then: his asset pipeline and his foliage; the nine Quaternius packs now in `tilakpatell/tilakverse-assets`; the planets, the generation of worlds, and the rigging; and one architecture for all of it that every world can take.

## What he does (the short version; the research note has the long one)

1. **One material, one look.** Every lit thing in his world is one `MeshDefaultMaterial` (a Lambert node material): shade is a colour (`lighting.shadowColor` from the day cycle, never grey), the underside of everything takes the ground's colour from one terrain data texture (`lightBounceDistance 1.5` m, squared falloff), fog is the sky's radial gradient, a white waterline ring, a reveal ring. Per-object variants are feature flags on that one material. The palette is a 128×4 PNG of 24 swatches; every palette face's UV is collapsed to a swatch centre; every GLB material named `palette` is swapped by name for the one runtime palette material (`Materials.getFromName`). Programs: a handful for the whole site.
2. **References, Visual, Physical.** A `*References.glb` is a list of transforms (empties with a tiny mesh); a `*Visual.glb` is one prototype; the runtime makes one `InstancedMesh` per prototype part for all the references (`InstancedGroup`: `finalMatrix = localMatrix × reference.matrixWorld`, refreshed only for references flagged dirty). Props that can move (benches, bricks) are N copies in one GLB, copy 0 the base, colliders read once, one rigid body per copy, one instanced draw. Nothing is disposed; things sleep, hide, or reset.
3. **The living layer, on the GPU, all wrapped round one focus.** The view's "optimal area" (the screen's corners raycast to the ground once per resize, plus the smoothed focus point) gives one tile, `size = radius × 2`, and every field wraps round it with the same `mod()`: 78,400 grass blades as one triangle soup (coloured as the ground under them, facing the camera, wind at the tips); 2048 falling leaves as a compute particle sim (vehicle push, perlin-gated wind, one-frame explosion impulse, lift from horizontal speed, damping by the terrain's water channel, gravity × weight, floor and water clamp, toroidal wrap); 2048 rain lines; a 256² snow quad grid whose elevation is rendered into a target each frame; four wind ribbons. Tree crowns are 80 cards of 0.8 m in a unit sphere, normals lerped 85 % toward the sphere, cut out by a 128² SDF blob texture whose UV the wind rotates, two-tone by `n·l`, a see-through hole round the car; trunks instanced; shadow lookups pushed toward the light and masked by the same SDF. Wind is two scrolling perlin octaves, one function shared by grass, flowers, foliage, ripples and leaves. Weather is sums of sines on a 4-minute day; every visual knob is a debug binding whose automatic getter maps weather to a uniform.
4. **Compressed at build, loaded in two batches.** `gltf-transform etc1s` then `draco` into `*-compressed.glb`; `toktx` for loose textures (UASTC and mips for the palette and data textures, ETC1S single-channel for masks); loaders lazy by type; a tiny batch for the intro and camera, the big batch in parallel with the physics wasm; every world system built in one `World.step(1)`; a pre-render pass compiles every pipeline before the reveal.

What is WebGPU-only in that: the leaves' compute dispatch (`instancedArray`, `Fn().compute`), the shadow catcher hooks (`receivedShadowNode`, `maskShadowNode`) and the node post chain. Everything else is vertex and fragment maths with a direct GLSL equivalent, and `lib/three/grass.js`, `wind.js`, `foliage.js`, `house.js` and `groundmap.js` already are those equivalents.

## What the packs are (the inventory, in one table)

| pack | in the browser as | textures | rigs | note |
|---|---|---|---|---|
| stylized-nature-megakit | 116 `.gltf` (45 trees in 8 families ×5, 6 bushes, 7 grasses, 12 flowers, 14 ferns/plants, 4 mushrooms, 6 rocks, 10 rock paths, 11 pebbles) | per family: bark 2048² colour + normal, leaf 1024² MASK 0.2 (CherryBlossom BLEND); ground cover shares `Leaves.png`, `Flowers.png`, `Grass.png`, `Rocks_Diffuse`, `PathRocks_Diffuse` | none | trunk and crown are two primitives of one mesh; `COLOR_0` is a greyscale wind weight (0.03–0.14 at a trunk's base, tree by tree → 1 at the crown), not colour; trees 1.6k–14.7k tris |
| stylized-nature-pack | 36 of 63 as `.gltf` (Birch, Maple, DeadTree, bushes, grass, flowers); Normal/Palm/Pine trees, rocks only as FBX/OBJ | bark 2048² jpg + 9–23 MB normal PNGs; leaves 1024² BLEND | none | superseded by the megakit for everything it has; its palms and pines are the only ones in either pack |
| ultimate-space-kit | 92 embedded `.gltf`: 4 astronauts, 4 mechs, 4 enemies, 11 planets, 13 base pieces, 17 alien trees, 9 plants, 7 rocks, 3 rovers, 4 ships, 7 pickups | ONE 512² flat-colour atlas (Bruno's palette, as it happens; most files embed a 32×32 downsample) | astronauts 43 joints 18 clips; mechs 13 joints 17 clips; enemies 4–5 joints 8 clips | the one pack that is already "one material" |
| farm-animals | nothing (7 FBX, OBJ, Blend) | flat colours | Cow/Horse/Zebra: Death, Idle, Jump, Run, Walk, WalkSlow; Llama/Pig/Pug/Sheep: Idle, Jump | needs `scripts/fbx-to-glb.mjs` |
| universal-animation-library 1 + 2 | `UAL1.glb` 120 clips, `UAL2.glb` 134 clips, `Mannequin_F.glb` | none | one 65-joint UE skeleton, identical in all five files | 118 clips already baked onto the Meshy skeleton (`public/games/meshy/ual-*.glb`) |
| downtown-city-megakit (free "standard") | 153 `.gltf` (38 brick, 14 metal, 11 trim facades, 15 cornices, 13 roofs, 14 streets, 8 sidewalks, 17 decals, 3 whole buildings, 5 props) | 9 PBR sets at 2048² (colour, normal, ORM) + decals + 3 fake-interior 512² | none | `COLOR_0` is a wear mask (renders red/black as colour); facades 4–1,137 tris, buildings 18k–45k |
| street-pack, furniture-pack | nothing (FBX/OBJ/Blend) | flat colours (the furniture's are lost in the OBJ, kept in the FBX) | none | `fbx-to-glb` |

No KHR extensions anywhere; no LFS; everything is real content. CC0 1.0 throughout.

## Where the site is today (the research note has the detail)

- **Pipeline.** One `GLTFLoader` with meshopt always and KTX2 lazily; every imported GLB is meshopt + WebP; no Draco. The house look (`lib/three/house.js`) is his MeshDefaultMaterial's three ideas (shade as a colour, fog as the sky, 1.5 m ground bounce) as an `onBeforeCompile` patch on every lit material, 36 scenes on it; `core.js` wear, `surface.js` antiTile, `grass.js` (his 78,400 blades), `wind.js` (his two octaves), `foliage.js` (spherified normals, wrap lighting, faceless cards, Crysis bend per instance), `groundmap.js` (his terrain data texture), `lod.js` (banded instanced LOD, **zero callers**), `matcap.js` (two rim-tree roots use it). WebGPU plumbing exists; no shipping world is on `nodes`; the house look is `onBeforeCompile`, which the nodes path bans.
- **Generation.** The galaxy places props from hand `things` lists and seeded `scatter` rows over a ±640 m square, all at scene build, one `InstancedMesh` per part (`placer.scatter`), a near/far instance split re-done every 8 m, tree crowns as card clumps (`canopy()`), ground cover painted into a ground map. Middle-earth's towns are 3,000-line procedural builder kits with seeded tree rings. Rick and Morty's dimensions are hand-listed primitives. Minecraft streams through `rt.chunks`/`rt.workers`/`rt.origin`. Natural worlds Phase 1 (`src/lib/land`: 64 m cells with heights, water, a 128² mask and Poisson props; `src/lib/physics` on Rapier) is merged; its Phase 2 (`puffs`, `leaves`, `windLines`, `tracks`, `river`, `landmap`, `view`) and Phase 3 (the Expanse world) are not started. **No Quaternius mesh is used anywhere**; only the 118 baked clips.
- **Planets.** 28 bodies on the universe map, each a 64×40 sphere + a halo sphere + (with air) a 96×64 marched shell, no screen-size LOD, all 47 maps (1.9–7.8 MB) decoded before the first frame, 12 fandom builders of 50–260 lines repeating one shape with different constants, four texture bakers (three JS, one Python) with three noise libraries and inconsistent size ladders hand-encoded in `MAPS`, orphan files shipped, per-frame work ×28 whatever is on screen. The galaxy's 17 bodies are fully procedural (`LOOKS`); its 17 surfaces are hand-authored `sites/*.js` that share nothing with the orbit's look.
- **Rigging.** One skeleton (Meshy's 24 bones), one `AnimationMixer` and a `SkeletonUtils.clone` per figure, no instanced skinning and no vertex-animation textures; 254 clips in the registry; non-humanoids animated six different ways (own clips on any skeleton, a 7-bone leg rig fitted to statues, an AT-RT cut at the joints, sine legs on shapes, props that walk, droids that hum); the only shader-driven crowd is Edoras's host (1,000 riders, rigid pivot rotations in GLSL). Budgets exist (`animBudget`), two callers.

## The architecture

Six pieces. Each is a library every world can take, built on what exists, no WebGPU. The first three are the "kit"; the fourth is the planets; the fifth is the crowds; the sixth is each world taking them, one PR at a time.

### 1. The kit pipeline: `scripts/kit/`, `public/kit/<pack>/`

His **Visual GLB** was one prototype per species with one material. Ours is one GLB per **family**: `public/kit/naturemega/birch.glb` holds `Birch_1..5` as five meshes sharing two materials (`Bark_Birch`, `Leaves_Birch`), so a world that wants birches fetches one file and draws every birch in two instanced calls. The pipeline (`scripts/kit/import.mjs <pack> [family…]`, gltf-transform, reading `lab/assets/<pack>/` from `assets-fetch` or `--from <tilakverse-assets clone>`):

- **Mesh.** Dequantize, weld, keep the two primitives (bark, leaves) as two parts. `COLOR_0` on the nature megakit becomes a `_WIND` attribute (Uint8 normalised, one float) and is dropped from colour; on the city kit it is dropped (or kept as `_WEAR` when a later pass wants dirt). LOD1 = bark simplified to 25 % (`simplify`, error 0.05) and the crown's cards thinned to 40 % with the rest scaled ×1.25 to keep coverage (`thinCards`: whole quads, seeded). Meshopt `medium`.
- **Textures.** Bark colour 1024² WebP q82 (a `-sm` 512 beside it), bark normal 1024² WebP (the loader's `fitTextures` cap drops it below 1024 at low anyway), leaf maps 512² WebP with alpha, every BLEND leaf material made MASK at `alphaTest 0.3` with coverage-preserving mips (`coverageMips`, lifted from the galaxy kit's `keepCoverage` into `lib/three/textures.js`). The space kit keeps its one 512² atlas (one material for 92 models, as his palette). The city kit's nine PBR sets go to 1024² (2048 at ultra, later, through the `-xl` path the core scans use).
- **FBX packs** (farm animals, street, furniture): `scripts/kit/fbx.mjs` runs `scripts/fbx-to-glb.mjs` per file (skeleton, skin, clips kept; the furniture's colours come from the FBX, which has them), into `lab/assets/<pack>-glb/`, then the same import.
- **Manifest** `public/kit/<pack>/index.json`: `{ pack, licence: 'CC0-1.0', source, models: { [name]: { family, file, parts, tris, tris1, radius, height, kind, rig? } }, materials: { [name]: { alpha, leaf, maps } } }`, `kind` one of `tree bush grass flower plant mushroom rock path pebble prop building street decal vehicle character planet`. `scripts/kit-check.mjs` holds every file to its budget (a family GLB under 1.5 MiB, the nature megakit's GLBs under 12 MiB in all, a tree under 15k tris, LOD1 under 40 % of it) and the manifest to the files. `scripts/credits.mjs` reads the manifests and names Quaternius in CREDITS.md's CC0 kits. A world's `pack.js` lists the `/kit/<pack>/<family>.glb` it fetches, so the install packs and `pack-check` know.

Why families and not his palette re-UV: the nature packs are textured (bark and leaf maps carry the look); collapsing them to swatches would throw that away, and family sheets already give one material per 5–10 models. The space kit is already a palette atlas and goes in as is.

### 2. The kit loader and the pools: `src/lib/three/kit.js`

His **References + InstancedGroup**, as one module every world can take:

- `loadKit(pack)` → `{ manifest, model(name) → Promise<{ parts: [{ geometry, material, local }], radius, height, kind }>, lod1(name), material(name), dispose() }`. Parts are the galaxy placer's part contract (`placer.js`), so the galaxy can take a kit kind unchanged. Materials are shared **by manifest name across every family file** (`kitMaterial(def)`: one `house.material()` Lambert per name, bark opaque, leaves `alphaTest 0.3` `DoubleSide` + `faceless` + `wind({ weight: '_WIND' })`), so the whole nature kit is about 16 programs and the space kit is one.
- `createPool(kit, name, { bands, cap, shadows })` → `{ set(key, items), free(key), update(camera, dt), stats, dispose() }`: one `InstancedMesh` per part per LOD level (full, lod1, puff), capacity `cap` grown ×1.5 on overflow, items `[{ x, y, z, yaw, scale }]` keyed by who placed them (a cell, a site, a town) so a streamed cell arriving or leaving is matrix writes, never a new mesh. The bands and re-sort are `lib/three/lod.js`'s (`lodBand` with hysteresis 0.1, re-sorted every 0.5 s or 20 m): full within `bands[0]`, lod1 to `bands[1]`, a **puff** (his card-sphere, piece 3) to `2 × bands[1]`, nothing beyond. Shadows cast only from the full band (the galaxy's near stand-in rule, `NEAR.max 512`).
- `KIT_BANDS` live in `src/lib/budgets.js` as two new columns, `near` and `mid` (metres): low 30/90, mid 45/140, high 70/220, ultra 110/400 (ultra has no LOD1 by its row; its lod1 band draws the full mesh). A third new column `leaves` (piece 3): 0/256/1024/2048.
- The galaxy placer accepts `model: 'kit:naturemega/Fern_1'` (resolved through `loadKit`) in a `things` or `scatter` row, so a site changes one word per row to take a kit model; everything else about the galaxy stays.

### 3. The living layer: his GPU systems in GLSL, `src/lib/three/`

This is natural worlds Phase 2 (`docs/superpowers/plans/2026-10-08-natural-worlds.md` Tasks 2.1–2.5), built as that plan says, with these additions and one change:

- `puffs.js` (his Foliage) is also the **far band of every kit tree**: `puffGeometry` coloured per family from the leaf map's mean colour (two tones ±12 % luma, read once at import into the manifest as `tones`), trunk a 6-sided cylinder of the manifest's `trunk` radius. The cards face `facing` (the chase view's fixed direction on the Expanse; on a free-orbit world the pool re-faces its puff instances on the 0.5 s re-sort).
- `leaves.js` (his Leaves) stays CPU (`stepLeaves` pure over typed arrays, his forces with his numbers: push `remapClamp(d, 0.5, 2, 1, 0) × (velocity × 100 + sideways × 20)`, wind `max(strength − perlin(p × 0.005 + dir × t), 0) × weight × 0.5`, explosion `remapClamp(d, r/2, r, 0.2, 0) × 20` one frame, lift `min(|v.xz|, 2) × remapClamp(y, 0, 6, 1, 0)`, damping `1.5` in air / `0.75` on water, gravity `9.807 × weight (0.1–0.2)`, floor and water clamp, wrap in `size = 2 × radius` round the focus) at the budget's count. The GPU version (a ping-pong `GPUComputationRenderer`) is a later lane if a profile says the CPU step shows; at 2048 leaves it is under 0.3 ms.
- `windLines.js`, `tracks.js`, `river.js`, `landmap.js`, `land.js`, `view.js` as planned. `view.js`'s optimal area is the one tile: the grass, the leaves, the rain (later) and the puffs' re-face all read `view.area`.
- `weather.js` (pure, new): his `Weather` and `Cycles` (temperature, humidity, clouds, wind, rain, snow as sums of sines on a 4-minute day with an override lerp), feeding `wind.strength`, the leaves' count ratio and, later, rain and snow. One source for every world that wants a day.
- The **one change**: puffs face the camera direction on the re-sort, not a fixed direction, because every world here orbits.

Everything is GLSL on `MeshLambertMaterial` rewrites tested on stub shaders, as `grass.js` is. No `ShaderMaterial` where a rewrite will do.

### 4. Generation: flora per cell, cells pooled, streamed

- `src/lib/land/flora.js` (pure): `floraFor(spec) → { species: [{ kind, name, weight, perCell, clump, minSlope, maxSlope, onGrass, onBank }], cover: [...] }` for each land type: temperate = Birch, CommonTree, Pine, TallThick, bushes, Fern, Clover, Flower groups, Grass tufts, Mushrooms, Pebbles, RockPath; forest (a new type) = GiantPine, TallThick, TwistedTree, ferns and mushrooms thick; desert = DeadTree, rocks, pebbles; ice = Pine, GiantPine, snow rocks; volcanic = DeadTree, TwistedTree, Rock_Big; ocean = palms (nature-pack, when imported) on the sand band. `makeCell` places by his clumping (`x += perlin(xz × 0.02) × 15`) and the mask (trees on `G`, rocks on slope or bank, cover by `G` and the species' slope range), paints each tree's shade into the mask (`groundPaint`'s rule: colour ×0.75, grass ×0.4 under a crown's radius), and writes `props: [{ kind, name, x, y, z, yaw, scale }]` with the kit **name**, so a cell is a complete placement list.
- The Expanse world (natural worlds Phase 3) draws a cell by handing its props to the pools: `pool(name).set(cellKey, items)` on arrival, `free(cellKey)` on drop, under `rt.chunks` with the Minecraft loop's shape and the floating origin's shift applied to every pool in one `shift(dx, dz)`.
- The same two calls are how an authored world takes the kit: the Shire's seeded `TREES` become a `set('shire', items)`; a galaxy scatter row with a `kit:` model is a `set(siteId, items)` inside the placer. Hand lists stay hand lists; they just draw through the pools.

### 5. Planets as data; crowds baked

**Planets** (the universe map's 28, one PR):
- `src/components/universe/planetSpecs.js`: one table `SPECS[id] = { maps: [...], cloud: { r, speed, alpha }, orbit: { r, tilt, speed }, air, hooks }` for what the 12 builders repeat; `buildPlanet` builds from it and calls `EXTRAS[id](p, T, u)` for what is unique (the sitar's strings, the Ring, the Stones, the shards and tiles, the portal, the debris and flyers). Behaviour-preserving: the same meshes, names and uniforms as before, pinned by a test that builds every planet before and after against a fake texture set.
- One bake pipeline: `scripts/planets/bake.mjs` runs every baker on `sphere.mjs`'s `save()`; Cybertron's and Invincible's bakers move their `save` to it; Earth, the sun, the plates and the paper move from Python to `scripts/planets/earth.mjs` (sharp); every baker writes the one size ladder (`-sm` 512, `''` 1024, `-hq` 2048, `-xl` 4096 KTX2; Earth and Cybertron keep `''` 2048 by a manifest flag) and records it in `public/textures/universe/index.json`, which `planetMaps.js` reads instead of its hand `MAPS`. The orphans (`starwars*`, `alderaan`) are deleted; `sky*` moves to `public/textures/earth/`.
- Maps by need: `loadTextures` loads only the `-sm` set up front (about 0.5 MB); `nearMaps` becomes a three-step ladder (`-sm` → `''` within 12 radii → `-hq`/`-xl` within 6), so the first frame waits for a tenth of what it does now.
- LOD by screen size: a pure `pxOf(radius, distance, fovY, height)`; under 24 px a body shows its halo only (no shell march, clouds and props hidden, no ticks); under 6 px the body is hidden and `farPlaces`' sprite stands in whatever the distance; sphere segments come from `detail.seg`. The sun vectors and sorts run for the two nearest every frame and for the rest every fourth.
- Surface where there is none: the two gas giants (Music, Marvel) get the galaxy `gas` family's band flow as a hook; Earth gets a normal map from its day map's land mask at bake; the stations get the plates' normal.
- The galaxy's bodies and surfaces are left as they are in this design (their LOOKS → sites derivation is a later lane; noted in "What this is not").

**Crowds** (one PR): `scripts/vat-bake.mjs` samples a body's clips into a vertex-animation texture (rows = frames at 24 fps, three RGBA16F texels per bone per frame, the skin matrix's top three rows), written beside the GLB as `<name>.vat.bin` with `{ bones, frames, fps, clips: { [name]: [start, length] } }` in the GLB's extras; `src/lib/three/vat.js` `vatSkin(material, vat)` replaces three's `skinbase_vertex`/`skinning_vertex` with two texel fetches lerped by frame, driven by a per-instance `aAnim` (clip start, length, phase, speed) and one time uniform, and `createVatCrowd({ gltf, vat, count })` → `{ mesh, set(i, place, anim), free(i), update(dt) }`: one draw for a thousand walking figures, no mixer, no clone. Consumers in that PR: Edoras's host (horse from the farm kit's `Horse` Run + rider on a sit clip, replacing the hand `aRig` rig), the Citadel's still crowd (idle variants), and the galaxy's actors beyond `FAR` (60 m) handed to a crowd pool per template so the mixer count stops growing with the world. Kit creatures ride the existing paths: farm animals (own clips on their own skeleton, `createAnimator` as the AT-AT does) replace the Shire's sheep and Rohan's procedural horses; the space kit's astronauts and mechs join the Rick and Morty dimensions and the universe foot scene through the same `rig: true, anim: {…}` catalog rows. The remaining 136 UAL clips are baked as a `--set all` (about 3 MB) and the 8-direction walks and jogs wired into `locomotion` for strafing.

### 6. Every world takes it, one PR each

Order, by how much each gains for how little it risks: Yavin and Dagobah (ferns, plants, mushrooms, dead and twisted trees under the built canopies), Naboo and Sorgan (CommonTree, CherryBlossom, Birch, flowers, rock paths), the Shire and Lothlórien (ground cover, mushrooms, pebbles; TallThick and GiantPine tinted gold for the mallorn), the Rick and Morty dimensions and moons (the space kit's alien trees, rocks, base modules, planets as props), Albuquerque and Invincible (the city kit's facades and streets as block filler under the house look, the street pack's roads). Each PR: the species table, the rows changed, before/after screenshots from the world's shots script, `galaxy-check`/`perf-probe` within its budget row, credits. None replaces an authored landmark.

### How it holds a frame

A temperate cell of 64 m has ~24 trees and ~60 cover items; at high the view radius of 6 cells holds ~110 cells → ~2,600 trees, ~6,600 cover. Pools draw them in (families × parts × bands) ≈ 8 × 2 × 3 = 48 instanced calls for trees and ~20 for cover; triangles: 2,600 trees in the full band within 70 m is ~80 trees × 7k = 0.56M, the lod1 band ~400 × 2.8k = 1.1M, the puff band 2,100 × 480 = 1.0M; total ~2.7M, under the high row's 3M with the grass's 78k and the ground. Mid (bands 45/140, props 0.75) lands near 1.4M; low (30/90, props 0.5, no leaves) near 0.7M. The leaves are one draw of 2 × count triangles. The pools' re-sort is 2,600 distance tests every 0.5 s.

## Decisions (for the owner to overturn)

1. **No WebGPU, no TSL.** Every shader is a GLSL rewrite with a pure test, as the house's and the grass's are. His compute leaves become a CPU step; the nodes path stays plumbing until a world is written for it.
2. **Family sheets, not his palette.** The textured packs keep their textures; one material per family name across files is the "one material" we can have. The space kit's atlas is his palette and goes in whole.
3. **The house look is the one material.** No `MeshDefaultMaterial` port: `house.material()` already carries shade-as-colour, sky fog and ground bounce; kit materials are house Lamberts.
4. **Pools over meshes.** A placement is matrix writes into a keyed pool; nothing is built or disposed when a cell arrives. Capacity grows ×1.5, never shrinks in a session (his "nothing is disposed").
5. **Puffs are the far band of real trees**, not the only trees: his look far off, the kit's up close.
6. **Planets stay spheres with maps**; the change is data, one bake, lazy maps and screen-size LOD. No procedural re-render of the fandom planets.
7. **Crowds are baked, not instanced-skinned live**: a VAT is one texture fetch a vertex and no CPU; a thousand figures cost one draw. Hero figures keep their mixers.
8. **One skeleton stays Meshy's**; the UAL skeleton is a source, not a target. Non-humanoids keep their own skeletons and clips (the AT-AT path).
9. **Natural worlds Phase 2 and 3 are this design's pieces 3 and 4**, built on their own branches as their plan says, with the deltas listed; this design does not fork them.
10. **Authored landmarks are never replaced.** The kit fills; the hand places.

## What this is not

- Not a change to the galaxy's orbital bodies (`bodies.js` LOOKS) or to deriving its surfaces from them; a later lane.
- Not weather on the authored worlds: `weather.js` is a library the Expanse takes first.
- Not the city kit as whole buildings; blocks and streets as filler only, in the last world PR.
- Not Albuquerque's car on `lib/physics` (its own session, per the natural-worlds design).
- Not an 8192 texture lane: the `-xl` planet maps and core scans stay as they are.
- Not a change to any authored world's look, layout or gameplay beyond the species it scatters.

## Phases and dependencies

| Phase | Branch | Needs | Delivers |
|---|---|---|---|
| 1 kit pipeline + loader + pools | `claude/kit-worlds-p1` | main | `scripts/kit/*`, `public/kit/naturemega`, `space`, `farm`; `lib/three/kit.js`; budgets' `near/mid/leaves`; galaxy `kit:` models; credits; `kit-check` |
| 2 living layer | `claude/natural-worlds-p2` | 1 (for the puff tones) | natural worlds Tasks 2.1–2.5 + `weather.js` + puffs as the pools' far band |
| 3 flora + the Expanse | `claude/natural-worlds-p3` | 1, 2 | `lib/land/flora.js`; natural worlds Tasks 3.1–3.5 drawing through pools |
| 4 planets as data | `claude/planets-data` | main | `planetSpecs.js`, `scripts/planets/bake.mjs` + `earth.mjs`, the manifest, lazy maps, px LOD |
| 5 crowds baked + kit creatures | `claude/kit-rigging` | 1 | `scripts/vat-bake.mjs`, `lib/three/vat.js`, Edoras host, Citadel crowd, galaxy far actors; farm and space characters in catalogs; UAL `--set all` |
| 6 world passes | `claude/kit-world-<name>` each | 1 (2 for leaves) | Yavin+Dagobah, Naboo+Sorgan, Shire+Lothlórien, R&M, Albuquerque+Invincible |

4 runs in parallel with 1–3; 5 after 1; 6 after 1, each world its own PR.

## Testing

Pure modules test in Node: `scripts/kit/lib.mjs` (family names, card thinning, wind weights, bounds), the manifest against a fixture pack, `kit.js` with a fake loader (parts shared by material name; pool `set/free/update` band counts; capacity growth), `lod.js` unchanged, `flora.js` (species per type, determinism, every prop on its mask), `planetSpecs` (every fandom has a spec; the built group's mesh names match the old builders'), `pxOf`, `vat.js` (a two-bone fixture skinned on the CPU equals the shader's maths sampled in JS within 1e-3), `weather.js`. Shader rewrites test on stub shaders (`grass.test.js`'s pattern). Browser: `scripts/kit-check.mjs` (files, budgets), each world's shots script before/after, `galaxy-check` to its row, `perf-probe` journeys `expanseDrive` (Phase 3) and `edoras` (Phase 5), `anim-check` on Edoras and the Citadel. Before every PR: `npx eslint .`, `npx vitest run`, `npx vite build`.

## Open assumptions, marked

- The megakit's `COLOR_0` as a wind weight is inferred from its values (dark at a trunk's base, white at the crown) and the pack's `Noise_Wind.png`; if a tree sways wrong, fall back to `foliage.js`'s height² bend with no weight.
- The farm animals' FBX clips survive `fbx-to-glb` (three's FBXLoader handles binary 7400 with skins; the AT-AT came that way). If an animal's skin comes out wrong, the Blend is the source and a Blender export on the owner's desktop is the fallback (`desktop-jobs`).
- A VAT of 24 bones × 3 texels × 60 frames × 10 clips is 72 × 600 RGBA16F = 345 KB; fine. The Edoras host at 1,000 riders is one fetch pair per vertex: cheaper than today's rigid rig.
- Earth's Python baker ports to sharp without loss; if parity fails on the night map's warmth, keep the Python for Earth only and have it write the manifest.
