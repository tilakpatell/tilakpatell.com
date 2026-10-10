# Lane Q2: Hoth’s ground in the game’s own layers

The spec: `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§4, “Q2”). The plan: `docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ2-ground.md`.

## What is here

- `before/` and `after/`: Hoth’s own heightmap (the level pack’s near map) on the node renderer over WebGL 2, lit by the game’s sunny record through `applyGameLight`. Before: one flat material in the record’s `TerrainColor`, as a node world draws its ground without Q2. After: `attachLayeredGround` with the pack’s `ground.json`. Drawn by `ground.html` and `ground.js` beside this file, shot by `shot.mjs` (`node docs/superpowers/evidence/bf2017-surfaces/Q2/shot.mjs field2,field50,trench,ridge ultra` with the dev server up).
- `site/`: the live `/galaxy/hoth/surface` from `galaxy-check surface hoth` per tier. It is unchanged by this lane: the galaxy’s surface still runs the classic renderer until lane T flips it, and `levelScene.js`’s call only acts on a node renderer.
- `frames-*.json`: the frame table, one row per shot.

The views (the site’s frame): `field2` 3 m from (8, −56), looking down at the packed snow; `field50` the same field from 50 m; `trench` the chunky snow at (−224, −48) from 40 m; `ridge` the rocky snow at (470, −570) from 50 m. The field and the trench are the masks’ purest pixels near the hangar’s mouth; the ridge is the nearest wholly rocky ground.

## The frame table (WebGL 2, SwiftShader, 1280 × 720)

Milliseconds a frame in software GL, the ground 524k triangles drawn with the sun’s cascades; only the ratio between the two columns means anything. The ultra rows ran beside `galaxy-check` on the same machine. Samples are detail / triplanar / sparkle / mask.

| tier | view | flat ms | layered ms | samples | textures |
| --- | --- | --- | --- | --- | --- |
| ultra | field2 | 1841.3 | 3139 | 4 / 2 / 1 / 1 | 9 → 15 |
| ultra | field50 | 2053.7 | 2724.4 | 4 / 2 / 1 / 1 | 9 → 15 |
| ultra | trench | 2862.1 | 5095.1 | 4 / 2 / 1 / 1 | 9 → 15 |
| ultra | ridge | 2659.1 | 4921.2 | 4 / 2 / 1 / 1 | 9 → 15 |
| high | field2 | 2277.3 | 3634.3 | 4 / 2 / 1 / 1 | 9 → 15 |
| high | ridge | 2749.3 | 4888.1 | 4 / 2 / 1 / 1 | 9 → 15 |
| mid | field2 | 2028.4 | 1944.9 | 2 / 0 / 0 / 1 | 9 → 12 |
| mid | ridge | 1310.2 | 1763.6 | 2 / 0 / 0 / 1 | 9 → 12 |
| low | field2 | 1062.2 | 1026.3 | 0 / 0 / 0 / 0 | 7 → 7 |
| low | ridge | 1194.4 | 1161.6 | 0 / 0 / 0 / 0 | 7 → 7 |

## The live route’s budget (`galaxy-check surface hoth`, `BUDGET=1`)

| tier | calls | triangles | models | p95 (software GL) | |
| --- | --- | --- | --- | --- | --- |
| low | 145 / 350 | 634,872 / 800,000 | 14.6 / 20 MB | 3,614 ms | pass |
| mid | 145 / 274 | 634,872 / 1,236,993 | 15 / 40 MB | 5,517 ms | pass |
| high | 146 / 274 | 811,840 / 1,664,163 | 15.5 / 60 MB | 8,058 ms | pass |
| ultra | 155 / 1,500 | 1,684,363 | 16 / 240 MB | 19,375 ms (reported) | pass |

## What waits

- **The WebGPU leg** runs on the owner’s laptop: `GPU=webgpu node docs/superpowers/evidence/bf2017-surfaces/Q2/shot.mjs` (the cloud’s SwiftShader WebGPU device is lost on its first frame).
- **The real frame cost** on a graphics chip, from the same script on the laptop.
- `scripts/surface-shot.mjs` cannot reach the walking phase on `main` today: `scene.js` sets `window.__surface` to an object of effects hooks (the bolts’ `fx`) after `SurfaceView.jsx` sets it to the debug function the script polls. Not this lane’s file; the live shots here are `galaxy-check`’s.
