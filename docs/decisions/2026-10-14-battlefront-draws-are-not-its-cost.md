# Battlefront’s draws are not what its frame costs: no texture arrays for Hoth’s material shapes

**Date:** 2026-10-14 · **Status:** accepted · **Where:** `docs/superpowers/HANDOFF-runtime.md` (lane P3), `src/components/galaxy/surface/level/` (`levelGpu.js`, `levelBatch.js`, `levelGltf.js`), `src/lib/three/gpuScene/`, `src/components/battlefront/`

## Context

Lane P3 was to cut Battlefront’s draws on Hoth: give the game materials a `userData.batchKey`, and put each material shape’s maps in texture arrays with a per-part material row, so that the GPU scene draws about one indirect draw a shape. The lane’s premise came from N1’s note (`docs/superpowers/evidence/gpu-first/N1/README.md`): Hoth’s 70 material keys are 11 shapes, and the level is 209 draws.

What scoping it found in the code (2026-10-13):

- Battlefront’s map loads Hoth’s level with the GLB’s own materials, not the game materials (`battlefront/map/level.js` passes no `materialFor`), and the GPU scene there keys a group by type, maps and scalars (`levelBatch.js`’s `materialKey`). It already draws the level in about 69 groups. The 209 are the indirect sub-draws inside those groups, not draw calls.
- Arrays per shape would have to be split by size, colour space and transcoded format. A map’s size also changes in play, because it is promoted from its smallest row to the tier’s (`levelGltf.js`’s swap), so an array layer would have to change size mid-session.

What P0’s probe measured on the owner’s RTX 5090 at High on WebGPU (`docs/superpowers/evidence/perf/README.md`):

- The frame is the main thread’s: 6.7 ms of JavaScript against 1.2 ms on the chip, with 120 to 150 draws.
- The profile puts that JavaScript in three’s walk of a 5,617-object graph (`_projectObject`, `updateMatrixWorld`). P4 cut that walk: `_projectObject` from 1,105 to 327 ms in 6 s of profile, 157 to 200 fps.

## Decision

Lane P3 is not built. The level keeps the GPU scene’s groups as they are. Nothing gets a `batchKey` and nothing is put in arrays.

## Consequences

- None in the code. The GPU scene’s groups, the texture cache and its promotion stay as they are.
- The frame time goes where it is spent: the main thread (P4) and the weak chip’s fill (P6).

## Revisit when

- The level draws the game materials (`materialFor` wired into Battlefront’s map). Then each recipe compiles its own program and keys its own group (`gameMaterial.js` bakes its scalars), and the group count may grow past what bundles absorb.
- A profile on the Radeon 740M (P0’s laptop rows) puts its frame in submitting draws rather than in fill or in the graph’s walk.
- three gives WebGPU bindless textures or multi-draw indirect. Neither is in a browser today, and both would change what an array buys.
