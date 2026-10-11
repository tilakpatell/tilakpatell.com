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
