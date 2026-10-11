# GPU-first lane N1: the GPU scene. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts now from `origin/main`**, built and measured on the lit fixture’s stress scene and the `battlefront` world (already `'nodes'`); when lanes T2 and G1 land, merge `origin/main`, take G1’s clock for the GPU column and run the Hoth surface tables. Branch `claude/gpu-n1-scene` from `origin/main`. One PR.

**Goal:** A level’s instances live in one GPU buffer; a compute pass culls them by frustum, LOD and last frame’s depth pyramid and writes indirect draw arguments; the CPU issues one indirect draw per material group from a render bundle. Hoth goes from 183 draws to under 40 and the main thread’s `render()` under 2 ms, with the picture unchanged.

**Architecture:** `src/lib/three/gpuScene/` (knows three, no world): `scene.js` the instance buffer, `cull.js` the TSL compute (frustum → LOD cut → HZB test → compaction and `drawIndexedIndirect` args), `hzb.js` the depth pyramid, `draws.js` one `Mesh` per material group with vertex pulling, `lodFade.js` the dithered crossfade, `three.js` the two hooks into three (`IndirectStorageBufferAttribute`, `renderObject.getIndirect`, `storage().toAttribute()`) so an upgrade touches one file. `levelScene.js` gains a third path, `gpuScene: true`, beside lane L’s `InstancedMesh` and lane U’s `BatchedMesh`, chosen by `tiers.js` (`T1`+ on WebGPU).

