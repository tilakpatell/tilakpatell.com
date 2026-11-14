# Endless universe, lane 3: places you can go

The lane's numbers, task by task. Plan: `docs/superpowers/plans/2026-10-18-endless-universe-lane-3-places.md`. Spec: `docs/superpowers/specs/2026-10-18-endless-universe-design.md`.

## Bundle

Each chunk with every chunk it imports statically, as the browser loads them (`import()` left out), gzipped, and where the marker is. The marker is `Waystation`, the last of the stations' names (Task 1), so it is in a chunk only when the generator's stations are. Measured with the plan's `chunks.mjs` (Task 1, Step 0), a scratch script that isn't committed: `node chunks.mjs dist/assets Waystation Front CommandPalette Interests Terminal`.

The builds went to `/dev/shm` (`npx vite build --outDir /dev/shm/lane3-dist --emptyOutDir`), because the container's disk had too little room for `dist/` and its 1.4 GB of `public/`. The chunks are the same wherever they are written.

### Before: `eu/lane-3` at `dcf19687`, no code of this lane

```
Front: 144 chunks, 683.13 kB gzipped; Waystation in none
CommandPalette: 48 chunks, 172.54 kB gzipped; Waystation in none
Interests: 27 chunks, 150.95 kB gzipped; Waystation in none
Terminal: 33 chunks, 168.96 kB gzipped; Waystation in none
```

### Task 1: stations in the generator

```
Front: 144 chunks, 683.51 kB gzipped; Waystation in sector-BTRtSTMv.js
CommandPalette: 48 chunks, 172.54 kB gzipped; Waystation in none
Interests: 27 chunks, 150.95 kB gzipped; Waystation in none
Terminal: 33 chunks, 168.96 kB gzipped; Waystation in none
```

`Front` grows by 0.38 kB, the stations' code, which it reaches through `online/rosterWhere.js` and `fullSector` (the plan's finding 21). The other three don't change, and the stations are in none of them. The generator sits in a chunk of its own, `sector-*.js`, which `Online-*.js`, `Front`, the galaxy's pages, `Fly` and the universe's scene load statically; the plan had it inside `Online-*.js`. The site's entry names it only in its preload list, for a dynamic import.

### Before Task 7: `eu/lane-3` at `4bdf71f3`, Tasks 1 to 6 in

```
Front: 144 chunks, 683.52 kB gzipped; Waystation in sector-BTRtSTMv.js
CommandPalette: 48 chunks, 172.55 kB gzipped; Waystation in none
Interests: 27 chunks, 150.96 kB gzipped; Waystation in none
Terminal: 33 chunks, 168.97 kB gzipped; Waystation in none
```

### Task 7: `nav.js` takes `E:` ids

First with `nav.js` importing `places/ids.js`, `park.js` and `trip.js`, as the plan had it:

```
Front: 146 chunks, 685.32 kB gzipped; Waystation in sector-BdINBBV_.js
CommandPalette: 50 chunks, 174.69 kB gzipped; Waystation in none
Interests: 27 chunks, 151.12 kB gzipped; Waystation in none
Terminal: 35 chunks, 171.11 kB gzipped; Waystation in none
```

`CommandPalette` grew by 2.14 kB, over the 2 kB it may. No `Waystation`, so the generator wasn't the weight: `nav-*.js` grew by 1.38 kB (the ids, the park and the formula), and the light face came in as two small chunks of its own, `orbits-*.js` (0.46 kB) and `extent-*.js` (0.13 kB), split off because the generator's chunk shares them. So, as the plan says, `nav.js` stopped importing `park.js` and takes the park from its caller's lookup, `{ place(id), park(id, from) }`, which `lookupOf` supplies from `parkPlace`. After:

```
Front: 144 chunks, 684.31 kB gzipped; Waystation in sector-yTJca6bL.js
CommandPalette: 48 chunks, 173.35 kB gzipped; Waystation in none
Interests: 27 chunks, 151.09 kB gzipped; Waystation in none
Terminal: 33 chunks, 169.77 kB gzipped; Waystation in none
```

