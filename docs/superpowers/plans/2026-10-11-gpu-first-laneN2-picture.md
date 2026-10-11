# GPU-first lane N2: the stable picture. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts now from `origin/main`** on the lit fixture and the `battlefront` world; the controller takes a `gpuTime` of G1’s shape (`{ frame, median, p95, last, available }`) and until G1 lands a test double stands in; when T2 and G1 land, merge `origin/main` and wire. N1 is not needed; N2 and N1 merge in either order. Branch `claude/gpu-n2-picture` from `origin/main`. One PR.

**Goal:** On a `'nodes'` world the picture is never stretched by the browser, its internal resolution is set by the GPU’s own time with Unreal’s controller constants, every reduction goes through TRAA or TAAU and a sharpen pass with the mip bias to match, every moving thing writes velocity, depth is reversed, and metal stops sparkling.

**Architecture:** `src/runtime/dynres.js` (pure) is the controller; `createQuality` takes a `source` (`'gpu' | 'cpu'`) and on `'gpu'` feeds `dynres` with G1’s `createGpuTime` median instead of the pace’s frame times, emitting the same `level` steps `headroomAt` maps to scales. `light/post.js` gains `sharpen`; `textures.js`’s `sharpen` gains `bias`; the game material gains geometric specular anti-aliasing; the runtime sets `camera.reversedDepth` and `depth32float` on WebGPU; `loop.js` gains a 30 fps cadence.

**Tech Stack:** three r186 `SharpenNode`, `TRAANode`, `TAAUNode`, `FSR1Node`, `Camera.reversedDepth`, MRT velocity (`velocity` node), TSL; Vitest; `scripts/light-fixture.mjs`, `scripts/perf-probe.mjs`, `scripts/frame-score.mjs` (G1).

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N2”, §5).

## Global Constraints

- The controller’s constants, each with `_source` (Epic’s `r.DynamicRes.*` documentation, named in the research note): budget 16.7 ms (33.3 when the visitor pins 30 or the tier is `T0`), headroom 10 %, change threshold 5 %, minimum change period 8 frames, history 16 frames (median), panic after 3 consecutive over-budget frames; floor 0.67 (`T1`+), 0.58 (`T0`); ceiling 1.
- The output size never changes while a world is up: only the chain’s `setResolutionScale` moves (lane U’s `headroom()`); `gfx.setRatio` is not called by the controller.
- MSAA on WebGPU is 1 or 4 samples only, and TRAA or TAAU needs 1: on WebGPU `antialias` is false whenever the chain has a temporal pass; `BUDGETS.samples` (8/4/2) stays the classic renderer’s.
- Mip bias: `log2(scale) − 1` under an upscaler; −0.5 at scale 1 under TRAA; 0 on the classic renderer.
- Specular anti-aliasing: variance 0.15, threshold 0.2; roughness floor 0.045 (`_source` Filament, the research note).
- The rules of `docs/health/RULES.md` and the standing rules; the gates of the spec’s §10.

## Review Focus

1. No GPU time (no `timestamp-query`): `createQuality({ source: 'gpu' })` falls back to the pace silently and `quality.source` reads `'cpu'`. Test: Task 1.
2. A pause (the tab hidden) must not panic the controller: a frame over 250 ms is dropped from the history, as `pace.js` drops it. Test: Task 1.
3. A visitor who pins a sharpness (`tp-sharpness`) above 1 wants more pixels than the screen: the controller’s ceiling is `min(1, sharpness)` of the internal scale and never exceeds 1 (the upscaler cannot downscale). Test: Task 1.
4. A material that never moves but is instanced by the GPU scene must write zero velocity, not garbage: `velocity` reads the previous transform buffer, which N1 swaps each frame; before N1 lands, static instanced meshes write the camera’s reprojection only. Test: Task 3’s fixture check.
5. Reversed depth under the shadow path: CSM cascades compare depth with the camera’s convention; the fixture at `--shadows` with `reversedDepth` on must match the shot without it to PSNR ≥ 40 dB. Test: Task 4.

---

### Task 1: the controller

