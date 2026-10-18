# Endless universe, lane 1: before, on main

These numbers and shots come from commit ddb364bf3 (main, before any nebula change). Later tasks compare against them. Task 11 compares all 14 poses.

## Shots

- `before-universe.webp`: the /universe route.
- `before-galaxy.webp`: the /galaxy route (Tatooine). The gate for a software renderer was passed with its "Try anyway" button, because the shot script's own run stopped at the gate.

## Draw calls and triangles per pose

Measured with `scripts/universe-check.mjs` at 1280 by 720, software WebGL (SwiftShader), one whole frame's count. Raw files: `before-<tier>.json` (sample 1), `before-<tier>-2.json` (sample 2), `before-rerun-*.json` (single-pose re-runs).

The rule for Task 11: the "before" column is the larger non-zero calls and the larger non-zero triangles among the samples of that cell, and the after count must not be higher than it.

The counts move from run to run, and some frames are counted while nothing is drawn (0 / 0). Each cell therefore has two full samples, and a pose that was 0 / 0 in both was re-run alone until it gave a count (three cells needed it, shown in the re-run column). A 0 / 0 or an error is never used as a before.

The ten baseline poses (the keys of `lab/universe/baseline/high.json`):

| pose | tier | sample 1 | sample 2 | re-run | before (calls / tris) |
| --- | --- | --- | --- | --- | --- |
| overview | high | 99 / 571083 | 104 / 571977 |  | **104 / 571977** |
| overview | mid | 97 / 638581 | 96 / 518687 |  | **97 / 638581** |
| overview | low | 99 / 521489 | 103 / 522319 |  | **103 / 522319** |
| falcon-sun | high | 83 / 561609 | 91 / 565279 |  | **91 / 565279** |
| falcon-sun | mid | 96 / 518707 | 68 / 512771 |  | **96 / 518707** |
| falcon-sun | low | 86 / 516493 | 98 / 523277 |  | **98 / 523277** |
| middleearth-limb | high | 37 / 126027 | 37 / 133131 |  | **37 / 133131** |
| middleearth-limb | mid | 0 / 0 | 0 / 0 | 43 / 68469 | **43 / 68469** |
| middleearth-limb | low | 37 / 51511 | 37 / 64749 |  | **37 / 64749** |
| rickmorty | high | 38 / 127153 | 37 / 118413 |  | **38 / 127153** |
| rickmorty | mid | 24 / 65883 | 24 / 65883 |  | **24 / 65883** |
| rickmorty | low | 38 / 65865 | 24 / 65851 |  | **38 / 65865** |
| gaming | high | 41 / 107073 | 38 / 85759 |  | **41 / 107073** |
| gaming | mid | 27 / 75107 | 27 / 75107 |  | **27 / 75107** |
| gaming | low | 41 / 75089 | 41 / 75089 |  | **41 / 75089** |
| caribbean | high | 41 / 175787 | 41 / 182891 |  | **41 / 182891** |
| caribbean | mid | 27 / 114517 | 27 / 114517 |  | **27 / 114517** |
| caribbean | low | 41 / 114499 | 41 / 114499 |  | **41 / 114499** |
| belt | high | 30 / 492595 | 44 / 492587 |  | **44 / 492595** |
| belt | mid | 0 / 0 | 33 / 455325 |  | **33 / 455325** |
| belt | low | 44 / 450925 | 44 / 450923 |  | **44 / 450925** |
| maw | high | 0 / 0 | 27 / 104131 |  | **27 / 104131** |
| maw | mid | 45 / 120408 | 37 / 114373 |  | **45 / 120408** |
| maw | low | 41 / 103877 | 27 / 103867 |  | **41 / 103877** |
| landing-middleearth | high | 0 / 0 | 0 / 0 | 60 / 158146 | **60 / 158146** |
| landing-middleearth | mid | 0 / 0 | 0 / 0 | 85 / 166221 | **85 / 166221** |
| landing-middleearth | low | 99 / 178231 | 98 / 163525 |  | **99 / 178231** |
| station | high | 82 / 546715 | 74 / 541103 |  | **82 / 546715** |
| station | mid | 52 / 488603 | 66 / 488629 |  | **66 / 488629** |
| station | low | 66 / 488583 | 66 / 488589 |  | **66 / 488589** |

The other poses among the 14 that universe-check shoots:

| pose | tier | sample 1 | sample 2 | re-run | before (calls / tris) |
| --- | --- | --- | --- | --- | --- |
| middleearth | high | 37 / 126027 | 37 / 133131 |  | **37 / 133131** |
| middleearth | mid | 23 / 64757 | 23 / 64757 |  | **23 / 64757** |
| middleearth | low | 37 / 64739 | 23 / 64725 |  | **37 / 64739** |
| breakingbad | high | 62 / 120225 | 61 / 119719 |  | **62 / 120225** |
| breakingbad | mid | 48 / 58955 | 0 / 0 |  | **48 / 58955** |
| breakingbad | low | 62 / 58937 | 48 / 58923 |  | **62 / 58937** |
| office | high | 39 / 66451 | 39 / 66451 |  | **39 / 66451** |
| office | mid | 25 / 53389 | 25 / 53389 |  | **25 / 53389** |
| office | low | 39 / 53371 | 25 / 53357 |  | **39 / 53371** |
| far-rim | high | 0 / 0 | 26 / 111913 |  | **26 / 111913** |
| far-rim | mid | 26 / 70275 | 26 / 70247 |  | **26 / 70275** |
| far-rim | low | 40 / 70227 | 26 / 70271 |  | **40 / 70271** |

Notes:

- The mid overview failed in sample 1 (the page took over 180 s to open); it was re-run alone (`before-mid-overview-rerun.json`) and that is the sample 1 shown. In sample 2 the mid breakingbad pose gave 0 / 0, so its before is from sample 1.
- An earlier partial high run (cut off at 8 poses, not kept) gave overview 107 calls against 99 and 85 against 83 for falcon-sun, and falcon-sun 801601 triangles against 561609: the spread within a cell can be several tens of thousands of triangles.
- The landing-middleearth cells at high and mid rest on one re-run each (60 and 85 calls), while low shows 99 and 98: those two befores may be low, so Task 11 should treat an after above them with a second look before calling it a regression.
- The first re-run of mid middleearth-limb failed to start (a script error, not kept); the second gave a count.

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

Task 11 should gate on the p50 of the idle and fly phases. The load phase's p95 (about 31 ms) is a one-off hitch that shows in some runs and not others, so it is not a gate. The mid second run saw 19 late pipelines where the other three saw 0.

## Size of the code

- `wc -l src/components/universe/scene.js`: 6226 lines (health counts it as 6227).
- `node scripts/health.mjs --only glsl-sites,big-files`: glsl-sites 607 (budget 619), big-files 30 (budget 30).
