# Task 1: Lock the roster — report

## What I did

1. Read the brief (`task-1-brief.md`) and `constraints.md`.
2. In `src/lib/land/flight/planetSpec.test.js`:
   - Changed the `./fixtures/expanse.js` import to add `lifeFor`.
   - Added imports `planetField` from `./field` and `clutterKitOf` from `./landmarkTables`.
   - Appended the roster lock at the end of the file: `ROSTER_LOCK`, `ROSTER_KEYS` (17 fields), `ROSTER_POINTS` (5 points), `rosterHash()` (FNV-1a over the fifty), and `describe('the roster')`.
3. RED: ran with `ROSTER_LOCK = ''` on unchanged code. Printed value `707fb49f`.
4. Set `ROSTER_LOCK = '707fb49f'`, reran the full file.
5. Committed only `planetSpec.test.js`.

## RED output (excerpt)

```
FAIL  src/lib/land/flight/planetSpec.test.js > the roster > is as it was: the fifty’s fields, ground, life and kits
AssertionError: expected '707fb49f' to be '' // Object.is equality
Tests  1 failed | 1 passed | 14 skipped (16)
```

## GREEN output (excerpt)

```
npx vitest run src/lib/land/flight/planetSpec.test.js
Test Files  1 passed (1)
Tests  16 passed (16)
```

## Files changed

- `src/lib/land/flight/planetSpec.test.js` (+26 / −1)

Commit: `ed247d4d3` "Lock the fifty roster planets before the endless universe changes the flight"

Trailers: the constraints' process ruling (Opus 5.5 co-author line plus Claude-Session). The session attribution reminder names Haiku 5.5. I followed the constraints file.

## Self-review

- Only the test file changed. No `src/` code outside the test was touched.
- The lock value came from main's unchanged planet code, as the brief requires.
- `TERRAIN_VERSION` and `GROUND` are untouched.
- The `npm test` baseline was not run. Only the planetSpec file was run, as the brief specifies.
- Two imports sit at the top of the file in the brief's order, and the lock block is appended after the last `describe`.
