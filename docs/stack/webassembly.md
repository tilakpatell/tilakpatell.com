# WebAssembly

**Version** the browser’s own; the ports are Rust (stable, edition 2021) built by `wasm-pack` 0.15 with `wasm-bindgen` · **Page owner** `src/lib/wasm/` (and `wasm/` for the Rust sources) · **Decision** none recorded

## What it is, and why it is here

Code compiled ahead to a compact bytecode the browser runs near native speed, with no garbage collector and SIMD where the browser has it. The site runs three modules made so by others, because there is no JavaScript that does their work as fast: Rapier (the physics), the Basis Universal transcoder (every KTX2 texture) and the meshopt decoder (every GLB). Which of the site’s own hot paths pay as WebAssembly is under **The ports** below.

## Where it is used

| module | what it does | build(s) | loaded by | when |
| --- | --- | --- | --- | --- |
| Rapier ([physics-rapier.md](physics-rapier.md)) | the physics | SIMD and plain, each a hashed `.wasm` asset streamed by the shim under `src/lib/physics/raw/` through `src/lib/wasm/instantiate.js` (lane X3) | `src/lib/physics/engine.js` | the first `createPhysics` or `preload` (a world that drives or has the engine) |
| Basis transcoder (three’s `examples/jsm/libs/basis/`) | KTX2 → the GPU’s own compressed format | one (no SIMD build is published) | `src/lib/three/gltf.js`’s `ktx2Loader`, through `src/lib/three/wasmDecoders.js`’s `basisUp` | the first texture or model that carries KTX2, or a world’s `preloadDecoders({ basis: true })` |
| meshopt decoder (three’s `examples/jsm/libs/meshopt_decoder.module.js`) | a GLB’s compressed buffers | SIMD and plain, inlined, picked by the module itself on the same probe | `src/lib/three/gltf.js`, through `meshoptUp` | the first GLB parsed, or `preloadDecoders()` |

## How the site uses it

- **Features asked once, by hand.** `src/lib/wasm/features.js`: three probes a few bytes long (wasm-feature-detect’s, MIT) handed to `WebAssembly.validate`, nothing compiled. `simd` picks Rapier’s build; meshopt asks the same probe itself. `threads` needs `SharedArrayBuffer` and a cross-origin-isolated page, which GitHub Pages can’t give (no COOP and COEP headers), so it is false on the live site and no module asks for it.
- **Every module comes up through `load`** (`src/lib/wasm/load.js`): once, the same promise to every caller; a failure is a `WasmError` naming the module and the reason (`unsupported`, `load`, `timeout`), and isn’t kept, so the next ask tries again; a load that neither finishes nor fails within its time (20 s; meshopt 10 s) rejects rather than leaving a world on its loading screen. `status()` says each module’s state, its build and how long it took (`window.__wasm` in development).
- **The fallbacks.** Rapier: the SIMD build where the probe passes, the plain one where it doesn’t or where the SIMD one won’t come up; neither, and the Battlefront goes on without its engine (the navgrid’s collision, `src/components/battlefront/module.js`). meshopt: its plain build where SIMD isn’t; no WebAssembly at all, and a model fails by name. Basis: the binary is compiled once on the main thread before any worker is handed it (a worker whose instantiation fails never answers, and the textures it holds would wait for good); one that can’t be had is a `WasmError`, and a level’s map that can’t be had is drawn without it (`levelGltf.js`’s catch).
- **A failed world says why.** The runtime keeps `rt.failure` (`{ world, name, message, module }`), so a world that failed for a module says which (`src/runtime/runtime.js`).
- **The physics worker loads through `load.js` too**. `src/lib/physics/worker.js` imports `world.js`, so inside the worker Rapier comes up by the same road as on the page: `engine.js`’s SIMD probe, `lib/wasm/load`’s one try at a time, a named `WasmError` within 20 s. A worker whose engine fails says so (`failed`), and `createPhysics({ worker: true })` takes the main thread’s engine instead; one that never answers is let go after 5 s the same way. It is off everywhere (`docs/stack/physics-rapier.md`). Its poses cross by transfer, not shared memory (`threads` below).
- **Preloaded with the world’s chunk.** A world that draws a level calls `preloadDecoders({ renderer, basis: true })` as its build starts (`src/components/battlefront/module.js`), so the decoders come up beside the level’s first fetches, not behind its first model; Rapier is preloaded and warmed where the world wants its engine (`preload()`).

## The ports

A Rust crate under `wasm/<name>/` stands behind the same interface as the JavaScript it would replace, the JavaScript kept as the fallback, the same tests run against both, and it is kept only when its own before-and-after says it pays. This page lists only what shipped.

