# Lane N4: the stream that feels like one. Evidence

Branch `claude/gpu-n4-stream`, PR #918. The plan: `docs/superpowers/plans/2026-10-11-gpu-first-laneN4-stream.md` (on #915’s branch until it merges). Measured in the cloud container on 2026-10-11: headless Chromium 1194 in software GL (SwiftShader, `nodes-webgl`), four cores, Hoth’s pack served from the dev server’s own disk. The bucket reset some HTTP/2 streams from this container; `assetBase` then took the visit as bucket-down and every later pack file came back as the site’s page, for main and the branch alike. So the pack’s 1,470 published files (78.7 MB) were fetched once into `public/` (git-ignored, as published files are) and both were run without `VITE_ASSET_BASE`.

## The coarse grid, written (`node scripts/bf2017-horizon.mjs hoth`)

| what | number | _source |
| --- | --- | --- |
| cells (512 m) | 65: 16 over the 2 km arena, 49 on the horizon | `horizon/index.json` |
| proxies, plain cut (high, ultra) | 3.06 MB, the largest cell 217 KB (cap 400 KB), 12,000 triangles a cell at most | the script’s log |
| proxies, `.lo` cut (low, mid) | 1.91 MB, 4,000 triangles a cell at most (a cell already under it is its own `.lo`) | the script’s log |
| bytes a merged triangle | 11.2 (3,110,912 bytes over 278,130 triangles; the UVs stay floats, many run outside 0 to 1) | the script’s log, `BYTES_PER_TRI` |
| impostors | 2 meshes: the snow piles (542 at 391 triangles) and the straight trenches; 16 × 16 views | `impostorsOf` |
| atlases | 3.58 MB at 2,048 (albedo and normal, both meshes), 1.71 at 1,024, 0.64 at 512 | the script’s log |
| bake | 15 to 16 s a mesh in software GL at 2,048 | the script’s log |
| cut again from lane D2’s pack (#926, merged before the PR; the far list 186,048 bytes) | 65 cells, 3.05 MB plain, 1.92 MB `.lo`, the same two impostors and atlases; the runs below were on the pack before it | the script’s log |
| simplification | careful `simplify` with `LockBorder` left the base’s cell at 104,000 triangles; unlocked, then `simplifySloppy`, 12,662 | the script’s log |

## Hoth on high, main against the branch (no throttle, ten minutes settled)

`SHOT_WAIT=900000 WAIT=600000 JSON=1 QUALITY=high node scripts/galaxy-check.mjs surface hoth`, main from a worktree of `origin/main` at `ba0633a29` on its own dev server.

| | main | branch |
| --- | --- | --- |
| draw calls | 481 | 436 |
| triangles | 4,276,692 | 4,276,437 |
| textures | 180 | 184 |
| models fetched | 15.2 MB | 18.3 MB (the grid’s 3.1 MB) |
| the level: calls, triangles, instances | 181, 1,629,393, 6,037 | 181, 1,629,393, 6,037 |
| the coarse grid | – | 65 cells in, 0 shown, 0 waiting |
| the stream | – | `detail`, boot done, 47.3 MB, not paused |

`hoth-high-main.jpg` and `hoth-high-branch.jpg`: the same view (the falling snow differs).

## First-visit bytes and time to walkable (`--bytes`, 20 Mbit/s, 20 ms)

`SHOT_WAIT=900000 BUDGET=1 QUALITY=<q> node scripts/galaxy-check.mjs surface hoth --bytes`; `bytes-<q>.json`.

| tier | boot (of bootMB) | visit after settle (of visitMB) | first frame | walkable, wall | walkable, line | the level’s own span on the line | coarse cells shown at the measure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 5.76 of 6 MB | 40.8 of 120 MB | 42.6 s | 145.8 s | 41.0 s | 8.8 s | 2 of 20 (2 meshes still coming), 898 impostor cards |
| high | 11.53 of 12 MB | 47.3 of 400 MB | 43.1 s | 174.0 s | 169.0 s | 137 s | 0 of 65 |
| ultra | 11.54 of 12 MB | 49.3 of 1,200 MB | 41.1 s | 165.8 s | 162.6 s | 131.2 s | 0 of 65 (the budget line: 196 of 1,500 calls, 18.9 of 240 MB of models, pass) |

On a bundled build (`NODE_ENV=development vite build --mode development`, served by `vite preview`, as `scripts/stream-check.mjs` does, so the page’s hook is there and its code comes bundled; lane D2’s pack, the grid cut again; `bytes-high-bundle.json`):

| tier | boot (of bootMB) | visit (of visitMB) | first frame | walkable, wall | walkable, line | the level’s own span | over the wire by the boot | coarse cells shown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| high | 11.64 of 12 MB | 47.3 of 400 MB | 10.0 s | 123.1 s | 120.3 s | 116.7 s | 43.4 MB (123 on the dev server) | 0 of 65 |

The bundle takes the first frame from 43 s to 10 s and the page’s own bytes from 123 MB to 43 by the boot; the level’s span stays about two minutes, its requests paced by SwiftShader’s 13 s frames. Its level draws 180 calls, 1,628,371 triangles and 6,036 instances (D2’s pack). The budget line reads `models 60.9/60 MB`: served from disk, the run is held to the row written for a dev server that never fetches a published pack; served by the bucket as a visitor gets it, Hoth on high is held to 160 MB (`galaxy-budget.mjs`’s `BUCKET_MB`, main measured at 142.4 MB), and the grid’s cells are 3.05 MB of it.

What these say, and what they do not:

- **The bytes hold.** Every tier’s boot ended under its `bootMB` (the stream ends it at 95 % so what is in flight lands under) and every visit stayed far under its `visitMB`; nothing paused.
- **The times are the software renderer’s, not the line’s.** A frame of Hoth takes 14 to 38 s in SwiftShader, on main as on the branch. The page asks for the next files only as its frames let it (the far table is sorted, a mesh parsed, its maps asked), so even the line’s clock carries the renderer: mid’s boot slice crossed the line in 8.8 s from its first file, high’s took 137. The development server also sends its code unbundled (117 to 123 MB over the line by the boot). The design’s gate (walkable under 10 s on high at 20 Mbit/s) is the laptop’s, on a production build: 11.5 MB of boot at 20 Mbit/s is 4.6 s of line.
- **At mid the branch draws what main draws, and the grid’s two cells still standing in.** Main: 187 calls, 1,990,383 triangles; the branch: 187 calls, 1,999,616 (the level the same, 162 calls and 1,357,108 triangles; the 9,233 more are the two coarse cells whose fine meshes were still coming, and their cards).
- **The budget rows’ triangle ceiling fails on main too.** `lab/baseline/surface-high.json` holds Hoth at 1.51M triangles; main draws 4.28M today. The branch draws what main draws once the grid hides.

## The grid planned for every surface pack (`node scripts/bf2017-horizon.mjs <pack> --dry --no-impostors`)

Nothing written; the impostor meshes merged with the rest, so the proxies are an upper bound. Every pack’s grid is between 0.95 and 3.10 MB, every cell under the cap.

| pack | cells | proxies MB | `.lo` MB |
| --- | --: | --: | --: |
| endor | 7 | 1.24 | 1.09 |
| hoth | 65 | 3.10 | 1.92 |
| hoth/outpost | 67 | 3.09 | 1.98 |
| naboo | 47 | 2.50 | 1.88 |
| naboo/hangar | 6 | 0.99 | 0.73 |
| naboo/market | 21 | 1.48 | 1.06 |
| scarif | 61 | 1.31 | 1.07 |
| tatooine | 9 | 1.33 | 0.90 |
| tatooine/jabba | 14 | 0.95 | 0.73 |
| yavin | 15 | 1.81 | 1.37 |

The interiors (hoth/base, kamino/venator, tatooine/jabba-inside, bespin/m2bes) see no horizon and the space packs have no ground: they keep the far list. Lane W’s `horizon` job (`scripts/desktop/bf2017-horizon.mjs`, `gh workflow run bf2017-desktop.yml -f job=horizon`) bakes these ten with their impostors on the chip and publishes them; its dry run plans the same ten, 106 arena cells and 31 impostor meshes.

## The packs’ maps, as published (`ktx2-census.json`)

Every KTX2 under `levels/*/tex/` in `src/data/galaxyAssets.json` (2,830 files, six packs), its data format descriptor’s colour model read from the bucket’s first 128 bytes: **every data map is UASTC** (1,756 of 1,756: normals, ORMs, masks, detail maps); colour maps are UASTC (739) or ETC1S (335). So the loader’s rows on mid and up are already UASTC for data maps, and lane W’s “UASTC data rows” job has nothing to do; `tierTexture`’s `.uastc` pick waits for any data map that ships both rows. three r186’s KTX2Loader transcodes UASTC to ASTC 4×4, BC7, BC3 or ETC2-EAC (no BC5 or EAC RG11 without a patched worker; `docs/stack/three.md`).

## Found and fixed on the way

- The queue had no timeout: one request that never settled held a slot for the visit. It now fails after the site pool’s timeout (20 s, a second a MB), and a timer the page held (fired more than a second late) waits again.
- The coarse phase waited on each cell’s scene; a cell whose maps never came held the boot open. It ends when the fetches land.
- A map that is no KTX2 (a page in its place) was handed to the transcoder; it now fails on the identifier.
- A coarse cell waited on a mesh that failed for ever; it waits on settled, not loaded.
- The grid’s hide check ran every fifteenth frame: six minutes in software GL. It runs every half second of the clock.

## Not measured here

- The 17 worlds at high on `nodes-webgl`: only Hoth has a coarse grid; the other packs fall back to the far list (tested: `levelStream.test.js`, “falls back to the far list”).
- `gpu-parity.mjs` at the coarse-to-fine swap: its worktree of main has no pack (published, not committed) and the bucket was not reliable from here. Tried instead on the bundled build at high, 20 Mbit/s: a shot every frame while a coarse cell stood, and the first after it hid, diffed by `scripts/gpu-parity/diff.mjs`. The pair (`swap-before.jpg`, one cell shown at 318 s; `swap-after.jpg`, all 65 in and hidden at 379 s) reads 16.7 dB and 18.8 % of pixels off, but it measures a minute of SwiftShader, not the swap: the cells and the fine meshes landed in the same 13 s frames, and the camera was still settling (the framing moved). Neither shot shows a hole or a doubled surface. The swap’s own frame pair is the laptop’s, where a frame is milliseconds.
- The impostors drawn: on `nodes-webgl` the cards are made (898 at mid) but SwiftShader’s frame is too slow to judge their blend; the laptop’s, after lane W’s full-quality bake.
