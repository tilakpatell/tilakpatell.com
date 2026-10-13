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

## The desk, 2026-10-13: far soldiers as rows (stage 1)

The plan: `docs/superpowers/plans/2026-10-13-far-soldiers-as-rows.md` (on `claude/spec-gpu-site-guest-heroes`). Branch `claude/bf-soldier-rows`, measured at its base `7cc7b2792` (#966) with this branch's commits on it; `main` moved 15 commits meanwhile (the bots' logic, a round's sizes, the lights' index buffer), and nothing below was taken on that. Past the band's distance (91 m at ultra, `figures/band.js`) a living soldier is not drawn as a figure. The distance is the site's own economy: the plan called it the game's last character LOD distance, and the game's code, read the same day (`D:\bf2-ghidra\lod64\DECISIONS.md`), says a trooper is on its last LOD from 42 m at Ultra and is drawn so, skinned, to about 500 m. Past the band: every part of it, its gun's meshes too, is an instance of one draw a part (`lib/three/figureRows/`), posed from its own bones once a frame. Its mixer and its bones go on as before (stage 1). `?rows=off` keeps every soldier a figure.

Everything below was taken with the game itself open on the machine and other sessions using it. Between pages ten minutes apart the same mode's frame moved from 9 to 26 ms, so **a number is comparable only with another from the same page**, and a gain in milliseconds grows with the load it was taken under. Edge 154 headless, the RTX 5090, WebGPU, 2,560 × 1,440, uncapped, local dev (`--mode bucketcheck`), `tp-quality` ultra, Hoth, a round begun in place at 24 a side (`do('round', { mode: 'supremacy', bots: { friendly: 23, enemy: 24 } })`): 48 soldiers, 358 meshes. The scripts and their JSON are in the worktree's `.scratch-check/` (git-excluded, as this file's other sources are): they are named here, not committed.

### Two faults of the measuring itself, found late

- **The dev server drew the level without its compressed textures.** Its `node_modules` is a junction to another worktree's, and vite refused the Basis transcoder as outside its serving list (a 403 in every page; the server's log: "the snow did not land"). The ground was flat and the rocks bare in every picture. So every dev-server frame below, the first two sections' and the walk's, is of a lighter picture than a visitor's. The comparisons inside one page had the same picture on both sides; the "visitor's frame" is not a visitor's picture. The built site serves the transcoder (no response refused) and is what the last table here was taken on.
- **Every page test before the merge was on the dev server at the old base.** On the built, merged site the only things checked are the round-size table below, when the rows arrive, and that no soldier was neither a row nor a visible figure in 35 s by the branch's own bookkeeping.

### The round's size, rows off and on (the built site, the merged branch)

tilak-a6's `frames.mjs` (`lag-cpu-path/.scratch-check`), with the rows switched off and on in 4 s windows, four pairs a size, inside the same page (`frames-rows.mjs`, `out/frames-rows-built-<n>.json`). `vite build --mode bucketcheck` of `2d09ca6db` (this branch with `main` at `b0a8474dc` merged), `vite preview`, Edge headless, 1,920 × 1,080, the quality level not pinned, a round begun through the door at each size and 40 s given for the rows to arrive. The game open on the same card: relative numbers. Each size had the player alive and the pace level at 1 in every window.

| a side | living bots | every soldier a figure, frame p50 (two runs) | rows on (two runs) |
|---|---|---|---|
| 8 | 13 / 14 | 12.2 / 21.7 ms | 7.0 / 13.7 ms |
| 13 | 22 / 23 | 19.8 / 27.2 | 9.3 / 15.7 |
| 20 | 37 / 37 | 27.8 / 27.8 | 12.5 / 12.8 |
| 32 | 61 / 61 | 46.3 / 44.8 | 21.6 / 21.7 |

The two larger sizes repeat. The two smaller do not: in the second run they are slower than the first's and, with rows, 13 a side is slower than 20, which more bots cannot explain; they ran first in that page. From 37 to 61 bots a bot costs 0.71 to 0.77 ms a frame as a figure (tilak-a6 measured 0.75) and 0.37 to 0.38 ms as a row.

**This is the most favourable view there is for rows, and not a round's cost.** In this flow the player stands where the round deploys them and the bots go to their posts: 45 s in, the nearest bot was 118 m from the camera and all 39 were rows (`where.mjs`). A bot within the band is a figure and costs a figure's rate or more, so a round costs between the two columns by how many bots are near. The pages before the merge, where 8 to 18 soldiers stood within 80 m, left the soldiers at 26 to 45 % of their cost as figures. What the 0.37 ms a row is spent on was not profiled on this build; the timers below, from the old base, put it in the mixers, the matrix walk and the placing.

When the rows arrive (`rows-arrive.mjs`, `rows-dip.mjs`, 20 a side): none for the first 6 s, while the shaders of the level and of the rows' own parts are built off the frame (up to 217 pending); twenty by 10 s; all the far soldiers from 30 s. In one run no soldier was a row at 15 s either, though twenty had been at 10 s and 14 of the 15 parts read as ready: **not explained**, and a second run's record ran out before that moment.

### What the soldiers cost, and what rows take off (the dev server, before the merge)

One page, the mode switched every 4 s for five rounds. "Hidden": no soldier drawn. `_source`: `.scratch-check/soldiers-ab.mjs`, `out/soldiers-ab-<tag>.json`.

| page (tag) | pace level | every soldier a figure, frame p50 | far soldiers as rows | hidden | rows take off the frame | the soldiers' drawn cost, rows / figures |
|---|---|---|---|---|---|---|
| `main` before this branch (`base-1`) | not recorded | 33.1 ms | | 9.9 | | 23.2 ms as figures |
| the same (`base-2`) | not recorded | 33.9 | | 9.1 | | 24.8 |
| `rows-1` | 0 at the end | 53.2 | 35.4 | 21.5 | 17.8 ms | 13.9 / 31.7 (44 %) |
| `rows-2` | 1 at the end | 57.0 | 37.1 | 21.0 | 19.9 | 16.1 / 36.0 (45 %) |
| `rows-3` | 1 throughout | 53.1 | 33.7 | 23.6 | 19.4 | 10.1 / 29.5 (34 %) |
| `rows-5` | 0 throughout | 63.6 | 36.1 | 26.3 | 27.5 | 9.8 / 37.3 (26 %) |
| `page-on-1` | 1 throughout | 61.2 | 39.8 | 24.9 | 21.4 | 14.9 / 36.3 (41 %) |
| `page-on-2` | 0 throughout | 40.2 | 22.0 | 11.7 | 18.2 | 10.3 / 28.5 (36 %) |
| `?rows=off` (`page-off-1`) | 4 throughout | 59.4 | | 21.1 | | 38.3 as figures |
| `?rows=off` (`page-off-2`) | 0 throughout | 31.2 | | 8.7 | | 22.5 |

In six pages rows took 17.8 to 27.5 ms off a 40 to 64 ms frame and left the soldiers' drawn cost at 26 to 45 % of what it is as figures. It is a range, not a figure: the battles differ page to page (8 to 18 soldiers within 80 m; 28 to 39 as rows) and so does the load. 28 to 40 of the 48 stood past 91 m. Draw calls a frame: 590 to 729 as figures on the four pages that never made a row, 429 to 708 switched to figures inside a rows page, 212 to 381 with rows, 42 hidden. The pace level is the page's own quality step (`paceLevel`); it was recorded per mode only from `rows-3` on, and a page at another level draws another chain.

One run is left out and named: `rows-4-notimers`, where the player never deployed, so all 47 soldiers were far and were rows (4.2 ms for them as rows against 37.0 as figures). It is another scene, taken once. It was meant to show what the probe's own timers cost; that is not measured.

**The plan's goal is not shown to be met.** With rows the soldiers still cost 10 to 16 ms drawn. Most of that is the near soldiers, still figures.

### The JavaScript that rows do not touch

The probe's timers round the frame's own calls (p50, ms a frame; paid whether the soldiers are drawn or hidden, so the switch test above cannot see it). `_source`: the same JSON's `js`.

| | `rows-1` | `rows-3` | `rows-5` | `page-on-2` |
|---|---|---|---|---|
| `figures.update` (the 48 mixers) | 4.3 | 4.2 | 4.2 | 2.8 |
| `scene.updateMatrixWorld` (the whole scene: 48 × 254 bones, the level, the lights) | 6.1 | 6.2 | 7.7 | 4.7 |
| `figures.place` (the rows written and sent) | 1.8 | 2.0 | 2.3 | 1.4 |

Placing, taken apart inside real frames (`place-inframe.mjs`, two pages, 20 to 21 ms frames, 32 and 35 rows): 1.18 and 1.07 ms a frame, of which the 24 uploads (587 to 632 KB, the rows in use and no more) are 0.24 and 0.21 ms and reading the bones and writing the rows 0.94 and 0.85 ms. Timed back to back in a loop the same call is 0.43 ms (`place-cost.mjs`); why it is two and a half times that in a frame is not shown.

### The picture

A held page (the world's step replaced, so nothing moves) with the camera lifted 120 m off a group, FOV 9°: a body is about 120 pixels tall. `_source`: `rows-shots.mjs`, `out/rows-<tag>.json`.

- **The chain off** (`?post=off`, `nopost2`): the visitor's own view is the same to the bit. Through the long lens, 70.9 and 73.3 dB over the frame, 86 and 62 pixels of 3.7 million off by more than 8 of 255, all on the soldiers' outlines (`rows-chain-off-pair.png`: rows left, figures right). Before one fault of this branch was fixed it was 54.8 dB: a gun in the hand takes no shadow as a figure and took one as a row.
- **The chain on** (`chain2`): rows and figures differ by more than the temporal filter's noise. In one view two rows pictures 1.5 s apart agree to 4 of 255 (65 to 69 dB over the soldiers' boxes) and the figures' picture is 33 to 40 dB from them; in the other, 29 to 34 dB against a noise of 37 to 42. At the visitor's own view it is inside the noise (47.5 dB against 44.1). `rows-chain-on-triple.png`: rows, figures, rows again. **The plan's picture test (a row is the picture of the figure) is not met with the chain on.**

The difference is in the velocity the scene pass writes (`rows-mrt.mjs`, the pass's own target read back; a texel is counted when it is more than a pixel from the frame's common velocity, which is under half a pixel and changes every frame):

| held page, still camera | texels off | of them inside the soldiers' boxes | largest |
|---|---|---|---|
| `?rows=off`, no row ever made, three reads | 26,915 / 26,924 / 26,982 | 26,915 / 26,924 / 26,978 | 41,900 px |
| the same with `?skin=whole`, three reads | 19,536 / 19,499 / 19,491 | all | 30,855 px |
| rows on, two reads | 0 / 0 | | 0 |
| the same page, rows switched off | 18,442 | 18,400 | 35,563 px |

So the figures write a velocity of tens of thousands of pixels on their own texels while nothing moves, on a page where this branch drew nothing and with or without the cut skins; the rows write the frame's own. The pass's other attachments (normal, diffuse, metal and rough) differ between rows and figures by no more than two reads of one mode do. In motion (`rows-motion.mjs`, a 41 × 41 block round one running soldier, 40 frames): as a figure nearly every texel of it is wrong in every frame (85,352 against 3,390 within 2 px of its real motion), at about 3,500 px, drifting by the soldier's own motion each frame; as a row most of its texels are within 2 px of its real motion in 36 of 40 frames. **Why the figures do this is not found.** That the figures' aliased look comes from it is the natural reading and is not tested.

The rows' velocity is not exact either. In that run two frames at a change of direction were about 2 px off, two where the soldier's root jumped 18 px read near zero (an instance new that frame is given no movement of its own, by design; whether that was the case is not known), and about a third of the moving texels in the block were more than 2 px from the root's motion, which a body's own limbs would also be: the test cannot tell the two apart.

### The band's edge

`edge.mjs`: the camera dollied in from 100 m to 76 m and back, twice, on one soldier of 8 parts, half a metre a frame. In 209 frames it was placed in the rows in 131 and had all 8 meshes in the main pass's list in 78; never both, never neither. It changed four times, at the band's own 91 m and 81.9 m (to its feet). That is this branch's bookkeeping and three's list, not pixels. The same soldier from the same place at 84 m as a row and as a figure: 39 dB, against 52.1 dB for the same view as a row before and after the walk (`rows-edge-84m-pair.png`: row left, figure right). **A soldier's look steps at the edge** between the row's smooth outline and the figure's stepped one. It was looked at held, through a long lens; at a visitor's field of view (55°) the soldier is about 30 pixels tall there, and that was not looked at, nor in motion. The view had no ground under the soldier: the shadow that a figure casts and a row does not was not looked at.

### A visitor's frame

No profiler and no timer on the page; a page a mode; all at pace level 0 with the player alive throughout. `_source`: `walk24.mjs`, `out/walk24-<tag>.json`.

| 24 a side, frame p50 / p95 | every soldier a figure (`?rows=off`) | far soldiers as rows |
|---|---|---|
| standing 8 s | 31.6 / 42.2 and 31.7 / 41.7 ms | 27.7 / 38.1 and 19.6 / 37.1 ms |
| walking 12 s | 32.6 / 49.1 and 25.9 / 42.5 | 22.6 / 45.7 and 19.8 / 40.2 |
| frames over 33 ms, standing / walking | 95 / 172 and 107 / 81 | 37 / 55 and 26 / 56 |

These are separate pages, so the difference between the columns (4 to 12 ms) is weaker evidence than the switch test's, and it is about half as large; 24 to 30 soldiers were rows here. The slow frames move little. At 8 a side the four pages sat at pace levels 0, 1, 2 and 0, so only one of each mode compares: as figures 20.6 ms standing and 23.7 walking, with rows 10.1 and 11.8. One of the 24-a-side pages with rows was faster than the 8-a-side page as figures, which the soldiers cannot explain: **the walk cannot say, on this machine today, whether 24 a side with rows costs what 8 a side does on `main`.** The chip's own time was 3.5 to 4.5 ms a frame throughout.

### Where the code differs from the plan (the code wins; each said here)

| plan | code | why |
|---|---|---|
| `writeRow(array, row, layout, boneMatrices, rootInverse)` | `writeRow(array, row, layout, skeleton, rootInverse, root)`: the bones' own world matrices and inverses, and the root in the row's first matrix | `skeleton.boneMatrices` is float32 in the world: a tenth of a millimetre at 1,300 m. Worked out from the bones in doubles and re-based first, the row keeps a hundredth; `pose.test.js` still holds it to the sixteen floats `skeleton.update()` leaves |
| one row an instance | two: the pose now and the pose of the frame before | the velocity pass |
| `place(part, i, skeleton, rootMatrixWorld)`, `count` | `begin()`, `place(part, i, skeleton, root, was)`, `send()`; `count` kept | `was` is the instance it was last frame, so the pose of the frame before is its own when the instances are packed anew |
| the root is the instance's | a skin's root is its node's place only | three skins in the node's frame and comes back out through it, which leaves the node's origin as the point a vertex is pulled about when its weights do not sum to one (a file's are bytes: off by up to 1/255) |
| a soldier in the band is a row | once every part of it has been drawn once (`part.ready`) | `pipelineGuard.js` leaves an object out of the frame until its shader and pipeline have landed: a figure hidden for a row not yet drawn would be drawn by nobody |
| the texture uploaded, only the rows in use | `sendRows`: through the device's own queue | three's WebGPU backend sends a DataTexture whole (it reads no update range in r186). The one place the folder reaches inside three |
| a capability test | `canDrawRows`: the node renderer on WebGPU | the row path was not tried on WebGL 2 |
| stage 2 (Task 6) | not built | below |

