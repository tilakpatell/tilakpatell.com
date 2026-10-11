# Lane D2: every detail, the numbers

The plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneD2-detail.md`. Every number below comes from the seven packs as `scripts/bf2017-level.mjs … --ultra` wrote them on `claude/bf2017-d2-detail` on 2026-10-11, between 05:43 and 06:14 UTC: each pack’s README holds its command and full table. The “before” figures are the same READMEs on `claude/bf2017-e0-factory-on-main` at 57d46c115. Where a figure says “every map”, it is the README’s texture row: every map the pack ships, at the size each tier takes. A tier fetches only the maps of the meshes it draws.

## Per pack and tier

Triangles and calls are at the worst place you can stand, and the README’s fit holds them to 90 % of the row. “Dropped” means meshes the fit leaves out. Texture MB covers every map. Mesh MB is the LOD files the tier can draw.

| pack | tier | dropped (before → after) | worst triangles, calls | texture MB (before → after) | mesh MB | LOD0 over 12k triangles |
| --- | --- | --: | --: | --: | --: | --: |
| hoth | high | 0 → 0 | 1,572k, 168 | 28.7 → 28.8 | 8.8 | 0 |
| hoth | ultra | (none) → 0 | 2,197k, 192 | (none) → 224.0 | 14.3 | 10 |
| hoth/base | high | 54 → 49 | 1,293k, 630 | 40.1 → 42.1 | 28.1 | 0 |
| hoth/base | ultra | (none) → 0 | 3,639k, 889 | (none) → 243.4 | 49.1 | 31 |
| endor | high | 169 → 156 | 2,318k, 630 | 107.2 → 113.4 | 33.2 | 0 |
| endor | ultra | (none) → 0 | 5,642k, 1,265 | (none) → 244.1 | 54.1 | 34 |
| sb_endor | high | 24 → 23 | 1,101k, 314 | 32.5 → 35.5 | 21.3 | 0 |
| sb_endor | ultra | (none) → 0 | 2,639k, 377 | (none) → 241.6 | 46.6 | 28 |
| sb_fondor | high | 154 → 140 | 563k, 306 | 31.6 → 55.6 | 14.1 | 0 |
| sb_fondor | ultra | (none) → 20 | 2,241k, 671 | (none) → 243.1 | 67.0 | 67 |
| sb_kamino | high | 134 → 109 | 1,837k, 142 | 40.6 → 57.3 | 9.1 | 0 |
| sb_kamino | ultra | (none) → 0 | 9,500k, 735 | (none) → 244.0 | 44.1 | 31 |
| sb_droidbattleship | high | 0 → 0 | 1,022k, 218 | 32.0 → 32.0 | 22.6 | 0 |
| sb_droidbattleship | ultra | (none) → 0 | 2,178k, 222 | (none) → 242.7 | 56.3 | 49 |

Low, mid and high moved with `main`’s fit weights (E4’s `seenWeight` and `standsOn`, merged at 972217197), which keep floors and walkable plates over clutter: Hoth’s base drops 49 meshes at high where it dropped 54, Endor 156 where it dropped 169, and Kamino 109 where it dropped 134. Endor also gains its 425 skinned shrubs, which are now in the pack. Each README has all four tiers.

High’s “every map” grew where a mesh that high drops is kept on ultra (Fondor, Kamino, Endor). The factory writes such a mesh’s maps at every tier’s size, but high does not draw the mesh, so it never fetches them. The fetched figures are in the gate below.

Sizes of maps at each tier, out of every map in the pack (from the table script over `level.json`’s `tex`; Hoth’s count includes its ground layers):

| pack | high: 2048 / 1024 / 512 / 256 / ≤128 | ultra: 2048 / 1024 / 512 / 256 / ≤128 |
| --- | --- | --- |
| hoth | 0 / 25 / 54 / 41 / 25 | 81 / 33 / 25 / 5 / 1 |
| hoth/base | 0 / 17 / 88 / 133 / 151 | 97 / 134 / 94 / 45 / 19 |
| endor | 0 / 67 / 190 / 177 / 124 | see the fit: 173 at 2048 before it |
| sb_kamino | 0 / 63 / 138 / 46 / 17 | 170 / 65 / 11 / 5 / 13 (before the fit) |

## Ultra’s maps: held to the GPU contract

The plan’s table, with ultra at 2048 / 2048 / 1024 and its normal and ORM maps at the colour’s size, gave these totals as built: Hoth 234.9 MB, Hoth’s base 385.2, Endor 685.8, sb_endor 269.6, Fondor 368.6, Kamino 420.7, the droid battleship 254.5. A pack’s maps are bound after its GLB is parsed, so `fitTextures` never sees them. `lod.js`’s `fitMaps` now holds ultra to `TEX_MB.ultra`, 256 MB (the desktop GPU-memory contract). Normal and ORM maps step down first, the biggest first, and never below high’s size. Maps stepped: Hoth 0, the droid battleship 0, sb_endor 5, Fondor 38, Hoth’s base 63, Kamino 65, Endor 335.

## The caps: why high kept main’s

With high a step up as the plan wrote it (2048 / 1024 / 512, normal and ORM at the colour’s size), Hoth’s pack maps at high came to 177.2 MB, 131 MB of it normal and ORM, against 28.7 MB on main. The bucket-backed Hoth on main fetches 29.2 MB of pack maps at high out of 142.4 MB in all (63.7 figures, 37.0 surface models, 7.6 other bf2017 models, 3.1 pack cells and meshes), so the world would come to about 290 MB against the 160 MB bucket row. Every lesser step on high was estimated over the row too:

- colour only a step up, data a step under: 111 MB of pack maps
- the step for 8 m wearers alone: 92 MB

The room under the row is about 47 MB of pack maps. So high and mid keep main’s 1024 / 512 / 256 with data a step under, and the step goes to ultra alone.

## The gate (task 7)

`galaxy-check.mjs` counts every `.glb`, `.ktx2` and `.bin`, and notes when the bucket served them. Main’s Hoth (00843045b) measured through a dev server with `VITE_ASSET_BASE` at the public bucket, software GL, on 2026-10-11:

| tier | calls (row) | triangles (row) | models MB, everything counted | old row | bucket row (+10 %) |
| --- | --: | --: | --: | --: | --: |
| low | 154 (350) | 660,445 (800,000) | 39.1 | 20 | 45 |
| mid | 150 (274) | 651,209 (1,236,993) | 60.7 | 40 | 70 |
| high | 140 (274) | 908,609 (1,664,163) | 142.4 | 60 | 160 |
| ultra | 120 (1,500) | 1,728,667 (none) | 258.6 | 240 | 285 |

D2’s branch at 7535bb89 and its packs as published, measured the same way: `BUDGET=1 QUALITY=<tier> galaxy-check surface hoth,endor` on 2026-10-11, 06:20 to 06:50 UTC.

| world | tier | calls (row) | triangles (row) | level calls, instances | models MB (bucket row) | result |
| --- | --- | --: | --: | --: | --: | --- |
| hoth | high | 158 (274) | 982,095 (1,664,163) | 181, 6,037 | 146.1 (160) | pass |
| endor | high | 164 (257) | 1,403,163 (3,679,784) | 237, 2,121 | 157.7 (160) | pass (Endor is held to its own baseline: `KNOWN_OVER`) |
| hoth | ultra | 185 (1,500) | 1,890,727 (none) | 0 when measured, 206 and 6,037 at 160 s | 472.6 (285) | over: recorded, not held |
| endor | ultra | 90 (1,500) | 2,583,301 (none) | 865, 12,940 | 475.7 (285) | over: recorded, not held |

High holds on both, Endor with 2.3 MB to spare. Ultra fetches about 470 MB, against 258.6 MB on main: ultra’s pack maps (up to 256 MB a pack, against main’s high sizes) and the LOD0 meshes come on top of what main fetches. The plan holds ultra to its numbers being recorded; the frame time and memory at ultra are the laptop’s gate (lane G, the desktop’s `gate` job, PR #906). In software GL, Hoth’s level at ultra comes up about 150 s in, after the check’s settle, so its counts there are the world without the level (a probe of the page polled every 20 s: 0 calls to 120 s, 57 at 140 s, 206 at 160 s). The ultra rows therefore want a longer settle, or the desktop’s GPU, before they can be held.

### Counted whole, after the merge with main (lane E4's frame-guard switch, PR #911, ported)

The earlier counts left part of each level out: in software GL `lib/three/frameGuard` readies about one shader a frame, so a level pack's hundreds of materials were still held back when the frame was counted. These counts come from the merged branch with `main`’s fit weights (972217197, its packs republished), with the guard off and three frames drawn before the counted one.

| world | tier | calls (row) | triangles (row) | of which the level | models MB (bucket row) | result |
| --- | --- | --: | --: | --: | --: | --- |
| hoth | low | 300 (350) | 1,390,850 (800,000) | 156 calls, 703,404 tris | 40.2 (45) | triangles over |
| endor | low | 238 (350) | 926,788 (800,000) | 29 calls, 6,668 tris | 25.4 (45) | triangles over |

**A finding for fitCull on low, not a budget.** The pack itself is where its fit put it: Hoth's level draws 703k triangles at low, against the README's worst place of 716k, which is 90 % of the 0.8M row. What breaks the row is everything else on the page, about 690k on Hoth and 920k on Endor, where the level draws 6.7k at low: the ground, the figures, the site's own dressing. `fitCull` holds a pack to a share of the row that it does not know is already spent. Endor's `--share low=0.5` was the first patch for that, and it is not enough: Endor's site things alone are over the row. The fix belongs to the factory and the site, not this lane's caps:

- measure each world at low without its pack, and give the pack what is left as its `--share` (Hoth would take about 0.14);
- or trim the site's own low-tier things.

Either way it changes what low looks like, so the decision is the owner's. No row was raised.

Mid and high, counted whole, cannot be run here in time. Since lane T's #887 the surface draws mid and up on the node renderer, and `?gpu=webgl` now picks `nodes-webgl`, still the node renderer. In software GL the high run outlasts a 40-minute limit with two worlds, and Hoth alone outlasts 100 minutes: that measure is the GPU’s (the laptop, lane G, the desktop’s `gate` job). The earlier high runs, which held back some materials as described above, put Hoth at 146.1 MB and Endor at 157.7 MB of models, within the 160 MB bucket row. Downloads do not depend on the frame guard, so those megabyte figures stand.

## Decals

The parts writer fetches each decal’s colour KTX2 into the pack’s `tex/decals/`. Normal-only volume decals are kept in `decals.json`, with `texture: null` and `normalOnly: true`.

| pack | decals kept | normal-only | colour maps | left out |
| --- | --: | --: | --: | --- |
| endor | 11 | 11 | 0 | 12 in the `FantasyBattle` mode layer (the burnt boxes: not the arena’s subs) |
| sb_fondor | 98 | 0 | 1 | |
| sb_kamino | 24 | 0 | 1 | |
| sb_droidbattleship | 16 | 0 | 1 | |
| hoth, hoth/base, sb_endor | 0 | 0 | 0 | none in the extras for their subs |

Nothing draws Endor’s 11 yet: their shader binds `T_DefaultBlack` alone, and the template’s own normal map is not in the export (a desktop ask). `decalScene.js` passes them over.

## What stays out, and why

- Ultra keeps every mesh but Fondor’s 20 (400 instances). That pack takes half the ultra row (`--share 0.5`, beside the flight page), so its calls cut them.
- Endor’s 425 wind-bent shrubs are in the pack as rigid bind-pose instances (`STILL_SKINNED`). Every other skinned actor is the site’s to place (`actors.json`).
- The textures missing from the bucket are as before: Hoth 4, Hoth’s base 6, Endor 27, the droid battleship 2.
- Probes: Hoth and Hoth’s base have 6 each at 128² with the sun kept for ultra, beside the 64² clipped ones, and Fondor has 6. Endor_01 bakes no sunny reflection volume, and the other space levels none at all.
- LUTs: every light record’s 24 LUTs re-cut at 33³ (`scripts/bf2017-lut.mjs`). The 17³ nodes are identical (maximum difference 0).

## E1’s packs

Lane U-packs (`claude/bf2017-upacks-e1`, from `origin/main` at f6511872, after #926): the four packs lane E1 built, re-run on 2026-10-11 between 14:55 and 15:12 UTC with each README’s own command and `--ultra` added (Tatooine keeps its `--subs tatooine_01,content,content_024`, Yavin its `--subs yavin_01,yavin_012,streamed_in_props,sunny`; Yavin’s old `--drop lightblocker,*occluder*,*invisiblecollision*` is gone, since the factory’s `NEVER` rule now takes them). Every number below is the README each run wrote; the “before” figures are the same READMEs on `main` at f6511872. “LOD0 shipped” counts the meshes whose LOD0 is over 12,000 triangles and whose LOD0 file is in the pack (`level.json`’s `meshes[].glb[0]`), the way the per-pack table above counts it (Hoth gives 10 by the same count).

| pack | tier | dropped (before → after) | worst triangles, calls | texture MB (before → after) | mesh MB | LOD0 shipped (of those over 12k) |
| --- | --- | --: | --: | --: | --: | --: |
| tatooine | high | 0 → 0 | 1,053k, 629 | 81.9 → 84.0 | 41.1 | 0 |
| tatooine | ultra | (none) → 0 | 3,643k, 901 | (none) → 243.9 | 52.4 | 28 (of 39) |
| tatooine/jabba | high | 0 → 0 | 1,400k, 555 | 54.9 → 55.0 | 19.2 | 0 |
| tatooine/jabba | ultra | (none) → 0 | 1,570k, 603 | (none) → 244.1 | 20.4 | 10 (of 18) |
| tatooine/jabba-inside | high | 0 → 0 | 170k, 117 | 8.6 → 8.6 | 3.7 | 0 |
| tatooine/jabba-inside | ultra | (none) → 0 | 264k, 120 | (none) → 49.3 | 4.4 | 3 (of 18) |
| yavin | high | 342 → 275 | 2,561k, 630 | 96.6 → 119.2 | 28.9 | 0 |
| yavin | ultra | (none) → 0 | 6,509k, 1,348 | (none) → 244.0 | 90.7 | 66 (of 88) |

Low and mid moved too, with `main`’s fit weights: Tatooine drops 103 meshes at low where it dropped 110 (63 at mid, 65 before), the palace 14 where it dropped 16, Yavin 373 where it dropped 463 (365 at mid, 436 before). Yavin’s arena grew from 13,808 to 14,278 instances: its 470 wind-bent bushes and small trees (`yavinbase_bush_*_skinned`, `yavinbase_tree_small_*_skinned`) are in the pack as rigid bind-pose instances (`STILL_SKINNED`), where E1’s run listed them under “not placed”. The pit is the one pack whose ultra maps fit under the contract as built (51.7 MB); Yavin’s ultra draws out to 493 m, not the 1,000 m of the others, because its fit holds the worst place to 90 % of the 1,500-call row (1,348).

Ultra’s maps, held to 256 MB (`lod.js`’s `fitMaps`): Tatooine 407.7 MB as the table gave them, 136 stepped down a size or more; the palace 359.0 MB, 54 stepped; the pit 51.7 MB, 0 stepped; Yavin 624.8 MB, 270 stepped. Sizes of maps at each tier, out of every map the pack ships (from `level.json`’s `tex`, as the table above):

| pack | high: 2048 / 1024 / 512 / 256 / ≤128 | ultra: 2048 / 1024 / 512 / 256 / ≤128 |
| --- | --- | --- |
| tatooine | 0 / 33 / 129 / 288 / 363 | 22 / 117 / 394 / 208 / 70 (2 rows with no size: the maps the bucket lacks) |
| tatooine/jabba | 0 / 17 / 103 / 210 / 238 | 23 / 159 / 280 / 79 / 27 |
| tatooine/jabba-inside | 0 / 0 / 18 / 52 / 60 | 7 / 25 / 53 / 39 / 6 |
| yavin | 0 / 61 / 234 / 209 / 139 | 43 / 101 / 267 / 199 / 33 |

### What stays out, and why

- Ultra drops nothing in any of the four. The palace’s `palace_01_shadowmesh` is left out by its shader (`SS_Shadowmesh`, a shadow proxy); Tatooine’s 44 and Yavin’s 5 meshes left out are the sequel-era rows the era rule refuses (Jakku’s engines and barrels, the Resistance transport, Takodana’s chest), as before.
- Never drawn as themselves (the `NEVER` rule): Tatooine’s 45 Enlighten proxies, light cones and light plane; the palace’s 20 light cones, 7 proxies and the shadow mesh; Yavin’s 93 light cones, 144 Enlighten light meshes, 19 invisible collision shapes, the 336 m `lightblocker`, two occluders, 9 proxies and a light plane. E1 had dropped Yavin’s by name; the rule now names them in every README.
- Textures missing from the bucket: Tatooine 2 (3 before), the palace 1 (2 before), the pit 0, Yavin 7 (15 before). The bucket gained maps between E1’s run and this one; the rest are the desktop’s (lane W’s not-uploaded job).
- Decals: Tatooine keeps its one (its colour map now fetched into `tex/decals/`, 1.07 MB); the palace, the pit and Yavin have none in their subs (Yavin skips the ones in sub 7, not an arena sub).
- Probes at 128² with the sun for ultra: 65 for the palace and the pit (beside their 64² clipped ones, 31.3 MB in all), 2 for Yavin; Tatooine_01 bakes no reflection volume.
- Yavin’s skinned creatures (4 gonk droids, 4 stintarils, 14 woolamanders) and its spawned fighters stay the site’s to place (`actors.json`, `vehicles.json`), as in every pack.

### The colour check

`bf2017-colour-check.mjs --packs --fix` after the four runs: 4,728 files under the packs, 1,858 colour maps sRGB, 2,828 data maps linear, 42 unknown, 0 wrong; the four packs’ rows stamped by the game’s word (Tatooine 765 of 813, the palace 560 of 568, the pit 130 of 130, Yavin 638 of 643). It would also re-stamp ten rows in packs that are not this lane’s (`sb_fondor/level.json`: 4 rows gaining a word; `kamino/recipes.json`: 6, four of them flipping between sRGB and linear) because `textures.jsonl` now knows those maps. Those rows were put back: their published files are not in this checkout to take the same stamp, and a row that disagrees with its file is what `--published` is for. A finding for the colour lane or those packs’ next run.

### The recipes

Asked for by the orchestrating session on the way (lane T2 tests Tatooine’s level on the node renderer, where a mesh with no recipe keeps its raw GLB material and builds its own program): lane Q1’s `bf2017-recipes.mjs --level <pack> --fetch` over the cached `materials.jsonl`, for each of the four. Maps the recipes want, in the pack: Tatooine 13 of 13, the palace 22 of 22, the pit 12 of 12, Yavin 34 of 36 (two character detail arrays, `TA_CharacterDetail_01_NS` and `_07_NS`, the bucket lacks). The colour check stamped each `recipes.json`’s rows (4,897 files under the packs after the fetch, none wrong).

### Published

`assets-publish.mjs --only 'models/galaxy/bf2017/levels/tatooine/**,models/galaxy/bf2017/levels/yavin/**'`, twice: the packs, 4,575 files sent (3,375 new, 1,200 changed, 983.2 MB), none there already, none failed; then the recipes’ maps, 169 files (45.2 MB). The manifest and `.gitignore`’s block rewritten each time, so the packs’ binaries stay out of git (level.json, the parts’ JSON, the new `variations.json` and `recipes.json`, and the READMEs are in).

`assets-check` after the second publish: 52,035 of 52,035 right, 0 retried, 1,064 s. Three of them are the empty `horizon.bin` files of the interiors (Hoth’s base, Kamino’s Venator, the pit), which every earlier run reported as “HTTP 416”: the checker had the rule for an empty file’s 416 (`content-range: bytes */0`), but `scripts/lib/pool.mjs` called every 4xx `failed` before the verdict read it. The pool now keeps a failed answer’s headers and the verdict reads the empty file’s 416 first (`scripts/assets-check.test.mjs` covers both shapes).

### The gates (software GL, the node renderer)

`BUDGET=1 BUDGET_REPORT=1 QUALITY=<tier> SCANS=game PHASE_WAIT=1500000 node scripts/galaxy-check.mjs surface tatooine,yavin` on this branch at 8c597ff9, through a dev server with `VITE_ASSET_BASE` at the public bucket (as the gate above), headless Chromium on SwiftShader, 2026-10-11. The surface draws on `nodes-webgl` (lane T’s flip; `galaxy-check` on this branch is `main`’s at f6511872, before #903’s `SHOT_WAIT`). Yavin’s pack is not wired into `yavin.js` (E1 left the temple to be seen on a real GPU first), so Yavin’s lines measure the site’s own Yavin without its level; Tatooine’s lines are the pack’s.

The first pass ran both tiers side by side, 15:32 to 17:32 UTC. High: Yavin came up and was counted; Tatooine never did (“the world never came up”, the deploy dialog over a black world in its screenshot, an `ERR_HTTP2_PROTOCOL_ERROR` on one bucket fetch, and the second publish’s manifest hot-reloaded the surface pages at 15:42, ten minutes into its load). Ultra: Tatooine came up and the run was killed at the two-hour limit inside the frame count (`galaxy-check.mjs:246`), with no line written. Second pass, one world at a time, below.

| world | tier | calls (row) | triangles (row) | models MB (bucket row) | frame p50, p95 (reported) | result |
| --- | --- | --: | --: | --: | --: | --- |
| yavin | high (first pass) | 281 (700; baseline 78 +10 % = 86) | 1,576,948 (1,900,234) | 76.7 (160) | 7,333, 7,443 ms | rows pass; over its baseline |
| tatooine | high | 292 (700; baseline 183 +10 % = 201) | 1,058,961 (3,000,000; baseline 835,469 +10 % = 919,016) | 132.5 (160) | 68,747, 81,280 ms | rows pass; over its baseline; one `ERR_HTTP2_PROTOCOL_ERROR` on a fetch |
| yavin | ultra | 323 (1,500) | 3,881,994 (none) | 200.5 (285) | 35,465, 39,749 ms | pass; one `ERR_HTTP2_PROTOCOL_ERROR` on a fetch (the proxy cut a transfer), so the check exits 1 on the page error |

Tatooine at high, alone, came up in 14 minutes and its level is what E1 measured: 222 level calls, 347,351 triangles, 1,212 instances, 1,232 physics bodies dropped; the whole world is 292 calls and 1.06M triangles against E1’s 183 and 835k on the classic renderer, for the same reason as Yavin’s. Its models (132.5 MB, every `.glb`, `.ktx2` and `.bin` the bucket served) hold under the 160 MB bucket row. Yavin’s baseline (`lab/baseline/surface-high.json`, 78 calls, lane E1’s refresh on the classic renderer) is before lane T’s flip to the node renderer and before the game’s light: the world draws 281 calls now without its level, so the +10 % rule fails it while every row passes. That is the baseline wanting remaking with the node renderer and the levels in (D2’s task 7, left to the GPU), not a row to raise.
