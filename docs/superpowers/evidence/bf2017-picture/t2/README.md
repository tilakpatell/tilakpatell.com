# Lane T2, the flip: what was measured, and what the laptop measures

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§3, §4 “T2”). The plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneT2-flip.md`. Taken in the cloud container on 2026-10-11: headless Chromium on SwiftShader, no graphics chip. SwiftShader has no WebGPU, so every run here is the node renderer over WebGL 2 (`nodes-webgl`).

## What runs where

| level | WebGPU | no WebGPU | `?gpu=webgl` | `?gpu=classic` |
| --- | --- | --- | --- | --- |
| low | classic | classic | classic | classic |
| mid | WebGPU | classic | classic | classic |
| high | WebGPU | WebGL 2, node renderer | WebGL 2, node renderer | classic |
| ultra | WebGPU | WebGL 2, node renderer | WebGL 2, node renderer | classic |

`src/runtime/backend.test.js` pins every cell; `src/runtime/runtime.test.js` that a quality change wanting the other renderer reloads the world on it. The settings panel's readout says “Drawn with WebGPU”, “WebGL 2, node renderer” or “classic”, and the `?gpu=` asked.

## Hoth at high, node renderer over WebGL 2 (1280 × 720)

| | calls | triangles | |
| --- | --- | --- | --- |
| baseline, classic (`lab/baseline/surface-high.json`) | 249 | 1,512,875 | lane T found main's classic shot never drew the level |
| flip with every layer (lane T's #887, then this lane) | 281 | 10,077,091 | the first run, the page reloading under it (errors were the reload's) |
| the view without the sun's shadow | 238 | 2,665,101 | the probe's own frame |
| the view without the sun's shadow, the level batched | 238 | 1,799,600 | lane U's `BatchedMesh` on the node renderer |
| the shadow casters, one cascade's worth | | 1,881,360 → 1,449,807 | before and after the batches |

The chain built for Hoth at high over WebGL 2: render, SSGI, denoise, GTAO, volumes, bloom, the surface's grade, SMAA, output (SSR and TRAA are what `nodes-webgl` cannot build: `lib/three/light/post.js`'s CANNOT). The stack: the cascades, PCSS, contact shadows, Hoth's 130 volumes; no console error on a clean run. A frame took over two minutes, so the whole-frame count with the cascades could not be taken here; the row (3M at high) is the laptop's to confirm.

## Left for the owner's laptop

- `BUDGET=1 QUALITY=high node scripts/galaxy-check.mjs surface tatooine,hoth,endor,yavin,bespin,dagobah,mustafar,coruscant,naboo,kashyyyk,kamino,geonosis,scarif,nevarro,mandalore,lothal,sorgan` with `ANGLE=d3d11` (or metal): every world's calls, triangles, MB, p50 and p95, beside `GPU=classic` for the classic numbers and shots. The baseline was made on the classic renderer; if the node renderer counts its passes differently, a node baseline is made from that run, with its reason in the commit.
- The WebGPU leg (the container's SwiftShader device drops its instance).
- Hoth's triangles with the cascades against the 3M row; if over, the cascade count or `SHADOW_REACH` (`level/levelScene.js`) is the lever.
