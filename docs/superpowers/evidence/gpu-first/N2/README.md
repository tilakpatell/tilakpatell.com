# GPU-first lane N2: the stable picture

Plan: `docs/superpowers/plans/2026-10-11-gpu-first-laneN2-picture.md` (on `claude/gpu-first-renderer`, draft PR #915). Spec: `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md`, §4 “N2”. Branch `claude/gpu-n2-picture`.

The cloud has no GPU. The node renderer’s WebGL 2 leg runs on SwiftShader (the CPU) at 800 × 450 here: it proves that the passes build and draw, and what they count. Its frame times are the CPU’s and compare rows only with one another. The webgpu leg cannot run here (Dawn loses its SwiftShader device on the first frame: `scripts/gpu-parity/README.md`), so everything that is WebGPU’s alone is the laptop’s table below.

## What is here

| file | what | `_source` |
| --- | --- | --- |
| `post-ultra-auto-0.77-webgl.png`, `.json` | the lit fixture at ultra, `--upscale 0.77`: over WebGL 2 the upscaler is FSR1 after SMAA (no TRAA there), which runs RCAS itself, so no sharpen pass | `node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.77 --size 800x450 --legs webgl --evidence gpu-first/N2` |
| `post-ultra-taau-0.77-webgl.png`, `.json` | the same with TAAU at 0.77: TAAU, then the sharpen | `… --upscale taau:0.77 …` |
| `post-ultra-taau-0.77-nosharpen-webgl.png`, `.json` | the before: lane U’s picture, TAAU without the sharpen and with no mip bias | `… --upscale taau:0.77 --sharpen off …` |
| `trails-webgl.png`, `trails.json` | the trail check under TAAU at 0.77 | `node scripts/light-fixture.mjs --trails --tier ultra --post on --size 800x450 --legs webgl` |
| `trails-none-webgl.png`, `trails-none.json` | the same movers with no temporal pass: the control | `… --trails --temporal none …` |
| `trails-checkbug-webgl.png`, `trails-checkbug.json`, `trails-none-checkbug*` | the check’s first runs, kept: they failed on the check’s own two faults (the skinned figure bound off its bone and drawn on the floor; the crate boxed from its centre plane, so its band clipped its own edge), the same with and without TAAU, and no trail in either shot | the same commands, before `src/runtime/fixtures/trails.js`’s fix |
| `shadows-lit-ultra-reversed-off-webgl*.png`, `.json` | lane S’s shadow scene on the standard depth buffer | `node scripts/light-fixture.mjs --shadows --reversed off --tier ultra --size 800x450 --legs webgl --evidence gpu-first/N2` |
| `shadows-lit-ultra-reversed-on-webgl*.png`, `.json` | the same on a reversed buffer, forced over WebGL 2 for the measurement (it is off there by default) | `… --reversed on …` |

## The numbers (the cloud, SwiftShader, WebGL 2 leg, 800 × 450)

Every run below: `exit 0`, no console error.

**The chain** (ultra, 0.77):

| run | passes after the LUT | mip bias | mean lum | programs before → after a light moves | mean ms (CPU) |
| --- | --- | --- | --- | --- | --- |
| FSR1 (`--upscale 0.77`) | smaa upscale output | −1.377 | 0.5271 | 83 → 83 | 2,606 |
| TAAU + sharpen (`taau:0.77`) | upscale **sharpen** output | −1.377 | 0.5271 | 78 → 78 | 1,353 |
| TAAU, the before (`taau:0.77 --sharpen off`) | upscale output | 0 | 0.5270 | 75 → 75 | 1,370 |

The sharpen raises the frame’s edge contrast (the mean absolute Laplacian of the green channel) from 1.403 to 1.488, about 6 %. The frames differ by 0.06 of 255 on average, and the mean luminance does not move (the spec’s §5: under 3 %). The bias is log2(0.77) − 1 = −1.377. The game material reads it, and the fixture’s ring is plain three materials, so the bias shows in the material’s tests and on the laptop’s Battlefront, not in these shots.

**The trails** (30 frames across the wall; the share of each mover’s band, past one frame’s travel, still in its colour; the gate is 2 %):

| run | crate | skinned figure | instanced row | alpha-tested card | trail-free |
| --- | --- | --- | --- | --- | --- |
| TAAU 0.77 + sharpen | 0.00 % | 0.00 % | 0.00 % | 0.00 % | yes |
| no temporal pass (the control) | 0.00 % | 0.00 % | 0.00 % | 0.00 % | yes |

The plan expected the instanced row and the card to trail before the change. They do not: three r186 keeps last frame’s instance matrices and bones itself once velocity is in the MRT. The change that matters is the particles’ (`light/velocity.js`), and the fixture’s movers have none: the particle trail is the laptop’s `--particles` pan to read. The panning banner sits under the floor at this camera, so it is not in the shot. TRAA itself is the webgpu leg’s, on the laptop.

**Reversed depth** (lane S’s shadow scene, the same frames on a standard and a reversed buffer; SwiftShader has `EXT_clip_control`, so the reversed buffer was made):

| view | PSNR, standard against reversed | largest difference (of 255) |
| --- | --- | --- |
| near (`-webgl.png`) | identical | 0 |
| contact on, contact off | identical | 0 |
| the 10 m board (`-pen10`) | 108.5 dB | 1 |
| the cascades’ seam (`-seam`) | 76.8 dB | 19 |
| the 1 m board (`-pen1`) | 73.0 dB | 21 |

Review Focus 5 asks for 40 dB. The mean luminance is 0.2907 both ways, and the programs stay 32 → 32. Over WebGL 2 the reversed buffer stays off by default: this is the measurement that says it could come on there, which is the laptop’s call with a real chip. The fixture now prints the depth buffer three made (`depth reversed | standard`), since three falls back without a word where the extension is missing.

**The gates** on the merged branch: `npm run lint` (0), `npm test` (13,974 of 13,981 before the merge with main, the one failure `navSearch.test.js`’s timeout, which main’s #916 fixed; it passes after the merge), `npm run build` (0), `node scripts/health.mjs --check --skip build` (within budget), `npm run coverage:bf2017` (unowned 0), `npm run maps:bf2017` (44 rows, 0 errors).

## What the code found that the plan did not say

When the docs and the code disagree, the code is what this lane followed. The plan and the spec are on #915’s branch, so the corrections are here and in the PR.

- **three r186’s `Texture` has no `mipmapBias`.** The bias goes at the sample: TSL’s `texture(map, uv).bias(node)`. `src/lib/three/mipBias.js` holds the one value and `surface/compose.js`’s `biasedTexture` reads it through one uniform. `textures.js`’s `sharpen(…, { bias })` keeps a texture’s own offset in `userData.mipBias`. No `WeakRef` set is needed.
- **`Camera.reversedDepth` is a getter.** The switch is the renderer’s `reversedDepthBuffer`, which sets the camera’s flag itself and makes the depth buffer 32-bit float.
- **Reversed depth breaks SSGI, GTAO, SSR, the denoiser and `getViewPosition`** (each discards a depth of 1 as the sky). TRAA, TAAU, `ShadowNode`, `CSMShadowNode` and `ViewportDepthNode` follow the renderer. So `passes.js` draws `1 − depth` once into an R32F target for the screen-space passes (the two depths are exact complements) and gives TRAA and TAAU the buffer as it is.
- **The samples rule is per chain, not per renderer.** A `PassNode` takes the renderer’s sample count unless `options.samples` says otherwise. So a temporal chain’s scene pass is made at 0 samples, and no renderer is made again between worlds.
- **FSR1 sharpens already** (its RCAS). The sharpen pass follows TAAU only, which sharpens nothing. RCAS takes its `sharpness` in stops (`con = 2^−sharpness`), so the strength 0.2 + 0.4 × (1 − scale), at most 0.4, is passed as −log2(strength): the lobe’s weight is the strength.
- **three already writes velocity for instancing, batching and skinning** (`positionPrevious` in `Instance.js`, `Batch.js`, `Skinning.js`), and the node renderer’s foliage on `main` places nothing in its vertex stage. What three cannot follow are the particles (`sprites.js`’s `positionNode`). And the scene pass’s extra targets are never blended, since r186’s WebGPU pipeline reads the pass’s MRT blend, not the material’s. The particles now write the still velocity (`light/velocity.js`). TRAA has no rejection flag to set; its neighbourhood clamp is the rejection. Decals are static meshes, and three’s own velocity is already right for them.
- **three already widens roughness by the geometry** (`getRoughness`: a floor of 0.0525 plus the geometry normal’s derivatives). The specular anti-aliasing works on the shaded normal, which is what sparkles. The 0.045 floor is kept as Filament’s number; under three’s 0.0525 it binds only in the CPU twin.
- **The controller’s climb** is taken only when its own prediction at the next step fits the target. A climb on “under 0.8 of the target” alone would see-saw: 10 ms at 0.77 is 16.9 ms at 1. Each frame is kept as its cost a unit of area (ms ÷ scale²), so a change does not empty the history.
- **Lane G1’s clock resolves one frame at a time**, and its `last` stays until the next resolve lands. The controller takes each reading once.

## To fill on the laptop (RTX 5090, Edge, `ANGLE=d3d11`)

Run in PowerShell from the repository at this branch, with `$env:ANGLE='d3d11'` and `$env:CHROME='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'`. Lane G1’s clock (`src/lib/three/gpuTime.js`) must be on the branch for the controller to run on the GPU’s time: until G1 merges, the controller falls back to the pace and `quality.source` reads `'cpu'`. Merge `origin/main` once G1 is on it, and wire `gpuClock: (renderer) => createGpuTime(renderer)` in `src/runtime/index.js` (one line, noted in the hand-off).

**1. The fixture, both legs, at 1,600 × 900 and 3,840 × 2,160** (`--size 3840x2160` for the second):

```
node scripts/light-fixture.mjs --tier ultra --post on --upscale 1 --evidence gpu-first/N2
node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.77 --evidence gpu-first/N2
node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.77 --sharpen off --evidence gpu-first/N2
node scripts/light-fixture.mjs --tier ultra --post on --upscale 0.67 --evidence gpu-first/N2
node scripts/light-fixture.mjs --trails --tier ultra --post on
node scripts/light-fixture.mjs --shadows --reversed off --tier ultra --evidence gpu-first/N2
node scripts/light-fixture.mjs --shadows --reversed on --tier ultra --evidence gpu-first/N2
```

The webgpu leg’s `trails` row is TRAA’s (the fixture’s ultra chain); the webgl leg’s is TAAU’s. A trail row fails the run when any mover leaves more than 2 % of its band in its own colour. The `--reversed` pair on the webgpu leg is the one that matters: PSNR ≥ 40 dB between the two shots (Review Focus 5).

**2. The Star Wars worlds at ultra on WebGPU, at 3,840 × 2,160 and 1,600 × 900.** The `battlefront` world is the one on `'nodes'` until lane T2 flips the galaxy’s surfaces. `scripts/battlefront-check.mjs` records the field’s frame time over `--ms`, now with its standard deviation and the controller’s `{ source, scale: [min, max] }` (from `window.__RUNTIME__.quality`) in its JSON:

```
node scripts/battlefront-check.mjs --gpu webgpu --quality ultra --size 3840x2160 --ms 20000 --out docs/superpowers/evidence/gpu-first/N2/laptop-4k
node scripts/battlefront-check.mjs --gpu webgpu --quality ultra --size 1600x900 --ms 20000 --out docs/superpowers/evidence/gpu-first/N2/laptop-900
```

Once T2 has merged, each galaxy surface the same way: `$env:BUDGET='1'; $env:QUALITY='ultra'; $env:GPU='webgpu'; node scripts/galaxy-check.mjs surface <world>` (the ultra p95 of 16.7 ms is `scripts/galaxy-budget.mjs`’s on a real chip).

and, with G1’s scripts on the branch, each world’s shot scored against G1’s reference at the scales the controller reached:

```
node scripts/frame-score.mjs <shot.png> docs/superpowers/evidence/gpu-first/reference/<world>-<size>.png
```

| world | size | p95 ms | stdev ms | controller scale (min…max) | source | FLIP vs G1’s baseline |
| --- | --- | --- | --- | --- | --- | --- |
| battlefront (Hoth) | 3,840 × 2,160 | | | | | |
| battlefront (Hoth) | 1,600 × 900 | | | | | |

The gate (the spec’s §4 “N2”): every world under 16.7 ms p95 with the scale at or above 0.67; FLIP no worse than G1’s baseline; standard deviation under 2 ms at 60. With `?fps=30`: frames 33.3 ms apart (the stdev column again).
