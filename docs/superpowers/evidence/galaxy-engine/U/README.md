# Fidelity lane U: headroom

Plan: `docs/superpowers/plans/2026-10-10-bf-fidelity-laneU-headroom.md`. The cloud has no GPU: the WebGL 2 leg ran on SwiftShader (CPU) and proves that the passes build and run and what they count. The frame-time tables below are for the owner's laptop to fill.

## Upscaling (Task 1)

`node scripts/light-fixture.mjs --tier ultra --post on --legs webgl --upscale <scale>` (the lit fixture, 1600 × 900, the chain from `passesFor('ultra', …)` through `upscaled()`; `--upscale 1` is the baseline: no upscale pass).

SwiftShader, WebGL 2 leg (`nodes-webgl`: no TRAA there, so the upscaler is FSR1 after SMAA). The times are the CPU's and only compare rows with one another:

| scale | passes | mean ms | median ms | p95 ms | mean lum | canvas CSS | drawing buffer | shot |
|---|---|---|---|---|---|---|---|---|
| 1 | render ssgi denoise ao bloom godrays lensflare lut smaa output | 8,656 | 8,638 | 9,618 | 0.4991 | 1600 × 900 | 1600 × 900 | `post-ultra-auto-1-webgl.png` |
| 0.77 | … smaa **upscale** (fsr1) output | 5,582 | 5,552 | 5,776 | 0.5037 | 1600 × 900 | 1600 × 900 | `post-ultra-auto-0.77-webgl.png` |
| 0.67 | the same | 4,889 | 4,905 | 4,953 | 0.5085 | 1600 × 900 | 1600 × 900 | `post-ultra-auto-0.67-webgl.png` |
| 0.5 | the same | 3,405 | 3,373 | 3,552 | 0.5179 | 1600 × 900 | 1600 × 900 | `post-ultra-auto-0.5-webgl.png` |

The canvas's CSS size and its drawing buffer stay the screen's at every scale: only the chain's internal targets shrink, so the DOM HUD and its text are untouched (Review Focus 2). Programs stay constant while a light moves (83 → 83). The picture's mean luminance rises 1 to 4 % as the scale drops (FSR1's RCAS sharpening and the half-resolution bloom on a smaller source).

### To fill on the laptop (RTX 5090; #863's baseline: ultra 4.8 ms mean on WebGPU, 3.0 ms over WebGL 2, at 1600 × 900)

Run on Windows with `ANGLE=d3d11 CHROME=<msedge path>`, at 1600 × 900 and again at `--size 3840x2160` (where the design expects the gain):

```
node scripts/light-fixture.mjs --tier ultra --post on --upscale 1
node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.77        # TAAU on WebGPU (the chain has TRAA), FSR1 over WebGL 2
node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.67
node scripts/light-fixture.mjs --tier ultra --post on --upscale fsr1:0.77   # FSR1 with SMAA in TRAA's place on WebGPU
```

Filled 2026-10-11 00:10 UTC on the owner's laptop (RTX 5090, Edge, `ANGLE=d3d11`, lane U's branch at `b2e4e6e7`): mean ms (median / p95), the passes as the fixture printed them. Mean luminance in brackets where it moved more than 3 % from the baseline's.

| size | leg | scale 1 | 0.77 | 0.67 | fsr1:0.77 |
|---|---|---|---|---|---|
| 1600 × 900 | webgpu | 5.7 (6.1 / 7.7), traa | 5.1 (4.1 / 7.7), taau | 6.2 (6.3 / 7.5), taau [lum 0.457 vs 0.516] | 6.2 (6.2 / 7.6), smaa + fsr1 |
| 1600 × 900 | webgl | 3.2 (3.2 / 3.6), smaa | 2.7 (2.6 / 3.0), smaa + fsr1 | 2.5 (2.4 / 2.8) | 2.7 (2.6 / 3.0) |
| 3840 × 2160 | webgpu | 11.3 (11.2 / 12.9), traa | 9.1 (8.9 / 11.0), taau | 7.7 (7.6 / 9.1), taau [lum 0.440 vs 0.497] | 9.2 (9.1 / 10.1), smaa + fsr1 |
| 3840 × 2160 | webgl | 12.2 (12.2 / 12.8), smaa | 8.1 (8.1 / 8.5), smaa + fsr1 | 7.1 (7.1 / 7.7) | 8.3 (8.2 / 8.7) |

