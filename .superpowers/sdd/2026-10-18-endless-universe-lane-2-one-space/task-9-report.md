# Task 9 report: the pose carries its sector in 3D

Status: DONE. Commit 7859d7696 "Poses carry their sector in 3D; the height clamp goes; old poses read as before".

## Built
- protocol.js: imports `SECTOR, parseSectorKey, sectorCentre, sectorKey` from `lib/space/address` (grid.js import gone). `writePose` writes x, y and z from the sector's centre when `sectorOf` gives an `E:` key. `readPose` parses `[10]` with `parseSectorKey` (either case, 2 or 3 numbers), clamps x, y, z to +-SEC_FAR of the centre (sectorless: x and z to +-FAR, y to +-SEC_FAR; the 1,300 clamp is gone) and returns `sec` in `sectorKey` form. `readShot` bound is +-1e12; the `from` check is untouched. Header doc for the pose now says 3D.
- rosterWhere.js: `fullSector(SHARED, ...parseSectorKey(sec), { things: false })`, nearest system by 3D distance within 12,000, 16 sectors cached.

## TDD
RED (impl reverted, new tests in): 5 failed / 81 passed in protocol.test.js + rosterWhere.test.js: the replaced `toBe(62000)` test, the 3D pose test, the far-shot test, the shot-bound test, the rosterWhere 3D test.
GREEN: those two files 86/86; `src/components/universe/online` 13 files, 226 tests; `layout.test.js` + `expanse/gen` 12 files, 136 tests. eslint clean on the four touched files.

## Test changes to existing assertions (both are spec removals, say so in the PR)
1. `protocol.test.js` `toBe(1300)` -> `toBe(62000)` (as the brief says).
2. NOT in the brief: `readShot([1e9, 0, 0, 0, 0, -20]).p[0]).toBe(90000)` ("reads a shot fired anywhere in the spread universe") asserted the old FAR shot clamp, which the brief's +-1e12 bound removes. Changed to `readShot([1e13, ...]).p[0]).toBe(1e12)`. Same intent, new bound.

## Boundary-breaks (health)
Before 486 of 489, after 485 (the grid.js import is gone from protocol.js and rosterWhere.js). "within budget".

## Self-review
- Old build's `[..., 'E:2,-1']` reads x 240001, y 2, z -119997 (tested). `'E:1,0,x'` and `'X:1,0'` read no sector (tested). A 1,000-off shot at 500,000 is refused by the `from` check (tested).
- `writePose` still uses `inExpanse(sectorOf(...))` to decide; the sectorless-at-y-50,000 test round-trips with no `sec` and passes.
- `readPose` no longer calls `inExpanse`; the shared parser decides what is a sector (so `'main'` and junk read as none). `inExpanse` is still used in writePose.

## Concerns
- The first full `online` run showed nostr.test.js timeouts while the machine was busy and files were mid-edit; the final run is fully green (nostr not in the Windows baseline), so I judge them load flakes.
- Step 6 browser/online checks not run, as instructed.
