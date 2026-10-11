# GPU-first lane N3: three distances of light, on the lit fixture

The plan: `docs/superpowers/plans/2026-10-11-gpu-first-laneN3-light.md`. Every shot here is `node scripts/light-fixture.mjs … --legs webgl`: the node renderer on a WebGL 2 context, drawn headless on SwiftShader (the CPU) in the cloud container, 1600 × 900. The WebGPU leg is the laptop’s (the cloud’s software WebGPU device dies on the fixture: lane S’s assumption B5). Frame times are the CPU’s: they compare one row with another, never with a real chip.

## The baked bounce (`--hoth --baked [on|off]`)

What the atlas is: **a stand-in, not the game’s bake.** Hoth’s atlas (`EN_Hoth_01_Static_Sunset_*`, 3,128 × 3,680) is on the owner’s desktop and not in the bucket, and the game’s per-instance charts were never exported (the spec’s §11). So the fixture’s 256² set is the dry run of lane W’s `lightmaps` job (`node scripts/desktop/bf2017-lightmaps.mjs --dry --size 256 --out src/runtime/fixtures/enlighten`): the record’s probe radiances (shape and tint) and sun gathered over the fixture’s ground and ring on the CPU, in Enlighten’s five-map shape. `src/runtime/fixtures/enlighten/fixture.json` says the rest, with `_source`.

| shot | mean linear luminance | against lane G’s 0.3531 (lane S’s band, ±10 %) | the environment’s share (0…255) | `_source` |
| --- | --- | --- | --- | --- |
| `nobaked-hoth-lit-ultra-webgl.png` (the node ground with a second uv set, no atlas) | 0.3229 | −8.6 %: within | 16.65 | `nobaked-hoth-lit-ultra.json` |
| `baked-hoth-lit-ultra-webgl.png` (the stand-in atlas as the ground’s diffuse indirect light) | 0.2683 | −24.0 %: **outside** | 4.22 | `baked-hoth-lit-ultra.json` |

**The finding.** The atlas replaces two terms the site adds today: the sky’s hemisphere light (calibrate.js’s sky term) and the diffuse share of the sky’s baked environment. The stand-in’s level was set to the first alone (`fixture.json`’s `skyLevel`), so the frame lost the second: the environment’s share fell from 16.65 to 4.22 levels and the mean from 0.3229 to 0.2683 (−17 %, past the design’s 3 % to explain). It is the stand-in’s level that is short, not the sampler: a real bake (the game’s, or lane W’s path-traced one) carries the record’s own level, and is what the band is judged on. Not refitted to pass: a world outside the band is a finding, not a constant (lane P’s plan).

The tint: the snow takes the record probe’s bluer sky (zenith 1,453 : 2,733 : 6,231) where the hemisphere light was lane G’s fitted grey-blue.

## The budgeted grid (`--grid`)

After lane R’s A3 numbers, a page of its own: the budgeted grid (two cascades, 8 m and 32 m, a front and a back grid each) at the fixture’s stress setting (4 × 2 × 4 probes a grid and a wide budget, `lightN3.js`’s `STRESS`), so its pairs sweep and swap inside the run on SwiftShader, where a probe costs about 6 ms of CPU. 60 frames at a fixed camera; from frame 20, each pixel’s standard deviation on the shot shrunk to 400 × 225.

| | value | `_source` |
| --- | --- | --- |
| mean spread (0…255) | 0.009: under 1 (Review Focus 3) | `lit-ultra-grid.json` |
| worst pixel | 30.47 | the same |
| sweeps finished in the run | 2 | the same |
| probes a frame at the end | 9 (against the CPU’s issue time, no GPU clock in the cloud) | the same |
| the shot | `lit-ultra-webgl-grid.png` | |

The first run, at the real 8 × 3 × 8 grid, held one probe a frame (5.7 ms a probe on SwiftShader against the 0.5 ms budget) and never finished a sweep: its 0.008 spread tested nothing, which is why the stress setting exists.

## The cadence (`--shadows --cadence`)

Lane S’s shadow strip under Hoth’s record, cast along the light (`lightSun`: a 2.8 m shadow off a 1.8 m figure, where the record’s 82° shadow sun hides it under the capsule), the figures running from 2, 20 and 60 m away at 30 m/s for 90 frames (`lightN3.js`’s `WALK`, the stress case), watched from low beside them. The walk runs twice from the same start: every cascade drawn every frame (the reference), then on the cadence. A miss is a figure-frame where the reference shows the figure’s shadow (its pixel under 0.9 of the open snow 2.5 m beside it) and the cached run does not.

| | value | `_source` |
| --- | --- | --- |
| figure-frames whose shadow the reference shows | 18 | `cadence-shadows-lit-ultra.json` |
| of those, without it on the cadence | **0** (Review Focus 4) | the same |
| draws a cascade over 90 frames, cached | 90, 90, 23, 22 | the same |
| draws a cascade over 90 frames, every frame | 90, 90, 90, 90 | the same |
| the run’s first and last frames | `cadence-shadows-lit-ultra-webgl-run0.png`, `-run89.png` | |

The two far cascades drew 45 times in place of 180 (−75 %), the one redraw beyond every fourth frame being the view’s first frame. Only 18 figure-frames qualify because SwiftShader shows a cast shadow in the nearest cascades alone (lane S’s shots on `main` show the same: no shadow off the 20 m figure or the posts past it), so the far cascades’ shadows are judged on the laptop. The other shots (`-seam`, `-pen1`, `-pen10`, `-contact`, `-contact-off`) are lane S’s views on this branch; the frame’s 0.2859 is the strip’s, not the calibration view’s.

## The laptop’s table (the owner runs these)

RTX 5090, Edge, `ANGLE=d3d11`, at 1,600 × 900 and 3,840 × 2,160, the WebGPU and `nodes-webgl` legs. The cloud cannot run any of them (no GPU; no WebGPU device).

```
# 1. the fixture, both legs, the before and after of each distance
node scripts/light-fixture.mjs --hoth --baked off --tier ultra --post on
node scripts/light-fixture.mjs --hoth --baked on --tier ultra --post on
node scripts/light-fixture.mjs --grid --tier ultra
node scripts/light-fixture.mjs --shadows --cadence --tier ultra --post on
node scripts/light-fixture.mjs --shadows --tier ultra --post on        # the cadence's before: every cascade every frame

# 2. the GPU time added by the atlas and the grid (the gate: under 1.5 ms at ultra together):
#    the mean ms of the --baked on row less the --baked off row, and of the --grid page's
#    frames against lane R's A3 frames, from the JSON beside each shot

# 3. the cadence's saving (the gate: at least the two far cascades' draw time):
#    the cadence run's draws (near 90, 90; far about 23, 23 over 90 frames) against the
#    every-frame run's, and the two rows' mean ms

# 4. Hoth's hangar and Endor's village at ultra, once lane T2 has wired stack.js and lane G1's
#    references and frame-score.mjs are on main:
node scripts/frame-score.mjs --world hoth --view hangar --tier ultra      # before and after, against G1's reference
node scripts/frame-score.mjs --world endor --view village --tier ultra
BUDGET=1 QUALITY=ultra node scripts/galaxy-budget.mjs hoth endor          # p95 under 16.7 ms
```

`scripts/frame-score.mjs` is lane G1’s and not on `main` yet; step 4 waits for it and for lane T2’s `stack.js` (the wiring is one call each: the plan’s Task 4, Step 2).
