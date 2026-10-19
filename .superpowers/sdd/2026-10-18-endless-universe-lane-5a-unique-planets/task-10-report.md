# Task 10 report: the orbit map

Status: DONE. Commit `565b129e8` “Bake a planet's orbit map from the ground the flight flies over”, with the constraints.md trailer.

## What I built

`src/lib/land/flight/orbitMap.js` (252 lines). It imports lib only: field, fnl, hash, planetTables, sphere, sphereField and seeded.

- `ORBIT_MAP_SIZE` and `orbitMapSize(tier)`. The fallback to `mid` uses `Object.hasOwn`, so a tier such as `'constructor'` can't reach the prototype.
- `PLANE_WINDOW = 40000`.
- `groundColour(spec, { h, slope })`. It is a thin wrapper round `painterOf(spec)`, which works out the linear palette once per spec and returns `(h, slope, out, at) → under water?`. That function writes sRGB bytes into `out`. The bake writes through the same function straight into `rgba`, so the test's colour and the baked colour are bit-identical by construction, and nothing is allocated per texel in this file.
  - **Palette:** `spec.ground?.palette ?? { ...spec.palette, hLow: 0, hHigh: 120 }`. This is ground.js:38.
  - **Uniform fallbacks:** the defaults from groundLook.js:59-68 (`high ?? low`, `rockAt ?? 0.42`, `hHigh ?? 30` and so on).
  - **The rule, mirrored line by line in comments:** low→high by `smoothstep(hLow, hHigh, h)` (:166-167); accent at `accentCover × 0.5`, gated by `step(0.001, cover)` (:169); deep is 0 at the mean (:170); rock × 0.98 by `smoothstep(rockAt, rockAt + 0.14, slope)` (:172-174); wet by `(1 − smoothstep(level, level + band, h)) × 0.75`, gated by `step(−9999, level)` (:176); grain × 1 (:179). The scans and the marks are close-up only.
  - **Colour space:** sRGB ↔ linear by the IEC transfer functions, mixed in linear light, bytes are `round(toSrgb(clamp01(c)) × 255)`.
  - **Wet colour key:** the real data key is `wet.color`, the same key groundLook reads, not `colour`.
  - **Water (water.js:18-26):** water counts only when `WATER_LOOKS[kind]` exists, as water.js draws no sheet otherwise. Its colour is `water.colour ?? look.color`, mixed 0.15 toward `spec.palette.accent` (water.js reads the planet palette, not the ground palette). Lava is `mix(that, glow, 0.6)` and replaces the ground. Anything else is `mix(ground, water, opacity)`.
- `bakeOrbitMap(spec, { width, height })` handles three kinds of spec:
  - **Round:** one `sphereField(spec)` per bake; `sample(dir)` at `dirOfUv((i+.5)/W, (j+.5)/H)` gives h, slope and biome.
  - **Gas or ringed** (`type`): bands. `n = noise3For(spec.seed, {frequency 2.2, octaves 4, warp 0.25})`. `B = 6 + floor(rnd·6)` (whole numbers 6–11) from `seeded(spec.seed ^ fold(hash64('orbit','bands')))`. `t = sin((y·B + 0.6n)π)`, accent where `|n| > 0.55`. Alpha 255, biome 0.
  - **Any other plane:** a window `x = (u−.5)·40000`, `z = (v−.5)·20000`, read through `planetField`. The slope uses the same ±SLOPE_STEP formula as `sample`, and the biome is `biomeAt(x, z)`.

`src/lib/land/flight/orbitMap.test.js` is the brief's test, copied verbatim (extracted from the brief by sed).

## TDD evidence

RED: `npx vitest run src/lib/land/flight/orbitMap.test.js`
```
FAIL  src/lib/land/flight/orbitMap.test.js
Error: Cannot find module './orbitMap' imported from .../orbitMap.test.js
Test Files  1 failed (1)   Tests  no tests
```

GREEN: `npx vitest run src/lib/land/flight/orbitMap.test.js --reporter=verbose`
```
✓ is 256 × 128 RGBA unless asked, and 512 × 256 on high and up 36ms
✓ is the same bytes twice 101ms
✓ shows what the ground shows: each texel is the flight’s ground at the chart’s middle there 207ms
✓ has no seam where it wraps: its last column meets its first as any two neighbours meet 199ms
✓ bakes every kind of spec and never throws: the fifty, a moon, a gas giant 208ms
Test Files  1 passed (1)   Tests  5 passed (5)
```
The texel test passed exactly on the first run. Both paths already go through the same `chartOf(dir, R)`: `chartedAt`'s `unit(dir)` and `chartOf`'s `unit(at)` hand back the same array, and `toDir(0, 0)` returns `up`.

