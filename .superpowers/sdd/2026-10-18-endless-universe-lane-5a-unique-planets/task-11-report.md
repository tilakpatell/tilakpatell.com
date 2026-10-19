# Task 11 report: the bake in a worker, cached in memory

Status: DONE. Commit ab6f26646 "Bake orbit maps in a worker and keep them in memory only".

## Implemented
- orbitMap.worker.js: on `{ key, spec, width, height }` posts `{ key, width, height, rgba, biome }` with both buffers transferred; ignores `cancel`.
- orbitMaps.js: `ORBIT_WORKER`, `makeOrbitWorker` (returns null where there's no Worker), `createOrbitMaps({ workers, make, cap = 16 })` with `get`, `peek`, `stats`, `dispose`.
  - `define` called once at creation (size 1). Key is `${id}:${w}x${h}`.
  - In-flight promises are shared, so two asks make one bake. A null answer or a rejected request resolves null, is not cached and is not left in flight, so the next ask bakes again. `get` and `peek` never throw.
  - LRU: a `get` hit moves the map to the newest. `peek` does not refresh recency (commented), so a frame-loop look doesn't keep maps alive.
  - `dispose` bumps an epoch so a bake begun before it isn't cached after, clears the cache and closes the group.

## TDD
- RED: `npx vitest run src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.test.js` gave 2 failed suites ("Cannot find module ... orbitMap.worker.js" / "./orbitMaps").
- GREEN: same command gave 2 files, 9 tests passed.
- `npx vitest run src/lib/land/flight`: 23 files, 258 tests passed (no load timeouts).

## Files
src/lib/land/flight/orbitMap.worker.js, orbitMap.worker.test.js, orbitMaps.js, orbitMaps.test.js.

## Self-review
- The 'stores nothing' grep passes on both orbitMaps.js and orbitMap.js; orbitMap.js needed no change.
- I added one test beyond the brief ('never throws, and asks again after a pool that threw').
- Not run: lint, full test and build (the gates are left to the final run).

## Concerns
- The worker test bakes a 16 x 8 round spec, which runs in under a second.
- A plane, gas or moon spec isn't special-cased here. It goes through `bakeOrbitMap` in the worker, which Task 10 covers, and a bake that throws in the worker is turned into null by the pool's onerror.
