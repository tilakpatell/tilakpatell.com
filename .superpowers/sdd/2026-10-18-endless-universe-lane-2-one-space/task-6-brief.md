### Task 6: `fullSector`: legacy first, then appended, in 3D

**Files:**
- Create: `src/components/expanse/gen/space.js`, `src/components/expanse/gen/space.test.js`, `src/components/expanse/gen/density.test.js`

**Interfaces:**
- Consumes: Tasks 1–5, and Task 0's `sectorKey`, `sectorCentre`, `spaceId` and `parseSpaceId`.
- Produces: **`fullSector(universe, sx, sy, sz, { things = true } = {}) → Sector`**:
  ```
  { id: sectorKey(sx, sy, sz), sx, sy, sz, seed: sectorSeedOf(...), origin: sectorCentre(sx, sy, sz),
    systems,          // addBodies'd; legacy first (sy = 0), then appended; systems[i].i === i
    wonders,          // today's (w0–w2) on the middle layer; [] elsewhere
    things,           // ThingSet (empty when things: false)
    extras,           // { [list]: rows }
    beacons,          // today's on the middle layer; the same rule at the sector's height elsewhere
    legacy: { systems, wonders } }   // where the appended part begins
  ```
- Produces: **`placeOf(universe, id) → { kind: 'system' | 'planet' | 'moon' | 'wonder' | 'thing' | 'extra', row, sector } | null`.** It parses with `parseSpaceId` and keeps an LRU of 8 sectors. Lane 3's resolver wraps it.
- Appended systems:
  - come from `rngOf(hash64(seed, 'more'))`, with `int(rng, 200, 300)` attempts (or `(100, 150)` in `0,0,0`)
  - index `i = systems.length` and seed `systemSeed(seed, i)`, built by `systemAt` with `d = max(|sx|, |sy|, |sz|)` and `local = localFactions(rngOf(seed), id, d)` (the same list the legacy pass made)
  - are placed by a 3D dart in the 58,000 cube (60 tries), clear of:
    - keep-outs by `systemReach`
    - every system by 6,000
    - legacy wonders and beacons by 3,000

- [ ] **Step 1: Write the failing tests** in `space.test.js`:
  - **Legacy prefix.** For every `PRINTED` sector:
    - `digest(plainSector(fullSector(UNIVERSE, sx, 0, sz), legacy))` equals the fixture's sha256
    - `legacy.systems` and `legacy.wonders` equal `makeSector`'s lengths
  - **Indices continue.** `systems[i].i === i` and `systems[i].id === spaceId([sx, sy, sz], i)`.
  - **Counts** (a dart can miss, so the floors sit a little under the draw):
    - A middle-layer sector holds between `legacy + 180` and `legacy + 300` systems.
    - `fullSector(UNIVERSE, 0, 0, 0)` holds between 90 and 150 and has no wonders.
    - `fullSector(UNIVERSE, 2, -3, 1)` has `id: 'E:2,1,-3'` and `origin: [240000, -360000, 120000]`, no wonders, and systems whose heights span more than 60,000.
  - **Spacing.**
    - Any two systems are at least 6,000 apart in 3D.
    - Every appended system lies within 58,000 of the origin on each axis, and is at least 3,000 from every legacy wonder.
    - Every appended system is clear of the keep-outs by its reach.
  - **Determinism.** The same call gives the same sector. `universeOf('elsewhere')` gives different appended systems, and its legacy prefix differs too, as today. Its core sector `0,0,0` keeps every keep-out (a pocket universe).
  - **`placeOf`.**
    - Every system, planet, moon, wonder and thing id of `E:1,0` (a sample of 200 things) resolves to that row.
    - `placeOf(U, 'e:1,0,0:3:2').row` is `placeOf(U, 'E:1,0:3:2').row`.
    - `'E:1,0:99999'`, `'E:1,0:w60'` and `'beacon:E:1,0:n'` are `null`.
  - **Speed.** Ten middle-layer sectors are made in under 600 ms after one warm-up call.

  Write in `density.test.js`, generating the 27 sectors round home once in `beforeAll` (the spec's two pure tests):

```js
it('has three things within 9,000 and one within 6,000 of 1,000 points across the 27 sectors round home', () => {
  // things: systems, planets at orbitAt(p, 0), lattice things, extras and the hand-made PLACES (deep.js)
  const rng = rngOf(2026n);
  for (let n = 0; n < 1000; n++) {
    const p = [0, 1, 2].map(() => (rng() * 3 - 1.5) * SECTOR);
    const { within9, nearest } = near(p); // a spatial hash over everything above, cell 9,000
    expect(within9, `${p}`).toBeGreaterThanOrEqual(3);
    expect(nearest, `${p}`).toBeLessThanOrEqual(6000);
  }
});
it('keeps every generated system, planet, moon and thing out of every keep-out', () => { /* by reach, radius, size */ });
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/space.test.js src/components/expanse/gen/density.test.js`. Expected: FAIL, because `./space` doesn't exist.
- [ ] **Step 3: Implement `fullSector` and `placeOf`.** If density fails, tune `THING_CELLS` and `THING_JITTER` (a simulation put 20³ at 0.8 at no failures), never the test. Say which constant moved in the commit.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse`. Expected: PASS, including `flight/planets.test.js`, unchanged.
- [ ] **Step 5: Commit.** `git add src/components/expanse/gen && git commit -m "fullSector: the middle layer as it was, then systems, moons and things in 3D"`
- [ ] **Step 6: Run PR 2.1's gate:** lint, test, build, health, smoke. Open PR "Endless universe 2.1: the generator in 3D, additive" listing the interfaces above, and merge.

---

## PR 2.2: No ceilings, the 3D pose

