# Task 4 report: the field on the sphere

**Status: DONE.** I was blocked first; the controller then ruled option 1. It's committed as `56747497a`, and the fix is under "The ruling, applied" at the end. The rest of this report is what I found while blocked, and it's kept as it was.

One brief assertion fails: `'has no seam where the map wraps nor at the poles'`, on its wrap half, at v = 0.25 (0.091 m against < 0.01).

- The cause is FastNoiseLite's 3D OpenSimplex2, which Task 3's `groundOf` is built on. It isn't continuous. Along six great circles of every generated planet, the ground steps by up to 13.5 m.
- No number the brief lets me tune can fix it.
- The fix I'd recommend is in Task 3's `fnl.js`, which my scope doesn't let me change. I measured it in scratch copies. It makes every test pass, Task 3's included, with no retuning.

Everything else in the task is built and passes. It's waiting in the working tree, uncommitted.

## What I implemented (in the working tree)

- **`biomes.js`**
  - `climateOf` is exported.
  - `weightsAt(biomes, t, m)` is today's `biomeWeights` body from line 35 on, unchanged.
  - `biomeWeights(spec, x, z)` is now `weightsAt(spec.biomes, ...climateOf(spec)(x, z))`.
  - The header lists `weightsAt`.
- **`planetTables.js`**: `ROUND_ROUGH` and `roundBiomes`, added after `TYPE_LOOK`, with header lines.
  - `ROUND_ROUGH` is keyed `[family][biomeId]`, not flat by biome id. Two families each have a `plains` with different values (ice 0.7, rock 0.6), so a flat map can't hold the brief's numbers.
  - `roundBiomes(family)` returns `{ id, at: [...at], reach, base, rough, relief: [] }` for each of `TYPE_BIOMES[family]`, with no scatter. It copies `at` so a spec never shares an array with the roster's templates.
  - `roundBiomes` throws for a family with no `ROUND_ROUGH`, which means gas and ringed. Task 8 gives those a plane spec, so it never asks.
- **`sphereField.js`** (new, with a header in the house style): `CLIMATE_SPHERE = { frequency: 1.6, octaves: 3, stretch: 1.5 }`, `SLOPE_STEP = 8`, and `sphereField(spec)`, which returns `{ heightAt, biomeAt, climateAt, sample }`.
  - **Built once a call:** `groundOf({ ...spec.character, wet: Boolean(spec.water) }, spec.seed, R)`, the two climate noises (seeds `seed` and `seed + 1`), the hills and detail noises (seeds `seed ^ const`), and the POI pads.
  - **Climate:** `t = 0.55·(1 − |y|) + 0.45·stretched(n_t)` and `m = stretched(n_m)`, where `stretched(n) = clamp01(0.5 + 0.5·n·stretch)`.
  - **Height:** `soft(ground.h + Σw·base + (Σw·rough)·hills + detail)`.
    - `hills = (n + 1)/2 × 26` at 1/520 m, 4 octaves.
    - `detail = n × 3` at 1/70 m, 3 octaves.
    - `soft` is the brief's two tanh ends.
  - **POI flats:** `flats.js`'s rule at a great-circle distance (`R × angleBetween`). The level is `p.h ?? raw(poi.dir)` and the edge `p.edge ?? max(8, 0.6r)`. A cheap dot-product test skips points out of reach; it uses a cone a thousandth wider than the reach, so it never skips a point the rule would touch.
  - **`biomeAt`:** the heaviest of `weightsAt`, ties going to the lower index (as `field.js`).
  - **`sample(dir)`:** in the controller's exact form and operand order:

    ```js
    const c = chartOf(dir, R);
    const at = (x, z) => heightAt(c.toDir(x, z));
    const gx = (at(s, 0) - at(-s, 0)) / (2 * s);
    const gz = (at(0, s) - at(0, -s)) / (2 * s);
    return { h: heightAt(dir), slope: 1 - 1 / Math.hypot(1, gx, gz), biome: biomeAt(dir) };
    ```

- **`fixtures/generated.js`**: `roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks })`, assembled by hand as the brief says.
  - `sea` and `peaks` default to the middle of `TERRAIN[kind]`'s ranges (the brief doesn't say).
  - The id is `round-<type>-<kind>-<seed>`.
  - It imports only lib files (`characters`, `planetTables`, `sphere`), as ruling R5 requires.
