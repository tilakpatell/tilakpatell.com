# GPU-first lane N7: the cluster tier, a spike. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts when lanes N1 and N6 are on `main`, and runs on the owner’s laptop** (the cloud has no GPU for it). Branch `claude/gpu-n7-clusters` from `origin/main`. One PR, which ships the path behind the tier table only where it lowers the frame, else the evidence and the decision why not.

**Goal:** Nanite’s inner loop tried against N1’s path: meshlets cut offline, culled per cluster with the LOD cut and the depth pyramid, drawn as one indirect draw into a visibility buffer and resolved per material; on `T2` a compute rasteriser for the smallest clusters. Kept only if it pays on an RTX 5090, an M-series laptop and a phone.

**Architecture:** `scripts/meshlets.mjs` cuts a pack’s LOD0 meshes into meshopt meshlets with a simplification DAG; `src/lib/three/gpuScene/clusters.js` culls clusters and writes one `drawIndirect` with vertex pulling into an `R32Uint` visibility buffer through `mrt()`; `resolve.js` classifies material depth and draws one full-screen pass a material group; `raster.js` (T2 only) rasterises clusters under 64 pixels in compute with `atomicStoreMax` on `vec2u`. Bevy 0.14’s and 0.15’s layouts, named in the research note.

**Tech Stack:** `meshoptimizer` (`buildMeshlets`, `simplify`), METIS-style grouping in JavaScript (groups of 8, half the triangles a level), three r186 TSL compute, `mrt()`, `IndirectStorageBufferAttribute`, `atomic-vec2u-min-max` where the adapter has it; Vitest; `scripts/light-fixture.mjs` (`--clusters`, the 3,000-instance stress scene of N1).

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N7”, §8).

## Global Constraints

- Meshlets of 128 triangles and up to 255 vertices (Bevy 0.15’s), groups of 8, each level half the triangles of the last, the error bound carried per cluster; the LOD cut at under one pixel of error.
- The visibility buffer is `R32Uint`: 26 bits of cluster id and 6 of triangle (Bevy 0.14); the software rasteriser packs depth in the high word and `(cluster << 7) | tri` in the low (Bevy 0.15) and is built only when `adapter.features.has('atomic-vec2u-min-max')`; the `u16`-depth workaround is not used (its own author documents it as unusable).
- Ships only with the three-device table: RTX 5090, an Apple-silicon laptop, a phone (iPhone or Pixel with WebGPU), Hoth at ultra and the stress scene, N1’s path beside it; a device where it loses keeps N1’s path by the tier table.
- The rules; the gates of the spec’s §10.

## Review Focus

1. A mesh whose LOD0 is under 128 triangles (a bolt, a cable): no meshlet DAG; it stays an N1 instance. Test: Task 1.
2. A cluster straddling a group boundary at a coarser level must share its boundary edges with its neighbours or cracks open: the simplifier locks group borders (`meshopt_SimplifyLockBorder`). Test: Task 1 (a watertight sphere stays watertight at every level: no border edge unmatched).
3. The visibility buffer with more than 2²⁶ clusters in view: impossible at this scale (Hoth’s LOD0 is 22 M triangles, 170k clusters) but the id must saturate, not wrap. Test: Task 2.
4. Skinned figures never enter the cluster path (their vertices move); the classification leaves them to the forward pass. Test: Task 2.
5. The compute rasteriser on a device whose `atomic-vec2u-min-max` is absent must not be requested at device creation (`requiredFeatures` only lists what the adapter has). Test: Task 3.

---

### Task 1: the meshlets, offline

**Files:**
- Create: `scripts/meshlets.mjs`, `scripts/lib/meshlet-dag.mjs` (pure over typed arrays: `buildDag(positions, indices, { maxTris = 128, maxVerts = 255, group = 8 }) → { levels: [{ clusters: [{ first, count, bounds, error, parentError }] }], indices, vertices }`), `scripts/lib/meshlet-dag.test.mjs`

