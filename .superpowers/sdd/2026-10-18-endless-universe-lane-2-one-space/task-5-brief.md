### Task 5: Things on a lattice, and the hook for more

**Files:**
- Create: `src/components/expanse/gen/things.js`, `src/components/expanse/gen/things.test.js`

**Interfaces:**
- Produces:
  - **Constants:** `THING_BASE = 64`, `THING_CELLS = 20`, `THING_JITTER = 0.8`, `THING_NEAR = 8`.
  - **`THING_KINDS`: the table lane 4a edits.** Each row is `{ kind, weight, size: [least, most], look: { color: '#rrggbb', lit: boolean }, place?(site, ctx) → [x, y, z] | null }`. Lane 2 ships four kinds:
    - `rock`: weight 6, size [20, 120], `#8a8178`
    - `ice`: weight 2, size [15, 90], `#cfe3ee`
    - `derelict`: weight 1, size [30, 140], `#6d727c`
    - `rogue`: weight 0.4, size [100, 260], `#4a3f38`
    - all four are `lit: true`
  - **`SECTOR_EXTRAS = []`: whole-sector lists.** Each row is `{ list, base, max, make(ctx) → [{ kind, at, size, ...own }] }`, with `base + max ≤ THING_BASE`.
  - **`thingsOf(ctx, extras = SECTOR_EXTRAS)`** returns `{ things: ThingSet, extras: { [list]: Row[] } }`. `ctx` is `{ sx, sy, sz, origin, seed, systems, outs }`.
  - **`ThingSet`** is `{ count, slot: Uint16Array, kind: Uint8Array, at: Float32Array (xyz from the sector's origin), size: Float32Array }`.
  - **`thingInCell(ctx, slot) → { kind, at, size } | null`**
  - **`thingRow(sector, i) → { id, n, kind, at (absolute), size, seed, name }`**
  - **`thingSeed(sectorSeed, n) = hash64(sectorSeed, 'thing', n)`**
  - **Ids:** a thing in slot `s` is `spaceId([sx, sy, sz], { wonder: THING_BASE + s })`. The `k`th row of an extra is `{ wonder: base + k }`.

- [ ] **Step 1: Write the failing tests.**
  - The constants, and that each `THING_KINDS` row is valid.
  - For a sector's ctx:
    - `count ≤ 8000`, and slots are unique and ascending
    - each thing lies within `0.8 * 3000` of its cell's centre on every axis
    - `kind < THING_KINDS.length`, and `size` is within its row's range
    - no thing is within `r + (THING_NEAR + 1) * size` of a keep-out
    - no thing is within `systemReach + size` of a system
  - Asking cells out of order (50 seeded slots, in reverse) gives the same entries as the full list (`thingInCell`). This is the spec's "the same whichever order the cells are asked for".
  - For `thingRow`:
    - `parseSpaceId(row.id).wonder === 64 + slot`
    - `row.seed === thingSeed(sector.seed, row.n)`
    - `row.name` matches `/^[A-Z]/`
  - A test-local extras row `{ list: 'test', base: 3, max: 2, make: () => [a, b, c] }` yields 2 rows with ids `w3` and `w4`.
  - A kind's `place` returning `null` removes that site.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/things.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Positions and kinds come from a 32-bit integer hash (`Math.imul`, mulberry-style) of the sector seed's two 32-bit halves and the slot. There is no BigInt per thing, because 8,000 BigInt hashes cost about 30 ms.
  - The bigint `seed` and the `name` are made only in `thingRow`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "A lattice of things in every sector, with a table and a hook for more kinds"`

