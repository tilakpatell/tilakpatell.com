# GPU-first lane G1: the reference frames and the GPU clock. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts now from `origin/main`**; the lit fixture and the `battlefront` world are already `'nodes'`, so the clock, the probe and the scorer are built on them; when lane T2 (`claude/bf2017-t2-flip`) lands, merge `origin/main` and shoot the Star Wars worlds. Branch `claude/gpu-g1-reference` from `origin/main`. One PR.

**Goal:** Every later lane measures against the same thing: the frame’s GPU time read on the page, a device’s renderer tier decided once from a probe and the adapter’s features, and a supersampled reference frame per Star Wars world that FLIP scores a candidate against.

**Architecture:** `src/lib/three/gpuTime.js` wraps three’s `trackTimestamp` and `resolveTimestampsAsync` as a ring of frame times; `src/lib/gpuProbe.js` (pure rules) turns a one-second measurement and `adapter.features` into `T0 | T1 | T2`, kept in `localStorage` beside `tp-quality`; `scripts/reference-frames.mjs` shoots each world 8× jittered at native size with no temporal pass; `scripts/frame-score.mjs` scores a shot against its reference with FLIP where Python has it and PSNR plus SSIM in Node otherwise; the perf probe gains a frame-time variance column.

**Tech Stack:** three r186 `WebGPURenderer` (`renderer.trackTimestamp`, `renderer.resolveTimestampsAsync()`, `renderer.info.render.timestamp`), `navigator.gpu.requestAdapter().features`, Playwright (`scripts/light-fixture.mjs`’s harness), NVIDIA FLIP (`pip install flip-evaluator`, run on the laptop), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “G1”, §5, §10).

## Global Constraints

