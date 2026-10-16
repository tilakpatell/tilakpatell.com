# Every chip plays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weak or integrated chip is put on Low by Auto and never hangs, a lost device brings its world back by itself, frames hold 60 where the chip can and an even 30 where it cannot, and the way into a world stops waiting on what it does not need.

**Architecture:** The rules are pure and tested beside their files (`lib/gpuProbe`, `lib/device`, `runtime/cadence`, `runtime/quality`, `lib/net/assetFetch`, `battlefront/waiting`); the runtime, `useWorld`, `runtime/index.js` and the Battlefront world wire them in. No new dependency.

**Tech Stack:** three r186 (WebGPURenderer, TSL), React 19, Vitest, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-13-every-chip-plays-design.md`

## Global Constraints

- A level the visitor picked by hand, `?quality=`, `?tier=`, `?gpu=` and `?fps=` are never overridden.
- `T1` and `T2` chips (the 5090) keep everything they have today.
- The tier cap is `capDetail('low')`, kept with the chip's WebGL name (lib/device's existing record).
- The 60 fps budget is 16.7 ms; the cadence drops to every second beat after 2 s over it and climbs back after 3 s under 0.8 × 16.7 ms.
- `SHADER_WAIT_S` is 5; `poolSize` is 2 on a saver connection, 4 on a phone, 8 otherwise.
- Two WebGPU losses within 7 days start the next visit on `nodes-webgl`.
- Comments say why, in the file's voice; British spelling; no reformatting of lines not moved (docs/health/RULES.md).

## Review Focus

1. A dual-GPU laptop whose WebGL name is an NVIDIA chip and whose WebGPU adapter is Intel: the name's score is not used (Task 1's vendor test).
2. A visitor who picked Ultra by hand on a 740M: no cap, a hang still recovers to WebGL 2 (Task 2's hand-pick test, Task 4's loss test).
3. A loss while a world is still being made: the make ends quietly, the page mounts again once (Task 4).
4. A frame bound by the main thread, not the chip (the resolution cannot help): the cadence still settles on an even 30 (Task 3's CPU-bound test).
5. A storage that throws (a private window): every kept record degrades to “decided this page” (Tasks 1 and 4 use try/catch, as the files do).

---

### Task 1: the tier's rules

**Files:** Modify `src/lib/gpuProbe.js`, `src/lib/gpuProbe.test.js`.

**Interfaces — Produces:**
- `nameVendor(name) → 'nvidia' | 'amd' | 'intel' | 'apple' | 'qualcomm' | null`
- `judgeTier({ features, limits, medianMs, phone, info, score }) → { tier, why }`, `why` one of `'phone' | 'fallback' | 'features' | 'name' | 'slow' | 'probe' | null`; `classifyTier(…)` stays, returning `judgeTier(…).tier`. A `score` under `GRADE_AT.high` (lib/gpuGrade) gives `T0`/`'name'`; the caller passes `score: null` when the name's vendor is not the adapter's.
- `decideTier({ …, score }) → { tier, probed, pinned, why }`: the pin first, then the facts-only `T0`, then the kept tier, then the probe. The kept record is `{ tier, info, why, losses?, lostAt? }`.
- `CAPPING = new Set(['name', 'slow', 'lost'])`.
- `noteLoss(info, storage, now) → record` (tier `T0`, why `'lost'`, `losses` counted, reset after 7 days) and `lostTwice(stored, now) → boolean`.

- [ ] Tests: the 740M's name (score 40, adapter vendor `amd`) is `T0`/`'name'` without a probe; the same name with adapter vendor `intel` probes; a kept `T1` under a `T0` name is replaced; `?tier=T1` still wins; a slow median is `'slow'`; `noteLoss` twice in a day → `lostTwice` true, once → false, twice eight days apart → false. Run `npx vitest run src/lib/gpuProbe.test.js`: FAIL.
- [ ] Implement; run: PASS. Commit.

### Task 2: the tier sets Auto, and the level path

**Files:** Modify `src/lib/device.js` (+ test), `src/runtime/browser.js` (`rendererTier` returns `{ tier, why }`, passes the WebGL name's score through the vendor guard), `src/runtime/index.js` (the cap applied when the tier lands), `src/components/battlefront/module.js` (`gpuScene` needs `rt.tier !== 'T0'`).

**Interfaces — Produces:** `tierCap({ why, mode, detail }) → 'low' | null` in `lib/device.js` (null for a hand pick, a `why` not in `CAPPING`, or a detail already low).

- [ ] Tests (`device.test.js`): `tierCap({ why: 'name', mode: 'auto', detail: 'high' })` is `'low'`; `mode: 'ultra'` is null; `why: 'features'` is null. FAIL, implement, PASS.
- [ ] Wire: `index.js`'s `tier` hook applies a non-null cap with `capDetail('low')`, `instance.requality('low')` and `instance.revideo(videoNow())` before it returns the tier; `rt.tier` stays a string (`runtime.tier.test.js` green). Commit.

### Task 3: 60 where it holds, an even 30 where it cannot

**Files:** Modify `src/runtime/cadence.js` (+ test), `src/runtime/dynres.js` (+ test: `T0`'s budget is 16.7, its floor 0.58), `src/runtime/quality.js` (`floored` getter: the pace at its last step, or the GPU controller at its floor), `src/runtime/runtime.js` (the frame's work time, CPU around step and draw, the GPU clock's `last`, fed to the cadence; `loop.setCadence` on a change).

**Interfaces — Produces:** `cadenceFor({ fps })` (no `tier`: a pin or 1); `createCadence({ fps, budgetMs = 16.7, dropMs = 2000, climbMs = 3000, climb = 0.8 }) → { frame(now, { cpuMs, gpuMs, floored }) → 1 | 2 | null, every }`.

- [ ] Tests: 2 s of 25 ms GPU work while floored → 2; the same not floored and GPU-bound → stays 1; CPU 25 ms, GPU 5 ms, not floored → 2; at 2, 3 s of 10 ms → 1; `fps: 30` → always 2, `fps: 60` → always 1. FAIL, implement, PASS. Wire the runtime; `runtime.test.js` green. Commit.

### Task 4: a loss comes back

**Files:** Modify `src/runtime/webgpu.js` (`onLost({ kind, reason, message, adapter })`), `src/runtime/runtime.js` (`lost(loss)`: the making abandoned, `recoverable`, `onLoss(loss)`, `lost` option at creation), `src/runtime/useWorld.js` (`recoverNow({ status, recoverable, tried }) → boolean`, the internal remount), `src/runtime/index.js` (`onLoss`: `noteLoss` and the Auto cap; `lost` at creation from `lostTwice` unless `?gpu=webgpu`), tests in `runtime.test.js`, `useWorld.test.js`.

- [ ] Tests: a WebGPU loss with a world up → `lost`, `recoverable`, `onLoss` called once with the kind; a loss while `create` is still pending → the mount resolves false and the status stays `lost` (not `failed`); a loss on `nodes-webgl` → not recoverable; `createRuntime({ lost: true, gpu: true })` mounts a nodes world on `nodes-webgl`; `recoverNow` true once, false when tried or not recoverable. FAIL, implement, PASS. Commit.

### Task 5: a level picked mid-visit reaches the world

**Files:** Modify `src/runtime/quality.js`, `src/runtime/quality.test.js`.

- [ ] Test: `createQuality({ tier: 'high', detail: 'high' }).retune('low')` → `tier` is `'low'`; `retune('ultra')` → `'high'`. FAIL, implement (`tier` a getter), PASS. Commit.

### Task 6: the way in

**Files:** Modify `src/lib/net/assetFetch.js` (+ test), `src/components/galaxy/surface/level/levelStream.js` (the pool from the device), `src/lib/assetLoad.js`; create `src/lib/assetDown.js` (+ test), modify `src/lib/assetBase.js`, `src/runtime/install.js`; modify `vite.config.js` or `scripts/assets-manifest.mjs` (the manifest as one `JSON.parse`, checked in the built chunk); modify `src/components/battlefront/waiting.js` (+ test), `BattlefrontWorld.jsx`, `module.js` (the load line and `marks`).

**Interfaces — Produces:** `poolSize(level, lowData = false, phone = false)` → 2 | 4 | 8; `readiness({ …, waited })` with `SHADER_WAIT_S = 5` (`waited`: seconds since the level came in, wall time); `assetDown.js`: `WAIT_MS`, `SLOW_RATE`, `waitFor`, `markDown`, `isDown`, `forgetDown`, `answered()`, `markAnswered()`.

- [ ] Tests: `poolSize('low')` 8, `poolSize('high', true)` 2, `poolSize('mid', false, true)` 4; `readiness` ready with 3 shaders building once `waited` ≥ 5 and not before; `assetDown`'s state round trip. FAIL, implement, PASS.
- [ ] Build: `index.html` no longer modulepreloads the manifest's chunk (or the chunk no longer holds it), and the chunk that holds it starts its data with `JSON.parse(`. Commit.

### Task 7: the record and the gates

**Files:** Create `docs/decisions/2026-10-13-every-chip-plays.md`; modify `docs/superpowers/HANDOFF-runtime.md` (the N6 row: what this lands of it).

- [ ] `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`: all green.
- [ ] The container's load probe on the new production build at Low (film blocked): the level in and the field ready sooner than 209 s, the load line printed.
- [ ] Push `claude/charming-rubin-k3iubw`.
