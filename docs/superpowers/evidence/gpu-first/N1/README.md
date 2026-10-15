# GPU-first lane N1: the GPU scene, the evidence

The plan: `docs/superpowers/plans/2026-10-11-gpu-first-laneN1-gpu-scene.md` (on `claude/gpu-first-renderer`, PR #915). The design: the spec's §4 "N1". Branch `claude/gpu-n1-scene`.

## What was built

- `src/lib/three/gpuScene/` (knows three, no world): `pack.js` (a row is 32 bytes: position f32 × 3, the quaternion and three scales as f16, the mesh id and flags), `scene.js` (the rows appended and freed by cell, a freed row dead by flag in place), `lodRule.js` (lane L's `lodAt` once in JavaScript and once in TSL), `hzb.js` (the depth pyramid, by compute), `cull.js` (the rules and their CPU twin), `cullPass.js` (three TSL dispatches a frame: reset, cull, finalize, into one `IndirectStorageBufferAttribute`), `draws.js` (one `Mesh` a material group, a sub-draw a part, the row pulled by `instance_index`, a `BundleGroup`, the occluders' depth prepass), `lodFade.js` (the dithered crossfade), `three.js` (three's hooks in one file).
- The level's third path: `createLevelScene({ gpuScene: true, renderer })` routes to `surface/level/levelGpu.js` on a renderer that draws indirect (WebGPU with `indirect-first-instance`); lane L's and lane U's paths are untouched and draw everywhere else.
- The fixture's stress: `node scripts/light-fixture.mjs --gpuscene` (3,000 pillars and crates, `src/runtime/fixtures/gpuSceneField.js`).
- `scripts/level-draws.mjs`'s third column; `scripts/gpu-scene-parity.mjs` (the compute pass and the draws on a real WebGPU device against their CPU twin and an InstancedMesh).

## Where the code differs from the plan (the code wins; each said here)

| plan | code | why |
|---|---|---|
| a row: one scale, a radius, a group | three scales; the radius from the mesh's bounds; the group a part's | Hoth's far table holds 23 unevenly scaled rows (`readInstances` over `far.bin`); a GLB mesh has a part a material, so the group is the part's, not the row's |
| `indirect: Map<groupKey, IndirectStorageBufferAttribute>` | one attribute for every slot, camera then shadow | the research note: Dawn on D3D12 runs a validation dispatch per distinct indirect buffer |
| a mirrored group `DoubleSide` | a mirrored mesh's parts carry their triangles again wound the other way: a second sub-draw of the same Mesh | `DoubleSide` would flip a back face's normal again (`levelScene.js`'s note on `flipped`); FrontSide holds and the picture is lane L's |
| the depth pyramid from last frame's depth | from a depth prepass of last frame's visible rows drawn with this frame's camera | last frame's depth seen from a camera that has moved hides what has just come into view; the prepass is the occluders where they are now, so occlusion stays conservative (nothing visible disappears). Fading and cut-out rows never occlude |
| the shadow pass draws what the camera's cull drew | a second list: every row within lane T2's `SHADOW_REACH` (260 m), in view or not, occluded or not | a caster behind the camera or a wall still throws a shadow the camera sees; `onBeforeShadow` swaps the group's offsets to it |
| `GPU=webgpu node scripts/perf-probe.mjs hothWalk` | no `hothWalk` journey exists (`perf-probe.mjs --list`); `surface` is Tatooine | the Hoth walk is measured once T2 lands and the level is wired (below) |

## The cloud's proof (SwiftShader, 2026-10-11)

The cloud's SwiftShader gives a WebGPU device that computes and draws offscreen (its canvas loses the device, `scripts/gpu-parity/README.md`), so the pass and the draws were proved here; the frame times are the laptop's.

**The tests.** `npx vitest run src/lib/three/gpuScene src/components/galaxy/surface/level`: 130 (`_source`: this branch, 2026-10-11). Among them: `lodIndex` equals `lodAt` on 10,000 seeded random instances; the pyramid's CPU twin culls a sphere behind a wall and keeps one in front; dead rows skipped; no pyramid, no occlusion; the file held while its LOD comes; a 16-texture material refused; a mirrored part's triangles wound back; the fade's two sides complementary over a 32 × 32 tile.

**The compute pass against its twin** (`node scripts/gpu-scene-parity.mjs`, 3,000 rows over three meshes, 145 freed, a mirrored share; `_source`: the run on this branch's head):

| frame | keys | listed | of them fading | shadow | lists differ | shadow lists differ | files differ | args wrong | stats GPU / CPU (tested, culled, occluded, drawn) |
|---|---|---|---|---|---|---|---|---|---|
| no pyramid | 11 | 1659 | 0 | 1015 | 0 | 0 | 0 | 0 | 2845, 1186, 0, 1659 / 2845, 1186, 0, 1659 |
| moved: the fades | 11 | 1912 | 1 | 662 | 0 | 0 | 0 | 0 | 2845, 934, 0, 1911 / 2845, 934, 0, 1911 |
| a file arrives | 11 | 1912 | 1 | 662 | 0 | 0 | 0 | 0 | 2845, 934, 0, 1911 / 2845, 934, 0, 1911 |
| a wall at 30 m | 11 | 11 | 0 | 662 | 0 | 0 | 0 | 0 | 2845, 1694, 1140, 11 / 2845, 1694, 1140, 11 |

**The draws against lane L's InstancedMesh** (the same run: 400 crates and huts, a fifth of the crates mirrored, drawn offscreen at 320 × 180): the GPU scene in 2 groups (9 sub-draws) against 5 InstancedMeshes; mean difference 0.01 of 255, max 73 (one edge pixel), 0.02 % of pixels off by more than 8. The two pictures: `draws-gpuscene.png`, `draws-instanced.png`.

**Hoth's draws through the scene's own code** (`node scripts/level-draws.mjs hoth --tier <tier> [--own]`, the pack fetched from the bucket by hash; at the arena's middle, the other spots in `draws-hoth-*.md`; `_source`: the runs on this branch):

| tier, materials | instanced (lane L) | batched (lane U) | GPU scene (N1) | its sub-draws | triangles, every path |
|---|---|---|---|---|---|
| ultra, shared maps | 209 | 80 | **69** | 209 | 2,309,478 |
| high, shared maps | 183 | 78 | **67** | 183 | 1,651,470 |
| ultra, each material its own key (`--own`) | 209 | 230 | 209 | 209 | 2,309,478 |

The triangles are equal on all three paths at every spot: the GPU scene's LOD cut is lane L's. One draw a group means a group's LODs, files and mirrored copies ride as sub-draws of one indirect draw, never a draw call of their own.

**The gate's draw count (under 40) is not met by keys alone.** Hoth's 231 files hold 70 material keys but only 11 material shapes (the same type, attributes, flags and map slots, differing in their maps and scalars): the route under 40 is the spec's texture arrays by size with a per-part material row, about 11 draws. And on the node renderer the game materials carry no `userData.batchKey` yet, so each keys itself and the GPU scene draws as many as lane L (the `--own` row); lane U found the same for its batches. Both belong to the materials (lane M2, Q1's `createGameMaterial`, `levelGltf.js`'s swap), noted in the hand-off.

**The fixture, the fallback** (`node scripts/light-fixture.mjs --gpuscene --legs webgl --size 800x450 --ms 2000`): on the node renderer over WebGL 2 the path is not taken: the field draws through lane L's path, `{"path":"instanced","draws":5,"rows":3000}` from the ring and over the field, no page errors, the programs 74 → 74 while a light moves; the frame (5,311 ms mean) is SwiftShader's CPU and says nothing (`gpuscene-lit-ultra.json`, `gpuscene-lit-ultra-webgl.png`, `gpuscene-lit-ultra-webgl-field.png`; `_source`: the run on this branch, 2026-10-11). The webgpu leg needs a canvas, which loses SwiftShader's device: the laptop's (below).

## For the owner's laptop (RTX 5090, Edge, `ANGLE=d3d11`)

The cloud cannot time a frame. The commands, each to be run on `claude/gpu-n1-scene` (and once on `main` for the before), with what to write in the table below:

```
# the fixture: frame times with the GPU scene, both legs, at both sizes
node scripts/light-fixture.mjs --gpuscene --legs webgpu,webgl --tier ultra --size 1600x900
node scripts/light-fixture.mjs --gpuscene --legs webgpu,webgl --tier ultra --size 3840x2160
#   → gpuscene-post-ultra.json: mean, median, p95 ms; the row's gpuScene (draws, indirect, culled, occluded, drawn)

# the compute pass and the draws on the laptop's own chip
node scripts/gpu-scene-parity.mjs --shots docs/superpowers/evidence/gpu-first/N1/laptop

# Hoth's draws (no GPU needed; the pack from the bucket)
node scripts/level-draws.mjs hoth --tier ultra
```

The Hoth surface rows wait on two seams: lane T2 (Hoth on `'nodes'`) and the level's call taking the path, one change where the world makes its level (`surface/level/index.js`'s `createLevelScene`, and lane U2's `battlefront/map/level.js`): pass `gpuScene: true, renderer` and call `level.beforeRender?.(camera)` each frame before the scene is drawn. Then `GPU=webgpu node scripts/perf-probe.mjs <the Hoth journey>` before and after, and `node scripts/gpu-parity.mjs /galaxy/hoth/surface --before origin/main` on the hangar, the trench and the ridge.

| measure | where | gate | before (`main`) | after (N1) |
|---|---|---|---|---|
| draws, Hoth ultra | `level-draws.mjs` | under 40 | 209 | 69 (above) |
| fixture frame, 1,600 × 900, webgpu | `light-fixture.mjs --gpuscene` | | | |
| fixture frame, 3,840 × 2,160, webgpu | `light-fixture.mjs --gpuscene` | | | |
| `render()` on the main thread, Hoth | `perf-probe.mjs` `main` column | under 2 ms | | |
| GPU frame, Hoth (G1's clock) | `perf-probe.mjs` | no higher than lane U's | | |
| parity, three poses | `gpu-parity.mjs` | its thresholds | | |

## The laptop, 2026-10-12: Hoth on the GPU scene by default

The owner asked for the whole site to run on the GPU ("make the entire site dependent on GPU not the CPU"). The Battlefront world's level had the GPU scene behind `?level=gpu` since #947; on the owner's RTX 5090 (Edge, headless, `--enable-unsafe-webgpu --use-angle=d3d11`, 1,600 × 900, `tp-quality` ultra, `Math.random` seeded so both runs roll the same day and battle) it drew a different picture from lane L's instanced path, for three reasons, each fixed here:

1. **Every draw slot read key 0's rows but the last one set in a frame.** `cullPass.setSlot` sent each slot's key with `upload()`, which keeps one update range a call (`clearUpdateRanges` first), so a group whose parts were set together (`draws.js`'s rebuild sets all of a group's slots in one go) sent only its last slot's key; the others kept 0 and drew key 0's list with their own mesh. On Hoth that took most rocks off the ridge and drew their meshes at another key's rows (a red-painted rock group showed one speck far from its rows). The keys set since the last run now go up as one span (`three.js`'s `widen`), at the run. `cullPass.test.js` fails on the old code (`[{ start: 5, count: 1 }]` against `[{ start: 1, count: 5 }]`).
2. **The tangents were not turned.** The vertex pull turned the position and the normal by the row's quaternion but left `tangentLocal` as the file had it (three's own `BatchNode` turns it), so a turned row's normal map shaded from an unturned frame. Now turned with the position.
3. **"Destroyed texture used in a submit".** The static groups draw from one render bundle, and a bundle replays the bind groups it was recorded with; the level's loader swaps a finer row into a map by disposing it (`levelGltf.js`'s `swapInto`), so the bundle went on binding the destroyed GPU texture (8 errors a load locally, the 128² first rows; production showed the same). `draws.js` now watches every texture a group samples, its node graph's included (`sampledBy`), and records the bundle again on a dispose (`stats().rerecords`).

What was checked and found right on the way: the cull against its CPU twin (`cullCpu` with the same camera: the same 5,097 rows with the pyramid off, the same lists key by key; the pyramid takes 226 more); the bounding spheres against every loaded file's geometry (132 files, none outside its sphere); the far backdrop ring culled on the GPU and drawn by the instanced path (its parts sit behind the camera: the instanced path does not cull an instance); no mirrored rows on Hoth; the LOD fade (no row fading at rest); the pipeline guard (the picture the same with it disposed).

| measure (Hoth, ultra, 1,600 × 900, the 5090) | instanced (lane L) | GPU scene | `_source` |
|---|---|---|---|
| parity, the chain off (`?post=off`), PSNR against the instanced path | | 25.7 dB before the fixes, **46.7 dB** after | the shots' diff, 2026-10-12 |
| parity, the full chain | | 32.3 dB (TRAA's history and SSGI's noise differ run to run) | the same |
| frame p50 / p95, 8 s on the field, local dev | 32.1 / 46.6 ms | **12.3 / 19.9 ms** | `.scratch-check/gpu-ab.mjs` A/B, back to back |
| the world's `draw()` on the main thread, p50 | 27.9 ms | **9.7 ms** | the same |
| draw calls a frame, p50 | 459 | 245 | the same |
| production (tilakpatell.com, before this change) frame p50 / p95 | 29.8 / 129.6 ms | 20.2 / 35.3 ms behind `?level=gpu`, with the destroyed textures | the same, `BASE=https://tilakpatell.com` |
| CPU throttled 2× (the built-in-chip stand-in), frame p50 | 150 ms | 109 ms | the same, `THROTTLE=2` |

So the GPU scene is the level's path on every WebGPU device that draws indirect with `indirect-first-instance` (`canDrawGpuScene`); `?level=cpu` keeps the instanced path for a check, and WebGL 2 keeps it always. What is left of the frame's JavaScript on Hoth is not the level's: a CPU profile of the throttled load puts it in three's per-object work (`getUniforms`, `_projectObject`, `updateMatrixWorld`/`compose` for the soldiers' 248-bone skeletons, `writeBuffer`): the soldiers on the GPU are the next target.

## The desk, 2026-10-13: the world matrices once a frame, and the two together

three works out a scene's world matrices on every `render()` call (`Renderer.js`'s `_renderScene`: `scene.matrixWorldAutoUpdate`), and the field's frame is the scene's pass and two to four shadow cascades, so Hoth's graph (5,727 objects: 4,261 bones, 1,042 placed lights) was walked 3.6 times a frame. `battlefront/module.js` now turns that off and walks it once in `draw()`, after `level.beforeRender`. Nothing goes a frame stale that was fresh before: `CSMShadowNode.updateBefore` updates its cascade lights itself, and the sky and the sun follow the camera in `light.update`, during the step.

Edge 154 headless on the RTX 5090, WebGPU, 2,560 × 1,440, uncapped, local dev, Hoth's Galactic Assault, the same seeded day each run. Other sessions were using the machine, so a row is a size, not a figure to the decimal.

| measure | before | after | `_source` |
|---|---|---|---|
| `updateMatrixWorld`, ms a frame of a 16 s walk (CPU profile, inclusive) | 2.4 to 3.5 (`main`, instanced level) | 0.7 to 1.0 | `.scratch-check/lag-probe.mjs`, two runs each, 2026-10-13 |
| the same page, the walk switched off and on every 4 s, frame p50 | 9.3 ms | 8.0 ms | `.scratch-check/lag-ab.mjs` on `main` |
| this branch, instanced level (`?level=cpu`) against the GPU scene: idle frame p50 | 8.7 and 11.9 ms | 6.5 and 6.5 ms | `lag-probe.mjs`, interleaved, two runs each |
| the same, a 16 s walk, frame p50 / p95 | 18.6 / 130.3 and 14.6 / 29.7 ms | 6.5 / 12.7 and 7.5 / 11.5 ms | the same |
| the same, per-object binding updates, ms a frame | 6.3 and 4.6 | 0.9 and 1.7 | the same, the walk's CPU profile |
| the chip's own time a frame (`timestamp-query`) | 2.2 to 3.3 ms | 3.8 to 4.9 ms | the page's `machine.gpuMs` |

The 0.4 to 1.1 s frame gap at the start of every profiled walk was the probe's own: it falls where the CPU profiler starts and is not there with the profiler off (the longest gap of a 12 s walk 47 to 76 ms, three runs, against 778 and 841 ms with it on: `.scratch-check/hitch.mjs`). What is the page's: frames of 85 to 155 ms in the first ten seconds after a deploy, while three builds node shaders in slices (`Scheduler.yield.then` in the browser's long-frame entries).

Not fixed here: those frames after the deploy, and each cascade's `_projectObject` still visits every bone and placed light (1.2 to 1.4 ms a frame; hiding the bones from that walk was tried in the page and gave back 0.1 ms, so it was left).

## The desk, 2026-10-13: a part's skin cut to the joints it uses

With the level on the GPU scene, the soldiers were what the frame's JavaScript was spent on: 17 of them, 16 between 230 and 360 m from the eye, each the game's LOD4 in 5 to 7 parts (`lib/budgets.js` holds the light cut to 400 m at ultra), every part bound to the whole rig. three sends a drawn part's joint list to the chip each frame, and the frame before's beside it for the velocity pass. Counted in the page from three's decoded geometry (the files are meshopt-packed): a trooper's backpack uses 1 joint of 252, its cape 4, a helmet 6 to 13, the legs 13, the body 25 to 46, the gloves 46 to 48, a head 51. `lib/three/skinPrune.js` cuts each part's skeleton to those, once a geometry, after the cloth's re-weighting; `?skin=whole` keeps the file's rig for a check. No vertex moves (`skinPrune.test.js` holds a posed part to the same place before and after), and the same view with and without shows the same body (looked at, not scored).

| measure (the GPU scene, 2,560 × 1,440, the soldiers hidden and shown every 4 s in one page, five rounds) | whole rig (`?skin=whole`) | cut skins | `_source` |
|---|---|---|---|
| what the 17 soldiers cost a frame, p50 | 3.1 and 2.5 ms | 1.3 and 1.3 ms | `.scratch-check/lag-ab4.mjs`, two runs each, interleaved, 2026-10-13 |
| the same, mean | 3.8 and 3.6 ms | 1.8 and 2.1 ms | the same |
| the frame, p50 / p95 | 8.6 / 13.9 and 8.1 / 14.7 ms | 6.9 / 10.7 and 6.9 / 12.4 ms | the same |

An earlier run of the same test, with the game itself open on the machine and every frame about twice as long, put the soldiers at 11 ms of a 19 ms frame on the whole rig: their share, not the figure, is what carries.