- The rules: `docs/health/RULES.md` and `.claude/skills/autopilot/SKILL.md`: British spelling, curly quotes, `_source` on every number, files under 800 lines, tests beside files, `src/lib/three` knows no world, every addon import dynamic.
- No new npm dependency (FLIP is a desktop tool invoked by a script, not a package).
- Chrome quantises `timestamp-query` to 100 µs: nothing here claims a finer resolution.
- The canvas’s size never changes for a measurement; the reference is at the screen’s own pixels, ratio capped at 2.
- Gates before the PR: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && npm run coverage:bf2017 && npm run maps:bf2017`.

## Review Focus

1. An adapter without `timestamp-query` (Safari’s support is unconfirmed): `gpuTime` answers `null` and the caller keeps the CPU pace. Test: Task 1’s fake renderer without the feature.
2. A tier kept in `localStorage` from another chip (the laptop docked to a different GPU): the probe re-runs when the adapter’s `info` (vendor, architecture) differs from the kept one. Test: Task 2.
3. `?tier=` pins a tier for the visit over the kept one, as `?quality=` does; an unknown value pins nothing. Test: Task 2.
4. A world whose clock moves (Earth’s sun) shot twice differs: the reference script freezes the page clock as `gpu-parity.mjs` does. Test: Task 3’s dry run shoots the fixture twice and the two agree to PSNR ≥ 50 dB.
5. The variance column on a run with a pause (a tab in the background) must not count the pause: deltas over 250 ms are dropped, as `pace.js` drops them. Test: Task 4.

---

### Task 1: the GPU clock

**Files:**
- Create: `src/lib/three/gpuTime.js`, `src/lib/three/gpuTime.test.js`

**Interfaces:**
- Produces: `createGpuTime(renderer, { frames = 32 } = {}) → { frame() → Promise<void>, median, p95, last, available }`. `available` is `renderer.hasFeature?.('timestamp-query') === true`; when false every number is `null` and `frame()` resolves at once. `frame()` is called after `renderer.render`: it awaits `renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER)` (r186’s name) and pushes `renderer.info.render.timestamp` (ms) onto the ring.

- [ ] **Step 1: the failing tests**: `available` false → nulls and no call to `resolveTimestampsAsync`; a fake renderer feeding 32 timestamps 1…32 → `median` 16.5, `p95` 31; a 33rd pushes the first out.
- [ ] **Step 2: run** `npx vitest run src/lib/three/gpuTime.test.js`: FAIL (module missing).
- [ ] **Step 3: implement** with `renderer.trackTimestamp = true` set in the constructor when available; the ring a `Float64Array(frames)`.
- [ ] **Step 4: run the tests**: PASS. **Step 5: commit** `The frame’s GPU time read from the renderer’s timestamps, a ring of 32`.

### Task 2: the renderer tier

**Files:**
- Create: `src/lib/gpuProbe.js`, `src/lib/gpuProbe.test.js`
- Modify: `src/lib/device.js` (one export: `rendererTier()` reading the kept value; nothing else changes)

**Interfaces:**
- Produces: `classifyTier({ features = new Set(), limits = {}, medianMs = null, phone = false, info = {} }) → 'T0' | 'T1' | 'T2'` (pure): `T0` when `phone`, or no `timestamp-query`, or `medianMs` over 8 ms for the fixture’s probe scene; `T2` when `features.has('atomic-vec2u-min-max') && features.has('subgroups')` and `limits.maxStorageBuffersPerShaderStage >= 16`; else `T1`. `readTier(search, hash, stored, info) → { tier, fresh }`: `?tier=T0|T1|T2` wins; a stored `{ tier, info }` whose `info.vendor + architecture` matches is kept; else `fresh: true`. `keepTier(tier, info)` writes `localStorage` `tp-tier`. `probeTier(renderer, scene, camera, { ms = 1000 }) → Promise<'T0'|'T1'|'T2'>` draws the lit fixture’s probe scene (`src/runtime/fixtures/litWorld.js`’s `probeScene()`, a new export: the ring of pillars at high) for `ms` and classifies with Task 1’s median.
- Consumes: `createGpuTime` (Task 1).

- [ ] **Step 1: the failing tests** pin every row of the table above, the `?tier=` override, an unknown value, and the stale-info case.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: wire**: `src/runtime/runtime.js` runs `probeTier` once per page for a `'nodes'` module when `readTier` says `fresh`, before the world’s first frame, and exposes `rt.tier`; `src/components/settings/Settings.jsx`’s renderer line (lane T2’s) gains the tier. A test in `runtime.test.js` that a kept tier skips the probe.
- [ ] **Step 6: commit** `A device’s renderer tier from a one-second probe and the adapter’s features, kept beside the quality level`.

### Task 3: the reference frames

**Files:**
- Create: `scripts/reference-frames.mjs`, `scripts/frame-score.mjs`, `scripts/frame-score.test.mjs`, `docs/superpowers/evidence/gpu-first/reference/README.md`

**Interfaces:**
- Produces: `node scripts/reference-frames.mjs <world…> [--pose gallery] [--size 1600x900] [--jitter 8]`: the dev server, the page clock stopped (as `scripts/gpu-parity.mjs` does), `?quality=ultra&gpu=webgpu&traa=off&jitter=<i>` (a new dev-only hook on the surface’s chain: `window.__RUNTIME__.gfx.jitter(i)` offsets the projection by Halton(2,3)[i] and the chain draws no temporal pass), 8 shots averaged in linear light into `docs/superpowers/evidence/gpu-first/reference/<world>.png` with a `<world>.json` (`_source`, pose, size, backend, three’s version). `node scripts/frame-score.mjs <candidate.png> <reference.png> [--ppd 67]` prints `{ flip, psnr, ssim }`: FLIP through `python -m flip` when `which flip` finds it, else `flip: null`; PSNR and SSIM in Node (pure functions in `scripts/lib/frame-metrics.mjs`, tested against two known images).

- [ ] **Step 1: the failing test** for `psnr` and `ssim` on a 4 × 4 pair with a known answer.
- [ ] **Step 2: run**: FAIL. **Step 3: implement the metrics**, then the two scripts.
- [ ] **Step 4: dry run in the cloud**: `node scripts/reference-frames.mjs litWorld --size 800x450` twice on `nodes-webgl` (software GL; the webgpu leg is the laptop’s): the two agree to PSNR ≥ 50 dB (Review Focus 4).
- [ ] **Step 5: commit** `Reference frames: each world shot eight times jittered and averaged, and a score against them`.

### Task 4: the probe’s variance column, and the baseline

**Files:**
- Modify: `scripts/perf-probe.mjs` (the columns at the table’s print: `stdev` beside `p95`)
- Create: `docs/superpowers/evidence/gpu-first/G1/README.md`

- [ ] **Step 1**: the standard deviation of frame-to-frame deltas over the journey, deltas over 250 ms dropped (Review Focus 5); a unit test on the pure helper in `scripts/lib/perf-stats.mjs`.
- [ ] **Step 2**: the baseline, on the laptop (RTX 5090, Edge, `ANGLE=d3d11`): `node scripts/reference-frames.mjs hoth endor kashyyyk --size 3840x2160` and `--size 1600x900`; then the current ultra frame of each with `scripts/battlefront-shots.mjs` (or `galaxy-check surface <world> --shot`) scored by `frame-score.mjs`; `GPU=webgpu node scripts/perf-probe.mjs hothWalk` for the variance; `gpuTime`’s median against `renderer.info`’s CPU frame on the fixture (within 10 %). Write the table in the README with every `_source`. The cloud leg (software GL) proves the scripts run and fills the `nodes-webgl` rows only.
- [ ] **Step 3**: the hand-off: `docs/superpowers/HANDOFF-gpu-first.md` created with Done, Left (the laptop rows if unfilled), Checking it; the lane table from the spec’s §4. `docs/stack/three.md`’s Upgrading gains `trackTimestamp`, `resolveTimestampsAsync` and `TimestampQuery.RENDER` as names to re-check.
- [ ] **Step 4**: merge `origin/main`; the gates; push; PR `GPU-first lane G1: the reference frames and the GPU clock` with the baseline table.
