# endor/bunker: the game's level

From `levels/mp/endor_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/endor_01 --world endor --district bunker --inside --spot 211.8 331`; do not edit by hand.

- 4098 instances in the arena (±1024 m), 0 beyond it (the horizon), 12962 left out above the ground (the world outside: its own pack), 25 cells of 128 m
- 689 meshes (3 left out), 877 LOD files, 18.52 MB
- the far list 0.13 MB; terrain near 0.90 MB, far 0.12 MB; the spot's ground 283.72 m in the game
- textures missing from the bucket: 9

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 86 (86 m, 1720 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 9 (46) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 281k, 315 | 591k, 448 | 773k, 555 |
| texture bytes (every map the level has) | 13.59 MB | 41.51 MB | 41.51 MB |

Dropped on low: o_nab_oilsplatter_04 ×1, o_nab_oilsplatter_01 ×3, hangarsystem_decalarray_line_02 ×1, hangarsystem_decalarray_misc_03 ×1, o_nab_oilsplatter_03 ×8, o_nab_oilsplatter_02 ×9, dsi_hangarsystem_decalarray_corner_01_b ×12, hangarsystem_decalarray_line_01 ×6, hangarcablefloor_s_128_end_02 ×5

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 1319 | 188.3 KB | lane R's placed.js |
| actors.json | 34 | 3.4 KB | the scene's life rows |
| vehicles.json | 11 | 0.7 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 1019 | 157.6 KB | fidelity X (nothing until it merges) |
| tracks.json | 8 | 7.6 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 832.5 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 249.8 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): forestbase_shrublarge_01_skinned ×222, forestbase_shrubmedium_01_skinned ×168, forestbase_shrubsmall_01_skinned ×35. Decals skipped: texture 11, sub 12. Tracks of owners the pack lacks: 22.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 523 | 4844 | 268293 | 8 | 5 | 0 | 5949820 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 2,-1 | 5316 | 169891 |
| 1,-1 | 3974 | 112937 |
| 2,1 | 3843 | 155035 |
| 1,0 | 1845 | 57330 |
| 0,0 | 1774 | 51946 |
| 2,2 | 1322 | 87040 |
| 1,1 | 361 | 50878 |
| 3,2 | 281 | 25662 |
| 2,0 | 163 | 18824 |
| 3,1 | 128 | 15011 |
<!-- /physics -->
