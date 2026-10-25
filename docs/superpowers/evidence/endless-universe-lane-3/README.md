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

## The stations

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
