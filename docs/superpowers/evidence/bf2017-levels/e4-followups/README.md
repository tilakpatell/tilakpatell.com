# Lane E4’s follow-ups: the gates on D2’s factory, the districts, the second Death Star inside

`BUDGET=1 SCANS=game PHASE_WAIT=1500000 SHOT_WAIT=900000 QUALITY=<tier> node scripts/galaxy-check.mjs surface <world>`, 11 October 2026, on `claude/bf2017-e4-followups` (`main` with lane D2’s #926 merged in), software GL drawing the node renderer as `nodes-webgl`, the dev server on the public bucket (`VITE_ASSET_BASE`), so the models are counted as a visitor fetches them. The rows are `src/lib/budgets.js`’s as D2 left them: high 700 calls, 3M triangles, 160 MB; ultra 1,500 calls, no triangle ceiling, 285 MB.

**The calls are the frame’s draws** (`info.render.drawCalls`). Before this branch the gate read `info.render.calls`, which on the node renderer is its render passes since the page began, never reset: about 14 a frame (the scene, twelve bloom passes, the pipeline), so it grew with how long the page had run. Every calls figure gated on `nodes-webgl` before it is that running count, not the scene’s; the triangles and the megabytes were always the frame’s.

## High

| world | calls | triangles | models MB | the row | the baseline +10% |
|---|--:|--:|--:|---|---|
| Scarif | 291 | 1,458,820 | 120.2 | pass | over (118 calls: made before the level) |
| Cloud City | 412 | 1,633,695 | 130.0 | pass | over (180 calls, 1.05M triangles: made before the level) |
| Cloud City, the palace (`bespin@m2bes`) | 517 | 2,684,091 | 82.2 | pass | none |
| Hoth, the outpost (`hoth@outpost`) | 332 | 2,793,423 | 155.5 | pass | none |
| Endor, the second Death Star (`endor@deathstar`) | 90 | 372,538 | 65.7 | pass | none |

## Ultra

| world | calls | triangles | models MB | the row |
|---|--:|--:|--:|---|
| Scarif | 327 | 3,723,044 | 459.7 | models over |
| Cloud City | 504 | 2,828,634 | 367.1 | models over |
| Cloud City, the palace | 942 | 5,728,588 | 332.5 | models over |
| Hoth, the outpost | 228 | 2,554,352 | 506.2 | models over |
| Endor, the second Death Star | 106 | 556,134 | 125.5 | pass |

Ultra fetches each pack’s LOD0 and its 2,048 maps (held to 256 MB by `lod.js`’s `fitMaps`) beside the crew’s full cuts; the four over the row are over by the level’s ultra maps and the crew’s together. No baseline exists for ultra (`lab/baseline/surface-ultra.json`, the owner’s desktop). Frame times in software GL say nothing.

## The second Death Star, inside

`deathstar-deck-{w,e,n}.jpg`: high, on the game’s first team-one spawn point (hvv, 586.4 m in the game). The walls, decks and ceilings that are the game’s DSI master shader (173 of the pack’s materials) draw from its numbers and masks (`src/lib/three/surface/dsi.js`). The hall reads dark and sparse: the game lights it with its Enlighten atlases (lane W’s `atlases` job), and the reactor pillars’ lit strips wait for their emissive mask (`T_DSI_WallTiling_Panel_01_E_M`, not in the bucket: lane W’s `textures` job); without the mask the pillars glowed whole and green, so they draw as plated wall until it lands.

`palace-high.jpg` and `outpost-high.jpg`: the two districts as the gate saw them.
