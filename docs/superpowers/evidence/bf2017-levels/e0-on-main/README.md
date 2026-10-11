# Lane E0 merged with `main`: the Hoth and Endor gates

`BUDGET=1 QUALITY=high PHASE_WAIT=900000 node scripts/galaxy-check.mjs surface hoth,endor` on `claude/bf2017-e0-factory-on-main` (2026-10-10, 23:50 UTC), software GL, the dev server pointed at the public bucket (`VITE_ASSET_BASE`), so every published file (the packs, the native figures' full cuts) comes as a visitor gets it.

| world | calls (row) | triangles (row) | models MB (row) | shot |
| --- | --: | --: | --: | --- |
| hoth | 160 (274) | 982,271 (1,664,163) | 115.5 (60) | `hoth-high.jpg` |
| endor | 165 (257) | 1,403,212 (3,679,784) | 94.3 (60) | `endor-high.jpg` |

Calls and triangles are within their rows on both. The models' megabytes breach the 60 MB row on both; E0's own session measured Hoth at 15.7 MB and passing with the packs on disk and no bucket base, so the difference is what the bucket serves that a base-less dev server does not: the native figures' full cuts (a hero is 7 to 16 MB plain, the streaming design's own numbers) and the packs' published meshes. `main`'s Hoth is measured under the same conditions beside this (below) to say how much is E0's.

## `main` beside it

The same gate on `main` (e128ec47b), the same bucket base, the same software GL, run in a sibling worktree while E0’s dev server idled:

| branch | calls (row) | triangles (row) | models MB (row) |
| --- | --: | --: | --: |
| `main` | 166 (274) | 918,745 (1,664,163) | 111.7 (60) |
| E0 on `main` | 160 (274) | 982,271 (1,664,163) | 115.5 (60) |

So the 60 MB row is breached on `main` too once the dev server is pointed at the bucket: the row was written for a base-less server, where the native figures’ full cuts and the published meshes are not fetched. E0’s share of Hoth’s models is 3.8 MB (the pack’s cells and colliders), with six fewer calls and 63,526 more triangles. The row’s number against a bucket-backed server is its own question, outside this lane: `galaxy-check.mjs` reads the budget rows from `src/lib/budgets.js`, and a row for “served from the bucket” would say what a visitor pays, not what a dev server without a base pays.