| chunk | before | after | growth |
| --- | --: | --: | --: |
| `Front` | 683.52 | 684.31 | 0.79 kB |
| `CommandPalette` | 172.55 | 173.35 | 0.80 kB |
| `Interests` | 150.96 | 151.09 | 0.13 kB |
| `Terminal` | 168.97 | 169.77 | 0.80 kB |

`Waystation` is in neither `CommandPalette`'s closure nor `Interests`'. `Interests` doesn't load `nav.js` before lane 6a's mini-map, and moves by 0.13 kB only because `layout-*.js`, which it loads, holds `lib/space/address.js`, and `parseSpaceId` and `spaceId` are kept there now that `places/ids.js` uses them. `places/weight.test.js` pins both: nothing `nav.js`, `CommandPalette.jsx` or `Interests.jsx` reaches by static imports is the generator or the resolver, and `nav.js` doesn't reach `park.js`.

`node scripts/health.mjs --check --skip build` after: `boundary-breaks` 481 and `cycles` 5, as before Task 1.

## The stations

`stations.test.js` checks a station's height as `[y + h, y − h]` containing its `y`, not the plan's `|st.at[1] − sys.at[1]| === poleHeight(…)`, because `(y + h) − y` needn't be `h` in floats: the check is as exact, and loosens nothing.

Over the plan's five test cubes (`[1, 0, 0]`, `[0, 0, 1]`, `[2, 1, -3]`, `[0, 0, 0]` and `[-3, -1, 2]`), 397 of 1,176 systems have a station: 33.8%. Those systems have 4,581 planets. Making a sector's stations takes 0.5 to 1.3 ms (the best of nine, in Vitest, on a busy container), against 27 to 69 ms for the same sector without its lattice, so `fullSector` makes them whether or not it makes the lattice:

| cube | systems | stations | stations, ms | sector without things, ms |
| --- | --: | --: | --: | --: |
| `1,0,0` | 276 | 87 | 1.28 | 68.8 |
| `0,0,1` | 302 | 101 | 1.30 | 54.5 |
| `2,1,-3` | 225 | 76 | 0.98 | 33.4 |
| `0,0,0` | 113 | 50 | 0.49 | 27.4 |
| `-3,-1,2` | 260 | 83 | 1.08 | 49.9 |

## A sector made on the main thread

`resolvePlace` for an id in a sector not yet made (Task 3), with `build` on, as only the terminal and tests have it. It makes the whole sector, lattice and all, on the calling thread. Timed in Node 22 on `eu/lane-3` after Task 3, by a scratch script that isn't committed, with the container busy (load 7 to 13 on 4 cores, the other track's checks running):

| | the five | median |
| --- | --- | --: |
| cold: the first call in a fresh process, `E:5,7:0` | 133.0, 108.6, 141.4, 122.4, 127.1 ms | 127 ms |
| warm: after three other sectors, `E:30,-4:0` to `E:34,-4:0` | 93.3, 67.4, 62.3, 51.4, 61.1 ms | 62 ms |

A second cold round gave a median of 130 ms, and four more warm rounds medians of 41 to 98 ms over the same five sectors, so the load is what moved it. At `cc5e2eaf` the plan had `placeOf` 75 to 100 ms cold and about 45 ms warm. Either way it is several frames, which is why the scene never builds: it passes `build: false` and fetches a sector it hasn't got from lane 2's worker pool.

