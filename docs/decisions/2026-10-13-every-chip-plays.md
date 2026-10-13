# A weak chip is Low under Auto, a lost GPU comes back by itself, and the way in stops waiting on shaders

**Date:** 2026-10-13 · **Status:** accepted · **Where:** `src/lib/device.js`, `src/lib/gpuProbe.js`, `src/runtime/` (`runtime.js`, `useWorld.js`, `webgpu.js`, `cadence.js`, `dynres.js`, `quality.js`, `index.js`), `src/lib/net/assetFetch.js`, `src/lib/assetDown.js`, `scripts/assets-manifest.mjs`, `src/components/battlefront/` (`waiting.js`, `BattlefrontWorld.jsx`, `module.js`)

## Context

The owner played Hoth on a work laptop, a Ryzen 5's Radeon 740M (four compute units) in Edge on Windows: the GPU hung (`DXGI_ERROR_DEVICE_HUNG`) and nothing came back. With Low picked by hand the game still took a very long time to get into. Read in the code and measured on the production build (the spec's “What was found”): the renderer tier was decided and not used, so Auto put the 740M on High, with its SSGI, SSR, volumetrics and compute cull; a loss left the page dead and the fallback lived in memory only; a level picked mid-visit never reached the world built next; Low fetched four files at a time where Ultra fetched eight; the waiting screen held for every shader; and every page carried the 77,510-entry manifest. The owner's word: a weak chip, or none, is Low under Auto; playable is 30 to 60 fps, as near 60 as can be; nobody waits for eons. The long version is `docs/superpowers/specs/2026-10-13-every-chip-plays-design.md`.

## Decision

Auto is graded by the chip: under 50 on lib/gpuGrade's score Low, and Low for a chip the renderer tier keeps as weak by its name, slow on its probe, or lost in the last week. A T0 chip draws the level the plain way. Frames start at every beat everywhere and settle on an even 30 only when 60 cannot hold with nothing left to lower. A lost WebGPU device brings its world back once on WebGL 2; two losses in a week start the chip there. The quality's tier follows the level. The fetch pool is the connection's, the manifest leaves the first load and is one `JSON.parse`, and Battlefront's door opens five seconds after the level is in, whatever is still building.

## Consequences

- The 740M, Iris Xe and the UHD chips start on Low; every chip scoring 50 or more keeps its Auto as before (the 780M and the entry cards Ultra, under the probe and the pace), the 5090 included. A hand-picked level is never held.
- This replaces two rules of the 2026-10-11 GPU-first lanes: T0's pinned 30 fps cadence and 33.3 ms budget (it now aims at 60), and lib/device's “a chip that grades mid is held at High”.
- It replaces the 2026-10-12 waiting-screen rule that Deploy takes only once nothing has built for 0.6 s: after five seconds with the level in, the guard's held objects appear as they build. The field's first seconds can show them arriving.
- Measured in the container (software GL, the film blocked): the manifest's evaluation 554–610 ms → 305–352 ms, and the classic home page no longer preloads it. The laptop's own numbers are its line in the console (`[battlefront] in at …`).
- Not measured: the 740M's frame rate at Low. There is no real chip in the container.

## Revisit when

- The laptop's load line names the next wait (the D3D12 pipeline builds, the boot's binding on the main thread).
- A chip held at Low by its name proves it can take more (the probe's median under 8 ms at High), or a chip scoring 50 to 100 hangs or stutters at Ultra (then a Mid band for them).
- Lane N6's full table lands: this is its Auto row, its T0 level path and its fallback, not the rest.
