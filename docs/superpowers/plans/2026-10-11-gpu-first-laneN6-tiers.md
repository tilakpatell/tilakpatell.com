# GPU-first lane N6: the tier table and the fallbacks. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts when lanes G1, N1 and N2 are on `main`** (it names their paths). Branch `claude/gpu-n6-tiers` from `origin/main`. One PR.

**Goal:** Unreal’s scalability groups as one tested table: the renderer tier × the quality level × the backend says which paths are on, every world boots on every tier, phones get a reduced preset that holds 30 fps, iOS 26.0 to 26.2 is caught by a self-test, and the settings line tells the visitor what they are seeing.

**Architecture:** `src/runtime/tiers.js` (pure) is the table; `post.js`’s `passesFor`, `createLevelScene`’s path choice, `probes.js`’s mode, `sun.js`’s cascades and cadence, `dynres`’s floor, the texture rows and the particle cap all read it; nothing else branches on a backend name. `webgpu.js` gains the two-frame self-test; `Settings.jsx` the tier and the scale; `?tier=` pins.

**Tech Stack:** the modules of G1, N1 and N2; `scripts/galaxy-check.mjs`; `ci.yml`’s two shards (lane T2’s); Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N6”, §5, §8).

## Global Constraints

- The table (every cell `_source`: the spec’s §4 N6 and the research note’s tier proposal):

| path | T0 | T1 | T2 |
| --- | --- | --- | --- |
| level path | batched (lane U) | GPU scene (N1) | GPU scene; clusters where N7 says |
| anti-aliasing | TAAU at 0.67, floor 0.58 | TRAA at 1, TAAU under, floor 0.67 | the same |
| SSGI, SSR | off (SSAO) | on (SSGI low/medium, SSR under 0.4) | SSGI high |
| probe grid | baked once a cell | budgeted (N3) | budgeted |
| cascades | 2 at 1,024, cadence near 1 far 4 | 4 at 2,048, the same cadence | the same |
| texture rows | ETC1S but normals UASTC, 1,024 cap | UASTC data rows, the tier’s cap | the same |
| particles | cap 1/2 of the record’s | the record’s | the record’s |
| frame budget | 33.3 ms | 16.7 ms | 16.7 ms |

- `nodes-webgl` is `T0` whatever the probe said; the classic renderer (low, or mid without WebGPU) is not in the table.
- The quality level stays the visitor’s and the budget rows stay `lib/budgets.js`’s; the tier never raises a row.
- The rules; the gates of the spec’s §10; the seventeen worlds at high on `nodes-webgl` in CI (T2’s shards) stay the cloud gate.

## Review Focus

1. A tier pinned by `?tier=T2` on a chip without 64-bit atomics: the cluster path is still off (a path needs its feature as well as its tier). Test: Task 1.
2. The iOS self-test on a device that is fine: two frames drawn and compared cost under 50 ms at start; a mismatch falls to `nodes-webgl` once and is kept for the visit, never looping. Test: Task 2.
3. A quality change while a world is up re-reads the table and rebuilds only what changed (the chain and the cadence), never the level path (that needs a world reload, as T2’s renderer swap does). Test: Task 1 (`diffTiers(a, b) → { chain, cadence, reload }`).
4. The settings line on the classic renderer says so and shows no tier. Test: Task 3.
5. A world on `T0` must still pass `galaxy-check`’s rows at mid (the reduced preset draws less, never more). Test: Task 3’s run.

---

### Task 1: the table

**Files:**
- Create: `src/runtime/tiers.js`, `tiers.test.js`
- Modify: `src/lib/three/light/post.js` (`passesFor(tier, entry, backend, refs)` takes `refs.paths` from `tiers.js` for the temporal, SSGI and SSR choices; `CANNOT` becomes the table’s), `src/components/galaxy/surface/level/levelScene.js` (the path from `paths.level`), `src/lib/three/light/probes.js`, `sun.js` (cascades and cadence from `paths`), `src/runtime/dynres.js` (floor and budget from `paths`), `src/components/galaxy/surface/level/levelPack.js` (rows from `paths.textures`), `src/lib/three/particles/effects.js` (`paths.particleCap`)

**Interfaces:**
- Produces: `pathsFor({ tier: 'T0'|'T1'|'T2', level: 'low'|'mid'|'high'|'ultra', backend: 'webgpu'|'nodes-webgl'|'webgl', features = new Set() }) → paths` (the table’s row as an object: `level`, `aa`, `floor`, `ssgi`, `ssr`, `grid`, `cascades`, `cadence`, `textures`, `particleCap`, `budgetMs`, `clusters`); `diffTiers(a, b) → { chain, cadence, reload }`.

- [ ] **Step 1: failing tests**: every cell of the table; `nodes-webgl` → T0’s row; `clusters` only with `atomic-vec2u-min-max` (Review Focus 1); `diffTiers` (Review Focus 3).
- [ ] **Step 2: run**: FAIL. **Step 3: implement**, then move each caller onto `pathsFor` (one commit a caller, each with its existing tests green).
- [ ] **Step 4: run** `npm test`: PASS. **Step 5: commit** `One tier table: which paths a renderer tier, quality level and backend turn on`.

### Task 2: the self-test and the phone preset

**Files:**
- Modify: `src/runtime/webgpu.js` (`selfTest(renderer) → Promise<boolean>`: two frames of a 64 × 64 gradient drawn and read back through `renderer.readRenderTargetPixelsAsync`; a mismatch over 2/255 on more than 1 % of pixels fails; the runtime then makes the renderer again with `forceWebGL: true` and sets `lostWebGPU` so the visit stays there), `webgpu.test.js`, `runtime.test.js`
- Modify: `src/runtime/loop` cadence (N2’s) to 2 on `T0`; `src/lib/device.js` nothing (the budget rows are the level’s)

- [ ] **Step 1: failing tests**: a fake renderer whose read-back differs fails the test once and is not asked again (Review Focus 2); a passing one costs two frames.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS. **Step 5: commit** `A two-frame self-test after init catches a flickering WebGPU device and falls to WebGL 2 once`.

### Task 3: the settings line, the pin, every world on every tier, the PR

- [ ] **Step 1**: `Settings.jsx`’s renderer line gains the tier and the controller’s current scale (`quality.scale`), nothing on the classic renderer (Review Focus 4); `?tier=` through `readTier` (G1); tests in `settings.test.js` and `gpuProbe.test.js`.
- [ ] **Step 2**: `BUDGET=1 QUALITY=high SCANS=game node scripts/galaxy-check.mjs surface <world>` for the seventeen worlds on `nodes-webgl` (T0) and, on the laptop, `?tier=T1` and `?tier=T2` on WebGPU at high and ultra; the rows hold at mid for T0 (Review Focus 5); the table per tier in `docs/superpowers/evidence/gpu-first/N6/README.md`.
- [ ] **Step 3**: `docs/stack/webgpu-tsl.md` Rules: “a path is on by the tier table, never by a backend name in a world”; `docs/architecture.md` one sentence; the hand-off’s row.
- [ ] **Step 4**: merge `origin/main`; the gates; push; PR `GPU-first lane N6: the tier table and the fallbacks`.
