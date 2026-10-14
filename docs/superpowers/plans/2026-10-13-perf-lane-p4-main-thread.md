# Performance lane P4, the main thread: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the main thread’s milliseconds a frame down where they are spent: the runtime’s own path first, then Battlefront’s, by where P0’s probe and census say they go.

**Architecture:** the runtime’s per-frame objects made once and refilled; the kit’s MiniMap on a paced clock; `useWorld` telling a world its props only when they change; Battlefront’s frame on a lean `view()`. Then, the profile having put Battlefront’s main thread in three’s walk of a 5,617-object graph: bones with nothing drawn under them out of the walk, far soldiers animated at a lower rate, the placed lights’ pool still.

**Tech Stack:** the world runtime, three r186’s node renderer, Vitest.

**Spec:** `docs/superpowers/HANDOFF-performance-lanes.md` (lane P4), `docs/superpowers/HANDOFF-every-world-on-webgpu.md` items 2, 3, 4, 6 and 7.

## Global constraints

- P4’s files: `src/runtime/` but `webgpu.js` and `worker/`, `components/battlefront/`; and, for the lights’ pool, `lib/three/light/placed.js`, and `components/games/pad.js`, `lib/three/gpuTime.js` for their per-frame objects.
- Nothing a world reads changes shape: the snapshot is the frame’s, a world keeps none of it; `view()` without `lean` is as it was.
- Measured before and after with P0’s probe, interleaved (a load from elsewhere falls on both).

## Review focus

1. A world that keeps last frame’s snapshot: none found (`grep`), the contract written in `input.js`.
2. A gun put on a socket after the bones were quieted: its chain stays in the walk.
3. A far soldier skipped on a frame: its matrices are not made, its time is played when it comes.
4. A light the pool does not move: its matrix not made again.
5. A page that re-renders with the same props: no update, no fresh frame.

---

### Task 1: the runtime’s frame without garbage

- [x] Tests (`input.test.js`: one snapshot refilled, the press sets taking turns; `pad.test.js`: the pad’s choice kept); implement (`input.js`, `pad.js`, `runtime.js`’s cadence argument, `gpuTime.js`’s resolve, `dynres.js`’s sorted run); commit.

### Task 2: the MiniMap and `useWorld`

- [x] Tests (`hud/clock.test.js`: the paced clock; `useWorld.test.js`: `sameProps`); implement; commit.

### Task 3: Battlefront’s lean view

- [x] Tests (`battle.test.js`: the lean view makes none of the screens’ rows and leaves the full view’s; one velocity pair a soldier); implement; commit.

### Task 4: Battlefront’s graph

- [x] Tests (`figures/lod.test.js`: `quietBones`, `animEvery`, `animDue`; `light/placed.test.js`: the pool’s matrices still); implement; commit.
- [x] Measure (`docs/superpowers/evidence/perf/tools/queue6.sh`): High on WebGPU 5.6 → 4.3 ms a frame, 157 → 200 fps.
- [ ] The four checks; pull request; merge on green.
