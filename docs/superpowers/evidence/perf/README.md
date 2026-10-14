# Performance lane P0: the measure, and the two machines’ baseline

Lane P0 of `docs/superpowers/HANDOFF-performance-lanes.md`. Plan: `docs/superpowers/plans/2026-10-13-perf-lane-p0-measure.md`. Every later lane (P1 to P8) measures before and after with the same probe and puts its rows beside these.

## What the probe reports

`node scripts/perf-probe.mjs --heavy` walks the ten heavy worlds (`scripts/lib/perf-routes.mjs`) in headless Chromium on the machine’s own chip, uncapped (no vsync, no frame-rate limit, so a frame’s time is what it cost), and prints a row a phase and one for the play (the frames after the world settled), then a markdown row a world for the table below (also written to `$OUT/perf-probe.md`, and everything to `$OUT/perf-probe.json`).

| column | what | from |
| --- | --- | --- |
| fps, p50 | frames a second, the median frame (ms) | the recorder’s own `requestAnimationFrame` |
| worst 1 % | the mean of the slowest hundredth of the frames (ms); the slowest frame when there are fewer than a hundred | `scripts/lib/perf-stats.mjs`’s `worstShare` |
| main | the median ms a frame spent in `requestAnimationFrame` callbacks: the frame loop’s main-thread cost, whoever’s loop it is | every callback timed by the recorder |
| GPU | the median ms a frame on the chip, by the G1 clock (`lib/three/gpuTime`); a dash where there is none (a `'glsl'` world, a world off the runtime, a chip without `timestamp-query`) | `__RUNTIME__.gpuClock.last` |
| draws | draws a frame: GL’s draw calls, WebGPU’s pass-encoder draws, and a render bundle’s draws on every frame that executes it | the GL and WebGPU calls wrapped |
| programs | programs live (GL’s made less deleted) and WebGPU pipelines made | ditto |
| late pipelines | GL links and WebGPU pipelines made more than a second after the world settled: each is a hitch (zero is the goal) | `perf-stats.mjs`’s `late` |
| loafs, block (the phase rows) | the long animation frames and their blocking ms (Chrome and Edge) | `PerformanceObserver('long-animation-frame')` |

The drawn-on column is the runtime’s backend while a world is mounted on it (`webgl`, `nodes-webgl`, `webgpu (WebGPU device)`), else `own:` and the contexts the page made (a world off the runtime). `GPU=webgl|webgpu` asks a `'nodes'` world for that backend (`?gpu=`); a `'glsl'` world is on the classic renderer either way, so its two runs are the same world twice.

## The commands

From the checkout, after `npm ci --ignore-scripts`, in Git Bash (Windows paths would be mangled otherwise: hence `MSYS_NO_PATHCONV`). The probe finds Edge or Chrome itself (`scripts/lib/chromium.mjs`); four runs a machine, Low and High on both backends, about fifteen minutes each:

```bash
export MSYS_NO_PATHCONV=1 MACHINE="Radeon 740M"
for q in low high; do for g in webgl webgpu; do
  QUALITY=$q GPU=$g OUT=perf-out/$q-$g node scripts/perf-probe.mjs --heavy
done; done
```

Paste each run’s `perf-out/<q>-<g>/perf-probe.md` rows into the table. On the desktop `MACHINE="RTX 5090"`. Close other browsers and agents first: headless frame times shift when another browser draws on the same chip.

In the cloud container the browser draws in software (SwiftShader): the numbers say the probe runs and what it counts, not what any chip costs.

## The baseline

The window is the probe’s default, 1470 × 956 at a device pixel ratio of 2 (a 13″ laptop’s screen). Quality pinned by `QUALITY`; `?calibrate` left on, as a visitor has it.

### RTX 5090 (the desktop)

(filled by the run below)

### Radeon 740M (the laptop)

To be run by the owner with the commands above.

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
</content>
</invoke>
