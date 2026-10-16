# Performance lane P0: the measure, and the two machines’ baseline

Lane P0 of `docs/superpowers/HANDOFF-runtime.md`. Plan: `docs/superpowers/plans/2026-10-13-perf-lane-p0-measure.md`. Every later lane (P1 to P8) measures before and after with the same probe and puts its rows beside these.

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

2026-10-13, Edge 154 headless on the RTX 5090 (D3D11 for WebGL, D3D12 for WebGPU), the probe at `claude/perf-p0-measure`. A `'glsl'` world is on the classic renderer whichever backend is asked for: its two rows a quality are the same world twice, and their spread is the run-to-run noise. Battlefront, the one `'nodes'` world of the nine, is where the backend shows.

#### Low, asked for WebGL (`GPU=webgl`)

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /battlefront/hoth | RTX 5090 | nodes-webgl | low | 19.4 | 489 | 1.9 | 6.7 | 1.8 | - | 84 | 41 | 2 |
| /galaxy/tatooine | RTX 5090 | webgl | low | 3.1 | 1143.5 | 0.7 | 5.3 | 0.6 | - | 71 | 60 | 0 |
| /fly/hoth | RTX 5090 | webgl | low | 2.2 | 1799.8 | 0.5 | 1.9 | 0.4 | - | 112 | 26 | 0 |
| /universe | RTX 5090 | own: webgl2 | low | 1.4 | 1166.3 | 0.8 | 2.4 | 0.7 | - | 47 | 161 | 5 |
| /middle-earth | RTX 5090 | own: webgl2 | low | 1.2 | 1031.7 | 0.9 | 2.5 | 0.7 | - | 142 | 18 | 0 |
| /c-137 | RTX 5090 | own: webgl2+webgl | low | 4.1 | 788.8 | 1.2 | 2.7 | 1.1 | - | 86 | 92 | 1 |
| /avengers | RTX 5090 | own: webgl2 | low | 4.8 | 785.9 | 1.2 | 2.4 | 1.1 | - | 112 | 113 | 0 |
| /deathstar | RTX 5090 | own: webgl2 | low | 1.7 | 2116.8 | 0.4 | 2.9 | 0.3 | - | 79 | 61 | 36 |
| /deathstar/inside | RTX 5090 | webgl | low | 2.9 | 1509.2 | 0.6 | 2.4 | 0.5 | - | 51 | 54 | 7 |

#### Low, asked for WebGPU (`GPU=webgpu`)

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /battlefront/hoth | RTX 5090 | webgpu (WebGPU device) | low | 14.8 | 401.2 | 2.3 | 6.6 | 2.2 | 0 | 84 | 48 | 2 |
| /galaxy/tatooine | RTX 5090 | webgl | low | 3.5 | 1485.6 | 0.6 | 2.8 | 0.4 | - | 38 | 60 | 0 |
| /fly/hoth | RTX 5090 | webgl | low | 1.2 | 1529 | 0.6 | 1.6 | 0.5 | - | 116 | 26 | 0 |
| /universe | RTX 5090 | own: webgl2 | low | 1.5 | 832.1 | 1.1 | 11.4 | 0.9 | - | 50 | 184 | 28 |
| /middle-earth | RTX 5090 | own: webgl2 | low | 1.1 | 879.1 | 1.1 | 3.1 | 0.8 | - | 141 | 18 | 0 |
| /c-137 | RTX 5090 | own: webgl2+webgl | low | 3.8 | 757.7 | 1.3 | 2.5 | 1.1 | - | 87 | 92 | 1 |
| /avengers | RTX 5090 | own: webgl2 | low | 4.4 | 812 | 1.2 | 2.3 | 1.1 | - | 112 | 113 | 0 |
| /deathstar | RTX 5090 | own: webgl2 | low | 1.7 | 2229 | 0.4 | 2.5 | 0.3 | - | 82 | 61 | 36 |
| /deathstar/inside | RTX 5090 | webgl | low | 2.4 | 1529.7 | 0.6 | 2.5 | 0.5 | - | 51 | 54 | 7 |

#### High, asked for WebGL

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /battlefront/hoth | RTX 5090 | nodes-webgl | high | 154.2 | 12.6 | 17.1 | 5529 | 0 | - | 31 | 290 | 48 |
| /galaxy/tatooine | RTX 5090 | webgl | high | 3.4 | 1010.9 | 0.6 | 28.4 | 0.4 | - | 46 | 61 | 0 |
| /fly/hoth | RTX 5090 | webgl | high | 1.1 | 1295.3 | 0.7 | 3 | 0.6 | - | 117 | 25 | 0 |
| /universe | RTX 5090 | own: webgl2 | high | 1.9 | 661 | 1.2 | 24.9 | 1 | - | 59 | 187 | 31 |
| /middle-earth | RTX 5090 | own: webgl2 | high | 1.4 | 648.4 | 1.5 | 3.5 | 1.2 | - | 256 | 24 | 0 |
| /c-137 | RTX 5090 | own: webgl2+webgl | high | 3.7 | 563.6 | 1.7 | 4.7 | 1.5 | - | 99 | 110 | 1 |
| /avengers | RTX 5090 | own: webgl2 | high | 6.5 | 577.5 | 1.5 | 5.4 | 1.4 | - | 126 | 133 | 0 |
| /deathstar | RTX 5090 | own: webgl2 | high | 1.7 | 2146.9 | 0.4 | 2.8 | 0.3 | - | 90 | 61 | 36 |
| /deathstar/inside | RTX 5090 | webgl | high | 2.6 | 1236.2 | 0.7 | 3.9 | 0.6 | - | 65 | 61 | 7 |

#### High, asked for WebGPU

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /battlefront/hoth | RTX 5090 | webgpu (WebGPU device) | high | 16.9 | 126 | 7.1 | 30 | 6.7 | 1.2 | 137 | 122 | 12 |

What the table says, for the lanes after:

- Every world but Battlefront draws far past 60 fps on this chip at either level; their main thread is under 2 ms a frame.
- Battlefront at High on WebGPU is held by the main thread: 6.7 ms of JavaScript a frame against 1.2 ms on the chip, most of it three's walk of a 5,700-object graph (`_projectObject`, `updateMatrixWorld`; PROFILE=1). That is P4's.
- Battlefront at High on the node renderer over WebGL 2 is not playable: 154 s to come in, its worst 1 % of frames 5.5 s, 48 pipelines made late. The pipeline guard was WebGPU's only. That is P5's.
- The Death Star's trench makes 36 programs after it settles (it is built as it scrolls in), the universe map 5 to 31.

### Radeon 740M (the laptop)

To be run by the owner with the commands above.

| route | machine | drawn on | quality | ready s | fps | p50 ms | worst 1 % ms | main ms | GPU ms | draws | programs | late pipelines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
