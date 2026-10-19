# Endless universe, lane 5a: unique planets, the pure half. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every generated planet and moon that isn’t one of the 50 roster planets gets its own palette, terrain, sky, weather, flora, fauna and places, and a round ground on its sphere that the flight flies through a chart. An orbit map is baked from that same ground. The 50 roster planets stay byte for byte as they are.

**Architecture:** `planetSpecOf` stays the one description. Roster ids take today’s path untouched. Every other planet or moon goes through a new `generated.js`, which reads a per-planet variety (`variety.js`) and a round ground (`sphereField.js` over `characters.js`: FastNoiseLite’s 3D noise of the direction). The flight’s `planetField(spec)` keeps its `(x, z)` signature; for a round spec it samples the sphere through an exponential-map chart round the landing spot (`sphere.js`). `orbitMap.js` bakes an equirectangular map with the same sampler, and a worker plus an in-memory cache (`orbitMaps.js`) serves it to lane 5b.

**Tech Stack:** Plain ES modules; FastNoiseLite 1.1.1 (3D, only through `fnl.js`); Vitest; `src/runtime/workers.js`; sharp (devDependency, `docs/stack/assets-pipeline.md`), for the contact-sheet script only.

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is section E up to (not including) “Landing”, plus done item 6’s uniqueness and orbit-matches-ground. Background: `2026-10-09-planet-flight-and-shared-world-design.md` and `2026-10-10-planet-flight-removable-island-design.md`.

**Depends on:** the index plan’s Task 0, `src/lib/space/address.js` (`parseSpaceId`, `spaceId` and the rest). Consume it and don’t redefine it. Lane 2 owns the moons’ rows and the 3D generator; Task 5 leaves a seam for them.

## Global Constraints

- **The 50 roster planets don’t move.** That’s the galaxy’s 17, Rick and Morty’s 10, the fandoms’ 10 and the 13 seeded Expanse planets.
  - Their 17 existing spec fields, their ground heights, their life and their clutter kits hash to Task 1’s `ROSTER_LOCK` from Task 1 to the end.
  - The new fields are added beside the old ones, at the fixed values in `ROSTER_EXTRA`.
- **`TERRAIN_VERSION` stays 2.** `planetSpec.test.js`’s `GROUND` hash doesn’t move. The version’s rule is about the 50, the only planets anything is built on (spec: “No `TERRAIN_VERSION` bump touches them”).
- **No new places on the seeded planets.** The 13 seeded Expanse planets get no new POIs and no new no-build zones.
- **Building stays on the 50.** Building happens on the 50 only (`spec.buildable`). Every other planet reads nothing from Supabase and writes nothing to it. There’s no migration and no change to `supabase/`.
- **A spec is plain data.** It crosses to the terrain worker and the orbit-map worker by `postMessage`, so it holds no functions or class instances. Bigints travel as strings, directions as `[x, y, z]` unit arrays and colours as `'#rrggbb'`.
- **Ids are lower case and canonical.** Parse them with `address.js`’s `parseSpaceId` and rebuild them with `spaceId(...).toLowerCase()`.
  - Either case is read.
  - A sector may have 2 or 3 numbers. A sector of the middle layer is written with 2.
- **Map layout.** The equirectangular layout is `landings/biomes.js:45-61`’s `uvOf` and `fromLatLon`: u runs from −x toward +z, and v is 0 at the north pole (the image’s top row).
- **Ground size.**
  - Ground radius is 15,000 to 60,000 m, linear in the universe radius from 18 to 70 and clamped. A moon, or a row with no radius, gets 15,000 m.
  - The climate is sampled on the unit direction, so its wavelength scales with the circumference.
- **The flight’s ground limits** (`field.test.js:59-75`): every height is finite, within −200…1200 m, and never more than 60 m apart over 4 m outside a POI’s edge.
- **The orbit map.**
  - Size: 256 × 128 on `low` and `mid`, 512 × 256 on `high` and `ultra`.
  - Format: RGBA sRGB bytes, with alpha 0 under water and 255 elsewhere.
  - It’s never stored: not in `localStorage`, IndexedDB, `rt.store` or `rt.saves`. It’s cached in memory, at most 16 maps.
- **One noise wrapper.** 3D noise goes only through `fnl.js` (`docs/stack/fastnoise-lite.md`). No new dependency.
- **Lane boundaries.** Untouched: `src/components/expanse/gen/*`, the universe scene, `galaxy/bodies.js`, `entry.js`, the walker and `supabase/`.
- **Pure first.** `src/lib/**` imports no React, no DOM and no three.js.
  - Tests sit beside their files, each runs under a second, and none touches the network.
  - Fixtures live in `fixtures/` beside the test.
  - Each file stays under 800 lines.
- **Copy.** British spelling, curly quotes, sentence case, one sentence to a toast.
  - No model names in code, docs or commits (HANDOFF-universe’s rule), so commit messages carry no co-author line that names one.
- **Before done:** run `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/flight-island.mjs --check`. Ship one pull request with a merge commit.

## Review Focus

1. **Ids typed by hand.** `/fly/E:1,0,0:0:1`, an id with trailing junk, a system id, a wonder id, or a moon past its planet’s count: each gives the canonical spec or the 404, and none throws. Tested in Task 5.
2. **Flying far from the landing spot.** At πR (the far side) and past 2πR, the ground stays finite, continuous and within the 60 m in 4 m rule, the antipode included. Tested in Task 7.
3. **One planet, one description.** A planet’s spec, and so its orbit map, is the same whichever lookup built it: the universe’s or the flight’s, with any siblings known or none. Tested in Task 8.
4. **A bake asked in any state.** A bake asked twice at once, cancelled, failed, or for a plane, gas or moon spec makes one bake, doesn’t cache a null and never throws. Tested in Tasks 10 and 11.
5. **A world you can’t build on.** There’s no sign-in and no Supabase read or write. B answers with a sentence, and X has nothing to take down. Tested in Task 12.

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/lib/land/flight/planetSpec.test.js` | the roster lock; ids; moons; the build flag | 1, 5, 8 |
| `src/lib/land/flight/sphere.js` (new) | unit-sphere maths: uv and lat/lon, tangent frame, the exponential-map chart | 2 |
| `src/lib/land/flight/fnl.js` | `noise3For`, `cells3For` beside `noiseFor` | 3 |
| `src/lib/land/flight/characters.js` (new) | the eight terrain characters as 3D recipes | 3 |
| `docs/stack/fastnoise-lite.md` | 3D noise is now used | 3 |
| `src/lib/land/flight/biomes.js` | `weightsAt(biomes, t, m)` drawn out of `biomeWeights` | 4 |
| `src/lib/land/flight/sphereField.js` (new) | a round planet’s climate, biomes, heights and POI flats as functions of a direction | 4 |
| `src/lib/land/flight/planetTables.js` | `ROUND_ROUGH`, `roundBiomes`, `SEEDED_EXPANSE`, `familyOf`, `PLANE_CLIMATE`, `WATER_LOOKS` | 4, 5, 8 |
| `src/lib/land/flight/fixtures/generated.js` (new) | random directions, a hand-made round spec, moon rows, random systems | 3–6 |
| `src/lib/land/flight/expanse.js` | `canonicalId` beside `expanseLookup` | 5 |
| `src/lib/land/flight/planetSpec.js` | canonical ids, moons, `ROSTER_EXTRA`, the roster’s two paths, generated specs | 5, 8 |
| `src/lib/land/flight/lifeTables.js` | ids through `canonicalId`; fauna from the spec | 5, 9 |
| `src/components/expanse/flight/planets.js` | ids through the address; rows gain radius, moons, rings; the moon seam | 5 |
| `src/lib/land/flight/fixtures/expanse.json` | regenerated (rows gain radius, moons, rings) | 5 |
| `src/lib/land/flight/variety.js` (new) | per-planet variety: palette slots, character, sky, weather, flora, fauna, exotic, POI kinds | 6 |
| `src/lib/land/flight/field.js` | the round branch through the chart; `fieldKey` | 7 |
| `src/components/expanse/flight/terrain.worker.js` | fields cached by `fieldKey` | 7 |
| `src/lib/land/flight/generated.js` (new) | a non-roster planet or moon’s spec; `chartedAt` | 8 |
| `src/components/expanse/flight/water.js` | its looks from `WATER_LOOKS`; a spec’s own water colour | 8 |
| `src/lib/land/flight/landmarkTables.js` | `POI_KITS`, `FLORA_TRUNKS`, `EXOTIC_KIT`, `landmarkRowsOf`; `clutterKitOf` reads the flora | 9 |
| `src/components/expanse/flight/landmarks.js` | a generated POI’s rows through `landmarkRowsOf` | 9 |
| `src/lib/land/flight/orbitMap.js` (new) | `groundColour`, `bakeOrbitMap`, sizes by tier | 10 |
| `src/lib/land/flight/orbitMap.worker.js` (new) | the bake off the main thread | 11 |
| `src/lib/land/flight/orbitMaps.js` (new) | the worker through `runtime/workers.js`, cached in memory | 11 |
| `src/components/expanse/flight/shared.js` | read-only when `spec.buildable === false` | 12 |
| `scripts/planet-contact-sheet.mjs` (new) | 24 random generated planets, orbit and ground, to `lab/planets/contact/` | 13 |
| `scripts/lib/flight-island.mjs` | the script joins `ISLAND.files` | 13 |

---

### Task 1: Lock the roster

The lock comes before any change, so every later task is held to it.

**Files:**
- Modify: `src/lib/land/flight/planetSpec.test.js` (imports at 1-7; append after 160)

**Interfaces:**
- Consumes: today’s `planetSpecOf`, `lifeFor` and `PLANETS` (`fixtures/expanse.js`), `planetField` (`field.js:35`) and `clutterKitOf` (`landmarkTables.js:222`).
- Produces: the `the roster` test, over the 17 fields a spec has today (`ROSTER_KEYS`). Every later task runs it.

- [ ] **Step 1: Write the lock**

```js
import { planetField } from './field';
import { clutterKitOf } from './landmarkTables';
// (and add lifeFor to the existing fixtures/expanse.js import)

// The fifty as the endless universe found them (its spec, section E: “The 50
// roster planets keep their plane ground exactly as it is”): every field the
// flight read then, the ground under five points, their life and clutter kits.
const ROSTER_LOCK = '';
const ROSTER_KEYS = ['id', 'name', 'seed', 'type', 'climate', 'biomes', 'pois', 'pits', 'palette', 'clutter', 'step', 'soft', 'ground', 'water', 'fog', 'landmarks', 'hero'];
const ROSTER_POINTS = [[0, 0], [1234.5, -987.25], [-15000, 8000], [30000, 30000], [-4321, -27000]];
function rosterHash() {
  const text = JSON.stringify(PLANETS.map(({ id }) => {
    const s = planetSpecOf(id);
    const f = planetField(s);
    return [ROSTER_KEYS.map((k) => s[k] ?? null), ROSTER_POINTS.map(([x, z]) => f.heightAt(x, z).toFixed(4)), lifeFor(s), clutterKitOf(s)];
  }));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('the roster', () => {
  it('is as it was: the fifty’s fields, ground, life and kits', () => {
    expect(rosterHash()).toBe(ROSTER_LOCK);
  });
});
```

- [ ] **Step 2: Run it on the unchanged code to read the value**

Run: `npx vitest run src/lib/land/flight/planetSpec.test.js -t "the roster"`
Expected: FAIL, `expected '<8 hex>' to be ''`. Paste the 8 hex digits into `ROSTER_LOCK`.

- [ ] **Step 3: Run it again**

Run: `npx vitest run src/lib/land/flight/planetSpec.test.js`
Expected: PASS, every test in the file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/land/flight/planetSpec.test.js
git commit -m "Lock the fifty roster planets before the endless universe changes the flight"
```

---

### Task 2: The sphere and the chart

**Files:**
- Create: `src/lib/land/flight/sphere.js`
- Test: `src/lib/land/flight/sphere.test.js`

**Interfaces:**
- Produces (every argument is a plain array, every direction a unit `[x, y, z]`):
  - `unit(v) → [x, y, z]`. It returns `v` itself when its length is within 1e−12 of 1, so normalising twice changes no bit; Task 10’s exact texel test rests on that.
  - `angleBetween(a, b) → radians`
  - `dirOfUv(u, v) → dir` and `uvOfDir(dir) → [u, v]`: the same layout as `landings/biomes.js:45` `uvOf`
  - `dirOfLatLon(lat, lon) → dir` and `latLonOfDir(dir) → [lat, lon]`, in degrees, the same as `landings/biomes.js:53-61`
  - `frameAt(at) → { up, east, north }`
    - `north` is +y projected onto the tangent plane. At a pole it’s −x projected.
    - `east = cross(north, up)`, so east points the way longitude grows.
  - `chartOf(at, radius) → { at: unit(at), radius, frame, toDir(x, z) → dir, toChart(dir) → [x, z] }`. Chart +x is east and −z is north.
    - `toDir`: with `d = hypot(x, z)` and `t = (x·east − z·north) / d`, it gives `at·cos(d/R) + t·sin(d/R)`, and `at` when `d = 0`.
    - `toChart` is the inverse inside the first turn (`d < πR`). At the antipode it gives `[πR, 0]`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { angleBetween, chartOf, dirOfLatLon, dirOfUv, frameAt, latLonOfDir, uvOfDir } from './sphere';

const near = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);
const R = 20000;
const c = chartOf(dirOfLatLon(10, 20), R);

