# Lane E0 merged with `main`: the Hoth and Endor gates

`BUDGET=1 QUALITY=high PHASE_WAIT=900000 node scripts/galaxy-check.mjs surface hoth,endor` on `claude/bf2017-e0-factory-on-main` (2026-10-10, 23:50 UTC), software GL, the dev server pointed at the public bucket (`VITE_ASSET_BASE`), so every published file (the packs, the native figures' full cuts) comes as a visitor gets it.

| world | calls (row) | triangles (row) | models MB (row) | shot |
| --- | --: | --: | --: | --- |
| hoth | 160 (274) | 982,271 (1,664,163) | 115.5 (60) | `hoth-high.jpg` |
| endor | 165 (257) | 1,403,212 (3,679,784) | 94.3 (60) | `endor-high.jpg` |

Calls and triangles are within their rows on both. The models' megabytes breach the 60 MB row on both; E0's own session measured Hoth at 15.7 MB and passing with the packs on disk and no bucket base, so the difference is what the bucket serves that a base-less dev server does not: the native figures' full cuts (a hero is 7 to 16 MB plain, the streaming design's own numbers) and the packs' published meshes. `main`'s Hoth is measured under the same conditions beside this (below) to say how much is E0's.