**What the rows say.** Over WebGL 2 every step lowers the frame at both sizes (1600 × 900: 3.2 → 2.7 → 2.5 ms; 4K: 12.2 → 8.1 → 7.1 ms). On WebGPU at 4K every step pays too (11.3 → 9.1 → 7.7 ms; the FSR1 variant 9.2, no better than TAAU's 0.77). On WebGPU at 1600 × 900 only the 0.77 TAAU step pays (5.7 → 5.1 ms mean, 6.1 → 4.1 median): the 0.67 step (6.2 ms) and the FSR1 variant (6.2 ms) cost more than the baseline, since the chain there is not fragment-bound and TAAU's and FSR1's own passes outweigh the smaller targets. TAAU at 0.67 also darkens the picture 11 % on WebGPU at both sizes (the mean luminance column), which the 0.77 step does not. So by the plan's rule the 0.67 step and the FSR1 variant stay in `RESOLUTION_STEPS` for a drawing buffer of 4K and come out below it on WebGPU: the pace controller should pick the step list by the drawing buffer's size and backend, which is the picture lane's wiring (`map/level.js`, the game's world) and not changed here. The 1600 × 900 WebGPU baseline (5.7 ms) is above #863's 4.8 ms because this branch's chain carries SSR and lane S's and V's passes that #863 measured without.

FSR1's own note: it costs passes of its own, so a chain that is not fragment-bound can draw faster at full size. A step that does not lower the frame on the laptop comes out of `RESOLUTION_STEPS` (`src/runtime/quality.js`).

## Batching, bundles, occlusion (Task 2)

`node scripts/level-draws.mjs hoth --tier <tier>` counts Hoth's draws through `createLevelScene` itself, every GLB of the pack parsed as the level loader parses it (`splitTextures`, maps shared by name), at the arena's middle and the middles of its three fullest cells. No GPU: the counts are the scene's `stats()`.

| tier | InstancedMesh draws (lane L) | batched draws (lane U) | arena / horizon batches | instances | occlusion blocks |
|---|---|---|---|---|---|
| ultra | 189–209 | 79–80 | 62–63 / 17 | 6,037–6,051 | 55 |
| high | 172–183 | 76–79 | 59–62 / 17 | 6,037–6,051 | 55 |
| mid | 168 (middle) | 68 (middle) | 51 / 17 | 4,394 | 55 |

The same instances and triangles on both paths (`draws-hoth-<tier>.md`, `.json`).

**The caveat** (`draws-hoth-high-own.md`): that is the classic material path, where a mesh's LODs wear the same maps and key one batch. On the node renderer Hoth draws lane Q1's game materials, one made per GLB material; keyed each by itself (`--own`), the batches are 200 draws against 183: worse, since a part is split by band too. The batched path pays only once a game material carries `userData.batchKey` (its recipe and maps; `levelGltf.js`'s swap is the place): the picture lane's, with Q1.

### To fill on the laptop

`batch`, `Bundle` and `occlude` are options of `createLevelScene`, off by default; nothing on `main` turns them on. The picture lane wires them into the game's world (`map/level.js`) and runs `scripts/battlefront-shots.mjs` / `scripts/perf-probe.mjs` with `GPU=webgpu` and `GPU=webgl` on Hoth:

| Hoth, ultra | draws | frame ms (webgpu) | frame ms (webgl) |
|---|---|---|---|
| InstancedMesh (lane L) | | | |
| batched | | | |
| batched + horizon bundle | | | |
| batched + bundle + occlusion, inside the hangar | | | |
