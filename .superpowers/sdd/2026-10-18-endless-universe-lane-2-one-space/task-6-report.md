# Task 6 report: fullSector and placeOf

Status: DONE

## Built
- `gen/space.js`: `fullSector(universe, sx, sy, sz, { things })` and `placeOf(universe, id)` (LRU of 8, keyed universe + sector key).
  - sy = 0: legacy is `addBodies(makeSector(...))` untouched; `legacy = { systems, wonders }`. Elsewhere legacy is 0/0, wonders `[]`, beacons from the generic rule at the sector's height.
  - Appended systems: `rngOf(hash64(seed,'more'))`, 200-300 attempts (100-150 in 0,0,0), index = systems.length, `systemAt` with `d = max(|sx|,|sy|,|sz|)`, `local = localFactions(rngOf(seed), id, d)`, `band = factionBand(d)`. 3D dart in the 58,000 cube, 60 tries; clear of keep-outs by reach, systems by 6,000 (27-cell bucket grid, cell 6,000), legacy wonders and beacons by 3,000.
  - Reach is only probed (a system built at the sector's middle) when the sector has keep-outs near it; elsewhere the dart needs no reach. This is what made the speed number.
  - `things: false` gives a zero-length ThingSet and `extras: {}`.
  - placeOf: system, planet, moon, wonder (index < 64, extras by base range first), thing (binary search of slots, `thingRow`), extra. No row, bad index, or unparseable id (e.g. `beacon:...`) gives null.
- `gen/sector.js`: `beaconsOf(sx, sz, seed, sy = 0)` is exported; home beacons only for 0,0,0; otherwise y = centre height + the old -200..200. Fingerprint passes, so makeSector is byte-identical.
- Tests: `space.test.js` (42), `density.test.js` (2). The density test reads the thing arrays directly (thingRow's names made the keep-out test time out) and has a 60 s beforeAll.

## TDD
- RED: both files failed to load, `./space` did not exist ("Test Files 2 failed, no tests").
- GREEN: `npx vitest run src/components/expanse`: 41 files, 366 tests pass (flight/planets.test.js unchanged).
- Lint clean on the four touched files. Health: within budget.

## Speed
Ten middle-layer sectors after a warm-up (things on): 254 ms in the focused run with density running in parallel; about 250-280 ms in isolation. A first, eager-probe version took 1,300 ms; the lazy probe fixed it. Note the budget is tight under heavy CPU contention (one run with the other session busy read 623 ms before the lazy probe landed).

## Constants
`THING_CELLS` and `THING_JITTER` not touched; density passed as set (20, 0.8).

## Self-review
- Rng draws in the dart are unchanged by reordering the clearance checks, so output does not depend on the probe.
- placeOf test compares rows with toEqual, since the test's own sector is a separate instance from the cached one.
- No face change needed (PLACES already re-exported).

## Concerns
None blocking. Keep-out test covers appended systems and their planets, and every thing; legacy systems keep makeSector's own (older) keep-outs.
