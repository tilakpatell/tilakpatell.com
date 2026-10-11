# GPU-first lane N5: the frame’s physics and effects, split as Chaos splits them. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts now from `origin/main`** (T2 is not needed; merge `origin/main` before the PR). Branch `claude/gpu-n5-sim` from `origin/main`. One PR.

**Goal:** Rapier stays the truth for what touches gameplay and a worker stands ready behind the same face, switched on only when a measured step passes 2 ms a frame; debris is a few hulls that can hit the player and a GPU burst with depth-buffer collision; particle lights join the clustered list.

**Architecture:** `src/lib/physics/worker.js` runs `createPhysics` in a Worker behind `createPhysics({ worker: true })`: the same `add`, `remove`, `step` face, poses double-buffered as transferable `Float32Array`s, interpolation by `alpha`, loaded through `lib/wasm/load`. `src/lib/three/particles/debris.js` spawns a burst into `gpu.js`’s buffers with a depth-collision term in the update kernel; `src/lib/physics/breaks.js` (pure) decides hulls against burst from a break’s size; sleeping hulls become static instances; `effects.js` appends particle lights to `ClusteredLighting` within its cap.

**Tech Stack:** `@dimforge/rapier3d-compat@0.21.0` and its SIMD build (lane X2’s `engine.js`), Web Workers (module), transferable buffers (no SharedArrayBuffer), three r186 TSL compute (`instancedArray`, the depth texture), `ClusteredLighting`; Vitest in Node against the real engine; `scripts/x2-profile.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N5”, §6).

## Global Constraints

- `src/lib/physics/` stays pure: no three.js, no DOM; the worker file is the one place a `Worker` is made, through `src/runtime/workers.js`’s pool shape.
- Rapier is imported only in `src/lib/physics/world.js` (and the worker, which imports `world.js`); the pin stays 0.21.0 (the newest release; the research note).
- No SharedArrayBuffer (GitHub Pages has no cross-origin isolation; Rapier’s wasm is single-threaded anyway).
- The worker is switched on by data only where a world’s measured step passes 2 ms a frame on the laptop (`_source`: lane X2’s 0.5 ms a frame; the hop is 0.1 to 0.5 ms, the research note); until then `worker: false` everywhere.
- A break: hulls for pieces over 0.5 m (at most 8 a break, 64 live, sleeping hulls become static instances after 2 s asleep), a GPU burst of 200 to 2,000 particles for the rest; a seed gives the same battle (`x2-profile.mjs`’s replay: 0 of 2,946 searches differ today and must still).
- The rules; the gates of the spec’s §10.

## Review Focus

1. A worker that fails to start (no module workers, a blocked wasm): `createPhysics({ worker: true })` falls back to the main-thread engine and `status().worker` is `false`. Test: Task 1.
2. A body added and removed between two worker steps: the pose buffer has no row for it; the main thread must not read a stale index. Test: Task 1 (ids, not indices, in the buffer header).
3. A burst spawned off-screen: depth collision reads a depth of 1 (nothing) and particles fall through; the kernel treats “no depth” as “no collision” and the lifetime bounds them. Test: Task 2’s CPU twin.
4. A break during a ragdoll’s fall on the same frame: the live-hull cap counts ragdoll bodies too, so the cap holds the step under 2 ms. Test: Task 3.
5. Particle lights past the cluster cap: the newest are dropped, never the placed lights (`placed.js`’s come first). Test: Task 3.

---

### Task 1: the physics worker behind the same face

**Files:**
- Create: `src/lib/physics/worker.js` (the Worker’s side: `createPhysics` from `world.js`, messages `add`, `remove`, `step`, `origin`, `query`; poses as `Float32Array` [id, x, y, z, qx, qy, qz, qw] rows, two buffers transferred back and forth), `src/lib/physics/workerClient.js` (the page’s side: the same face as `world.js`’s `createPhysics`, `body.position()` and `quaternion()` read the latest buffer interpolated by `alpha`, queries are promises answered next step), `worker.test.js` (Node: a fake `Worker` that runs `worker.js` in-process), `workerClient.test.js`
- Modify: `src/lib/physics/world.js` (`createPhysics({ ..., worker = false })` returns `workerClient` when true and a Worker can be made, else the engine as now), `src/lib/physics/engine.js` (the worker loads Rapier through `lib/wasm/load` too)

**Interfaces:**
- Produces: the unchanged `createPhysics` face plus `status() → { worker: boolean, hopMs }`; `encodePoses(bodies, out) / decodePoses(buf) → Map<id, pose>` (pure, tested).

- [ ] **Step 1: failing tests**: encode/decode round-trip; a removed body has no row (Review Focus 2); the fallback when the Worker throws (Review Focus 1); one scene stepped on the main thread and through the fake worker lands within 1e-6 (the same engine).
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run** `npx vitest run src/lib/physics`: PASS.
- [ ] **Step 5: commit** `Rapier behind the same face in a worker, poses as transferable rows, off by default until a step is measured over 2 ms`.

### Task 2: GPU debris

**Files:**
- Create: `src/lib/three/particles/debris.js`, `debris.test.js`; modify `src/lib/three/particles/gpu.js` (the update kernel gains a `collide` term: sample last frame’s depth at the particle’s screen position, reconstruct the normal from depth, reflect and damp when the particle is behind the surface within 0.1 m; no depth → no collision), `gpu.test.js` (the CPU twin agrees with the kernel on a synthetic depth plane)
- Create: `src/lib/physics/breaks.js`, `breaks.test.js` (pure: `splitBreak({ size, mass, pieces }) → { hulls: n, burst: n }` by the constraints above)

**Interfaces:**
- Produces: `createDebris(effects, physics, { maxHulls = 64, sleepToStatic = 2 }) → { break(at, size, velocity, material) → void, update(dt), stats() }`; `splitBreak`.
- Consumes: `effects.js`’s `createEffects` (lane X), `createPhysics`.

- [ ] **Step 1: failing tests**: `splitBreak`’s table; the collide twin on a plane (a particle below the plane is reflected; off-screen falls, Review Focus 3); sleeping hulls become static after 2 s and free their slot.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5: the fixture**: `--debris` on the lit fixture: 100 breaks in a minute; `stats()` and the CPU step (the fixture’s `renderer.info` plus `physics.timing`).
- [ ] **Step 6: commit** `Debris as a few hulls the player can hit and a GPU burst that lands on the depth buffer`.

### Task 3: the caps, the lights, the measure, the PR

- [ ] **Step 1**: the live-hull cap counts ragdoll bodies (`src/lib/three/ragdollPhysics.js` registers its bodies with `debris`’s counter) (Review Focus 4); `effects.js` appends lit particles’ lights after `placed.js`’s and drops the newest past `ClusteredLighting`’s `maxLights` (Review Focus 5); tests for both.
- [ ] **Step 2**: `node scripts/x2-profile.mjs --seconds 60 --tier ultra --breaks 100`: the step under 2 ms a frame (p95), the same searches and the same battle as the replay (0 differ); on the laptop the GPU frame within 1 ms of before with 100 breaks a minute on Hoth.
- [ ] **Step 3**: `docs/stack/physics-rapier.md` (the worker under “How the site uses it”, the rule that it is off by default and why; `worker.js` beside `world.js` as the second import site), `docs/stack/webassembly.md` (the worker loads through `load.js`), the hand-off’s row.
- [ ] **Step 4**: merge `origin/main`; the gates; push; PR `GPU-first lane N5: physics and effects split as Chaos splits them`.
