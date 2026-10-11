# Lane S1’s evidence: the fleet on the game’s hulls

The plan is `docs/superpowers/plans/2026-10-11-bf2017-space-laneS1-fleet.md`; the hand-off section, `docs/superpowers/HANDOFF-bf2017.md` (“Lane S1”). Everything here was measured on 2026-10-11 in a cloud container (four cores, headless Chromium in software GL, the page’s clock held as `galaxy-check.mjs` holds it, the dev server with the public bucket as its asset base), at the lane’s head before `origin/main` (`d78da3d2`) was merged in; the merge brought nothing the space layer draws.

## The sheet

`../fleet-2017.webp` (re-shot after the MC80’s, the Scimitar’s and the Falcon’s fixes): each kind the galaxy drew before (left) beside the game’s (right), the same camera (`scripts/glb-shot.mjs`’s `three` view), with the triangles. Rows: the Star Destroyer (Daniel Andersson’s close-up cut, 83,657 triangles → the kit at the fleet’s cut, 24,300; then the kit’s ultra cut, 36,781), the MC80 (17,102 → 19,892: its hull in its own panel colour, bound by hand from the drop since its shader graph names it nowhere in the GLB), the Venator (14,079 → 24,038), the CR90 (12,219 → 11,937), the Providence (15,999 → 22,690), the close-up Nebulon-B (100,383 → 16,515), the X-wing (gen3d’s 19,879 → 33,998), the TIE interceptor (9,278 → 58,368), the Falcon (23,887 → 38,633, gear up), Slave I (12,014 → 40,536), the Scimitar (15,785 → 34,238, its cloaked materials on the hull’s own maps), the TIE striker (16,000 → 45,482), and the two ships you fly (Sketchfab’s xwing-hd 133,795 → 33,998; falcon-hd 60,840 → 38,633, gear up).

## The gate

`BUDGET=1 BUDGET_REPORT=1 QUALITY=<tier> JSON=1 node scripts/galaxy-check.mjs space endor,kamino,naboo,hoth,tatooine,yavin`, the ship off each planet on its sun side (the check’s own pose; the war’s capitals and the level sit past the frustum or as far copies from there). No space baseline exists under `lab/baseline/`, so each tier is held to its row alone (`src/lib/budgets.js`; the models column to `galaxy-budget.mjs`’s bucket row, since the bucket served files). The whole output is in `gate-<tier>.txt`; the shots at high and ultra beside this file.

| tier | endor calls · tris · MB | kamino | naboo | hoth | tatooine | yavin | row (calls · tris · MB) | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| low | 49 · 72,451 · 33.6 | 40 · 52,448 · 29.9 | 53 · 83,843 · 30.7 | 43 · 81,784 · 14.5 | 77 · 89,528 · 7.8 | 42 · 83,265 · 13.7 | 350 · 0.8M · 45 | pass |
| mid | 50 · 72,475 · 18.4 | 40 · 52,470 · 18.9 | 54 · 83,879 · 12.4 | 43 · 81,986 · 15 | 79 · 89,588 · 8.1 | 43 · 83,299 · 13.9 | 500 · 1.5M · 70 | pass |
| high | 50 · 99,980 · 33.8 | 41 · 80,162 · 30.1 | 54 · 111,321 · 32.6 | 49 · 142,278 · 14.5 | 78 · 117,010 · 9.7 | 44 · 150,742 · 13.5 | 700 · 3M · 160 | pass |
| ultra | 50 · 173,548 · 112.1 | 42 · 153,754 · 92.1 | 54 · 221,497 · 92 | 49 · 252,550 · 69.7 | 80 · 199,910 · 58.9 | 44 · 297,780 · 67.2 | 1,500 · none · 285 | pass (exit 1, below) |

Against the space lane’s table of 2026-10-10 (`../README.md`: Endor at high 57 calls and 199,337 triangles, at ultra 57 and 272,809), every tier draws the same or fewer calls and fewer triangles from the check’s pose: the kits at the fleet’s cut are lighter than the close-up Sketchfab hulls were. The megabytes at low and mid carry the Star Destroyer’s kit (2,049 KB with its 50 maps, the heaviest file an arrival loads) and at ultra its 21.6 MB ultra cut with the corvette’s 1.9 MB; all within the bucket rows.

**Ultra’s exit 1 was not a breach, and its cause is fixed.** Every row passed; the run exited 1 because Endor logged two page errors, both `SyntaxError: Unexpected token '<', "<!doctype "… is not valid JSON`. A request log of every answer in HTML (`lab/s1-tools/missing.mjs`) found the cause: the space level’s hulls and the 4,096 sky asked of the site, not the bucket, and the dev server answering its page for each. The asset base had marked the bucket down: its first answer was given 12 s for the whole download, and the first file asked at ultra was the Star Destroyer’s 21.6 MB ultra cut. And the page then broke because the site’s model loader parsed in a promise’s callback, out of its `try`, so the HTML threw as an unhandled rejection. `origin/main` logged the same two on the same page. Both are fixed (`assetBase.js`’s `waitFor`, `gltf.js`’s caught parse, each with a test that fails without it); the reruns are below. The install’s `/packs/index.json` miss on the dev server, suspected first, was never one: `install.js` catches it.

## The Starfighter Assault

`node scripts/starfighter-check.mjs endor high` and `kamino high` (`starfighter-<system>.txt`, the shots beside): the level’s battle laid, its ships the game’s rows, the pack’s flagship drawn where the battle’s is (the hidden-pack box test), the counts within the high row.

| system | calls | triangles | the MC80 in frame | the pack’s flagship drawn once | console |
| --- | --- | --- | --- | --- | --- |
| Endor | 119 / 700 (the pack’s draws unsettled after 600 s in software GL, 0 groups: the bucket marked down, above) | 0.11M / 3M | yes (640, 467) | yes | the two page errors (above) |
| Endor, again (`starfighter-endor-again.txt`) | 193 / 700 (the pack settled in 32 s, 247 groups) | 0.74M / 3M | yes (645, 294) | yes | none, exit 0 |
| Kamino | 141 / 700 | 1.27M / 3M | yes (640, 468); inside its area, the storm’s fog on | yes | none, exit 0 |

## The cockpit

`SEAT=cockpit SHIP=xwing QUALITY=high node scripts/galaxy-check.mjs space tatooine` and `SHIP=falcon` (`cockpit-xwing.webp`, `cockpit-falcon.webp`): the game’s X-wing and Falcon cockpits from the pilot’s seat over Tatooine, the keys card over them as the check leaves it; the eye a share of each cockpit’s box (`cockpit/vehicles/game.js`’s `EYE_AT`), since the game’s cockpit meshes carry no camera node. Both runs exit 0 (the X-wing’s 84 calls, 139,378 triangles; the Falcon’s 82 and 146,275, within the high row).
