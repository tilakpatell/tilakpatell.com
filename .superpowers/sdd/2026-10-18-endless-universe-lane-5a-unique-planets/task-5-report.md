# Task 5 report: ids, moons and who may build

Status: DONE (one concern below).

## Implemented
- expanse.js: `canonicalId` (regex first, then `parseSpaceId`, rebuilt with `spaceId(...).toLowerCase()`).
- planetTables.js: `PLANE_CLIMATE` (moved unchanged), `SEEDED_EXPANSE` (13 pairs), `MOON_FAMILY`, `familyOf`.
- planetSpec.js: `ROSTER_EXTRA`; `specOf` takes an `extra` argument; `planetSpecOf` has three paths (named, seeded, other planet or moon with `buildable: false`, `kind`, `parent`). A moon's type is its family's.
- lifeTables.js: `EXPANSE_ID` replaced by `canonicalId` in `systemOf` and `lifeFor`.
- planets.js: `rowOf` gains radius, moons, rings; `moonRowOf` exported; `expanseRow` goes through `canonicalId` and `parseSpaceId`, null for sy !== 0.
- fixtures/generated.js: `MOONS`; fixtures/expanse.json regenerated.
- The brief's tests were added verbatim, plus the lifeTables moon test.

## TDD
- RED: `npx vitest run planetSpec.test.js lifeTables.test.js planets.test.js` gave 3 files failed, 8 tests failed (MOONS, ROSTER_EXTRA, moonRowOf missing).
- GREEN: `npx vitest run src/lib/land/flight src/components/expanse/flight` gave 43 of 44 files passing, 461 of 462 tests. The one failure, kitClutter.test.js "sends a leaf’s rows…", is a 5 s timeout on a dynamic import while the machine was loaded; it passes (6/6) with `--testTimeout=60000`. It isn't in the Windows baseline list, so it is load-related.
- The roster lock, TERRAIN_VERSION ground hash and 'makes the rows the fixture holds' all pass.

## Self-review
- Hand-typed ids: the 'e:1,0,0:0:1' form gives the canonical spec. Trailing junk, a system id, a wonder id and a moon past the count give null. A sy !== 0 id is canonical (it keeps its sy) but has no row in the app, so it is null. None throw.
- `moonRowOf` adds `radius` only when the moon has one.

## Concerns
- The kitClutter timeout above (load-related, not code).
- Moon ids resolve to null in the app until lane 2's `moonList` merges, as expected.
- `npm run lint`, the full `npm test` and the build were not run (CPU-quiet rule).
