# The galaxy at the game's fidelity: shadows, volumetrics, particles and cameras from the game's own records. The design

Date: 2026-10-10 (evening). Status: design for Opus 5.5 to implement; the owner asked for it. Builds on `2026-10-10-galaxy-engine-design.md` (the stack: `src/lib/three/light/`, merged as PR #827), `2026-10-10-bf2017-levels-lighting-sabers-design.md` (lanes L, G: the level packs and the derived light, G merged as #833), `2026-10-10-battlefront-game-design.md` (the game; its lane 5 is not started and takes this), `2026-10-10-bf2017-physics-design.md` (P0–P4; P4's hit effects and decals are not repeated here). Plans: `docs/superpowers/plans/2026-10-10-bf-fidelity-lane{S,V,X,C,N,U}-*.md`. Hand-off: the "Fidelity" section of `docs/superpowers/HANDOFF-galaxy-engine.md`.

## What the owner asked

"Make the lighting and camera angles robust, analyse the rest of the game and see what we can add now. I want to make the game the highest fidelity for a web game. Think shadows and stuff and particles and everything we can add."

## Where the light stands on `main` (measured 2026-10-10 12:30)

Lane R's stack is merged and proven on the runtime's lit fixture on the node renderer over WebGL 2 (`docs/superpowers/evidence/galaxy-engine/R/`); its WebGPU leg died on the cloud's software device and waits for the owner's laptop. What the shot `post-ultra-webgl.png` shows, and what the hand-off's "Lane R's rest" says, is the list of what is not yet robust:

1. **Exposure is uncalibrated.** The picture is washed to white: the game's `EV 10` with `ExposureCompensation 1.5` goes to the site's units by a formula in `entry.js`, and lane G's `GAME_TO_SITE` calibration on Hoth (its PR says the factor) has not been applied to the node stack. The sky's `ZENITH_SHARE`, the bloom at the house's numbers on a bright day, and SSGI lifting open snow are the same problem: nothing has been judged on a real chip against the game's Hoth.
2. **Two cascades, hard-edged.** `SunLight` draws exactly two cascades; the record asks for a view distance of 70 m on ultra (`SunShadowmapViewDistance.Ultra`), PCSS soft shadows (`SunPcssInitialSampleCount 8`, `SunPcssMaximumSampleCount 256`, `SunPcssFilterErrorThresholdPct 0.05`), a separate shadow sun direction (`ShadowSunRotationX 284.42, Y 82.044`), cloud shadows (`CloudShadowSize 8192`, a secondary layer at 500 m, coverage 0.3, exponent 8), `SmoothTransitionToDistantShadows` into lane G's distant shadow cache, and `ParticleSunShadowFactor 1`. None of these is there.
3. **Spots do not cluster.** Hoth is 82 % spots (564 of 691 kept); only the nearest 16 light. The hangar's strips are mostly dark.
4. **No volumetrics.** The level places 56 `SimpleVolumetricsEntityData` cones and spawns 74 `FX_Arctic_LightCone_*` effects (the shafts through the hangar's roof); the record's fog has participating media (`DepthFogParticipatingMedia`, `HeightFogParticipatingMedia` with scattering, albedo, phase) and `GodraysNode` is in the chain only as a screen-space haze. `volumetrics.js` is unwritten.
5. **No particles from the data.** Hoth spawns 648 effects: falling snow from the ceiling (90 + 62), snow dust, light cones, indoor smoke volumes (48), falling snow (39), engine exhaust (49), TIE contrails (20), rising steam (16), snow wind (10), wreck smoke, gas fires. The site's `weather.js` draws a box of points round the camera; nothing reads the game's emitters. **The emitters are in the data**: 3,740 `EffectBlueprint`s (with `Low/Medium/High/Ultra` variants, `CullDistance`, `MaxActiveInstanceCount`, `SpawnProbability`) over 7,134 `ScalableEmitterDocument`s, each a list of typed objects: `EmitterTemplateData` (`MaxCount`, `Lifetime`, `EmittableType_Quad`, `EmittableAlignment_MotionStretchScreen`, `LightWrapAroundFactor`, `MaxSpawnDistance`, `ParticleCullingFactor`), `SpawnRateData`, `SpawnSizeData`, `SpawnSpeedData`, `SpawnDirectionData`, `SpawnPositionData` over `BoxEvaluatorData`, `GravityData` (`9.8`, `PerParticleRandomness`), `UpdateColorData` (HDR colour over `EfNormTime`), `UpdateSizeData`, `UpdateRotationData`, `UpdateAlphaLevelScaleData`, `UpdateTextureCoordsData`, `UpdateTransparencyData`, each curve a `PolynomialData` (cubic coefficients) or a `RandomEvaluatorData`. Only the 166 `EmitterGraph`s (compiled GPU graphs) are opaque. The textures are in `web_opt/textures/fx/` (292 encoded, 558 masters).
6. **The camera is the site's.** The galaxy's surface follows the walker with its own arm; the game's `cameras.json` (lane 0, merged) holds the soldier's third-person camera (arm 1.2, pitch ±55, reduced arm 0.5 between pitch 5 and 70, collision padding 0.17 with blend in 5 and out 3, cull distances by stance, shoulder side), the aim camera (FOV 55 per zoom level with zoom speeds), every vehicle's camera chain (pitch limits, yaw and pitch inertia 0.8 with input and 0.5 without, velocity redirect rates), and 12 deploy and outro cameras per mode (35 mm focal length, aperture 8, shutter 50, ISO 100, focus 1,000 m). The record's `MotionBlurComponentData` has `MotionBlurEnable true, MotionBlurScale 1`; the post has `MotionBlur` and `DepthOfFieldNode` behind a flag and nothing drives them.
7. **The ground is bare.** The game scatters grass, ferns, twigs, rocks and backdrop trees at run time from `maps/terrain_scatter/<terrain>.json` (739 types over 39 terrains: mesh, density per quality level, scale range, `WindScale`, `Stiffness`, `Damping`, `WindWiggle`, LOD dissolve); lane L's pack places the 24,000 instances and nothing scatters.
8. **The grade is not applied.** `T_CC_Hoth_Sunny_01` as a `Data3DTexture` for `lut` is in lane R's "rest"; `SubSurfaceScatteringComponentData` holds three profiles (skin: `RadiusR 1.0, G 0.563, B 0.355`, `ScatteringScale 0.045`; snow-like: `R 0.863, G 0.96, B 1.0`, translucency 1.0); `SunFlareComponentData` holds the flare's elements with size and alpha curves by occluder and screen position; 12 `LensFlareBlueprint`s (explosions, the ion bomb) hold element lists with their own curves.

What is fine: the chain's order, the pools, the probes per volume, the sky's model, the fog node, `applyGameLight`'s one call. This design adds to that stack; it does not restructure it.

## What three r186 ships for each (its `examples/` on 2026-10-10)

| need | three has | example |
| --- | --- | --- |
| four cascades, soft | `three/addons/csm/CSMShadowNode.js` on a `DirectionalLight` (any count); `ShadowNode`'s filter hook (`getShadowFilterFn`, `setupShadowFilter`) for a PCSS kernel; VSM (`VSMShadowMap`, blur samples) | `webgpu_shadowmap_csm`, `webgpu_shadowmap_vsm`, `webgpu_shadowmap_progressive` |
| contact shadows | a top-down depth pass blurred under the feet | `webgpu_shadow_contact` |
| cloud shadows | a texture node multiplied into the sun's shadow term (`shadowNode` on the material) | `webgpu_materials_lightmap` for the pattern |
| spot cookies | `ProjectorLight` (a spot with a texture, shadows on) | `webgpu_lights_projector`, `webgpu_lights_ies_spotlight` |
| area lights (7,855 rect lights across the maps) | `RectAreaLight` on the node renderer | `webgpu_lights_rectarealight`, `webgpu_volume_lighting_rectarea` |
| volumetric cones and shafts | `VolumeNodeMaterial` ray-marched at quarter resolution, dithered (`bayer16`), blurred (`gaussianBlur`), added; spot shadows read inside the volume | `webgpu_volume_lighting`, `_traa` |
| height and volumetric fog with media | a post pass marching a noise slab under the sun, bilateral-upsampled, blended with range fog | `webgpu_postprocessing_fog` (imports `SunLight`) |
| particles | compute-driven sprites on WebGPU (`storage`, `instanceIndex`, `Fn().compute()`), instanced sprites fed from the CPU on WebGL 2; soft particles against depth; flames, linked and tornado VFX as TSL | `webgpu_particles`, `webgpu_particles_soft`, `webgpu_tsl_compute_attractors_particles`, `webgpu_tsl_vfx_flames`, `_linkedparticles`, `_tornado`, `webgpu_sprites` |
| volume fire, cloud | `VolumeNodeMaterial` with 3D noise | `webgpu_volume_fire`, `webgpu_volume_cloud` |
| motion blur, depth of field, SSS, anamorphic flare | display nodes | `webgpu_postprocessing_motion_blur`, `_dof`, `_sss`, `_anamorphic`, `_lensflare`, `_3dlut` |
| upscaling | `FSR1Node`, `TAAUNode` | `webgpu_upscaling_fsr1`, `_taau` |
| many static draws | `BatchedMesh`, render bundles, occlusion queries | `webgpu_mesh_batch`, `webgpu_performance_renderbundle`, `webgpu_occlusion` |
| water | ocean and water node materials | `webgpu_ocean`, `webgpu_water`, `webgpu_tsl_raging_sea` |

Everything is on the node renderer, so everything lands on the Battlefront world first and on the galaxy's surfaces as lane T flips them.

## The design

Six lanes, each adding one file family to the stack and proving it on the lit fixture (`scripts/light-fixture.mjs` gains a flag per lane) on both backend kinds, with the game's Hoth as the reference wherever lane L's pack is on `main` (its PR #831 is open; its branch is readable).

### Lane S: the sun's shadows, robust

- **Calibration first.** `src/lib/three/light/calibrate.js` (pure): the game's units to the site's in one place, from the record: exposure `2^EV × 1.2 / 2^ExposureCompensation` as the scene's luminance scale, the sun's illuminance from `SunIntensity` (128,000 on Hoth) through it, the sky's `LuminanceScale`, bloom's threshold from `ColorGradingMaxHdrValue`. One factor, `GAME_TO_SITE`, taken from lane G's merged PR (#833 says it), so the classic and the node stacks agree. The test pins Hoth Sunny's sun, sky zenith, fog and bloom numbers; `scripts/light-fixture.mjs --hoth` shoots the fixture under Hoth's entry and the PR shows it beside the game's own Hoth (a frame from `web_opt/movies/` or the owner's screenshot) with the mean luminance within 10 %.
- **Four cascades.** `sun.js` takes `cascades: 4` through `CSMShadowNode` on a `DirectionalLight` (the hand-off's note), the practical split at lambda 0.5, the far at the record's `SunShadowmapViewDistance` per tier (30 m on low to high, 70 m on ultra; the site's ultra takes 140 m, a named constant, since the game's "ultra" was a 2017 console), `SmoothTransitionToDistantShadows` as a blend over the last cascade's final 15 % into lane G's shadow cache (`shadowMask.js`) sampled by the ground and the far instances on the node materials (`shadowNode` multiplied).
- **Soft.** A PCSS filter on the sun's `ShadowNode` (`setupShadowFilter`): blocker search with the record's `SunPcssInitialSampleCount` 8, the penumbra from the sun's `SunAngularRadius` 0.29°, up to `SunPcssMaximumSampleCount` 256 on ultra, 32 on high, PCF on mid; VSM as the fallback where the filter hook is unavailable on `'nodes-webgl'`.
- **The shadow sun.** The record's `ShadowSunRotationX/Y` differs from `SunRotationX/Y`: the shadow is cast from a steeper sun than the light (the game's trick for longer, cleaner shadows at a low sun). `sun.js` casts from the shadow rotation and lights from the light rotation, when the record has both.
- **Cloud shadows.** `clouds.js`: a tiling noise texture (`CloudShadowSize` 8,192 m, `Coverage`, `Exponent`, the secondary layer at 500 m, coverage 0.3, exponent 8) drifting at `CloudShadowSpeed`, multiplied into the sun's shadow term on every lit node material through the stack's `shadowNode`; off on a level whose coverage is 0.
- **Contact shadows** under the figures (a 2 m top-down depth pass per nearby figure, blurred, as `webgpu_shadow_contact`), on ultra and high; the ground darkens under a walker's feet where the cascades cannot resolve it.
- **Particles in shadow**: `ParticleSunShadowFactor` 1 means the snow in the hangar's shaft is lit and the snow in its shadow is not; lane X's sprites sample the sun's shadow (`shadowNode`) when the factor is above 0.

### Lane V: volumetrics, fog and the shafts

- **`volumetrics.js`**: the 56 `SimpleVolumetricsEntityData` cones (emission colour, `Exponent`, `EmissionScale`) and the 74 `FX_Arctic_LightCone_*` spawns (lane X's reader maps them to cones too) as a `VolumeNodeMaterial` on each cone's box, ray-marched at quarter resolution (`webgpu_volume_lighting`), reading the nearest spot's shadow map so a trooper walking through a shaft cuts it; dithered, blurred, added before bloom. Budget: `CONES_LIT` 12 nearest by screen area on ultra, 6 on high, none below.
- **Fog with media**: `fog.js` gains the record's `DepthFogParticipatingMedia` and `HeightFogParticipatingMedia` (scattering, albedo, phase, absorption): a post pass (`webgpu_postprocessing_fog`'s shape) that marches a height slab under the sun with the record's phase, bilateral-upsampled, blended with the range fog the node already does; `fog: 'volume'` in `passesFor` on ultra and high, the plain node elsewhere. Hoth's blizzard weather is the test: the record's media rise and the hangar's door reads as a wall of light.
- **God rays from the real sun**: `GodraysNode` marches a `DirectionalLight`'s shadow map; lane S's four-cascade `DirectionalLight` is that light, so the `rays` helper light goes and the rays read the first cascade.
- **The sun flare from the record**: `flare.js` (lane R's chain has `lensflare` as bloom ghosts) gains the record's `SunFlareComponentData` elements (size and alpha by occluder and screen-position curves, rotation by distance) as a `LensflareNode` configuration, occluded by the depth buffer; the 12 `LensFlareBlueprint`s (explosions, the ion bomb) as event flares through the same node, by name, for lane X's events.
- **Weather as data**: the blizzard's media, the snow wind's strength (`WindStrength 5`, variation 2, turbulence) drive lane X's ambient emitters and lane N's grass through one `wind` uniform `applyGameLight` already exposes.

### Lane X: particles from the game's emitters

- **The reader** (`scripts/lib/bf2017-emitters.mjs`, pure, tested on three fixtures): an `EffectBlueprint` and its `ScalableEmitterDocument`s to one JSON per effect under `src/data/bf2017/fx/<name>.json`: `{ name, cull, maxActive, variants: { low, mid, high, ultra }, emitters: [{ maxCount, lifetime, spawn: { rate, size, speed, direction, position: { box } }, gravity, drag, color: curve, size: curve, alpha: { exponent, curve }, rotation: curve, uv: { frames, modifier }, alignment, stretch, lightWrap, texture, additive, cullDistance }] }` with every curve as its polynomial's coefficients or its random range, and every leaf's `_source`. The CLI `node scripts/bf2017-emitters.mjs <effect|--level hoth>` reads the export on the desktop or the bucket by key and writes the JSON and the texture list; the textures go through phase 0's import to `public/models/galaxy/bf2017/fx/` as sprite sheets (WebP, 1024 on high, 2048 on ultra, 512 below; the grid from the name as lane F planned).
- **The system** (`src/lib/three/particles/`): `emitter.js` (pure: the simulation step for a CPU emitter, so the tests run it: spawn by rate with the box, integrate gravity and drag, evaluate the curves at `EfNormTime`, cull by `MaxSpawnDistance` and `ParticleCullingFactor`), `gpu.js` (the same step as a TSL compute pass over storage buffers on WebGPU, one dispatch per emitter per frame, sprites drawn as instanced quads from the buffers; the CPU step feeds an instanced buffer on `'nodes-webgl'`), `sprites.js` (the quad: `MotionStretchScreen` alignment stretches along velocity by `MotionStretchMultiplier`, `LightWrapAroundFactor` lights the sheet by the sun's wrapped term, soft against depth, the sun's shadow when lane S's factor is on, fog from the node), `effects.js` (`createEffects(scene, renderer, { tier, atlas }) → { spawn(name, at, quat, scale, { autoStart }) → handle, update(dt, camera, wind), stats, dispose }`: the pools per effect, `MaxActiveInstanceCount` and `NearbyRadius` honoured, the variant by tier, nothing drawn past `CullDistance`). One draw per effect kind, never per particle.
- **The level's spawns**: `lights.json`'s sibling `effects.json` beside lane L's pack (`scripts/bf2017-effects.mjs`, rebased like the lights, per cell), spawned and killed with the cells; `autoStart` ones run, the others wait on lane 5's events (an explosion, a vulnerable walker) through `spawn(name)`.
- **Ambient weather** on a level world reads its effects (the falling snow, the dust, the wind) and the site's `weather.js` stands down there; elsewhere `weather.js` stays.
- **Engine exhaust and contrails** attach to the ships lane V (vehicles) and the galaxy's fleets fly: `spawn` takes a parent `Object3D`; `FollowSpawnSource` and `FollowSpawnSourceVelocity` from the emitter say whether the trail follows.
- **Not reproduced**: the 166 `EmitterGraph`s (compiled GPU graphs: the biggest smoke volumes and some fires); each gets the nearest `ScalableEmitterDocument` of the same family by name, said in the JSON as `graph: true`, and the PR lists which. Lane P4's hit effects by material call `spawn(name)` with the material grid's names, so nothing is built twice.

### Lane C: the cameras from the game

- **`src/lib/three/camera/`**, pure poses, one rig: `soldier.js` (`soldierPose(state, rows.soldier, { yaw, pitch, stance, aiming, weaponId, dt, castArm })` exactly as lane 5's plan Task 4 specifies, moved here so the galaxy's surfaces and the game share it; the arm 1.2 on the shoulder side, reduced to 0.5 between pitch 5 and 70, pitch ±55, the collision cast through the physics world's ray (P0) shortened by 0.17 with blend in 5 and out 3 per second, the cull distance by stance fading the player's own body), `aim.js` (the zoom levels' FOV 55 eased at the weapon's zoom speeds), `vehicle.js` (the transformer chain: pitch limits per seat, yaw and pitch inertia 0.8 with input and 0.5 without, the velocity redirect), `overview.js` (the deploy and outro cameras: 35 mm on a 36 mm frame, the one facing the objective), `rig.js` (`createCameraRig(camera, { recoil, shake })`: recoil as a damped spring on pitch, `ShakeFactor` from blasts and walkers' steps as a decaying noise on position and roll, `SoundListenerFov` for the audio bus's listener), `cinematic.js` (a camera's `FocalLength`, `Aperture`, `FocusDistance` to the post's `dof` pass: `{ focus, aperture, maxblur }`, on for the deploy and end cards and off in play).
- **Motion blur and depth of field as the record says**: `passesFor` takes `motionBlur` from the weather's `MotionBlurEnable`/`MotionBlurScale` (on ultra and high; camera-only blur, never per object, as the record's `MotionBlurCentered false` and the game's option default), and `dof` only when `cinematic.js` asks.
- **The galaxy's surface** takes `soldierPose` for the walker where `site.level` is set (behind the field, like the light and the ground), so Hoth's camera is the game's camera on day one, and the other worlds keep theirs until they are on packs.
- **Robustness tests**: the camera inside a wall (the ray), the camera through the floor (the ground's height is a floor for the arm), a pitch flip at ±55, a 10 s walk against a corner with no jitter (the blend), a vehicle seat change mid-inertia, a FOV change during a zoom; all pure, all in `camera.test.js`.

### Lane N: the ground alive (terrain scatter)

- `scripts/bf2017-scatter.mjs <world>` reads `maps/terrain_scatter/<terrain>.json` and writes `scatter.json` beside lane L's pack: per layer its types (mesh cut through phase 0's import, density per tier, scale range, wind params, dissolve), and where to scatter: the layer masks are not exported (the README: the quadtree's deep tiles' order is unsolved), so the layer is painted by its `surfaceShaders` textures' match against the terrain's own colour map plus slope and height rules, per world, said in the JSON as `mask: 'derived'`, replaced by the real masks when the export solves them.
- `src/lib/three/scatter/`: `grid.js` (pure: a cell's instances from the layer's density and the derived mask, seeded, so a cell is the same every visit), `wind.js` (the game's `WindScale`, `Stiffness`, `Damping`, `WindWiggle` as the vertex sway, on lane T's `foliageNodes` twin), `scatterScene.js` (one `InstancedMesh` per type per cell, the dissolve by distance, cast shadows within the first cascade only).
- Density is per tier from the record's own `Density` per quality level; ultra takes the record's `Ultra`.

### Lane U: headroom (upscaling and batching)

- `FSR1Node` and `TAAUNode` in the chain as `upscale: 'fsr1' | 'taau'` with the internal resolution at 0.67 on high and 0.77 on ultra at 4K, the pace controller's first step before shedding passes; `BatchedMesh` for lane L's static cells (one draw per material per cell band) and render bundles round the far list; occlusion queries on the hangar's walls. Measured on the perf probe; ships only with the table.

### Quality

The owner's rule holds: ultra on a laptop or desktop with a graphics chip restricts nothing. Each lane's budget constants (`CONES_LIT`, the PCSS sample counts, the particle variants, the scatter density) take the record's `Ultra` where the record has tiers and a named constant where it does not; the pace controller sheds in `post.js`'s order, then the lanes' budgets, then the record's `High`.

### Rules kept

- Every number from the records (`_source` on every leaf of a rulebook; a constant the records lack is named with a comment).
- The stack (`src/lib/three/light/`, `particles/`, `camera/`, `scatter/`) is `src/lib/**`: pure where it can be, three where it must, no world code, tests beside, files under 800 lines, every addon import dynamic and in one place.
- A lane proves itself on the lit fixture on both backend kinds before it touches a world; the galaxy's surfaces take it behind `site.level`; the Battlefront world takes all of it through `applyGameLight` and the new `createEffects`, `createScatter`, the camera poses.
- Compare on the shot: before/after in `docs/superpowers/evidence/galaxy-engine/<lane>/`, and for lane S the game's own Hoth beside the fixture.
- One lane per PR; `origin/main` merged before and after; both sides kept in `scene.js`.

### What this design does not do

- No decals from hits (P4), no ragdolls (P2), no bolts (P2), no vehicles' bodies (P3): the physics design's.
- No placed volume decals (Hoth has none; 13,984 across the maps): lane L's pack when a world with them is packed.
- No water from `WaterAsset` (a physics mesh only; the look is the site's `water.js` until lane T's twin).
- No cloth (an EA binary), no `EmitterGraph` simulation, no Enlighten.
- No audio (not exported).

## Lanes

| lane | what | branch | owns | needs |
| --- | --- | --- | --- | --- |
| S | calibration, four soft cascades, the shadow sun, cloud and contact shadows, particles in shadow | `claude/fidelity-s-shadows` | `light/calibrate.js`, `light/sun.js` (additive), `light/clouds.js`, `light/contact.js`, `light/shadows.js`, `scripts/light-fixture.mjs` (`--hoth`, `--shadows`) | lane G's factor (#833, merged) |
| V | volumetric cones and shafts, fog with media, god rays off the real sun, the sun flare and event flares from the records | `claude/fidelity-v-volumetrics` | `light/volumetrics.js`, `light/fog.js` (additive), `light/flare.js`, `light/post.js` and `passes.js` (`fog: 'volume'`, `motionBlur`, `dof`: additive) | S for the cascade light (reads its branch; stubs on `rays` until then) |
| X | the emitter reader, the particle system on both backends, the level's `effects.json`, ambient weather, exhaust and contrails | `claude/fidelity-x-particles` | `scripts/bf2017-emitters.mjs` (+ lib, tests), `scripts/bf2017-effects.mjs`, `src/data/bf2017/fx/`, `src/lib/three/particles/`, `public/models/galaxy/bf2017/fx/` | nothing (the export on the desktop or the bucket) |
| C | the cameras: soldier, aim, vehicle, overview, rig, cinematic; motion blur and DOF from the record; the surface's walker on it behind `site.level` | `claude/fidelity-c-cameras` | `src/lib/three/camera/`, `surface/scene.js` (the camera call site: additive) | `cameras.json` (merged); P0's ray (reads its branch; a height-only cast until then) |
| N | terrain scatter from the game's tables | `claude/fidelity-n-scatter` | `scripts/bf2017-scatter.mjs`, `src/lib/three/scatter/`, `scatter.json` beside the pack | lane L's pack (#831) and lane T's `foliageNodes` |
| U | upscaling and batching | `claude/fidelity-u-headroom` | `light/post.js` (`upscale`), lane L's `levelScene.js` (BatchedMesh: with L) | L merged; the perf probe on the owner's laptop |

S, V, X and C start now on disjoint files. N after L and T's twins; U after L. The Battlefront world's lane 5 starts after S and C and takes everything through the stack; its plan's Task 4 (cameras) is lane C's.

## Open assumptions, marked

- **B1.** `ShadowNode`'s filter hook takes a PCSS kernel on r186 (the forum's `setupShadowFilter` wrap is the evidence); if not, VSM with the record's sample counts as blur samples, said in the PR.
- **B2.** `GodraysNode` reads the first cascade of a `CSMShadowNode` light; if it reads only a plain shadow map, lane R's `rays` helper stays.
- **B3.** The emitter JSON's curves (cubic polynomials over normalised time) reproduce the game's look for the quad emitters; the ribbon and mesh emittables (`EmittableType_Mesh`, trails) are a second task after the quads.
- **B4.** The scatter masks stay unexported; the derived mask by surface textures, slope and height reads right on Hoth (snow everywhere, rock on the ridges) and Endor (ferns under the trees); a wrong world ships without scatter and says so.
- **B5.** The cloud's software WebGPU device dies on the fixture (lane R's note); every lane's WebGPU leg runs on the owner's laptop and the PR carries the WebGL 2 leg from the cloud with the laptop's table added by the owner or the next session.
