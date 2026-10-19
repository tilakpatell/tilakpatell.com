# Final fix 2.1 report

Commits: 1b4294c73 (faces and wonders, space.js + things.js), ba25d6c25 (tests, notes, restorations). All under `src/components/expanse/gen/`.

1. Speed test (space.test.js, `describe('speed')`): CPU time via `process.cpuUsage()` (user + system), best of three batches of ten (sectors 10..19, 0, 3) after a warm-up call, bound 600 ms kept, console.log removed, `/* global process */` added.
2. moonAt (orbits.test.js): checked moonAt computes `[o cos a, -o sin a sin tilt, o sin a cos tilt]` offset at t = 0 (the documented convention), so the formula was used unchanged. New test pins it (toBeCloseTo 9 places), shows a tilted moon leaves the planet's y over several t, and a tilt-0 moon never does. orbits.js untouched.
3. Header comments: keepOuts.js (ids repeat, key by index or id plus at), space.js (placeOf rows shared with the cache, read-only; a miss builds a whole sector), things.js (ctx immutable; extras `make` output plain data).
4. Extras guard (things.js, in thingsOf): throws for `base < 3` and for overlapping `[base, base + max)` ranges, beside the existing lattice guard. Tests in things.test.js "hooks": base 2, overlap in both orders, adjacent ranges allowed.
5. Placement cube: `CUBE` 58000 renamed `CUBE_HALF = 56000` with a comment (space.js:~25). The spacing assertion is now 56000. New `describe('sector faces')` test with the four required pairs plus two more.
   - Did it fail at 58,000? NOT for the four required pairs: they passed at 58,000 (a close pair across a face is rare per pair). A sweep of 5x3x5 neighbour pairs along all axes at 58,000 found 5 failing pairs (min distances about 4,900 to 5,700), e.g. (1,0,0)|(1,1,0) and (2,0,0)|(3,0,0). I added those two to the test, so it does bite at 58,000 (found by sweep, noted in a comment). It passes at 56,000. I did not re-run the added two pairs against 58,000 inside the test itself; the sweep used the same rule (legacy-legacy pairs skipped, systems within 6,000 of the face).
6. Things clear of wonders: ctx gains `wonders` (fullSector passes `sector.wonders`; absent means none). `prepare` keeps the non-nebula ones as `{ at, r: size }`; `cell` drops a candidate within `r + size`. `thingInCell` and `thingsOf` share `cell`, so they agree. Test "drops a thing inside a wonder's radius plus its size, except for a nebula" (pulsar on the slot, edge hit, clear miss, nebula leaves the thing; list and single-cell agree).
   - What a wonder's size is: tables.js WONDERS says `size: [least, most] (its radius)`. scene/sectors.js draws a nebula as a cloud (nebula()) and other kinds as a ball of radius `size * look.r` (pulsar 0.15, derelict 0.12, rogue 0.5), so the table radius is at or beyond the drawn radius; I use `size`. Noted in the things.js header.
7. grid.js comment beside `export { SECTOR }`; fingerprint.test.js spacing fixed. fixtures/fingerprint.json untouched.

## Verification
- `npx vitest run src/components/expanse src/components/universe/shared src/lib/space`: 43 files, 388 tests; 387 passed on the full run. `flight/kitClutter.test.js` timed out (5 s, dynamic imports under machine load) on that run and in a solo rerun at the default timeout, then passed 6/6 with `--testTimeout=90000`. It does not touch the generator. Fingerprint and flight/planets.test.js unchanged and passing.
- `npx eslint` on all 8 touched files: clean.
- `node scripts/health.mjs --check --skip build`: "within budget".
