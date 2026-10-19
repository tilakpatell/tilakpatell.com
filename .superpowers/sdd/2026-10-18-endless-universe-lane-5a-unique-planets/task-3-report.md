# Task 3 report: 3D noise and the terrain characters

**Status:** DONE (with three deliberate departures from the brief's literal recipe, all listed under "Tuned numbers" and "Concerns")
**Commit:** `88d4765ca` Give the flight 3D noise and eight terrain characters on a sphere (trailer per constraints.md)
**Base:** `f8b77bff2`

## What was implemented

- `src/lib/land/flight/fnl.js`
  - `noise3For(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp })` returns `(x, y, z) → −1…1`. It takes the same options as `noiseFor`. The warp is three hand-made noises at half the frequency (seeds `s ^ 0x5bd1e995`, `s ^ 0x165667b1`, `s ^ 0x27d4eb2f`), built the same way as the 2D warp.
  - `cells3For(seed, { frequency, jitter = 1 })` returns `(x, y, z) → distance ≥ 0`. It is Cellular with fractal None, the Euclidean distance and `CellularReturnType.Distance`, plus 1.
  - The class is still named only in this file.
- `src/lib/land/flight/characters.js` (new, 161 lines)
  - Exports `CHARACTERS`, `TERRAIN`, `FIB_512` (frozen) and `groundOf({ kind, sea, peaks, wet = false }, seed, radius) → (dir) → { h, land }`, following the brief's table and ruling R3.
  - Shape: `noise3For(seed, { frequency: TERRAIN[kind].shape, octaves: 5 })` of `unit(dir)`.
  - Shore: `s0` is the `sea` quantile, interpolated between neighbours, of shape over `FIB_512`. It is computed once per `groundOf` call.
  - Land: `land = smoothstep(s0, s0 + 0.12, shape)`.
  - Layers are evaluated at `p = dir × radius`, as the table gives them.
  - `FIB_512` comes from `dirOfLatLon` with the golden angle.
  - Unknown kinds throw a clear error. The check uses `Object.hasOwn`, so `toString` and other inherited keys are rejected too.
  - **Cache:** each kind and seed gets one built entry: its noises plus its shape over `FIB_512`, sorted. Entries live in a FIFO map of 32. The reason: every `new FastNoiseLite` allocates its gradient tables as instance fields, and the brief's "mark" test calls `groundOf` 4,500 times. With the cache that test takes 8–71 ms.
- `src/lib/land/flight/fixtures/generated.js` (new): `randomDirs(n, seed)` takes `seeded(seed)`, sets `z = 2r − 1`, picks an angle, and returns `[s·cos a, s·sin a, z]`. It imports only `../../../seeded.js`, and the pure-layer scan passes.
- `docs/stack/fastnoise-lite.md`
  - "Where it is used" gains `characters.js` and `sphereField.js` (plain names, as the existing rows are, so the not-yet-existing `sphereField.js` doesn't trip stack.test's path check).
  - The "3D noise" non-use bullet is replaced by a "3D for the round planets" line under "How the site uses it".
  - Gotchas gain two notes: the 3D warp is three noises, and `GetNoise` picks 2D or 3D by argument count. The second covers the lattice-zero trap described next.

## TDD evidence

**RED:** `npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.test.js`
```
FAIL  src/lib/land/flight/characters.test.js
Error: Cannot find module './characters' imported from .../characters.test.js
FAIL  fnl.test.js > noise3For > (all 5)        TypeError: noise3For is not a function
FAIL  fnl.test.js > cells3For > is a distance from 0 up, the same twice   TypeError: cells3For is not a function
Test Files  2 failed (2)    Tests  6 failed | 7 passed (13)
```

**First implementation, built exactly to the brief's table, before any tuning:**
```
× warps in 3D            AssertionError: expected +0 not to be +0
× craters: …             AssertionError: expected -221.76828590291754 to be greater than or equal to -190
Tests  2 failed | 22 passed (24)
```
- **warps in 3D:** I had picked (100, 100, 100) for my own test. At frequency 0.01 that point is an OpenSimplex2 lattice point, where the noise reads exactly 0. The warp's half-frequency noises also sit on their lattice there (0.5, 0.5, 0.5), so they read 0 and the point doesn't move. Warped and unwarped both read 0. I moved the sample to (100, 37, −80), where 0.1569 ≠ 0.2821; the brief names only "differs at one point".
- **craters:** this one is a real recipe problem, covered under "Tuned numbers".

**GREEN:** `npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.test.js docs/stack/stack.test.js`: 3 files, 65 tests passed.

**Final:** `npx vitest run src/lib/land/flight docs/stack/stack.test.js`: **18 files, 236 tests passed**. That includes the roster lock (`planetSpec.test.js > the roster > is as it was`) and `the pure layer`.

**Timings (vitest verbose), all well under 1 s:**

| Test | Time |
|---|---|
| noise3For tests | 1–16 ms |
| cells3For | 20–37 ms |
| continents | 87–140 ms |
| archipelago | 81–133 ms |
| canyons | 51–216 ms |
| mesas | 65–119 ms |
| dunes | 66–106 ms (once 328 ms in a loaded parallel run; 77 ms alone) |
| craters | 94–154 ms |
| ridges | 84–240 ms |
| plateaus | 48–178 ms |
| sea share | 8–36 ms |
| marks | 8–71 ms |

**Other checks:**
- `npx eslint` on the five JS files: clean.
- `node scripts/health.mjs --check --skip build`: within budget. The lib-imports-components boundary count did not move (487 of 489).

## Tuned numbers, and the measurement behind each

Measurements came from scratch scripts in `lab/` (git-ignored, not committed):
- `lab/task3-measure.mjs`: 4,000 dirs × 5 seeds × sea at its low, middle and high values × R 15 km and 60 km, dry and wet, at peaks max. It records min, max and the worst 4 m step, taken as in the test.
- `lab/task3-tails.mjs`: 30,000 dirs × 20–40 seeds × sea at both ends, dry and wet. It gives the true sup and inf rather than the test's 1,000 points.
- `lab/task3-wet.mjs`: the controller's wet and dry check for continents and archipelago.

**Brief-literal results (before tuning), peaks at max:**

| kind | min dry | min wet | max | worst 4 m |
|---|---|---|---|---|
| continents | −210.6 (sea 0.6) | **−340.3** | 1057.8 | 27.4 |
| archipelago | −205.5 (sea 0.8) | **−431.6** | 535.9 | 35.3 |
| canyons | −166.7 | −201.0 | 260.3 | 20.5 |
| mesas | −28.7 | −201.0 | 249.7 | 33.6 |
| dunes | −18.2 | −190.9 | 106.8 | 13.7 |
| craters | **−303.8** | −303.8 | 169.1 | **76.3** |
| ridges | −118.3 | −248.5 | **1275.6** (sea 0); tails sup **1330.4**, median planet's max 1239 | 27.4 |
| plateaus | 0.0 | −254.4 | 600.0 | 21.6 |

**What moved:**

1. **The under-s0 mapping gets a smooth floor** (ruling R3's allowance).
   - Under the shore: `sink((shape − s0) × c)` with `sink(h) = 180·tanh(h/180)`. `c` is 420 when wet and `lift` when dry.
   - Properties:
     - It is monotone and negative below s0, and keeps its sign, so the share under 0 is unchanged.
     - Its slope is exactly 420 (or `lift`) at the shore.
     - It never goes below −180.
   - **It applies to dry planets too, and that departs from the brief's "× lift".** Dry continents at sea 0.6 measured −210.6 and dry archipelago at sea 0.8 measured −205.5 with the plain × lift. Both break the test's −190 bound and the flight's −200 limit at the top of their own `sea` range.
   - For the low-lift dry kinds (lift ≤ 60, basins ≤ ~36 m) the ease changes heights by under 1 m (dunes dry min −18.2 → −18.1).
   - `WET = 420` itself is unchanged. `DEEP = 180` is new: −180 leaves 10 m inside the test's −190 and 20 m inside the flight's −200.
2. **Crater `bowl` made continuous.** This is a formula fix, not a TERRAIN value.
   - The brief's `bowl` is −(1 − (d/0.6)²) inside 0.6, which reaches 0 at d = 0.6. Outside, the rim 0.3·exp(…) starts at 0.3. That is a 0.3 × peaks jump at the rim: 75 m with zero run at 250 m peaks. It measured as the worst 4 m step of 76.3 m (> 60).
   - Now the inside is `−1 + 1.3·(d/0.6)²`: the same −1 floor, rising to meet the 0.3 rim. Worst 4 m step afterwards: **2.6 m**.
3. **`TERRAIN.craters.peaks` changed from [80, 250] to [80, 140].**
   - A bowl digs as deep as 1.3 × peaks (big bowl −1 plus small bowl 0.3 × −1), and inf measured −310.5 at 250.
   - Keeping −190 at every point needs 1.3 × peaks ≤ 190, so peaks ≤ 146. At 140 the bound by construction is −182, and the measured inf is −170.4.
   - The "craters dig in" test passes peaks 200 explicitly and still passes, since it checks no bounds.
4. **`TERRAIN.ridges.peaks` changed from [600, 1100] to [600, 850].**
   - At 1100 the tails sweep gave sup 1330.4 at sea 0, and the median planet's max was 1239: over the test's 1,150 and the flight's 1,200.
   - At 850: sup **1108.9** over 40 seeds × 4 configs × 30,000 dirs, with a median planet's max of 1002.
   - The sup rises about 0.88 m per metre of peaks, so 900 would sit near 1153. That is too close, so I chose 850.
   - The "ridges stand tall" test passes peaks 1000 explicitly and still passes, since it checks only that the 95th percentile is ≥ 350.

Nothing else moved. All shape frequencies, sea ranges, lifts, layer frequencies, octaves and the other peaks are the brief's.

**After tuning (same sweep, peaks at the new max):**

| kind | min dry | min wet | max | worst 4 m | sea err |
|---|---|---|---|---|---|
| continents | −148.4 | −172.0 | 1057.8 | 27.4 | 0.018 |
| archipelago | −146.7 | −177.0 | 535.9 | 35.3 | 0.028 |
| canyons | −166.7 | −166.7 | 260.3 | 20.5 | |
| mesas | −28.5 | −145.1 | 249.7 | 33.6 | |
| dunes | −18.1 | −141.5 | 106.8 | 13.7 | |
| craters | −163.9 | −163.9 | 137.4 | 2.6 | |
| ridges | −103.8 | −158.6 | 1041.6 | 21.2 | |
| plateaus | 0.0 | −159.9 | 600.0 | 21.6 | |

Tails (30,000 dirs × 20 seeds): continents sup 1063.1, archipelago 564.0, canyons 266.2, mesas 252.7, dunes 111.5, plateaus 600 (3 × peaks by construction).

**Controller's hand check:** wet and dry continents and archipelago at each end of `sea`, 20,000 dirs × 6 seeds × both radii, peaks at max.
```
continents   sea 0.35 dry  min  -141.5  max  1049.0  worst |share − sea| 0.0230
continents   sea 0.35 wet  min  -168.7  max  1049.0  worst |share − sea| 0.0230
continents   sea 0.6  dry  min  -155.8  max  1007.0  worst |share − sea| 0.0236
continents   sea 0.6  wet  min  -174.9  max  1007.0  worst |share − sea| 0.0236
archipelago  sea 0.62 dry  min  -138.4  max   559.1  worst |share − sea| 0.0171
archipelago  sea 0.62 wet  min  -175.1  max   559.1  worst |share − sea| 0.0171
archipelago  sea 0.8  dry  min  -148.6  max   530.6  worst |share − sea| 0.0181
archipelago  sea 0.8  wet  min  -177.4  max   530.6  worst |share − sea| 0.0181
```
Wet and dry shares are identical, as they should be: the sink keeps the sign.

## Files changed

- `src/lib/land/flight/fnl.js` (modified: `noise3For`, `cells3For`, header)
- `src/lib/land/flight/fnl.test.js` (modified: `describe('noise3For')` with the 5 named tests, `describe('cells3For')` with 1)
- `src/lib/land/flight/characters.js` (new)
- `src/lib/land/flight/characters.test.js` (new, verbatim from the brief)
- `src/lib/land/flight/fixtures/generated.js` (new)
- `docs/stack/fastnoise-lite.md` (modified)

## Self-review

- **Interfaces match the brief, with ruling R3's `wet` added.** `noise3For` takes noiseFor's options and defaults. `cells3For` defaults jitter to 1. `groundOf` returns `{ h, land }` with `land` in 0…1.
- **Purity:** characters.js imports only `./fnl.js` and `./sphere.js`, and the fixture imports only `lib/seeded.js`. No DOM, React or three.js. The module-level cache is deterministic memoisation and is safe in a worker.
- **Seed handling** goes through `fold`, so bigints work. Each layer's noises are seeded apart from the shape (`s ^ 0x68e31da4`, `s ^ 0x1b56c4e9`).
- **No class outside fnl.js:** `grep FastNoiseLite src` shows only fnl.js and its comments in characters.js ("building a FastNoiseLite allocates its tables"). That is a comment naming the class, not an import, and the stack page's rule is about imports.
- **Style:**
  - Header comments list the exports and end with "Pure: runs in Node and in a worker".
  - British spelling and curly quotes in the docs.
  - Comments explain why: the cache, the sink, the bowl, the frozen `FIB_512`, the two moved peaks.
- **File sizes:** characters.js 161 lines, fnl.js 76.

## Concerns

1. **Two departures from the brief's literal recipe, beyond tuning numbers.**
   - The dry basins also get the 180 m smooth floor. The brief says plain × lift, but that breaks −190 for dry continents and archipelago at the top of their `sea`.
   - The crater bowl's inside now rises to the rim's 0.3 instead of 0. The literal version is a 75 m cliff.
   - Both are measured above, and the controller may want them in the ledger.
2. **Seed type for Task 4:**
   - `groundOf` folds a number or a bigint.
   - The constraints say bigints cross `postMessage` as strings. A decimal string would be coerced by `| 0`, and a big one goes through `Number` and loses its low bits, so it may fold to 0.
   - `sphereField` should pass `BigInt(spec.seed)` or a number, not the string.
3. **`TERRAIN` is not frozen.** The cache keys on kind and seed and holds the shape noise built from `TERRAIN[kind].shape` at first use, so a tuning sheet (Task 13) that edits `TERRAIN.*.shape` live would need to clear the cache. `FIB_512` is frozen.
4. **Wet planets flood every negative height, not just the basins.** On a wet canyons planet the canyon floors (−0.5 × peaks) sit below 0, so if Task 4 floods everything under 0 they become flooded gorges. That follows the brief's recipe; noting it for Task 4 and Task 13.
