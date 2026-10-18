# Endless universe, lane 1: before, on main

These numbers and shots come from commit ddb364bf3 (main, before any nebula change). Later tasks compare against them. Task 11 compares all 14 poses.

## Shots

- `before-universe.webp`: the /universe route.
- `before-galaxy.webp`: the /galaxy route (Tatooine). The gate for a software renderer was passed with its "Try anyway" button, because the shot script's own run stopped at the gate.

## Draw calls and triangles per pose

Measured with `scripts/universe-check.mjs` at 1280 by 720, software WebGL (SwiftShader), one whole frame's count. Raw files: `before-high.json`, `before-mid.json`, `before-low.json`.

The ten baseline poses (the keys of `lab/universe/baseline/high.json`):

| pose | high (calls / tris) | mid | low |
| --- | --- | --- | --- |
| overview | 99 / 571083 | 97 / 638581 | 99 / 521489 |
| falcon-sun | 83 / 561609 | 96 / 518707 | 86 / 516493 |
| middleearth-limb | 37 / 126027 | 0 / 0 | 37 / 51511 |
| rickmorty | 38 / 127153 | 24 / 65883 | 38 / 65865 |
| gaming | 41 / 107073 | 27 / 75107 | 41 / 75089 |
| caribbean | 41 / 175787 | 27 / 114517 | 41 / 114499 |
| belt | 30 / 492595 | 0 / 0 | 44 / 450925 |
| maw | 0 / 0 | 45 / 120408 | 41 / 103877 |
| landing-middleearth | 0 / 0 | 0 / 0 | 99 / 178231 |
| station | 82 / 546715 | 52 / 488603 | 66 / 488583 |

The other poses among the 14 that universe-check shoots:

| pose | high (calls / tris) | mid | low |
| --- | --- | --- | --- |
| middleearth | 37 / 126027 | 23 / 64757 | 37 / 64739 |
| breakingbad | 62 / 120225 | 48 / 58955 | 62 / 58937 |
| office | 39 / 66451 | 25 / 53389 | 39 / 53371 |
| far-rim | 0 / 0 | 26 / 70275 | 40 / 70227 |

Notes:

- The mid overview failed in the main run (the page took over 180 s to open, a timeout). It was re-run alone: `before-mid-overview-rerun.json`. The table uses the re-run for that cell.
- The counts are not perfectly steady. A pose can be counted on a frame that drew nothing (the 0 / 0 cells: high maw, landing-middleearth and far-rim, and mid middleearth-limb, belt and landing-middleearth). Those cells are missed frames, not real counts. An earlier partial high run (cut off at 8 poses) gave overview 107 calls (high) against 99 here, and falcon-sun 801601 triangles against 561609. Treat a difference of a few calls, or of a few tens of thousands of triangles, as noise.

## Frame times (perf-probe)

`QUALITY=<tier> node scripts/perf-probe.mjs universe`, twice per tier (the second run is the noise floor). Numbers are milliseconds. This machine draws on its own graphics chip (D3D11), not SwiftShader, so these are not comparable with the universe-check frame times. Raw files: `before-perf-{mid,low}{,-2}.json` and the printed tables in the `.md` files beside them.

### mid

| phase | run 1 p50 | run 1 p95 | run 2 p50 | run 2 p95 | p50 spread | p95 spread |
| --- | --- | --- | --- | --- | --- | --- |
| load | 0.3 | 1 | 0.4 | 31.5 | 0.1 | 30.5 |
| settle | 1.4 | 2.7 | 1.4 | 4.8 | 0.0 | 2.1 |
| idle | 1 | 1.5 | 1.2 | 3.6 | 0.2 | 2.1 |
| fly | 1.2 | 2.1 | 1.7 | 6.6 | 0.5 | 4.5 |

### low

| phase | run 1 p50 | run 1 p95 | run 2 p50 | run 2 p95 | p50 spread | p95 spread |
| --- | --- | --- | --- | --- | --- | --- |
| load | 0.4 | 31.6 | 0.4 | 31.5 | 0.0 | 0.1 |
| settle | 1.3 | 4.2 | 1.5 | 5.3 | 0.2 | 1.1 |
| idle | 1.1 | 3.6 | 1.3 | 5.2 | 0.2 | 1.6 |
| fly | 1.5 | 5.8 | 1.7 | 5.9 | 0.2 | 0.1 |

The load phase's p95 is the same shape in every run (about 31 ms), and its blocked time varies by seconds. The mid second run saw 19 late pipelines where the other three saw 0.

## Size of the code

- `wc -l src/components/universe/scene.js`: 6226 lines (health counts it as 6227).
- `node scripts/health.mjs --only glsl-sites,big-files`: glsl-sites 607 (budget 619), big-files 30 (budget 30).
