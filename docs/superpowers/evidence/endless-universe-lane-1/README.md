# Endless universe, lane 1: nebulae and the sky

The lane’s numbers, before and after. Plan: `docs/superpowers/plans/2026-10-18-endless-universe-lane-1-nebulae.md`. Spec: `docs/superpowers/specs/2026-10-18-endless-universe-design.md` (section D, and item 5 of “What done looks like”).

## Task 1: the before

### Where the before comes from

The lane lands on top of lane 2, so its before is the tip it starts from, not `main`. `eu/lane-1` starts at `ebfb2307`, lane 2’s PR 2.4 task 16: camera-relative drawing (PR 2.3), the budget table, the levels, the far layer, the discs and the nearest systems. Nothing of this lane’s is in it.

- **The lane’s before:** `node scripts/universe-check.mjs --quality mid --frames 3 --out lab/universe/lane1-before/mid`, run at `ebfb2307` on 2026-10-25 (exit 0, every pose ok, no page error). Mid only: the coordinator’s browser budget gives a lane one tier, and runs every tier once at the end. The numbers are `before-mid.json`; the overview pose’s shot is `before-universe.webp`.
- **`main` beside it:** the coordinator’s run of every tier at `cc5e2eaf` (`node scripts/universe-check.mjs --quality all --frames 3`), copied as `main-{high,mid,low}.json`. They show what lane 2 moved before this lane starts.

### Calls and triangles a pose

A whole frame’s draw calls and triangles from `renderer.info`, at 1280 × 720. The ten poses without a mark are `lab/universe/baseline/high.json`’s keys; † marks the other four that `universe-check.mjs` measures.

| pose | main high calls | main high tris | main mid calls | main mid tris | main low calls | main low tris | lane mid calls | lane mid tris |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| `overview` | 98 | 540,628 | 99 | 489,042 | 63 | 476,702 | 98 | 488,962 |
| `falcon-sun` | 82 | 525,686 | 82 | 474,020 | 54 | 465,188 | 82 | 474,020 |
| `middleearth-limb` | 39 | 106,406 | 39 | 37,732 | 24 | 8,850 | 39 | 37,732 |
| `rickmorty` | 39 | 91,688 | 40 | 38,858 | 40 | 33,864 | 40 | 38,858 |
| `gaming` | 40 | 59,034 | 43 | 45,466 | 26 | 10,842 | 43 | 45,466 |
| `caribbean` | 43 | 156,166 | 43 | 87,492 | 22 | 8,834 | 43 | 87,492 |
| `belt` | 46 | 465,860 | 46 | 421,298 | 28 | 415,134 | 46 | 421,298 |
| `maw` | 43 | 77,372 | 43 | 74,250 | 27 | 8,854 | 43 | 74,250 |
| `landing-middleearth` | 129 | 181,875 | 116 | 126,980 | 116 | 126,662 | 77 | 50,796 |
| `station` | 69 | 510,880 | 69 | 459,214 | 69 | 456,836 | 69 | 459,214 |
| `middleearth` † | 39 | 106,406 | 39 | 37,732 | 17 | 4,002 | 39 | 37,732 |
| `breakingbad` † | 63 | 92,994 | 64 | 31,930 | 25 | 8,850 | 64 | 31,930 |
| `office` † | 41 | 62,606 | 41 | 23,236 | 41 | 18,242 | 41 | 23,236 |
| `far-rim` † | 42 | 85,160 | 42 | 40,598 | 39 | 36,198 | 42 | 40,598 |

The lane’s mid column matches `main`’s mid at every pose but two:

- **`overview`:** one call and 80 triangles fewer, from lane 2’s commits.
- **`landing-middleearth`:** 77 calls and 50,796 triangles against `main`’s 116 and 126,980. The lane’s shot (`lab/universe/lane1-before/mid/landing-middleearth.webp`) is bare brown ground under a dusk sky, with no smial, no trees and no green; `main`’s has all three. Its frames took 8.7 s against `main`’s 4.1 s, so the landing’s things may not have loaded before the measure (a race), or lane 2’s branch lost them. It isn’t this lane’s to fix, and the lane changes nothing a landing draws before Task 7. In Task 11, a landing that has its things again is read against `main`’s mid column, not this one.

The after goes beside the lane’s mid column in Task 11. A pose over its before there is a stop (the plan’s Task 11, step 2).

### The counts

| | before | the plan’s figure (2026-10-18) |
| --- | --: | --: |
| `wc -l src/components/universe/scene.js` | 6,374 | 6,226 |
| `glsl-sites` (budget 619) | 614 | 607 |
| `big-files` (budget 30) | 22 | 30 |

`scene.js` was 6,409 lines on `main` at `cc5e2eaf`; lane 2’s PR 2.3 took it to 6,374, and the lane’s net is measured from there. `glsl-sites` and `big-files` are `node scripts/health.mjs --only glsl-sites,big-files` at `ebfb2307`. The lane adds at most two `ShaderMaterial` sites in `nebula/` and takes out two, so `glsl-sites` ends at 614 or lower.

### Not taken here

- **Frame times** (`perf-probe.mjs universe`, twice a tier for the noise floor). Headless Chromium draws in software at a frame or two a second, so its frame times say little, and the browser budget leaves the timing to the coordinator’s measure at the end. The before can be taken again at any commit before Task 7, the first that changes what the map draws (Tasks 2 to 6 add pure files, a renderer nothing calls yet and a sky option that defaults to today’s bake).
- **The two route shots** (`autopilot-check.mjs --routes /universe` and `--routes /galaxy`, with `--before`). The overview pose stands for `/universe`. `/galaxy`’s before, which Task 11 compares pixel for pixel, can be shot at any commit before Task 6, the first to touch the galaxy’s sky (`src/components/galaxy/sky.js`); until then the galaxy is as `ebfb2307` has it.