| port | replaces | loaded by | before → after | kept? |
| --- | --- | --- | --- | --- |
| `wasm/navsearch` → `src/lib/wasm/navsearch/` (20 KB) | the navgrid’s A*, `searchJs` in `src/lib/battlefront/navSearch.js` | `src/lib/battlefront/navWasm.js`’s `loadNavSearch()`, as the Battlefront’s build starts | 153.6 → 51.2 µs a search, the same cells for all 2,946 of a minute’s searches | yes |

Nothing else in the Battlefront’s step came near the plan’s threshold (1.5 ms a frame): the whole step is about 0.5 ms a frame on the lane’s container. A new port follows the same shape: a crate under `wasm/<name>/` with its own `cargo test`, built by `node scripts/wasm-build.mjs <name>` into `src/lib/wasm/<name>/` (the glue and the `.wasm` committed: CI has no Rust), loaded through `lib/wasm/load`, swapped in behind the JavaScript’s interface, and a test file that runs the JavaScript’s tests again through it.

## What the site does not use, and why

- **Threads** (shared memory, `wasm-bindgen-rayon`): they need a cross-origin-isolated page, and GitHub Pages sends no COOP or COEP header; a service-worker shim that adds them breaks the site’s cross-origin assets (the bucket, the fonts).
- **`wasm-feature-detect`** (the package): three probes are a dozen lines; the bytes are its, credited in `features.js`.
- **A third-party Vite plugin for WebAssembly**: meshopt’s wasm is inlined in its JavaScript; the Basis binary is fetched as an asset by three’s own URL; Rapier’s binaries are hashed assets through the site’s own `scripts/rapier-wasm.mjs`, which resolves one import to a shim and nothing else.
- **The `-compat` Rapier builds**: they inline 2.9 to 3.1 MB of wasm as base64 and compile from bytes after the whole download; the bare builds, streamed, cost about 0.5 MB less gzipped and overlap the compile with the download.

## Rules

- A module comes up through `src/lib/wasm/load.js`, never a bare `WebAssembly.instantiate` a world awaits (`src/lib/wasm/load.test.js`, `src/lib/physics/engine.test.js`, `src/lib/three/wasmDecoders.test.js`; nothing measures a new caller).
- A binary the site instantiates itself goes through `src/lib/wasm/instantiate.js`: streamed where `instantiateStreaming` exists and the type is `application/wasm`, the bytes where the type is wrong (a `TypeError`), the file in Node; a bad module rejects with the engine’s `CompileError` (`instantiate.test.js`).
- Every path is tested: the SIMD build, the plain one, a failure, a timeout (the same tests).
- A port keeps its JavaScript as the fallback, behind the same interface, and is run by the same tests.
- A port ships only with its own before-and-after in the evidence.
- The generated glue under `src/lib/wasm/<name>/` is left out of the lint (`eslint.config.js`) and never edited by hand; `scripts/wasm-check.mjs` (CI and the deploy) fails a published `.wasm` that doesn’t validate or a chunk that names one the build lacks.

## Upgrading

Rapier: [physics-rapier.md](physics-rapier.md). The Basis transcoder and the meshopt decoder come with `three` ([three.md](three.md)); after a three upgrade run `npx vitest run src/lib/three/wasmDecoders.test.js`, which decodes a real GLB through both meshopt builds and compiles three’s transcoder.

The Rust toolchain: `rustup target add wasm32-unknown-unknown`, `cargo install wasm-pack`, then `wasm-pack build --target web --release` in the crate’s folder. Last set up: 2026-10-11 (rustc 1.97.0, wasm-pack 0.15.0).

## Gotchas

- **A worker that fails to instantiate never answers.** three’s KTX2 loader hands each worker the transcoder’s binary; one that fails waits for good, and so does every texture it was given. Hence the main-thread compile (`wasmDecoders.js`’s header).
- **Vitest keeps node_modules in Node’s own module cache**: `vi.resetModules` doesn’t make a new meshopt decoder; the test imports it by a URL with a query (`wasmDecoders.test.js`).
- **A name that starts with `use` is a React hook to the lint**: the search’s setter is `setSearch`, not `useSearch`. (A rename across `src` once caught `useSearchParams` too; rename in the files you mean.)
- **The generated glue keeps its first instance**: `initSync` on a module already made does nothing, so a test of a failed load imports a fresh copy by a query (`navSearch.test.js`).
- **The SIMD probe is a validate, not an instantiate**: a browser that validates SIMD but fails to instantiate the SIMD build (none known) falls to the plain one through `engine.js`’s catch.
