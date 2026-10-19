# Task 2 report: Orbits on the shared clock

Status: NEEDS_CONTEXT. Nothing committed.

## Built (uncommitted)
- `src/components/expanse/gen/orbits.js`: ORBIT_CYCLE, REV_K, revsFor, spaceTime, orbitAt (Rodrigues about normalize(r0 x (Y x r0)); phase f - floor(f)), moonAt, bodiesAt.
- `src/components/expanse/gen/orbits.test.js`: the brief's block, verbatim.

## TDD
- RED: `npx vitest run src/components/expanse/gen/orbits.test.js` failed, module could not be resolved.
- After implementing: 4 of 5 pass, 1 fails:
  `stays smooth with the clock days or years from its epoch`: expected 0.0063944560888911485 <= 0.006392586616190171.
- Lint of both files: clean.

## The problem
The smoothness test's bound `most` uses an orbit radius of exactly 1000. The fixture planet is at offset [1000, 30, 0] from its centre, so its true radius is hypot(1000, 30) = 1000.45. The first test requires orbitAt to keep that distance exactly, so the real per-frame step is 1.00045 times `most` (about 6.3945e-3 against a bound of 6.3926e-3 + 1e-6). The two tests cannot both pass for any correct circular orbit. Any implementation holding the radius gives the same step; the failure is 1.9e-6 over the bound.

Options for the controller: (a) change the fixture to `at: [241000, 0, 5000]` (radius exactly 1000; but the 30 on y tests the tilted plane); (b) compute `most` from `len(planet.at, planet.centre)`; (c) widen the tolerance to about 1e-5. I did not change the test (rule: never loosen).

## Self-review
- Pure, no imports. Degenerate case (planet straight above/below the star) falls back to axis Y.
- moonAt circle: x = orbit cos a, z = orbit sin a in the x-z plane, tilted about x: y -= z sin(tilt), z *= cos(tilt). Distance to planet is exactly `orbit`.

## Update: controller ruling
Controller ruled option (b): in the "stays smooth" test, `most` now uses `len(planet.at, planet.centre)` in place of the literal 1000 (plan-text correction; fixture, 1e-6 tolerance and all else unchanged). Result: 5 of 5 pass, lint clean. Committed.
