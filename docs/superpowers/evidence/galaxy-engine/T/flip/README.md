# Lane T's flip: the surface on the node renderer, measured

Taken in the cloud container on 2026-10-10: headless Chromium on SwiftShader (no graphics chip), against `origin/main` at 9fc4fce9 for "before". The owner reruns both scripts on the laptop; the WebGPU leg needs a real chip.

## Parity (`scripts/gpu-parity.mjs`)

`node scripts/gpu-parity.mjs /galaxy/<id>/surface --settle 120000 --before`, then the same without `--before`. The route is the surface's own page (`/galaxy/<id>` alone opens the map, which is a glsl world). The surface has no `view()` hook, so each shot is the world as it opens. The line is PSNR ≥ 32 dB and under 2 % of pixels off by more than 16/255.

| World | Main (classic) → branch (`nodes-webgl`) | PSNR | Off | Result | Errors |
|---|---|---|---|---|---|
| Tatooine | `tatooine-*.webp` | 50.71 dB | 0.01 % | pass | none |
| Kamino | `kamino-*.webp` | 51.59 dB | 0.02 % | pass | none |
| Endor | `endor-*.webp`, `endor-diff.webp` | 33.95 dB | 2.81 % | over the 2 % line | none |
| Hoth | `hoth-*.webp` | 19.18 dB | 18.05 % | fail | none |

- **Endor**: what differs is the edges of the foliage cards (alpha to coverage under the node pass's multisampling) and a few patches of sun dapple on the ground under the crowns (`endor-diff.webp`: red is off by more than 16/255). The trunks, the sky, the gas giant, the fog and the colours agree.
- **Hoth**: the game's level (Echo Base's dome, the rocks, the AT-AT wreck) is in the branch's picture and not in main's. Main's scene holds the level's 181 meshes on the classic renderer, but they are not drawn in its shot even after two minutes' settle; on the node renderer they are drawn with lane Q1's game materials. Everything else (the sky, the snow, the light, the figures) matches by eye. This is main's classic path not drawing its level in the shot, not the port's shading.
- **WebGPU**: the leg never comes on in the container (SwiftShader's WebGPU adapter: "Instance dropped in popErrorScope"). It is the laptop's to run.
- Before the PMREM fix, the node renderer logged `NodeBuilder: Material "ShaderMaterial" is not compatible` (gameLit's probes through three's classic `PMREMGenerator`); the runs above are after it, with no errors.

## Perf (`scripts/perf-probe.mjs surface`, the Tatooine journey)

`CHROME=/opt/pw-browsers/chromium VIEW=1280x800@1 QUALITY=high`, main from a worktree, the branch with `GPU=webgl` and `GPU=webgpu`. The JSON reports are `perf-*.json`. On SwiftShader the frame times say little about a real chip; read them for what is sent and when.

| Backend | Ready | Heap | move: fps | p50 | p95 | max | links in move | draws / ktris (instrumented on GL only) |
|---|---|---|---|---|---|---|---|---|
| main, classic WebGL | 19.9 s | 258 MB | 664 | 0.7 ms | 3 ms | 257 ms | 63 | 0 / 0 |
| branch, `nodes-webgl` | 19.0 s | 370 MB | 7.2 | 105 ms | 131 ms | 2908 ms | 82 | 55 / 228 |
| branch, `webgpu` (SwiftShader's device) | 16.7 s | 298 MB | 906 | 0.6 ms | 1.7 ms | 373 ms | n/a | n/a |

- Main's journey drew no counted draws in its move phase in the container (0 draws, 0 triangles), so its frame times are not the world's cost; the branch's `nodes-webgl` row is the only one with the world counted.
- On `nodes-webgl`, programs still link during the walk: 82 links in move, the worst frame a 1.5 s `getProgramParameter`. The warm-up (`compileAsync` over the scene, then one draw through the post) does not reach everything that is drawn later (what streams in, the level's cells, the effects). This is the next thing to measure on the laptop.
- The heap is about 110 MB higher on `nodes-webgl` than main's classic.