From a sector in hand (`build: false`, found by its own id in a `Map` keyed `'1,0,0'`, as lane 2's chunk grid keys its cells), a resolve takes 10 to 16 µs, card and all: 249 systems and planets of `E:1,0`, twenty times each.

Task 14 adds the terminal's own number, at 4× CPU throttling.

## Round the ship

`placesAround` (Task 8) over the 27 sectors round `E:1,0` (cubes `[0…2, −1…1, −1…1]`, 6,877 systems), from `E:1,0`'s middle at `t` 2,000 to 2,050, 200 calls after 50 to warm. Timed in Vitest on `eu/lane-3` by a scratch script that isn't committed, with the container busy (load 14 to 16 on 4 cores, the other track's checks running), three runs:

| `max` | rows | warm median, ms | best, ms |
| --- | --- | --: | --: |
| 1,800 (mid's far-layer room) | 1,800: 51 systems, 196 planets, 289 moons, 1,264 things | 2.20, 2.45, 1.70 | 1.07 |
| 6,000 (ultra's) | 2,500: 69 systems, 275 planets, 410 moons, 1,746 things, all within the far plane | 2.47, 2.95, 1.85 | 1.30 |

Under the plan's 4 ms at mid, a sixtieth of the quarter second between refreshes. The cap doesn't bind at ultra: only 2,500 lie within the far plane there.

The first call in a fresh process took 40, 192 and 46 ms. Nearly all of it is the lattice things' rows: `thingRow` costs about 20 µs a thing (its name's seed is BigInt work), and a call keeps up to 1,264 of them at mid. Each body's row less where it is (name, look, park, `src`) is made the first time it's kept and kept with the generator's row in a `WeakMap`, so only a sector's first call pays. That is after a load or a jump; at cruise, a quarter second's flight brings a handful of new things into the far plane.

`aimStars` over the same 27 sectors, the nearest 2,000 of 6,877: a median of 1.03 to 2.36 ms.

## PR 3.1's gate

Run on `eu/lane-3` at `851112b3`, Tasks 1 to 9 in, on 2026-10-25, with the container busy (load 13 to 28 on 4 cores during the full test run, other lanes' builds, lint and browser checks running).

| command | outcome |
| --- | --- |
| `npm run lint` | green, no warnings (6 min 19 s) |
| `npm test` | 1,915 files green; 54 files red with 83 tests, every one a timeout (76 "Test timed out in 5000ms") or a time budget (`road/terrain.test.js`'s 250 ms, `bf2017-hulls.test.mjs`'s 100 ms), 1,329 s |
| the same 54 files again, `npx vitest run --maxWorkers=2 …` | 54 files, 1,263 tests, all green (156 s, load 3 to 9) |
| `npm run build` | green (6 min 29 s), with `-- --outDir /dev/shm/lane3-gate-dist --emptyOutDir`, since the disk had 1.6 GB free |
| `node scripts/health.mjs --check --skip build` | within budget |
| `node scripts/flight-island.mjs --check` | ok: 151 files on the island, 39 marked rows, 62 references |

None of the 54 files is one this lane changed. On `main` at `cc5e2eaf`, the coordinator's full run under a lighter load had one red, `art-mix.test.mjs`, the same timeout. `npm run build`'s `prebuild` rewrote `public/github.json` from the network; it was put back, so the tree is clean.

The PR's own checks: `npx vitest run src/components/universe/places src/components/expanse src/components/universe/nav.test.js src/components/universe/budget.test.js src/components/universe/ship.test.js` is 61 files and 652 tests, all green. Lane 2's `fingerprint.test.js`, `density.test.js` and `space.test.js` are unchanged since `dcf19687` and green: 52 tests, the speed test's ten sectors under its 600 ms.

`health.mjs` after, against before Task 1:

| metric | before Task 1 | after Task 9 | budget |
| --- | --: | --: | --: |
| `big-files` | 22 | 22 | 30 |
| `boundary-breaks` | 481 | 481 | 489 |
| `cycles` | 5 | 5 | 5 |

`boundary-breaks` and `cycles` before Task 1 are Task 7's numbers above. `big-files` before is from the line counts: no file this lane made or changed crossed 800 lines. The largest new one is `places/around.js`, 369, and `ship.js` was already over, 871 lines to 873 (`PARK_GAP` and `clearOf`).

`src/components/universe/scene.js`: 6,374 lines before and after (`wc -l`). PR 3.1 doesn't touch it.

### Draw calls, triangles and frame times

Nothing on screen changes in PR 3.1, so by the plan it has no browser check: no pose is shot after, and pops aren't measured. The scene doesn't read stations, the cards, the resolver or the tags yet; `nav.js` keeps its answers for the hand-made places (its old tests pass unchanged). The before for the baseline poses is the coordinator's `node scripts/universe-check.mjs --quality all --frames 3` on `main` at `cc5e2eaf` (`lab/universe/{low,mid,high}.json` there; low's first six poses from the stopped run's log). That is `main`, not this branch's base: lane 2's PRs 2.3 and 2.4 are under `eu/lane-3`. Task 10 shoots this branch's own before at `--quality mid`, and Task 15 the full measure after.

| pose | low: calls, triangles | mid: calls, triangles | high: calls, triangles | frame ms, low / mid / high |
| --- | --: | --: | --: | --: |
| `overview` | 63, 476,702 | 99, 489,042 | 98, 540,628 | 4,890 / 1,873 / 2,494 |
| `falcon-sun` | 54, 465,188 | 82, 474,020 | 82, 525,686 | 5,087 / 1,839 / 4,220 |
| `middleearth-limb` | 24, 8,850 | 39, 37,732 | 39, 106,406 | 1,874 / 1,584 / 3,617 |
| `rickmorty` | 40, 33,864 | 40, 38,858 | 39, 91,688 | 391 / 1,236 / 1,550 |
| `gaming` | 26, 10,842 | 43, 45,466 | 40, 59,034 | 1,640 / 3,385 / 3,326 |
| `caribbean` | 22, 8,834 | 43, 87,492 | 43, 156,166 | 2,765 / 3,148 / 1,599 |
| `middleearth` | 17, 4,002 | 39, 37,732 | 39, 106,406 | 1,705 / 3,297 / 1,848 |
| `breakingbad` | 25, 8,850 | 64, 31,930 | 63, 92,994 | 328 / 2,971 / 12 |
| `office` | 41, 18,242 | 41, 23,236 | 41, 62,606 | 68 / 2,136 / 1,326 |
| `belt` | 28, 415,134 | 46, 421,298 | 46, 465,860 | 2,841 / 2,851 / 3,698 |
| `maw` | 27, 8,854 | 43, 74,250 | 43, 77,372 | 2,174 / 1,895 / 790 |
| `landing-middleearth` | 116, 126,662 | 116, 126,980 | 129, 181,875 | 4,352 / 3,999 / 7,223 |
| `station` | 69, 456,836 | 69, 459,214 | 69, 510,880 | 2,131 / 5,104 / 3,851 |
| `far-rim` | 39, 36,198 | 42, 40,598 | 42, 85,160 | 1,147 / 1,490 / 1,047 |

Frame times are the median where the run kept one, else the one frame, in software GL on a shared container, so they say little.

## PR 3.1's gate, after its reviews

Run again on `eu/lane-3` at `59b937a0`, the two review commits in (`af49ae70`, `59b937a0`), on 2026-10-25, with the container busy (load 16 to 21 on 4 cores during the full test run, other lanes' lint, tests and a dev server running).

| command | outcome |
| --- | --- |
| `npm run lint` | green, no warnings (3 min 55 s) |
| `npm test` | 1,955 files green, 1 skipped; 16 files red with 24 tests, every one a timeout (21 "Test timed out", at 5, 20 or 30 s), 1,006 s |
| the same 16 files again, `npx vitest run --maxWorkers=2 …` | 16 files, 577 tests, all green (57 s, load 5) |
| `npm run build` | green (3 min 2 s), with `-- --outDir /dev/shm/lane3-gate2-dist --emptyOutDir`, since the disk had 1.4 GB free |
| `node scripts/health.mjs --check --skip build` | within budget |
| `node scripts/flight-island.mjs --check` | ok: 151 files on the island, 39 marked rows, 62 references |

None of the 16 files is one this lane changed. On `main` at `cc5e2eaf`, the coordinator's full run under a lighter load had one red, `art-mix.test.mjs`, the same timeout. `npm run build`'s `prebuild` rewrote `public/github.json` from the network; it was put back, so the tree is clean.

The PR's own checks: `npx vitest run src/components/universe/places src/components/expanse src/components/universe/nav.test.js src/components/universe/budget.test.js src/components/universe/ship.test.js` is 62 files and 679 tests, all green (the reviews added `extent.test.js` and split the long tests). Lane 2's `fingerprint.test.js`, `density.test.js` and `space.test.js` are unchanged since `dcf19687` and green: 52 tests, the speed test's ten sectors under its 600 ms.

`health.mjs`: `big-files` 22, `boundary-breaks` 481 and `cycles` 5, as before Task 1. `src/components/universe/scene.js`: 6,374 lines before and after (`wc -l`); PR 3.1 doesn't touch it. Nothing on screen changes, so there are no new draw calls, triangles, frame times or pops to take: the table above stands.