**Files:**
- Create: `src/runtime/dynres.js`, `src/runtime/dynres.test.js`
- Modify: `src/runtime/quality.js` (`createQuality({ ..., source = 'cpu', gpuTime = null })`; `quality.source`; `frame(now)` consults `dynres` on `'gpu'`), `src/runtime/quality.test.js`

**Interfaces:**
- Produces: `createDynres({ budgetMs = 16.7, headroom = 0.1, threshold = 0.05, minPeriod = 8, history = 16, panic = 3, floor = 0.67, ceiling = 1, steps = RESOLUTION_STEPS }) → { frame(gpuMs) → scale | null, scale, level, reset() }` (pure): the target is `budgetMs × (1 − headroom)`; the median of the history over the target lowers the scale to the next step down whose predicted time (`median × (next/scale)²`) fits, and under 0.8 × target raises it one step after `minPeriod` frames; a change under `threshold` is not made; `panic` consecutive frames over `budgetMs` drop a step at once; `null` frames (no reading) are ignored; a frame over 250 ms is dropped. `level` is the index into `steps`, the same `level` `headroomAt` takes.
- Consumes: `createGpuTime` (G1): `quality.frame(now)` calls `gpuTime.frame()` and feeds `gpuTime.last`.

- [ ] **Step 1: failing tests**: 16 frames at 20 ms with budget 16.7 → one step down (0.77) and no second change for 8 frames; 3 frames at 30 ms → an immediate step; 16 frames at 10 ms at level 1 → back to level 0 after `minPeriod`; a 300 ms frame ignored; `createQuality({ source: 'gpu', gpuTime: { available: false } })` has `source === 'cpu'`; the ceiling with sharpness 1.5 is 1.
- [ ] **Step 2: run** `npx vitest run src/runtime/dynres.test.js src/runtime/quality.test.js`: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: wire**: `src/runtime/runtime.js` passes `source: 'gpu'` and G1’s `gpuTime` for a `'nodes'` module on `'webgpu'`; the surface’s `lowerQuality` (lane T2’s `headroomAt` path) is unchanged since it reads `quality.level`.
- [ ] **Step 6: commit** `The internal resolution set by the frame’s GPU time, with Unreal’s dynamic-resolution constants`.

### Task 2: sharpen, bias and the samples rule

**Files:**
- Modify: `src/lib/three/light/post.js` (`'sharpen'` in `ORDER` after `upscale` and in `NODE_PASSES`; `passesFor` adds `{ kind: 'sharpen', strength }` whenever the chain has `upscale`, strength `0.2 + 0.4 × (1 − scale)` clamped to 0.4; `antialias(passes) → boolean`: false when the chain has `traa` or `upscale: taau`), `src/lib/three/light/passes.js` (`SharpenNode` in `ADDONS`, built after the upscaler), `post.test.js`, `passes.test.js`
- Modify: `src/lib/three/textures.js` (`sharpen(texture, { ..., bias = 0 })` sets `texture.mipmapBias` where the renderer is a node renderer; a module-level `setMipBias(bias)` updates every texture `sharpen` has seen through a `WeakRef` set), `textures.test.js`
- Modify: `src/runtime/webgpu.js` (`createWebGPU`’s `antialias` is `budget.antialias && antialias(passes)` once the chain is known: the renderer is made with `antialias: false` for a `'nodes'` module whose tier has a temporal pass, read from `post.js`’s `TIERS`), `webgpu.test.js`
- Modify: `src/runtime/quality.js` (`on((level) => setMipBias(biasFor(headroomAt(level).scale, { temporal })))`), `biasFor(scale, { temporal }) → number` exported and tested: `log2(scale) − 1` under 1, `−0.5` at 1 with `temporal`, 0 otherwise.

- [ ] **Step 1: failing tests** for `passesFor`’s sharpen row and strengths, `antialias()`’s table, `biasFor`’s three cases, `setMipBias` reaching a sharpened texture.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: the fixture**: `node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.77 --legs webgl` prints `sharpen` in its pass list and a `bias` line; shots before and after under `docs/superpowers/evidence/gpu-first/N2/`.
- [ ] **Step 6: commit** `A sharpen pass after the upscaler, the mip bias following the scale, and no multisampling under a temporal pass`.

