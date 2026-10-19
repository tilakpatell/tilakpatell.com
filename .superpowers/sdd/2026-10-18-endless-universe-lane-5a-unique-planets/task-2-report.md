# Task 2 report: the sphere and the chart

Status: DONE. Commit f8b77bff2 "Map a planet's sphere: its layout and the chart round a landing spot".

Files: src/lib/land/flight/sphere.js (new), src/lib/land/flight/sphere.test.js (new, brief's test verbatim).

Implemented: unit (returns v itself within 1e-12 of length 1; zero or non-finite gives [0,1,0]), angleBetween (atan2 of cross length and dot), dirOfUv/uvOfDir, dirOfLatLon/latLonOfDir (biomes.js maths reimplemented, both dir builders pass through unit), frameAt (north = +y projected, -x projected at poles, east = cross(north, up)), chartOf (at = unit(at); toDir folds 1/d into the sine; toChart uses atan2(p, dot), antipode gives [piR, 0], at gives [0,0]).

TDD:
- RED: `npx vitest run src/lib/land/flight/sphere.test.js` -> "Cannot find module './sphere'", 0 tests.
- GREEN: same command -> 1 file passed, 6 tests passed. eslint on both files clean.

Self-review: toDir returns the same `at` array when d = 0 (callers must not mutate). toChart treats perpendicular length < 1e-12 as on-axis (error under 1e-7 m at R = 20 km).

Concerns: the commit trailer is "Claude Opus 5.5" as constraints.md dictates, while this session's attribution reminder names Sonnet 5.5; I followed constraints.md.
