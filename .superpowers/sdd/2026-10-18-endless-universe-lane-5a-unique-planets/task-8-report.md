# Task 8 report: Generated specs

**Status:** DONE. Commit `5a35afcad` “Build every generated planet and moon round, from its own variety” (BASE `b50b3121d`), carrying the constraints.md trailer.

## What I built

- **`src/lib/land/flight/generated.js`** (new, 227 lines). It has a house-style header listing its exports and says “Pure: runs in Node and in a worker”. Its exports:
  - `groundRadius(row)`. It returns `15000 + 45000 × clamp((radius − 18) / 52, 0, 1)`. It returns 15,000 for a moon (an id with a moon part, through `canonicalId` and `parseSpaceId`) or for a radius that isn't finite.
  - `POI_NAMES`, exactly as the brief gives it.
  - `generatedSpecOf(row, family)`. It returns all 17 roster keys plus ROSTER_EXTRA's 10, set as follows:
    - `kind`, `parent` and `buildable: false` follow the brief.
    - The variety fields are the variety's: `palette`, `character`, `sky`, `weather`, `flora`, `fauna` and `exotic`.
    - `fog` is `{ near: round(1500 − 900·haze), far: round(21000 − 9000·haze) }`.
    - `seed` is `fold(BigInt(row.seed))`.
    - `type` is the family, as Task 5 had it (a rocky moon reads `rock`).
    - **Clutter:** the template's rows, with `trunk` and `spire` `perKm2` multiplied by `flora.density`. A gas giant has no flora, so its rows keep the template's numbers. Round specs then add the exotic rows:
      - crystal: `{crystal, 25, depth 5}`
      - glowing or floating: `{trunk, 14}`, only if there's no trunk row
      - spires: `{spire, 30, depth 5, size 1.4}`

      Under the controller's ruling, gas and ringed specs keep `exotic` as data but get no exotic rows.
    - **Ground:** the template's ground, with the palette's `low/high/rock/accent/deep` replaced by the variety's colours.
      - On round specs: `hLow = (water?.level ?? 0) + 2`, `hHigh = clamp(peaks × 0.5, 60, 500)`, and a template `wet` keeps its colour and band at the water's level. A `wet` with no water under it is dropped; with the current tables this never happens.
      - On gas specs only the colours change ("as today, recoloured"). A giant has no `peaks`, so `clamp(undefined)` would have produced NaN.
    - **Gas and ringed:** `round: null`, `soft: true`, `PLANE_CLIMATE`, `expand(TYPE_BIOMES[family], seed)`, `pois: []`, `water: null`.
    - **Landable families:** `round: { radius, at }`, `soft: false`, `step: 0`, `pits: []`, `CLIMATE_SPHERE`, `roundBiomes(family)`, `water: { kind, level: 0, colour? }` or null, `landmarks: []`, `hero: null`.
    - **POIs:**
      - **Candidates:** `FIB_512`'s first 256 directions, turned by a seeded rotation (a uniform random quaternion, Shoemake's method) and read in a seeded Fisher–Yates order. The seed is the spec's seed xor `fold(hash64('generated', 'pois'))`.
      - **Rules:** for each `poiKind`, the first candidate whose `sphereField(spec0).sample(d)` has `h > (water?.level ?? −∞) + 4` and `slope < 0.12`, and which is at least 0.3 rad from every POI already placed.
      - **Cost:** one `sphereField` per spec. Each candidate's sample is read at most once, lazily, and the cheap distance rule is checked before sampling.
      - **Size:** `r` is 60–140 and `edge` is 80–120, whole metres. Both are drawn for every kind, so a kind that is skipped doesn't move any other kind's draws.
      - **Origin:** the first POI's `dir`, else the first dry and gentle candidate, else candidate 0. The spec is then charted round it with `chartedAt`.
  - `chartedAt(spec, dir)`. On a round spec it sets `round.at = unit(dir)` and re-charts every POI's `at` (to the centimetre, `+ 0`); everything else stays. A plane spec comes back as the same object.
- **`planetSpec.js`:** the non-roster branch now returns `generatedSpecOf(p.id === id ? p : { ...p, id }, family)`, so the spec id stays the canonical one whatever the lookup's row says. The now-unused `parseSpaceId` import and `specOf`'s `extra` parameter are gone. The header and the ROSTER_EXTRA comment are updated.
- **`planetTables.js`:** `WATER_LOOKS` moved here unchanged, with a header line (702 lines).
- **`water.js`:** `import { WATER_LOOKS as LOOKS } from '../../../lib/land/flight/planetTables'`, and the colour is now `w.colour ?? look.color`. One header sentence was added.

## TDD evidence

**RED:** `npx vitest run src/lib/land/flight/generated.test.js`

```
FAIL  src/lib/land/flight/generated.test.js
Error: Cannot find module './generated' imported from .../generated.test.js
Test Files  1 failed (1)   Tests  no tests
```

This is vitest 5's wording of the brief's “Failed to resolve import”.

**GREEN:** `npx vitest run src/lib/land/flight/generated.test.js --reporter=verbose`. All 9 passed on the first implementation; the times are from the first run, on a quiet machine:

| Test | Time |
|---|---|
| makes a round planet of every landable type, and a moon | 58 ms |
| sizes the ground from the universe radius | 0 ms |
| puts its places on dry, gentle land, apart | 31 ms |
| gives the seeded thirteen no new places | 1 ms |
| charts again at any spot | 2 ms |
| is the same spec from any lookup | 9 ms |
| wears its variety in the flight | 0 ms |
| keeps a gas giant a plane cloud deck | 1 ms |
| shows several biomes on its sphere | 100 ms |