### Task 3: velocity everywhere

**Files:**
- Modify: `src/lib/three/surface/compose.js` (every game material writes `mrt`’s `velocity` from three’s `velocity` node; alpha-tested foliage and panning materials included), `src/lib/three/particles/sprites.js` and `src/lib/three/decals/*` (the sprite and decal materials set the TRAA rejection flag, writing no velocity), `src/components/galaxy/surface/nodes/figures.js` (lane T2’s figures: skinned meshes write `velocity`)
- Modify: `src/runtime/fixtures/litWorld.js` (`--trails`: a crate, a skinned figure, an instanced row, a foliage card and a panning banner cross a still background over 30 frames), `scripts/light-fixture.mjs` (`--trails` reads the last frame and fails on any pixel in the trail band whose colour is the mover’s: the trail test)

- [ ] **Step 1**: the trail test fails on the fixture before the change (the instanced row and the foliage card trail).
- [ ] **Step 2**: implement; **Step 3**: `node scripts/light-fixture.mjs --trails --legs webgl`: PASS (no trail longer than one frame).
- [ ] **Step 4: commit** `Velocity written by everything that moves, so the temporal pass leaves no trail`.

### Task 4: reversed depth, specular anti-aliasing, the 30 fps cadence

**Files:**
- Modify: `src/runtime/webgpu.js` (`camera.reversedDepth = true` and the renderer’s depth format `depth32float` on `'webgpu'`; off on `nodes-webgl` until measured), `src/lib/three/light/sun.js` and `shadows.js` (the cascades’ compare under reversed depth: the sign of `biasFor` and the PCSS blocker search), `src/lib/three/surface/compose.js` (`specularAA(normal, roughness) → roughness` as a TSL `Fn`: Kaplanyan’s geometric widening with variance 0.15 and threshold 0.2, and `max(roughness, 0.045)`; a CPU twin tested), `src/lib/three/loop.js` (`createLoop(step, { ..., cadence = 1 })`: every `cadence`-th display beat), `loop.test.js`, `src/runtime/runtime.js` (cadence 2 when the visitor pins 30 or the tier is `T0`)

- [ ] **Step 1: failing tests**: `specularAA`’s twin widens a roughness of 0.1 at a normal gradient of 0.5 to the expected value and floors 0 to 0.045; `createLoop` with cadence 2 calls `step` on every second frame exactly.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: the fixture**: `--shadows` with and without `reversedDepth` on the webgl leg agree to PSNR ≥ 40 dB (Review Focus 5); the cloud cannot run the webgpu leg.
- [ ] **Step 6: commit** `Reversed depth on WebGPU, geometric specular anti-aliasing in the game material, and an exact 30 fps cadence`.

### Task 5: the laptop, the docs, the PR

- [ ] **Step 1**, on the laptop (RTX 5090, Edge, `ANGLE=d3d11`), every Star Wars world at ultra at 3,840 × 2,160 and 1,600 × 900 on WebGPU: `GPU=webgpu node scripts/perf-probe.mjs <world>Walk` (p95, `stdev`, the controller’s scale from `window.__RUNTIME__.quality.scale`), and `node scripts/frame-score.mjs` of each world’s shot against G1’s reference at the scales the controller reached. The table in `docs/superpowers/evidence/gpu-first/N2/README.md`: every world under 16.7 ms p95 with the scale at or above 0.67; FLIP no worse than G1’s baseline; `stdev` under 2 ms.
- [ ] **Step 2**: `docs/stack/webgpu-tsl.md` (`sharpen`, the samples rule, `reversedDepth` under Gotchas), `docs/stack/three.md` (`SharpenNode`, `mipmapBias`, `Camera.reversedDepth` in Upgrading), the hand-off’s row.
- [ ] **Step 3**: merge `origin/main`; the gates; push; PR `GPU-first lane N2: the stable picture`.
