# No frame waits for a shader on WebGPU; a soldier is one skeleton and one sphere

**Date:** 2026-10-12 · **Status:** accepted · **Where:** `src/lib/three/pipelineGuard.js`, `src/runtime/webgpu.js`, `src/lib/three/gltfCache.js`, `src/components/battlefront/figures/figures.js`, `src/components/battlefront/map/level.js`, `src/components/galaxy/surface/level/levelGpu.js`

## The problem

Hoth at ultra on the owner's desktop (an RTX 5090, 5120 × 1440) loaded in 20 to 25 s, hitched for seconds as it loaded and again as the first soldiers arrived, and drew at 27 ms a frame after. The chip was not the limit: its own clock said 9 ms a frame. The time was the main thread's, measured in headless Edge on the real device (`.scratch-check/bf-profile2.mjs`, a CDP profile of the steady frame):

- **Shader builds inside the frame.** three's node renderer builds an object's shader the first time it is drawn (TSL to WGSL, 30 to 90 ms of JavaScript for a lit level material) and then makes its pipeline with `createRenderPipeline`, where the browser compiles it for the chip and the frame waits again. The level streams in a few new materials a frame, so 14 s of the 20 s load were inside such frames, a 4.5 s one came with the soldiers, and a hundred-odd frames of 100 to 800 ms followed as cells came in round the player. Every instanced mesh is its own program on this renderer (`RenderObject.getMaterialCacheKey` keys an `InstancedMesh` by its uuid, because the instance buffer is captured in the built node state), so Hoth is some 700 programs.
- **Per-draw JavaScript.** 954 draws a frame at about 30 µs each: the level's 160 instanced meshes, and 17 soldiers of 7 skinned parts each drawn into the view and two cascades every frame, culled by nothing (`frustumCulled` was off on every part, because three's own bound of a skinned part is its bind pose). The soldiers were 378 of the 954 draws, more than the level.
- **Six skeletons a body.** `SkeletonUtils.clone` gives every skinned part of a copy a `Skeleton` of its own: a body of six parts on one skin had six, six bone-matrix updates and six bone textures a frame for one pose, 101 skeletons for 17 soldiers.

## The decision

1. **A frame guard for the node renderer** (`guardPipelines`, on every WebGPU renderer the runtime makes; the WebGL 2 backend is left alone). Two paths three has already, turned on for every draw: an object whose shader is neither built nor cached under its key is left out of the frame, and once the frame is over its build is queued with `Nodes.getForRenderDeferred` (`buildAsync`, one at a time, yielding to the browser between its stages); and `Pipelines.getForRender`, asked with no promise list, is given one, so the pipeline comes from `createRenderPipelineAsync` and `_renderObjectDirect` skips the draw until it is ready. The builder asks its renderer for the render target and the MRT as it builds, and off the frame those are not the object's pass, so each deferred build gets a stand-in renderer (`rendererAs`) that answers with the pass the object was drawn in and hands everything else to the real one. The stand-in pairs a set of the pass's target with the real renderer's own put back: the PMREM generator, run inside a build, saves the target it is told and restores it, and told the pass's it put the pass's target on the real renderer between frames (the chain then drew its final quad into the lit target). A pass's override material (the shadow depth material, whose nodes three swaps per object inside the draw) and a post pass's own quad keep the frame's build.
2. **One skeleton a body**: `cloneScene` keeps the parts that shared a skeleton in the original sharing one in the copy.
3. **One sphere a body**: a soldier's parts are culled by one sphere round the body (`BODY_REACH`, 2.5 m at the body's middle), carried into each part's own frame, so a part off screen, or outside a cascade's slice, is not drawn. The held gun is culled by its own bounds at the hand.
4. **The GPU scene is wired, not yet the default.** `?level=gpu` puts Hoth's level on GPU-first lane N1's scene (`createLevelScene({ gpuScene: true })`, the cull's camera now carried into the level group's frame, `localCameraOf`). It draws 238 draws and 11 ms a frame where the instanced path draws 722 and 18 ms, but on Hoth its cull keeps every row out (5,813 of 6,050 culled, nothing drawn) and the textures its groups hold are disposed under them (`Destroyed texture used in a submit`); lane L's instanced path draws until that is found.

## The measurement

Headless Edge on the RTX 5090, 5120 × 1440 at ultra, `.scratch-check/bf-profile2.mjs` (the steady frame after a deploy and 30 s of battle):

| | before | after |
|---|---|---|
| loaded | 20.4 s | 13.8 s |
| frames over 50 ms while loading | 15, 13.9 s in all | 5, 0.6 s in all |
| frames over 50 ms after the deploy | 40, the worst 4.5 s | 0 |
| draw (CPU, median) | 26.7 ms | 18.2 ms |
| draws a frame | 954 | 722 |
| the chip's frame | 9.6 ms | 9.2 ms |
| programs | 710 | 676 |
| skeletons | 101 | 26 |
| page errors | 0 | 0 |

The picture is the same: `.scratch-check/profile13/field.png` against `profile2/field.png`.

## What is left

- The per-draw cost is three's node renderer's (`updateByType`, `writeBuffer`, `updateMatrixWorld`: 29 µs a draw). The way down is fewer draws: the GPU scene for the level (above), and the soldiers' seven parts as one.
- The programs: every instanced mesh its own, 60 to 90 ms a build. Texture arrays by size with a per-part material row (the N1 note's route under 40 draws) would make the level a dozen programs.
- The ground is a flat colour (`map/ground.js`: the game's terrain colour under packed snow's albedo, no map, no detail), and the cells' meshes pop in; both the game's terrain layers and lane L's LOD fade.