**Focused directories:** `npx vitest run src/lib/land/flight src/components/expanse/flight` gave **46 files, 483 tests passed** (29.7 s). This run included `the roster` (ROSTER_LOCK 707fb49f) and `TERRAIN_VERSION` (GROUND hash af2cf901), confirmed by name in a verbose rerun. kitClutter.test.js and landmarkTables.test.js did not time out this time.

`'flies to any Expanse planet by id'` passes and now gets a round spec: the far planet `E:3,-2:0:1` (ice, radius 46) has `round.radius` 39,231 m and 2 POIs.

**Lint:** `npx eslint` on the 5 changed files is clean.

## Tuned numbers

- **`CLIMATE_SPHERE.stretch`: unchanged at 1.5. No tuning was needed.** The 40 landable planets in the test's fixture (randomSystems(60, 4)) are 12 rock, 11 ice, 6 desert, 5 ocean, 3 lava and 3 forest.
  - Biomes with at least 3% of the 64×32 grid, per planet: 3 biomes on 19 planets, 4 on 8, 5 on 13. The minimum is 3, so the `many` share is 40/40 = 1.0 against the 0.9 floor.
  - Examples: ocean `0:1022 1:231 3:794`; rock `0:1217 1:394 2:47 3:390`; ice `0:1125 1:89 2:355 3:329 4:150`.
- **POIs:** in the same 40 planets, 66 POI kinds were drawn and all 66 were placed; none was skipped. Five planets drew no kinds and start their chart at the first dry, gentle candidate.
- **Exotic and clutter spot-check** over 405 specs from randomSystems(400, 9): every family × exotic combination seen gives the rows the brief describes. Examples:
  - ice + spires adds `{spire, 30, depth 5, size 1.4}`
  - rock + floating adds `{trunk, 14}`
  - rock + crystal adds `{crystal, 25, depth 5}`
  - gas + glowing or spires adds nothing
  - forest trunk 30 × density 1.44 gives 43.1

## Timing under load (each test should run under a second)

Another session's merge had the CPU at 100% (Win32 LoadPercentage 100), and wall-clock times swung widely. The slowest was `shows several biomes on its sphere`, at 0.6–4.0 s across reruns, against 100 ms on the quiet first run. `puts its places…` took 0.03–0.6 s.

I measured CPU time directly with `process.cpuUsage` in a throwaway probe:

| Work | CPU time |
|---|---|
| 42 specs (the first test's work) | 63 ms |
| 40 specs + sphereFields + POI samples | 62 ms |
| the biome sweep (40 × 2048 `biomeAt`) | 172 ms |

So the work is well under a second, and the slowness was contention. Building a spec costs about 2 ms (405 specs in 807 ms wall-clock under load).

## Files changed

- `src/lib/land/flight/generated.js` (new)
- `src/lib/land/flight/generated.test.js` (new)
- `src/lib/land/flight/planetSpec.js`
- `src/lib/land/flight/planetTables.js`
- `src/components/expanse/flight/water.js`

## Self-review

- **Plain data.** The test's JSON round-trip passes for 40 landable planets and both moons. POI `dir` components get `+ 0` inside `turn`, so no −0 is possible. Charted `at` values are rounded to the centimetre with `+ 0`. Gas specs never compute `hHigh` (no NaN).
- **One description per planet.** The spec reads only the row (the variety is the row's alone), so `[r]` and the full lookup give equal specs.
- **The fifty stay put.** They never reach `generatedSpecOf`: named worlds and SEEDED are checked first, and both locks pass. `specOf` now always spreads ROSTER_EXTRA, which is what it already did for every roster call.
- **`round.at`.** It is `unit(dir)`, which is the caller's own array when that is already unit. The test's angle check passes below 1e-12.
- **POIs on dry land.** Each POI's final height equals spec0's raw height at its `dir`, because its pad sets `h` to the raw height there. POIs are at least 0.3 rad apart (≥ 4.5 km at R = 15 km), far beyond any pad's reach of r + edge ≤ 260 m, so the "> level + 4" rule still holds in the final field.
- **No dependency cycle.** `generated.js` doesn't import `planetSpec.js`; ROSTER_EXTRA's keys are written out explicitly.

## Concerns and deviations

1. **The verbatim test's import was changed by one name.** `generatedSpecOf` was imported and never used, which failed `no-unused-vars`, and `npm run lint` is a done-gate. I removed it from the import line; nothing else in the test changed. The function is still exercised through `planetSpecOf`.
2. **The glowing/floating trunk row has no depth.** The brief says “a `trunk` row at 14”, so it's `{ kind: 'trunk', perKm2: 14 }` and is placed at leafMesh's default depth. Endor's trunk row is `depth: 5` (seen from further). If those trees should show from as far as the crystals and spires, add `depth: 5`.
3. **All candidates lie in one hemisphere.** `FIB_512`'s first 256 directions are its northern hemisphere, so after the rotation a planet's candidates, POIs and chart origin all fall in one random hemisphere. This is what the brief specifies; I'm noting it for lane 5b and the orbit map.
4. **The template `mark` colour isn't swapped.** For example, Tatooine's `#b98a5a` stays on a recoloured desert. The brief lists only low/high/rock/accent/deep.
5. **Wall-clock test times can pass a second under heavy machine load**, as measured above, though the CPU cost is ≤ 172 ms. This is worth a glance at the gates if the machine is busy; kitClutter.test.js and landmarkTables.test.js have the same history.
