# Endless universe, lane 2: One space. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the universe one 3D space with no ceiling, rim or seam. Generation is additive and covers the core, kept off the hand-made places. Drawing is camera-relative, in levels of detail, with sectors generated off the main thread. Orbits move, moons and rings are drawn, and generated bodies are solid.

**Architecture:**
- **Pure first.** `expanse/gen/` gains a 3D composer, `fullSector`. It returns today's middle-layer output unchanged (a fingerprint test pins it) and appends systems, moons and a lattice of things after it. Orbits, keep-outs, the budget table and the levels of detail are pure modules with Node tests.
- **Drawing.**
  - Every frame is drawn camera-relative (`universe/relative.js`).
  - Every generated far object (a speck, or a disc with its true size) is drawn by farStars' one `Points`, so the core's baseline poses gain no draw call and no triangle.
  - Only the nearest systems are built as meshes: the star and its light, planets on `orbitAt`, moons and rings. Those bodies join the solids.
- **Five PRs, each mergeable alone, in this order:**
  - 2.1 the generator
  - 2.2 no ceilings and the 3D pose
  - 2.3 camera-relative always
  - 2.4 levels of detail on today's Expanse
  - 2.5 one space everywhere: the 3D chunk grid and worker generation, with the rim gone

**Tech Stack:**
- three.js 0.186 on the GLSL path (`universe/module.js` is `'glsl'`, so `ShaderMaterial` is fine)
- Vitest
- `src/runtime/workers.js` (`rt.workers`)
- `lib/three/gpuWork` through the scene's `warm()` (`scene.js:936`)
- Playwright check scripts

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`, section A, the "What done looks like" items 1, 2 (the generator's half), 9 and 10, and sections B and H as they touch the generator and the budget. The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`, whose Task 0 (`src/lib/space/address.js`) this lane consumes and never redefines.

Line numbers are from `b56fc3ed`. If code has moved, find it again by the quoted code.

## Global Constraints

