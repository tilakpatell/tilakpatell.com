# Task 6 report: The variety

Status: DONE. Commit `5e36dbd4e` "Give each generated planet its own colours, land, sky, weather, life and places" (trailer per constraints.md).

## What was built

- `src/lib/land/flight/variety.js` (new, 383 lines). Exports `FAMILIES`, `SLOT_JITTER`, `colourDistance`, `dominantOf`, `varietyOf`. The header lists the exports, says "Pure: runs in Node and in a worker", and explains why `dominant` is the slot (R4).
  - **Streams.** Each aspect (`slot`, `palette`, `water`, `character`, `sky`, `weather`, `flora`, `fauna`, `exotic`, `pois`) uses `seeded(fold(BigInt(row.seed)) ^ SALT[aspect])`. `SALT[a]` is `fold(hash64('variety', a))`, worked out once at load.
  - **The slot.**
    - The id goes through `canonicalId`, then `parseSpaceId`. The key is the canonical id without its last part, so a moon's key is its planet. The index is `moon ?? planet`.
    - `perm` is a Fisher–Yates shuffle seeded by `fold(hash64('slots', key))`. The slot is `slots[perm[index mod n]]`, then jittered by up to ±2° and ±0.01 from the `slot` stream.
    - Seeded systems come from `SEEDED_EXPANSE`, giving each system's template colours (`dominantOf(TYPE_LOOK[type].palette)`). The list keeps only slots at least `1 + 2·hypot(2/15, 0.01/0.08)` = 1.3655 from every one of those colours, and the index becomes `j − s`.
    - If no slot were clear, the code would fall back to the family's own list. This never happens with the 13.
    - The modulo also handles a negative index, with a comment on both wraps.
  - **`dominant`** is the jittered slot `[h, l]` (R4). For an ocean, that is its water slot.
  - **Palette.** It follows the brief's rules exactly: `low`, `high` (+6°, 0.9s), `deep` (0.7l), `rock` (+10°, 0.6s, 0.6l), and `accent` per family. An ocean's `low` and `high` are sand drawn from desert's hue range (20–64), saturation (0.35–0.60) and lightness (0.58–0.82), and its accent is the water. `skyLow` and `skyHigh` are the sky's.
  - **Water, character, sky, weather, flora, fauna, exotic and POI kinds** follow the brief's tables. `sky.rings = Boolean(row.rings)` and `sky.moons = row.moons ?? 0`. `row.system` is read optionally, since a moon may have none.
  - `varietyOf.length === 1`. An unknown type throws "No variety for X." (as `roundBiomes` does). An id that is not a planet's or a moon's gets index 0 and keys on itself, so it doesn't throw.
- `src/lib/land/flight/variety.test.js` (new): the brief's tests, verbatim (`diff` against the brief's lines 107–175 is empty).
- `src/lib/land/flight/fixtures/generated.js`:
  - Added `randomSystems(planets, seed)`:
    - sectors in −40…40, never (1, 0) or (0, 0), and no system key repeated
    - system index 0–23 and 1–7 planets
    - the generator's type weights
    - a 64-bit string seed for each planet
    - the radius rounded within its type's range, copied as numbers (R5)
    - moons 0–3, rings at 5 %
    - `system { faction: null | { id: 'empire' }, traffic, hazard: null | 'pirates' }`
  - Added `lookupOf(rows)`, which returns `(id) → row | null` and reads either case.
  - The header lists both. There are no component imports, and planetSpec.test.js's "the pure layer" test passes.

## TDD evidence

RED (`npx vitest run src/lib/land/flight/variety.test.js`, before variety.js existed):
```
FAIL  src/lib/land/flight/variety.test.js
Error: Cannot find module './variety' imported from .../src/lib/land/flight/variety.test.js
Test Files  1 failed (1)   Tests  no tests
```
(This is vitest 5's wording of the brief's "Failed to resolve import".)

