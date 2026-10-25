# The map, first half: the gate (endless universe, lane 6a)

The lane’s one PR, gated as a whole on 2026-10-25, on the lane at `3cf60b7c` (“Hand-off: the map’s first half”, Tasks 1 to 11 on `main` at `cc5e2eaf`). The shots, the nav map’s own checks and the mini-map’s bundle are in `../endless-universe-6a-map/README.md`. The text for `HANDOFF-universe.md` is in `HANDOFF-NOTES.md` beside this file.

The container had four cores and the other lanes’ tests and browsers on them all day: the load average ran from 6 to 39, mostly 12 to 25. Every timed thing below was timed under that load.

## The gates

| Command | Result |
| --- | --- |
| `npm run lint` | Clean. |
| `npm test` | Red on time alone, as `main` is. The whole suite: 1,937 files passed, 26 failed, 1 skipped; 21,375 tests passed, 29 failed, 8 skipped (1,179 s). All 29 ran out of time: 28 past their timeout (5 s for 26 of them, 20 s and 30 s for the other two) and `bf2017-hulls`’s Star Destroyer past its 100 ms budget (234 ms). Run again with fewer files at once, every one of the 26 files passes: with two workers, 20 passed and 7 tests in 6 files ran out of time again (5.8 to 12.9 s); those 6 with one worker passed, all 230 tests. None of the 26 is a file the lane changed, and the lane’s own 15 test files pass on their own (239 tests, 9.5 s). `main`’s full run on 2026-10-24 had one test out of time too (`art-mix`, 7.8 s). |
| `npm run build` | Built (3,801 modules, 54 s). Its `prebuild` was refused by GitHub’s API (401) and kept the last snapshot; the line it changed in `public/github.json` was put back, not being the lane’s. |
| `node scripts/health.mjs --check --skip build` | Within budget, every metric as in Task 11’s run: `big-files` 22 (none of the lane’s; `scene.js` 6,410 by its count), `boundary-breaks` 484, `cycles` 5, `lint-disables` 54, `kbd-styles` 68, `glsl-sites` 613, `renderers` 14, `loops` 58, `client-json-kb` 1,256, `art-mix` 7. |
| `node scripts/flight-island.mjs --check` | `ok 151 files on the island, 39 marked rows, 62 references`. |
| `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe` | Red on time alone, as `main` is (below). Three runs, each: the eight core pages that aren’t 3D ok, and `/` and `/universe` “no canvas: the 3D never started” at 102 to 104 s. |
| `scripts/navmap-check.mjs`, all four modes (Task 10’s run at `b5c1feb5`, cited) | 50 of 51, no page errors. Nothing under `src` or `scripts` has changed since (`git diff b5c1feb5..3cf60b7c` is the evidence folders alone), so it wasn’t run again. The one is “a trip time for every drive”: from 7 of `ship.js`’s 32 starts the cruise to Avengers HQ is past `nav.js`’s 150 s, so it reads “—”. `main`’s check has the same step and `main`’s `nav.js` and `ship.js` are the lane’s, so it fails from those starts on `main` too. The phone mode covers the sideways (844 × 390) layout; the run’s whole output is in the other README’s “The checks after”. |

The lane’s pictures are all under 1 MB: 26 PNGs, the biggest 687 kB (`before/7-home-system.png`). `NavMap.jsx` is 442 lines (667 on `main`); the biggest new file is `NavChart.jsx`, 348.

## The smoke check’s canvas

The smoke check waits 90 s for a canvas on a 3D page (`autopilot-check.mjs`, `waitForSelector('canvas', { timeout: 90000 })`). Task 11’s run on 2026-10-24 passed: `/` took 88 s in all and `/universe` 82 s, an 8 s settle after the canvas included. Today the canvas came later than 90 s on every build, `main`’s too.

To see that the 3D starts at all, and when, a probe opens the page as the smoke check does (its init script, 1440 × 900, the same Chromium flags, quality high) against a preview of a build and times the canvas, up to 7 minutes. `main`’s build was made into a folder outside its checkout (`vite build --outDir`), so the checkout wasn’t touched.

