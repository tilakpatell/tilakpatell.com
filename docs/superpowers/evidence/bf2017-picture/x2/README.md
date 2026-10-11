# Evidence: lane X2, WebAssembly where it pays (2026-10-11)

The plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneX2-wasm.md`; the design’s §7. The owner’s word: use WebAssembly and make it robust. The plan’s word: the three modules already in WebAssembly made robust first, then the CPU hot paths measured, and a port kept only where its own number says it pays. Every number here was measured in this lane’s cloud container (4 cores, Node 22, headless Chromium 1194) unless a row says otherwise; none is the owner’s laptop’s (task 5, below).

## The files

| file | what it is |
| --- | --- |
| `x2-cpu-<tier>-<search>.profile.json` | `scripts/x2-profile.mjs --seconds 60 --tier <tier> --search <js\|wasm>`: the Battlefront world’s step on Hoth, a minute at 60 frames, its time by module and by function per frame, the frame times, and every A* search the minute made replayed through both searches |
| `swiftshader-battlefront-hoth-high.profile.json` | `PROFILE=60 node scripts/galaxy-check.mjs battlefront hoth`: the same world in headless Chromium, software GL, high |

## 1. The three that exist, made robust

| module | builds | chosen by | what happens when it fails | tests |
| --- | --- | --- | --- | --- |
| Rapier | SIMD (`@dimforge/rapier3d-simd-compat@0.21.0`, added) and plain | the SIMD probe (`src/lib/wasm/features.js`) | SIMD won’t come up → plain; neither → `WasmError`, not kept; never comes → timeout at 20 s; the Battlefront goes on without its engine | `src/lib/physics/engine.test.js` (each path, and one scene through both builds to the same numbers), `world.load.test.js` |
| meshopt decoder | SIMD and plain, inlined in three’s module | the module’s own probe (the same bytes) | no WebAssembly → `WasmError` (`unsupported`); `ready` rejects → `WasmError` | `src/lib/three/wasmDecoders.test.js`: a real GLB (Kenney’s cliff, CC0) decoded by both builds to the same bytes |
| Basis transcoder | one (no SIMD build is published) | n/a | compiled on the main thread before any worker sees it: a fetch that fails, a binary that won’t compile, a fetch that never comes → `WasmError` within 20 s, the loader let go and made again on the next ask; a level’s map that can’t be had is drawn without it | `wasmDecoders.test.js`: three’s own transcoder compiled; a bad binary, an empty one, a failed fetch, a timeout |

Rapier’s SIMD build against its plain one, `_source`: a 600-body world on a 33² heightfield, 300 steps after 30, the median of five runs, Node 22, this container:

| build | step, median ms (five runs) |
| --- | --- |
| plain | 2.65 · 2.68 · 2.71 · 2.82 · 3.18 |
| SIMD | 1.91 · 1.95 · 2.01 · 2.06 · 2.14 |

A failed world says why: `rt.failure` is `{ world, name, message, module }` (`src/runtime/runtime.js`, tested in `runtime.test.js`), so a world that failed for a module names it. The plan asked for it “in the frame guard”; `lib/three/frameGuard.js` holds back shaders and pictures, not modules, so the name is kept where the runtime catches a world’s build and its frames, which is where a hang or a trap would surface. The decoders are preloaded as the Battlefront’s build starts (`preloadDecoders`), beside its first fetches.

## 2. The profile

**Software GL can’t see the frame’s script.** `PROFILE=60 galaxy-check.mjs battlefront hoth` at high: a minute of play held **2 frames** (SwiftShader drew 7.1 million triangles a frame, p50 182 s) and **176.8 ms** of main-thread script against 64,181 ms idle; the main thread waits on the GPU process for nearly all of it (`swiftshader-battlefront-hoth-high.profile.json`, `_source` that file). Its top modules were three (91 ms), native (32 ms) and Rapier (5.8 ms, its first steps over the cells as they came): too few frames to rank anything. (Two page errors in that run, `Unexpected token '<'`, are a pack JSON the dev server answered with its index page; nothing this lane touched.) The surface world (`/galaxy/hoth/surface`) has the same draw on the same SwiftShader and was not run: the method can’t answer the question.

**So the frame’s CPU work was run without the draw**, in Node, on Hoth’s own pack from disk: `scripts/x2-profile.mjs` runs what the Battlefront’s `step` runs a frame (the battle at its fixed rate with its bots, `view(sim)`, the level’s stream and LOD table, the collision’s cells added to Rapier, which steps the engine only when cells come) for a minute at 60 frames, the player deployed and walking, profiled through the inspector at 0.2 ms. Left out, as drawing or near it: the figures, the bolts’ and ragdolls’ meshes, the light, and the camera’s arm (one Rapier ball swept a frame, `collision.js`’s `sweep`). The laptop’s recordings (`docs/superpowers/evidence/bf2017-streaming/laptop-ultra*.json`) hold bytes, requests and load times, no CPU time, so they could not be used.

The top ten at high, the JavaScript search, `_source` `x2-cpu-high-js.profile.json` (a function’s total: its own time and its callees’; ms a frame; the share of the busy time). The whole step is **0.534 ms a frame** (p50 0.095, p95 1.874, worst 17.0).

| # | entry | ms a frame | share | over 1.5 ms? |
| --- | --- | --- | --- | --- |
| 1 | the bots (`bots.js` stepBrains) | 0.319 | 59.8% | no |
| 2 | a bot’s plan and navigation (`soldierBrain.js` plan, navigate) | 0.213 | 39.8% | no |
| 3 | the navgrid’s paths (`nav.js` findPath) | 0.187 | 35.1% | no |
| 4 | its A* (`navSearch.js` searchJs) | 0.127 | 23.8% | no; the largest single leaf, **ported** |
| 5 | the level (`map/level.js` update: stream and LOD) | 0.071 | 13.2% | no |
| 6 | the LOD table (`levelScene.js` update; its re-sort every 8 m, `sort`, 0.020) | 0.047 | 8.7% | no |
| 7 | `view(sim)` | 0.043 | 8.0% | no |
| 8 | the garbage collector | 0.036 | 6.8% | no |
| 9 | a bot’s senses (`soldierBrain.js` think, `bots.js` perceive) | 0.035 | 6.5% | no |
| 10 | the stream’s wanted cells (`levelStream.js` update, `bands.js` wanted) | 0.024 | 4.4% | no |

At ultra the step is **0.629 ms a frame** (p95 2.166), the same order (`x2-cpu-ultra-js.profile.json`). The other candidates the plan named: the cell bins’ decode (`instances.js`) and the collision (`levelPhysics.js`, `collision.js`) round to 0.000 ms a frame over the minute; the scatter isn’t in the Battlefront world; the terrain’s height queries are not asked a frame (the sim walks the navgrid’s heights: 0 `heightAt` calls a frame in the run); the pace is not in the step.

**Nothing is over the plan’s threshold** of 1.5 ms a frame (its share of 16.7 ms at 60 frames a second): the whole CPU step is 3 to 4 per cent of the budget on this machine. The search was ported anyway, as the largest leaf and the cause of the step’s spikes (a sim step with a replan is the frame’s p95), to test the owner’s ask against a number.

## 3. The port

| port | replaces | crate | before (JS) | after (WebAssembly) | kept? |
| --- | --- | --- | --- | --- | --- |
| the navgrid’s A* | `searchJs` (`src/lib/battlefront/navSearch.js`) | `wasm/navsearch` (Rust, wasm-bindgen 0.2.100, 20 KB) | 153.6 µs a search | 51.2 µs a search | **yes** |

Its numbers, `_source` `x2-cpu-{high,ultra}-{js,wasm}.profile.json`:

| tier | run | searches | the search, ms a frame | the step, ms a frame | frame p50 | frame p95 |
| --- | --- | --- | --- | --- | --- | --- |
| high | JavaScript | 2,946 | 0.156 | 0.534 | 0.095 | 1.874 |
| high | WebAssembly | 2,946 | 0.071 | 0.468 | 0.098 | 1.442 |
| ultra | JavaScript | 2,946 | 0.161 | 0.629 | 0.169 | 2.166 |
| ultra | WebAssembly | 2,946 | 0.067 | 0.508 | 0.156 | 1.456 |

The same 2,946 searches replayed five times through each (the median): JavaScript 452 to 486 ms, WebAssembly 151 to 164 ms; **0 of 2,946 differ**, so a seeded battle is the same battle on either. The worst frame moves with the garbage collector and the stream (17.0 against 19.9 ms at high, 20.8 against 12.2 at ultra), not with the search. Nothing is slower.

How it is held: the JavaScript stays as the fallback behind one interface (`search`, `setSearch`); `navWasm.js` loads the port through `lib/wasm/load` and puts it in, or leaves the JavaScript where it can’t come up; `nav.test.js` runs a second time through the port (`nav.wasm.test.js`); `navSearch.test.js` holds both to the same cells on the test field, Hoth’s arena grid with blocked cells, and 20 random grids under a budget; the crate’s own `cargo test` (five cases). Built by `node scripts/wasm-build.mjs` (rustc 1.97.0, wasm-pack 0.15.0; `wasm-opt` from npm’s `binaryen@123`, as wasm-pack’s own download from GitHub’s releases is refused here).

No port was tried and removed: nothing else came near the threshold, so nothing else was ported.

## 4. The build

`vite build` emits `assets/navsearch_bg-<hash>.wasm` (20 KB) and three’s `basis_transcoder-<hash>.wasm` (515 KB) as assets; Rapier’s and meshopt’s are inlined. `scripts/wasm-check.mjs dist` (in `deploy.yml` after the build, and in CI) fails a binary that doesn’t validate or a chunk that names a hashed `.wasm` the build lacks: on this branch, 2 binaries, both valid. GitHub Pages serves `.wasm` as `application/wasm`; `assets-publish.mjs` types it so for the bucket. The health measure holds (`node scripts/health.mjs --check --skip build`: within budget); `src/lib/wasm/` is a leaf under `src/lib` (the generated glue imports nothing).

## 5. The gate on the laptop: not run

The plan asks for the frame’s main-thread time on the owner’s laptop before and after, through lane W’s `gate` job. That job runs on the owner’s desktop runner; this session can’t reach it. To run it there: `node scripts/x2-profile.mjs --tier ultra --search js` and `--search wasm` (the same harness, the laptop’s Node), or lane W’s gate on this branch against `main`.
