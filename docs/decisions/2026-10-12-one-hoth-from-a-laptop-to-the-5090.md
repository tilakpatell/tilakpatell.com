# One Hoth from a laptop to the 5090: the budget a tier draws to

**Date:** 2026-10-12 · **Status:** accepted · **Where:** `src/lib/three/gpuScene/draws.js` (the first lever), `src/lib/device.js` (the tiers), `src/runtime/quality.js` (the pace), `src/lib/three/light/post.js` (the chain), `src/components/battlefront/module.js`

## The goal

The owner's words: a laptop without a GPU runs Hoth at 30 fps (looking rough is fine); an RTX 5090 runs it past 60 fps smooth at AAA quality. One level, one set of records, four tiers; what each tier draws is written here as a budget, and every number below is from a run named in the table, not an aim.

## The measurements

Headless Edge 2026-10-12, the branch `claude/bf-perf-tiers` before the lever (the harness: `.scratch-check/bf-tiers.mjs`, from the main worktree's `bf-profile2.mjs`; the steady frame is the 4 s after a deploy and 30 s of battle, the view and the two near cascades every frame, vsync off). The GPU rows are the owner's RTX 5090 at 2,560 × 720 at a ratio of 2 (5,120 × 1,440 drawn, 7.4 million pixels, under the 4K start so the internal scale is 1); the SwiftShader rows stand in for a laptop with no graphics chip (Edge's `--use-angle=swiftshader --use-webgpu-adapter=swiftshader`, a CPU rasteriser) at 1,280 × 720 at a ratio of 1. `frame` is the interval between the world's draws (p50 / p95); `draw` the main thread's time in `world.draw` (p50); `chip` three's render timestamps (`info.render.timestamp`, the GPU's own clock); `pace` the controller's level (`quality.level`, on the GPU clock where it has one).

| run | tier | backend | frame p50 / p95 | draw p50 | chip | draws | tris | programs | chain | pace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpu-ultra | ultra | webgpu | 46.0 / 184 ms | 33.0 ms | 7.3 ms | 708 | 6.5 M | 659 | render · ssgi · ao · ssr · bloom · lensflare · tonemap · lut · traa · output | 0 (gpu) |
| gpu-high | high | webgpu | HIGH_FRAME | HIGH_DRAW | HIGH_CHIP | HIGH_DRAWS | HIGH_TRIS | HIGH_PROGRAMS | HIGH_CHAIN | HIGH_PACE |
| gpu-mid | mid | webgpu | MID_FRAME | MID_DRAW | MID_CHIP | MID_DRAWS | MID_TRIS | MID_PROGRAMS | MID_CHAIN | MID_PACE |
| gpu-low | low | webgpu | 7.3 / 12.1 ms | 6.3 ms | 0.6 ms | 231 | 1.46 M | 180 | render · bloom · tonemap · lut · output | 0 (gpu) |
| sw-mid | mid | SW_MID_BACKEND | SW_MID_FRAME | SW_MID_DRAW | SW_MID_CHIP | SW_MID_DRAWS | SW_MID_TRIS | SW_MID_PROGRAMS | SW_MID_CHAIN | SW_MID_PACE |
| sw-low | low | nodes-webgl | 21.4 / 6,177 ms | 14.6 ms (mean 664) | — | 233 | 1.45 M | 190 | render · bloom · tonemap · lut · upscale 0.5 (FSR1) · output | 4 (cpu, floored) |

The reports, screenshots and CPU profiles of each run are under `.scratch-check/tiers/<run>/` in this branch's worktree (not committed: `report.json`, `field.png`); the main worktree's `profile13` and `profile14` are the same harness's earlier readings (18.2 ms draw at ultra on the instanced path, 16.3 ms on `?level=gpu`, the day the frame guard landed).

What the ultra profile says (the CPU profile over the steady 4 s): 26 % in the renderer's native side (`(program)`), 15.6 % in `WGSLNodeBuilder.getUniforms` (shader builds still running off the frame as cells stream in round the walking player: 659 programs by then, the frame guard's deferred builds), then the per-draw path, `updateByType` 5 %, `updateMatrixWorld` 3.8 %, `writeBuffer` 3.7 %, `NodeMaterialObserver.update` 3.7 %, `_projectObject` 2.5 %, `_renderObjectDirect` 2.2 %. At low the same per-draw path is the whole cost (`updateByType` 10.3 %, `updateMatrixWorld` 6.3 %, `_renderObjectDirect` 5.5 %, `writeBuffer` 5.5 %): 231 draws cost 6.3 ms, 27 µs a draw, the same 29 µs a draw the frame guard's decision measured. The chip is never the limit on the 5090: 7.3 ms at ultra for 7.4 million pixels through the full chain, 0.6 ms at low.

## The budget a tier draws to

A frame at 60 fps is 16.7 ms; at 30 fps 33.3 ms. The sim's step is 0.5 ms a frame (lane X2's measurement) on every tier and is left out of the rows below. `draw` is main-thread JavaScript in three's node renderer, `chip` the GPU's time; on WebGPU the two overlap, so the frame is the larger of them plus the sim and the browser's own work (about 2 ms a frame at 5,120 × 1,440 for the compositor and the HUD's React, read from the frame's gap over the draw at low).

| tier | screen | pixels drawn | draw CPU | chip | chain | cascades | figures | level | ground | sky |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ultra | the screen's own pixels, ratio ≤ 2, no supersampling; at 4K and over starts at 0.77 and TAAU brings it up | ≤ 8.3 M | ≤ 10 ms | ≤ 10 ms | the full ten: ssgi (high, temporal) · ao · ssr · bloom (the record's five Gaussians) · lensflare · tonemap · lut · traa; volumes and fog where the record has them; motion blur where its record says | 4 × 2,048, the far two every fourth frame, shadow far 70 m of the record's view distance | every soldier in view, one skeleton a body, the lod1 pack (5 parts, 15 maps), ragdolls 6 | the GPU scene's indirect draws (lever 1) at the ultra cut, LOD cap none, K the pack's fitted reach | the game's snow layers (branch `claude/bf-ground-snow`): the near band at 4 m, the far at 32 m | the RGBA16F panorama (#949) at the record's luminance |
| high | the screen's pixels, ratio ≤ 2; 0.67 at 4K | ≤ 8.3 M | ≤ 10 ms | ≤ 8 ms | ssgi (medium) · ao · ssr · bloom · tonemap · lut · traa | 4 × 2,048, cadence on, shadow far 30 m | as ultra, ragdolls 6 | the GPU scene at the plain cut, LOD cap 12,000 | the same two bands | the HDR panorama |
| mid | ratio ≤ 1.5 | ≤ 4.1 M at 1440p | ≤ 12 ms | ≤ 12 ms | ao · bloom · tonemap · lut · smaa | 2 × 1,024 | as above, ragdolls 4 | the instanced path at lod1, LOD cap 6,000 | the near band only; the far band a flat colour | the LDR panorama |
| low | ratio 1 | ≤ 2.1 M at 1080p | ≤ 25 ms | ≤ 25 ms | render · bloom · tonemap · lut (what it draws today; the no-GPU tier below sheds the bloom too) | none | as above, ragdolls 2 | the instanced path at lod1, LOD cap 2,500, half the horizon | a flat colour on both bands | the LDR panorama |

The tiers are `lib/device.js`'s (`BUDGETS`: the ratio, the samples, the shadow map; `tier` is `low`, `mid` or `high`, `detail` adds `ultra`), the chains `light/post.js`'s `TIERS`, the cascades `light/sun.js`'s `cascadesFor` (4 × 2,048 on ultra and high, 2 × 1,024 on mid, none on low), the level's cut and reach `lib/level/bands.js` and `lib/level/lod.js` (`LOD[tier].cap`), the ragdolls `figures/ragdolls.js`'s `RAGDOLLS`, the pace `runtime/quality.js` (the internal resolution's steps 1 · 0.77 · 0.67 · 0.5, then `post.js`'s `SHED`: ssgi, ssr, god rays and flare, ao). The game's own presets per option are not in the study yet (`bf2-re/findings/40-settings-and-quality.md` does not exist on 2026-10-12; finding 21 gives the quality-scalable counts, `QualityScalableInt/Float` on the shadow resolutions, `SunShadowmapViewDistance` and the decal and sky caps, and the LOD tables the cull should read: `CullScreenArea × 2.2`, the `MeshLodGroup` distances), so the rows above are the site's own, to be checked against finding 40 when it is written.

## The three levers, in order of value

**1. The GPU scene's texture lifetime (done here).** `?level=gpu` draws Hoth's level as one indirect draw a material group from a storage buffer culled by compute (lane N1, `levelGpu.js`), with the static groups in one `BundleGroup`: 237 draws and 16.3 ms where the instanced path drew 722 and 18.2 ms (profile14 against profile13), and the frame's draw count no longer grows with the level. It failed with `Destroyed texture used in a submit` because the level loader promotes every map from its first row to the tier's by disposing the texture and swapping its source (`levelGltf.js`'s `swapInto`; three uploads a disposed texture again on its next draw, and the per-object path never noticed), while a render bundle records its bind groups when it is made, and a bind group names the GPU texture that the dispose destroyed. The fix is `draws.js`'s `watchTextures`: each group hears its maps' `dispose` and asks the bundle to record itself again, which the next frame does with the map uploaded anew (`_renderBundle`'s update path runs the full object update, `three.webgpu.js`). Measured after the fix: GPU_AFTER. GPU_DEFAULT.

**2. Fewer skinned draws a soldier.** A body is one GLB of 2 meshes, 5 primitives, 5 materials (body, glove, helmet, cape, backpack) and 15 maps (colour, normal, ORM a part), on one skeleton since the frame guard's decision: 17 soldiers are 85 skinned draws into the view and each near cascade (255 draws a frame, 7 ms at 27 µs). A `Mesh` with a material array still draws one group a material (three issues a draw a group), so the pack's material array saves nothing. What saves the draws is one material a body: either the five parts' maps as a `DataArrayTexture` of five layers a kind with the part's layer as a vertex attribute (the pack allows it where a body's five maps are one size, which the lod1 cut's are: the GLB's images are the game's `_cs`, `_nm__normal` and `_nm__orm` at the body's size), or an atlas re-baked offline with the UVs rewritten (a pack change, `scripts/bf2017`). Estimated gain: 85 → 17 draws a pass, 5.5 ms a frame at ultra; measured when the lane runs. The command to measure it is the harness with `QUALITY=ultra` and the figures' stats in `view().entities`.

**3. The per-draw JavaScript in three.** Every draw costs 27 to 29 µs on the main thread whatever its size: `RenderObject.updateByType` walks the material's uniform groups and refreshes each uniform's value, `NodeMaterialObserver.update` compares the object's state against the last frame's, `writeBuffer` sends each object's uniform buffer, `updateMatrixWorld` and `_projectObject` are three's scene walk. For the level a bundle halves it: the static groups' bundle records the draw once and replays it (the GPU scene's groups), so `updateByType` and `writeBuffer` run only for the objects outside the bundle; the refresh path in `_renderBundle` still walks each object for `needsRefresh`, which is why 237 draws still cost 16 ms on the GPU scene's first reading and why the figures and the chain's own quads are the floor. Beyond the bundle, the way down is fewer objects: the material groups as texture arrays (a dozen programs where there are 659) and the soldiers as one draw each (lever 2).

## The no-GPU tier

SwiftShader is Edge's CPU rasteriser (Dawn over SwiftShader Vulkan for WebGPU, ANGLE over SwiftShader for WebGL 2); the site's `lib/gpu.js` reads it as `software`, which puts the device at `low` under Auto. What it draws in 33 ms: SW_WHAT.

The tier's shape, from the rows above and the runs: a plain-lit scene with no chain (the bloom, the tonemap and the LUT as one output pass, not three), no cascades, the figures at the lod1 pack and the level's instanced path with its far band only and the horizon halved, a 720p buffer. The lanes below carry it.

## Lanes left

| lane | what | command |
| --- | --- | --- |
| T1 | `?level=gpu` the default on WebGPU at high and ultra once its cull draws every row the instanced path draws (the two paths' `level.stats()` compared on a walk) | `VIEW=2560x720@2 QUALITY=ultra GPU=gpu EXTRA="&level=gpu" node .scratch-check/bf-tiers.mjs` against the same without `EXTRA` |
| T2 | one material a body: the five parts' maps as a `DataArrayTexture`, the part's layer as an attribute, the five primitives merged on the one skin | the harness at ultra, `steady.info.drawCalls` and the figures' pass draws |
| T3 | the level's material groups as texture arrays by size (the N1 note's route under 40 draws): a dozen programs, the frame guard's builds gone from the steady frame | the harness, `cpu.self` without `getUniforms`, `mem.programs` |
| T4 | the no-GPU tier: `low` on a software adapter sheds the bloom pass and the LUT into the output, draws the far band only, a 720p buffer (`BUDGETS.low.ratio` 1 and a cap on the drawing buffer) | `VIEW=1280x720@1 QUALITY=low GPU=sw node .scratch-check/bf-tiers.mjs`, `steady.frameP50` ≤ 33 ms |
| T5 | the game's presets as the rows' reference once `bf2-re/findings/40-settings-and-quality.md` exists: what low/medium/high/ultra change, against the table above | read-only |
| T6 | the ground's two bands on each tier when `claude/bf-ground-snow` lands: the near band's layers at ultra and high, the far band flat on mid, both flat on low | the harness at each tier, `passes` for the ground's draws |

## Revisit when

- Finding 40 is written (T5).
- The GPU scene is the default (T1): the ultra row's `draw` budget becomes the figures' and the chain's alone.
- three fixes the per-object path (#30560) or ships a refresh that skips static objects in a bundle.
