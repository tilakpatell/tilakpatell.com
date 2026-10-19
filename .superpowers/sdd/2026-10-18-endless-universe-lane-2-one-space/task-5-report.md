# Task 5 report: things on a lattice

Commit d55e4e7b2 "A lattice of things in every sector, with a table and a hook for more kinds".
Files: src/components/expanse/gen/things.js, things.test.js.

## Built
- Constants, THING_KINDS (4 kinds, brief values), SECTOR_EXTRAS = [], thingsOf, thingInCell, thingSeed, thingRow.
- Cell order: slot = ix + 20*(iy + 20*iz); centre = origin - 57000 + 6000*(ix,iy,iz); jitter up to 0.8*3000.
- Hash: two uint32 halves of the bigint seed taken once per ctx, murmur3-style Math.imul mix of (h0, h1, slot, counter). Counters: 1 kind, 2 size, 3-5 jitter.
- Systems prefiltered by a 12000-wide 3D bucket grid (each system inserted in every bucket its reach+maxSize box touches), built once per (ctx, kinds) in a WeakMap cache (pure). thingInCell uses the same cell() as thingsOf, so order of asking is irrelevant.
- Extensions to the API: optional `kinds` param on thingsOf/thingInCell (default THING_KINDS) so tests inject a `place`. place gets `{slot, kind, at (absolute), size}` and returns absolute [x,y,z] or null; runs before clearance. ThingSet.kind indexes into the kinds passed.
- thingInCell returns `at` relative to origin (doubles); ThingSet holds Float32 of the same; thingRow adds origin. Extras rows get `id` ({wonder: base+k}); throws if base+max > THING_BASE.

## TDD
- RED: `npx vitest run src/components/expanse/gen/things.test.js` -> "no tests", failed to resolve ./things import (file absent).
- GREEN: same command -> 12 passed. `npx vitest run src/components/expanse/gen` -> 9 files, 64 tests passed.
- eslint on both files: clean. `node scripts/health.mjs --check --skip build`: "within budget".

## Timing (thingsOf, vitest process, warm-ish)
Sectors (3,-2) 9.8 ms (first, includes JIT), (-4,5) 2.8, (1,1) 4.3, (10,10) 1.9; repeats 2-7 ms. Counts 7995-7999 of 8000 (few removals; sectors hold 12-24 systems). Test asserts < 200 ms only (loose, for CI noise).

## Self-review / concerns
- Removal is rare (about 2-5 cells/sector) because systems and keep-outs are small against 8000 cells; as the brief specifies.
- Systems far outside the sector cube (beyond half a sector + a cell plus reach) are skipped from the grid; they cannot touch a lattice thing unless a future `place` moves a site far out.
- Float32 offsets differ from doubles by under 0.004; clearance tests allow 0.5.
- Bucket key assumes |bucket index| < 1000; fine for sector-sized offsets.
- Used the default `nameOf(rng, 'core')` culture for names (task did not specify one).
- Git warned about LF->CRLF on commit; repo setting, not changed.

## Fix round 1
Reviewer: clearance tests likely vacuous (sector (3,0,-2) probably has no keep-outs).
Added describe "clearance, forced" in things.test.js: (0,0,0) ctx with non-empty outs, count < 8000 (home keep-out removes slots) and clearance holds; forced collisions: a fake system and a fake keep-out placed on slot 4210 make thingInCell return null (and thingsOf omit the slot), while the same one 5000 away leaves it. No code change in things.js; existing tests kept.
Command: npx vitest run src/components/expanse/gen -> 11 files, 112 tests pass. eslint on things.test.js clean.