| Run | Load | `/` | `/universe` |
| --- | --- | --- | --- |
| The lane, alone | 16 to 19 | 174 s | 160 s |
| `main`, alone | 11 to 12 | 129 s | 108 s |
| The lane and `main` at once (same load for both) | 11 to 14 | lane 137 s, `main` 122 s | lane 170.1 s, `main` 170.7 s |

Every one drew the 3D (not the flat map), with no page error and no console error. The lane changes nothing on the way to the canvas: `UniverseMap.jsx`’s one change is in its 3D-off branch (`MiniMap` to `FlatMap`).

## Draw calls and triangles

`scene.js`, `ship.js`, `nav.js`, `post.js` and the generator are as on `main` (`git diff cc5e2eaf..3cf60b7c` on them is empty). The lane’s changes are the page’s DOM and SVG over the canvas and the 3D-off map, and none of them reaches the scene. So the draw calls and triangles should be as on `main`. Measured with `node scripts/universe-check.mjs --frames 3` at each of its 14 poses and three tiers, 1280 × 720, each pose a fresh page:

- **High**, against the coordinator’s run of `main` at `cc5e2eaf`, both on the dev server universe-check starts. Nine poses come from a first run on `3cf60b7c` whose browser was closed before it wrote its file (its log kept), and the other five from a second run.
- **Mid and low**, `main` and the lane at the same time, each on a dev server of its own. The coordinator’s run of `main` is beside them for reference. They aren’t compared with it directly, for the reason below.

Every result is in `universe-check/` beside this file: each run’s JSON as universe-check wrote it (`main-coordinator-*.json` the coordinator’s runs of `main`; `lane-high-rest.json` the lane’s second high run; `main-mid*.json`, `main-low.json`, `lane-mid*.json` and `lane-low.json` the side-by-side runs), and the lines printed by the runs that wrote none: `lane-high-first-run.txt` (its nine poses, then the browser closed under it at `belt`) and `lane-mid-plain-server-overview.txt` (the lane’s mid overview on the plain server, a run stopped after it). No pose in the JSON had a page error.

In short: where a pose measures the same twice, the lane draws what `main` draws, and where it doesn’t, `main` differs from itself as much as from the lane. Two things make one run differ from another of the same code here:

- **The dev server.** The worktrees’ `node_modules` is a link to another folder, and the dev server universe-check starts refuses the files it serves from there that aren’t modules (the fonts are some: the 6a-map README’s “The server, and the fonts”). A server with the linked folder allowed draws a slightly different scene, on `main` and the lane alike: at 12 of the 14 mid poses exactly 2 calls fewer and 29,655 triangles more, at the overview 3 fewer and 29,575 more, and the landing varies (below). The mid overview is 99 / 489,042 on the first kind and 96 / 518,617 on the second, for `main` and the lane both. The side-by-side runs are on the second kind, each with its own deps cache, so neither shares `node_modules/.vite` with the other or with another lane’s server.
- **The time a pose is measured at.** In software GL a pose is measured minutes after the page opens, by the clock of a loaded machine. The planets have turned, the props have moved round their orbits, and the textures and models that stream in have got further or not so far: the geometries and textures the renderer holds differ run to run (at low, `main` held 41 textures at `office` in one run and 60 in another). So a pose can draw more or less of the same scene.

**High** (the plain dev server, as the coordinator measured `main`)

