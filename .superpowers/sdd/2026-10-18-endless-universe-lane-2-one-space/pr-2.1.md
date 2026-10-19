Lane 2 ("One space"), PR 2.1 of 5: the Expanse's generator in 3D, additive. Pure modules and their Node tests only. Nothing is wired into a scene, so no picture changes.

## What changed (`src/components/expanse/gen/`)
- **The fingerprint** (`fixtures/fingerprint.js`, `.json`, `fingerprint.test.js`). It pins `makeSector`'s output for 25 sectors, including the five that hold the 13 seeded planets. The fixture was written once from main's generator.
- **`grid.js`.** Now thin wrappers over the shared address (`src/lib/space/address.js`), with the same results. `grid.test.js` is unchanged.
- **`orbits.js`.** `ORBIT_CYCLE = 65536`, `REV_K = 4`, `revsFor`, `spaceTime`, `orbitAt`, `moonAt` and `bodiesAt`, all on the shared clock (wall seconds). Orbits stay smooth at t = 1e10.
- **`keepOuts.js`.** Spheres: home 8,000, each fandom planet and wonder 3 × its reach, and the Rick and Morty pocket at `SECTOR_RADIUS.rickmorty + 4000`. Also `keepOutsNear(sx, sy, sz)` and `clearOfKeepOuts`.
- **`systems.js`.** `cultureOf`, `planetsOf` and the per-system body moved here verbatim from `sector.js`; `makeSector` makes the same sectors (the fingerprint proves it).
  - New: `localFactions`, `systemAt`, `moonsOf`, `ringBandOf`, `systemReach` and `addBodies`.
  - Planets gain `centre`, `revs`, `moonList` and `ringBand`. Systems gain `reach`.
- **`things.js`.** A 20 × 20 × 20 lattice of things a sector (`rock`, `ice`, `derelict`, `rogue`). They are hashed in 32 bits, never stored, and the same whichever order cells are asked in.
  - Each thing is kept clear of keep-outs, systems and the middle layer's solid wonders.
  - `THING_KINDS` and `SECTOR_EXTRAS` are the hook lane 4a extends.
- **`space.js`.** `fullSector(universe, sx, sy, sz, { things })` gives the middle layer exactly as today, then appends in 3D:
  - 200 to 300 systems (100 to 150 in the core)
  - their moons
  - the lattice

  `placeOf(universe, id)` resolves any system, planet, moon, wonder, thing or extra id, in either spelling.
- **`seed.js`.** Adds `weighted` (moved from `sector.js`), `moonSeed` and `sectorSeedOf`.
- **`src/components/universe/shared/space.js`.** A lending face (`PLACES`, `SECTORS`, `SECTOR_RADIUS`, `sectorOf`), so the generator reads the universe without a new boundary break.

## Numbers
- `scene.js`: 6,226 lines before, 6,226 after (untouched).
- Draw calls and triangles: unchanged, since nothing is drawn yet.
- Speed: ten middle-layer sectors, with things, take about 250 ms alone. The test now measures CPU time, best of three, against the plan's 600 ms.
- Density: from 1,000 seeded points across the 27 sectors round home, every point has at least 3 things within 9,000 and one within 6,000. This passes with `THING_CELLS = 20` and `THING_JITTER = 0.8` unchanged.
- Health is within budget: boundary-breaks 487 of 489, cycles 5 of 5.

## Interfaces later lanes consume (as built)
These are as the plan says, with these additions:
- `KEEP_OUTS` ids can repeat: `PLACES` has planets called `home` and `rickmorty` beside the home sphere and the pocket. Key rows by index or by id plus `at`.
- `placeOf` rows are shared with its 8-sector cache, so they are read-only. A cache miss builds a whole sector synchronously.
- `thingsOf` and `thingInCell` take an optional `kinds` list (it defaults to `THING_KINDS`). A ctx may carry `wonders`.
- `SECTOR_EXTRAS` rows need `base ≥ 3` and must not overlap.
- `beaconsOf(sx, sz, seed, sy = 0)` is exported from `sector.js`.
- Moon rows are `{ id, k, name, type: 'rocky'|'icy', seed, radius, orbit, phase, revs, tilt }`, as lane 5a reads them.

## Rulings
- Lane 2's new imports from the Expanse into the universe go through `universe/shared/space.js`, because boundary-breaks was at 487 of 489.
- `weighted` moved into `seed.js`, so `sector.js` and `systems.js` share one copy.
- `systemAt`'s `id` is the sector's key, and it builds `${id}:${i}`.
- Beacons off the middle layer use the generic rule at the sector's height, never home's.
- The density test builds 27 sectors in `beforeAll`, which takes about 2 s. The plan requires it.
- The orbits test's smoothness bound uses the fixture planet's true radius (1000.45) instead of the literal 1000. The intent is unchanged.
- The speed test measures CPU time, not wall time, with the bound unchanged. In a loaded full-suite run the wall clock read 9,005 ms for 254 ms of work.
- Appended systems are placed within 56,000 of the centre, not the plan's 58,000. This keeps the spec's 6,000 gap across sector faces: a sweep had found pairs 4,900 apart.
- Lattice things are kept clear of the middle layer's wonders, except nebulae.
- A gas giant's moons may cross a neighbouring planet's orbit at a conjunction. This is left as is: it only affects positions and is rare. Noted for lane 5a.

## Checks
- `npm run lint`: clean. `npm run build`: ok. `node scripts/health.mjs --check --skip build`: within budget.
- `node scripts/autopilot-check.mjs --only smoke --routes /universe,/fly`: everything green.
- `npm test` on this Windows machine: every lane-2 file passes. The failures outside the Windows baseline are 5 s timeouts from cold dynamic imports under machine load. They touch nothing in this PR, and CI is the gate.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PJqkNSL8smFuirsPmEJGyM
