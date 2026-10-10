# Hand-off: the galaxy's engine

The design: `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md`. The decision: `docs/decisions/2026-10-10-the-engine-in-place.md`. The answer to "should we add a game engine?" is no: three r186's node renderer, its lighting and display addons, TSL and Rapier are the engine, pinned and partly in use; this work puts them under the Star Wars worlds.

## Done

- **The design, the decision and four plans** (#819): lanes R, P, T and M below.
- **Lane R, the light** (`claude/engine-r-light`): `src/lib/three/light/` is the stack, and `applyGameLight(scene, renderer, entry, { tier, camera, lights, volumes, loadCube, arena, grid, sky, post, lut })` in its `apply.js` wires it in one call and returns `{ update(dt, camera), setWeather(entry, seconds), passes, dispose }`. Its parts: `sun.js` (`SunLight`, its cascades fitted to the view; a shadow-casting `rays` light for god rays), `placed.js` (fixed pools filled each frame from `lights.json` by screen area: 1,024 points under `ClusteredLighting` on WebGPU, 64 on the base lighting over WebGL 2, 16 spots), `probes.js` (the volume's cube as the environment, crossfaded in 0.5 s; `LightProbeGrid` on ultra, off until measured), `sky.js` and `fog.js` (the record's scattering, cubic fog curve and height fog, on uniforms), `post.js` (the order, the tiers' chains, the shedding, what each backend cannot build) and `passes.js` (the chain built on the node renderer; `src/runtime/webgpu.js` hands it any chain with the new kinds, `webgl.js` refuses them by name). `entry.js` reads the VisualEnvironment records as the bucket's map extras carry them (Hoth's sunny, sunset and interior pinned in `light/fixtures/hoth.ve.json`) and lane G's derived shape. `scripts/bf2017-lights.mjs` writes a level's `lights.json` from `web/maps/<level>/<name>.extras.json`. The proof is `src/runtime/fixtures/litWorld.js` drawn by `scripts/light-fixture.mjs`; shots and numbers in `docs/superpowers/evidence/galaxy-engine/R/`.

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| **R** | `2026-10-10-galaxy-engine-laneR-light.md` | the light as one stack: `SunLight` cascades, `ClusteredLighting` placed lights, probes and a probe grid, the TSL sky and fog, the post chain as data (SSGI, AO, SSR, bloom, god rays, flare, LUT, TRAA); `applyGameLight` | `main` | nothing (lane G's `gameLight.js` read from its branch) |
| P | `2026-10-10-galaxy-engine-laneP-physics.md` (**withdrawn; do not run**) | the physics is `2026-10-10-bf2017-physics-design.md`'s lanes P0–P4 (`HANDOFF-bf2017-physics.md`), running since 05:22 | | |
| **T** | `2026-10-10-galaxy-engine-laneT-surface-port.md` | `galaxy-surface` to `'nodes'`: the `lib/three` twins, the surface's own nodes, the post as data, the light and the ground wired; the flip with parity | `main` | the flip waits for G, L, K merged; the light on R; the ground and the body on the physics design's P0 and P1 |
| M | `2026-10-10-galaxy-engine-laneM-map-port.md` | `galaxy` (the map) to `'nodes'` on T's twins | `main` after T | T |

One lane per session. R and T run at once and own different files (`src/lib/three/light/`, `src/lib/three/*Nodes.js` and `surface/nodes.js`); the physics design's P0–P2 own `src/lib/physics/` and `surface/level/levelPhysics.js`. `surface/scene.js` is touched by T (the import lines and the light wiring), by P0 and P1 (their call sites) and by #810's lanes G and L now: merge `origin/main` before the PR and keep both sides.

### What the other work must know

- **The Battlefront game, lane 5** (`docs/superpowers/plans/2026-10-10-battlefront-lane5-world.md`, not started): its Task 3 (`lighting.js`, `post.js`, the runtime's new passes) is done by lane R. Lane 5 writes no `lighting.js` or `post.js`: it calls `applyGameLight` from `src/lib/three/light/apply.js` with its level's entry, `lights.json` and probe volumes, adds `update(dt, camera)` to its step, and hands `light.passes` to `rt.gfx.post` (shedding through `post.js`'s `shed(passes, level)` from `rt.quality`). Its plan's constants: `CSM_CASCADES` and `CSM_MAX_FAR` are in `sun.js`; `LIGHT_BUDGET` is `placed.js`'s `POINT_FALLBACK` (64); `PROBE_SIZE` has no constant here: the volumes' cubes are the game's own 128².
- **The WebGPU lane** (`2026-10-08-webgpu-acceleration-design.md`, "The ports, in order", step 4, the Expanse twins): lane T writes those twins under the same names (`<name>Nodes.js` beside the original). Read them from lane T's branch before writing any.
- **The physics design** (`2026-10-10-bf2017-physics-design.md`, `HANDOFF-bf2017-physics.md`): the physics half of this stack; lane T wires P0's `createLevelCollision` and P1's `playerBody.js` behind `site.level`; nothing physical is written under this design.
- **Lane G** (#810): its `siteLightFrom` entry is the input to lane R's `applyGameLight`, and `entry.js` also reads the raw record (`entry.record`, the extras' `environments[<name>]`) where G's shape lacks a field. Until G calibrates, the game's units go to the site's by the record's own exposure, 2^ExposureCompensation / (1.2 · 2^EV) at MaxEV (Hoth's day: the sun 9.2, the dusk sun 27.8); G's `gameToSite` on the entry replaces it. G's `probeEnv.js` prefilters with the classic renderer's PMREM and keeps one cube alive, so the node worlds' `loadCube` hands `probes.js` the raw HDR cube (PMREMNode filters it) and the two volumes of a crossfade live together. The shadow cache (`shadowMask.js`) is not sampled yet: the far ground beyond the last cascade is in full sun (Left). The keys are in the cloud sessions now (`SUPA_KEY`, as `bf2017-fetch.mjs` reads it): `web/maps/levels/mp/hoth_01/hoth_01.extras.json` holds Hoth's 11 VisualEnvironment records, its 1,234 lights and its sun direction (`SunRotationX`/`Y`).
- **Lane G** (#810): its `siteLightFrom` entry is the input to lane R's `applyGameLight`; its probes (`probeEnv.js`) and shadow cache (`shadowMask.js`) are read by lane R's `probes.js` and `sun.js`. Nothing of G's is replaced; the classic-renderer worlds keep it.
- **Lane L** (#810): lane R writes `lights.json` beside L's pack (not in `level.json`); lane P reads the pack's `physics` per mesh and shares `src/lib/level/collision.js`'s `rapierShapes` with L.
- **The natural-worlds lane** (`2026-10-08-natural-worlds-design.md`): keeps shipping GLSL; lane T's twins are beside its files, not in them.

## Left

- R, T, M as above; the physics in its own hand-off.
- **Lane R's rest**:
  - Hoth's `lights.json`: `node scripts/bf2017-lights.mjs hoth` once lane L's `level.json` is in `public/models/galaxy/bf2017/levels/hoth/` (the script stops without a frame rather than guess one); a dry run in the game's frame keeps 691 of 1,234 (127 points, 564 spots, 12 cells). Then `scripts/assets-upload.mjs` with the pack.
  - The WebGPU leg of `node scripts/light-fixture.mjs` (and `--post on --tier ultra|high`, `--grid`) on the owner's laptop: the cloud's SwiftShader WebGPU device is lost on its first frame. That run settles A2 under `ClusteredLighting` (the env diff column), whether SSR and TRAA draw on WebGPU (they do not over WebGL 2), the frame table at 1600 × 900, and A3 (`--grid`: ship `grid: true` only under 400 ms bake and 0.5 ms a frame; on SwiftShader at 800 × 450 the bake took 3.4 s and the frame did not move, 426 ms both).
  - Hoth is 82% spots (564 of 691) and spots do not cluster: only the nearest 16 light. Worth trying: spots past the pool as points under the clusters at a cone-weighted strength, or a pool per cell.
  - Four cascades: r186's `SunLight` draws two. `CSM_CASCADES` 4 needs `three/addons/csm/CSMShadowNode.js` on a `DirectionalLight`; the far ground beyond `CSM_MAX_FAR` takes lane G's shadow cache once a node material samples it.
  - The look, judged on a real chip: SSGI over open snow lifts the shaded faces near the lit ones even at a tenth of three's GI (`post.js`'s `GI`, `SSGI_RADIUS`); the sky's `ZENITH_SHARE`; bloom at the house's numbers on a bright day. Lane G's calibration on Hoth sets them.
  - The record's grading LUT (`T_CC_*`) to a `Data3DTexture` for `lut` (lane G's `lutShape` reads its strip); `volumetrics.js` (the volumetric cones) not written.
- After M: `BundleGroup` round what never moves on a level (lane L's instances), measured on the perf probe; the WebGPU design names it.
- `vxgi/` (voxel cone tracing) measured only if the probe grid is not enough for the hangar's indirect light.
- The placed lights' cookies (the record's `cookie` textures) once lane R's pool draws without them.
- The other `'glsl'` worlds the WebGPU design orders (Mario 64, the Expanse, the Death Star's inside, Middle-earth) take lane T's twins in their own ports.

## Checking it

- `npx vitest run src/lib/three/light src/lib/physics src/runtime` and the twins' tests.
- `node scripts/light-fixture.mjs` (lane R: the lit fixture on both backends).
- `node scripts/gpu-parity.mjs /galaxy/hoth --before --view ground --view hangar` (lane T; the README in `scripts/gpu-parity/`).
- `GPU=webgpu node scripts/perf-probe.mjs` and `GPU=webgl …` on the galaxy journeys.
- `node scripts/galaxy-check.mjs surface hoth,endor,tatooine,kamino` and `space endor,hoth,geonosis`.
- `node scripts/health/measure.mjs`: `glsl-sites` lower after each port; the closure guard green.

## Fidelity: shadows, volumetrics, particles, cameras, scatter, headroom

The design: `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` (what is not yet robust on `main`, measured from lane R's fixture and the records; what three r186 ships for each; six lanes). Each lane adds one file family to the stack and proves it on `scripts/light-fixture.mjs` with a flag of its own, on both backend kinds (the WebGPU leg on the owner's laptop: the cloud's software device dies on the fixture).

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| **S** | `2026-10-10-bf-fidelity-laneS-shadows.md` | calibration to the game's Hoth; four soft cascades (`CSMShadowNode`, PCSS from the sun's angular radius); the record's shadow sun; cloud and contact shadows; the shadow term shared with the particles | `main` | nothing |
| **V** | `2026-10-10-bf-fidelity-laneV-volumetrics.md` | the placed volumetric cones and the light-cone effects ray-marched; fog with the record's participating media; god rays off the real sun; the sun's and the explosions' flares from the records; motion blur and depth of field as data | `main` | S's cascade light for the god rays (reads its branch; `rays` until then). **Built** on `claude/fidelity-v-volumetrics`: see "Lane V" below |
| **X** | `2026-10-10-bf-fidelity-laneX-particles.md` | the emitter reader (`ScalableEmitterDocument` → `src/data/bf2017/fx/`); particles on the GPU (compute) or the CPU (instanced) from the tables; a level's `effects.json` with its cells; exhaust and contrails on ships | `main` | nothing (the export on the desktop or the bucket by key) |
| **C** | `2026-10-10-bf-fidelity-laneC-cameras.md` | the soldier, aim, vehicle, overview and cinematic cameras from `cameras.json`, one rig with recoil and shake; Hoth's walker on it behind `site.level` | `main` | P0's ray for the arm's cast (reads its branch; a height cast until then) |
| N | `2026-10-10-bf-fidelity-laneN-scatter.md` | grass, ferns, rocks and backdrop trees from the game's scatter tables, the mask derived until the export solves it | `main` after L (#831) and T's `foliageNodes` | L, T |
| U | `2026-10-10-bf-fidelity-laneU-headroom.md` | FSR1/TAAU upscaling as the pace's first step; `BatchedMesh` and bundles for the level's statics; occlusion | `main` after L | L; the owner's laptop for the tables |

S, V, X and C run at once on disjoint files (`light/{calibrate,shadows,clouds,contact}.js` and `sun.js`; `light/{volumetrics,flare}.js` and `fog.js`, `post.js`, `passes.js`; `src/lib/three/particles/` and `scripts/bf2017-emitters.mjs`; `src/lib/three/camera/`). `light/apply.js` is touched by S and V (each additive): merge `origin/main` before the PR and keep both sides. `surface/scene.js` is touched by C (one call site) and by lanes L, T, P0 and P1: the same rule.

### Lane V: done and left

Done (branch `claude/fidelity-v-volumetrics`, the plan's five tasks):

- **`volumes.json` from the game's own data.** `node scripts/bf2017-volumes.mjs hoth` wrote `public/models/galaxy/bf2017/levels/hoth/volumes.json`: 130 volumes, the 56 `SimpleVolumetricsEntityData` glows (boxes, from `hoth.lighting.json`) and the 74 light cones (62 `FX_Arctic_LightCone_04`, 12 `_02`, all in the Content subworld, at the hangar's floor). Each cone's size, colour, falloff and fade come from its own `ScalableEmitterDocument`, read from the bucket: the game draws each cone as one direction-aligned quad, `_04` 2 m wide and 5 m tall in a grey of (0.24, 0.25, 0.22), `_02` 1.5 m in a blue of (0.59, 1.07, 1.82), alpha exponent 2.113, faded from 17 m to 20 m. The bucket keeps each folder in the case it was first uploaded in (`data/FX/Lighting/Emitters/` holds `fx/lighting/emitters/em_*`), so the script matches folders without case.
- **`light/volumetrics.js`**: the volumes as `VolumeNodeMaterial` boxes on their own layer, marched at a quarter of the resolution, dithered, blurred, brought up over the depth by a joint bilateral upsample (so no halo round a figure), added before the bloom. On ultra the nearest 12 by screen area are drawn, on high 6, none below. A volume with a placed spot within 1 m of its apex is lit by a shadow-casting spot of its own on the volume layer, at the placed spot's place, colour and strength; a volume without one glows by its record's emission. `applyGameLight` takes it as `volumetrics` (the `volumes` argument already names the probe volumes).
- **Fog (`fog.js`'s `fogMedia` and `fogVolume`, the `fog` pass).** The participating media are zero in every one of the 417 VisualEnvironment records in the export except one, and that one has `ParticipatingMediaEnable false`. The scattering the game uses is `ForwardLightScattering`, which 105 of the 176 records with a fog turn on (Hoth's interior at Presence 0.714, its sunset at 0.765, its day at 0). So the pass always draws the forward glow round the sun and marches the media only where a record enables them. Hoth has no Blizzard record (only its LUT), so the fixture shows Hoth's day (no glow: nothing darkens at the horizon) and Felucia's day's fog record (Presence 0.956) on Hoth's sky.
- **God rays (B2).** No: `GodraysNode` marches only a `DirectionalLight` or `PointLight` with its own shadow map, and `CSMShadowNode`'s cascades are `LwLight`s (plain `Object3D`s), so lane S's four-cascade light cannot feed it. `post.js`'s `raysLight(sun)` keeps lane R's `rays` helper and would take a plain shadow-casting `DirectionalLight` sun. A shim exposing cascade 0 as a `DirectionalLight` is the way to try it once S lands.
- **Flares (`flare.js`).** The sun's `SunFlareComponentData` (five elements) sets `LensflareNode`'s ghosts and scales the flare by the record's occluder and screen-position curves. The occluder's coverage is measured in the shader from 16 depth taps over the sun's disc. `node scripts/bf2017-volumes.mjs --flares` wrote the game's 12 `LensFlareBlueprint`s to `src/data/bf2017/flares.json` for `eventFlare(name)`.
- **Motion blur and depth of field as data.** `motionBlur` comes from the weather's `MotionBlurComponentData` (Hoth's day: on, scale 1) on ultra and high, and blurs the camera's motion only (the depth reprojected through the previous frame's camera, `MotionBlurCentered false`). `dof` is built only when given lane C's `{ focus, aperture, focalLength, maxblur }`, with a thin-lens range.
- The fixture: `node scripts/light-fixture.mjs --volume` (a hangar, six of Hoth's cones, three of them under Hoth's hangar spot, a figure walking through one; `--volume off`, `--weather interior|sunny|felucia`, `--view wide|edge|sun`, `--pan`), shots in `docs/superpowers/evidence/galaxy-engine/V/`, WebGL 2 leg only.

Left:

- **The WebGPU leg and the real frame table**, on the owner's laptop (B5): `node scripts/light-fixture.mjs --volume --tier ultra` and `--tier high`, with and without `--volume off`. SwiftShader's numbers measure the CPU only (medians, ms: ultra 37.8 with the volumes and 33.5 without; high 32.5 with and 43.3 without, which is noise). The budget is 2.5 ms for the pass at 1600 × 900; if the laptop exceeds it, `VOLUME_STEPS` and `FOG_STEPS` are shed first.
- **Exposure.** The shots are washed out by the uncalibrated exposure (lane S's calibration); `SCATTER` in `volumetrics.js` should be judged again on the calibrated picture.
- **Hoth's `lights.json` is not written on `main`.** Run `node scripts/bf2017-lights.mjs hoth` (the keys are in the cloud), and the cones under the hangar's ceiling spots will find them. The fixture builds its own.
- **The god rays off lane S's cascade**: a shim exposing cascade 0 as a `DirectionalLight` once S lands (B2 above).
- **What a weather crossfade does not reach.** The fog and flare passes are built from the weather's record when the chain is built, so a crossfade does not ease them; rebuild the chain on `setWeather`, or move their numbers into uniforms.
- **What this lane did not do.** The light cones are drawn as volumes, not as the game's textured quads (`T_LightCone_01_D`): lane X's sprites can draw them too, and one of the two should give way. The flares' own sprite textures (their `ShaderGraph`s) are not drawn: `LensflareNode` draws ghosts of the bloom.

### What the other work must know

- **The Battlefront game, lane 5** (not started): its Task 4 (the cameras) is lane C's `src/lib/three/camera/`; its effects come from lane X's `createEffects`; its lighting from `applyGameLight` as before. Lane 5 writes none of these.
- **Lane F of #802** (effects' look, `src/lib/three/fx/gameLook.js`, not started): lane X reads the game's emitters themselves, so F's sprite-sheet resolution is X's task 1 and F's lane is not needed as planned; its sound map (task 4) stands on its own.
- **Lane P4** (hit effects by material, #821): calls lane X's `spawn(name)` with the material grid's effect names once X is on `main`; until then its own look.
- **Lane L** (#831): lanes V, X and N write `volumes.json`, `effects.json` and `scatter.json` beside the pack, never in `level.json`.
- **Lane T** (#826, draft): the twins are what lanes N and X's sprites build on (`foliageNodes`); T's flip is unaffected.
