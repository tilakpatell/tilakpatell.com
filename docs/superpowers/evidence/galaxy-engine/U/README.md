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

| size | leg | scale 1 | 0.77 | 0.67 | fsr1:0.77 |
|---|---|---|---|---|---|
| 1600 × 900 | webgpu | | | | |
| 1600 × 900 | webgl | | | | |
| 3840 × 2160 | webgpu | | | | |
| 3840 × 2160 | webgl | | | | |

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