Directory run: `npx vitest run src/lib/land/flight` gave 20 files passed and 1 failed (248 of 249 tests). The failure is `mapRaster.test.js › costs no more than three of the ground’s finest leaves on Hoth`, a timing comparison. It also fails when run alone (208 vs 54 ms), it is listed in `windows-test-baseline.txt` (line 21), and it doesn't touch my files. There were no load timeouts.

Lint: `npx eslint src/lib/land/flight/orbitMap.js src/lib/land/flight/orbitMap.test.js` is clean.

## Bake timings (one-off node run, this machine, other sessions active)

Round specs (generated, from the test's `randomSystems(40, 6)` rows):

| spec | 256 × 128 | 512 × 256 |
|---|---|---|
| e:2,-40:15:0 forest ridges, R 53,942 m | 936 ms | 2,991 ms |
| e:-36,-4:18:1 ocean archipelago, R 58,269 m (78% water) | 986 ms | 3,992 ms |
| e:-24,-17:5:2 rock ridges, R 21,923 m | 763 ms | 2,829 ms |
| e:-24,-17:5:3 ice ridges, R 19,326 m | 1,275 ms | 3,425 ms |

Other kinds at 256 × 128: generated gas 238 ms, ringed 509 ms, Bespin (bands) 117 ms, Tatooine window 1,764 ms, Kamino 876 ms (100% water, as an ocean world should be), Mustafar 1,154 ms (3.5% lava), Naboo 2,124 ms.

Profile (`--cpu-prof` over the round bakes, self time):

- FastNoiseLite's OpenSimplex2S, gradients and fractal: about 45%.
- `sphereField` heightAt and raw: about 18%.
- `weightsAt` and its maps: about 13%.
- `sample`: 5.6%.
- `unit`: 3.5%.
- GC: 2.2%.
- orbitMap.js itself (loop, painter, sRGB): about 2%.

So the cost is the field's 5 heights and 1 biome per texel, not the bake. Allocation in `sphereField`'s hot path (the Task 4 deferred note) accounts for about 15–20% at most (weightsAt's arrays, unit and chart frames). Removing it would not change the order of magnitude.

## Self-review

- Spec kinds are decided by precedence: `spec.round`, then `type` gas or ringed, then window. Bespin (type `gas`) and the two seeded gas giants (`e:1,0:0:0`, `e:1,0:2:0`) therefore get **bands**, not a window. This follows the brief's type rule and your “every other plane spec” wording; the brief's parenthetical “(the seeded 13 and the named worlds)” for windows is loose.
- The bands use the same resolved palette as `groundColour` (the ground palette when there is one). For a generated giant this is identical to `spec.palette`. For Bespin it is the ground look the flight's cloud deck wears.
- `smoothstep` with equal edges is a step rather than NaN, so a degenerate palette still gives finite bytes. An unreadable colour is white, which is what three.js's `Color` leaves.
- Header comment in the house style lists the exports and says “Pure: runs in Node and in a worker”. Every step is mirrored to groundLook.js line numbers.
- The file is 252 lines; spelling is British and comments use curly quotes where prose.

## Concerns

1. **512 × 256 takes about 3–4 s** per round planet on this machine (256 × 128 about 1 s). That is fine in a worker as a one-off, cached bake. Task 11 / lane 5b may want to show 256 × 128 first or accept the delay on high and ultra. Real speed-ups would need `sphereField`'s hot path, which is outside this task's files.
2. **A plane window doesn't wrap.** A plane spec's map has a seam at u = 0 where x = ±20 km meet, and its rows near the poles pinch on the sphere. Both are as the brief specifies, and noted in the header for lane 5b.
3. **Bespin and the two seeded gas planets get bands** (see the first self-review point). If the 13 should all be windows, flip the precedence; it is a one-line change.
4. **Water needs a known kind.** Water counts only when its kind is one of `WATER_LOOKS` (sea, lake, swamp, lava), as water.js draws no sheet otherwise.

## Files changed

- `src/lib/land/flight/orbitMap.js` (new)
- `src/lib/land/flight/orbitMap.test.js` (new, verbatim from the brief)
