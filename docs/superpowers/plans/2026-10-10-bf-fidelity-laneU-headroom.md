# Fidelity lane U: headroom. Upscaling, batching and occlusion. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane L's pack (#831) is on `main`; measured on the owner's laptop.**

**Goal:** The frame has room for lanes S, V, X and N at ultra: the picture is rendered under the screen's size and upscaled (`FSR1Node` or `TAAUNode`) as the pace controller's first step before any pass is shed; the level's static instances draw as `BatchedMesh` per material per cell band; the far list in a render bundle; the hangar's walls occlude what is behind them.

**Architecture:** `light/post.js` gains `upscale: { kind: 'fsr1' | 'taau', scale }` built by `passes.js` as the last pass before `output`; `rt.quality`'s levels map to internal-resolution steps (0.77, 0.67, 0.5) before the pass-shedding order; lane L's `levelScene.js` gains a `BatchedMesh` path per material and a `BundleGroup` round the far list (with lane L: this lane's PR touches `levelScene.js` only after L's merge and keeps L's `InstancedMesh` path as the fallback); `occlusion.js` (occlusion queries on the walls' bounds, the far draws skipped when occluded).

**Tech Stack:** `three/addons/tsl/display/{FSR1Node,TAAUNode}.js`, `three/webgpu` (`BatchedMesh`, `BundleGroup`, occlusion queries), the merged light stack, lane L's `surface/level/`, `scripts/perf-probe.mjs` with `GPU=`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` ("Lane U").

## Global Constraints

- **Files this lane owns**: `light/post.js`, `light/passes.js` (`upscale`: additive), `src/runtime/quality.js` (the resolution steps: additive, tested), `surface/level/levelScene.js` (the batched path: additive, after L merges), `surface/level/occlusion.js` (+ test), the evidence folder `galaxy-engine/U/`.
- Ships only with the perf table on the owner's laptop: the frame at ultra on Hoth before and after, both backends; a change that does not lower the frame is reverted.
- Files under 800 lines; tests beside; the gates.

## Review Focus

1. **TAAU and TRAA together**: TAAU is temporal too; a chain with `traa` and `upscale: 'taau'` keeps TAAU alone (it anti-aliases as it upscales); FSR1 pairs with SMAA. The test on `passesFor`.
2. **Text and the HUD** are drawn at full resolution (the runtime's HUD kit is DOM, so nothing changes; the check asserts the canvas's CSS size is unchanged).
3. **BatchedMesh and the cells**: a cell's instances added to and removed from a batch without a rebuild of the geometry (the batch's capacity per material from the pack's counts); the stats show one draw per material per band.

---

### Task 1: Upscaling as the first step
- [ ] `upscale` in `post.js`/`passes.js`; `quality.js`'s steps; the test on the order; the frame table at 0.77 and 0.67; commit `The picture rendered under the screen and upscaled before any pass is shed`.

### Task 2: Batching, bundles, occlusion
- [ ] The `BatchedMesh` path; the far list's bundle; `occlusion.js`; the draw-count and frame tables on Hoth; commit `The level's statics batched, the far list bundled, the walls occluding`.

### Task 3: The PR
- [ ] The hand-off's row; the gates; merge `origin/main`; push; PR `Fidelity lane U: headroom at ultra` with the tables.
