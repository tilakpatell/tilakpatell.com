# GPU-first lane G1: the reference frames and the GPU clock

Plan: `docs/superpowers/plans/2026-10-11-gpu-first-laneG1-reference.md`. Design: `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` §4 “G1”. The cloud has no GPU: its leg ran on SwiftShader (CPU) and proves the scripts run and what they count; the WebGPU rows are the owner’s laptop’s, with the commands below.

## What the lane added

| piece | file | what it does |
| --- | --- | --- |
| the GPU clock | `src/lib/three/gpuTime.js` | the frame’s GPU time from three’s render timestamps, a ring of 32 with its median and p95; `null` without `timestamp-query` |
| the renderer tier | `src/lib/gpuProbe.js`, `src/runtime/browser.js`’s `rendererTier` | `T0`, `T1` or `T2` from the adapter’s features and a one-second draw of the lit fixture’s `probeScene()` into a 1,280 × 720 target; kept as `tp-tier` with the chip’s vendor and architecture; `?tier=` pins one; `rt.tier` and `lib/device`’s `rendererTier()` read it |
| the jitter | `src/lib/three/jitter.js`, `gfx.jitter(i)` | the camera moved by shot i’s Halton (2, 3) offset; development’s `?traa=off` leaves the chain’s TRAA out |
| the reference frames | `scripts/reference-frames.mjs` | eight jittered shots averaged in linear light; `--plain` shoots the frame a visitor sees |
| the score | `scripts/frame-score.mjs`, `scripts/lib/frame-metrics.mjs` | FLIP where `flip` is installed, PSNR and SSIM in Node always |
| the clock’s check | `scripts/gpu-clock.mjs` | the fixture’s GPU median beside its frame waited on |
| the pacing column | `scripts/perf-probe.mjs`, `scripts/lib/perf-stats.mjs` | `stdev`: the frame-to-frame deltas’ standard deviation beside p95, pauses over 250 ms dropped |

## Where the code and the plan disagreed (the code won)

- `renderer.trackTimestamp` does nothing on r186: `Backend` takes `trackTimestamp` from the renderer’s parameters and `WebGPUBackend.init` ands it with the feature. `gpuTime.js` sets `renderer.backend.trackTimestamp`, after init, only where the adapter has `timestamp-query`.
- The plan’s `hothWalk` journey is not in `scripts/perf-probe.mjs` (on main or on lane T2’s branch). The laptop row uses `surface` (Tatooine’s surface, the journey that walks a Star Wars world) and `earth`.
- `src/lib` may not import `src/lib/three` or `src/runtime` (`docs/health/RULES.md`), so `gpuProbe.js` takes the scene and the clock passed in; `src/runtime/browser.js` wires them.
- The settings line (`Settings.jsx`’s renderer line) is lane T2’s and not on main; the tier joins it in lane N6 or after T2 merges.

## The cloud leg (2026-10-11, SwiftShader, `nodes-webgl`)

| check | number | _source |
| --- | --- | --- |
| the reference run twice agrees (Review Focus 4) | PSNR 63.42 dB, FLIP 0.0022, SSIM 0.9998 (bar: ≥ 50 dB) | `node scripts/reference-frames.mjs litWorld --size 800x450 --gpu webgl --label run1` and `run2`, then `frame-score.mjs` |
| the fixture’s baseline: its frame against its reference | FLIP 0.0258 · PSNR 39.96 dB · SSIM 0.9959 | `../reference/README.md` |
| the GPU clock against the frame (the gate: within 10 %) | GPU median 3,868 ms, frame 3,876 ms, ratio 0.998 (10 frames, 800 × 450; SwiftShader’s WebGL 2 has the timer query) | `node scripts/gpu-clock.mjs --gpu webgl --size 800x450 --ms 3000` |
| the tier probe | not run: no WebGPU device in the cloud (`rendererTier` probes on `webgpu` only) | |
| the pacing column | see below | `GPU=webgl node scripts/perf-probe.mjs earth` |

The numbers are a CPU’s: they say the instruments read the frame and agree with themselves, not what the laptop’s chip costs.

## The laptop (to fill: RTX 5090, Edge, `ANGLE=d3d11`)

From Git Bash at the checkout, after `npm ci` and once for FLIP `pip install flip-evaluator` (it puts `flip` on the path; `flip --help` should say v1.7). Edge is the browser the scripts find on Windows (`scripts/lib/chromium.mjs`); set `CHROMIUM` to use another. Each command writes its own `_source`.

```
export ANGLE=d3d11
R=docs/superpowers/evidence/gpu-first/reference

# 1. the GPU clock against the frame, both legs, both sizes (the gate: ratio 0.9 to 1.1)
node scripts/gpu-clock.mjs --size 1600x900
node scripts/gpu-clock.mjs --size 3840x2160
node scripts/gpu-clock.mjs --size 1600x900 --gpu webgl

# 2. the references and the candidates: the fixture and the three worlds the plan names, at both sizes
node scripts/reference-frames.mjs litWorld hoth endor kashyyyk --size 1600x900
node scripts/reference-frames.mjs litWorld hoth endor kashyyyk --size 1600x900 --plain
node scripts/reference-frames.mjs litWorld hoth endor kashyyyk --size 3840x2160 --out $R/2160p
node scripts/reference-frames.mjs litWorld hoth endor kashyyyk --size 3840x2160 --out $R/2160p --plain

# 3. the baseline every lane beats: each candidate against its reference
for w in litWorld hoth endor kashyyyk; do node scripts/frame-score.mjs $R/$w.candidate.png $R/$w.png; done
for w in litWorld hoth endor kashyyyk; do node scripts/frame-score.mjs $R/2160p/$w.candidate.png $R/2160p/$w.png; done

# 4. the pacing column on a Star Wars world and on Earth
GPU=webgpu node scripts/perf-probe.mjs surface earth

# 5. the tier this laptop gets: open the site on Edge, then in the console
#    JSON.parse(localStorage.getItem('tp-tier'))   (expected T1, or T2 if Edge has atomic-vec2u-min-max and subgroups)
```

A world takes minutes to come up the first time (`--wait` raises the 10 minutes it is given). `hoth`, `endor` and `kashyyyk` are the galaxy’s surfaces (`/galaxy/<id>/surface`, `'nodes'` on main); `battlefront:hoth` shoots the Battlefront world instead. When lane T2 lands, merge main and shoot again.

| row | 1600 × 900 webgpu | 1600 × 900 nodes-webgl | 3840 × 2160 webgpu | _source |
| --- | --- | --- | --- | --- |
| GPU clock ÷ frame, fixture | | | | step 1 |
| FLIP, fixture (candidate vs reference) | | | | steps 2 and 3 |
| FLIP, Hoth | | | | steps 2 and 3 |
| FLIP, Endor | | | | steps 2 and 3 |
| FLIP, Kashyyyk | | | | steps 2 and 3 |
| frame stdev ms, `surface` walk | | | | step 4 |
| the tier | | | | step 5 |
