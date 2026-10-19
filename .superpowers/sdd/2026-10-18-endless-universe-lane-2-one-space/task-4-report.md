# Task 4 report: systems, moons, rings and reach

## Built
- `gen/systems.js` (new): `cultureOf`, `localFactions`, `systemAt`, `planetsOf` moved verbatim from sector.js; new `ringBandOf`, `moonsOf`, `systemReach`, `addBodies`. Header lists exports.
- `gen/seed.js`: added `moonSeed`, `sectorSeedOf`, and `weighted` (moved from sector.js; header updated). `clamp` moved to systems.js.
- `gen/sector.js`: now imports `weighted`, `cultureOf`, `localFactions`, `systemAt`; rng draw order unchanged (dart and `at[1]` stay in makeSector). Header notes systems.js.
- `gen/systems.test.js` (new): 10 tests covering every item in the brief.

## Design
- Rings: own stream `rngOf(hash64(p.seed,'rings'))`; inner in [1.3,1.6]r, outer in (inner+0.2r .. 2.4r].
- Moons: span (max(1.8r, ring.outer), 4.4r] split into `p.moons` equal slots; orbit = lo + (k + u)·slot with u in [0.2,1), so orbits strictly increase and the last is <= 4.4r. Each moon uses only `rngOf(moonSeed(p.seed,k))` (one hash64 + one rng per moon). Radius max(3, 0.08..0.25 r); phase [0,2pi); tilt +-0.35; icy chance `{ice .8, gas .5, ringed .6}[type] ?? .15`.
- `systemReach` = max(star.size*3, orbit + max(radius, ring outer, last moon orbit + radius)).
- `addBodies` copies; input untouched (tested).

## TDD evidence
The move was done first: `npx vitest run src/components/expanse` gave 37 files / 300 tests passing, fingerprint and sector tests unchanged, fixture untouched. Honest note: I wrote systems.js's new functions together with the move and the tests after, so I did not capture a RED run of systems.test.js. After: systems.test.js 10/10 pass; eslint on gen clean; `node scripts/health.mjs --check --skip build` prints "within budget".

## Timing
One `addBodies(makeSector(UNIVERSE, 1, 0))`: addBodies alone about 0.8 ms per call (average of 20 warm calls, vitest/Node); makeSector itself was not separately timed but the whole test ran in tens of ms.

## Concerns
- Moon radius floor of 3 can exceed 0.25r only for planets with r < 12 (none in the tables, tested with +3 slack).
- Ran the full `src/components/expanse` suite before adding systems.test.js; not re-run afterwards beyond the gen file itself.
