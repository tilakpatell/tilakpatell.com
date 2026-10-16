# Engine floor, lane FL5: the frame off the main thread

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The runtime’s renderer and loop running in a module worker on an `OffscreenCanvas` behind `?worker=on`, the lit fixture first and then Battlefront, measured on the RTX 5090; kept only where the worst 1 % of frames falls.

**Architecture:** New files only under `src/runtime/worker/`: `host.js` on the page (transfers the canvas, posts the input snapshot, the size, the quality level and visibility each frame, relays `rt.events` back, proxies the page-only services), `worker.js` inside the worker (makes the runtime with `makeBackend` on the offscreen canvas, imports the module by id, mounts and runs it), `protocol.js` (the message shapes, pure, tested). One opt-in line in `src/runtime/index.js`: `runtime()` returns the worker-backed `rt` when `?worker=on` and `OffscreenCanvas` and module workers exist.

**Tech Stack:** `OffscreenCanvas`, module `Worker` (`vite.config.js` has `worker: { format: 'es' }`), `three/webgpu` in a worker (r186 supports an `OffscreenCanvas` in `WebGPURenderer`), `scripts/perf-probe.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §4.8; the every-world hand-off’s “Not to do” (the renderer in a worker before the ports is a spike, not the product).

## Global Constraints

- New files only, plus one guarded line in `src/runtime/index.js`; nothing else under `src/runtime/` or `src/components/` changes.
- Off by default; `?worker=on` (and `localStorage` `tp-worker` `'on'`) turns it on; a browser without `OffscreenCanvas` or without `transferControlToOffscreen` gets the page runtime as today.
- What cannot cross (React, the HUD’s DOM, `AudioContext`, `localStorage`, `navigator.gpu` adapter info) stays on the page behind the same `rt` faces (`rt.audio`, `rt.saves`, `rt.events`), proxied by message; a world that touches `document` or `window` directly in `create` is not a candidate for the worker in this lane (the fixture and Battlefront’s module are checked first; a touch is listed in the README).
- Input to picture at most one frame later than on the page (the host posts the snapshot in its own `requestAnimationFrame` before the worker’s frame; measured by the probe’s `main` column and a DEV timestamp round trip).
- The four checks before the pull request.

## Review Focus

1. A HUD number written through a ref by the world’s `step` (the design’s HUD rule) must still land every frame: the worker posts a `hud` message with the numbers and `host.js` writes the refs; Battlefront’s snapshot (`setSnap`) path is the test.
2. A resize on the page must reach the worker before the next frame, and the worker must never size the canvas itself (`gfx.setSize` runs in the worker; the host posts `{ type: 'resize', w, h, ratio }`).
3. A lost device in the worker must reach `useWorld`’s recovery path (`rt.lost()` relayed as an event; the page remounts on the page runtime).
4. A world that dynamically imports a chunk in the worker must get Vite’s worker chunking (`import()` inside the worker resolves to the worker’s own chunks: `vite.config.js`’s `worker.format: 'es'` note).
5. The probe must see the worker’s frames: the recorder’s `requestAnimationFrame` is the page’s; the worker posts `{ type: 'frame', ms, gpu }` so the probe’s `__RUNTIME__` face reads the worker’s numbers (a DEV-only bridge in `host.js`).

---

### Task 1: The protocol

**Files:**
- Create: `src/runtime/worker/protocol.js`, `src/runtime/worker/protocol.test.js`

**Interfaces:**
- Produces: `export const MESSAGES` (the up messages: `init { canvas, kind, opts, module, props, search, hash }`, `input { snapshot }`, `resize { w, h, ratio }`, `visible { on }`, `quality { level }`, `call { id, name, args }`; the down messages: `ready`, `event { type, data }`, `hud { values }`, `frame { ms, gpu }`, `lost { reason }`, `result { id, value }`); `export function packInput(snapshot) → transferable object` (the keys and pressed sets as arrays; the pointer and pad as plain numbers) and `export function unpackInput(packed) → snapshot` (the shape `src/runtime/input.js`’s `sample()` returns: `keys: Set`, `pressed: Set`, `pointer`, `pad`, `stick`, `axis(name)`, `action(name)`).

- [ ] **Step 1: Test** `unpackInput(packInput(snapshot))` equals the snapshot for a snapshot with two keys, one pressed, a pointer drag and a pad; `axis('turn')` after `bind` is the same number.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes.
- [ ] **Step 5: Commit** `FL5: the worker protocol`.

### Task 2: The worker

**Files:**
- Create: `src/runtime/worker/worker.js` (`self.onmessage`: on `init`, `createRuntime({ makeBackend: (kind, opts) => makeBackend(kind, { ...opts, canvas }) … })` with `src/runtime/browser.js`’s `makeBackend` given the offscreen canvas (`makeBackend` makes its own `document.createElement('canvas')` today: a `canvas` option is one added line in `browser.js`, allowed as the lane’s second line outside `worker/`), `loop` on the worker’s `requestAnimationFrame`, `input` a snapshot store fed by `input` messages, `saves`/`audio`/`store` proxies posting `call` messages and awaiting `result`; the module by id from a map `MODULES = { litWorld: () => import('../fixtures/litWorld.js'), battlefront: () => import('../../components/battlefront/module.js') }`)
- Test: `src/runtime/worker/worker.test.js` (the message handling with a fake `self` and a fake `createRuntime`: an `init` makes the runtime and mounts the module; an `input` message replaces the snapshot; a `resize` calls `rt.resize(w, h)`)

- [ ] **Step 1: Test** the three behaviours.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes.
- [ ] **Step 5: Commit** `FL5: the runtime in a worker`.

### Task 3: The host

**Files:**
- Create: `src/runtime/worker/host.js` (`createWorkerRuntime({ canvas, module, props }) → rt` with `useWorld`’s face: `mount`, `unmount`, `resize`, `setVisible`, `invalidate`, `events`, `input` (the page’s `createInput()`, sampled each page frame and posted), `saves`, `audio`, `status`, `current`); `src/runtime/worker/host.test.js` (a fake `Worker`: `mount` posts `init` with the canvas transferred; a page frame posts one `input`; an `event` message reaches `rt.events`)
- Modify: `src/runtime/index.js` (one line: `if (workerAsked(win) && canWorker(win)) return (instance = createWorkerRuntime(...))` before `createRuntime`)

- [ ] **Step 1: Test** the three behaviours.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes; `npm run dev`, open `/battlefront/hoth?worker=on&software=on` in the container’s Chromium (`scripts/lib/chromium.mjs`’s `findChromium`) → the world draws, the HUD’s numbers move, the console clean.
- [ ] **Step 5: Commit** `FL5: the host, behind ?worker=on`.

### Task 4: The measure

**Files:**
- Create: `docs/superpowers/evidence/engine-floor/FL5/README.md`
- Modify: `scripts/perf-probe.mjs` only if it needs `WORKER=on` to add the query (one env row, like `GPU`)

- [ ] **Step 1:** In the container: `QUALITY=low node scripts/perf-probe.mjs litWorld` with and without `WORKER=on` (software GL: the shape only); `scripts/battlefront-check.mjs` with `?worker=on` green.
- [ ] **Step 2:** The owner’s desktop rows (the commands written in the README): `GPU=webgpu QUALITY=high node scripts/perf-probe.mjs battlefront` twice, `WORKER=on` and off, interleaved, three runs each; the `main`, `p50` and `worst 1 %` columns side by side.
- [ ] **Step 3:** The decision rule in the README: kept if the worst 1 % falls on the desktop and input-to-picture is within one frame; else the flag and `worker/` stay on the branch as the evidence and the pull request is closed with the table.
- [ ] **Step 4:** `git fetch origin main && git merge origin/main`; the four checks; push `claude/engine-floor-fl5-worker`; the pull request with the tables; FL5’s row in the hand-off.
