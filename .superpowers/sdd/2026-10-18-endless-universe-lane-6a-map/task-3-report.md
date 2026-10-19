# Task 3 report: the projection

Implemented `src/components/universe/chart/projection.js` (about 170 lines, no imports) to the brief's Interfaces, with the brief's test file verbatim in `projection.test.js`. No extra exports.

Notes: -0 is normalised with `+ 0`; zero-length vectors special-cased in `warp` and `unproject`; `toFrame` clamps u, v to +-1e6 and treats NaN as 0 so a ship 10^12 out stays finite; `panBy` is the inverse map at (-du, -dv); `track`, `zoomBy` return the same object when unchanged / invalid.

## TDD
- RED: `npx vitest run src/components/universe/chart/projection.test.js` failed with an unresolved `./projection` import (no tests ran). Expected: file did not exist.
- GREEN: same command: 1 file passed, 11 tests passed.
- Lint: `npm run lint` clean.

## Files
- src/components/universe/chart/projection.js
- src/components/universe/chart/projection.test.js

## Self-review / concerns
None. Full `npm test` / build not run (focused run plus lint, as instructed).
