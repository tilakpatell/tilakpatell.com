# hoth: the game's level

From `levels/mp/hoth_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --spot 205 -1540 --ultra`; do not edit by hand.

- 5814 instances in the arena (±1024 m), 236 beyond it (the horizon), 14535 left out under the ground (an interior: its own pack, `--inside`), 155 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): none
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): arcticbase_snowpile_medium_enlighten_08 ×1680, mesh_light_cone_00 ×764, arcticbase_snowpile_medium_enlighten_07 ×209, mesh_enlightenproxy_02 ×29, arcticbase_mistplane_01 ×14, hangarwall_s_512_cablebottom_01_enlighten ×5, arcticbase_corridormistplane_01 ×3, hangarwall_s_256_cablebottomtotop_02_enlighten ×3, hangarwall_s_512_cabletop_01_enlighten ×3, arcticbase_shadowplane_01 ×2, hangarwall_s_256_cablebottomtotop_01_enlighten ×2, hangarwall_s_256_cabletop_01_enlighten ×2, hangarwall_s_256_cabletoptofloor_01_enlighten ×2, invalidatelightplane_01 ×2, corridor_01_s_256x512x512_a_cabletop_01_enlighten ×1, hangarmediumlightcone_02 ×1, hangarmediumlightcone_cables_01 ×1, hangarmediumlightcone_window_01 ×1, hangarsmallpillars_01_768x512_cablebottom_01_enlighten ×1, hangarsnowcave_01_cables_13_enlighten ×1, hangarwall_s_256_cablebottom_01_enlighten ×1, hangarwall_s_256_cablebottomtofloor_01_enlighten ×1, hangarwall_s_256_cablebottomtofloor_02_enlighten ×1, hothinterior_lightblocker_01 ×1, lightconecave_cables_01 ×1, lightconecave_cables_02 ×1, lightconecave_cables_03 ×1, lightconecave_cables_04 ×1
- 602 meshes (4 left out), 489 LOD files, 14.29 MB
- the far list 0.18 MB; terrain near 2.50 MB, far 2.20 MB; the spot's ground 362.30 m in the game
- textures missing from the bucket: 0
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 234.86 MB as the table gives them, 0 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 35 (35 m, 700 m) | 137 (137 m, 2740 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 715k, 140 | 1346k, 153 | 1572k, 168 | 2197k, 192 |
| texture bytes (every map the level has) | 8.87 MB | 28.84 MB | 28.84 MB | 223.98 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 4.01 MB | 6.27 MB | 8.78 MB | 14.29 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 691 | 88.8 KB | lane R's placed.js |
| actors.json | 10 | 1.0 KB | the scene's life rows |
| vehicles.json | 27 | 1.7 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 398 | 42.8 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 6 (and 6 at 128² with the sun, for ultra) | 2885.2 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 2843.6 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 47.8 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): droidgonk_01 ×4. Decals skipped: none. Tracks of owners the pack lacks: 25.

## Variations

Written by `node scripts/bf2017-variations.mjs hoth` from the level's 13 mesh variation databases (variations.json, 0.40 MB).

| meshes | with variations | applied by instances | by the level rule | mixed (default drawn) | textures missing from the bucket | maps not in the pack |
|---|---|---|---|---|---|---|
| 601 | 55 | 20 | 0 | 24 | 105 | 0 |

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 449 | 3556 | 236905 | 3 | 23 | 0 | 5253344 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -3,0 | 2019 | 51276 |
| -1,2 | 1832 | 39165 |
| -1,1 | 1830 | 40933 |
| -2,0 | 1777 | 47988 |
| 0,1 | 1460 | 34112 |
| -2,2 | 1457 | 36500 |
| 0,0 | 1453 | 35558 |
| -1,0 | 1448 | 34187 |
| -2,-1 | 1448 | 32368 |
| -2,3 | 1414 | 28516 |
<!-- /physics -->
