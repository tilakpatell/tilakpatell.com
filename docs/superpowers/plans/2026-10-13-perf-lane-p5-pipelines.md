# Performance lane P5, pipelines and the device: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** no pipeline made in play goes uncounted, a lost device is heard the way three means it to be, and a compatibility-mode device never takes the GPU scene’s storage path.

**Architecture:** three r186 tells a loss through `renderer.onDeviceLost` on both of its backends (a device destroyed by its own dispose left out); the runtime’s WebGPU factory takes that hook, three’s default first. The GPU scene’s gate, `hasIndirect`, says no on a device in compatibility mode (`renderer.backend.compatibilityMode`, which three sets where the device lacks `core-features-and-limits`). The count of pipelines made after a world settled is P0’s probe’s (`late pipelines`, from `GPUDevice`’s calls), not a second counter in the app.

**Tech Stack:** three r186 `WebGPURenderer`; Vitest.

**Spec:** `docs/superpowers/HANDOFF-performance-lanes.md` (lane P5), `docs/superpowers/HANDOFF-every-world-on-webgpu.md` items 1, 10, 11 and 14; the research note’s §2a, §2f.

## Global constraints

- Only P5’s files: `src/runtime/webgpu.js`, `src/lib/three/pipelineGuard*.js`, `src/lib/three/gpuScene/three.js` (and their tests).
- A WebGPU loss still holds a weak chip only, and comes back once on WebGL 2 (`runtime/index.js`’s `onLoss`, untouched).
- Never `renderer.backend.device` for what three gives in public.

## Review focus

1. A device destroyed by its own dispose: not a loss.
2. A WebGL 2 context lost: reported once, its default prevented (three’s listener does it), the reason `context`.
3. three’s own loss default still run: the renderer marked lost, so no compile or frame on a dead device.
4. A compatibility-mode device that has `indirect-first-instance`: still no GPU scene.
5. The fallback-adapter refusal and the reversed depth buffer: unchanged.

---

### Task 1: the loss through three’s hook

**Files:** Modify `src/runtime/webgpu.js`, `src/runtime/webgpu.test.js`.

- [x] Test: the stand-in renderer behaves as r186 (calls `onDeviceLost`, filters `destroyed`, owns the WebGL listener); a loss reaches `onLost` with its reason and the chip; three’s default ran; one listener on the canvas.
- [x] Implement (`renderer.onDeviceLost` wrapped, three’s first); pass; commit.

### Task 2: the GPU scene off compatibility mode

**Files:** Modify `src/lib/three/gpuScene/three.js`, its test.

- [x] Test: `hasIndirect` false with `compatibilityMode: true`, whatever the features.
- [x] Implement; pass; commit.

### Task 3: what is left, measured first

- [ ] The pipelines made late, by world, from P0’s probe (`late pipelines`): where a world has some, `compileAsync` before it adds them, or its shadow pass drawn once in its prepare (r186 skips shadow maps in a precompile, #33924).
- [ ] Long TSL `Fn`s typed (#34434) only where a build is measured slow: none is typed today (44 sites); the longest are the surface’s sky and water, the earth’s colour and the light’s `skyColor`.
- [ ] The four checks; pull request; merge on green.
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd "C:/Users/tilak/source/repos/new-portfolio-website/.claude/worktrees/delete-old-workflows-828863"; git add docs/superpowers/plans/2026-10-13-perf-lane-p5-pipelines.md && git commit -q -m "The plan of lane P5, pipelines and the device

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; git log --oneline -1