| Pose | `main`: calls / triangles | The lane: calls / triangles | Frame ms, `main` → lane |
| --- | --- | --- | --- |
| `overview` | 98 / 540,628 | 98 / 540,628 | 2,267 → 2,934 |
| `falcon-sun` | 82 / 525,686 | 82 / 525,686 | 4,376 → 2,594 |
| `middleearth-limb` | 39 / 106,406 | 39 / 106,406 | 3,790 → 2,847 |
| `rickmorty` | 39 / 91,688 | 39 / 91,688 | 3,367 → 1,448 |
| `gaming` | 40 / 59,034 | 40 / 59,034 | 5,081 → 4,067 |
| `caribbean` | 43 / 156,166 | 43 / 156,166 | 1,420 → 2,948 |
| `middleearth` | 39 / 106,406 | 39 / 106,406 | 2,239 → 2,243 |
| `breakingbad` | 63 / 92,994 | 63 / 92,994 | 1,826 → 3,043 |
| `office` | 41 / 62,606 | 41 / 62,606 | 1,283 → 3,079 |
| `belt` | 46 / 465,860 | 46 / 465,860 | 3,883 → 2,968 |
| `maw` | 43 / 77,372 | 43 / 77,372 | 759 → 863 |
| `landing-middleearth` | 129 / 181,875 | 129 / 181,927 ≠ | 7,172 → 7,245 |
| `station` | 69 / 510,880 | 69 / 510,880 | 3,600 → 4,836 |
| `far-rim` | 42 / 85,160 | 42 / 85,160 | 1,043 → 1,111 |

13 of 14 the same.

**Mid** (side by side, each on a server of its own with the linked folder allowed; the coordinator’s plain-server run of `main` for reference)

| Pose | `main`, side by side | The lane, side by side | Frame ms, `main` → lane | `main`, coordinator’s run |
| --- | --- | --- | --- | --- |
| `overview` | 96 / 518,617 | 96 / 518,617 | 2,861 → 3,188 | 99 / 489,042 |
| `falcon-sun` | 80 / 503,675 | 80 / 503,675 | 3,199 → 2,327 | 82 / 474,020 |
| `middleearth-limb` | 37 / 67,387 | 37 / 67,387 | 3,603 → 4,326 | 39 / 37,732 |
| `rickmorty` | 38 / 68,513 | 38 / 68,513 | 1,652 → 3,219 | 40 / 38,858 |
| `gaming` | 41 / 75,121 | 41 / 75,121 | 1,021 → 2,267 | 43 / 45,466 |
| `caribbean` | 41 / 117,147 | 41 / 117,147 | 3,194 → 2,433 | 43 / 87,492 |
| `middleearth` | 37 / 67,387 | 37 / 67,387 | 2,688 → 3,141 | 39 / 37,732 |
| `breakingbad` | 62 / 61,585 | 62 / 61,585 | 2,532 → 2,189 | 64 / 31,930 |
| `office` | 41 / 23,236 | 39 / 52,891 ≠ | 2,372 → 2,409 | 41 / 23,236 |
| `belt` | 44 / 450,953 | 44 / 450,953 | 2,099 → 2,960 | 46 / 421,298 |
| `maw` | 41 / 103,905 | 41 / 103,905 | 2,316 → 2,136 | 43 / 74,250 |
| `landing-middleearth` | 197 / 193,848 | 79 / 89,295 ≠ | 11,467 → 7,584 | 116 / 126,980 |
| `station` | 67 / 488,869 | 67 / 488,869 | 2,953 → 6,007 | 69 / 459,214 |
| `far-rim` | 40 / 70,253 | 40 / 70,253 | 1,905 → 2,561 | 42 / 40,598 |

12 of 14 the same side by side.

**Low** (side by side, each on a server of its own with the linked folder allowed; the coordinator’s plain-server run of `main` for reference)

