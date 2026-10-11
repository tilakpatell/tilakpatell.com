# The node renderer is the only renderer on the Star Wars worlds above the low tier

Date: 2026-10-11. The long version: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md`. Links `2026-10-10-the-engine-in-place.md` and `2026-10-08-three-over-babylon.md`, which stand.

## Context

The owner asked that every Star Wars world look like Battlefront II (2017) as Frostbite renders it, with every detail the assets carry, on one renderer, the best-looking one, from above the medium setting, with the setting checked, and every gate green. Four readings of `main` on 2026-10-11 found the game-look stack (the calibrated sun with PCSS cascades, cloud and contact shadows, the Rayleigh and Mie sky with the record’s panorama, volumetric fog, clustered placed lights, crossfading probes, SSGI, GTAO, SSR, the record’s linear tonemap and LUT, the five-Gaussian bloom, TRAA and the upscalers, the game material with recipes and variations, the layered ground, the decals, the particles, lane U’s batching) built and merged under `src/lib/three/light/` and `src/lib/three/surface/`, and drawing only on the separate `battlefront` world and the `litWorld` fixture: `galaxy-surface` never says `shading: 'nodes'`, so its seventeen worlds run the classic `WebGLRenderer` with a GLSL composer, one PCF sun, three pooled lights and a gradient sky.

## Decision

- `galaxy-surface` is a `'nodes'` module. `pickBackend` takes the tier: `high` and `ultra` run the node renderer always (`webgpu`, or `nodes-webgl` without WebGPU); `mid` runs it on WebGPU and the classic renderer without (the node chain over WebGL 2 costs about twice the frame, lane U’s tables, and mid without WebGPU is the phones); `low` keeps the classic renderer whole.
- On the node renderer every world passes its record’s `picture` and every layer the stack has, per tier as `light/post.js` chains them; nothing is hand-tuned where the record has a number.
- The quality setting (`tp-quality`) stays the owner’s switch; the settings panel says which renderer and backend the world runs on, and a test pins that a change of quality re-creates the world on the one the table says.
- Every pack gains its ultra cut; the caps rise a step; what only the desktop can make is listed, never approximated silently.
- The gates are all of them: lint, tests, build, health, coverage, maps, colour, every world within its rows on the node renderer at high in software GL in CI, and under 16.7 ms p95 at ultra on the owner’s laptop.

## Consequences

- The classic surface path is the low tier’s alone and is kept byte-for-byte until the low tier moves too.
- CI grows by the seventeen worlds at high on the node renderer, in two shards.
- The lanes: T2 the flip, P the picture, D2 every detail, U2 headroom on, M2 the material’s last mile, G the gallery; the desktop’s asks beside them.

## Revisit

If the node renderer over WebGL 2 cannot hold the high tier’s rows on a mid-range laptop, the mid rule moves up a tier; if the seventeen-world gate takes CI past twenty minutes, it moves to a nightly run with the PR gate on three worlds.