- **Tests:** `sphereField.test.js` is the brief's, verbatim. `biomes.test.js` gains `'weightsAt is biomeWeights given the climate'` (20 points, `toEqual`).

## TDD evidence

RED: `npx vitest run src/lib/land/flight/sphereField.test.js src/lib/land/flight/biomes.test.js`

```
 FAIL  src/lib/land/flight/sphereField.test.js
Error: Cannot find module './sphereField' imported from .../sphereField.test.js
 FAIL  src/lib/land/flight/biomes.test.js > biomeWeights > weightsAt is biomeWeights given the climate
TypeError: climateOf is not a function
 Test Files  2 failed (2)
      Tests  1 failed | 3 passed (4)
```

After building: the same command, with `--reporter=verbose`.

```
 ✓ biomes.test.js > … weightsAt is biomeWeights given the climate 1ms
 ✓ rock, continents … 36ms   ✓ rock, canyons … 40ms   ✓ ice, archipelago … 17ms
 ✓ ice, mesas … 14ms         ✓ desert, canyons … 11ms ✓ desert, dunes … 11ms
 ✓ forest, mesas … 13ms      ✓ forest, craters … 18ms ✓ lava, dunes … 27ms
 ✓ lava, ridges … 14ms       ✓ ocean, craters … 10ms  ✓ ocean, plateaus … 11ms
 × has no seam where the map wraps nor at the poles 3ms
   → expected 0.0907613765282349 to be less than 0.01
 ✓ holds a POI flat at the land's own height there 0ms
 ✓ samples what it answers … 2ms
 ✓ is colder at the poles than at the equator, on the whole 0ms
      Tests  1 failed | 19 passed (20)
```

Every test runs in 40 ms or less.

`npx vitest run src/lib/land/flight`: `Test Files 1 failed | 17 passed (18)`, `Tests 1 failed | 211 passed (212)`. The one failure is the seam test.

- `the roster > is as it was` passes.
- `TERRAIN_VERSION > is bumped whenever a planet's ground changes` passes, so `weightsAt` moved nothing.

`npx eslint` on the six files is clean.

## The blocker, measured

Scripts are in `.superpowers/scratch-task4/` (gitignored).

1. **Where the step is.** At v = 0.25, the pair `dirOfUv(1 − 1e-9, 0.25)` / `dirOfUv(1e-9, 0.25)` is 0.18 mm apart. `groundOf`'s h alone differs by 0.094 m between them, and the whole field by 0.091 m. No other v of the 199 fails.
2. **Why there.** FastNoiseLite's 3D OpenSimplex2 (`_SingleOpenSimplex2R3`, fastnoise-lite 1.1.1) adds one extra lattice vertex, the one on the axis where |x0|, |y0| or |z0| is largest.
   - Where two of those tie and both vertices are within its 0.6 radius, the pick flips and the value jumps.
   - Generic tie crossings: 4,448 of 5,000 jump by more than 1e-6, the worst by 6.5e-3 noise units.
   - Its default 3D transform is symmetric, so for a noise sampled at any multiple of dir, every octave and every frequency ties together on six planes through the origin: x = y, x = z, y = z, x + y + 4z = 0, x + 4y + z = 0 and 4x + y + z = 0.
   - The map's u = 0 seam (z = 0, x < 0) crosses x + y + 4z = 0 exactly at (−1, 1, 0)/√2, which is v = 0.25. The test's straddle crosses that plane there.
3. **How big it is on the planet.** I straddled the six great circles at 2,000 points each, 2e-9 rad apart:

   | planet | field step | `groundOf` step |
   |---|---|---|
   | rock, continents | 13.46 m | 13.46 m |
   | lava, ridges | 10.99 m | 10.99 m |
   | ice, archipelago | 7.79 m | 7.80 m |
   | canyons, mesas, plateaus | 4.0–4.8 m | 4.0–4.8 m |
   | craters | 0.9–1.8 m | 0.9 m |
   | dunes | 0.3 m | 0.2 m |

   - These are cliffs with no width, running round the whole planet. The 60 m in 4 m rule doesn't see them, but the flight's mesh would show a few-metre ledge along each circle.
   - Most of it is `land` (a smoothstep over 0.12 of shape) amplifying the shape noise's step into the layer. `land` jumps by up to 0.029.
   - My own noises add at most about 0.9 m (forest craters), through the climate's simplex noise and the biome bases.
   - Smaller steps also lie along each octave's own tie surfaces everywhere, not only on these six circles.
