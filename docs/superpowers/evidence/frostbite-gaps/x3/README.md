# Lane X3: Rapier streams in. Evidence

Design: `docs/superpowers/specs/2026-10-11-frostbite-gaps-design.md` (§1 X3). Plan: `docs/superpowers/plans/2026-10-11-frostbite-laneX3-rapier-stream.md`. Measured on 2026-10-11 in the cloud container (Node 22.22, Vite 8.3.2, Vitest 5.0.3); `_source` on every row.

## What a visitor downloads for the physics

The chunk that holds a Rapier build and the binary it brings up, raw and gzipped (`gzip -9`), from `npx vite build` at this branch’s head against the same build at `main` (`59191ed5`). A page downloads one build: the SIMD one where `src/lib/wasm/features.js` validates the probe, the scalar one else.

| build | before (the `-compat` module, wasm inlined as base64) | after: the glue chunk | after: the binary (a hashed asset, streamed) | after, together |
| --- | --- | --- | --- | --- |
| scalar | 4.13 MB, 1.58 MB gzipped | 0.21 MB, 0.04 MB gzipped | 2.94 MB, 1.11 MB gzipped | 3.15 MB, 1.15 MB gzipped |
| SIMD | 4.40 MB, 1.58 MB gzipped | 0.21 MB, 0.04 MB gzipped | 3.14 MB, 1.09 MB gzipped | 3.35 MB, 1.13 MB gzipped |

`_source`: `dist/assets/rapier-*.js` and `dist/assets/rapier_wasm3d_bg-*.wasm` at this head; `dist/assets/rapier-*.js` at `main` (the audit, `docs/research/2026-10-11-frostbite-gap-audit.md` §2.1, measured the same files in `node_modules`).

So about 0.45 MB less over the wire a build, and the compile overlapped with the download (`WebAssembly.instantiateStreaming`) instead of after it: the base64 decode on the main thread is gone with the base64.

## The checks

- `node scripts/wasm-check.mjs dist`: 4 binaries, all valid, each named by a chunk (`basis_transcoder` 515 KB, `navsearch_bg` 20 KB, `rapier_wasm3d_bg` 3,010 KB and 3,215 KB).
- `npx vitest run src/lib/physics src/lib/wasm scripts/cpu-profile.test.mjs scripts/lib/rapier-wasm.test.mjs`: 27 files, 241 tests, every physics number unchanged (the same binary, the same floats); `engine.test.js` runs one scene through both builds and the fallback from a SIMD build that will not come up; `world.load.test.js` the retry after a failed import.
- The dev server (`npx vite --port 5199`): `GET /node_modules/@dimforge/rapier3d/raw.js` answers `export * from "/src/lib/physics/raw/scalar.js"` (the plugin’s resolution), and `GET …/rapier_wasm3d_bg.wasm` answers `Content-Type: application/wasm` (the streaming path).
- Vite SSR (the path `scripts/x2-profile.mjs` loads through): a probe that `ssrLoadModule`s `src/lib/physics/world.js`, makes a world, adds a ball and steps it 120 times: see `ssr-probe.json` beside this file.
- `scripts/x2-profile.mjs` itself could not run to its replay here: it reads Hoth’s pack from `public/models/galaxy/bf2017/levels/hoth/` and `far.bin` is in the bucket, not in git (a limit of the cloud container, not of this lane); the replay line is the laptop’s to record.

## What did not change

The pin (`0.21.0`, both packages), `loadEngine`’s face, the SIMD choice and its fallback, `src/lib/wasm/load.js`’s one-try and timeout, every physics test.
