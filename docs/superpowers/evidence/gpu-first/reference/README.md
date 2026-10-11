# GPU-first: the reference frames

Lane G1 of the GPU-first design (`docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` §4, plan `docs/superpowers/plans/2026-10-11-gpu-first-laneG1-reference.md`). Every later lane scores its frames against these with `scripts/frame-score.mjs`.

## What each file is

- `<world>.png`: the reference on WebGPU (the laptop’s): the world at its pose, shot eight times with the camera moved by a sub-pixel offset each time (Halton 2, 3 from its first point, centred on the pixel: `src/lib/three/jitter.js`), the chain’s TRAA left out (`?traa=off`), and the eight averaged in linear light (`scripts/lib/frame-metrics.mjs`’s `averageLinear`).
- `<world>.nodes-webgl.png`: the same on the node renderer over WebGL 2 (the cloud’s software-GL leg, or the laptop’s second leg).
- `<world>[.<backend>].candidate.png`: the frame a visitor sees, the baseline’s other half (`--plain`: the temporal pass on, no jitter, one shot).
- `<name>.json` beside each: `_source` (the command, the date, the platform and ANGLE), the world, its route, pose, size, backend, the chain’s passes (the fixture’s), three’s version, the commit and the errors the page logged.
- A run at another size goes to its own folder (`--out docs/superpowers/evidence/gpu-first/reference/2160p`), so the names stay the world’s.

## The cloud leg (2026-10-11, SwiftShader, `nodes-webgl`)

| world | size | kind | file | scores against the reference | _source |
| --- | --- | --- | --- | --- | --- |
| lit fixture | 800 × 450 | reference | `litWorld.nodes-webgl.png` | | `node scripts/reference-frames.mjs litWorld --size 800x450 --gpu webgl` |
| lit fixture | 800 × 450 | candidate | `litWorld.nodes-webgl.candidate.png` | FLIP 0.0258 · PSNR 39.96 dB · SSIM 0.9959 | `… --plain`, then `node scripts/frame-score.mjs litWorld.nodes-webgl.candidate.png litWorld.nodes-webgl.png` |

The same reference shot twice (`--label run1`, `--label run2`, into a scratch folder) agreed to **PSNR 63.42 dB**, FLIP 0.0022, SSIM 0.9998: over the plan’s 50 dB (Review Focus 4), so a reference is the same picture run to run. One shot against the eight-shot average is 41.9 dB and FLIP 0.0186, and shot 0 against shot 1 is 34.4 dB, so the jitter moves the picture and the average is not one shot. FLIP from `flip-evaluator` 1.7, installed in the cloud with `pip install flip-evaluator`.

Hoth was shot in the cloud too and not kept: the level packs are published by hash and not in a cloud checkout, so the dev server answered the GLBs and HDRs with the site’s page and Hoth drew without them. The Star Wars references are the laptop’s (the G1 README has the commands).

## Gotchas

- **What moves on its own smears.** A route’s shots are one 16 ms frame apart on the stopped page clock, so snow, sparks and a turning cube move across the eight; a pose that holds the world still (a world’s `view(name)`) is the clean reference. The fixture draws its shots at a step of 0, so nothing in it moves.
- **The canvas only.** A world’s shots are of `canvas.world-canvas`, not the page: the site’s bar and a world’s HUD are HTML over it.
- **A `'glsl'` world has no reference.** The jitter hook is on the node renderer’s gfx (`src/runtime/webgpu.js`); the classic renderer is refused with a line saying so.