GREEN (same command):
```
Test Files  1 passed (1)   Tests  7 passed (7)
```
Timings from the verbose reporter (each test is under a second; the whole file's test time is about 280 ms):

| Test | Time |
|---|---|
| slots | 12 ms |
| siblings (500 planets) | 17 ms |
| seeded siblings | 13 ms |
| the planet's alone | 1 ms |
| in its family | 10 ms |
| spreads the kinds (2000 planets) | 225 ms |
| moon | 1 ms |

The file's wall time is 0.7–1.8 s, depending on how long the transform takes.

Flight folder (`npx vitest run src/lib/land/flight`, with no cpu-quiet lock present): **19 files, 226 tests passed**, 6.4 s.
`npx eslint` on the three files gives no output (it passes).

## Tuned numbers

**None.** No slot, threshold or table value moved. The slot test passed the first time. The closest pair in the table is lava 335° at 0.10 and 0.21, at 1.375, against the 1.3655 needed.

## Probe results (one-off script; not committed)

- **Exotic share:** 0.0493 over 20,004 planets. The four kinds came out 238 to 263 each.
- **Spread:**
  - Every character, weather, flora family and POI kind appears.
  - POI counts are 0: 6233, 1: 5205, 2: 5106, 3: 3460. These include gas and ringed planets, which have 0.
- **Sibling distances:**
  - The worst between any two siblings over 20,004 random planets is **1.178** (≥ 1).
  - In seeded systems 1 and 2, with j = 3–6 and every type, the worst distance to a template colour is **1.55** and to another generated sibling **1.38**.
- **Clear slots in seeded systems** (out of the family's total):

  | System | lava | rock | desert | forest | ocean | ice | gas |
  |---|---|---|---|---|---|---|---|
  | `e:1,0:0` | 6/8 | 6/8 | 4/9 | 5/8 | 8/8 | 6/8 | 6/8 |
  | `e:1,0:1` | 8 | 6 | 5 | 8 | 8 | 8 | 7 |
  | `e:1,0:2` | 8 | 6 | 6 | 8 | 8 | 8 | 6 |

  System 0 has 7 seeded planets, so it has no generated ones. Systems 1 and 2 need at most 4 clear slots per family, so no wrap ever happens there.
- **Plain data:** every variety survives a JSON round trip, and every colour is `#rrggbb`.
- **Drift:** the furthest the measured palette strays from the slot (`dominantOf(palette, water)` against `dominant`) is 0.678, on a dark lava slot. This is the R4 effect, and the file's comment says so.
- **Speed:** about 0.026 ms per `varietyOf` call.

## Choices where the brief was silent (flag if wrong)

1. **POI kinds are distinct.** Each kind is drawn by weight without replacement, so a planet never has two "Ruins". The doubling for faction and pirates applies before the draws.
2. **`weather.amount` is 0 when the kind is `none`.** Otherwise it is 0.2–1. The draws are made either way, so the stream order doesn't depend on the outcome. A glowing exotic forces `spores` on any family, gas included.
3. **Gas and ringed planets can be exotic** (the brief's "a planet is exotic"). Their weather is `spores` when the exotic is glowing.
4. **Fauna with density 0** (rock 80 %, lava 90 %) still carries its drawn `plans`. Task 9 makes no rows at density 0.
5. **An ocean's `rock` and `deep` come from its water slot**, as the general rule says (only `low`, `high` and `accent` are named as different for an ocean). Its rock is a dark slate blue.
6. **Each aspect has its own stream, including `water`**: the forest water hue comes from a `water` stream.
7. **Gas sky hue** is exactly the dominant hue + 20 (one draw is spent on a zero-width range). **Rock sky hue** is the slot hue ± 15.
8. `FAMILIES.ringed` is the same object as `FAMILIES.gas`, so a gas sibling and a ringed sibling share one shuffle and take different slots.

## Self-review

- The tests are verbatim, and the threshold is untouched.
- `varietyOf` reads only its own row and the module's constant tables.
- All files are under 800 lines.
- There are no React, DOM or three.js imports, and no component imports in the fixture.
- Comments use British spelling and explain why.

## Concerns

- None that block.
- If Task 8 expects `weather.amount` within 0.2–1 even for `none`, choice 2 would need to change. The plan's later briefs only pass `amount` through.