| Pose | `main`, side by side | The lane, side by side | Frame ms, `main` → lane | `main`, coordinator’s run |
| --- | --- | --- | --- | --- |
| `overview` | 95 / 518,541 | 71 / 476,802 ≠ | 1,837 → 4,551 | 63 / 476,702 |
| `falcon-sun` | 65 / 503,571 | 65 / 503,491 ≠ | 3,713 → 5,217 | 54 / 465,188 |
| `middleearth-limb` | 22 / 42,827 | 24 / 42,843 ≠ | 2,439 → 4,315 | 24 / 8,850 |
| `rickmorty` | 33 / 42,891 | 22 / 42,827 ≠ | 1,127 → 4,294 | 40 / 33,864 |
| `gaming` | 24 / 42,843 | 22 / 42,827 ≠ | 3,018 → 3,296 | 26 / 10,842 |
| `caribbean` | 24 / 42,843 | 22 / 8,834 ≠ | 1,461 → 3,481 | 22 / 8,834 |
| `middleearth` | 22 / 42,827 | 24 / 8,850 ≠ | 2,509 → 2,821 | 17 / 4,002 |
| `breakingbad` | 24 / 42,843 | 21 / 42,763 ≠ | 3,242 → 5,005 | 25 / 8,850 |
| `office` | 17 / 4,002 | 21 / 42,763 ≠ | 996 → 1,618 | 41 / 18,242 |
| `belt` | 43 / 450,891 | 27 / 449,127 ≠ | 1,101 → 1,677 | 28 / 415,134 |
| `maw` | 27 / 100,479 | 22 / 42,827 ≠ | 1,574 → 6,123 | 27 / 8,854 |
| `landing-middleearth` | 168 / 206,973 | 164 / 173,498 ≠ | 1,379 → 7,781 | 116 / 126,662 |
| `station` | 32 / 467,615 | 32 / 467,615 | 7,422 → 2,176 | 69 / 456,836 |
| `far-rim` | 22 / 68,363 | 22 / 68,363 | 2,134 → 1,718 | 39 / 36,198 |

2 of 14 the same side by side.

### What differs, and why it isn’t the lane

- **High:** `landing-middleearth` is 52 triangles over `main`’s (181,927 against 181,875), the same 129 calls. It is the on-foot landing, which streams its ground and props in round you as it goes, and at mid the same pose moved by about 100,000 triangles between two runs of the same checkout (below).
- **Mid:** `office` reads 39 / 52,891 on the lane and 41 / 23,236 on `main`. That is the two servers’ difference above to the call and the triangle, so `main`’s run measured it before that piece had come and the lane’s after. `landing-middleearth` reads 197 / 193,848 on `main` and 79 / 89,295 on the lane, and 116 / 126,980 in the coordinator’s run of `main`: three runs, three answers.
- **Low:** `main` against `main` (the coordinator’s run and today’s) differs at all 14 poses, and the lane against `main` side by side at 12. The same few counts turn up at different poses on both (42,827, 42,843, 42,763, 8,850, 8,834 triangles: the lane’s `caribbean`, 22 / 8,834, is the coordinator’s `main` exactly). The low tier’s counts here say how far loading had got, not what the code draws.

### The poses that differ, measured again

`main` and the lane side by side again, on the same two servers, at the mid poses that differed (the first run’s numbers in brackets):

| Pose | `main` | The lane |
| --- | --- | --- |
| `office` | 39 / 52,891 (41 / 23,236) | 39 / 52,891 (39 / 52,891) |
| `landing-middleearth` | 108 / 91,451 (197 / 193,848) | 203 / 195,508 (79 / 89,295) |

`office` is the same on both now. At `landing-middleearth` the two have swapped places: each checkout has drawn about 90,000 triangles in one run and about 195,000 in the other. High’s `landing-middleearth` (the 52 triangles) couldn’t be measured again. The kernel’s out-of-memory killer took both pages’ renderers at 05:38: every lane’s commands share one memory limit, and two other lanes’ browsers were running at the time. It had taken Chromium processes at 04:14 too, as the first pair of low runs stopped; those were run again from the start for the table above. The mid landing’s spread is the same pose’s.

## `scene.js`

6,409 lines (`wc -l`) on `main` and on the lane: the lane doesn’t touch it. `health.mjs` counts 6,410.

## Frame times

The tables’ frame times are the mean of three timed frames, in software GL under the load above. They say how busy the machine was, not how fast the code is: `main`’s mid `overview` took 1,839 ms in the coordinator’s run and 2,861 ms in today’s, and the lane’s took 3,188 ms beside it and 1,354 ms in a run of its own that was stopped after that pose.

## Pops

Not measured. Nothing on this branch counts the universe’s pops (universe-check has no such number), and the lane changes nothing the scene draws or streams.
