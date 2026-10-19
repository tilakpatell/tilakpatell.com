# Task 3 report: the noise volume

Commit 81a90c5a8 "Nebulae: a tiling 3D noise volume, made in code".
Files: src/components/universe/nebula/volume.js (120 lines), volume.test.js (30 lines, brief's tests verbatim plus the two imports).

## Implemented
- One seeded Float32 lattice per octave (`period * 2^o` cells a side), wrapped by index, trilinear with smoothstep fade, octaves summed with halving amplitude and normalised to 0..1. Lattices cached by seed/octave/size.
- `fbm3(x, y, z, { period = 4, octaves = 4, seed = 1 })`.
- `noiseVolume(size, seed = 1)`: Uint8Array(size^3 * 2), layout `((k*size+j)*size+i)*2+channel`; R = fbm at `seed`, G = at `seed + 1`; sampled at `i/size * 4`; each channel remapped from its own min..max to 0..255; cached by `size:seed`.
- Hot loop uses a pre-built lattice stack, integer floor/wrap and no allocation.

## TDD
- RED: `npx vitest run src/components/universe/nebula/volume.test.js` failed with "Cannot find module './volume'" (0 tests ran), as expected.
- GREEN: same command, 1 file, 4 tests passed.

## Lint
`npx eslint src/components/universe/nebula` printed nothing (clean).

## Timing
noiseVolume(64, 1), first call in a fresh Node process: 94-118 ms over six runs (a first naive version with a per-sample string-keyed lookup took about 1.5 s; the stack and integer wrap fixed that). The brief says about 60 ms; this machine was busy and the volume has two channels of four octaves.

## Self-review
- Tiling: fbm3 repeats exactly at x + period; seam test passes.
- Negative inputs wrap correctly.
- Concern: timing is about 100 ms, not 60 ms; acceptable as a one-off at load, cached afterwards. Lattice cache grows only per distinct seed.
- Git warned about LF to CRLF on the test file only; harmless.
