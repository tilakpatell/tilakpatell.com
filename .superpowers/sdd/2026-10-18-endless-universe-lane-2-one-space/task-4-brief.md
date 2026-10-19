### Task 4: Systems, moons, rings and reach

**Files:**
- Create: `src/components/expanse/gen/systems.js`, `src/components/expanse/gen/systems.test.js`
- Modify:
  - `src/components/expanse/gen/sector.js:201-334`: move `cultureOf`, `planetsOf`, the per-system body of the loop at `:279-306` and the local factions at `:265-269` into `systems.js` verbatim. `makeSector` calls them in the same order.
  - `src/components/expanse/gen/seed.js`: append exports.

**Interfaces:**
- Consumes: `orbits.js`, `seed.js`, `names.js`, `tables.js`.
- Produces:
  - `localFactions(rng, id, d) → [{ id, name }]`
  - `systemAt(sSeed, { id, i, at, d, band, local }) → System` (today's fields)
  - `planetsOf(sysId, sysSeed, at, star, culture)` (unchanged)
  - `moonsOf(planet) → Moon[]`
  - `ringBandOf(planet) → { inner, outer } | null`
  - `systemReach(system) → number`
  - `addBodies(sector) → sector copy`. Every system gains `reach`. Every planet gains `centre` (its star's `at`), `revs`, `moonList` and `ringBand`. No existing field changes.
  - In `seed.js`:
    - `moonSeed(planetSeed, k) = hash64(planetSeed, 'moon', k)`
    - `sectorSeedOf(universe, sx, sy, sz)`, which is `sectorSeed(universe, sx, sz)` when `sy === 0` and `hash64(universe, 'sector', sx, sz, sy)` otherwise
- A **Moon** is `{ id: '<planet id>:k', k, name: '<planet name> I|II|…', type: 'rocky' | 'icy', seed: bigint, radius, orbit, phase, revs, tilt }`.
- A moon is icy with chance `{ ice: 0.8, gas: 0.5, ringed: 0.6 }[type] ?? 0.15`.
- This is lane 5a's moon row. It moves here from 5a because lane 2 owns the generator (the index plan says so).

- [ ] **Step 1: Write the failing tests.**
  - `moonSeed(5n, 2) === hash64(5n, 'moon', 2)`. `sectorSeedOf(UNIVERSE, 3, 0, -2) === sectorSeed(UNIVERSE, 3, -2)`. `sectorSeedOf(UNIVERSE, 3, 1, -2)` differs from it.
  - For every planet of the 25 `PRINTED` sectors, run through `addBodies(makeSector(...))`:
    - `moonList.length === p.moons`
    - ids are `${p.id}:${k}`
    - names are `${p.name} I`, `${p.name} II`, …
    - `type` is `rocky` or `icy`
    - `seed === moonSeed(p.seed, k)`
    - orbits strictly increase, with the first beyond `1.8 * p.radius` and beyond `ringBand.outer` when there is one
    - each orbit is at most `4.4 * p.radius`
    - `revs === revsFor(orbit)`, and `p.centre` equals its system's `at`
  - Over those planets, the share of icy moons round `ice`, `gas` and `ringed` planets is higher than round `rock`, `lava` and `desert`.
  - `ringBandOf` is `null` unless `rings`. Otherwise `1.3 r ≤ inner < outer ≤ 2.4 r`.
  - `systemReach(s)` is at least `star.size * 3`, and at least every planet's `orbit + max(radius, ringBand.outer, last moon orbit + moon radius)`.
  - `plainSector(addBodies(x))` deep-equals `plainSector(x)` for all 25 sectors.
  - `moonsOf(p)` deep-equals itself on a second call (pure).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/systems.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Do the move first, then run `fingerprint.test.js` and `sector.test.js` until they pass with no change to the fixture.
  - Then add `moonsOf`, `ringBandOf`, `systemReach` and `addBodies`.
  - Moon fields come from `rngOf(moon.seed)`, so a planet's own stream is untouched.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse/gen`. Expected: PASS. The fingerprint and `sector.test.js` are unchanged.
- [ ] **Step 5: Commit.** `git commit -m "Moons with a type and seed, ring bands and reach for generated systems"`