- [ ] **Step 1: failing tests**: a sphere of 20k triangles gives levels halving to under 128 triangles; every cluster within the limits; watertight at every level (Review Focus 2); a 100-triangle mesh gives `null` (Review Focus 1).
- [ ] **Step 2: run**: FAIL. **Step 3: implement** with `meshoptimizer`’s `buildMeshlets` and `simplify` (border lock), grouping by shared-edge count greedily (METIS is not in the toolchain; record the choice).
- [ ] **Step 4: run**: PASS. **Step 5**: `node scripts/meshlets.mjs hoth` writes `levels/hoth/clusters/<mesh>.bin` (quantised positions, octahedral normals, the DAG); sizes in the evidence.
- [ ] **Step 6: commit** `Meshlets and their simplification DAG cut offline from a pack’s LOD0 meshes`.

### Task 2: the cluster cull, the visibility buffer and the resolve

**Files:**
- Create: `src/lib/three/gpuScene/clusters.js`, `clusters.test.js`, `src/lib/three/gpuScene/resolve.js`, `resolve.test.js`

**Interfaces:**
- Produces: `createClusterPass(renderer, gpuScene, { hzb, dag }) → { run(camera), visibility: RenderTarget (R32Uint + depth), material: RenderTarget (R16Uint), stats() }`: the cull over `instances × clusters` in two dispatches (instances, then their clusters), the LOD cut `error × scale / distance < 1 px` with the parent test, the HZB test per cluster, one non-indexed `drawIndirect` with `vertex_index → (cluster, tri, corner)` pulling from the cluster buffers, the fragment writing `(cluster << 6) | tri` into `R32Uint` and the material id into the second target; `createResolve(renderer, groups, visibility, material) → { draw() }`: one full-screen pass per material group under `depth-equals` on the material-depth target, reconstructing barycentrics from the triangle’s three vertices and shading with the group’s game material.
- Consumes: N1’s `gpuScene`, `hzb`, `groupsOf`.

- [ ] **Step 1: failing tests**: the CPU twin of the LOD cut on a DAG (the right level by distance); the id saturates (Review Focus 3); skinned parts excluded from `groupsOf`’s cluster set (Review Focus 4); the barycentric reconstruction on a known triangle.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS. **Step 5: commit** `Clusters culled on the GPU and drawn once into a visibility buffer, resolved a material group at a time`.

### Task 2b: the library beside it

- [ ] `elad12390/three-virtual-geometry` (cluster LOD and GPU culling for three WebGPU, r180+; its numbers unverified) is run on the same stress scene and Hoth as a third column, from a scratch checkout, not a dependency: GPU ms, main-thread ms, draws, FLIP. It enters `package.json` only if it beats both N1’s path and this lane’s clusters on the three devices, and then with its stack page first (`docs/health/RULES.md`: a dependency has a page; never a dependency to make a number move).

### Task 3: the compute rasteriser (T2), the three devices, the decision

**Files:**
- Create: `src/lib/three/gpuScene/raster.js`, `raster.test.js` (the CPU twin of the edge functions and the depth packing)
- Modify: `src/runtime/webgpu.js` (`requiredFeatures` gains `atomic-vec2u-min-max` only when the adapter has it; Review Focus 5), `src/runtime/tiers.js` (`clusters: 'hardware' | 'software' | false`)

- [ ] **Step 1: failing tests**: the twin rasterises a triangle to the expected pixels; depth packs and unpacks; the feature is not requested on an adapter without it.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5**, on the three devices: `node scripts/light-fixture.mjs --clusters --legs webgpu --tier ultra` on the stress scene and `GPU=webgpu node scripts/perf-probe.mjs hothWalk` with `?tier=T2&clusters=hardware|software|off`: GPU ms (G1’s clock), the main thread’s ms, `stats()`; FLIP against G1’s reference. The table in `docs/superpowers/evidence/gpu-first/N7/README.md`.
- [ ] **Step 6**: the decision: `docs/decisions/2026-10-<dd>-the-cluster-tier.md` (Context, Decision, Consequences, Revisit when), under 80 lines; `tiers.js` turns the path on only for the devices where it won; else `clusters: false` everywhere and the code stays behind the table.
- [ ] **Step 7**: `docs/stack/webgpu-tsl.md` (the cluster pass under “Where it is used” or “What the site does not use, and why”), the hand-off’s row; merge `origin/main`; the gates; push; PR `GPU-first lane N7: the cluster tier, measured`.
