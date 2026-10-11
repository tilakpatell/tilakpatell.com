# Lane D2: every detail, the numbers

The plan: `docs/superpowers/plans/2026-10-11-bf2017-picture-laneD2-detail.md`. Every number below comes from the seven packs as `scripts/bf2017-level.mjs … --ultra` wrote them on `claude/bf2017-d2-detail` on 2026-10-11, between 05:43 and 06:14 UTC: each pack’s README holds its command and full table. The “before” figures are the same READMEs on `claude/bf2017-e0-factory-on-main` at 57d46c115. Where a figure says “every map”, it is the README’s texture row: every map the pack ships, at the size each tier takes. A tier fetches only the maps of the meshes it draws.

## Per pack and tier

Triangles and calls are at the worst place you can stand, and the README’s fit holds them to 90 % of the row. “Dropped” means meshes the fit leaves out. Texture MB covers every map. Mesh MB is the LOD files the tier can draw.

| pack | tier | dropped (before → after) | worst triangles, calls | texture MB (before → after) | mesh MB | LOD0 over 12k triangles |
| --- | --- | --: | --: | --: | --: | --: |
| hoth | high | 0 → 0 | 1,573k, 169 | 28.7 → 28.8 | 8.8 | 0 |
| hoth | ultra | (none) → 0 | 2,198k, 193 | (none) → 224.0 | 14.3 | 10 |
| hoth/base | high | 54 → 54 | 1,286k, 630 | 40.1 → 42.0 | 28.4 | 0 |
| hoth/base | ultra | (none) → 0 | 3,639k, 889 | (none) → 243.3 | 49.1 | 31 |
| endor | high | 169 → 170 | 2,339k, 630 | 107.2 → 112.3 | 36.3 | 0 |
| endor | ultra | (none) → 0 | 5,642k, 1,267 | (none) → 242.7 | 54.1 | 34 |
| sb_endor | high | 24 → 24 | 1,151k, 311 | 32.5 → 35.5 | 22.0 | 0 |
| sb_endor | ultra | (none) → 0 | 2,639k, 377 | (none) → 241.6 | 46.6 | 28 |
| sb_fondor | high | 154 → 154 | 535k, 307 | 31.6 → 56.9 | 12.4 | 0 |
| sb_fondor | ultra | (none) → 19 | 2,222k, 674 | (none) → 244.0 | 66.9 | 67 |
| sb_kamino | high | 134 → 134 | 1,169k, 119 | 40.6 → 57.3 | 8.5 | 0 |
| sb_kamino | ultra | (none) → 0 | 9,500k, 736 | (none) → 244.0 | 44.1 | 31 |
| sb_droidbattleship | high | 0 → 0 | 1,022k, 218 | 32.0 → 32.0 | 22.6 | 0 |
| sb_droidbattleship | ultra | (none) → 0 | 2,178k, 222 | (none) → 242.7 | 56.3 | 49 |

Low and mid are as they were: low and mid drop the same meshes, and their worst places are within 1 % of before. The two that moved are Endor’s 425 skinned shrubs, now in the pack, and its mid calls, 436 → 434.

High’s “every map” grew where a mesh that high drops is kept on ultra (Fondor, Kamino, Endor). The factory writes such a mesh’s maps at every tier’s size, but high does not draw the mesh, so it never fetches them. The fetched figures are in the gate below.

Sizes of maps at each tier, out of every map in the pack (from the table script over `level.json`’s `tex`; Hoth’s count includes its ground layers):

| pack | high: 2048 / 1024 / 512 / 256 / ≤128 | ultra: 2048 / 1024 / 512 / 256 / ≤128 |
| --- | --- | --- |
| hoth | 0 / 25 / 54 / 41 / 25 | 81 / 33 / 25 / 5 / 1 |
| hoth/base | 0 / 17 / 88 / 133 / 151 | 97 / 134 / 94 / 45 / 19 |
| endor | 0 / 67 / 190 / 177 / 124 | see the fit: 173 at 2048 before it |
| sb_kamino | 0 / 63 / 138 / 46 / 17 | 170 / 65 / 11 / 5 / 13 (before the fit) |

## Ultra’s maps: held to the GPU contract

The plan’s table, with ultra at 2048 / 2048 / 1024 and its normal and ORM maps at the colour’s size, gave these totals as built: Hoth 234.9 MB, Hoth’s base 385.2, Endor 685.8, sb_endor 269.6, Fondor 368.6, Kamino 420.7, the droid battleship 254.5. A pack’s maps are bound after its GLB is parsed, so `fitTextures` never sees them. `lod.js`’s `fitMaps` now holds ultra to `TEX_MB.ultra`, 256 MB (the desktop GPU-memory contract). Normal and ORM maps step down first, the biggest first, and never below high’s size. Maps stepped: Hoth 0, the droid battleship 0, sb_endor 5, Fondor 41, Hoth’s base 63, Kamino 65, Endor 335.

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

The earlier counts left part of each level out: in software GL `lib/three/frameGuard` readies about one shader a frame, so a level pack's hundreds of materials were still held back when the frame was counted. These counts come from the merged branch (ef7161e7a, its packs republished) with the guard off and three frames drawn before the counted one.

| world | tier | calls (row) | triangles (row) | of which the level | models MB (bucket row) | result |
| --- | --- | --: | --: | --: | --: | --- |
| hoth | low | 286 (350) | 1,390,850 (800,000) | 156 calls, 703,404 tris | 40.1 (45) | triangles over |
| endor | low | 238 (350) | 1,103,954 (800,000) | 21 calls, 179,763 tris | 24.8 (45) | triangles over |

**A finding for fitCull on low, not a budget.** The pack itself is where its fit put it: Hoth's level draws 703k triangles at low, against the README's worst place of 716k, which is 90 % of the 0.8M row. What breaks the row is everything else on the page, about 690k on Hoth and 924k on Endor: the ground, the figures, the site's own dressing. `fitCull` holds a pack to a share of the row that it does not know is already spent. Endor's `--share low=0.5` was the first patch for that, and it is not enough: Endor's site things alone are over the row. The fix belongs to the factory and the site, not this lane's caps:

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

- Ultra keeps every mesh but Fondor’s 19 (584 instances). That pack takes half the ultra row (`--share 0.5`, beside the flight page), so its calls cut them.
- Endor’s 425 wind-bent shrubs are in the pack as rigid bind-pose instances (`STILL_SKINNED`). Every other skinned actor is the site’s to place (`actors.json`).
- The textures missing from the bucket are as before: Hoth 4, Hoth’s base 6, Endor 27, the droid battleship 2.
- Probes: Hoth and Hoth’s base have 6 each at 128² with the sun kept for ultra, beside the 64² clipped ones, and Fondor has 6. Endor_01 bakes no sunny reflection volume, and the other space levels none at all.
- LUTs: every light record’s 24 LUTs re-cut at 33³ (`scripts/bf2017-lut.mjs`). The 17³ nodes are identical (maximum difference 0).
