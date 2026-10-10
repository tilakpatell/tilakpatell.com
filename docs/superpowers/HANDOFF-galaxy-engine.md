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
| **S** (#846, open) | `2026-10-10-bf-fidelity-laneS-shadows.md` | calibration to the game's Hoth; four soft cascades (`CSMShadowNode`, PCSS from the sun's angular radius); the record's shadow sun; cloud and contact shadows; the shadow term shared with the particles | `main` | nothing |
| **V** | `2026-10-10-bf-fidelity-laneV-volumetrics.md` | the placed volumetric cones and the light-cone effects ray-marched; fog with the record's participating media; god rays off the real sun; the sun's and the explosions' flares from the records; motion blur and depth of field as data | `main` | S's cascade light for the god rays (reads its branch; `rays` until then) |
| **X** | `2026-10-10-bf-fidelity-laneX-particles.md` | the emitter reader (`ScalableEmitterDocument` → `src/data/bf2017/fx/`); particles on the GPU (compute) or the CPU (instanced) from the tables; a level's `effects.json` with its cells; exhaust and contrails on ships | `main` | nothing (the export on the desktop or the bucket by key) |
| **C** | `2026-10-10-bf-fidelity-laneC-cameras.md` | the soldier, aim, vehicle, overview and cinematic cameras from `cameras.json`, one rig with recoil and shake; Hoth's walker on it behind `site.level` | `main` | P0's ray for the arm's cast (reads its branch; a height cast until then) |
| N | `2026-10-10-bf-fidelity-laneN-scatter.md` | grass, ferns, rocks and backdrop trees from the game's scatter tables, the mask derived until the export solves it | `main` after L (#831) and T's `foliageNodes` | L, T |
| U | `2026-10-10-bf-fidelity-laneU-headroom.md` | FSR1/TAAU upscaling as the pace's first step; `BatchedMesh` and bundles for the level's statics; occlusion | `main` after L | L; the owner's laptop for the tables |

S, V, X and C run at once on disjoint files (`light/{calibrate,shadows,clouds,contact}.js` and `sun.js`; `light/{volumetrics,flare}.js` and `fog.js`, `post.js`, `passes.js`; `src/lib/three/particles/` and `scripts/bf2017-emitters.mjs`; `src/lib/three/camera/`). `light/apply.js` is touched by S and V (each additive): merge `origin/main` before the PR and keep both sides. `surface/scene.js` is touched by C (one call site) and by lanes L, T, P0 and P1: the same rule.

### Lane S: done and left

Done (#846, branch `claude/fidelity-s-shadows`, evidence in `docs/superpowers/evidence/galaxy-engine/S/`, WebGL 2 leg on SwiftShader):

- **Calibration** (`light/calibrate.js`): the record's tone map goes through lane G's meter and `GAME_TO_SITE` / `SKY_TO_SITE` (`gameLight.js`, #833), so the node stack's Hoth Sunny sun is the classic stack's 0.79 and its sky and fill 0.61 (sunset: 2.37 on both). The fixture under Hoth's record (`--hoth`, snow, the house's exposure 1.4) has a mean luminance of 0.3686 against lane G's calibrated classic Hoth field's 0.3531 (+4.4 %; 0.3852 before PCSS and the clouds). The bloom threshold is the record's `ColorGradingMaxHdrValue` × the house's.
- **SSGI is off on `'nodes-webgl'`** (`post.js` `CANNOT`): on the fixture the chain render → ssgi → output washed the frame to 0.787 whatever its GI intensity (0, 0.1, 0.25 and 1 alike). This was most of the washed picture; on WebGPU it stays.
- **Four cascades** (`light/sun.js`): a `DirectionalLight` through `CSMShadowNode`, 4 on ultra and high, 2 on mid, out to the record's `SunShadowmapViewDistance` (30 m on low to high on Hoth; `ULTRA_SHADOW_FAR` 140 m on the site's ultra), each cascade's bias scaled with its texel, fitted along `ShadowSunRotationX/Y` while the light shines along `SunRotationX/Y`, the last 15 % faded into a far shadow term.
- **Soft** (`light/shadows.js`): PCSS through `shadow.filterNode` (B1: yes, the hook is on r186), the record's 8 initial samples, its 5 % early-out, the penumbra from `SunAngularRadius` × `SunPenumbraSize`, 256 samples on ultra and 32 on high; PCF on mid; VSM only if the hook were gone.
- **Cloud shadows** (`light/clouds.js`, the record's two layers, drifting on the record's speed or the weather's wind) and **contact shadows** (`light/contact.js`, a 2 m top-down pass under each tracked figure on ultra and high; `applyGameLight(...).track(object)`); `sunShadowNode(lit)` from `apply.js` is the shadow term for lane X's sprites (the cascades × the clouds, eased by `ParticleSunShadowFactor`).

Left:

- **The WebGPU column**: the cloud's software device dies on the fixture (B5); the owner's laptop runs `node scripts/light-fixture.mjs --hoth --tier ultra --post on` and `--shadows --clouds` on both legs, and checks there that the PCSS kernel's raw depth reads build on WebGPU (it turns the depth texture's comparison off and filters it nearest).
- **The seam on a real chip**: on SwiftShader WebGL 2 a fragment past the cascades' far loses its image-based light (a hard step; the shader is right there), so the 15 % fade is judged on the laptop.
- **The far shadow**: `shadowMask.js` is not on `main` (lane G left the distant shadow cache for lane L); `createSun`'s `farShadow` takes it as a node once it lands; until then the far is lit.
- **The cloud texture**: not in the export; the density is MaterialX fractal noise, so the clouds are the record's size, coverage, exponent and drift on a noise of the site's.
- **The clouds across a weather change**: `setWeather` turns the shadow sun with the weather, but the cloud node is built from the first weather's record (its layers' coverage and exponent are constants in the shader); a weather that changes them needs the node rebuilt or those numbers made uniforms.
- **The depth bias**: the cascades scale the entry's bias (−0.0004, normalised depth, as lane R set it) with their texel; over the ultra shadow camera's 520 m depth that is about 16 cm along the light in the first cascade. The fixture's feet touch their shadows at 2 m (`contact-pair.webp`); a real chip may want it in metres.
- **The world**: nothing under `src/components/` uses this yet; the Battlefront world's lane 5 takes it through `applyGameLight` and tracks its figures.

### What the other work must know

- **The Battlefront game, lane 5** (not started): its Task 4 (the cameras) is lane C's `src/lib/three/camera/`; its effects come from lane X's `createEffects`; its lighting from `applyGameLight` as before. Lane 5 writes none of these.
- **Lane F of #802** (effects' look, `src/lib/three/fx/gameLook.js`, not started): lane X reads the game's emitters themselves, so F's sprite-sheet resolution is X's task 1 and F's lane is not needed as planned; its sound map (task 4) stands on its own.
- **Lane P4** (hit effects by material, #821): calls lane X's `spawn(name)` with the material grid's effect names once X is on `main`; until then its own look.
- **Lane L** (#831): lanes V, X and N write `volumes.json`, `effects.json` and `scatter.json` beside the pack, never in `level.json`.
- **Lane T** (#826, draft): the twins are what lanes N and X's sprites build on (`foliageNodes`); T's flip is unaffected.
