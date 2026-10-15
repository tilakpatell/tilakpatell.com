# The galaxy's engine: three's node renderer, its lighting and Rapier as one stack under the Star Wars worlds. The design, and the answer to "should we add a game engine?"

Date: 2026-10-10. Status: design for Opus 5.5 to implement; the owner asked for it and will read it in the PR. The plans are `docs/superpowers/plans/2026-10-10-galaxy-engine-lane{R,P,T,M}-*.md`; the hand-off is `docs/superpowers/HANDOFF-galaxy.md`; the decision entry is `docs/decisions/2026-10-10-the-engine-in-place.md`. Builds on `2026-10-08-webgpu-acceleration-design.md` (the backends, the port recipe, the parity check), `2026-10-08-render-stack-and-stack-docs-design.md` (three stays), `2026-10-10-bf2017-levels-lighting-sabers-design.md` (lanes L, G, K, X: the levels, the game's light on the classic renderer) and `2026-10-10-battlefront-game-design.md` (the game as its own `'nodes'` world; its lane 5 is the first consumer of this stack).

## What the owner asked

"Architect if, due to our addition of the Battlefront assets and the lighting demands, we should add a robust game engine for the web app, something like Rogue Engine. Research it, see how we can implement it, and do it with Opus agents. We want the Star Wars galaxy to look amazing." Then: "Like PlayCanvas, or anything to improve the lighting and the physics of our repo with high-quality assets streamed from Supabase; a bunch of PRs and sessions are working, check them." Then: "The editor is not that important, mainly the engine driving it."

So the question is the engine under the pixels: the light (many placed lights, cascaded sun shadows, ambient occlusion, reflections, indirect light, grading), the physics (the game's 10,530 Havok shapes, the terrain, a character that climbs stairs and slides on ice, vehicles, bolts that hit what you see), and the streaming of the game's files from the bucket at full fidelity. An editor is not asked for.

## The answer, measured

**No engine is added. The engine is already in the repo; it is not yet under the galaxy.** The site decided three.js over Babylon.js on 2026-10-08 (`docs/decisions/2026-10-08-three-over-babylon.md`) on a count that has not changed: 532 files import `three`, 616 GLSL sites stand between the worlds and the node renderer, every world is a lazy chunk under a byte budget, and the skills, the health rules and the hand-offs are three-shaped. Every candidate the owner named is the same swap, or is three.js wearing a coat:

| candidate | what it is | why not |
| --- | --- | --- |
| PlayCanvas | its own renderer and scene graph (engine MIT, the editor paid), WebGL 2 the mainstream path, WebGPU "maturing" | a rewrite of every world, the same five reasons as Babylon; the renderer gains nothing three r186 lacks (below) |
| Babylon.js | decided 2026-10-08 | the decision stands; nothing in it has moved |
| Rogue Engine | a Unity-like editor over three.js; last release 0.5-beta, no changelog found, no WebGPU statement | it is an editor, which the owner does not need; the engine under it is the three.js we have |
| Needle Engine | an asset pipeline and runtime over three.js (progressive glTF, LODs, a mesh baker) | the pipeline exists (`scripts/bf2017-*.mjs`, the hash-addressed asset host, lane S's pool, the level packs); the renderer is three's |
| three.js r186: `three/webgpu`, TSL, its lighting and display addons; Rapier 0.21 | already pinned (`docs/stack/three.md`, `webgpu-tsl.md`, `physics-rapier.md`); the runtime has the backend, two worlds are ported, the physics library is in | this is the engine |

What three r186 ships that an engine would be bought for, verified in its source on 2026-10-10 (`examples/jsm/lights`, `examples/jsm/lighting`, `examples/jsm/tsl/display`, `examples/jsm/csm`):

- **The sun.** `SunLight` (r186): a directional light with cascaded shadow maps through `SunLightShadow`, "suited for lighting large scenes"; on the node renderer registered with `renderer.library.addLight(SunLightNode, SunLight)`. `CSMShadowNode` (the older cascade node) remains.
- **Many lights.** `ClusteredLighting` (Forward+: `maxLights` 1024 points, `tileSize` 32, `zSlices` 24, `maxLightsPerCluster` 64; `renderer.lighting = new ClusteredLighting()`), and `DynamicLighting` (lights in uniform arrays, `maxPointLights` 16, `maxSpotLights` 16 by default, "changing the light count does not recompile materials"). Hoth's lighting layer places 63 sphere lights, 40 spot lights and 56 volumetric cones.
- **Indirect light.** `LightProbeGrid`: a 3D grid of L2 spherical-harmonic probes baked on the GPU into one `RenderTarget3D`, added to the scene as a `Light` so every lit node material takes it (`LightProbeGridWebGL` for the WebGL 2 context). `vxgi/` (voxel cone tracing) exists; not used here.
- **Screen-space passes, as TSL nodes:** `SSGINode` (`ssgi(beauty, depth, normal, camera)`; `sliceCount`/`stepCount` presets with temporal filtering: low 1/12, medium 2/8, high 3/16; `radius` 12 default), `SSRNode`, `GTAONode` (`ao(depth, normal, camera)`), `TRAANode` and `TAAUNode`, `RecurrentDenoiseNode` (`mode: 'diffuse' | 'specular'`), `DenoiseNode`, `GodraysNode`, `LensflareNode`, `Lut3DNode`, `SMAANode`, `FSR1Node`, `DepthOfFieldNode`, `MotionBlur`, `BloomNode`.
- **Physics.** Rapier 0.21 (pinned, `src/lib/physics/`): heightfield, trimesh, hull, a kinematic character controller (slide, autostep, snap to ground), a ray-cast vehicle controller already wrapped (`vehicle.js`), a floating origin (`world.onOrigin`), collision groups. The engine is in the site's bundle only for the world that asks.

Every one of these runs on the node renderer. **None runs on the classic `WebGLRenderer` the galaxy draws with today**, except the sun's cascades (`csm/CSM.js`) and a weaker ambient occlusion (`GTAOPass`), and the decision says the port, not a second build, is the road. That is the whole finding: the galaxy looks the way it does because it is on the renderer that cannot run the engine.

## Where the galaxy stands (measured on `origin/main`, 2026-10-10)

- `galaxy` and `galaxy-surface` are `shading: 'glsl'`: their closures reach 300 to 424 files with 133 to 182 GLSL sites (the WebGPU design's table). The surface's `scene.js` is 3,656 lines. The sites that matter most, by count: `universe/post.js` 10, `universe/planetShading.js` 9, `lib/three/grounding.js` 7, `lib/three/foliage.js` 6, `galaxy/sky.js` 5, then two or three each in `stations.js`, `rmWorlds.js`, `puffs.js`, `ink.js`, `grounding-bake.js`, `groundLook.js`, `setpieces.js`, `reentry.js`, `infall.js`, `footScene.js`, `citadelSiege.js`, `gateway.js`, and one or two in twenty more.
- The surface's light today (`surface/scene.js:107-147`): one `DirectionalLight` with a 2,048² PCF shadow map that follows the visitor, an optional second sun, a `HemisphereLight`, one PMREM environment at 0.4, exponential fog, `UnrealBloomPass`. No cascades, no ambient occlusion, no placed lights beyond a handful of site lamps, no reflections, no indirect light.
- Lane G (running, `claude/bf2017-g-light`) derives the sun, sky, fog, exposure, bloom and wind from the level's VisualEnvironment records into the site's shapes (`src/lib/three/gameLight.js`, `siteLightFrom`), loads the level's probes through PMREM (`probeEnv.js`) and samples the distant shadow cache (`shadowMask.js`). All of it is data and classic-renderer wiring; the data is exactly what this stack reads.
- Lane L (running) builds the level packs: `level.json`, cells, mesh cuts, the `image` ground layer, and `src/lib/level/collision.js` with `solidsOf(pack, cells)` for `walker.js`'s solids and `rapierShapes(pack, mesh)` from the Havok record.
- Physics on the surface: `walker.js` collides with circles and boxes (`createSolids`) over `heightAt`; Rapier is loaded only for the loose crates (`surface/knocks.js`). The universe landings and `footScene.js` are on Rapier (`landings/physics.js`, `bodies.js`).
- The Battlefront game (`2026-10-10-battlefront-game-design.md`, lane 5, not started) is designed as the first shipped `'nodes'` world with its own `lighting.js` and `post.js`: CSM sun, GTAO, bloom, LUT, SMAA, the placed lights as the nearest 64. Built for one world, inside that world's folder.
- The runtime (`src/runtime/`): three backend kinds (`webgpu`, `nodes-webgl`, `webgl`), the closure guard (`shadingClosure.js`, `shading.test.js`), the parity check (`scripts/gpu-parity.mjs`), the perf probe with `GPU=`. Earth and Minecraft are `'nodes'`. The post chain is data (`rt.gfx.post(passes)`) and knows `render`, `bloom`, `output`, `shader`.

## The approaches weighed

**A. Swap the engine (PlayCanvas, Babylon).** Rejected, as above: a rewrite with no incremental path, two engines' bytes for every visitor during it, and a renderer that gains nothing over three r186's node renderer. The decision's "revisit when" (the WebGL 2 fallback lost; two ports failing on the renderer) has not happened.

**B. Enrich the classic path.** `csm/CSM.js`, `GTAOPass`, `SSRPass`, `LUTPass` on the `EffectComposer` the galaxy has. Rejected as the road: it builds the light twice (once now on GLSL, once again on the port the decision owes), the classic renderer has no clustered lights, no probe grid, no SSGI and no temporal pass, and every pass added raises `glsl-sites`, the ratchet the WebGPU lane keeps. Kept as nothing: lane G's work on the classic renderer stays as the data source and ships for the worlds until their port.

**C. The engine in place (recommended).** One shared render-and-physics stack, written once under `src/lib/three/light/` and `src/lib/physics/`, consumed by every `'nodes'` world: the Battlefront game (lane 5 stops building its own) and the galaxy surfaces once ported. The surface port follows the WebGPU design's recipe (TSL twins beside each GLSL file, the module flipped when its closure is clean, parity and perf tables in the PR), sliced so the galaxy's Star Wars worlds, which is where the game's assets land, go first and the galaxy map after. The rest of this page is C.

## The design

### The light (lane R)

`src/lib/three/light/` is the render stack. Each file is one idea, pure where it can be (the choices, the budgets, the unit conversions tested in Node), three-and-TSL where it must be, and every three import of a lighting addon is dynamic and lives here only, so a world that never lights this way never downloads it.

- **`sun.js`**: `createSun(gameLight, { cascades, maxFar, tier })` → a `SunLight` (registered on the node renderer by `registerLights(renderer)`, once per renderer, idempotent) with cascaded shadows from the record's shadow settings (`CSM_CASCADES` 4 and `CSM_MAX_FAR` 600 on ultra and high, 2 and 300 on mid, none on low), colour and direction from lane G's `siteLightFrom` entry, the far ground beyond the last cascade shaded by lane G's shadow cache. Pure: `cascadesFor(tier)`, `splitsFor(near, far, n)` (the practical split, lambda 0.5).
- **`placed.js`**: the level's placed lights. A script, `scripts/bf2017-lights.mjs <world>`, reads `maps/<level>.extras.json` from the private bucket (the key from `.env.local`, as lane G's script reads it) and writes `public/models/galaxy/bf2017/levels/<world>/lights.json` beside lane L's pack, rebased to the pack's frame (its `origin` and `yaw`), per cell: `{ cells: { "cx,cz": [{ kind: 'point' | 'spot', pos, color, candela, range, cone: [inner, outer], dir, cookie?, volumetric? }] } }` with lumens to candela by `lm / (4π)` for spheres and `lm / (2π(1 − cos(outer/2)))` for cones, tested on a known lamp. At run time, pure `lightsFor(lightsJson, cells, camera, { max })` picks what is lit this frame (the cells near, then by the record's screen-area culling, `CullScreenArea 0.005`, `FadeScreenArea 0.01`), and `createPlacedLights(scene, renderer)` keeps a fixed pool of `PointLight`s and `SpotLight`s (moved, recoloured and dimmed in place, never added or removed: no recompile) under `ClusteredLighting` for the points (1,024, `maxLightsPerCluster` 64). Spots: `ClusteredLighting`'s source is read in task 1; if it clusters only points, the spots are the nearest `SPOT_POOL` 16 by screen area through the base lighting, swapped in place. The volumetric cones draw as `volumetrics.js`'s cone meshes (a TSL cone with the light's cookie and a depth fade), on ultra and high.
- **`probes.js`**: the level's reflection volumes (lane G's `probeEnv.js` loads a 128² HDR cube and makes its PMREM) become the environment of the volume the visitor is in, crossfaded over 0.5 s at the boundary (`probeFor(volumes, position)` pure). On ultra, a `LightProbeGrid` over the arena (`PROBE_GRID` 8 × 3 × 8 over the pack's `arena`), baked once at level load after the far list and the near cells are in, re-baked never; its cost is measured in task 3 and it ships only if the bake is under 400 ms on the owner's laptop and the frame under 0.5 ms; otherwise the per-volume environments alone.
- **`sky.js`** and **`fog.js`**: the TSL sky from the record's Rayleigh and Mie coefficients and cloud colours (lane 5's plan already specifies it; it moves here), drawn as the background and baked once into a PMREM for the environment where a level has no outdoor probe; the fog as a TSL node evaluating the record's distance curve with height media, applied through `scene.fogNode`. Lane G's derived `sky` and `fog` shapes are the inputs, so the classic and the node worlds read one entry.
- **`post.js`**: the passes a lit world asks for, as data for `rt.gfx.post`, with their order fixed here: `render` → `ssgi` → `ao` → `ssr` → `bloom` → `godrays` → `lensflare` → `lut` → `traa` | `smaa` → `output`. `passesFor(tier, gameLight)` is pure: ultra `ssgi` high preset with `traa`, `ao`, `ssr`, `bloom`, `godrays`, `lensflare`, `lut`; high `ssgi` medium, `ao`, `ssr`, `bloom`, `lut`, `smaa`; mid `ao`, `bloom`, `smaa`; low `bloom` only, as today. Each pass carries the record's numbers (`HbaoRadius`, `HbaoAngleBias`, `HbaoPowerExponent`, `BloomScale`, `ColorGradingMaxHdrValue`, the `T_CC_*` LUT as a `Data3DTexture`). `src/runtime/webgpu.js`'s `buildPostProcessing` learns the new kinds (the one runtime change; `webgl.js` throws on them, as it does for a kind it lacks, since no `'glsl'` world asks). Shedding: `rt.quality` levels drop `ssgi`, then `ssr`, then `godrays` and `lensflare`, then `ao`, in that order, through `lowerQuality`.
- **`look.js` (in `src/runtime/`, exists)** gains `applyGameLight(scene, renderer, entry, tier)` that wires the five above and returns `{ update(dt, camera), setWeather(entry, seconds), dispose }`; the crossfade between weathers is lane G's 20 s.

Quality is the owner's standing rule (`2026-10-07-quality-modes-design.md`): a laptop or desktop with a graphics chip is ultra and ultra restricts nothing; the tiers below exist for phones and weak chips and the pace controller sheds from the top.

### The physics (lane P: withdrawn the same day)

Written at 05:30 and withdrawn at 05:45 on 2026-10-10: a parallel session had designed the galaxy's physics in more depth an hour earlier, `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md` (branch `claude/bf2017-physics`, hand-off `HANDOFF-battlefront.md`), and its lanes are running: P0 (the Havok shapes packed and streamed with lane L's cells: `src/lib/physics/havok.js`, `surface/level/levelPhysics.js`, `collision.js`'s `createLevelCollision`), P1 (the body: `character.js` back from #781, `soldier.js` from the game's `CharacterPhysicsData`, `surface/playerBody.js`), P2 (bolts, blasts, hit zones, ragdolls), P3 (vehicles, after lane V), P4 (surfaces and the material grid). That design is the physics half of this stack; nothing of it is repeated here. What this design relies on from it: a level world's `physics` from `createLevelCollision`, the player on `playerBody.js` where `site.level` is set, the walker as the fallback elsewhere and on phones. Lane T wires those; the plan `2026-10-10-galaxy-engine-laneP-physics.md` is kept for the record and marked not to run.

### The surface port (lane T) and the map port (lane M)

The WebGPU design's recipe, unchanged: a world's GLSL becomes TSL functions in a `nodes.js` beside its scene, each a factory returning a node material and its uniform nodes under the names the frame code already writes, so the per-frame code changes only where it imports the materials; shared shaders get a twin beside the original (`<name>Nodes.js`, same factory signature, same pure test on a stub), so the `'glsl'` worlds keep shipping GLSL. The module flips to `'nodes'` only when `shading.test.js`'s closure is clean, with the parity table (`scripts/gpu-parity.mjs`) and the perf table (both backends) in the PR.

Lane T ports `galaxy-surface`: the shared twins its closure needs (`grounding`, `foliage`, `groundLook`, `puffs`, `ink`, `wind`, `surface`, `rock`, `recolour`, `keySun`, `house`, `groundmap`, `explosions`, `dye`, `core` in `lib/three`), its own files (`surface/sky.js`, `skyfog.js`, `water.js`, `weather.js`, `props/windows.js`, `props/core.js`, `props/forest.js`, `activity.js`, `ground.js`, `missions/assaultScene.js`), and the surface's post chain (`universe/post.js`'s surface pass) as `rt.gfx.post` data through lane R's `passesFor`. Then the surface takes lane R's `applyGameLight` where `site.gameLight` names an entry (lane G's field), and the physics design's `createLevelCollision` (P0) and `playerBody.js` (P1) where `site.level` is set. The twins lane T writes are the WebGPU design's step 4 (the Expanse twins) by another name: the same files, so that lane is told and does not write them twice.

Lane M ports `galaxy` (the map: `universe/post.js`'s remaining passes, `planetShading.js`, `galaxy/sky.js`, `bodies.js`, `stations.js`, `setpieces.js`, `sun.js`, `supernova.js`, `trail.js`, `deepspace.js`, `infall.js`, `crash.js`, `reentry.js`, `citadelSiege.js`, `gateway.js`, `hyperspace.js`, `interdictor.js`, `livery.js`, `landmarks.js`, `cme.js`, `battleFx.js`, `rmWorlds.js`, `shipyard/showroomRules.js`) after lane T, on T's twins. The flight from orbit to ground is one runtime handover, so the map and the surface are the same backend kind once both are `'nodes'`.

### The streaming

Nothing new. Every file a lane reads at run time comes through `src/lib/assetBase.js` and lane S's pool (#809): the level pack and its cells (lane L), `lights.json` (lane R, beside the pack, uploaded by `scripts/assets-upload.mjs` with it), the probes and the shadow cache (lane G), the LUTs (lane G), the physics shapes (in the pack, lane L). A lane that needs a field the pack lacks writes its own file beside the pack rather than editing lane L's builder while L runs.

### Rules kept

- The layers (`docs/health/RULES.md`): `src/lib/**` pure or three-only, worlds islands, files under 800 lines, tests beside, no key in the client, nothing raw served.
- A port changes a world's materials and nothing it does (the WebGPU design); a physics swap changes what the walker stands on and nothing about how fast it walks (`WALK` stays).
- `glsl-sites` goes down with every port and never up; `shading.test.js` must be green before a flip.
- One lane per PR; `origin/main` merged before opening and before merging; a conflict in `surface/scene.js` keeps both sides (lanes G and L are editing it now, each on its own lines).
- Compare on the shot before replacing; before/after sheets in `docs/superpowers/evidence/galaxy-engine/<lane>/`.

### What this design does not do

- No editor, no second engine, no new dependency (three and Rapier are pinned already).
- No WebGPU compute for the land cells or the meshing (the WebGPU design's reason stands).
- No gameplay change: the missions, the walker's feel, the ships, the director, the saves.
- No lightmaps (the game's Enlighten data does not exist in the export); no `vxgi` (measured later if `LightProbeGrid` is not enough).
- No audio; no multiplayer change.
- Not the Battlefront world itself: lane 5 of the game design builds it, on this stack, and its plan's Task 3 is replaced by "take lane R's `applyGameLight` and `passesFor`".

## Lanes

| lane | what | branch | files it owns | needs |
| --- | --- | --- | --- | --- |
| R | the light: `src/lib/three/light/*`, `scripts/bf2017-lights.mjs`, the runtime's new passes, `applyGameLight` | `claude/engine-r-light` | `src/lib/three/light/`, `src/runtime/webgpu.js` (passes), `src/runtime/look.js` (additive), `src/runtime/fixtures/nodesWorld.js` (a lit fixture), `scripts/bf2017-lights.mjs` (+ lib, test) | lane G's `gameLight.js` entry shape (on its branch now; read it there); nothing else |
| P | withdrawn: the physics is `2026-10-10-bf2017-physics-design.md`'s lanes P0–P4 (`claude/bf2017-p0-shapes`, `-p1-body`, `-p2-bolts`, …), running | | | |
| T | the surface port to `'nodes'`: the `lib/three` twins, the surface's own nodes, the post as data, the flip with parity | `claude/engine-t-surface` | `src/lib/three/*Nodes.js` (new), `surface/nodes.js` (new), `surface/scene.js` (import lines and the light wiring: additive), `surface/module.js` (the flip) | R for the light and the passes; P0 and P1 of the physics design for the ground and the body; the flip waits for G, L, K to merge |
| M | the map port to `'nodes'` | `claude/engine-m-map` | `universe/nodes.js`, `galaxy/nodes.js` (new), the map's import lines, `galaxy/module.js` | T's twins |

R and T start now on disjoint files (the physics design's P0–P2 are already running on theirs); T's flip commit is last and merges `origin/main` first. M starts when T's twins are on `main`. The Battlefront game's lane 5 starts after R and takes R's stack.

## Open assumptions, marked

- **A1.** `ClusteredLighting` clusters point lights; whether it also clusters spots is read from the r186 source in lane R's task 1. If not, spots are a fixed pool of 16 swapped by screen area.
- **A2.** three issue #34763 (2026): `DynamicLighting` ignores `scene.environment`, ambient occlusion and light maps since r185. `ClusteredLighting` shares the base class; lane R's task 1 tests the environment under it on the fixture and, if it is lost, keeps the placed lights on the default lighting in a fixed pool of 64 (lane 5's `LIGHT_BUDGET`) and says so in the PR.
- **A3.** `LightProbeGrid`'s bake cost on a 1,536 m arena is unmeasured; it ships behind the numbers in task 3 or not at all.
- **A4, A5** (the character's feel, the pack's shapes) moved with lane P to the physics design, which answers them in its lanes P1 and P0.