4. **Perlin and value 3D noise are continuous** (worst step about 7e-9). **So is OpenSimplex2S:**
   - with it the worst noise step is 1.4e-8 and 0 of 5,000 tie crossings jump;
   - the field's step across the six circles is 0.000 m on all 12 test planets.

## The options

**Option 1 (recommended): 3D `'simplex'` becomes OpenSimplex2S, in `fnl.js` (Task 3's file).**

- The change is about four lines: a `TYPES3 = { ...TYPES, simplex: FastNoiseLite.NoiseType.OpenSimplex2S }` used by `noise3For` (and its warp noises).
- `noiseFor` (2D) keeps OpenSimplex2, so the roster can't move. Only `characters.js` and `sphereField.js` call `noise3For` (I grepped `src`).
- I tested scratch copies, with `fnl.js`'s simplex mapped to OpenSimplex2S and every other file unchanged. Task 3's `characters.test.js`, `fnl.test.js` and my `sphereField.test.js` all pass: 40 of 40, with no retuning and no rotation.
- That proves the bounds of −190…1150 at 15 km and 60 km, the sea share within 0.05, the "marks" test, and the seam and pole test.
- In those copies `TYPES` was swapped for 2D as well, which the real fix wouldn't do. `fnl.test`'s 2D cases passed anyway.
- Speed is the same order: a height took 3–9 µs with either noise, best of 5 × 50,000. The machine was busy, and neither was clearly slower.
- `docs/stack/fastnoise-lite.md` would want a line saying 3D uses OpenSimplex2S.
- It changes Task 3's committed ground for every generated planet, which isn't built on anywhere yet, so it needs your ruling. Afterwards I'd commit Task 4 unchanged.

**Option 2: turn the noise frame inside `sphereField.js`.** A fixed rotation of dir before every noise lookup, with the latitude read from the true dir, moves the six circles off the map's seam. The test would then pass. But the six great-circle steps of up to 13.5 m stay on every generated planet: the test would be dodged, not satisfied. I haven't done this.

Tuning won't do it. The brief's numbers (TERRAIN, `CLIMATE_SPHERE.stretch`, `ROUND_ROUGH`) would have to shrink the ground about tenfold to get under 0.01 m.

## Other checks

- **Bit-exact for Task 10.** For 800 texel centres over four planets, I built a fresh `sphereField` of the spec with `round.at = unit(dir)` (what Task 8's `chartedAt` and Task 7's `planetField` give). Reading it through `chartOf(unit(dir), R)` at ±`SLOPE_STEP` in Task 10's test's order matched `sample(dir)`'s h, slope and biome with `===` on 800 of 800. That holds with either noise.
- **`groundOf`'s cache key.** It keys on `${kind} ${fold(seed)}` and caches only the shape noise, its sorted FIB_512 values and the layer noises, which depend on nothing else. `sea`, `peaks`, `wet` and `radius` are applied per call, outside the cache. So the key is complete, and I didn't edit `characters.js`.
- I ran no full `npm test` or build, only focused vitest runs and eslint on my files (the cpu-quiet lock rule).

## Files changed (uncommitted)

- `src/lib/land/flight/biomes.js`
- `src/lib/land/flight/biomes.test.js`
- `src/lib/land/flight/planetTables.js`
- `src/lib/land/flight/sphereField.js` (new)
- `src/lib/land/flight/sphereField.test.js` (new)
- `src/lib/land/flight/fixtures/generated.js`

## Self-review

- `weightsAt` is the old body, byte for byte, from `const w =` on. Only `spec.biomes` became `biomes`, and the roster lock and ground hash both pass.
- The heights are `unit`-normalised once at each public entry, and `sample` passes its own `dir` to `chartOf`, so a caller passing an off-unit dir gets the same answers as Task 10's recompute.
- The `soft` bounds can't be exceeded (tanh is below 1). The flats interpolate between two values already in bounds.
- `CLIMATE_SPHERE` is a plain, unfrozen object, like `TERRAIN`. Task 8 puts it in specs, which cross by `postMessage`.

## Concerns

1. The blocker above: OpenSimplex2 3D steps in Task 3's ground, up to 13.5 m along six great circles. Option 1 is recommended.
2. `ROUND_ROUGH` is nested by family, a small change from the brief's `ROUND_ROUGH[biomeId]`. It's forced by `plains` having two values. Task 8 only calls `roundBiomes(family)`, so nothing downstream reads `ROUND_ROUGH` directly.
3. `roundSpec`'s default `sea` and `peaks` are the middle of their ranges. The brief doesn't give them.

## The ruling, applied (option 1)

Commit: `56747497a`, "Grow a generated planet's ground on its sphere: climate, biomes, heights, flats". It has the constraints.md trailer and one commit for the whole task.

- **`fnl.js`**
  - `const TYPES3 = { ...TYPES, simplex: FastNoiseLite.NoiseType.OpenSimplex2S }`.
  - `make` takes the table as a last argument, which defaults to `TYPES`.
  - `noise3For` passes `TYPES3` for its noise and its three warp noises.
  - `noiseFor` (2D) and `cells3For` are untouched, so the 2D mapping is exactly as it was.
  - A comment says why, and the header notes "'simplex' is OpenSimplex2S in 3D".
- **`fnl.test.js`**: under `describe('noise3For')`, the new test `'is continuous across the planes where 3D OpenSimplex2 stepped'`.
  - It reads `noise3For(7, { frequency: 1/1600, octaves: 5 })` round a 20 km circle in each of the six planes, at 500 points each.
  - Each pair is a millimetre apart, ±0.5 mm along the plane's normal.
  - The worst difference on each plane must be under 1e-3.
- **`docs/stack/fastnoise-lite.md`**: one Gotchas line says 3D uses OpenSimplex2S because 1.1.1's 3D OpenSimplex2 steps along planes, and that 2D keeps OpenSimplex2 for the roster.
  - It names `src/lib/land/flight/fnl.js` and the test. The existing "reads exactly 0 on its lattice points" gotcha still holds: OpenSimplex2S also reads 0 at (100, 100, 100), and `'warps in 3D'` passes.

**The regression test fails on OpenSimplex2.** I ran it before changing `fnl.js`:

```
npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/sphereField.test.js
     × is continuous across the planes where 3D OpenSimplex2 stepped 4ms
     × has no seam where the map wraps nor at the poles 3ms
AssertionError: across the plane ⟂ [1,-1,0]: expected 0.001823357472799797 to be less than 0.001
AssertionError: expected 0.0907613765282349 to be less than 0.01
      Tests  2 failed | 28 passed (30)
```

Per plane on OpenSimplex2, from the probe, the worst step and the number of pairs over 1e-3:

| plane | worst | pairs over 1e-3 |
|---|---|---|
| [1,−1,0] | 1.8e-3 | 7 |
| [1,0,−1] | 2.5e-3 | 8 |
| [0,1,−1] | 1.8e-3 | 14 |
| [1,1,4] | 3.3e-3 | 16 |
| [1,4,1] | 2.4e-3 | 8 |
| [4,1,1] | 1.8e-3 | 12 |

**It passes on OpenSimplex2S.** Its worst step is 2.6e-6 to 3.7e-6 per plane, with no pair over 1e-3.

```
npx vitest run src/lib/land/flight docs/stack/stack.test.js
 Test Files  19 passed (19)
      Tests  254 passed (254)
```

- `the roster > is as it was` passes, and so does `TERRAIN_VERSION > is bumped whenever a planet's ground changes`.
- Each of Task 3's `characters.test.js` tests passes unchanged, with no retuning.
- Timings: the new test takes 6 ms, the sphereField tests 0–28 ms, and characters.test.js 7–61 ms.

**Rechecked on the committed files**

- `sample` is bit-exact with Task 10's chart recompute on 800 of 800 texels.
- Across the six great circles, the field's step is 0.000 m on all 12 test planets. It was up to 13.46 m.
- eslint is clean on all eight code files.

**Files in the commit:** the six listed earlier, plus `src/lib/land/flight/fnl.js`, `src/lib/land/flight/fnl.test.js` and `docs/stack/fastnoise-lite.md`.

**Remaining concerns**

- `ROUND_ROUGH` is nested by family.
- `roundSpec`'s default `sea` and `peaks` are the middle of their ranges.
- Task 3's characters on 3D noise now draw from OpenSimplex2S. Its tests all pass, but its numbers were tuned by eye on OpenSimplex2, so a look at a generated planet in the flight (Task 13's pass) is the real check.