### Stage 2: not built, and why

The plan builds it only if stage 1 shows the mixers and the bones are what is left. They are part of it, not most. With rows on, what the soldiers still cost is, in order: the near soldiers drawn as figures (10 to 16 ms in the switch test), then the mixers and the matrix walk for all 48 (2.8 to 4.3 and 4.7 to 7.7 ms, of which the far soldiers' share is perhaps two thirds of the mixers and less of the walk, not measured apart), then placing (1.1 to 2.3 ms, most of it reading the same bones). Stage 2 would take the far soldiers' share of the last two: a few milliseconds under this load, less on a quiet machine. It also draws a far soldier at the nearest of sixteen sampled phases, which is no longer the figure's own pose, so it changes the picture and wants its own review. And stage 1 itself leaves open what is listed below. Left for its own plan.

### Not shown, not done

- Any number from a quiet machine. The same mode of the same build (no soldier drawn) ran at 9 to 12 ms a frame in four of these pages and at 21 to 26 ms in the other six.
- Whether the goal is met (above).
- Why skinned figures write the velocity they do. It is on `main` and outside this branch; it makes the plan's picture test unpassable with the chain on and makes the hand-over visible.
- The hand-over at a visitor's field of view and in motion; the far soldiers' missing shadows on the snow (at low and mid the game's own shadow distance is past the band, so rows casting none is a loss there by the plan's own count).
- A single missing frame on screen at the hand-over (the accounting is bookkeeping). A part is marked ready the first time three draws it in any pass; the guard holds objects by pass and was still holding 2 to 24 in most frames after the rows arrived. Whether a row can be ready in one pass and held out of the picture's own is not ruled out.
- The lens factor on the band (`band.js`'s `zoomOf`) in the page: every soldier camera is at 55° today, where it is exactly 1. Unit tests only.
- A frame at 63 bots taken apart, on the merged build.
- The row path on WebGL 2; a kind whose body is swapped while its rows are drawn, in the page (covered by `figures.test.js` against a stand-in only); more soldiers of a kind than 64 in the page (`rows.test.js` only).
- What the probe's timers cost.
