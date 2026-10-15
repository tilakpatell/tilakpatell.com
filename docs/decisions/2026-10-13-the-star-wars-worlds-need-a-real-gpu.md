# The Star Wars worlds need a real GPU, Low is the floor they hold 30 fps at, and WebGPU is tried before WebGL 2

**Date:** 2026-10-13 · **Status:** accepted · **Where:** `src/lib/fit.js`, `src/lib/gpuGrade.js`, `src/lib/floorRatio.js`, `src/components/worlds/` (`WorldGate.jsx`, `UnfitCard.jsx`, `worlds.js`), `src/runtime/` (`runtime.js`, `webgpu.js`, `cadence.js`), `src/lib/level/png16Off.js`, `src/lib/three/gltf.js`

## Context

After the [every-chip-plays decision](2026-10-13-every-chip-plays.md) the owner asked for four things: the site draws on WebGPU wherever a GPU is detected and falls back to WebGL 2 when it cannot connect; the Star Wars worlds, whose assets are the site's heaviest, need a real GPU, and a device without one is told so, for now; a real GPU is any integrated or discrete chip that runs the 2017 game at the most compressed web settings, which most laptops but the complete potatoes should hold at 30 fps, looking rough; and a busy main thread must not lag the game. The worked-out floor and the minimum chip are the spec's addendum (`docs/superpowers/specs/2026-10-13-every-chip-plays-design.md`).

## Decision

Low is the floor in the Star Wars worlds: a buffer of 1,280 × 720 at most, no bloom, the nearest 8 point lamps and 2 spots, each map's first row, the ground's near grid at 8 m, five bots a side. From the 5090's measured 0.6 ms at Low, a chip needs lib/gpuGrade's score 10 to hold 30 fps there (Skylake's HD 5xx and everything since). `lib/fit` turns away no WebGL 2 and no WebGPU, a software renderer, a chip scoring under 10, two cores or fewer and 2 GB or less; a chip its name does not grade is let in. The card says why and offers the way back and Try anyway. A world on the node renderer asks for WebGPU first; a device that cannot be made, or a fallback adapter, makes WebGL 2 at once. The terrain's PNG decode goes to a worker and meshopt to its own.

## Consequences

- Software GL (a VM, a remote desktop, a blocklisted driver) and Intel's HD chips before Skylake see the card on /galaxy, /battlefront and /deathstar/inside; the rest of the site is as it was. The QA scripts set `tp-software`, so the container's SwiftShader still reaches the worlds.
- Try anyway is kept for the visit (session storage); `?software=on` in the address, or `tp-software` in local storage, keeps it longer.
- A chip that is let in but slower than its score says is the cadence's and the controller's: an even 30 and the 0.58 floor under the 720p cap.
- Measured in the container (software GL, the film blocked, the new build): Hoth at Low in at 47.9 s, against 209 s before this work; the PNG16 worker served. The 740M's frame rate is still not measured: there is no real chip here.
- The cadence steps by the display's own beat, so a 120 or 144 Hz screen drops to an even 60 before an even 30.
- The renderer itself stays on the main thread: three's shader builds, draws and (on WebGL 2 without parallel compile) link waits are the load's remaining main-thread time.

## Revisit when

- A chip scoring 10 to 20 shows its load line or frame time under 30 fps at Low (raise MIN_SCORE), or a chip under 10 plays it (lower it).
- Something other than the card should stand in for the Star Wars worlds on a potato (the owner's “for now”).
- The renderer moves to an OffscreenCanvas worker, the lane after this one.
