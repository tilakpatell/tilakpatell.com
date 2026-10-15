# Performance lane P0, the measure: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/perf-probe.mjs` reports, per route and backend, the median frame and its worst 1 %, the main thread’s and the GPU’s milliseconds, draws, programs and the pipelines made after the first second, for every heavy world; the desktop’s baseline is measured and the laptop’s commands written out.

**Architecture:** the page-side recorder (an init script) gains three counters: the time spent in `requestAnimationFrame` callbacks a frame (the main thread’s frame cost, any loop, on or off the runtime), WebGPU’s draws and pipelines (wrapping `GPURenderPassEncoder`, `GPURenderBundleEncoder` and `GPUDevice` the way the WebGL calls are wrapped), and the G1 clock’s last reading where the runtime has one. The arithmetic moves out of the script into `scripts/lib/perf-stats.mjs`, pure and tested; the heavy routes are a list in `scripts/lib/perf-routes.mjs`, tested against `src/App.jsx`.

**Tech Stack:** Node, Playwright (`playwright-core`) driving the machine’s Chromium (Edge on Windows), Vitest.

**Spec:** `docs/superpowers/HANDOFF-runtime.md` (lane P0), `docs/superpowers/HANDOFF-runtime.md` item 19.

## Global constraints

- Only P0’s files: `scripts/perf-probe.mjs`, `scripts/lib/perf-stats.mjs` (+ test), `scripts/lib/perf-routes.mjs` (+ test), `docs/superpowers/evidence/perf/`, the lanes file’s P0 row.
- The routes: `/battlefront/hoth`, `/galaxy/hoth/surface`, `/galaxy`, `/fly`, `/universe`, `/middle-earth`, `/c-137`, `/avengers`, `/deathstar`, `/deathstar/inside`.
- A number with no data prints `-` and is never read as zero (“not assessed”).
- Tests under a second, no network (RULES.md).
- Repo voice in comments and docs: British spelling, curly quotes, comments say why.

## Review focus

1. A phase with no frames (a journey that stopped early): every column `-` or 0, no `NaN`, no throw.
2. A world off the runtime (`__RUNTIME__` absent): GPU `-`, the rest measured.
3. WebGL and WebGPU in one page (a classic page’s backdrop beside a nodes world): both counted, draws summed.
4. A render bundle executed every frame: its draws counted each frame it is executed, not once.
5. Fewer than 100 frames: the worst 1 % is the single slowest frame, not an empty mean.

---

### Task 1: the arithmetic, pure

**Files:** Modify `scripts/lib/perf-stats.mjs`; Test `scripts/lib/perf-stats.test.mjs`.

**Produces:** `F` (the frame record’s field indices: `t, links, tex, texMB, bufMB, draws, tris, glMs, drawMs, slow, mid, sizes, main, gpu, pipes, progs`), `median(xs) → number | null`, `worstShare(ms, share = 0.01) → number | null` (the mean of the slowest `max(1, ceil(n × share))`), `summarise({ frames, marks, loaf }) → row[]` (the old `phases()`, plus `w1`, `main`, `gpu`, `pipes`, `progs`, `loafs`, `block`), `playOf(marks) → [t0, t1] | null` (from the mark after `settle`, or the first, to the last), `late(frames, marks, afterMs = 1000) → number` (links and pipelines in frames later than `settle` + 1 s), `mdRow(name, run) → string`.

- [ ] Tests: `worstShare([…99 × 10, 50])` is 50; `worstShare([])` is null; `median([3,1,2])` 2; `summarise` on a phase with no frames gives `fps 0`, `w1 null`, no NaN; `gpu` median ignores nulls and is null when all null; `late` counts only frames after `settle` + 1000; `playOf` with `['load','settle','idle','move','end']` starts at `idle`.
- [ ] Run, see them fail; implement; run, see them pass; commit.

### Task 2: the heavy routes

**Files:** Create `scripts/lib/perf-routes.mjs`, `scripts/lib/perf-routes.test.mjs`.

**Produces:** `HEAVY: { journey: string, route: string }[]`, the ten routes above in that order.

- [ ] Test: each route matches a `<Route path=…>` in `src/App.jsx` (`:param?` optional); each journey name is defined in `scripts/perf-probe.mjs` (read as text).
- [ ] Implement; pass; commit with Task 3.

### Task 3: the recorder and the journeys

**Files:** Modify `scripts/perf-probe.mjs`.

- [ ] Recorder: rAF callbacks timed (the recorder’s own tick left out) into `main`; `GPUDevice.createRenderPipeline(Async)`/`createComputePipeline(Async)` counted into `pipes`; `GPURenderPassEncoder.draw*` counted into `draws` (triangle-list tris from `setPipeline`’s pipeline); bundle encoders’ draws kept with the bundle and added on `executeBundles`; GL `createProgram`/`deleteProgram` into a live `progs`; `__RUNTIME__.gpuClock.last` into `gpu`.
- [ ] Journeys for the routes the list names that have none; `--heavy` runs the list; `MACHINE=` labels the run; every run writes `perf-probe.md` (one row a journey, the play part) beside the JSON.
- [ ] Run `node scripts/perf-probe.mjs --list` and one short journey; commit.

### Task 4: the baseline and the commands

**Files:** Create `docs/superpowers/evidence/perf/README.md`; Modify the lanes file’s P0 row.

- [ ] Run `--heavy` on the desktop at Low and High, WebGL and WebGPU; fill the desktop’s rows; leave the laptop’s with its commands.
- [ ] The four checks; pull request; merge on green.
</content>
</invoke>
