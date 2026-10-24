# Endless universe, lane 2: one space

The lane's numbers, PR by PR. Plan: `docs/superpowers/plans/2026-10-18-endless-universe-lane-2-one-space.md`. Spec: `docs/superpowers/specs/2026-10-18-endless-universe-design.md`.

## PR 2.3: camera-relative always

Four commits on `eu/lane-2`, from `main` at `cc5e2eaf`:

- `b4747d89` Draw the universe camera-relative every frame (`relative.js`)
- `7f6c3126` Bodies set their world position in the draw, so they're right camera-relative
- `80754ad1` The planets' air, deep space's suns and a landing's crowns are placed in the draw
- `058a3d17` The broken flagship's halves and a portal kill are cut in the draw

### Depth: no logarithmic depth

The far plane stays 45,000 (`scene.js`'s camera) and there is no logarithmic depth. Past the far plane everything is a speck in the far layer with no depth test, so the depth range never needs to grow, and log depth would need every `ShaderMaterial` the universe draws with patched (53 are made under `src/components/universe` alone; the plan counted 61). Drawing round the camera is what keeps the near things steady: a body 10^9 out draws within a pixel of where it is (`relative.test.js`), and wouldn't without the shift.

### `scene.js`

| | lines |
| --- | --: |
| before (`main`, `cc5e2eaf`) | 6,409 |
| after (`058a3d17`) | 6,374 |

`drawn()`, `lens()`, `reach()` and `FAR` moved out to `relative.js` (50 lines) and `drawAt` went with them. The other three commits don't touch `scene.js`.

### The gate

Run in the lane's worktree at `058a3d17`, on 2026-10-24:

| command | outcome |
| --- | --- |
| `npm run lint` | clean |
| `npm test` | 1,953 files and 21,276 tests passed (8 skipped), run with nothing else of the gate's running. A first run beside `npm run lint` timed out at 5 s in 2 files the lane doesn't touch, `scripts/health/art-mix.test.mjs` (which times out on `main`'s logged run too) and `src/components/albuquerque/world/rules.test.js`'s five-minute traffic; run alone, both pass. |
| `npm run build` | built in 46 s (the build refreshes `public/github.json`; put back, not committed) |
| `node scripts/health.mjs --check --skip build` | within budget |
| `node scripts/flight-island.mjs --check` | 151 files on the island, 39 marked rows, 62 references |

### No pixel changes where none was meant

`universe-check.mjs`'s shots can't be compared pixel for pixel: the map moves while a pose loads (the planets turn, the traffic flies, the clock runs), so two shots of `main` differ as much as `main` and the lane do. So every pose but the landing was shot again with the clock stopped: `performance.now`, `Date` and the frame clock held from the page's first line, `Math.random` seeded and the grain off, 1280 × 720, through the same DEV pose hook, each branch on its own dev server. `main`'s are from `cc5e2eaf` (`overview`, `falcon-sun`, `belt`, `station`, `far-rim`, `maw` and `middleearth-limb` shot during Task 11, the other six beside the lane's at this gate); the lane's are all from `058a3d17`.

Pixels that differ by more than 8 (of 255) in any channel, out of 921,600:

| pose | high | mid | low |
| --- | --: | --: | --: |
| `overview` | 339 * | 0 | 0 |
| `falcon-sun` | 5 | 2 | 0 |
| `belt` | 0 | 0 | 0 |
| `station` | 0 | 0 | 0 |
| `far-rim` | 0 | 0 | 0 |
| `maw` | 0 | not shot | not shot |
| `gaming` | 0 | 0 | 0 |
| `middleearth-limb` | 26,866 (air) | 28,048 (air) | 0 |
| `middleearth` | 19,740 (air) | 20,276 (air) | 0 |
| `rickmorty` | 12,948 (air) | 13,678 (air) | 0 |
| `caribbean` | 12,435 (air) | 12,585 (air) | 0 |
| `breakingbad` | 18,998 (air) | 19,557 (air) | 0 |
| `office` | 9,856 (air) | 10,009 (air) | 0 |

Draw calls and triangles with the clock stopped are equal, `main` against the lane, at every one of those 37 shots (high, for instance: `overview` 99 and 540,628; `station` 69 and 510,880; `falcon-sun` 81 and 525,606; `belt` 46 and 465,860; `far-rim` 42 and 85,160; `maw` 43 and 77,372; `gaming` 43 and 80,348; `middleearth-limb` and `middleearth` 39 and 106,406; `rickmorty` 40 and 107,532; `caribbean` 43 and 156,166; `breakingbad` 64 and 100,604; `office` 41 and 62,606).

- Everything else is a dither of at most 5 that differs between any two runs, `main`'s against `main`'s too.
- \* The 339 at `overview` are in one 30 × 26 box at (66, 505), the same box in which two of `main`'s own still runs differ (178 pixels, at (71, 504)): not the lane's.
- `falcon-sun`'s 5 and 2 are single specks at the frame's edge.
- **(air)**: every one is a ring round the planet's limb, nothing inside it or past it. These planets are past 3,000 out, where `main` already drew round the camera and set its planets' air middle in `update()`, before the shift, so the air was marched about the wrong place: on `main` the limb has no air; on the lane it has. Low draws the old halo, not the marched air (`planets.js`: the shell is made on high and mid only), so nothing changes there. This is `80754ad1`'s mend, not a regression. `gaming`'s planet has no air (`universes.js`: a Game Boy's screen), so nothing there changed.

### Draw calls and triangles, `universe-check.mjs` at each tier

`node scripts/universe-check.mjs --quality <tier> --frames 3`. Before: high and mid are the coordinator's shots of `main` at `cc5e2eaf` (`lab/universe/{high,mid}.json` in its checkout); the coordinator's low run is partly from a stopped run's log and drew far less than any run since at most poses, so low's before was shot again from `main` for this gate, back to back with the lane's. Headless Chromium draws in software (SwiftShader), a frame or two a second, so the frame times are noise and compare only with each other. A bold figure differs from before; each is explained under the tables.

#### high

| pose | calls before | calls after | triangles before | triangles after | frame before (ms) | frame after (ms) |
| --- | --: | --: | --: | --: | --: | --: |
| `overview` | 98 | 98 | 540,628 | 540,628 | 2493.6 | 3458.5 |
| `falcon-sun` | 82 | **81** | 525,686 | **525,606** | 4219.7 | 6556.6 |
| `middleearth-limb` | 39 | 39 | 106,406 | 106,406 | 3616.5 | 7870.3 |
| `rickmorty` | 39 | 39 | 91,688 | 91,688 | 1550.3 | 151.3 |
| `gaming` | 40 | 40 | 59,034 | 59,034 | 3325.5 | 2779.7 |
| `caribbean` | 43 | 43 | 156,166 | 156,166 | 1599 | 873 |
| `middleearth` | 39 | 39 | 106,406 | 106,406 | 1848.4 | 2400.8 |
| `breakingbad` | 63 | 63 | 92,994 | 92,994 | 12.1 | 1342.6 |
| `office` | 41 | 41 | 62,606 | 62,606 | 1325.5 | 2030.3 |
| `belt` | 46 | 46 | 465,860 | 465,860 | 3697.5 | 2557.8 |
| `maw` | 43 | 43 | 77,372 | 77,372 | 789.9 | 2180.6 |
| `landing-middleearth` | 129 | **206** | 181,875 | **226,538** | 7222.7 | 6898.7 |
| `station` | 69 | 69 | 510,880 | 510,880 | 3851.1 | 3200.6 |
| `far-rim` | 42 | 42 | 85,160 | 85,160 | 1047.3 | 1353 |

#### mid

| pose | calls before | calls after | triangles before | triangles after | frame before (ms) | frame after (ms) |
| --- | --: | --: | --: | --: | --: | --: |
| `overview` | 99 | **98** | 489,042 | **488,962** | 1873.2 | 1486.3 |
| `falcon-sun` | 82 | **81** | 474,020 | **473,940** | 1838.9 | 2395.9 |
| `middleearth-limb` | 39 | 39 | 37,732 | 37,732 | 1583.5 | 1100.9 |
| `rickmorty` | 40 | 40 | 38,858 | 38,858 | 1235.5 | 1239.3 |
| `gaming` | 43 | 43 | 45,466 | 45,466 | 3385.1 | 446.5 |
| `caribbean` | 43 | 43 | 87,492 | 87,492 | 3147.5 | 1268.9 |
| `middleearth` | 39 | 39 | 37,732 | 37,732 | 3296.5 | 870.4 |
| `breakingbad` | 64 | 64 | 31,930 | 31,930 | 2970.8 | 1638.8 |
| `office` | 41 | 41 | 23,236 | 23,236 | 2135.9 | 745.8 |
| `belt` | 46 | 46 | 421,298 | 421,298 | 2850.6 | 1136.1 |
| `maw` | 43 | 43 | 74,250 | 74,250 | 1894.7 | 822.7 |
| `landing-middleearth` | 116 | **117** | 126,980 | **126,982** | 3998.5 | 2245.2 |
| `station` | 69 | 69 | 459,214 | 459,214 | 5104 | 1622.2 |
| `far-rim` | 42 | 42 | 40,598 | **40,610** | 1489.5 | 617.4 |

#### low

Before is `main` shot again for this gate, back to back with the lane; the coordinator's own low run of `main` is beside it, to show how far `main` moves from run to run at this tier.

| pose | calls before | calls after | triangles before | triangles after | frame before (ms) | frame after (ms) | `main`, the coordinator's run |
| --- | --: | --: | --: | --: | --: | --: | --: |
| `overview` | 95 | 95 | 484,548 | 484,548 | 1628.8 | 1530.6 | 63 / 476,702 |
| `falcon-sun` | 81 | **77** | 471,628 | **469,526** | 800.6 | 1386.6 | 54 / 465,188 |
| `middleearth-limb` | 39 | **40** | 32,746 | **34,237** | 25.6 | 1053.7 | 24 / 8,850 |
| `rickmorty` | 40 | **33** | 33,864 | **8,898** | 885.2 | 307.9 | 40 / 33,864 |
| `gaming` | 43 | 43 | 43,088 | 43,088 | 655.1 | 758.4 | 26 / 10,842 |
| `caribbean` | 38 | **43** | 68,358 | **82,498** | 1456.7 | 1169.2 | 22 / 8,834 |
| `middleearth` | 39 | 39 | 32,738 | 32,738 | 907.2 | 347 | 17 / 4,002 |
| `breakingbad` | 64 | 64 | 26,936 | 26,936 | 472.7 | 777.5 | 25 / 8,850 |
| `office` | 34 | **41** | 8,898 | **18,242** | 476.7 | 639.8 | 41 / 18,242 |
| `belt` | 32 | **46** | 416,878 | **418,924** | 1753.7 | 325.4 | 28 / 415,134 |
| `maw` | 43 | 43 | 71,880 | **71,884** | 872.7 | 1059.1 | 27 / 8,854 |
| `landing-middleearth` | 116 | **76** | 126,660 | **52,294** | 2152.3 | 1094.4 | 116 / 126,662 |
| `station` | 61 | **66** | 454,550 | **454,588** | 2927.6 | 2358.3 | 69 / 456,836 |
| `far-rim` | 40 | **41** | 36,240 | **38,198** | 1047.3 | 214.9 | 39 / 36,198 |

#### What the bold figures are

- **One call and 80 triangles at `overview` and `falcon-sun`** come and go between runs of either branch: the lane's own earlier run (Task 11's) had 82 and 525,686 at `falcon-sun` and 99 and 489,042 at mid's `overview`, as `main`; with the clock stopped both branches draw 81 at `falcon-sun` and 99 at `overview` (high and mid).
- **`far-rim`'s 12 triangles at mid** likewise: Task 11's run of the lane and both stopped-clock runs have 40,598.
- **`landing-middleearth`** comes down where the planet has turned to when the landing starts, and it turns with the time since the page opened (`planets.js`: `turn0 + t * spin`, 0.05 to 0.1 radians a second), so which part of Middle-earth it lands in, and what's there to draw, changes with how long the page took to load. Held at the same turn (the probe sets the planet's turn and `hold(true)` before the pose), `main` and the lane come down on the same spot to every digit: at a turn of 1.0, the Shire at (0.769, −170.646), latitude and longitude on the planet's own map; at 6.929, the Shire at (0.769, −150.353). Unheld, the lane has come down in the Shire (this gate's high and mid runs, and a probe beside `main`'s that also landed in the Shire) and in Harad (a probe whose `main` twin landed in the Shire): which one is the clock's doing, not the lane's.
- **Low's spread** is the tier's own. Low makes nothing ready before it's first seen (`scene.js`'s `prepare` is left out there) and its pace can step down when frames are slow, so what's drawn at a pose depends on what had come in, and at what step, when the frame was counted: `main` against `main` swings from 17 to 39 calls at `middleearth` and from 8,898 to 18,242 triangles at `office`, and a planet's near set (8,898 triangles without it, 33,864 with it at `rickmorty`) is in or not by a few seconds. The lane's figures sit inside that spread, and with the clock stopped (above) all twelve low poses shot match `main` call for call and triangle for triangle, `rickmorty` with its near set (33,864) and `office` with 18,242.

### Frame times: `perf-probe.mjs universe`

`QUALITY=<tier> node scripts/perf-probe.mjs universe`, its default window (1470 × 956 at 2×), each branch on its own dev server, in the order lane mid, `main` mid, `main` low, lane low. The figures are the `fly` phase's (the table the probe prints last):

| tier | branch | ready (s) | fps | p50 (ms) | worst 1 % (ms) | draws | programs | late pipelines |
| --- | --- | --: | --: | --: | --: | --: | --: | --: |
| mid | `main` | 90.3 | 0.1 | 12.3 | 573,721.8 | 43 | 184 | 0 |
| mid | lane | 95 | 0.1 | 17.1 | 201,991.3 | 64 | 199 | 15 |
| low | `main` | 22.4 | 1.5 | 12.8 | 49,492.4 | 29 | 139 | 57 |
| low | lane | 26.8 | 1.6 | 9.3 | 49,546.7 | 34 | 146 | 84 |

These can't speak to the plan's 2%. The browser here draws in software, the machine was shared with another lane's browser checks while `main`'s mid ran, and single frames stall for minutes (`main`'s mid `fly` had a 729 s frame and a 419 s shader link, the lane's a 202 s link): p50 moves +39% at mid and −27% at low, opposite ways. The lane's late pipelines at mid are the materials of what turned up mid-flight (the meteor storm's rocks, the mines and a ship's hull, stripes and intakes), which the director sends at random; `main`'s mid run met none. The lane adds no material, no `onBeforeCompile` and no program: what it adds to a frame is a matrix read or two per body, deep space's `lit()` over its suns for each lit mesh, and a plane for each cut mesh, all in `onBeforeRender`. The probe at mid and low, before and after, on a real graphics chip is still owed (the hand-off notes).

### Pops

Not this PR's: the far layer's `pops()` arrives with PR 2.4's levels of detail.

## PR 2.4: levels of detail

### Task 14: the far layer

Two commits on `eu/lane-2`: `88471c74` farStars draws generated specks and discs in its one draw, and `a455bf1e` a far-layer slot keeps only what it was given; then, after review, a third that draws the discs after the slots, keys a slot for `pops()`, refuses a disc that is nowhere and takes `levels.js` through the Expanse's `shared/` face. `scene.js` isn't touched: 6,374 lines before and after.

#### Drawn for real

A page that draws only the far layer, through the dev server in headless Chromium (software GL, 640 × 360): the camera at (10^9, 2 × 10^8, −7 × 10^8), looking down −z, drawn through `relative.js`'s `drawn()`, the map moved round it. One hand-made place 30,000 ahead (red); a dark grey disc of radius 600 20,000 ahead, over it, lit from +x; a shining disc of radius 400 (1, 0.8, 0.3) at (8,000, 0, −20,000); a slot of two green specks, one 92,000 off past the far plane and one 20,000 off within it.

| frame | calls | points drawn | what the pixels show |
| --- | --: | --: | --- |
| the place alone | 1 | 13 | the place's star in the middle, (255, 208, 208): a white core in a red glare |
| the discs, the slot set but hidden | 1 | 13 | the rock over the star, (9, 9, 9); the shining disc (255, 204, 76), its colour exactly; no speck |
| the slot shown | 1 | 13 | the far speck (255, 255, 255) at its core; the near one nothing (a disc's, within the far plane) |
| the rock's sides | 1 | 13 | (5, 5, 5) 10 px left of its middle, (78, 78, 78) 10 px right: lit from +x |

Sizes, measured on the shot: the rock 35 to 36 px across (true size 35.3), the shining disc 21 px (21.9), the far speck 9 px (`starPx(speckBright(92,195, 500))`, 9.45). Every vertex is drawn, all 13 of the layer's points, the hidden put out of the frame in the vertex shader (at `538b14af` the draw stopped at the last slot shown: 5 points, then 9; the pixels were the same as these). No shader error, and no console error but one 404 for something the page doesn't name (the site has no `/favicon.ico`); the map and the camera are back where they were after each draw.

A second page, the review's: the same camera, two dark discs (grey 0.05, radius 600) 20,000 ahead, a hand-made place straight behind the left one and a speck 92,000 off straight behind the right one, and a speck in the open. One draw and one program, and no error but the same 404.

| | left rock's middle (a place behind) | right rock's middle (a speck behind) | the speck in the open |
| --- | --: | --: | --: |
| `538b14af` (discs, then slots) | (13, 13, 13) | (255, 255, 255): the speck through the rock | (255, 255, 255) |
| after (slots, then discs) | (13, 13, 13) | (13, 13, 13) | (255, 255, 255) |

One draw blends in its vertices' order, so a speck drawn after a disc adds over it; with the discs last, a dark rock hides the places and the specks behind it. The baseline poses weren't shot again for this: with no slots and no discs, as every pose has, the layer's vertices and its draw are what they were.

#### No pixel changes at the core

Every baseline pose draws the hand-made places through the new path: written from the camera, the points at the camera, premultiplied blending, the hidden put out of the frame in the vertex shader. Shot with the clock stopped (the PR 2.3 gate's way), at 1280 × 720, against the lane's own stills at `058a3d17` (nothing between draws differently: `439f22b8` and `57436f12` add pure modules nothing draws yet). Pixels that differ by more than 8 (of 255) in any channel, out of 921,600, and the calls and triangles before and after:

| pose | mid: over 8 (largest) | mid: calls, triangles | low: over 8 (largest) | low: calls, triangles |
| --- | --: | --- | --: | --- |
| `overview` | 0 (5) | 99, 488,962 = | 0 (5) | 98, 486,570 = |
| `falcon-sun` | 0 (0) | 81, 473,940 = | 0 (5) | 80, 471,548 = |
| `belt` | 0 (4) | 46, 421,298 = | 0 (4) | 46, 418,920 = |
| `station` | 0 (5) | 69, 459,214 = | 0 (5) | 69, 456,836 = |
| `far-rim` | 0 (5) | 42, 40,598 = | 0 (5) | 42, 38,220 = |
| `middleearth-limb` | 0 (5) | 39, 37,732 = | 0 (4) | 39, 32,738 = |

The rest is the dither of at most 5 that differs between any two runs (above). `far-rim`'s sky has the far places' stars in it, spikes and all, and they land where they did. High wasn't shot again: the far layer does nothing by tier.
