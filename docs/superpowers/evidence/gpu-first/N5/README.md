# Evidence: GPU-first lane N5, the frame’s physics and effects split as Chaos splits them (2026-10-11)

The plan: `docs/superpowers/plans/2026-10-11-gpu-first-laneN5-sim.md`; the design’s §4 “N5” (both on the design branch, `claude/gpu-first-renderer`, PR #915, until it merges). Every number here was measured in this lane’s cloud container (4 cores, Node 22, headless Chromium with SwiftShader) unless a row says otherwise; none is the owner’s laptop’s (the last section has the commands for it).

## The files

| file | what it is |
| --- | --- |
| `x2-cpu-ultra-js.profile.json`, `x2-cpu-ultra-js.run2.profile.json` | `node scripts/x2-profile.mjs --seconds 60 --tier ultra`: the Battlefront’s step on Hoth without breaks (lane X2’s run, again on this branch), twice |
| `x2-cpu-ultra-js-breaks100-own.profile.json`, `…-own.run2.profile.json` | `… --breaks 100`: a hundred breaks a minute round the player, the debris in a small world of its own (the default), twice |
| `x2-cpu-ultra-js-breaks100-level.profile.json` | `… --breaks 100 --debris-world level`: the same, the debris in the level’s own collision world, stepped every frame |
| `physics-worker-200.json` | `node scripts/physics-worker.mjs`: one scene of 200 bodies stepped 600 frames on the main thread and through the module Worker in headless Chromium: the main thread’s cost each way, the hop, the worst difference at the end |
| `debris-lit-ultra.json`, `debris-lit-ultra-webgl.png`, `debris-lit-ultra-webgl-breaks.png` | `node scripts/light-fixture.mjs --debris --legs webgl`: the lit fixture with a hundred breaks a minute on the node renderer over WebGL 2 (the CPU path) |

The `.cpuprofile` files the profile writes beside each JSON (0.2 to 0.8 MB) are not kept, as lane X2 kept none.

## 1. The step with a hundred breaks a minute (the plan’s gate: under 2 ms p95)

`_source`: the JSON files above, `physics` (the debris world’s step and `debris.update`, timed a frame) and `frame` (the whole of what the Battlefront’s `step` runs a frame).

| run | breaks | hulls gone static | lost | refused by the cap | particles (bursts) | step p50 ms | step p95 ms | step worst ms | frame p50 ms | frame p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no breaks | 0 | | | | | | | | 0.234 | 2.831 |
| no breaks, again | 0 | | | | | | | | 0.309 | 3.302 |
| **own world** | 104 | 720 | 15 | 0 | 121,550 (104) | **0.715** | **1.389** | 16.1 | 1.393 | 5.361 |
| **own world, again** | 104 | 720 | 15 | 0 | 121,550 (104) | **0.531** | **0.926** | 3.756 | 0.928 | 3.763 |
| level’s world | 104 | 727 | 10 | 1 | 121,550 (104) | 2.918 | 5.717 | 31.4 | 3.987 | 8.664 |

**The gate holds with the debris in its own world** (p95 0.93 and 1.39 ms, under 2), and fails in the level’s (p95 5.7 ms). The first own-world run’s frame rose by more than its step: modules the debris never touches (the battle, the sim, the stream’s bands) ran 1.5 to 2 times their no-break time in that run, the container busy; the second run, alone, rose by the step’s own cost (p50 0.31 → 0.93 ms).

**The same battle.** Every run above made the same 2,946 searches, every one the same through the JavaScript and the WebAssembly search (`replay.differ` 0), and ended with every entity in the same place (`battle.hash` `8b0ff052`, FNV-1a over each entity’s position to 0.1 mm): the breaks change nothing the battle sees. The soldiers walk the navgrid, not Rapier, and the debris is seeded (`debris.js`: a break’s pieces are drawn from its serial).

### Why the debris has a world of its own in the Battlefront

Stepping Hoth’s collision costs more than the debris does. The Battlefront steps Rapier only when a cell comes (`map/collision.js`), so a frame never paid for its colliders until breaks needed the engine stepped every frame. Measured:

| what | `_source` | ms a step |
| --- | --- | --- |
| Hoth’s near cells in Rapier (985 fixed bodies, 3,873 colliders, 440 of them trimeshes; nothing moving), `world.step()` alone | `x2-profile.mjs` with the world’s census and a 300-step timing added, 10 s run | 1.08 |
| the same through `world.js`’s `step(1/60)` | the same | 1.25 |
| the same, a 20 s run with `--breaks 0.001` (none made), timed a frame | `x2-profile.mjs --seconds 20 --breaks 0.001 --debris-world level` | p50 1.35, p95 3.34 |

and Rapier 0.21 on its own, fixed cuboids set 6 m apart, nothing moving, 200 steps after 30 (`src/lib/physics/engine.js`’s builds, a throwaway Vitest file, not kept):

| fixed colliders | on one body, SIMD | one a body, SIMD | on one body, plain | one a body, plain |
| --- | --- | --- | --- | --- |
| 250 | 0.177 | 0.152 | 0.305 | 0.316 |
| 1,000 | 0.218 | 0.567 | 0.203 | 0.392 |
| 4,000 | 1.003 | 1.669 | 1.385 | 1.809 |

So a fixed collider costs about 0.25 to 0.4 µs every step whether anything moves or not. Hoth’s figures don’t touch it (the navgrid); its one Rapier question is the camera’s arm (`collision.js`’s `sweep`, which needs no step). So in the Battlefront the hulls and their floor tiles step alone; in a world whose figures are Rapier bodies (the planet landings, the galaxy’s surface), `createDebris` is handed that world’s own physics and the hulls hit the player. Hoth’s collision holds no terrain either (`heightfields: 0`): the first run, without a floor, had 64 hulls at y −470 after ten seconds, all awake, the cap full; hence `groundAt` (a floor tile under each break, gone with its last hull) and the lost rule (30 m below the break).

**For the worker.** The level’s world stepped every frame is the first step measured over 2 ms here (p95 5.7 ms with the breaks, 3.3 ms without). No world does it today, so nothing turns the worker on; a world that comes to step a level’s collision every frame is the case `createPhysics({ worker: true })` waits for, once the laptop measures it over 2 ms.

## 2. The worker

`createPhysics({ worker: true })`, tested in Node through an in-process Worker that structured-clones every message with its transfer list (`src/lib/physics/fixtures/fakeWorker.js`):

| check | `_source` | result |
| --- | --- | --- |
| one scene (a floor, two balls, a turned box) stepped 150 frames on the main thread and through the worker | `workerClient.test.js` | every position and quaternion within 1e-6 |
| no Worker can be made; a Worker whose engine fails; one that never answers | `workerClient.test.js` | the main-thread engine, `status().worker` false |
| a body added and removed between two steps | `poses.test.js`, `worker.test.js`, `workerClient.test.js` | no row; the handle keeps where it was |
| a query | `workerClient.test.js` | answered with the next step, the hit body as its handle |
| the worker dies mid-run | `workerClient.test.js` | reported once, steps nothing more |
| the build | `npm run build` | the worker an ES module of 22 KB that loads one Rapier build of its own when made (an iife inlined both: 9 MB) |

In a real browser (`node scripts/physics-worker.mjs`, `_source` `physics-worker-200.json`: headless Chromium 141, 200 boxes and balls dropped on a floor, 600 frames; times to Chromium’s 0.1 ms):

| | `status().worker` | the main thread’s cost of `step()` p50 / p95 | a step posted to its poses back p50 / p95 |
| --- | --- | --- | --- |
| main thread | false | 1.4 / 3.1 ms | |
| through the worker | **true** (a real module Worker) | 0.1 / 0.2 ms | 1.5 / 2.6 ms (the worker’s own step inside it) |

The two runs end with every body in the same place to the bit (worst difference 0). So the worker takes the step off the main thread for 0.1 ms of messaging, and a body’s pose arrives a frame late.

Nothing turns the worker on until a world’s step is measured over 2 ms on the laptop.

## 3. The burst on the depth buffer

| check | `_source` | result |
| --- | --- | --- |
| the CPU twin (`collide.js`) on a synthetic floor seen from 10 m up | `src/lib/three/particles/collide.test.js` | just behind it: put back on it, its speed into it turned (×0.3) and rubbed (×0.4); above it, further behind than 0.1 m, off the screen, under depth 1, behind the camera: nothing |
| 64 particles of rubble falling 1 m at 3 m/s, a second | `gpu.test.js` | with the depth, none below −0.1 m and all under 0.5 m; without, all below −1 m. Before the move term, a 6 m/s piece stepped over the 0.1 m in one frame and fell through (−2.2 m) |
| the kernel’s term | `gpu.test.js` | compiled to WGSL in Node by three’s own `WGSLNodeBuilder`: a `texture_depth_2d` read by five `textureLoad`s |
| the kernel run on a GPU | the laptop | not in the cloud: SwiftShader gives no WebGPU device |

## 4. The caps and the lights

- A ragdoll’s points are held on the debris’s live-hull cap while it falls and given back when it rests (`src/lib/three/ragdollPhysics.test.js`); a break during the fall gets the room left (`debris.test.js`, `breaks.test.js`).
- Particle lights go after the placed lights in `ClusteredLighting`’s list, oldest first, and past the pool the newest are dropped, never a placed lamp (`src/lib/three/light/placed.test.js`); `effects.js`’s `lights()` fades a one-shot’s over its life (`effects.test.js`).

## 5. The lit fixture (the CPU path)

`node scripts/light-fixture.mjs --debris --legs webgl` (`_source` `debris-lit-ultra.json`; Chromium’s clock in a page that isn’t cross-origin isolated ticks in 0.1 ms, so these are to 0.1 ms):

| what | result |
| --- | --- |
| breaks in the minute | 102 (100 in the timed 60 s) |
| hulls gone static, lost, live at the end | 709, 0, 54 (the cap’s 64 never full: 1 hull turned away all minute) |
| particles | 119,075 in 102 bursts |
| the step (Rapier and the sleep check), a frame | p50 0.5 ms, p95 1.0 ms, worst 3.3 ms |
| the particles on the CPU path (effects.js over 16,000 slots with collide.js’s twin), a frame | p50 1.5 ms, p95 2.9 ms, worst 8.8 ms |
| programs before and after a light moves | 51 → 51 (no recompile) |
| the frame | 13.3 s mean: SwiftShader draws it on the CPU, so it says nothing of the GPU’s (the laptop’s row below) |

The shots: `debris-lit-ultra-webgl.png` (the first second: a crate’s and a barrel’s hulls landing, a burst in the air) and `debris-lit-ultra-webgl-breaks.png` (after the minute: about 500 static chunks round the ring, the newest hulls and their bursts coming down). A minute of a hundred breaks in a ring 3 to 7 m round one point piles far deeper than a level would; a static chunk has left the engine, so a later hull falls through the pile to the ground (the design’s: a sleeping hull is freed). The specks are the fixture’s stand-in sheet: it loads no FX sheets. On WebGL 2 the bursts are the CPU’s, landing on the ground’s depth computed once from the fixture’s fixed camera; on WebGPU they are the kernel’s, on a depth pass of the scene.

## 6. On the owner’s laptop: not run

What the cloud can’t do. On the laptop (RTX 5090, Edge, `ANGLE=d3d11`):

```
node scripts/x2-profile.mjs --seconds 60 --tier ultra
node scripts/x2-profile.mjs --seconds 60 --tier ultra --breaks 100
node scripts/x2-profile.mjs --seconds 60 --tier ultra --breaks 100 --debris-world level
node scripts/light-fixture.mjs --debris off --legs webgpu,webgl
node scripts/light-fixture.mjs --debris --legs webgpu,webgl
node scripts/light-fixture.mjs --debris --legs webgpu,webgl --size 3840x2160
node scripts/physics-worker.mjs
```

| row | the bar | what to read |
| --- | --- | --- |
| the step with a hundred breaks a minute | under 2 ms p95 | `physics.p95` in `x2-cpu-ultra-js-breaks100-own.profile.json` |
| the same battle | 0 differ, the same hash as without breaks | `replay.differ`, `battle.hash` |
| the level’s world stepped every frame | over 2 ms p95 turns the worker on for a world that does it | `physics.p95` in `…-level.profile.json` |
| the GPU frame with a hundred breaks a minute | within 1 ms of before | `mean` and `p95` of `debris-lit-ultra-webgpu` against `nodebris-lit-ultra-webgpu` |
| the hop | the main thread’s share through the worker plus the hop, against the step on the main thread | `physics-worker-200.json` |
| the burst on the depth buffer | rubble lies on the ground in `debris-lit-ultra-webgpu-breaks.png`, none under it | the shot |
