# FL3, the Mario 64 tribute: the port’s numbers

Lane FL3’s first world (`/dot-matrix/64`, `src/components/mario64/module.js`), started from lane P1’s `claude/perf-p1-mario64` with `origin/main` merged in. Every number below was read in the cloud container on 2026-10-15, on SwiftShader (the browser draws in software: no graphics chip, no WebGPU device). The `webgpu` rows are the owner’s laptop’s (Radeon 740M) and desktop’s (RTX 5090): left empty here, never estimated.

## The closure

```bash
node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/mario64/module.js   # 69 files reached, 0 with GLSL
npx vitest run src/runtime/shading.test.js                                                     # 11 passed
node scripts/health.mjs --only glsl-sites                                                      # 619 → 604
```

On `main` the world reached three GLSL files (`scene.js` and `models/things.js`’ `onBeforeCompile` patches, `looks.js`’ `EffectComposer` with `UnrealBloomPass`), 15 sites. Lane P1 moved them into `mario64/glsl.js`, which nothing the module reaches imports; this lane moved that file to `scripts/twin-parity/originals/mario64.js`, beside the check that reads it, so the site count falls by the world’s 15 (it counts `src/` only). Lane FL4 deletes it with the other originals.

## The twins (`node scripts/twin-parity.mjs mario64`, the node side on WebGL 2)

| case | PSNR | off |
| --- | --- | --- |
| `mario64:splat` (the terrain) | 61.3 dB | 0.00 % |
| `mario64:painting` (the ripple) | 55.6 dB | 0.00 % |
| `mario64:waterfall` | 57.6 dB | 0.00 % |
| `mario64:look` (the chain: render, bloom, output) | 67.5 dB | 0.00 % |

The line is 32 dB and under 2 % off. The `webgpu` leg: the owner’s.

## The world (`node scripts/gpu-parity.mjs /dot-matrix/64 --before cfe1a4365 --view grounds,castle,bobomb`)

| view | leg | PSNR | off | result |
| --- | --- | --- | --- | --- |
| grounds | webgl (`nodes-webgl`) | 50.85 dB | 0.05 % | pass |
| castle | webgl (`nodes-webgl`) | 55.54 dB | 0.01 % | pass |
| bobomb | webgl (`nodes-webgl`) | 48.80 dB | 0.06 % | pass |
| all three | webgpu | | | the owner’s (the container’s only adapter is a fallback, which the runtime refuses) |

Three things had to be put right before the check could say anything (each its own commit):

1. **The before pictures were missing the terrain** (the grass, the carpet, the coins): the classic renderer’s frame guard holds a new shader back till it links, which on SwiftShader takes many frames, and each view was shot six frames after it was asked for. `gpu-parity` now runs frames after a view till nothing is held back (47, 283 and 204 frames here).
2. **The node legs were shot 0, 104 or 563 px down the page**: Playwright’s click on the N64 gate’s button scrolls it into view, and where the page lands as the gate gives way is a race. Every view is now shot from the top.
3. **A shot timed out** (a frame of the node renderer on SwiftShader takes seconds; bobomb’s shot took 52 s with the clock running): the timeout is 10 minutes.

With those, the port passed at 42–43 dB; without the node chain’s 4× multisampling (below) it is 49–56 dB.

## The frames (`scripts/perf-probe.mjs mario64`)

All runs `CAP=on VIEW=800x500@1`, classic from a worktree of `origin/main` (`f97079c7`, the world `'glsl'`), nodes from this branch with `GPU=webgl`, interleaved. The `play` phase (13.5 s: idle, then W, A, W held); fps and the frame times are the probe’s own rAF; `main` the mean ms a frame in rAF callbacks.

**Why `CAP=on`.** Uncapped (the probe’s default, right for a real chip), SwiftShader’s command buffer fills and every GL call in a frame waits on it: the node renderer showed 488 ms of “main” a frame, a CPU profile of the same run 92 % idle with the time inside `bufferSubData`, `bindBufferBase` and `bindTexture`; the classic renderer, uncapped, 84 ms a frame in rAF against 5.6 capped. The switch is new in this pull request (`scripts/perf-probe.mjs`).