describe('the map’s layout', () => {
  it('is the landings’ (landings/biomes.js uvOf): u from −x toward +z, v 0 at the north pole', () => {
    expect(near(dirOfUv(0.5, 0.5), [1, 0, 0])).toBe(true);
    expect(near(dirOfUv(0.25, 0.5), [0, 0, 1])).toBe(true);
    expect(near(dirOfUv(0, 0.5), [-1, 0, 0])).toBe(true);
    expect(near(dirOfUv(0.3, 0), [0, 1, 0])).toBe(true);
    expect(near(uvOfDir([0, 0, 1]), [0.25, 0.5])).toBe(true);
    expect(near(dirOfLatLon(0, 0), dirOfUv(0.5, 0.5))).toBe(true);
    expect(near(latLonOfDir(dirOfLatLon(-33, 151)), [-33, 151], 1e-9)).toBe(true);
  });
});

describe('chartOf', () => {
  it('puts its middle at its spot, east along +x and north along −z', () => {
    expect(near(c.toDir(0, 0), dirOfLatLon(10, 20))).toBe(true);
    expect(latLonOfDir(c.toDir(500, 0))[1]).toBeGreaterThan(20);
    expect(latLonOfDir(c.toDir(0, -500))[0]).toBeGreaterThan(10);
  });

  it('walks hypot(x, z) metres along the great circle', () => {
    for (const [x, z] of [[300, 0], [-1200, 4000], [9000, -9000]]) expect(angleBetween(c.toDir(0, 0), c.toDir(x, z)) * R).toBeCloseTo(Math.hypot(x, z), 6);
  });

  it('reaches the far side at πR and comes round to where it was after 2πR', () => {
    for (const a of [0, 1, 2.5, 4]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      const d = 3700;
      const once = d + 2 * Math.PI * R;
      expect(near(c.toDir(ux * d, uz * d), c.toDir(ux * once, uz * once), 1e-9)).toBe(true);
      expect(near(c.toDir(ux * Math.PI * R, uz * Math.PI * R), c.at.map((v) => -v), 1e-9)).toBe(true);
    }
  });

  it('reads a direction back to the chart inside the first turn', () => {
    for (const [x, z] of [[0, 0], [250, -40], [-30000, 12000], [50000, 20000]]) expect(near(c.toChart(c.toDir(x, z)), [x, z], 1e-6)).toBe(true);
  });

  it('has a frame at the poles too, and never answers NaN', () => {
    for (const at of [[0, 1, 0], [0, -1, 0]]) {
      const f = frameAt(at);
      expect([...f.east, ...f.north].every(Number.isFinite)).toBe(true);
      expect(Math.abs(f.east[0] * f.north[0] + f.east[1] * f.north[1] + f.east[2] * f.north[2])).toBeLessThan(1e-12);
    }
    for (const [x, z] of [[0, 0], [Math.PI * R, 0], [1e7, -3e6]]) expect(c.toDir(x, z).every(Number.isFinite)).toBe(true);
    expect(c.toChart(c.at.map((v) => -v)).every(Number.isFinite)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/sphere.test.js`
Expected: FAIL, `Failed to resolve import "./sphere"`.

- [ ] **Step 3: Implement `sphere.js` with the signatures above**

Add a header comment in the house style: what the file is for, “Pure: runs in Node and in a worker”, then the signature list.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/sphere.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/sphere.js src/lib/land/flight/sphere.test.js
git commit -m "Map a planet's sphere: its layout and the chart round a landing spot"
```

---

### Task 3: 3D noise and the terrain characters

**Files:**
- Modify: `src/lib/land/flight/fnl.js` (add after `noiseFor`, line 38) and `src/lib/land/flight/fnl.test.js`
- Create: `src/lib/land/flight/characters.js`, `src/lib/land/flight/characters.test.js`, and `src/lib/land/flight/fixtures/generated.js`
- Modify: `docs/stack/fastnoise-lite.md`
  - “Where it is used” gains `characters.js` and `sphereField.js`.
  - The “3D noise” bullet under “What the site does not use” goes; a line under “How the site uses it” replaces it.
  - The Gotchas gain a 3D warp note: three noises, as the 2D warp is two.

**Interfaces:**
- Consumes: `unit` and `dirOfLatLon` (Task 2).
- Produces:
  - `noise3For(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp }) → (x, y, z) → −1…1`. It takes the same options as `noiseFor`; the warp is three noises at half the frequency.
  - `cells3For(seed, { frequency, jitter = 1 }) → (x, y, z) → distance ≥ 0`. This is FastNoiseLite’s Cellular with `CellularReturnType.Distance` and the Euclidean distance; the wrapper adds 1 so it reads from 0 up.
  - `CHARACTERS = ['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']`.
  - `TERRAIN[kind] → { shape, sea: [lo, hi], peaks: [lo, hi], lift }`.
  - `groundOf({ kind, sea, peaks }, seed, radius) → (dir) → { h: metres, land: 0…1 }`.
  - `FIB_512`: 512 Fibonacci-sphere directions.
  - `fixtures/generated.js`: `randomDirs(n, seed) → dir[]`.

**The recipes** (starting values, my call; tune by Task 13’s sheet). `shape` is `noise3For(seed, { frequency: TERRAIN[kind].shape, octaves: 5 })` of the unit direction.

- **The threshold.** `s0` is the `sea` quantile of `shape` over `FIB_512`, so the measured sea share is the asked one.
- **Lift.**
  - Where `shape ≥ s0`: `(shape − s0) × lift`.
  - Under it: `(shape − s0) × 420` on a planet with water. On a dry planet it’s `× lift`, and `sea` is then the share of dry basins.
- **Land.** `land = smoothstep(s0, s0 + 0.12, shape)`.
- **Layers.** `p = dir × radius` in metres, and `ridged(p, f, oct)` and `fbm(p, f, oct)` are `noise3For` mapped to 0…1. Each layer is added to the lift.

| kind | shape | sea | peaks (m) | lift (m) | layer |
|---|---|---|---|---|---|
| continents | 1.3 | 0.35–0.6 | 300–900 | 260 | `ridged(p, 1/2600, 5) × peaks × land²` |
| archipelago | 3.2 | 0.62–0.8 | 150–450 | 200 | `ridged(p, 1/1400, 4) × peaks × land²` |
| canyons | 1.0 | 0–0.15 | 150–350 | 60 | `land × (0.5·peaks − peaks × (1 − |2·fbm(p, 1/3200, 3) − 1|)^8)` |
| mesas | 1.0 | 0–0.15 | 60–160 | 60 | `land × peaks × smoothstep(0.55, 0.6, fbm(p, 1/1800, 4))` |
| dunes | 0.9 | 0–0.1 | 20–60 | 40 | `land × peaks × crest^1.6 × (0.35 + 0.65·smoothstep(0.3, 0.7, fbm(p, 1/1800, 2)))`. `crest` is `ridged` of `(p.x, 2.6·p.y, p.z)` at 1/300 with 3 octaves and gain 0.45 |
| craters | 1.0 | 0–0.1 | 80–250 | 60 | `land × peaks × (bowl(cells3(p, 1/3500)) + 0.3·bowl(cells3(p, 1/900)))`. `bowl(d)` is `−(1 − (d/0.6)²)` for `d < 0.6`, else `0.3·exp(−((d − 0.6)/0.12)²)` |
| ridges | 1.1 | 0–0.3 | 600–1100 | 200 | `land × ridged(p, 1/1600, 5) × peaks` |
| plateaus | 1.0 | 0–0.3 | 80–200 | 0 | `peaks × Σk=1..3 smoothstep(s0 + 0.12k, s0 + 0.12k + 0.03, shape)` |

- [ ] **Step 1: Write the failing tests**

In `fnl.test.js`, add a `describe('noise3For')` with these tests:
- `'gives the same value for the same seed and point, and differs between seeds'`
- `'stays in [−1, 1] over 1,000 points'`
- `'is continuous: two points a millimetre apart differ by under 1e−3'`
- `'warps in 3D'`: `warp: 200` differs from `warp: 0` at one point
- `'takes every type and fractal it names'`

Add a `describe('cells3For')` with one test: `'is a distance from 0 up, the same twice'`.

`characters.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { CHARACTERS, TERRAIN, groundOf } from './characters';
import { chartOf } from './sphere';
import { randomDirs } from './fixtures/generated';

const mid = ([a, b]) => (a + b) / 2;
const step4 = (dir, R, a) => chartOf(dir, R).toDir(Math.cos(a) * 4, Math.sin(a) * 4);

describe('the terrain characters', () => {
  it('are the eight the spec names', () => {
    expect(CHARACTERS).toEqual(['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']);
  });

  it.each(CHARACTERS)('%s: finite, within −190…1150 m, never more than 60 m in 4 m, at 15 km and 60 km', (kind) => {
    for (const R of [15000, 60000]) {
      const g = groundOf({ kind, sea: mid(TERRAIN[kind].sea), peaks: TERRAIN[kind].peaks[1] }, 11, R);
      for (const [i, d] of randomDirs(1000, 3).entries()) {
        const { h, land } = g(d);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(-190);
        expect(h).toBeLessThanOrEqual(1150);
        expect(land).toBeGreaterThanOrEqual(0);
        expect(land).toBeLessThanOrEqual(1);
        expect(Math.abs(g(step4(d, R, i)).h - h), `${kind} ${R}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('puts the sea where it says: the share under 0 within 0.05 of `sea`', () => {
    for (const kind of ['continents', 'archipelago']) for (const sea of TERRAIN[kind].sea) {
      const g = groundOf({ kind, sea, peaks: mid(TERRAIN[kind].peaks) }, 5, 30000);
      const under = randomDirs(2000, 9).filter((d) => g(d).h < 0).length / 2000;
      expect(Math.abs(under - sea), `${kind} ${sea}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('gives each its mark: ridges stand tall, craters dig in, dunes stay low', () => {
    const hs = (kind, peaks) => randomDirs(1500, 4).map((d) => groundOf({ kind, sea: 0.05, peaks }, 21, 25000)(d).h).sort((a, b) => a - b);
    expect(hs('ridges', 1000)[Math.floor(1500 * 0.95)]).toBeGreaterThanOrEqual(350);
    const cr = hs('craters', 200);
    expect(cr[Math.floor(1500 * 0.05)]).toBeLessThanOrEqual(cr[750] - 60);
    const du = hs('dunes', 40);
    expect(du[1499] - du[750]).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.test.js`
Expected: FAIL. `noise3For` and `./characters` don’t exist.

- [ ] **Step 3: Build it**
  - `noise3For` and `cells3For` go in `fnl.js`. Name the class nowhere else.
  - `characters.js` follows the table.
  - `fixtures/generated.js` gets `randomDirs`: `seeded(seed)` (`lib/seeded.js`), then `z = 2r − 1` and an angle, which is uniform on the sphere.
  - Update the stack page.
  - If a slope assertion fails, lower that kind’s frequency or peaks in `TERRAIN`; don’t loosen the test.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.test.js docs/stack/stack.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/fnl.js src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.js src/lib/land/flight/characters.test.js src/lib/land/flight/fixtures/generated.js docs/stack/fastnoise-lite.md
git commit -m "Give the flight 3D noise and eight terrain characters on a sphere"
```

---

### Task 4: The field on the sphere

**Files:**
- Modify: `src/lib/land/flight/biomes.js:34-48`. `biomeWeights(spec, x, z)` becomes `weightsAt(spec.biomes, ...climateOf(spec)(x, z))`. Export `weightsAt(biomes, t, m) → number[]`, which is today’s body from line 35 on, unchanged.
- Modify: `src/lib/land/flight/planetTables.js`. After `TYPE_LOOK` (608-617), add `ROUND_ROUGH` and `roundBiomes`.
- Create: `src/lib/land/flight/sphereField.js` and `src/lib/land/flight/sphereField.test.js`
- Modify: `src/lib/land/flight/fixtures/generated.js` (add `roundSpec`)

**Interfaces:**
- Consumes: `groundOf` and `TERRAIN` (Task 3); `chartOf`, `angleBetween` and `dirOfLatLon` (Task 2); `noise3For`.
- Produces:
  - `ROUND_ROUGH[biomeId] → multiplier` (keyed by the template ids `TYPE_BIOMES` gives):
    - ice: plains 0.7, shelf 0.3, range 2.2, glacier 0.8, valley 0.6
    - desert: jundland 1.2, dunesea 0.8, plateau 0.6, chott 0.25, wastes 0.9
    - forest: redwoods 1, savannah 0.6, range 2.2, lakes 0.4, desert 0.7
    - lava: fields 1, volcanoes 2, ash 0.6, glass 0.3
    - ocean: islands 1, volcano 1.6, reef 0.3, deep 0.5
    - rock: plains 0.6, mesas 1.2, badlands 1.6, craters 1
  - `roundBiomes(family) → [{ id, at, reach, base, rough, relief: [] }]`: from `TYPE_BIOMES[family]`, with no scatter, plus each id’s `ROUND_ROUGH`.
  - The round spec (what `sphereField` reads):

    ```
    { id, seed: int32, type: family, biomes: roundBiomes(family),
      character: { kind, sea, peaks },
      round: { radius: metres, at: dir },
      water: { kind, level, colour? } | null,
      pois: [{ id, name, kind, dir, at: [x, z], r, edge }] }
    ```
  - `CLIMATE_SPHERE = { frequency: 1.6, octaves: 3, stretch: 1.5 }` and `SLOPE_STEP = 8` (metres).
  - `sphereField(spec) → { heightAt(dir), biomeAt(dir), climateAt(dir) → [t, m], sample(dir) → { h, slope, biome } }`. The rules:
    - **Climate.** `t = 0.55·(1 − |dir.y|) + 0.45·n_t` and `m = n_m`. Both noises are `noise3For` of the unit direction (seeds `seed` and `seed + 1`), mapped to 0…1, then stretched about 0.5 by `stretch` and clamped to 0…1.
    - **Height.** `soft(groundOf(dir).h + Σ w_b·(base_b + rough_b·hills) + detail)`.
      - `hills` is `fbm(p, 1/520, 4) × 26`; `detail` is `(2·fbm(p, 1/70, 3) − 1) × 3`.
      - `soft` presses the range into −200…1150. Above 900 it’s `900 + 250·tanh((h − 900)/250)`. Below −150 it’s `−150 − 50·tanh((−150 − h)/50)`.
    - **POI flats.** These are `flats.js`’s rule on the sphere. The distance is `radius × angleBetween(dir, poi.dir)`. The level is the raw height at `poi.dir`. `edge` defaults to `max(8, 0.6r)`.
    - **Biomes.** `biomeAt` is the heaviest of `weightsAt(spec.biomes, t, m)`.
    - **Sample.** `sample(dir)` reads `h`, then four heights at ±`SLOPE_STEP` along `chartOf(dir, radius)`’s x and z.
      - The gradient `g` comes from central differences, and `slope = 1 − 1/hypot(1, g)`. That’s `groundLook.js`’s `1 − normal.y`.
      - The biome is `biomeAt(dir)`.
  - `fixtures/generated.js`: `roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks } = {})`.
    - It assembles the round spec above by hand: `round.at = dirOfLatLon(0, 0)` and `water` `{ kind: 'sea', level: 0 }` for ocean and forest, else null.
    - It has one POI: `{ id: 'poi-0', name: 'Ruins', kind: 'ruins', dir: dirOfLatLon(5, 10), at: [0, 0], r: 120, edge: 100 }`. Its `at` isn’t read by `sphereField`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { CLIMATE_SPHERE, SLOPE_STEP, sphereField } from './sphereField';
import { CHARACTERS } from './characters';
import { angleBetween, chartOf, dirOfLatLon, dirOfUv } from './sphere';
import { randomDirs, roundSpec } from './fixtures/generated';

const TYPES = ['rock', 'ice', 'desert', 'forest', 'lava', 'ocean'];

describe('sphereField', () => {
  it.each(TYPES.flatMap((type, i) => [[type, CHARACTERS[i]], [type, CHARACTERS[i + 2]]]))('%s, %s: finite, within −200…1200, never more than 60 m in 4 m', (type, kind) => {
    const spec = roundSpec({ type, kind });
    const f = sphereField(spec);
    for (const [i, d] of randomDirs(800, 5).entries()) {
      const h = f.heightAt(d);
      expect(h).toBeGreaterThanOrEqual(-200);
      expect(h).toBeLessThanOrEqual(1200);
      if (angleBetween(d, spec.pois[0].dir) * spec.round.radius < 240) continue;
      const n = chartOf(d, spec.round.radius).toDir(Math.cos(i) * 4, Math.sin(i) * 4);
      expect(Math.abs(f.heightAt(n) - h)).toBeLessThanOrEqual(60);
    }
  });

  it('has no seam where the map wraps nor at the poles', () => {
    const f = sphereField(roundSpec({ type: 'ice', kind: 'ridges' }));
    for (let i = 1; i < 200; i++) {
      const v = i / 200;
      expect(Math.abs(f.heightAt(dirOfUv(1 - 1e-9, v)) - f.heightAt(dirOfUv(1e-9, v)))).toBeLessThan(0.01);
    }
    for (const pole of [0, 1]) {
      const hs = Array.from({ length: 36 }, (_, k) => f.heightAt(dirOfUv(k / 36, pole === 0 ? 1e-6 : 1 - 1e-6)));
      expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(1);
    }
  });

  it('holds a POI flat at the land’s own height there', () => {
    const spec = roundSpec();
    const f = sphereField(spec);
    const at = spec.pois[0].dir;
    const level = f.heightAt(at);
    expect(f.heightAt(chartOf(at, spec.round.radius).toDir(110, 0))).toBeCloseTo(level, 6);
  });

  it('samples what it answers: sample(dir).h is heightAt(dir), its slope 0…1, its biome biomeAt(dir)', () => {
    const f = sphereField(roundSpec({ type: 'desert', kind: 'mesas' }));
    for (const d of randomDirs(50, 8)) {
      const s = f.sample(d);
      expect(s.h).toBe(f.heightAt(d));
      expect(s.slope).toBeGreaterThanOrEqual(0);
      expect(s.slope).toBeLessThan(1);
      expect(s.biome).toBe(f.biomeAt(d));
    }
    expect(SLOPE_STEP).toBe(8);
    expect(CLIMATE_SPHERE.frequency).toBe(1.6);
  });

  it('is colder at the poles than at the equator, on the whole', () => {
    const f = sphereField(roundSpec({ type: 'forest', kind: 'continents' }));
    const mean = (lat) => Array.from({ length: 72 }, (_, k) => f.climateAt(dirOfLatLon(lat, k * 5))[0]).reduce((a, b) => a + b) / 72;
    expect(mean(0)).toBeGreaterThan(mean(80) + 0.2);
  });
});
```

Also export `biomes.js`’s `climateOf`; its header already lists it, at line 12. Then add a `biomes.test.js` case, `'weightsAt is biomeWeights given the climate'`: at 20 points, `biomeWeights(hoth, x, z)` must equal `weightsAt(hoth.biomes, ...climateOf(hoth)(x, z))`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/sphereField.test.js src/lib/land/flight/biomes.test.js`
Expected: FAIL. `./sphereField`, `weightsAt` and `roundSpec` don’t exist.

- [ ] **Step 3: Build it**

Do it in this order: `weightsAt` and the exported `climateOf`, then `ROUND_ROUGH` and `roundBiomes`, then `sphereField.js`, then `roundSpec`.

- [ ] **Step 4: Run them, and the lock**

Run: `npx vitest run src/lib/land/flight`
Expected: PASS, `the roster` included. That proves `weightsAt` moved nothing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/biomes.js src/lib/land/flight/biomes.test.js src/lib/land/flight/planetTables.js src/lib/land/flight/sphereField.js src/lib/land/flight/sphereField.test.js src/lib/land/flight/fixtures/generated.js
git commit -m "Grow a generated planet's ground on its sphere: climate, biomes, heights, flats"
```

---

### Task 5: Ids, moons and who may build

**Files:**
- Modify: `src/lib/land/flight/expanse.js` (add `canonicalId`)
- Modify: `src/lib/land/flight/planetTables.js`. Add `SEEDED_EXPANSE`, `MOON_FAMILY`, `familyOf` and `PLANE_CLIMATE`; the last is moved from `planetSpec.js:43` unchanged.
- Modify: `src/lib/land/flight/planetSpec.js:43` (`CLIMATE` becomes the imported `PLANE_CLIMATE`), `:56-74` (`specOf` adds `ROSTER_EXTRA`) and `:76-88` (id handling)
- Modify: `src/lib/land/flight/lifeTables.js:396-406`. `EXPANSE_ID` becomes `canonicalId`.
- Modify: `src/components/expanse/flight/planets.js:24-42`, then regenerate `src/lib/land/flight/fixtures/expanse.json` with `node scripts/flight-expanse-fixture.mjs`
- Modify: `src/lib/land/flight/fixtures/generated.js` (add `MOONS`)
- Test: `src/lib/land/flight/planetSpec.test.js`, `src/lib/land/flight/lifeTables.test.js` and `src/components/expanse/flight/planets.test.js`

**Interfaces:**
- Consumes: `parseSpaceId` and `spaceId` from `src/lib/space/address.js` (index Task 0).
- Produces:
  - `canonicalId(id) → string | null`. It returns the lower-case `spaceId([sx, sy, sz], system, planet[, moon])` for a planet or moon id. For anything else it returns null: a system, a wonder, junk or a non-string.
    - It first checks the id against `/^e:-?\d+,-?\d+(?:,-?\d+)?(?::\d+){2,3}$/i`, then parses it.
    - So its strictness doesn’t hang on how lenient `address.js` is.
  - `SEEDED_EXPANSE`: the 13 `[id, type]` pairs of `fixtures/expanse.json`, in order. They are `e:1,0:0:0` gas, `:0:1` forest, `:0:2` lava, `:0:3` ice, `:0:4` rock, `:0:5` ice, `:0:6` desert, `:1:0` desert, `:1:1` ocean, `:1:2` rock, `:2:0` gas, `:2:1` ocean and `:2:2` rock.
  - `MOON_FAMILY = { rocky: 'rock', icy: 'ice' }` and `familyOf(type) → MOON_FAMILY[type] ?? type`.
  - `ROSTER_EXTRA = { kind: 'planet', parent: null, buildable: true, round: null, character: null, sky: null, weather: null, flora: null, fauna: null, exotic: null }`, exported from `planetSpec.js`.
  - `planetSpecOf(id, { expanse })` takes one of three paths:
    - A named world is today’s spec plus `ROSTER_EXTRA`.
    - A seeded id (canonical, in `SEEDED_EXPANSE`) is today’s template spec (lines 85-87) plus `ROSTER_EXTRA`.
    - Any other planet or moon whose row the lookup has, and whose `familyOf(type)` is in `TYPE_BIOMES`, is for now the template spec of its family. It carries `{ ...ROSTER_EXTRA, kind: 'moon' | 'planet', parent: <planet id> | null, buildable: false }`. Task 8 replaces this branch.
  - A moon row (the contract with lane 2): `{ id, name, type: 'rocky' | 'icy', seed: string, radius?, system, parent }`.
  - In `planets.js`:
    - `rowOf` adds `radius: p.radius`, `moons` (a count: `p.moons` when it’s a number, otherwise its length) and `rings: Boolean(p.rings)`.
    - `expanseRow(id)` parses through `canonicalId` and `parseSpaceId`. It returns null for `sy !== 0`, because lane 2’s 3D generator answers the other layers. A moon goes through `moonRowOf(p, s, k)`.
    - `moonRowOf(p, s, k)` is exported and reads `p.moonList?.[k]`. **That field is lane 2’s (its plan: planets gain `moonList` of `{ id, k, name, type, seed, radius, orbit, phase, revs, tilt }`).** Whichever lane merges second makes the names meet, a one-line change. Until then a moon id resolves to null in the app; the lib side is tested with `MOONS`.

- [ ] **Step 1: Write the failing tests**

In `planetSpec.test.js`:

```js
import { SEEDED_EXPANSE } from './planetTables';
import { ROSTER_EXTRA } from './planetSpec';
import { MOONS } from './fixtures/generated';

describe('ids, moons and the build flag', () => {
  it('reads an Expanse id in either case and with its height written, to one canonical id', () => {
    const s = planetSpecOf('e:1,0:0:1');
    expect(planetSpecOf('E:1,0:0:1')).toEqual(s);
    expect(planetSpecOf('e:1,0,0:0:1')).toEqual(s);
    expect(s.id).toBe('e:1,0:0:1');
  });

  it('refuses what isn’t a planet or a moon, and never throws', () => {
    for (const id of ['e:1,0', 'e:1,0:0', 'e:1,0:w1', 'e:1,0:0:1:', 'e:1,0:0:1x', ' e:1,0:0:1', 'e:1,0:0:-1', 'e:1,0:0:1:9', null, 42]) expect(planetSpecOf(id), String(id)).toBeNull();
  });

  it('lists the thirteen seeded Expanse planets as the roster’s last thirteen', () => {
    expect(SEEDED_EXPANSE).toEqual(EXPANSE.map((r) => [r.id, r.type]));
  });

  it('lets the fifty be built on, and gives them nothing new', () => {
    for (const p of PLANETS) expect(Object.fromEntries(Object.keys(ROSTER_EXTRA).map((k) => [k, planetSpecOf(p.id)[k]])), p.id).toEqual(ROSTER_EXTRA);
  });

  it('lands a moon from its row: rocky as rock, icy as ice, its planet named, not to be built on', () => {
    const [rocky, icy] = MOONS;
    expect(specWith(rocky.id, { expanse: MOONS })).toMatchObject({ id: rocky.id, kind: 'moon', parent: rocky.parent, type: 'rock', buildable: false });
    expect(specWith(icy.id.toUpperCase(), { expanse: MOONS })).toMatchObject({ id: icy.id, type: 'ice' });
  });
});
```

In `lifeTables.test.js`, add `'finds a moon’s system on its row'`: `systemOf(MOONS[0].id, { expanse: MOONS })` equals `MOONS[0].system`, and `lifeFor(specWith(MOONS[0].id, { expanse: MOONS }), { expanse: MOONS })` has `air` and `ground` arrays.

In `planets.test.js`:
- `'carries the universe radius, moons and rings on a row'`: for `far` (`planets.test.js:37`’s), `expanseRow(far.id)` matches `{ radius: far.radius, moons: far.moons, rings: Boolean(far.rings) }`.
- `'reads a moon from the generator’s moon rows'`: `moonRowOf({ id: 'E:3,-2:1:0', moonList: [{ name: 'Ostra', type: 'rocky', seed: 12345n }] }, { faction: null, traffic: 0.2, hazard: null }, 0)` equals `{ id: 'e:3,-2:1:0:0', name: 'Ostra', type: 'rocky', seed: '12345', system: { faction: null, traffic: 0.2, hazard: null }, parent: 'e:3,-2:1:0' }`.
- `'reads a planet id with its height written'`: `expanseRow('E:1,0,0:0:1')` equals `expanseRow('e:1,0:0:1')`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight/planets.test.js`
Expected: FAIL. `SEEDED_EXPANSE`, `ROSTER_EXTRA`, `MOONS` and `moonRowOf` are missing, and `'e:1,0,0:0:1'` reads as null.

- [ ] **Step 3: Build it**
  - Write the pieces in the order of the Interfaces block.
  - The `MOONS` fixture is two rows of `'e:3,-2:1:0'`, moons `:0` (rocky) and `:1` (icy), with seeds as strings and `system: { faction: null, traffic: 0.2, hazard: null }`.
  - Then run `node scripts/flight-expanse-fixture.mjs`, which rewrites `fixtures/expanse.json` with the three new row fields.

- [ ] **Step 4: Run them, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS. That includes `the roster`, `TERRAIN_VERSION` and `planets.test.js`’s `'makes the rows the fixture holds'`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight src/components/expanse/flight/planets.js src/components/expanse/flight/planets.test.js
git commit -m "Read planet and moon ids through the space address; only the fifty may be built on"
```

---

### Task 6: The variety

**Files:**
- Create: `src/lib/land/flight/variety.js` and `src/lib/land/flight/variety.test.js`
- Modify: `src/lib/land/flight/fixtures/generated.js`. Add `randomSystems(planets, seed) → row[][]` and `lookupOf(rows) → (id) → row`.

**Interfaces:**
- Consumes: `familyOf`, `SEEDED_EXPANSE` and `TYPE_LOOK` (`planetTables.js`); `canonicalId`; `parseSpaceId`; `fold`; `hash64`; `seeded`; `CHARACTERS` and `TERRAIN`.
- Produces:
  - `FAMILIES[family] → { slots: [[hue°, lightness]…], sat: [lo, hi] }`. `ringed` uses `gas`’s.
  - `colourDistance([h1, l1], [h2, l2]) → hypot(Δh°/15, Δl/0.08)`, with Δh measured round the hue circle.
  - `dominantOf(palette, water = null) → [h°, l]`: the HSL of the mix of `low` and `high`, or of `water.colour` when given (an ocean’s).
  - `SLOT_JITTER = { hue: 2, light: 0.01 }`.
  - `varietyOf(row) → { family, dominant: [h, l], palette, water, character, sky, weather, flora, fauna, exotic, poiKinds }`, where:
    - `palette = { low, high, rock, accent, deep, skyLow, skyHigh }` (hex)
    - `water = { kind: 'sea' | 'lava', colour? } | null`
    - `character = { kind, sea, peaks } | null`
    - `sky = { low, high, haze, clouds, cloudColour, rings: Boolean(row.rings), moons: row.moons ?? 0 }`
    - `weather = { kind, amount }`
    - `flora = { family, density, pick } | null`, with `pick` in 0…1 choosing a tree in Task 9
    - `fauna = { density, plans: [{ body, role, tint, group }] } | null`
    - `exotic = null | 'crystal' | 'glowing' | 'floating' | 'spires'`
    - `poiKinds` is from `'ruins' | 'wreck' | 'outpost' | 'monolith' | 'signal'`, 0–3 of them.

**Rules that decide what the tests check:**

- **Streams.** Each aspect draws from its own stream, `seeded(fold(BigInt(row.seed)) ^ SALT[aspect])`, with a fixed salt for each aspect. Adding an aspect then never moves another.
- **The palette slot.** A planet’s dominant colour is a slot of its family, with no sibling rows read. That way the result is a function of the row alone (Review Focus 3).
  - The system key is the id without its last part; a moon’s key is its parent.
  - The index is the id’s last number, `j` (or `k` for a moon).
  - `perm` is a seeded shuffle of the family’s slot indices, seeded by `hash64('slots', systemKey)`. The slot is `slots[perm[index]]`, nudged by a jitter of up to `SLOT_JITTER` from the planet’s own stream.
  - Two siblings of one family get different slots, because their indices differ.
  - Siblings of different families stay apart because the table keeps every family’s slots apart (the first test).
  - **In a system with seeded planets** (sector (1, 0)’s systems 0–2), seeded siblings take the first indices, 0…s−1.
    - The slot list is the family’s slots that sit at least `1 + 2·jitter` from every seeded sibling’s template colour (`dominantOf(TYPE_LOOK[type].palette)`).
    - The index is `j − s`.
    - This still needs no sibling rows: `SEEDED_EXPANSE` names the seeded planets and their types.
- **The dominant colour** is `dominantOf`’s: the mix of `low` and `high`, or an ocean planet’s water colour.
- **The slot table** (starting values; the first test holds the property):

| family | hues (°) | lightness | saturation |
|---|---|---|---|
| lava | 335, 0, 25, 50 | 0.10, 0.21 | 0.15–0.35 |
| rock | 335, 0, 25, 50 | 0.33, 0.45 | 0.10–0.45 |
| desert | 20, 42, 64 | 0.58, 0.70, 0.82 | 0.35–0.60 |
| forest | 85, 108, 131, 154 | 0.26, 0.38 | 0.30–0.55 |
| ocean (its water) | 178, 200, 222, 244 | 0.28, 0.40 | 0.40–0.70 |
| ice | 178, 200, 222, 244 | 0.80, 0.92 | 0.15–0.45 |
| gas (and ringed) | 266, 289, 312 at 0.55 and 0.67; 20, 42 at 0.94 | | 0.25–0.55 |

- **The palette from the slot `(h, s, l)`.**
  - `low` is `hsl(h, s, l − 0.05)`; `high` is `hsl(h + 6, 0.9s, l + 0.05)`; `deep` is `hsl(h, s, 0.7l)`; `rock` is `hsl(h + 10, 0.6s, 0.6l)`.
  - `accent` depends on the family:
    - lava: `hsl(15–35, 1, 0.55)`
    - forest: `hsl(h + 25, s + 0.1, l + 0.12)`
    - desert: `hsl(h − 12, s, l − 0.1)`
    - rock: `hsl(h + 15, s, l + 0.15)`
    - ice: `hsl(h, s, l − 0.08)`
    - gas: `hsl(h + 40, s, l)`
    - ocean: its sand is `low` and `high` drawn from desert’s range, and its accent is the water.
- **Water.** ocean: `'sea'` with `colour` the slot. forest: `'sea'` with `colour` from `hsl(195–215, 0.45, 0.3)`. lava: `'lava'`. Others: null.
- **Character weights by family.** gas and ringed have none. `sea` and `peaks` are drawn from `TERRAIN`.
  - rock: craters 3, mesas 2, canyons 2, ridges 1, plateaus 1
  - ice: ridges 2, plateaus 2, continents 2, craters 1
  - desert: dunes 3, mesas 2, canyons 2, plateaus 1
  - forest: continents 3, ridges 1, plateaus 1, archipelago 1
  - lava: ridges 2, craters 2, canyons 1, continents 1
  - ocean: archipelago 3, continents 2
- **Sky** (its hue, `skyLow` as L/S, `skyHigh` as L/S, haze, clouds):
  - ice: 195–215, .88/.3, .62/.45, .1–.4, .2–.5
  - desert: 200–215, .82/.45, .58/.5, .2–.5, 0–.2
  - forest: 190–210, .86/.35, .55/.55, .1–.35, .3–.7
  - ocean: 185–205, .88/.35, .55/.6, .1–.3, .4–.8
  - lava: 10–25, .32/.55, .1/.5, .6–.9, .1–.3
  - rock: the ground’s hue ± 15, .7/.25, .4/.3, .2–.5, 0–.1
  - gas: the dominant hue + 20, .85/.4, .6/.5, .4–.7, .7–1
  - `palette.skyLow` and `skyHigh` are the sky’s.
  - `cloudColour`: `#f2f4f6` (ice, forest, ocean), `#5a5048` (lava), `#d8c4a0` (desert, rock), `palette.high` (gas).
- **Weather weights** (amount 0.2–1):
  - ice: snow 3, none 2
  - desert: dust 3, none 2
  - lava: ash 4, none 1
  - forest: rain 3, spores 1, none 2
  - ocean: rain 3, none 2
  - rock: dust 1, none 3
  - gas: none
  - An exotic `glowing` planet has spores.
- **Flora families and density.**
  - forest: forest 0.8–1.6 or temperate 0.6–1.2, evenly
  - ocean: ocean 0.4–1
  - desert: desert 0.1–0.5
  - ice: ice 0–0.3
  - lava: volcanic 0–0.3
  - rock: desert 0–0.2
  - gas: null
- **Fauna density.** ice 0.3–1, desert 0.2–0.8, forest 0.6–1.4, ocean 0.4–1. rock: 0 four times in five, else 0.2–0.5. lava: 0 nine times in ten, else 0.2–0.4. gas: null.
  - A planet has 1–3 plans, each a different body: `beast` (herd, [4, 8]), `flyer` (flock, [4, 8]) or `walker` (wander, [1, 3]).
  - A plan’s tint is the palette’s `rock` or `accent`.
- **Exotic.** A planet is exotic when its exotic stream draws under 0.05; the four kinds are equally likely.
- **POIs.** The count weights are 0: 1, 1: 3, 2: 3, 3: 2. gas and ringed have none.
  - Kind weights: ruins 3, wreck 2, outpost 2, monolith 1, signal 2.
  - A held system (one with a faction) doubles the outpost’s weight, and pirates double the wreck’s.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { FAMILIES, SLOT_JITTER, colourDistance, dominantOf, varietyOf } from './variety';
import { SEEDED_EXPANSE, TYPE_LOOK } from './planetTables';
import { randomSystems } from './fixtures/generated';

const templateDominant = (type) => dominantOf(TYPE_LOOK[type].palette);

describe('the palette slots', () => {
  it('keep every slot of every family apart, jitter and all, within a family and across', () => {
    const all = Object.entries(FAMILIES).filter(([f]) => f !== 'ringed').flatMap(([f, { slots }]) => slots.map((s) => [f, s]));
    const gap = 1 + 2 * Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(colourDistance(all[i][1], all[j][1]), `${all[i][0]} ${all[i][1]} · ${all[j][0]} ${all[j][1]}`).toBeGreaterThanOrEqual(gap);
    for (const { slots } of Object.values(FAMILIES)) expect(slots.length).toBeGreaterThanOrEqual(8);
  });
});

describe('varietyOf', () => {
  const systems = randomSystems(500, 1);

  it('gives every pair of siblings a hue and lightness distance of at least 1 (500 planets)', () => {
    expect(systems.flat().length).toBeGreaterThanOrEqual(500);
    for (const rows of systems) {
      const v = rows.map(varietyOf);
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) expect(colourDistance(v[i].dominant, v[j].dominant), `${rows[i].id} ${rows[j].id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps a generated planet clear of its seeded siblings', () => {
    const seededIn = (sys) => SEEDED_EXPANSE.filter(([id]) => id.startsWith(`${sys}:`));
    for (const sys of ['e:1,0:1', 'e:1,0:2']) for (let j = 3; j < 7; j++) for (const type of ['rock', 'ice', 'desert', 'forest', 'lava', 'ocean', 'gas']) {
      const v = varietyOf({ id: `${sys}:${j}`, name: 'X', type, seed: String(1000n + BigInt(j)), system: { faction: null, traffic: 0, hazard: null } });
      for (const [id, t] of seededIn(sys)) expect(colourDistance(v.dominant, templateDominant(t)), `${sys}:${j} ${type} · ${id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('is the planet’s alone: the same row gives the same variety, with no sibling read', () => {
    const row = systems[3][0];
    expect(varietyOf({ ...row })).toEqual(varietyOf(row));
    expect(varietyOf.length).toBe(1);
  });

  it('keeps each type in its family', () => {
    for (const row of systems.flat()) {
      const v = varietyOf(row);
      const box = FAMILIES[v.family].slots;
      expect(box.some((s) => colourDistance(s, v.dominant) <= Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08) + 1e-9), row.id).toBe(true);
    }
  });

  it('spreads the kinds: every character, weather, POI kind and flora family shows; about one in twenty is exotic', () => {
    const v = randomSystems(2000, 2).flat().map(varietyOf);
    const seen = (f) => new Set(v.map(f).flat().filter(Boolean));
    expect([...seen((x) => x.character?.kind)].sort()).toEqual([...CHARACTERS].sort());
    for (const w of ['none', 'rain', 'snow', 'dust', 'ash', 'spores']) expect(seen((x) => x.weather.kind).has(w), w).toBe(true);
    for (const k of ['ruins', 'wreck', 'outpost', 'monolith', 'signal']) expect(seen((x) => x.poiKinds).has(k), k).toBe(true);
    for (const f of ['forest', 'temperate', 'desert', 'ice', 'ocean', 'volcanic']) expect(seen((x) => x.flora?.family).has(f), f).toBe(true);
    const share = v.filter((x) => x.exotic).length / v.length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.07);
  });

  it('takes a moon as its family, its siblings by moon index', () => {
    const moon = (k, type) => varietyOf({ id: `e:3,-2:1:0:${k}`, name: 'M', type, seed: String(77n + BigInt(k)), parent: 'e:3,-2:1:0' });
    expect(moon(0, 'rocky').family).toBe('rock');
    expect(moon(1, 'icy').family).toBe('ice');
    expect(colourDistance(moon(0, 'rocky').dominant, moon(1, 'rocky').dominant)).toBeGreaterThanOrEqual(1);
  });
});
```

`randomSystems(planets, seed)` builds systems until there are `planets` rows. Each system:
- is in a seeded sector with x and z in −40…40, never (1, 0) or (0, 0)
- has a system index 0–23 and 1–7 planets with indices `0…n−1`
- draws each planet’s type with the generator’s weights: rock 5, ice 3, gas 3, lava 1.5, ocean 1.5, desert 2, forest 1, ringed 1
- gives each planet a seed (a string bigint), a radius within its type’s range (`expanse/gen/tables.js:25-90`), moons 0–3, rings at 5 %
- gives each planet `system: { faction: null | { id: 'empire' }, traffic: 0…1, hazard: null | 'pirates' }`

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/variety.test.js`
Expected: FAIL, `Failed to resolve import "./variety"`.

- [ ] **Step 3: Build `variety.js` and the fixture by the rules above**

If the slot test fails, move the slot the message names; don’t move the threshold.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/variety.test.js`
Expected: PASS, under a second.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/variety.js src/lib/land/flight/variety.test.js src/lib/land/flight/fixtures/generated.js
git commit -m "Give each generated planet its own colours, land, sky, weather, life and places"
```

---

### Task 7: The flight’s field on a round planet

**Files:**
- Modify: `src/lib/land/flight/field.js:35-65`. Add the round branch first, and add `fieldKey`.
- Modify: `src/components/expanse/flight/terrain.worker.js:20-21`. Cache by `fieldKey(spec)`, not `spec.id`.
- Test: `src/lib/land/flight/field.test.js` and `src/components/expanse/flight/mapWorker.test.js`

**Interfaces:**
- Consumes: `chartOf` (Task 2); `sphereField` (Task 4); `roundSpec` (fixture).
- Produces:
  - `planetField(spec)`: for `spec.round`, `heightAt(x, z)` is `sphereField(spec).heightAt(chart.toDir(x, z))`, with `chart = chartOf(spec.round.at, spec.round.radius)`. `biomeAt` works the same way. A plane spec takes today’s path unchanged.
  - `fieldKey(spec) → string`: `spec.id` for a plane, and `` `${spec.id}@${spec.round.at.join(',')}` `` for a round spec.

- [ ] **Step 1: Write the failing tests**

```js
import { fieldKey } from './field';
import { sphereField } from './sphereField';
import { roundSpec } from './fixtures/generated';

describe('planetField on a round planet', () => {
  const spec = roundSpec({ type: 'ice', kind: 'ridges', radius: 18000 });
  const g = planetField(spec);
  const R = spec.round.radius;

  it('reads the sphere through the chart: its middle is the spot', () => {
    expect(g.heightAt(0, 0)).toBe(sphereField(spec).heightAt(spec.round.at));
  });

  it('comes round to the same ground after 2πR, any way it flies', () => {
    for (const a of [0, 0.7, 2, 3.9, 5.5]) for (const d of [10, 2500, 41000]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      const k = d + 2 * Math.PI * R;
      expect(g.heightAt(ux * k, uz * k)).toBeCloseTo(g.heightAt(ux * d, uz * d), 6);
    }
  });

  it('is finite and gentle out to three turns, the far side included', () => {
    const rnd = seeded(13);
    for (let i = 0; i < 1500; i++) {
      const d = rnd() * 3 * Math.PI * R, a = rnd() * Math.PI * 2;
      const [x, z] = [Math.cos(a) * d, Math.sin(a) * d];
      const h = g.heightAt(x, z);
      expect(Number.isFinite(h)).toBe(true);
      const b = rnd() * Math.PI * 2;
      expect(Math.abs(g.heightAt(x + Math.cos(b) * 4, z + Math.sin(b) * 4) - h)).toBeLessThanOrEqual(60);
    }
    for (let k = 0; k < 16; k++) expect(Number.isFinite(g.heightAt(Math.cos(k) * Math.PI * R, Math.sin(k) * Math.PI * R))).toBe(true);
  });

  it('keys a round field by its spot, a plane one by its id', () => {
    expect(fieldKey(planetSpecOf('hoth'))).toBe('hoth');
    expect(fieldKey(spec)).not.toBe(fieldKey({ ...spec, round: { ...spec.round, at: [0, 1, 0] } }));
  });
});
```

In `mapWorker.test.js`, add `'keeps a round planet’s fields apart by spot'`:
- Ask the worker for leaf `leafOf(6, 0, 0)` with `n: 9` twice.
- The first spec is `roundSpec()`.
- The second is the same spec with `round.at: [0, 0, 1]`.
- The two answers’ `heights` differ.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/field.test.js src/components/expanse/flight/mapWorker.test.js`
Expected: FAIL. `fieldKey` is missing, and a round spec reaches `stackOf` and its empty relief, so the heights are flat.

- [ ] **Step 3: Implement the branch and the key; switch the worker’s `fields` Map to `fieldKey`**

- [ ] **Step 4: Run them, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS, `the roster` included.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/field.js src/lib/land/flight/field.test.js src/components/expanse/flight/terrain.worker.js src/components/expanse/flight/mapWorker.test.js
git commit -m "Fly a round planet as a plane: the chart round the landing spot"
```

---

### Task 8: Generated specs

**Files:**
- Create: `src/lib/land/flight/generated.js` and `src/lib/land/flight/generated.test.js`
- Modify: `src/lib/land/flight/planetSpec.js`. Task 5’s non-roster branch now returns `generatedSpecOf(row, family)`.
- Modify: `src/lib/land/flight/planetTables.js`. Add `WATER_LOOKS`, moved unchanged from `water.js:14-19`.
- Modify: `src/components/expanse/flight/water.js`:
  - `:14-19` becomes `import { WATER_LOOKS as LOOKS }`.
  - `:26`’s colour becomes `w.colour ?? look.color`.

**Interfaces:**
- Consumes: `varietyOf` (Task 6); `roundBiomes`, `TYPE_LOOK`, `TYPE_BIOMES`, `expand` and `PLANE_CLIMATE` (`planetTables.js`); `sphereField` and `CLIMATE_SPHERE` (Task 4); `chartOf` and `angleBetween` (Task 2); `fold`.
- Produces:
  - `groundRadius(row) → metres`: `15000 + 45000 × clamp((row.radius − 18) / 52, 0, 1)`. It’s 15,000 for a moon or a missing radius.
  - `POI_NAMES = { ruins: 'Ruins', wreck: 'A crashed ship', outpost: 'An outpost', monolith: 'A monolith', signal: 'A signal' }`.
  - `generatedSpecOf(row, family) → spec`, with all 17 roster keys plus the `ROSTER_EXTRA` keys:
    - **`kind`, `parent`, `buildable`.** `kind` is `'moon'` when the id has a moon part. `parent` is `row.parent ?? null`. `buildable` is false.
    - **The variety fields.** `exotic`, `sky`, `weather`, `flora`, `fauna` and `character` are the variety’s. `palette` is `variety.palette`.
    - **`fog`.** `{ near: round(1500 − 900·haze), far: round(21000 − 9000·haze) }`.
    - **`clutter`.** It’s `TYPE_LOOK[family].clutter` with `trunk` and `spire` rows’ `perKm2` times `flora.density`. Then the exotic’s rows are added: crystal adds `{ kind: 'crystal', perKm2: 25, depth: 5 }`. glowing and floating add a `trunk` row at 14 if there’s none. spires adds `{ kind: 'spire', perKm2: 30, depth: 5, size: 1.4 }`.
    - **`ground`.** It’s `TYPE_LOOK[family].ground`, with its palette’s `low`, `high`, `rock`, `accent` and `deep` swapped for the variety’s.
      - `hLow` is `(water?.level ?? 0) + 2`, and `hHigh` is `clamp(peaks × 0.5, 60, 500)`.
      - A template `wet` keeps its colour and band, with `level` set to the water’s.
    - **gas and ringed:** a plane cloud deck as today, recoloured.
      - `round: null`, `soft: true`, `climate: PLANE_CLIMATE`.
      - `biomes: expand(TYPE_BIOMES[family], seed)`.
      - `pois: []`, `water: null`.
    - **Every other family:** round.
      - `round: { radius: groundRadius(row), at }`, `soft: false`, `step: 0`, `pits: []`.
      - `climate: CLIMATE_SPHERE`, `biomes: roundBiomes(family)`.
      - `water: variety.water && { kind, level: 0, colour? }`.
      - `landmarks: []`, `hero: null`.
  - **The POIs**, for each of `variety.poiKinds` in turn.
    - The candidates are `FIB_512`’s first 256 directions, turned by a seeded rotation and read in seeded order.
    - A POI takes the first candidate that meets all three rules:
      - `sphereField(spec0).sample(d).h > (water?.level ?? −∞) + 4`
      - `slope < 0.12`
      - at least 0.3 rad from every POI already placed
    - `spec0` is the spec with `pois: []`.
    - It gets `{ id: 'poi-<n>', name: POI_NAMES[kind], kind, dir, r: 60–140, edge: 80–120 }`. A kind with no candidate is skipped.
  - **The chart’s origin.** `round.at` is the first POI’s `dir`, else the first candidate that is dry and gentle, else candidate 0. Each POI’s `at` is then `chartOf(round.at, radius).toChart(dir)`, rounded to centimetres, with `+ 0` so no −0 is left.
  - `seed` is `fold(BigInt(row.seed))`, as the seeded planets’ is (`planetSpec.js:49`).
  - `chartedAt(spec, dir) → spec`. For a round spec, `round.at` becomes `unit(dir)` and every POI’s `at` is charted again; everything else stays. A plane spec comes back unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { POI_NAMES, chartedAt, generatedSpecOf, groundRadius } from './generated';
import { sphereField } from './sphereField';
import { angleBetween, dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

// every key a roster spec has (its 17 and ROSTER_EXTRA's)
const KEYS = Object.keys(planetSpecOf('hoth'));
const rows = randomSystems(60, 4).flat();
const lookup = lookupOf(rows);
const landable = rows.filter((r) => !['gas', 'ringed'].includes(r.type)).slice(0, 40);

describe('generatedSpecOf', () => {
  it('makes a round planet of every landable type, and a moon, with every field a spec has', () => {
    for (const r of [...landable, ...MOONS]) {
      const s = specWith(r.id, { expanse: (id) => lookup(id) ?? MOONS.find((m) => m.id === id) ?? null });
      for (const k of KEYS) expect(k in s, `${r.id} ${k}`).toBe(true);
      expect(s.round.radius).toBeGreaterThanOrEqual(15000);
      expect(s.round.radius).toBeLessThanOrEqual(60000);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('sizes the ground from the universe radius', () => {
    expect(groundRadius({ radius: 18 })).toBe(15000);
    expect(groundRadius({ radius: 70 })).toBe(60000);
    expect(groundRadius({ radius: 140 })).toBe(60000);
    expect(groundRadius({ radius: 44 })).toBe(37500);
    expect(groundRadius({})).toBe(15000);
  });

  it('puts its places on dry, gentle land, apart, and starts the chart at the first', () => {
    for (const r of landable) {
      const s = specWith(r.id, { expanse: lookup });
      const f = sphereField(s);
      s.pois.forEach((p, i) => {
        expect(POI_NAMES[p.kind]).toBe(p.name);
        expect(f.sample(p.dir).h).toBeGreaterThan((s.water?.level ?? -Infinity) + 3);
        for (const q of s.pois.slice(0, i)) expect(angleBetween(p.dir, q.dir)).toBeGreaterThanOrEqual(0.3);
      });
      if (s.pois.length) expect(Math.hypot(...s.pois[0].at)).toBe(0);
    }
  });

  it('gives the seeded thirteen no new places', () => {
    for (const p of PLANETS.slice(37)) expect(planetSpecOf(p.id).pois).toEqual([]);
  });

  it('charts again at any spot: the origin and the POIs move, nothing else', () => {
    const s = specWith(landable[0].id, { expanse: lookup });
    const t = chartedAt(s, dirOfUv(0.1, 0.3));
    expect(angleBetween(t.round.at, dirOfUv(0.1, 0.3))).toBeLessThan(1e-12);
    expect({ ...t, round: null, pois: null }).toEqual({ ...s, round: null, pois: null });
    expect(t.pois.map((p) => p.dir)).toEqual(s.pois.map((p) => p.dir));
  });

  it('is the same spec from any lookup that knows the row (the universe’s or the flight’s)', () => {
    for (const r of landable.slice(0, 10)) expect(specWith(r.id, { expanse: [r] })).toEqual(specWith(r.id, { expanse: lookup }));
  });

  it('wears its variety in the flight: the sky in its palette, the haze in its fog', () => {
    const s = specWith(landable[1].id, { expanse: lookup });
    expect(s.palette.skyLow).toBe(s.sky.low);
    expect(s.fog.far).toBe(Math.round(21000 - 9000 * s.sky.haze));
  });

  it('keeps a gas giant a plane cloud deck, recoloured', () => {
    const g = rows.find((r) => r.type === 'gas');
    const s = specWith(g.id, { expanse: lookup });
    expect(s).toMatchObject({ round: null, soft: true, pois: [], water: null, buildable: false });
  });

  it('shows several biomes on its sphere', () => {
    let many = 0;
    for (const r of landable) {
      const f = sphereField(specWith(r.id, { expanse: lookup }));
      const count = new Map();
      for (let j = 0; j < 32; j++) for (let i = 0; i < 64; i++) { const b = f.biomeAt(dirOfUv((i + 0.5) / 64, (j + 0.5) / 32)); count.set(b, (count.get(b) ?? 0) + 1); }
      const big = [...count.values()].filter((n) => n >= 0.03 * 2048).length;
      expect(big, r.id).toBeGreaterThanOrEqual(2);
      if (big >= 3) many++;
    }
    expect(many / landable.length).toBeGreaterThanOrEqual(0.9);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/generated.test.js`
Expected: FAIL, `Failed to resolve import "./generated"`.

- [ ] **Step 3: Build `generated.js`, wire it into `planetSpec.js`, and move `WATER_LOOKS`**

If `'shows several biomes'` fails, raise `CLIMATE_SPHERE.stretch` (Task 4) a tenth at a time; that test is the decision, the number is tuning.

- [ ] **Step 4: Run the flight’s tests, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS. `the roster` and `planets.test.js` both pass; `'flies to any Expanse planet by id'` now gets a round spec.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight src/components/expanse/flight/water.js
git commit -m "Build every generated planet and moon round, from its own variety"
```

---

### Task 9: Life and places from the variety

**Files:**
- Modify: `src/lib/land/flight/lifeTables.js:369-406`. Make it `expanseLife(type, biomes, system, fauna = null)`, and have `lifeFor` pass `spec.fauna ?? null`.
- Modify: `src/lib/land/flight/landmarkTables.js`. Add `POI_KITS`, `FLORA_TRUNKS`, `EXOTIC_KIT` and `landmarkRowsOf` after `LANDMARKS` (126); `clutterKitOf` (222-224) reads `spec.flora` and `spec.exotic`.
- Modify: `src/components/expanse/flight/landmarks.js:146`. It becomes `const rows = landmarkRowsOf(spec, poi);`.
- Test: `lifeTables.test.js`, `landmarkTables.test.js`, `src/components/expanse/flight/landmarks.test.js`

**Interfaces:**
- Consumes: the spec’s `fauna`, `flora`, `exotic` and `pois[].kind` (Task 8).
- Produces:
  - **`expanseLife` with a `fauna` argument.** When `fauna` is given (not null), it replaces the `FAUNA[type]` row (line 392):
    - Each plan is `gnd({ beast: 'grazer', flyer: 'skimmer', walker: 'strider' }[body], role, 0.3 × fauna.density, group, { body, tint, kind: 'wild', ...(body === 'flyer' ? { alt: [6, 50] } : {}) })`.
    - With `density` 0 there are no fauna rows.
    - Rows for factions and pirates are as today.
  - **`POI_KITS[kind] → rows`.** Rows use `one` and `ring`, with only the kinds and kit models `LANDMARKS` already uses, and at least `LANDMARK_MIN` rows each:
    - **ruins:** `one('ruins')`, `one('stonehead', [30, 10], 2.4)`, `one('ruins', [-40, 22], 0.7)`, `one('stonehead', [-12, -34], 0.9, 0.7)`
    - **wreck:** `{ ...one(k('Spaceship_RaeTheRedPanda'), [0, 0], 0.6, 4), pitch: 0.35, roll: -0.5 }`, `one('crates', [18, 6], 0.4)`, `one('barrel', [-14, 10])`, `one('fire', [8, -14])`
    - **outpost:** `base(36)`
    - **monolith:** `one(k('MetalSupport'), [0, 0], 0, 9)`, `...ring(k('Rock_Large_1'), 5, 26, 1.2)`
    - **signal:** `one(k('Roof_Radar'), [0, 0], 0, 5)`, `one(k('Roof_Antenna'), [12, 4], 0.5, 5)`, `one(k('SolarPanel_Ground'), [-14, 6], 0.4, 3)`, `...ring('lamp', 3, 20)`
  - **`FLORA_TRUNKS`.** The four green trees already in the tables: `GiantPine_2` 4.6, `GiantPine_4` 4.8, `GiantPine_5` 5 and `CommonTree_3` 5 (from the naturemega kit).
  - **`EXOTIC_KIT`:**
    - `glowing: { trunk: Tree_Light_1, size 3 }`
    - `floating: { trunk: Tree_Floating_1, size 3 }`
    - `spires: { spire: Tree_Spikes_2, size 1.4 }`
    - `crystal: {}` (crystal is the code-built clutter kind)
    - All are from the space kit.
  - `landmarkRowsOf(spec, poi) → rows | undefined`: `LANDMARKS[spec?.id]?.[poi?.id] ?? POI_KITS[poi?.kind]`.
  - **`clutterKitOf(spec)`.** It’s today’s two tables, then `{ trunk: FLORA_TRUNKS[floor(pick × 4)] }` when `spec.flora?.family` is forest or temperate, then `EXOTIC_KIT[spec.exotic]`.

- [ ] **Step 1: Write the failing tests**

In `lifeTables.test.js`:
- `'lets a generated planet’s fauna walk it, scaled by its density'`. Call `expanseLife('forest', biomes, { faction: null, traffic: 0, hazard: null }, { density: 1, plans: [{ body: 'beast', role: 'herd', tint: '#806040', group: [4, 8] }, { body: 'flyer', role: 'flock', tint: '#c0c0c0', group: [4, 8] }] })`. Its `ground` has two rows: `model: 'figure'`, `perKm2: 0.3`, the bodies in order, and `alt` on the flyer.
- `'has no wild rows with no fauna'`: with `{ density: 0, plans: [...] }`, `ground` has no `kind: 'wild'` row.

In `landmarkTables.test.js`:
- Extend `'names only kit models the kits have, and no rig'`’s `named` list with `POI_KITS`’ kit rows and with `FLORA_TRUNKS` and `EXOTIC_KIT` values. Keep `'dresses the ground only in trees with green leaves'` as it is; `EXOTIC_KIT` isn’t green on purpose and isn’t in it.
- Add `'stands every generated POI kind on at least LANDMARK_MIN things'`.
- Add `'gives a generated planet a tree from its flora, and an exotic one its own'`. For `clutterKitOf({ id: 'e:3,-2:0:1', type: 'forest', flora: { family: 'forest', pick: 0.6 } })`, `trunk.name` is `'GiantPine_5'`. With `exotic: 'glowing'` as well, `trunk.name` is `'Tree_Light_1'`.
- Add `'reads a generated POI’s rows by its kind, a named one by its id'`.

In `landmarks.test.js`, add `'stands a generated POI from its kind’s list'`. `placementsFor({ id: 'e:3,-2:1:0', type: 'rock' }, { id: 'poi-0', kind: 'outpost', at: [100, 200], r: 80 }, { heightAt: () => 5 }).list.length` is at least 3.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/lifeTables.test.js src/lib/land/flight/landmarkTables.test.js src/components/expanse/flight/landmarks.test.js`
Expected: FAIL. The fourth argument is ignored, and `POI_KITS` and `landmarkRowsOf` are missing.

- [ ] **Step 3: Implement the tables and the readers**

- [ ] **Step 4: Run the flight’s tests, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS. `the roster` passes because the 50 have `fauna`, `flora` and `exotic` null, and `planets.test.js:45-51` still sees the seeded life as it was.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/lifeTables.js src/lib/land/flight/lifeTables.test.js src/lib/land/flight/landmarkTables.js src/lib/land/flight/landmarkTables.test.js src/components/expanse/flight/landmarks.js src/components/expanse/flight/landmarks.test.js
git commit -m "Let a generated planet's fauna, trees and places come from its variety"
```

---

### Task 10: The orbit map

**Files:**
- Create: `src/lib/land/flight/orbitMap.js` and `src/lib/land/flight/orbitMap.test.js`

**Interfaces:**
- Consumes: `sphereField(spec).sample` and `SLOPE_STEP` (Task 4); `planetField` (Task 7); `chartedAt` (Task 8); `dirOfUv` (Task 2); `WATER_LOOKS` (Task 8); `noise3For`.
- Produces:
  - `ORBIT_MAP_SIZE = { low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] }`, and `orbitMapSize(tier) → { width, height }`, falling back to `mid`.
  - `PLANE_WINDOW = 40000` (metres across u; half that across v).
  - `groundColour(spec, { h, slope }) → { rgb: [r, g, b], water: boolean }`. The bytes are sRGB; the mixing is done in linear light. It is `lib/three/groundLook.js:165-176`’s rule at the mean of its noises:
    - The palette is `spec.ground?.palette ?? { ...spec.palette, hLow: 0, hHigh: 120 }` (`ground.js:38`’s fallback).
    - It starts at `mix(low, high, smoothstep(hLow, hHigh, h))`.
    - The accent mixes in at `accentCover × 0.5`.
    - Rock (× 0.98) mixes in by `smoothstep(rockAt, rockAt + 0.14, slope)`.
    - `wet` mixes in by `(1 − smoothstep(level, level + (band ?? 1.5), h)) × 0.75`.
    - **Under the water** (`spec.water && h < water.level`):
      - The water colour is `water.colour ?? WATER_LOOKS[kind].color`, mixed 0.15 toward `palette.accent` as at `water.js:26`.
      - Lava is `mix(that, glow, 0.6)`. Anything else is `mix(ground, water, opacity)`.
      - `water` is true.
  - `bakeOrbitMap(spec, { width = 256, height = 128 } = {}) → { width, height, rgba: Uint8ClampedArray, biome: Uint8Array }`. Texel `(i, j)` is at `dirOfUv((i + 0.5)/width, (j + 0.5)/height)`. Alpha is 0 under water and 255 elsewhere. There are three kinds of spec:
    - **Round:** `sample(dir)` gives `groundColour`’s colour and the biome.
    - **gas or ringed:** bands. Let `n = noise3For(seed, { frequency: 2.2, octaves: 4, warp: 0.25 })(dir)` and `t = sin((dir.y × B + 0.6n) × π)`, with B from 6 to 11, seeded. The colour is `mix(low, high, 0.5t + 0.5)`, with `accent` where `|n| > 0.55`. The biome is 0.
    - **Any other plane spec** (the seeded 13 and the named worlds): a window of the plane. It’s `x = (u − 0.5) × PLANE_WINDOW` and `z = (v − 0.5) × PLANE_WINDOW / 2`, with the slope from `planetField` at ±`SLOPE_STEP` as `sample`’s, and the biome `biomeAt(x, z)`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { ORBIT_MAP_SIZE, bakeOrbitMap, groundColour, orbitMapSize } from './orbitMap';
import { planetField } from './field';
import { chartedAt } from './generated';
import { SLOPE_STEP } from './sphereField';
import { dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

const rows = randomSystems(40, 6).flat();
const lookup = lookupOf(rows);
const round = rows.filter((r) => ['rock', 'ice', 'ocean', 'forest'].includes(r.type)).slice(0, 4).map((r) => specWith(r.id, { expanse: lookup }));

describe('bakeOrbitMap', () => {
  it('is 256 × 128 RGBA unless asked, and 512 × 256 on high and up', () => {
    const m = bakeOrbitMap(round[0], { width: 32, height: 16 });
    expect(m.rgba).toHaveLength(32 * 16 * 4);
    expect(m.biome).toHaveLength(32 * 16);
    expect(ORBIT_MAP_SIZE).toEqual({ low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] });
    expect(orbitMapSize('high')).toEqual({ width: 512, height: 256 });
    expect(orbitMapSize('nonsense')).toEqual({ width: 256, height: 128 });
  });

  it('is the same bytes twice', () => {
    expect(bakeOrbitMap(round[1], { width: 48, height: 24 })).toEqual(bakeOrbitMap(round[1], { width: 48, height: 24 }));
  });

  it('shows what the ground shows: each texel is the flight’s ground at the chart’s middle there', () => {
    const W = 64, H = 32;
    for (const spec of round) {
      const m = bakeOrbitMap(spec, { width: W, height: H });
      for (let k = 0; k < 12; k++) {
        const i = (k * 37) % W, j = (k * 11 + 3) % H;
        const g = planetField(chartedAt(spec, dirOfUv((i + 0.5) / W, (j + 0.5) / H)));
        const s = SLOPE_STEP;
        const gx = (g.heightAt(s, 0) - g.heightAt(-s, 0)) / (2 * s), gz = (g.heightAt(0, s) - g.heightAt(0, -s)) / (2 * s);
        const want = groundColour(spec, { h: g.heightAt(0, 0), slope: 1 - 1 / Math.hypot(1, gx, gz) });
        const at = (j * W + i) * 4;
        expect([...m.rgba.slice(at, at + 3)], `${spec.id} ${i},${j}`).toEqual(want.rgb);
        expect(m.rgba[at + 3]).toBe(want.water ? 0 : 255);
        expect(m.biome[j * W + i]).toBe(g.biomeAt(0, 0));
      }
    }
  });

  it('has no seam where it wraps: its last column meets its first as any two neighbours meet', () => {
    const W = 128, H = 64;
    const m = bakeOrbitMap(round[2], { width: W, height: H });
    const px = (i, j) => [...m.rgba.slice((j * W + i) * 4, (j * W + i) * 4 + 3)];
    const apart = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
    let inner = 0, wrap = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 1; i < W; i++) inner = Math.max(inner, apart(px(i - 1, j), px(i, j)));
      wrap = Math.max(wrap, apart(px(W - 1, j), px(0, j)));
    }
    expect(wrap).toBeLessThanOrEqual(inner + 8);
  });

  it('bakes every kind of spec and never throws: the fifty, a moon, a gas giant', () => {
    const gas = specWith(rows.find((r) => r.type === 'gas').id, { expanse: lookup });
    const moon = specWith(MOONS[0].id, { expanse: MOONS });
    for (const spec of [...PLANETS.map((p) => planetSpecOf(p.id)), moon, gas]) {
      const m = bakeOrbitMap(spec, { width: 16, height: 8 });
      expect(m.rgba, spec.id).toHaveLength(16 * 8 * 4);
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/orbitMap.test.js`
Expected: FAIL, `Failed to resolve import "./orbitMap"`.

- [ ] **Step 3: Implement `orbitMap.js`**

`sample(dir)` reads the same chart (`chartOf(dir, R)`) as `planetField(chartedAt(spec, dir))`, and `unit` leaves a unit vector alone, so the texel test can be exact. If it is off by one in a channel, the two paths differ in float order: make both go through `chartOf(dir, R).toDir`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/orbitMap.test.js`
Expected: PASS, under a second.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/orbitMap.js src/lib/land/flight/orbitMap.test.js
git commit -m "Bake a planet's orbit map from the ground the flight flies over"
```

---

### Task 11: The bake in a worker, cached in memory

**Files:**
- Create: `src/lib/land/flight/orbitMap.worker.js` and `src/lib/land/flight/orbitMap.worker.test.js`
- Create: `src/lib/land/flight/orbitMaps.js` and `src/lib/land/flight/orbitMaps.test.js`

**Interfaces:**
- Consumes: `bakeOrbitMap` and `orbitMapSize` (Task 10); `createWorkerPool`’s face (`runtime/workers.js:14-17`): `define(name, make, { size })`, `request(name, msg) → Promise<answer | null>` and `close(name)`.
- Produces:
  - **The worker.** Given `{ key, spec, width, height }`, it posts `{ key, width, height, rgba, biome }` with `[rgba.buffer, biome.buffer]` transferred. It ignores `{ type: 'cancel' }`. Its header follows `terrain.worker.js:1-7`.
  - `ORBIT_WORKER = 'flight-orbit-map'` and `makeOrbitWorker() → new Worker(new URL('./orbitMap.worker.js', import.meta.url), { type: 'module' })`. There’s precedent for a worker in lib in `lib/level/png16Off.js:14`.
  - `createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) → { get(spec, tier) → Promise<map | null>, peek(spec, tier) → map | null, stats() → { cached, flying }, dispose() }`, where:
    - It calls `workers.define(ORBIT_WORKER, make, { size: 1 })` once.
    - The key is `` `${spec.id}:${width}x${height}` ``.
    - It answers from the cache or from the bake already in flight.
    - A null answer resolves null and isn’t cached.
    - It keeps at most `cap` maps and drops the least recently used.
    - `dispose` closes the pool’s group and clears the cache.

- [ ] **Step 1: Write the failing tests**

`orbitMap.worker.test.js` follows `mapWorker.test.js`’s pattern: a `globalThis.self` with `postMessage`, then `await import('./orbitMap.worker.js')`.
- `'answers a bake with its buffers handed over'`, using `roundSpec()` at 16 × 8.
- `'says nothing to a cancel'`.

`orbitMaps.test.js` uses a fake pool, `{ define, request: vi.fn(async (name, msg) => answers.shift()?.(msg) ?? null), close: vi.fn() }`:

```js
it('bakes once for two asks at once, and serves the next from memory', async () => {
  const maps = createOrbitMaps({ workers: pool, make: () => null });
  const [a, b] = await Promise.all([maps.get(spec, 'mid'), maps.get(spec, 'mid')]);
  expect(a).toBe(b);
  expect(pool.request).toHaveBeenCalledTimes(1);
  expect(pool.request.mock.calls[0][1]).toMatchObject({ key: `${spec.id}:256x128`, width: 256, height: 128, spec });
  expect(await maps.get(spec, 'low')).toBe(a);
  expect(maps.peek(spec, 'mid')).toBe(a);
});
```

And these, one assertion line each:
- `'asks the high tier for the big map'`: the request’s key ends `:512x256`.
- `'forgets the least recently used past its cap'`: with `cap: 2`, ask for A, B, C, then A again. `request` has been called 4 times. `peek(C)` is still a map, and `peek(B)` is null: B went when A came back.
- `'answers null for a cancelled or failed bake, keeps nothing, asks again next time'`: the first answer is null, so `get` resolves null and `peek` is null. Asking again calls `request` a second time.
- `'closes its workers on dispose'`: `pool.close` is called with `ORBIT_WORKER`, and `stats().cached` is 0.
- `'stores nothing'`: read the source of `orbitMaps.js` and `orbitMap.js` (`readFileSync`). Neither matches `/localStorage|indexedDB|rt\.store|rt\.saves/`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.test.js`
Expected: FAIL, the modules don’t exist.

- [ ] **Step 3: Implement the worker and `orbitMaps.js`**

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/orbitMap.worker.js src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.js src/lib/land/flight/orbitMaps.test.js
git commit -m "Bake orbit maps in a worker and keep them in memory only"
```

---

### Task 12: Worlds you can’t build on

**Files:**
- Modify: `src/components/expanse/flight/shared.js:58-73` (`db`, `loader`, `owner`), `:131-137` (`build`) and `:219-222` (`prompt`)
- Test: `src/components/expanse/flight/shared.test.js`

**Interfaces:**
- Consumes: `spec.buildable` (Task 5).
- Produces: `readOnly = spec.buildable === false`, which does four things:
  - `db` is null, so there’s no loader, no sign-in and no durable read or write.
  - `build()` toasts “Nothing can be built on this world.” and places nothing, the visit’s own turrets included.
  - `prompt()` gives `{ build: false, unbuild: false, kept: false, ... }`.
  - The room (poses and shots, nothing durable) works as before.
  - A spec with no `buildable` key (the test’s hand-made ones) is as today.

- [ ] **Step 1: Write the failing tests**

```js
describe('a world nothing may be built on', () => {
  const generated = { id: 'e:3,-2:0:1', pois: [], buildable: false };

  it('says so, and places nothing, kept or not', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    await flush();
    expect(w.loader.placed).toHaveLength(0);
    expect(w.toasts()).toEqual(['Nothing can be built on this world.']);
    expect(w.draw.structures.size).toBe(0);
  });

  it('never reaches the durable world: no loader, nothing held', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap());
    expect(w.loader.updates).toBe(0);
    expect(w.shared.prompt(low())).toMatchObject({ build: false, unbuild: false, kept: false });
    expect(w.shared.built()).toEqual([]);
  });

  it('keeps the room: shots still go out', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap([], ['fire']));
    expect(w.online.sent.some(([t]) => t === 'shot')).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/expanse/flight/shared.test.js -t "nothing may be built"`
Expected: FAIL. A turret is placed and the toast is “Turret built.”.

- [ ] **Step 3: Implement the `readOnly` branches**

- [ ] **Step 4: Run the whole file to see it pass**

Run: `npx vitest run src/components/expanse/flight/shared.test.js`
Expected: PASS. Every existing test is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/expanse/flight/shared.js src/components/expanse/flight/shared.test.js
git commit -m "Keep generated planets read-only: nothing built, nothing written"
```

---

### Task 13: The contact sheet

**Files:**
- Create: `scripts/planet-contact-sheet.mjs`
- Modify: `scripts/lib/flight-island.mjs:26-46`. Add `'scripts/planet-contact-sheet.mjs'` to `ISLAND.files`, so it goes when the flight goes.

**Interfaces:**
- Consumes: the modules below, loaded through Vite SSR as `scripts/flight-expanse-fixture.mjs:14-23` does:
  - `/src/components/expanse/flight/planets.js` (`planetSpecOf`)
  - `/src/components/expanse/gen/sector.js` (`makeSector`) and `/src/components/expanse/gen/seed.js` (`UNIVERSE`)
  - `/src/lib/land/flight/orbitMap.js` (`bakeOrbitMap`, `groundColour`) and `/src/lib/land/flight/field.js` (`planetField`)
  - `/src/lib/seeded.js`
  - sharp
- Produces: `node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--out lab/planets/contact]`, which works like this:
  - **Choosing.** A seeded draw picks a sector with x and z in −30…30, never (0, 0) or (1, 0), then a system and a planet. It keeps types rock, ice, desert, forest, lava and ocean, skips the roster and repeats, and stops at `count`.
  - **For each planet:**
    - `n-orbit.png`: `bakeOrbitMap(spec, { width: 512, height: 256 })`.
    - `n-ground.png`: 384 × 384 px, the chart’s middle 3 km square at 8 m a pixel. The colour is `groundColour` × `(0.55 + 0.45 × max(0, normal · sun))`, with the sun from the north-west, 40° up.
  - **The sheet.** `sheet.png` has 6 columns × 4 rows. Each tile is the orbit map at 384 × 192 over the ground, with an SVG caption: name, type, character and exotic.
  - **The index.** `index.json` lists `[{ n, id, name, type, character, exotic, weather, sky }]`.
  - It prints the folder. It exits 1 if it found fewer than `count` planets.
  - `lab/*` is git-ignored (`.gitignore`, “the contact sheets the model scripts write for looking over”), so nothing it writes is committed.

- [ ] **Step 1: Write the script, with a header in the house style: what, how to run, and where it writes**

- [ ] **Step 2: Run it**

Run: `node scripts/planet-contact-sheet.mjs`
Expected: prints `lab/planets/contact: 24 planets`. The folder holds 24 `-orbit.png`, 24 `-ground.png`, `sheet.png` and `index.json`.

- [ ] **Step 3: Look at the sheet**

Open `lab/planets/contact/sheet.png` (the Read tool shows it). Check four things:
- No two tiles of one system read as one planet recoloured.
- Every orbit map shows land, and sea where the type has it.
- No ground is a flat, featureless plane.
- The orbit map’s colours are the ground’s.

Where one fails, tune `TERRAIN`, `CLIMATE_SPHERE` or the variety’s tables in their own task’s test, then run again.

- [ ] **Step 4: Check the island**

Run: `node scripts/flight-island.mjs --check && npx vitest run scripts/flight-island.test.mjs scripts/lib/flight-island.test.mjs`
Expected: `ok   <n> files on the island, …`, then PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/planet-contact-sheet.mjs scripts/lib/flight-island.mjs
git commit -m "Add a contact sheet of 24 generated planets, from orbit and on the ground"
```

---

### Task 14: Verification and pictures

**Files:** none new.

- [ ] **Step 1: Take the before shots on `main`.** Do this from a worktree of `main`, before this branch’s changes: the owner’s rule is that a changed picture is on purpose.
  - Run `node scripts/autopilot-check.mjs --only smoke --routes /fly/hoth,/fly/<id>`. `<id>` is the first rocky planet of sector (3, −2), which Task 13’s `index.json` names once the script has run there; or print it with `planets.test.js:37`’s line.
  - Also run `FLY=hoth node scripts/perf-probe.mjs fly` and keep its draws and triangles.

- [ ] **Step 2: Run the repo’s gates on the branch**

Run: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/flight-island.mjs --check`
Expected: every gate passes. In `npm test`, `the roster`, `TERRAIN_VERSION`, `planets.test.js` and `stack.test.js` are green.

- [ ] **Step 3: Take the after shots and compare**
  - Run the same smoke and probe.
  - `/fly/hoth` must be pixel for pixel the same, with the same draws and triangles.
  - `/fly/<id>` changes on purpose. It should show round-planet ground, its own colours, and a POI where one is in view.
  - Put both pairs in the pull request, with the numbers.

- [ ] **Step 4: Open the pull request.** It’s lane 5a’s one pull request, with a merge commit. The description lists the interfaces lane 5b consumes (below) and the findings for the owner.

## For lane 5b: what this lane hands over

- **Planet spec fields.**
  - Every spec has `kind`, `parent`, `buildable`, `round`, `character`, `sky`, `weather`, `flora`, `fauna` and `exotic`, beside today’s 17.
  - `round` is `{ radius, at }` on landable generated planets and moons, and null on the 50 and on gas giants.
  - `sky` is `{ low, high, haze, clouds, cloudColour, rings, moons }`: the orbit shader’s atmosphere and clouds.
  - `weather` is `{ kind, amount }`. `flora` is `{ family (lib/land/flora.js’s floraFor key), density, pick }`. `fauna` is `{ density, plans }`.
- **Landing at a spot.** `chartedAt(planetSpecOf(id), dirOfLatLon(lat, lon))` (`generated.js`, `sphere.js`) gives the spec whose chart origin, `(0, 0)` in the flight, is the spot dived at.
- **Charts and directions.**
  - `chartOf(at, radius).toDir(x, z)` and `.toChart(dir)` move between the flight and the sphere, for take-off back to orbit.
  - `latLonOfDir`, `dirOfLatLon`, `uvOfDir` and `dirOfUv` share `landings/biomes.js`’s layout.
- **The ground.** `sphereField(spec)` gives `heightAt(dir)`, `biomeAt(dir)` and `sample(dir) → { h, slope, biome }`. `planetField(spec)` is unchanged in shape, and the terrain worker keys fields by `fieldKey(spec)`.
- **The orbit map.**
  - `bakeOrbitMap(spec, { width, height }) → { width, height, rgba (sRGB, alpha 0 under water), biome }`.
  - `createOrbitMaps({ workers: rt.workers }).get(spec, tier)` makes it in a worker and caches it in memory. `orbitMapSize(tier)` gives the size.
  - The texture is sRGB, laid as three’s `SphereGeometry` lays it.
- **The read-only flag.** `spec.buildable === false` turns the shared world read-only (`shared.js`).
- **Islands.** The universe importing `lib/land/flight/*` counts as an island reference: lane 5b marks those rows `// planet flight` and lists the files in `ISLAND.rows`.

## Spec coverage

| Spec (section E, done item 6) | Task |
|---|---|
| One description, `planetSpecOf` | 5, 8 |
| Palette within the family, with a guaranteed hue and lightness distance from siblings | 6 (slots, the 500-planet test), 8 |
| Terrain character, water level, mountain height | 3, 6, 8 |
| Sky, haze, clouds, rings and moons in the sky | 6, 8 |
| Weather | 6, 8 |
| Flora: density, form family, colours | 6, 8, 9 |
| Fauna: density, body plans | 6, 9 |
| Points of interest (never on the seeded 13) | 6, 8, 9 |
| About 1 in 20 exotic | 6, 8, 9 |
| `TERRAIN_VERSION` by its rule (it stays 2) | 1, every task’s run of the lock |
| Ground as a field on the sphere, 3D noise, no seam, wraps | 3, 4 |
| The flight’s plane as an exponential-map chart | 2, 7 |
| Ground radius 15–60 km; climate against the circumference | 4, 8 |
| The 50 roster planets unchanged | 1 (the lock), 5 |
| Building on the 50 only, nothing written, no migration | 5, 12 |
| Moons: type and seed (lane 2), spec and ids | 5, 6, 8 |
| Orbit map: 256 × 128 / 512 × 256, a worker, never stored, cached | 10, 11 |
| The seeded 13’s map from a window of their plane | 10 |
| Contact sheet of 24 | 13 |

**Findings for the coordinator and the owner** (the work goes on as written):

1. **Biomes show from orbit through height only.** The flight’s ground shader (`lib/three/groundLook.js`, shared with the galaxy) colours by height and slope, not by biome.
   - So orbit-matches-ground holds by one shared colour rule (`groundColour`).
   - Biomes show from orbit only through their heights, roughness, water and rock.
   - A biome tint on the ground would need that shared shader, which is outside this lane.
2. **The chart has one singular point.** At πR from the landing spot (47–188 km away), the antipode, the ground is continuous and finite but stretched sideways the further out one flies. That’s inherent to the spec’s chart; re-centring the chart in flight would be lane 5b’s.
3. **Some described fields have no drawing lane.** Weather, cloud cover in the flight’s sky and flora colours are in the spec, but no lane in the table draws them in the flight; lane 5b draws the orbit shader and the walker.
4. **Gas giants’ orbit maps are banded, the seeded two included.** A window of a cloud deck’s plane is one flat colour; gas giants never land, so there’s no ground to match.
5. **Two seeded siblings look alike.** `e:1,0:0:3` and `e:1,0:0:5` are both ice in one system, so they keep one template palette (the roster rule beats uniqueness). Generated planets keep clear of the seeded ones.
6. **The moon and 3D-sector seam.** Moons resolve in the app once lane 2’s moon rows meet `moonRowOf`’s `moonList` name. Sectors off the middle layer resolve once lane 2’s 3D `makeSector` lands. Both are one-line joins.
7. **Systems with more than 8 planets.** The sibling guarantee holds up to 8 planets a system (7 today). If lane 2 appends more planets to a system, each family’s slot list grows first.
