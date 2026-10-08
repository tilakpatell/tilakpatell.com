# Smooth worlds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every world loads behind a loading screen until its GPU work is done, then draws without a frame over 100 ms; anything late is held back a few frames instead of stalling one.

**Architecture:** A small GPU-work library (`lib/three/gpuWork.js`: fences, sliced uploads and compiles, a warm draw, `prepareScene`) and a frame guard on the renderer (`lib/three/frameGuard.js`) that skips draws of materials not yet compiled or uploaded and readies them under a per-frame budget. Worlds prepare through it behind `LoadingVeil`; calibration and spatial chunks come after.

**Tech Stack:** three.js 0.186 (WebGLRenderer), React 19, Vite, Vitest (Node), Playwright-core + Chromium on Metal for the probe.

**Spec:** `docs/superpowers/specs/2026-10-07-smooth-worlds-design.md`

## Where this went

The work ran as one PR, not one per part, and a parallel session (PR #598, `claude/world-chunk-loading-56ef2c`, plus `bdfb0a54` and `1782a93d`) implemented parts 2, 3, 4 and 6 on `main` first. `main`'s implementation stands for every overlapping concern (`gpuWork`, `frameGuard`, `calibrate`, `pace`, `renderer`, `useScene`, `LoadingVeil`, the runtime's and the universe's and the galaxy's prepares); this branch's merge keeps it and adds what it lacks — the floor-bake cache, the chunk grids (a scene's cells, the universe's near maps, a surface's things), the per-world prepares main had not done (the twelve Middle-earth towns, Cybertron, Dot Matrix, Dead man's tide, the HQ views), and the handover's keys.

## Global Constraints

- Merge each part through its own GitHub PR with a merge commit after `npm test`, `npm run lint`, `npm run build` pass on the merged tree (see the repo's merge habit: sync `origin/main`, trial-merge against open branches).
- No new runtime dependencies.
- Comments in the codebase's voice: plain sentences saying what and why, no jargon headers.
- The probe bar: after a world is shown, no frame over 100 ms and p99 under 33 ms on the probe's journeys.
- Nothing may ever wait synchronously on the GPU in a frame while it has a backlog: readiness is asked only after a fence has signalled.

## Review Focus

1. A transparent double-sided material (three draws it twice a frame, bumping its version): the guard must not hide it forever — gate on "never compiled", not on version.
2. A canvas or video texture updated every frame: once uploaded it must never be gated again (gate only the first upload).
3. A post-processing quad (`renderer.render(mesh, camera)`, not a Scene) and the shadow pass (`scene === null`): pass through untouched, or the frame goes black.
4. A lost or disposed context mid-prepare: every promise resolves, nothing throws.
5. A world left while it's still preparing: its prepare stops at the next slice and the veil goes.

---

## Part 1 — the probe (PR 1)

### Task 1: probe, measurements, spec and plan

**Files:** Create `scripts/perf-probe.mjs`, `docs/research/2026-10-07-frame-hitches.md`, the spec and this plan. Modify `package.json` (script `"perf": "node scripts/perf-probe.mjs"`).

- [ ] `node --check scripts/perf-probe.mjs`; `npx eslint scripts/perf-probe.mjs`.
- [ ] Commit, PR "Perf probe: where the worlds stall", merge.

## Part 2 — GPU work without stalls (PR 2)

### Task 2: `src/lib/three/gpuWork.js`

**Interfaces (produces):**
- `nextFrame() → Promise<void>`
- `fence(renderer, { frame = nextFrame, cap = 5000 }) → Promise<void>`: WebGL2 `fenceSync` + `flush`, polled once a frame with `getSyncParameter(sync, SYNC_STATUS)`; resolves on `SIGNALED`, context lost, any throw, or `cap` ms; deletes the sync. Without `fenceSync`: two frames.
- `uploaded(renderer, texture) → bool`: true when `properties.get(t).__webglInit`, `t.version === 0`, `t.isRenderTargetTexture`, `t.isVideoTexture`, or no usable image.
- `textureBytes(texture) → number`: mip data byteLength sum for compressed, else w × h × depth × 4.
- `uploadSlices(renderer, textures, { sliceMB = 24, onStep, frame }) → Promise<number>` (count sent): only those not `uploaded`, smallest first, a `fence` whenever a slice's bytes reach `sliceMB`.
- `drawables(roots) → Object3D[]`: meshes, points, lines and sprites with a material, hidden ones included, one per distinct (material set, skinned, instanced, batched, morph, vertex colours).
- `compileSlices(renderer, roots, camera, scene, { sliceMs = 8, onStep, frame, cap = 20000 }) → Promise<Set<Material>>`: batches handed to `renderer.compile(batchRoot(batch), camera, scene)` where `batchRoot(list) = { traverse(fn) { list.forEach(fn) }, traverseVisible() {} }`; batch size adapts so a batch takes about `sliceMs`; a `fence` after each; then polls `currentProgram.isReady()` once a frame until all are ready, the context is lost or `cap` passes.
- `warmDraw(renderer, render, roots, { frame })`: `revealAll(...roots)`, scissor 1×1, `render()`, undo, fence.
- `prepareScene({ renderer, roots, scene, camera, render, onProgress, alive }) → Promise<void>`: uploads (weight 0.35), compiles (0.45), warm draw (0.2); `onProgress(fraction, step)` with step `'pictures' | 'shaders' | 'first draw'`; stops early when `alive()` turns false.

- [ ] **Tests** `src/lib/three/gpuWork.test.js` with a fake renderer (`getContext()` returning a fake gl with `fenceSync`, `getSyncParameter` that signals after N polls, `flush`, `deleteSync`, `isContextLost`; `properties` a WeakMap-backed `get`; `compile(root)` recording what `root.traverse` visits and giving each material `currentProgram = { isReady: () => readyAfter-- <= 0 }`; `initTexture` marking `__webglInit`): fence resolves only after signal; fence without fenceSync resolves after two frames; fence resolves on context loss; `uploaded` rules (video, render target, version 0, already init); `uploadSlices` fences after every `sliceMB` and skips uploaded ones; `drawables` dedupes shared materials but keeps skinned and plain apart; `compileSlices` compiles every material once with a fence after each batch and resolves after `isReady`; `prepareScene` reports increasing progress ending at 1 and stops when `alive()` is false.
- [ ] Run `npx vitest run src/lib/three/gpuWork.test.js` (fail), implement, run (pass), commit.

### Task 3: `src/lib/three/frameGuard.js`

**Interfaces (produces):** `guard(renderer, { uploadMB = 8, compileMs = 4, adopt = null }) → { enabled, adopt(fn), pending(), dispose() }`, idempotent per renderer (`renderer.userData`-free: kept in a WeakMap). Consumes `fence`, `uploaded`, `textureBytes` from Task 2.

Rules:
- wraps `renderer.renderBufferDirect`; when `scene !== null` and the material isn't known ready: ready already if it has a `currentProgram` and every texture it holds is `uploaded` (remembered); otherwise the draw is skipped and the material queued with its first object.
- wraps `renderer.render(scene, camera)`: remembers the last Scene and camera; when the queue isn't empty, `queueMicrotask(pump)` once.
- `pump`: while no fence is pending: for queued materials within `compileMs` of main-thread time: `adopt(object)` hooks, pictures sent up to `uploadMB` this frame (at least one), `renderer.compile(batchRoot([object]), camera, scene)`; then one `fence`; after it, a material whose `currentProgram.isReady()` and pictures are up becomes ready. A compile that throws marks the material ready (three reports it as before).
- in development: a frame in which `renderer.info.programs.length` grew inside `render` logs `[frameGuard] N shader(s) compiled mid-frame (Xms)`.

- [ ] **Tests** `src/lib/three/frameGuard.test.js` on the Task 2 fake extended with `renderBufferDirect`/`render`: a never-compiled material's draw is skipped and drawn once its program is ready after the fence; a material compiled already and with pictures up draws at once and is never queued; shadow draws (`scene === null`) always pass; a double-sided transparent material whose version bumps every draw draws every frame once ready; a canvas texture already uploaded and bumped every frame never gates; `adopt` runs before `compile` for a queued object; a compile that throws doesn't hide the material forever; `render(mesh)` of a non-Scene doesn't pump.
- [ ] Fail, implement, pass, commit.

### Task 4: install it

**Files:** Modify `src/lib/three/renderer.js` (`createRenderer(..., { guard: useGuard = true })` installs `guard(renderer)`; `precompile` → when the extension is there, wait on `fence` before the first `isReady()` poll; `linked` polls once a frame), `src/runtime/webgl.js` (guard on the runtime's renderer), `src/lib/three/house.js` (`houseOn` registers its `adopt` with the renderer's guard, so late materials compile with the look already on). Tests: extend `src/lib/three/precompile.test.js`/`renderer.test.js` where they fake the renderer.

- [ ] `npm test`, `npm run lint`.
- [ ] Probe all journeys (`OUT=$TMPDIR/probe/pr2 node scripts/perf-probe.mjs`); compare with the baseline; record in the research note.
- [ ] Commit; PR "Frame guard: no frame waits on a shader or a picture"; merge.

## Part 3 — the veil and the universe prepared (PR 3)

### Task 5: `src/components/worlds/LoadingVeil.jsx` + `loadingVeil.css`

Props: `{ shown, progress (0–1), step, title, line }`. A fixed layer over the world box, the title, a bar (`transform: scaleX(progress)` with a CSS transition so it moves on the compositor), the step's words (`STEP_WORDS = { pictures: 'Sending pictures to the graphics chip', shaders: 'Compiling shaders', 'first draw': 'Drawing it once', bake: 'Baking the light', tune: 'Tuning for this screen' }`), and a fade (opacity 0 over 400 ms, then unmounted). `role="status"`, `aria-live="polite"`. Test: `LoadingVeil.test.jsx` renders the words for a step and hides when `shown` is false (Vitest + the repo's existing React test setup).

### Task 6: `useScene` prepares whether covered or not

**Files:** `src/lib/three/useScene.js`. After `ready`, if the scene has `prepare(onProgress, alive)` (or `warmUp`), run it before `setStatus('ready')`: status `'preparing'`, and a `progress` ref + state `{ value, step }` returned from the hook (`useScene` returns `{ ..., status, progress }`). A `warmUp(timeLeft)` scene is driven a slice a frame (`timeLeft = () => 10 - elapsed`) until it returns true. Covered pages keep their idle-time warm-up as now. Test in `useScene` tests if present; else a small pure helper `driveWarmUp(warmUp, frame)` tested.

### Task 7: the universe prepared

**Files:** `src/components/universe/scene.js`, `src/components/universe/UniverseMap.jsx`.
- Adopt the house look (`house.follow({ adopt: true })`) before `ready`'s precompile.
- `prepare(onProgress, alive)`: `prepareScene` over the scene, with the stocked hunters/traffic, the leviathans, set-piece stand-ins and the cockpit roots revealed for it; render = `post.render(64, 64)` scissored, as `warmUp` does now.
- Pools: the scene's `stockUp` and fleet `want()` for every kind the crew's side can meet, so their GLBs are fetched and readied behind the veil.
- `UniverseMap.jsx` shows `LoadingVeil` while `status === 'preparing'` (title "The universe").
- [ ] Probe `universe`; bar met; commit; PR; merge.

## Part 4 — runtime worlds (PR 4)

### Task 8: runtime prepare

**Files:** `src/runtime/runtime.js` (`build()`: after `ready`, `await world.prepare?.((value, step) => events.emit('prepare', { value, step }), () => token === seq)`), `src/runtime/module.js` (`fromScene` passes `scene.prepare` through), `src/runtime/useWorld.js` (returns `progress` from `prepare` events), `src/runtime/runtime.test.js` (prepare awaited before begin; a newer mount stops it).

### Task 9: galaxy and surface

**Files:** `src/components/galaxy/module.js`, `src/components/galaxy/surface/module.js`, `src/components/galaxy/surface/scene.js`, `src/pages/Galaxy.jsx`, `src/pages/GalaxySurface.jsx`: the surface's create yields a frame between its build steps; `prepare` on `prepareScene`; the floor bake moved into `prepare` (step `'bake'`); the pages show the veil on a direct load (not during a flown handover, where the dive is the loading screen).

### Task 10: bake cache

**Files:** Create `src/lib/three/bakeCache.js` (`bakeKey({ world, place, sun, tier, casters }) → string` hashing the casters' geometry counts and positions; `getBake(key) → Promise<{width,height,data}|null>`, `putBake(key, mask)`; IndexedDB `tp-bakes`, store `masks`; failures resolve null). Modify `src/lib/three/groundwork.js` to consult it before `bakeFloorTexture`. Test the key (pure).

- [ ] Probe `galaxy`, `travel`, `surface`, `earth`; commit; PR; merge.

## Part 5 — worlds with their own renderers (PR 5)

### Task 11: per world

For each of Avengers, Middle-earth (Shire and towns), Albuquerque, C-137, Cybertron, Invincible, music room, Caribbean, Dot Matrix: give its scene a `prepare` built on `prepareScene` (its late loads listed in the code map pulled into it), and its page the veil. One commit per world; probe each.

## Part 6 — calibrate and hold (PR 6)

### Task 12: `src/lib/three/calibrate.js`

`gpuTimer(gl) → { begin(), end(), poll() → ms | null }` on `EXT_disjoint_timer_query_webgl2`; `pickRatio(samples: [{ ratio, ms }], budget) → ratio` (pure: the largest ratio whose median ≤ budget, else the smallest); `calibrate({ renderer, draw, ratios, budget = 12, frames = 24 }) → Promise<ratio>`; `remember(key, ratio)`/`recall(key)` in localStorage `tp-calibration`. `pace.js` gains a `ceiling` level (start there, never step above). Tests for `pickRatio`, the store, and pace's ceiling.

## Part 7 — chunks

Dropped here: the infinite-worlds design (another session; `docs/superpowers/specs/2026-10-07-infinite-worlds-design.md`) owns spatial chunking (`runtime/chunkGrid.js`, `workers.js`, `origin.js`, merged in PR #600) and counts this plan as its Phase 0. Its chunk meshes reach the GPU through this plan's frame guard on the runtime's renderer.