| run | fps | p50 ms | worst 1 % ms | main ms | draws |
| --- | --- | --- | --- | --- | --- |
| classic, Low ×4 | 2.9–3.0 | 327–348 | 651–746 | 3.6, 4.1, 3.6, 4.4 | 92–93 |
| nodes, Low, before the rebuild ×3 | 9.0–9.7 | 156–166 | 340–350 | 4.1, 4.2, 4.0 | 51–52 |
| nodes, Low, rebuilt ×2 | 7.6–8.0 | 191–193 | 348–370 | 4.4, 4.4 | 39–48 |
| classic, High ×7 | 0.8–0.9 | 1073–1171 | 1159–3591 | 4.6, 4.8, 4.5, 5.1, 3.9, 4.0, 4.2 | 89–91 |
| nodes, High, 4× MSAA (P1’s port) ×2 | 0.4 | 2378–2572 | 2438–2692 | 5.8, 6.4 | 93 |
| nodes, High, no MSAA ×1 | 0.7 | 1528 | 1911 | 6.1 | 93 |
| nodes, High, + trees instanced ×1 | 0.6 | 1601 | 1692 | 5.5 | 82 |
| nodes, High, + blobs instanced ×4 | 0.6–0.7 | 1451–1653 | 1547–1873 | 5.6, 4.6, 5.2, 4.5 | 70 |

(The node legs’ lower draws a probe frame at Low are the runtime’s cadence: its rAF ticks that draw nothing. A drawn frame is 93 draws at Low before the rebuild, `renderer.info.render.drawCalls`.)

**A steady-state measure** (the same page held at play 15 s, then 20 s counted, capped, rAF callbacks wrapped in the page): at High, classic 0.85 frames a second and 5.31 ms a frame in rAF, nodes 1.10 and 3.34; bloom off, classic 0.95 and 5.34, nodes 1.30 and 2.79.

**What the rebuild was** (the design’s §4.4, step 3):

1. **The chain’s scene pass without multisampling.** The `EffectComposer` drew the scene into a plain buffer; the node chain’s `pass()` took the renderer’s four samples, so the twin drew four times the samples the original did. A render pass now says its `samples` (`runtime/webgpu.js`), and the look asks for 0. High: 0.8 → 1.3 frames a second (steady state).
2. **The still props as one mesh a kind** (`mario64/instanced.js`’ `instanceStill`: trees, pines, rocks). The grounds’ twelve trees: twelve draws a pass to one.
3. **The cast’s blob shadows as one mesh** (`makePool`): fourteen draws to one.

**Where it stands.** At Low the node renderer is no slower on the main thread (4.0–4.4 ms against 3.6–4.4) and its frames are twice as fast (median 156–193 ms against 327–348; worst 1 % 340–370 against 651–746). At High, the probe’s journey has the main thread 0.7 ms a frame slower on the node renderer (4.5–5.6 against 3.9–5.1, seven and four runs) and the median frame slower (1451–1653 ms against 1073–1171) with the worst 1 % mixed; the steady-state measure has it faster on both. A frame at High is 7 to 12 frames of the probe’s journey in software, where the “GPU” is the CPU, so neither says what the 740M or the 5090 will. **The gate at High is the owner’s machines’ to settle; this pull request is not merged on it.**

## The WebGPU rows

Empty: the container has no WebGPU device (Chromium’s only adapter is a fallback, which `runtime/webgpu.js` refuses). The owner’s laptop and desktop fill them:

```bash
node scripts/gpu-parity.mjs /dot-matrix/64 --before cfe1a4365 --view grounds,castle,bobomb
GPU=webgpu node scripts/twin-parity.mjs mario64
GPU=webgl  QUALITY=low  node scripts/perf-probe.mjs mario64   # and QUALITY=high
GPU=webgpu QUALITY=low  node scripts/perf-probe.mjs mario64   # and QUALITY=high
# the classic rows from a worktree of the merge base, the world 'glsl'
```