**Tech Stack:** three r186 `three/webgpu` and `three/tsl` (`Fn().compute`, `instancedArray`, `storage`, `atomicAdd`, `textureStore`, `IndirectStorageBufferAttribute`, `BundleGroup`), meshopt LOD chains as the packs ship them, Vitest, `scripts/level-draws.mjs`, `scripts/light-fixture.mjs`, `scripts/perf-probe.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N1”, §5, §7, §8).

## Global Constraints

- The rules (`docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`): `src/lib/three` imports no component; files under 800 lines; every three addon import dynamic; British spelling, curly quotes, `_source`.
- 32 bytes an instance in the GPU buffer: position (3 × f32), a quaternion (4 × f16 packed in 2 × u32), scale (f16), radius (f16), mesh id (u16), group (u16), flags (u32): one `vec4<u32>` ×2. The pack’s bins (`lib/level/instances.js`, 32 bytes a row on disk) convert once at `onCell`.
- Occlusion is conservative: a culled instance is one whose sphere is behind the pyramid’s depth at its footprint’s mip; nothing visible may disappear (the parity check on three poses).
- `nodes-webgl` and `T0` never take this path; lane U’s batched path and lane L’s instanced path are untouched.
- Gates: the lane’s table on the laptop at ultra, Hoth, 1,600 × 900 and 4K, WebGPU: draws under 40, `render()` under 2 ms, the GPU frame no higher than lane U’s batched frame, parity within `gpu-parity.mjs`’s thresholds; plus the standing gates.

## Review Focus

1. A cell dropped while its instances are mid-frame: `free(range)` marks the rows dead by flag; the cull pass skips dead rows; the slot list is reused on the next `append`. Test: Task 1.
2. An LOD whose GLB has not arrived (the stream fetches LODs lazily): the cull pass picks the finest *loaded* LOD at or under the wanted one (a per-mesh `loadedMask` uniform), as `levelScene.js:227-231` holds the old LOD today. Test: Task 2.
3. A mirrored instance (odd negative scales) draws a flipped-winding copy today (`levelScene.js`’s `flipped`): the GPU scene keeps a `mirrored` flag and the draw’s material is `DoubleSide` for that group when any instance is mirrored, since one indirect draw cannot switch winding. Test: Task 3’s fixture has a mirrored crate; the parity shot holds.
4. The first frame has no last-frame depth: the HZB test is skipped (every instance passes) until a pyramid exists; a resize invalidates it. Test: Task 2.
5. A material group over 16 sampled textures: `draws.js` refuses it (`groupsOf` splits by texture-array count) rather than failing at pipeline creation. Test: Task 3.

---

### Task 1: the instance buffer

**Files:**
- Create: `src/lib/three/gpuScene/scene.js`, `scene.test.js`, `src/lib/three/gpuScene/three.js`
- Create: `src/lib/three/gpuScene/pack.js`, `pack.test.js` (pure: a bin’s rows → the 32-byte GPU rows)

**Interfaces:**
- Produces: `packInstances(rows: { position, quaternion, scale, mesh, group, radius, mirrored }, out: Uint32Array, offset) → count` (pure; f16 packing by hand, tested round-trip to 1e-3). `createGpuScene(renderer, { capacity }) → { append(packed, count) → range, free(range), buffer (the `instancedArray`), count, dead }`; `three.js` exports `loadGpuThree() → Promise<{ IndirectStorageBufferAttribute, BundleGroup, TimestampQuery }>` (dynamic import of `three/webgpu`) and `storageAttribute(node)` (`node.toAttribute()`).

- [ ] **Step 1: failing tests**: `packInstances` round-trips a quaternion and a scale within 1e-3; `append` of 100 then `free` then `append` of 50 reuses the freed slots; `dead` counts flagged rows.
- [ ] **Step 2: run**: FAIL. **Step 3: implement** (the buffer a `StorageInstancedBufferAttribute` of `capacity × 8` u32, grown by doubling, never shrunk). **Step 4: run**: PASS.
- [ ] **Step 5: commit** `The GPU scene: a level’s instances as 32-byte rows in one storage buffer, appended and freed by cell`.

### Task 2: the cull pass and the depth pyramid

**Files:**
- Create: `src/lib/three/gpuScene/cull.js`, `cull.test.js`, `src/lib/three/gpuScene/hzb.js`, `hzb.test.js`, `src/lib/three/gpuScene/lodRule.js`, `lodRule.test.js`

**Interfaces:**
- Produces: `lodIndex(d, r, chain, tier) → n` in `lodRule.js` as a pure function **and** as a TSL `Fn` (`lodIndexNode`) with the same arithmetic as `lib/level/lod.js`’s `lodAt` (import and call it in the test); `createHzb(renderer, { width, height }) → { update(depthTexture), texture, mips, resize(w, h) }` (a mip chain of max depth, built by `compute` with `textureStore`); `createCull(renderer, scene, { camera, hzb, groups }) → { run(camera, loadedMasks), indirect: Map<groupKey, IndirectStorageBufferAttribute>, visible: instancedArray (compacted indices), stats() → { tested, culled, drawn } }` (the stats read back by `renderer.compute` every 30 frames through a staging buffer, never every frame). Frustum: six planes as a uniform; LOD: `lodIndexNode`; HZB: the sphere’s screen rect → mip by footprint → `textureLoad` max depth compare (reversed depth: pass when `sphereNear >= hzbDepth`); compaction: `atomicAdd` on the group’s `instanceCount` in the indirect args, the index written at the returned slot.
- Consumes: Task 1’s `buffer`, `count`, `dead`.

- [ ] **Step 1: failing tests**: `lodIndex` agrees with `lodAt` on 10,000 random `(d, r, chain, tier)`; `createHzb` on a 4 × 4 fake depth gives the right mip values (CPU twin of the reduce in the test); the cull’s CPU twin (`cullCpu`, exported for the test) culls a sphere behind a wall and keeps one in front, skips dead rows, passes everything when `hzb` is `null` (Review Focus 4), and picks the finest loaded LOD under the wanted one (Review Focus 2).
- [ ] **Step 2: run**: FAIL. **Step 3: implement**; the TSL kernels compiled in Node by `renderer.compileComputeAsync` is not possible, so the GPU leg is Task 4’s fixture.
- [ ] **Step 4: run**: PASS. **Step 5: commit** `The cull pass: frustum, the LOD cut and last frame’s depth pyramid, compacted into indirect draw arguments`.

### Task 3: the draws

**Files:**
- Create: `src/lib/three/gpuScene/draws.js`, `draws.test.js`, `src/lib/three/gpuScene/lodFade.js`, `lodFade.test.js`

**Interfaces:**
- Produces: `groupsOf(parts: { geometry, material, mesh, lod }[], { maxTextures = 16 }) → groups` (pure: by `material.userData.batchKey` and texture-array count; a group past the limit splits; Review Focus 5); `createDraws(renderer, scene, cull, groups) → { meshes: Mesh[], bundle: BundleGroup | null, setStatic(groupKey, bool), rerecord(), dispose() }`: one `Mesh` per group whose geometry merges the group’s LOD geometries into one index buffer (per-LOD `firstIndex`, `indexCount` in the indirect args), whose material is the group’s game material with `positionNode` pulling the row by `instanceIndex` through `cull.visible` (`storageAttribute`), writing `velocity` for N2 (the previous transform read from a second buffer `cull` swaps each frame); `lodFade.js`: `fadeNode(age, duration = 0.3)` a blue-noise alpha threshold (the dither TRAA resolves), applied for 0.3 s after an instance’s LOD changes (`flags` carry the frame it changed).
- Consumes: Task 1’s `three.js`, Task 2’s `cull`.

- [ ] **Step 1: failing tests**: `groupsOf` splits at 16 textures and keys by `batchKey`; a mirrored instance makes its group `DoubleSide` (Review Focus 3); `fadeNode`’s CPU twin is 0 at age 0 and 1 at 0.3 s.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: commit** `One indirect draw a material group, the instance pulled from the GPU scene, static groups in a render bundle`.

### Task 4: the level’s third path, on the fixture and on Hoth

**Files:**
- Modify: `src/components/galaxy/surface/level/levelScene.js` (`gpuScene: true` option: `setTable`, `onCell`, `onDrop`, `update` route to `gpuScene/`; `stats()` gains `{ culled, drawn, indirect }`; under 800 lines, else `levelGpu.js` beside it holds the path)
- Modify: `src/runtime/fixtures/litWorld.js` (`--gpuscene`: 3,000 instances of the pillars and a mirrored crate), `scripts/light-fixture.mjs` (the flag), `scripts/level-draws.mjs` (a third column)
- Create: `docs/superpowers/evidence/gpu-first/N1/README.md`

- [ ] **Step 1**: the fixture on `nodes-webgl` must not take the path (`tiers.js` is N6’s; until it lands `gpuScene` is on only when `backendOf(renderer) === 'webgpu'`); in the cloud the webgpu leg cannot run (SwiftShader loses the device): the cloud proves the fallback and the tests.
- [ ] **Step 2**: `node scripts/level-draws.mjs hoth --tier ultra`: the third column (groups × LODs → one indirect draw a group).
- [ ] **Step 3**, on the laptop: `node scripts/light-fixture.mjs --gpuscene --legs webgpu --tier ultra` (frame ms, `stats()`), `GPU=webgpu node scripts/perf-probe.mjs hothWalk` before and after (draws, `render()` ms from the probe’s `main` column, GPU ms from G1’s clock), `node scripts/gpu-parity.mjs /galaxy/hoth/surface --before <main>` on three poses (the hangar, the trench, the ridge). The README’s table with `_source`.
- [ ] **Step 4**: `docs/stack/three.md` Upgrading: `IndirectStorageBufferAttribute`, `renderObject.getIndirect`, `toAttribute`; `docs/stack/webgpu-tsl.md` gains the GPU scene under “Where it is used”; `docs/architecture.md`’s runtime bullet one sentence; the hand-off’s row.
- [ ] **Step 5**: merge `origin/main` (lane U2 may have wired `batch` in `map/level.js`: keep both; the tier picks); the gates; push; PR `GPU-first lane N1: the GPU scene` with the tables.