**Process and repo rules:**
- Every rule in `HANDOFF-universe.md` "The owner's rules" and the index's Global Constraints holds.
- Each PR passes `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/autopilot-check.mjs --only smoke` on `/universe` and `/fly`. CI must be green, the merge is a merge commit, and there are no force-pushes.
- Before any PR that changes a picture (2.3, 2.4, 2.5), take before shots on `main` with `node scripts/universe-check.mjs --quality all --out lab/universe/before-2.N/<tier>`.
- Draw calls and triangles at every pose in `lab/universe/baseline/<tier>.json` are no higher after than before, at all three tiers. The PR says the numbers.
- `src/components/universe/scene.js` doesn't grow. Each PR moves out at least as many lines as it adds and states both counts (`wc -l` before and after).
- New files stay under 800 lines.
- `expanse/gen/*`, `runtime/*`, `universe/budget.js` and `expanse/scene/levels.js` import no React, DOM or three.js.
- Generated content is never stored. There is no new dependency, no new asset and no new on-screen word, so `WORLD_MB['/universe']` is unchanged.
- A test that describes behaviour the spec removes (the rim's wake and sleep, the floating origin in the Expanse, the 2D starfield ring, the ±1,300 pose clamp) is replaced in the same PR by a test of what replaces it, and the PR lists each one. No other test changes.
- Lane 1 owns the nebula `gl.Points` in `expanse/scene/sectors.js:52-112` and their call at `:151-153`. Keep that function and call site as they are. If lane 1 has merged, keep its `createNebulae(...).add(desc)` call instead.
- Don't touch:
  - `nav.js` destinations
  - `NavMap.jsx` and `MiniMap.jsx`
  - `lib/land/*`
  - `director.js`, `traffic.js` and `hunters.js`
  - `expanse/flight/planets.js` (it stays on the legacy `makeSector`)

**Numbers the spec pins:**
- **Space:** sectors are cubes with `SECTOR = 120000`. Ids are Task 0's. On the middle layer, everything `makeSector` gives today keeps its index, type and seed.
- **Keep-outs (spheres):**
  - home: 8,000
  - each fandom planet and wonder: 3 × its reach
  - the Rick and Morty pocket: `SECTOR_RADIUS.rickmorty + 4000`, round `SECTORS.rickmorty.origin`, as today
- **Density:** from 1,000 seeded points across the 27 sectors round home, every point has at least 3 things within 9,000 and the nearest no more than 6,000 away.
- **Ceilings:** no ceiling, floor or turn-back. A flight of 100,000 units straight up from home is never turned back. `ceilingAt` stays only as a placement guide.
- **Drawing:**
  - A body 10^9 units out draws within a pixel of where it should.
  - Nothing appears over 4 px in one frame.
  - Crossing a sector boundary costs no frame over budget.
  - Planet maps are 256 × 128, or 512 × 256 on `high` and up (budget table only).

**Numbers this plan picks (the spec leaves them to the lane):**
- **Placement:** the placement cube's half is 58,000 (`SECTOR / 2 - 2000`, today's margin). Systems are at least 6,000 apart in 3D; wonders and beacons are kept 3,000 from any system.
- **Systems appended a sector:** 200 to 300, or 100 to 150 in the core sector `0,0,0` (spec: "lighter").
- **Things:**
  - a lattice of 20 × 20 × 20 cells (6,000 each) a sector, one candidate a cell, jittered up to 0.8 of half a cell
  - indices `w64` and up (`w3` to `w63` are kept for whole-sector lists such as lane 4a's gargantuan)
  - `THING_NEAR = 8` sizes is where a thing is built as a mesh
- **Orbits:** `ORBIT_CYCLE = 65536` s and `REV_K = 4`. The shared clock is wall-clock seconds, `Date.now() / 1000`.
- **Depth:** the far plane stays 45,000 and there is no logarithmic depth. Past it, everything is a speck in the far layer with no depth test, so the depth range never needs to grow, and log depth would need every one of the universe's 61 `ShaderMaterial`s patched.

## Review Focus

1. **A ship sitting on a sector face or corner** (x = 60,000 exactly, or -0) loads each neighbouring sector once and never flickers between two. Pinned in Task 18 (the grid's hysteresis) and Task 20 (300 frames on a face, each key asked once).
2. **A tab open for days**, or a clock far from its epoch (t = 1e10 s), keeps orbits smooth and continuous across `ORBIT_CYCLE` wraps. Pinned in Task 2.
3. **A jump a thousand sectors away mid-load:** late worker answers for the old place are refused, slots from two centres never draw together, and nothing leaks. Pinned in Task 20.
4. **An older pilot's pose** (9 or 10 fields, a 2-number `E:` key, y absolute within ±1,300) reads exactly as before. Junk keys (`E:1,0,x`, `X:1,0`) read as no sector. Pinned in Task 9.
5. **A pocket universe** (`/universe?seed=word`, a different bigint) goes through the worker and is deterministic. It differs from the shared universe and keeps out of the keep-outs. Pinned in Tasks 6 and 19.

## The PRs

| PR | Tasks | What a visitor sees | `scene.js` lines |
|---|---|---|---|
| 2.1 The generator | 1–6 | nothing (pure) | 0 |
| 2.2 No ceilings, the 3D pose | 7–9 | fly up or down for ever; other pilots at any height | edits in place, 0 |
| 2.3 Camera-relative always | 10–11 | nothing (pixel-identical); Expanse atmospheres fixed | about −35 |
| 2.4 Levels of detail | 12–17 | past the rim: discs that grow, moving orbits, moons, rings, solid planets, star light | about −20 |
| 2.5 One space everywhere | 18–22 | generated space round home and in every direction; no rim | about −2 |

---

## PR 2.1: The generator (pure)

### Task 1: Fingerprint today's middle layer; grid over the address

**Files:**
- Create: `src/components/expanse/gen/fixtures/fingerprint.js` (the projection and the sector list), `src/components/expanse/gen/fixtures/fingerprint.json` (written once, from unchanged code), `src/components/expanse/gen/fingerprint.test.js`
- Modify: `src/components/expanse/gen/grid.js:1-24`

**Interfaces:**
- Consumes: Task 0's `SECTOR`, `sectorAt`, `sectorCentre`, `sectorKey` from `src/lib/space/address.js`.
- Produces:
  - `PRINTED`: the 25 `[sx, sz]`
  - `plainSector(sector, { systems?, wonders? }) → object`: today's fields only, bigints as strings, cut to the first `systems` systems and `wonders` wonders
  - `digest(plain) → hex sha256`
  - `grid.js` keeps `SECTOR`, `sectorAt(x, z)`, `sectorId`, `parseSector` and `sectorCentre(sx, sz)` with today's results

- [ ] **Step 1: Write the fixture module and the test.** `fixtures/fingerprint.js` exports:
  - `PRINTED = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[0,0],[1,-1],[-1,1],[-1,-1],[2,0],[0,2],[-2,0],[0,-2],[2,-1],[3,-2],[1,2],[5,5],[-3,-6],[7,-9],[-7,4],[12,0],[0,-12],[100,3],[-40,17],[250,-250]]`. The first five are `flight/planets.js:23`'s SECTORS, where the 13 seeded planets come from.
  - `plainSector`, which picks these fields in this order:
    - the sector: `id, sx, sz, seed, origin`
    - each system: `id, i, name, designation, at, seed, culture, star, faction, traffic, hazard`, and its `planets`
    - each planet: `id, name, type, radius, color, at, orbit, moons, rings, seed`
    - each wonder: `id, kind, name, at, size, seed`
    - `beacons` `n, e, s, w`
  - `digest`, using `node:crypto`.

```js
// fingerprint.test.js
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRINTED, digest, plainSector } from './fixtures/fingerprint';
import { makeSector } from './sector';
import { UNIVERSE } from './seed';

const FILE = new URL('./fixtures/fingerprint.json', import.meta.url);
const today = () => Object.fromEntries(PRINTED.map(([sx, sz]) => {
  const s = makeSector(UNIVERSE, sx, sz);
  return [s.id, { systems: s.systems.length, wonders: s.wonders.length, sha256: digest(plainSector(s)) }];
}));

describe('the middle layer, fingerprinted', () => {
  it('pins 25 sectors, the seeded planets’ five first', () => {
    expect(PRINTED).toHaveLength(25);
    expect(PRINTED.slice(0, 5)).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]);
  });
  it('makeSector makes today’s sectors, field for field', () => {
    // (written once, from the generator as it was on main; never rewritten)
    if (!existsSync(FILE) && process.env.FINGERPRINT_WRITE) writeFileSync(FILE, `${JSON.stringify(today(), null, 2)}\n`);
    expect(today()).toEqual(JSON.parse(readFileSync(FILE, 'utf8')));
  });
});
```

- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/expanse/gen/fingerprint.test.js`. Expected: FAIL with ENOENT, because there is no fixture yet.
- [ ] **Step 3: Write the fixture from today's generator.** The generator files must be untouched when you do this. Run `FINGERPRINT_WRITE=1 npx vitest run src/components/expanse/gen/fingerprint.test.js`, then the same command without the variable. Expected: PASS, 2 tests. The JSON has 25 keys, and `E:0,0` shows `systems: 0`.
- [ ] **Step 4: Rewrite `grid.js` as wrappers.**
  - `SECTOR` is re-exported from the address module.
  - `sectorAt(x, z)` is `[sx, sz]` of `sectorAt(x, 0, z)`.
  - `sectorId(sx, sz)` is `sectorKey(sx, 0, sz)`.
  - `sectorCentre(sx, sz)` is `sectorCentre(sx, 0, sz)`.
  - `parseSector` keeps its own strict regex: only 2-number keys with an upper-case `E:`, as `grid.test.js:23-36` demands.
- [ ] **Step 5: Run the grid and fingerprint tests.** Run `npx vitest run src/components/expanse/gen`. Expected: PASS, with `grid.test.js` unchanged.
- [ ] **Step 6: Commit.** `git commit -m "Fingerprint the Expanse's middle layer; grid over the shared address"`

### Task 2: Orbits on the shared clock

**Files:**
- Create: `src/components/expanse/gen/orbits.js`, `src/components/expanse/gen/orbits.test.js`

**Interfaces:**
- Produces:
  - `ORBIT_CYCLE = 65536`
  - `REV_K = 4`
  - `revsFor(orbit) → integer ≥ 1`, which is `max(1, round(REV_K · (1000 / orbit)^1.5))`
  - `spaceTime(nowMs) → nowMs / 1000`
  - `orbitAt(planet, t) → [x, y, z]`, where `planet` has `{ at, centre, revs }`
  - `moonAt(moon, planet, t) → [x, y, z]`, where `moon` has `{ orbit, phase, revs, tilt }`
  - `bodiesAt(system, t) → [{ id, kind: 'star' | 'planet' | 'moon', at, r }]`

- [ ] **Step 1: Write the failing tests.**

```js
import { describe, expect, it } from 'vitest';
import { ORBIT_CYCLE, REV_K, bodiesAt, moonAt, orbitAt, revsFor, spaceTime } from './orbits';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const planet = { id: 'E:1,0:0:0', at: [241000, 30, 5000], centre: [240000, 0, 5000], orbit: 1000, revs: revsFor(1000), radius: 40 };
const moon = { id: 'E:1,0:0:0:0', orbit: 120, phase: 1.1, revs: revsFor(120), tilt: 0.2, radius: 6 };

describe('orbitAt', () => {
  it('is where the generator put it at t = 0, and keeps its distance', () => {
    expect(len(orbitAt(planet, 0), planet.at)).toBeLessThan(1e-9);
    for (const t of [1, 1e3, 1e6, 1.7e9]) expect(len(orbitAt(planet, t), planet.centre)).toBeCloseTo(len(planet.at, planet.centre), 6);
  });
  it('goes round a whole number of times a cycle, so the end of one meets the start of the next', () => {
    expect([ORBIT_CYCLE, REV_K, revsFor(1000), revsFor(250), revsFor(2600)]).toEqual([65536, 4, 4, 32, 1]);
    expect(len(orbitAt(planet, ORBIT_CYCLE), orbitAt(planet, 0))).toBeLessThan(1e-6);
    for (const k of [1, 7, 26855]) expect(len(orbitAt(planet, k * ORBIT_CYCLE - 1e-3), orbitAt(planet, k * ORBIT_CYCLE + 1e-3))).toBeLessThan(1e-3);
  });
  it('stays smooth with the clock days or years from its epoch', () => {
    const most = (2 * Math.PI * 1000 * planet.revs) / ORBIT_CYCLE / 60;
    for (const t0 of [1.7e9, 1e10]) {
      const step = len(orbitAt(planet, t0 + 1 / 60), orbitAt(planet, t0));
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(most + 1e-6);
    }
  });
  it('carries a moon round its planet, and lists a system’s bodies where they are', () => {
    for (const t of [0, 500, 1e9]) expect(len(moonAt(moon, planet, t), orbitAt(planet, t))).toBeCloseTo(120, 6);
    const sys = { id: 'E:1,0:0', at: planet.centre, star: { size: 150 }, planets: [{ ...planet, moonList: [moon] }] };
    expect(bodiesAt(sys, 0).map((b) => [b.id, b.kind])).toEqual([['E:1,0:0', 'star'], [planet.id, 'planet'], [moon.id, 'moon']]);
  });
  it('reads the shared clock in seconds', () => expect(spaceTime(1.5e12)).toBe(1.5e9));
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/orbits.test.js`. Expected: FAIL, because the module can't be resolved.
- [ ] **Step 3: Implement.**
  - `orbitAt` rotates `r0 = at − centre` about `n = normalize(r0 × (Y × r0))` (`Y` up, so a level orbit turns about `Y`) by `θ = 2π · revs · (f − ⌊f⌋)`, where `f = t / ORBIT_CYCLE`, using Rodrigues' formula.
  - `moonAt` works the same way round `orbitAt(planet, t)`: a circle of `orbit` in a plane tilted `tilt` about x, starting at `phase`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git commit -m "Orbits on the shared clock for generated planets and moons"`

### Task 3: Keep-outs

**Files:**
- Create: `src/components/expanse/gen/keepOuts.js`, `src/components/expanse/gen/keepOuts.test.js`

**Interfaces:**
- Consumes: `PLACES` (`universe/deep.js:266`), `SECTORS`, `SECTOR_RADIUS`, `sectorOf` (`universe/layout.js`).
- Produces:
  - `HOME_KEEP = 8000`
  - `KEEP_OUTS: [{ id, at, r }]`
  - `keepOutsNear(sx, sy, sz) → KEEP_OUTS` rows whose sphere meets that sector's cube
  - `clearOfKeepOuts(at, extent, outs = KEEP_OUTS) → boolean`: true when every distance from `at` to a sphere's centre is at least `r + extent`

- [ ] **Step 1: Write the failing tests.**
  - `KEEP_OUTS[0]` is `{ id: 'home', at: [0, 0, 0], r: 8000 }`.
  - Every `PLACES` row with `kind !== 'station'` and `sectorOf(...at) === 'main'` has a row with `r === 3 * reach`.
  - One row `{ id: 'rickmorty', at: SECTORS.rickmorty.origin, r: SECTOR_RADIUS.rickmorty + 4000 }`.
  - No row for a station or for a place inside the pocket.
  - `keepOutsNear(0,0,0)` includes `home`. `keepOutsNear(0,0,-1)` includes `rickmorty`. `keepOutsNear(5,0,5)` and `keepOutsNear(0,2,0)` are `[]`.
  - `clearOfKeepOuts([0,0,8040], 50)` is false, and `clearOfKeepOuts([0,0,8100], 50)` is true.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/keepOuts.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** A sphere meets a cube when its distance to the cube's nearest point is at most `r`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Keep-outs round the hand-made places, as spheres"`

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

### Task 7: Sector keys in 3D, and the pocket as a ball

**Files:**
- Modify: `src/components/universe/layout.js:61-76` (`sectorOf`, `expanseSector`), `src/components/universe/layout.test.js`

**Interfaces:**
- Consumes: Task 0's `sectorAt`, `sectorKey`, `parseSectorKey` and `sectorCentre`.
- Produces: `sectorOf(x, y, z)`:
  - `'rickmorty'` when within `RM.edge + 1` of the pocket's origin in 3D (with `z < SECTOR_SPLIT`, as now)
  - `'main'` when in sector `0,0,0` and within the main edge on the level, as now
  - otherwise `sectorKey(...sectorAt(x, y, z))`

  `sectorById` reads 3-number keys through `parseSectorKey`. `inExpanse`, `mapSectorOf` and `sectorOut` keep their signatures.

- [ ] **Step 1: Add the failing tests** to `layout.test.js` (every existing assertion stays):
  - `sectorOf(0, 70000, 0)` is `'E:0,0,1'`, and `sectorOf(0, 50000, 0)` is `'main'`.
  - `sectorOf(0, 5000, -66000)` is `'rickmorty'`, `sectorOf(0, 6500, -66000)` is `'E:0,-1'`, and `sectorOf(4500, 4500, -66000)` is `'E:0,-1'`.
  - `sectorById('E:1,-2,3').origin` is `[120000, 360000, -240000]`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/layout.test.js src/components/universe/sector.test.js`. Expected: the new assertions FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Sectors keyed in 3D; the Rick and Morty pocket a ball"`

### Task 8: No ceiling, no floor, a round home and a round pocket

**Files:**
- Modify:
  - `src/components/universe/ship.js`:
    - `:197-226` (`homeAt`, `driveAlong`)
    - `:380-386` (`SPACE`, `OPEN_SPACE`)
    - `:445` (`space.homeAt(s.x, s.z)` becomes `(s.x, s.z, s.y)`)
    - `:494-574` (`step`'s edge, roof and pocket)
    - `:723-734` (`autopilot`'s ceiling clamp and `homeAt`)
  - `src/components/universe/deep.js:304` (`nearestPlace`'s home term)
  - `src/components/universe/curve.js:51-70` (the wall's geometry)
  - `src/components/universe/scene.js` (in place, no new lines):
    - `:1809` and `:1880`: `pilotSpace(SPACE, …)` becomes `pilotSpace(OPEN_SPACE, …)`
    - `:1833`: `frontSpace` spreads `OPEN_SPACE`
    - `:3398`: `holdReach(…, { …, space: OPEN_SPACE })`
    - `:4314`: the autopilot's fallback space is `OPEN_SPACE` instead of `undefined`
- Test: `src/components/universe/ship.test.js`, `src/components/universe/deep.test.js`, `src/components/universe/curve.test.js` (new)

**Interfaces:**
- Produces:
  - `SPACE.roof = ceilingAt`. `SPACE` is unchanged in behaviour (the authored map alone; every existing ship test).
  - `OPEN_SPACE = { ...SPACE, expanse: true, roof: null, homeAt: homeAt3, driveAlong: (x, y, z, f) => driveAlong(x, y, z, f, OPEN), driveAt: … }`
  - `homeAt3(x, z, y)`: home measured as a sphere
  - `driveAlong(x, y, z, f = null, { roof = true, round = false } = {})`: `roof: false` drops the home ceiling term at `:218-222`, and `round: true` uses `homeAt3`
  - `step` and `autopilot` turn back at, or clamp to, `space.roof(x, z)` only when `space.roof` is set
  - in the Rick and Morty sector, `step`'s turn-back and clamp use the 3D distance from its origin, a ball of `RM.edge`
  - from outside (`sec.expanse`), the pocket wall at `:558-571` pushes out along the 3D line
  - `ceilingAt` stays exported for `clearToStart` (`:336-342`) and any placement
  - `curve.js` draws the Curve as `SphereGeometry(sec.edge, 256, 64)` with the same shader: its band at the equator, the disc's height, as now. The wall is drawn where it stands.

- [ ] **Step 1: Write the failing tests.**

```js
describe('open space', () => {
  const up = (dir) => ({ ...spawn(null), pitch: dir * (Math.PI / 2 - 0.01) });
  const climb = (s0, dir) => {
    let s = s0, t = 0, edge = 0;
    while (Math.abs(s.y) < 100000 && t < 600) {
      const r = step(s, { throttle: 1, boost: true }, 1 / 20, SOLIDS, OPEN_SPACE);
      edge += r.events.filter((e) => e.type === 'edge').length;
      if (t > 1) expect(dir * (r.ship.y - s.y)).toBeGreaterThan(0);
      s = r.ship; t += 1 / 20;
    }
    return { s, t, edge };
  };
  it('has no roof, and SPACE keeps its own', () => {
    expect(OPEN_SPACE.roof).toBeNull();
    expect(SPACE.roof).toBe(ceilingAt);
  });
  it('flies 100,000 straight up from home, and straight down, never turned back, on the pulse drive', () => {
    for (const dir of [1, -1]) {
      const { s, t, edge } = climb(up(dir), dir);
      expect(edge).toBe(0);
      expect(Math.abs(s.y)).toBeGreaterThanOrEqual(100000);
      expect(t).toBeLessThan(600);
      expect(s.speed).toBeGreaterThan(SHIP.boost * 2);
    }
  });
  it('lets the autopilot climb to a park 30,000 above home', () => { /* a goal { id: 'high', at: [0, 30000, 2000], r: 10, reach: 20 } in OPEN_SPACE's goals; autopilot + step for up to 600 s: |y − 30000| < 5 */ });
  it('walls the Rick and Morty pocket as a ball, both ways, and nothing above it', () => {
    /* inside, at its middle, straight up at 40: never past RM.edge + 1e-6 from its origin in 3D, and an 'edge' event;
       outside, level at origin y + 7,000, flying across over it: no 'edge', and it crosses to the far side */
  });
});
```

  Also add:
  - In `deep.test.js`: `openness(0, 50000, 0)` is 1, and `nearestPlace(0, 50000, 0).gap` is close to `50000 − HOME_RADIUS` (within 1).
  - In `curve.test.js`: the wall's geometry is a `SphereGeometry` of radius `SECTORS.rickmorty.edge`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/ship.test.js src/components/universe/deep.test.js src/components/universe/curve.test.js src/components/universe/sector.test.js`. Expected: the new tests FAIL. `sector.test.js` passes as it is: its pocket turn-back is at y = 0.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, with every existing ship, deep, sector and pilotGoal test unchanged.
- [ ] **Step 5: Commit.** `git commit -m "No ceiling or floor anywhere in the universe; home and the pocket as spheres"`

### Task 9: The pose carries its sector in 3D

**Files:**
- Modify:
  - `src/components/universe/online/protocol.js`:
    - `:30-31` (the doc)
    - `:78` (imports: Task 0's `parseSectorKey` and `sectorCentre`)
    - `:206-247` (`writePose`, `readPose`)
    - `:264` (`readShot`'s bound)
  - `src/components/universe/online/rosterWhere.js:12-50`
- Test: `protocol.test.js`, `rosterWhere.test.js`

**Interfaces:**
- Produces:
  - **`writePose`:**
    - when `sectorOf` gives an `E:` key, x, y and z are written from that sector's centre, and the key goes at `[10]`
    - on the middle layer the key is `'E:sx,sz'` and the centre's y is 0, so an older reader reads it exactly as before
  - **`readPose`:**
    - parses `[10]` with `parseSectorKey`, accepting either case and 2 or 3 numbers
    - clamps x, y and z to `±SEC_FAR` (62,000) of the sector's centre
    - a sectorless pose clamps x and z to `±FAR` and y to `±SEC_FAR`; the ±1,300 clamp is gone
    - `sec` comes back in `sectorKey` form
  - **`readShot`:** positions are bounded by ±1e12. The `from` check already holds a shot to its pilot. This fixes other pilots' shots past 90,000 being dropped.
  - **`rosterWhere`:** names the nearest system of `fullSector(SHARED, …parseSectorKey(sec), { things: false })` by 3D distance, within 12,000, keeping 16 sectors.

- [ ] **Step 1: Write the failing tests.**
  - **Replace** `protocol.test.js:174`'s `toBe(1300)` with `toBe(62000)`. The spec removes the clamp; say so in the PR.
  - **Add:**
    - `writePose({ ...ship, x: 185184.78, y: 70000, z: -121500 })[10]` is `'E:2,-1,1'`, with `[1]` close to `-50000`. Reading it back gives `y` close to `70000` and `sec` of `'E:2,-1,1'`.
    - A sectorless pose at y = 50,000 round-trips to 50,000 with no `sec`.
    - An older build's `[1, 2, 3, 0, 0, 0, 5, 0, 2, 100, 'E:2,-1']` reads `x: 240001, y: 2, z: -119997`, as today.
    - `'E:1,0,x'` and `'X:1,0'` read as no sector.
    - `readShot([500000, 0, 0, 1, 0, 0], { x: 500000, y: 0, z: 0, speed: 0 })` reads. A shot 1,000 from that pose doesn't.
  - **Add to `rosterWhere.test.js`:** a pose with `sec: 'E:1,0,1'` at the first system of `fullSector(SHARED, 1, 1, 0)` plus 50 names that system.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/online`. Expected: the new and replaced tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Poses carry their sector in 3D; the height clamp goes; old poses read as before"`
- [ ] **Step 6: Run PR 2.2's gate.** Run `node scripts/online-check.mjs --fake` and `node scripts/navmap-check.mjs` (expected: as on `main`). Open PR "Endless universe 2.2: no ceilings, and poses in 3D" and merge.

---

## PR 2.3: Camera-relative always

### Task 10: `relative.js`, and the precision test

**Files:**
- Create: `src/components/universe/relative.js`, `src/components/universe/relative.test.js`
- Modify: `src/components/universe/scene.js:1457-1494`. The `DRAW_FAR`/`drawn`/`lens`/`FAR`/`reach` block moves out and is replaced by a destructure of `createRelativeDraw`. `:537-538`'s `drawAt` goes with it.

**Interfaces:**
- Produces: `createRelativeDraw({ camera, map, scene }) → { drawn(draw), lens(near), reach(far), FAR }`.
  - `drawn` always moves `map` by `−camera.position` and the camera to nought for the draw.
  - Afterwards it restores both and runs `scene.updateMatrixWorld()`, as today.
  - `lens`, `reach` and `FAR` are today's.

- [ ] **Step 1: Write the failing tests.**

```js
const H = 1080, FOV = 34; // (flight.js's FOV)
const f32 = (m) => Float32Array.from(m.elements);
// a point the way the chip sees it: the shader's world position and the camera's, in 32 bits
const shaderView = (obj, cam, p) => {
  const w = new THREE.Vector3(...p).applyMatrix4(new THREE.Matrix4().fromArray(f32(obj.matrixWorld)));
  const c = cam.getWorldPosition(new THREE.Vector3());
  return [Math.fround(w.x) - Math.fround(c.x), Math.fround(w.y) - Math.fround(c.y), Math.fround(w.z) - Math.fround(c.z)];
};
const pxAngle = (a, b) => Math.acos(Math.min(1, dot(unit(a), unit(b)))) / ((FOV * Math.PI) / 180 / H);

it('draws a body 10^9 out within a pixel of where it is', () => {
  /* map > mesh at [1e9, 2e8, -7e8]; camera 120 behind it, looking at it;
     inside drawn(): pxAngle(shaderView(mesh, camera, [0, 0, 0]), true offset) < 1,
     and the 32-bit projection of the mesh's centre lands within 1 px of the 64-bit one */
});
it('would not without it', () => { /* the same, map unmoved: pxAngle > 1 */ });
it('puts everything back after the draw, exactly', () => { /* map.position and camera.position as before, to the bit */ });
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/relative.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Move the block, drop its `DRAW_FAR` condition, and wire `scene.js`. Count the lines.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Draw the universe camera-relative every frame"`

### Task 11: World positions set inside the draw

**Files:**
- Modify: `src/components/galaxy/bodies.js:451-458` and `:517-522`, where `uCenter` and `uRot` are set in `update()`, before `drawn()` shifts the map. `bodyShaders.js:695-726` reads them against `cameraPosition`, so Expanse planets' air is drawn wrong past 3,000 today.
- Modify: any further setter the audit finds.
- Test: `src/components/galaxy/bodies.test.js`

**Interfaces:**
- Produces: `buildBody`'s surface (small or not) sets `shared.uCenter` and `shared.uRot` in `onBeforeRender`, from `group.matrixWorld` at draw time. It keeps the octave easing. The galaxy's picture is unchanged, because it never shifts.

- [ ] **Step 1: Write the failing test.** With `buildBody('hoth', { r: 40 })` under a parent shifted by `[-1e6, 0, 0]` after `update(0, camera)`, calling `surface.onBeforeRender(stubRenderer, scene, camera)` sets `uCenter` to the shifted world position. `stubRenderer` is `{ getDrawingBufferSize: (v) => v.set(1920, 1080) }`.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/galaxy/bodies.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement, then audit.** Run `rg -n "getWorldPosition|setFromMatrixPosition|cameraPosition|uCam\\b" src/components/universe src/components/galaxy/bodies.js src/lib/three --glob '!*.test.js'`. For each uniform holding a world position that is set outside the draw, and drawn within 3,000 of home (where `drawn()` is new), move the set into that mesh's `onBeforeRender`.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/galaxy src/components/universe`. Expected: PASS. Commit: `git commit -m "Bodies set their world position in the draw, so they're right camera-relative"`.
- [ ] **Step 5: Check that no pixel changes.**
  - Run `node scripts/universe-check.mjs --quality all --out lab/universe/after-2.3/<tier>` and compare with `before-2.3` using `scripts/pixel-measure.mjs`. Expected:
    - identical shots at `overview`, `falcon-sun`, `belt`, `station` and `far-rim` (new to the shift)
    - identical at the rest
    - calls and triangles equal
  - Run `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …` before and after. Expected: p50 frame no worse than 2%. Say the numbers.
- [ ] **Step 6: Run PR 2.3's gate**, open the PR with the numbers and the no-log-depth decision, and merge.

---

## PR 2.4: Levels of detail on today's Expanse

The Expanse still sleeps inside the rim in this PR and draws `makeSector` sectors through `addBodies`. So the ten core poses are unchanged by construction, and everything new is checked past the rim.

### Task 12: The budget table

**Files:**
- Create: `src/components/universe/budget.js`, `src/components/universe/budget.test.js`

**Interfaces:**
- Produces: `BUDGET: { low, mid, high, ultra }` and `universeBudget({ tier, detail }, step = 0, floor = false) → row`. Ultra applies when `detail === 'ultra'`, and any tier it doesn't know reads as mid. A row:

| Field | low | mid | high | ultra | Read by |
|---|---|---|---|---|---|
| `systemsBuilt` | 1 | 1 | 2 | 3 | lane 2 |
| `discs` | 400 | 1200 | 2500 | 4000 | lane 2 |
| `slotSize` | 400 | 400 | 400 | 400 | lane 2 |
| `nearSlots` | 64 | 64 | 64 | 64 | lane 2 |
| `beyondRings` | 1 | 1 | 2 | 2 | lane 2 |
| `thingsNear` | 16 | 32 | 64 | 96 | lane 2, 4a |
| `thingKinds` | {} | {} | {} | {} | 4a (a share of `discs` by kind) |
| `workers` | 1 | 2 | 3 | 4 | lane 2 |
| `expanseMs` | 1 | 1.5 | 2 | 2 | lane 2 |
| `traffic` | 2 | 4 | 6 | 8 | 4b |
| `events` | 1 | 2 | 3 | 3 | 4b |
| `nebula` | {res 0.25, steps 16} | {0.5, 32} | {0.5, 48} | {1, 64} | lane 1 |
| `gargantuan` | 'low' | 'mid' | 'high' | 'high' | 4a |
| `planetMap` | [256,128] | [256,128] | [512,256] | [512,256] | 5a, 5b |

  Steps 0 to 3 multiply `discs`, `thingsNear` and `traffic` by `[1, 0.75, 0.5, 0.35]`, rounded. `floor` multiplies them by 0.25. Step 2 and up takes one from `beyondRings` (never below 0) and halves `nebula.steps`. `systemsBuilt` never goes below 1.

- [ ] **Step 1: Write the failing tests.**
  - The table as above.
  - Every numeric field is non-decreasing from low through ultra.
  - The device read: `universeBudget({ tier: 'high', detail: 'ultra' })` gives ultra's row, and `({ tier: 'nonsense' })` gives mid's.
  - No step or floor raises any count, and `systemsBuilt` stays at least 1.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/budget.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "One budget table for the endless universe, by tier and quality step"`

### Task 13: The levels of detail

**Files:**
- Create: `src/components/expanse/scene/levels.js`, `src/components/expanse/scene/levels.test.js`

**Interfaces:**
- Produces:
  - `FAR = 45000` (`scene.js:490`'s far plane) and `FADE = 0.2` (farStars')
  - `levelWeights(dist, { reach, far = FAR }) → { full, disc, speck }`, summing to 1:
    - `full = 1 − smoothstep(reach·(1−FADE), reach, dist)`
    - `disc = (1 − full)·(1 − smoothstep(far·(1−FADE), far, dist))`
  - `discPx(dist, r, { fovY, height }) → px across`: `2r / (2·dist·tan(fovY/2)) · height`
  - `speckBright(dist, r) → 0.06 … 1`: `(4·realAt(r)/dist)²`, clamped
  - `beyondFade(dist, edge) → 1 − smoothstep(0.8·edge, edge, dist)`
- The levels are the spec's table:
  - within a body's reach: built in full
  - within the far plane: a disc of its true size
  - beyond the far plane, inside the 3 × 3 × 3: a speck (stars)
  - past the 3 × 3 × 3: beyond rings that fade to nothing at their edge

- [ ] **Step 1: Write the failing tests.**
  - With reach 2,600: at 1,000 `full` is 1, at 10,000 `disc` is 1, and at 50,000 `speck` is 1.
  - Sweeping `dist` from 0 to 60,000 in steps of 5, for reach in `[300, 2600]`, every weight changes by at most 0.01 a step and the sum is 1 to 1e-12.
  - At 900 units a second and 60 frames a second (15 units a frame), for r in `[15, 420]`, `|Δdisc| · discPx(dist, r, { fovY: 34°, height: 1080 })` is at most 4 at every distance (the spec's 4 px).
  - `discPx(10000, 100, …)` matches the formula.
  - `beyondFade(edge)` is 0 and `beyondFade(0.8·edge)` is 1.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/scene/levels.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Levels of detail for generated space, fading, never popping"`

### Task 14: The far layer: farStars' one `Points` takes generated specks and discs

**Files:**
- Modify: `src/components/universe/farStars.js:65-200`
- Test: `src/components/universe/farStars.test.js` (extend)

**Interfaces:**
- Consumes: `levels.js`.
- Produces: `createFarStars(parent, { places, skyFar, slots = [], discs = 0 })` returns today's `{ points, update, kOf, dispose }` plus:
  - `setSlot(i, { centre: [x, y, z], at: Float32Array, color: Uint8Array, r: Float32Array, count })`: uploads only that slot's range (`addUpdateRange`), and the slot stays hidden
  - `showSlots(list)` and `hideSlots(list)`: flip in one call, so a swap happens in one frame
  - `fadeSlot(i, seconds)`
  - `discs`: `{ begin(), push(x, y, z, r, cr, cg, cb, lx, ly, lz, alpha), end() }`. It allocates nothing a frame, sorts far to near, caps at capacity, and writes positions from the camera.
  - `pops() → { count, px }` (dev): the largest disc or slot that went from alpha 0 to over 0.5 in one frame
- How it draws:
  - **One geometry, one draw:** hand-made places, then discs, then slots.
  - **The hand-made path** keeps today's CPU rules, but writes positions relative to the camera and sits the `Points` at the camera (map-local). In-map positions are unchanged and precise at 10^9.
  - **Slot vertices are placed on the chip:** `uSlot[i] = (centre − camera, alpha)`, worked out in doubles each `update`, plus `aAt`. Specks use `speckBright` and today's `starPx` and sky placement.
  - **Blending is premultiplied** (`CustomBlending`, `One`, `OneMinusSrcAlpha`). Specks write alpha 0 (additive, as today) and discs write alpha 1 over (a dark rock shows).
  - **The GLSL takes its constants from the JS ones**, interpolated, so it can't drift from them.

- [ ] **Step 1: Write the failing tests** (Node, three):
  - **Hand-made places:**
    - after `update(camera)`, `points.position` equals the camera's map-local position
    - each place's attribute plus that equals today's sky point (to 1e-3)
    - `kOf` values are unchanged
    - groups are hidden as today
  - **One draw:** after `setSlot`, `showSlots` and `discs.end()`, `parent.children` holds one far-layer `Points`.
  - **Slots:** `setSlot(3, …)` sets `uSlot[3].w` to 0 and adds one update range of exactly that slot. `showSlots([3, 4])` and `hideSlots([1])` flip in the same call.
  - **Discs:** `discs` sorts far to near and drops the nearest past capacity. The material's blend factors are as above. `vertexShader` includes `String(REAL_REACHES)` and the `FADE` value.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/farStars.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, with the existing farStars tests unchanged.
- [ ] **Step 5: Commit.** `git commit -m "farStars draws generated specks and discs in its one draw"`

### Task 15: Discs: stars, planets and wonders within the far plane

**Files:**
- Create: `src/components/expanse/scene/discs.js`, `src/components/expanse/scene/discs.test.js`

**Interfaces:**
- Consumes: `orbitAt`, `levels.js`, and the far layer's `discs` writer.
- Produces:
  - `pickDiscs(xyzr: Float64Array, n, cam: [x, y, z], { far, max }) → Int32Array`: indices within `far + r`, nearest `max` kept, ordered far to near
  - `createDiscs(far, { budget })` with `feed(sectors, cam, t, camera)`:
    - every frame, gathers stars (emissive), planets (at `orbitAt(p, t)`, lit from their star) and legacy non-nebula wonders (`sectors.js`'s `WONDER` look)
    - picks them, and pushes each with `alpha = levelWeights(dist, { reach }).disc`
    - a planet's `reach` is its radius × 3, and a system's is `systemReach`

- [ ] **Step 1: Write the failing tests.** `pickDiscs` keeps the nearest `max`, drops anything past `far + r`, orders far to near, and breaks ties by index. Feeding a hand-made two-system sector (the shape of `sectors.test.js`' `HAND`, run through `addBodies`) at a camera 10,000 from system A pushes A's star and planets with alpha 1, and system B 40,000 off with alpha between 0 and 1.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/scene/discs.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Generated stars, planets and wonders as discs of their true size within the far plane"`

### Task 16: The nearest systems built in full

**Files:**
- Create: `src/components/expanse/scene/near.js`, `src/components/expanse/scene/near.test.js`
- Modify:
  - `src/components/expanse/scene/sectors.js`:
    - keep `nebula()` and its call
    - the stars at `:137-145`, the per-sector `createFarStars` at `:160-167` and the planets at `:169-214` go: stars into its slot of the far layer (Task 14), planets into `near.js`
    - the wonder balls stay, shown within `realAt` as now
  - `src/components/expanse/scene/sectors.test.js`: replace the star-mesh, specks and planets tests with slot and near tests; list them in the PR.
  - `src/components/expanse/scene/expanse.js:49-157`:
    - takes `far`, `budget`, `prepare` and `now` (wall ms for `spaceTime`)
    - sets each loaded sector's slot (stars and wonders) from `addBodies(makeSector(...))`
    - feeds discs and `near`
    - still sleeps inside the rim, for one more PR

**Interfaces:**
- Produces: `createNear(group, { budget, tier, build = buildBody, prepare }) → { update(systems, cam, t, camera), built() → ids, stars() → [{ id, at, r, colour, strength, reach }], solids() → [{ id, at, r, reach }], setStep(step), dispose() }`.
  - It builds the `budget.systemsBuilt` nearest systems whose reach holds the camera, and lets one go past 1.3 × its reach.
  - Each built system has:
    - a star (`BALL`, emissive, its colour), whose entry in `stars()` has strength by class (O to G 0.9, K and M 0.7, white dwarf and neutron 0.4) and reach `systemReach × 3`
    - planets (`buildBody(TYPE_LOOK[type], { r, tier })`) at `orbitAt`, with `setSuns` from their star
    - moons (`buildBody(type === 'icy' ? 'hoth' : 'moon-grey', { r, small: true })`) at `moonAt`
    - a ring for each `ringBand`: a `RingGeometry` with a banded `ShaderMaterial` seeded from the planet's seed, no texture, in the planet's orbit plane
  - Every new mesh goes through `prepare(o)` (the scene's `warm()`, `scene.js:936`) before it's shown.

- [ ] **Step 1: Write the failing tests** with a fake `build` (Node, three):
  - With the camera outside every reach, nothing is built.
  - Inside system A's reach, A is built: 1 star, its planets, its moons and a ring per `ringBand`.
  - Planets sit at `orbitAt(p, t)` for t = 0 and t = 1,000. Moons sit at `moonAt`.
  - `stars()` holds A's entry, and `solids()` holds A's star, planets and moons with `at` updated in place each `update`.
  - Moving to 1.2 × reach keeps A. At 1.4 × it lets A go and disposes it.
  - With `systemsBuilt: 2` and two reaches overlapping the camera, both are built.
  - `prepare` is called once for each new mesh.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/scene`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The nearest generated systems built whole: star and light, planets on their orbits, moons and rings"`

### Task 17: Solids, light and wiring; PR 2.4's checks

**Files:**
- Modify: `src/components/expanse/scene/expanse.js` (`solids()`, `stars()`, `setStep()`, and `pops()`, the far layer's, for the dev hooks), `src/components/expanse/scene/expanse.test.js` (add to it)
- Modify `scene.js`, in place:
  - `:745` (`farStars`) goes above `:734` and gains `slots` and `discs` from the budget
  - `:734-743` passes `far: farStars`, `budget: universeBudget(device(), 0)` and `prepare: (o) => warm(o)`
  - `:4945`: `lightAt(…, { nova, stars: expanse.stars() })`
  - `:4350`: `solidsWith(…, moving, expanse.solids())`
  - `:4314`: the autopilot's `moving` is `solidsWith(moving, expanse.solids())`
  - `paceTo` (about `:4980`) gains `expanse.setStep(at.step, at.floor)` (+1 line)
  - `:5266`: `expanse.update({ …, now: state.held || reduced ? 0 : Date.now() })`, which pins orbits at t = 0 for poses and reduced motion
- Move out: `orbits()` (`scene.js:284-303`) to `src/components/universe/stationOrbits.js`, same name (−20).
- Test: `src/components/universe/ship.test.js` (add)

**Interfaces:**
- Produces:
  - `expanse.stars()`: lighting's `STARS` plus the built stars, in one array reused every frame
  - `expanse.solids()`: the built bodies, in one array reused every frame

- [ ] **Step 1: Write the failing test.** A ship at a generated planet's `orbitAt` plus `radius + 10`, flying into it at 2 and then at 40 under `OPEN_SPACE` with `solidsWith(SOLIDS, solids)`, bumps and then crashes. The crash event's `id` is the planet's `E:` id, and the ship never ends inside it.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/ship.test.js src/components/expanse/scene`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`. Expected: PASS. Commit: `git commit -m "Generated bodies solid and lit by their own star; levels of detail wired"`.
- [ ] **Step 5: Run PR 2.4's checks.**
  - **Baseline poses.** Run `node scripts/universe-check.mjs --quality all --out lab/universe/after-2.4/<tier>`. Expected:
    - the ten poses identical to `before-2.4`, since the core is unchanged
    - calls and triangles equal
  - **Past the rim.** Shoot, before and after, a generated system and its first planet (`travel('e:1,0:0:0')` through `__universeDebug.travel`). Expected:
    - the planet moves between two shots 60 s apart
    - a moon and a ring are drawn where `moonList`/`ringBand` say
    - flying in from 40,000, nothing pops (`__universeDebug.expanse.pops().px ≤ 4`)
    - no console errors
  - **Crash.** Force one into that planet with the dev hook. Expected: the crash plays, the ship comes back, and nothing navigates.
- [ ] **Step 6: Run PR 2.4's gate**, then open the PR with the `scene.js` line counts (before and after) and merge.

---

## PR 2.5: One space everywhere

### Task 18: The chunk grid in 3D

**Files:**
- Create: `src/runtime/chunkGrid3.js`, `src/runtime/chunkGrid3.test.js` (`chunkGrid.js` is untouched: `flight/life.js` uses it)

**Interfaces:**
- Produces: `createChunkGrid3({ size, radius, inFlight, hysteresis = 1 }) → { cellOf(x, y, z), cells(x, y, z, { radius, heading }), update({ x, y, z, heading: [hx, hy, hz] | null, radius }) → { ask, drop, cancel }, began, done, failed, unload, reset, loaded, flying, gen, radius, size }`. Keys are `'cx,cy,cz'`. Ordering is nearest first (d²), then most along the heading, then a fixed tiebreak. Drops happen past Chebyshev `radius + hysteresis`.

- [ ] **Step 1: Write the failing tests** (mirroring `chunkGrid.test.js`):
  - `cellOf` handles negatives.
  - Radius 1 asks 27 cells, centre first, then the 6 faces.
  - Ties go toward a heading of `[0, 1, 0]`, so `'0,1,0'` comes before `'0,-1,0'`.
  - `inFlight` caps asks.
  - With hysteresis, nothing is dropped until Chebyshev 3.
  - Sitting on a face (x moving between `size − 0.5` and `size + 0.5`, 100 times) asks and drops nothing after the first settle.
  - `done` with an old `gen` is refused.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/runtime/chunkGrid3.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "A chunk grid in three dimensions"`

### Task 19: Sectors made in the worker pool; the starfield from it too

**Files:**
- Create: `src/components/expanse/gen/job.js`, `src/components/expanse/gen/job.test.js`, `src/components/expanse/scene/sector.worker.js` (thin: `self.onmessage → postMessage(answer, transfer)`)
- Modify: `src/components/expanse/scene/starfield.js` and `starfield.test.js`. `beyondPlaces` and `createStarfield` (2D, synchronous `makeSector`, `:25-39` and `:41-85`) are replaced by pure `beyondKeys`. List the replaced tests in the PR.

**Interfaces:**
- Produces:
  - `sectorJob({ type: 'sector', key, universe: bigint, sx, sy, sz }) → { answer: { key, sector, stars }, transfer }`
    - `sector` is `fullSector` without `moonList` on the wire
    - `stars` is `{ at: Float32Array (from the sector's origin), color: Uint8Array, r: Float32Array, count }` for every system and legacy wonder
  - `beyondJob({ type: 'beyond', key, universe, centre: [sx, sy, sz], ring }, cache = new Map()) → { answer: { key, centre, stars }, transfer }`: every system of the sectors at Chebyshev `ring + 1` from `centre`, from that centre's origin, with sectors made once and kept in `cache` (LRU 400)
  - `beyondKeys(centre, ring) → [[sx, sy, sz]…]`: 98 for ring 1, 218 for ring 2, the core included
  - `withMoons(sector)`: puts `moonList` back on the main thread as a lazy, memoised getter over `moonsOf`
  - The worker answers `'sector'` on pool name `expanse` (size `budget.workers`) and `'beyond'` on `expanse-beyond` (size 1, so its cache works)

- [ ] **Step 1: Write the failing tests.**
  - `sectorJob` for `E:1,0` with `UNIVERSE`, run through `withMoons`, deep-equals `fullSector(UNIVERSE, 1, 0, 0)`.
  - `transfer` lists every typed array's buffer, and `stars.count` is `systems + wonders`.
  - The same job with `universeOf('word')` (a pocket universe) deep-equals that universe's `fullSector`.
  - `beyondKeys` counts as above, with no centre and no Chebyshev-1 cell.
  - `beyondJob` with an injected maker counts makes. A second call one sector over makes only the new face: 49 or fewer for ring 1.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/job.test.js src/components/expanse/scene/starfield.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Sectors and the starfield beyond made in the worker pool"`

### Task 20: The Expanse in 3D, everywhere, with no rim

**Files:**
- Modify: `src/components/expanse/scene/expanse.js` (rewrite), `src/components/expanse/scene/expanse.test.js`. Replace the rim, origin and 3 × 3 tests at `:25-79` with the tests below and list them in the PR.

**Interfaces:**
- Consumes: Tasks 12–19.
- Produces: `createExpanse(parent, { universe, tier, reduced, workers, far, budget, prepare, onSector, drawers = {} }) → { root, update({ ship, camera, t, dt, now }), loaded(), sector(), sectors() → Map<key, Sector>, nearestSystem(at) → { system, sector, dist } | null, stars(), solids(), setStep(step, floor), pops(), workMs(), reload(key), dispose() }`.
  - **No `activeAt`, no `origin` and no `onShift`.** The root stays at nought, under `map`.
  - **Loading.** A `createChunkGrid3({ size: SECTOR, radius: 1, inFlight: budget.workers })` asks the pool for `sectorJob`s, nearest and ahead first, with the 3D nose as heading. Answers arrive on a promise and are applied one a frame within `budget.expanseMs`.
  - **Beyond rings** are asked per ring, nearest first, and land in A/B slots.
  - **Swapping centre.** When the ship's sector changes, the new near slots and beyond rings are staged hidden. The far layer swaps in one `showSlots`/`hideSlots` call once all are in. Until then the old ones draw. A place with no predecessor (the first load, or after a jump) fades in over 0.5 s.
  - **Dropping.** A dropped key's job is cancelled (`workers.cancel`) and its slot hidden.

- [ ] **Step 1: Write the failing tests** with a fake pool. The fake runs `sectorJob`/`beyondJob` in process and resolves on a later microtask, or late on demand.
  - At home, `(0, 0, 0)`, it loads `E:0,0` and its 26 neighbours, including `E:0,0,1` and `E:0,0,-1`, with at most `budget.workers` in flight.
  - Flying from `RIM.inner − 1000` to `RIM.outer + 1000` drops and asks nothing new.
  - Crossing the face at x = 60,000: the new keys are asked, the swap happens in a single update after the last of them lands, and no update shows both centres or neither.
  - A jump to `x = 1.2e8`: answers arriving late for the old keys are refused (no `setSlot`), and nothing from before is loaded once the new place is in.
  - Sitting on the face for 300 frames asks each key once.
  - `dispose` cancels everything in flight, hides every slot and empties `root`.
  - `root.position` is always `[0, 0, 0]`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/scene/expanse.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The Expanse everywhere in 3D: no rim, no origin, made off the main thread"`

### Task 21: Things drawn, and the drawers hook

**Files:**
- Create: `src/components/expanse/scene/nearThings.js`, `src/components/expanse/scene/nearThings.test.js`
- Modify:
  - `src/components/expanse/scene/discs.js` (lattice things and extras as discs, by their kind's `look`)
  - `src/components/expanse/scene/sectors.js` (the wonder balls move to `nearThings`, leaving only the nebula call)
  - `expanse.js` (`solids()` gains near things)

**Interfaces:**
- Produces:
  - `pickNear(sectors, cam, { max }) → [{ id, kind, at, size, look }]`: lattice things, extras and legacy wonders within `THING_NEAR × size`, nearest `max` (`budget.thingsNear`)
  - `createNearThings(group, { drawers, prepare }) → { update(rows, camera, t), solids(), dispose() }`
    - a kind with an entry in `drawers` gets `drawers[kind](group, ctx) → { update(rows, camera, t), dispose() }` and its rows
    - every other kind is one `InstancedMesh` of `BALL` per look, with `visible = false` at 0 instances, so it costs no draw call
    - this is lane 4a's hook: it passes `drawers` from `universe/things/` and edits only `THING_KINDS`/`SECTOR_EXTRAS`

- [ ] **Step 1: Write the failing tests.**
  - `pickNear` honours `max` and the distance rule.
  - A kind with a drawer receives exactly its rows and no ball.
  - No rows means no visible mesh.
  - `solids()` lists each near thing as `{ id, at, r: size, reach: size * 1.2 }`.
  - Discs carry a lattice thing within the far plane with its `look.color`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/scene`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Things in space drawn as discs and near meshes, with a hook for each kind"`

### Task 22: Wiring, poses, the endless check, numbers and the hand-off

**Files:**
- Modify `scene.js`:
  - `:731-733`: `runtime().origin` and `reset()` go (−2). `rt.origin` stays for `/fly`.
  - `:734`: add `workers: ctx.rt.workers` (in place).
  - The `__universeDebug` object at `:5802` gains `teleport: (x, y, z, heading, pitch) => …`, on its existing line.
- Modify: `src/components/universe/poses.js:20-46` (add `'old-rim'`: the ship at `RIM.outer + 500` on +x, heading out; `'above-core'`: `[0, 50000, 0]`, heading 0; `'expanse-system'`: parked off `e:1,0:0:0` at t = 0)
- Modify: `scripts/universe-check.mjs:31` (the three names added)
- Create: `scripts/universe-endless-check.mjs`
- Modify: `docs/superpowers/HANDOFF-universe.md` ("Landed" and "Left")
- Test: `src/components/universe/poses.test.js` (add)

**Interfaces:**
- Produces: `scripts/universe-endless-check.mjs [--quality mid|low] [--url]`, which later lanes extend.
  - It waits on conditions, never times.
  - Its steps are named `start`, `old-rim`, `boundary`, `system` and `climb`.
  - Each step records:
    - `pops` (`expanse.pops()`)
    - `workMs` against `budget.expanseMs`
    - calls and triangles
    - the things within 9,000 and the distance to the nearest (from `expanse.sectors()` and `PLACES`)
    - console errors
  - It exits 1 on any pop over 4 px, `workMs` over budget, an error, or a step that never arrives.

- [ ] **Step 1: Write the failing test.** `poseFor('above-core').at` is `[0, 50000, 0]`. `poseFor('old-rim').at[0]` is `RIM.outer + 500`. `poseFor('expanse-system').at` is within `systemReach` of `E:1,0:0`.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/poses.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement the poses, wiring and script.** The script's steps:
  1. `start`: the default start with a ship.
  2. `old-rim`: `teleport` to `RIM.inner − 1000` and fly on the pulse drive past `RIM.outer + 1000`.
  3. `boundary`: `teleport` to x = 59,000 and fly past 61,000, waiting until `loaded()` holds the new face.
  4. `system`: `teleport` to the reach of `nearestSystem`'s system and fly in, waiting until `expanse.stars()` holds its star (it's built).
  5. `climb`: from home, pitched up; `teleport` 5,000 higher every few frames to y = 50,000, checking no `edge` event and y never pushed down.
  6. **Pop check at a held pose:** at `boundary`, call `reload(neighbourKey)`. The diff of two frames before and after has no blob over 4 px.
- [ ] **Step 4: Run it and see it pass.** Run `npx vitest run src/components/universe/poses.test.js`, then `node scripts/universe-endless-check.mjs --quality mid` and `--quality low`. Expected: PASS, exit 0, with the per-step table printed. Commit: `git commit -m "One space everywhere: wired, posed and checked from start to 50,000 up"`.
- [ ] **Step 5: Run the checks and record the numbers.**
  - **Baseline poses.** Run `node scripts/universe-check.mjs --quality all --out lab/universe/after-2.5/<tier>`. Expected: calls and triangles at every one of `before-2.5`'s poses no higher. Generated content in the core is far-layer `Points` only, since keep-outs keep every build away from the poses.
  - **If a pose gains a call:** if it comes from a legacy nebula's `Points`, name the pose and number in the PR and hand it to lane 1's batching (don't add a fade to lines lane 1 is replacing). Anything else is a bug to fix here.
  - **New poses.** Record `old-rim`, `above-core` and `expanse-system` with `--poses old-rim,above-core,expanse-system --out lab/universe/endless/<tier>`. These become their baseline.
  - **Frame time.** Run `QUALITY=mid` and `QUALITY=low node scripts/perf-probe.mjs universe` before and after. Expected: p50 no worse, and no hitch at the boundary step.
  - **The repo's own checks:** `universe-check`, `landing-check.mjs`, `navmap-check.mjs` (as on `main`), and `autopilot-check.mjs --only smoke` on `/universe` and `/fly`.
- [ ] **Step 6: Update the hand-off.** In `HANDOFF-universe.md`, under "Landed", add:
  - lane 2's modules and their interfaces, by path
  - the poses
  - the endless check

  Under "Left", add what didn't finish.
- [ ] **Step 7: Commit the hand-off** (`git commit -m "Hand-off: lane 2, one space"`). Run PR 2.5's gate, open the PR with the `scene.js` counts, and merge.

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `fullSector`, `placeOf`, `addBodies`, `moonsOf`, `ringBandOf`, `systemReach` | `expanse/gen/space.js`, `systems.js` | 3 (resolver), 4a, 5a, 5b, 6b |
| System rows (today's fields plus `reach`), planet rows (plus `centre`, `revs`, `moonList`, `ringBand`), moon rows | Tasks 4, 6 | 3, 5a, 5b, 6b |
| `THING_KINDS`, `SECTOR_EXTRAS`, `ThingSet`, `thingRow`, `thingSeed`, `THING_BASE` | `expanse/gen/things.js` | 4a |
| `orbitAt`, `moonAt`, `bodiesAt`, `spaceTime`, `ORBIT_CYCLE` | `expanse/gen/orbits.js` | 3 (park on a moving planet), 4a (comets), 4b, 5b |
| `KEEP_OUTS`, `keepOutsNear`, `clearOfKeepOuts` | `expanse/gen/keepOuts.js` | 4a, 4c |
| `universeBudget`, `BUDGET` | `universe/budget.js` | 1, 4a, 4b, 5a, 5b |
| `levelWeights`, `discPx`, `FAR`, `FADE` | `expanse/scene/levels.js` | 4a |
| `createExpanse(…).sectors()`, `nearestSystem()`, `stars()`, `solids()`, `drawers` | `expanse/scene/expanse.js` | 3, 4a, 4b, 6b |
| `OPEN_SPACE` (no roof), `layout.sectorOf` in 3D, the pose with `sy` | `ship.js`, `layout.js`, `protocol.js` | 3, 4b, 6a, 6b |

## Findings for the coordinator (spec against code)

1. **Additive generation conflicts with "the `MAP_RADIUS + 4,000` keep-out goes".** The legacy pass must keep that keep-out (`sector.js:160-166`), because it is what placed today's systems. The band is filled by the appended pass instead.
2. **"No turn-back anywhere" conflicts with the Rick and Morty pocket "as today", "in through its portal".** The pocket keeps its wall, now a ball drawn by the Curve. It is the one wall left.
3. **Spec'd removals that today's tests pin:**
   - the rim and the origin (`expanse.test.js:25-79`)
   - the 2D starfield (`starfield.test.js`)
   - the per-sector star meshes (`sectors.test.js`)
   - the 1,300 clamp (`protocol.test.js:174`)

   Each is replaced with a test of its successor, not loosened.
4. **When lanes 5a and 5b move `flight/planets.js` to `placeOf`,** `planets.test.js`'s `planetSpecOf('e:1,0:99:0')` becomes a real planet. That assertion must move to an index past the sector's count.
5. **Today, `bodies.js` sets `uCenter` before `drawn()` shifts,** so generated planets' air is wrong past 3,000. This is fixed in 2.3.
6. **Legacy generated nebulae in view of a core pose** would add one call each with today's `Points`. Lane 1's renderer should batch them.
7. **Lane 4b:**
   - hunters and NPCs may still clamp heights (`hunterRules.js:240`)
   - `protocol.js`'s `readPack` still bounds hunters to ±90,000
