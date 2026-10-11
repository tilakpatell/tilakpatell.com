# naboo/hangar: the game's level

From `levels/mp/naboo_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/naboo_02 --world naboo --district hangar --spawn --share low=0.5`; do not edit by hand.

- 2915 instances in the arena (±1024 m), 9 beyond it (the horizon), 3 left out under the ground (an interior: its own pack, `--inside`), 6 cells of 128 m
- fitted to low=0.5 of the tiers' triangles and calls (the site's own things spend the rest)
- 206 meshes (0 left out), 518 LOD files, 13.69 MB
- the far list 0.09 MB; terrain near 2.57 MB, far 2.01 MB; the spot's ground 200.91 m in the game
- textures missing from the bucket: 1

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 131 (2292) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 359k, 97 | 821k, 390 | 930k, 402 |
| texture bytes (every map the level has) | 13.96 MB | 43.01 MB | 43.01 MB |

Dropped on low: dirtdecals_05 ×1, dirtdecals_07 ×1, o_nab_oilsplatter_03 ×7, o_nab_oilsplatter_04 ×10, dirtdecals_06 ×3, o_nab_tiretracks_02 ×6, o_nab_oilsplatter_02 ×14, o_nab_oilsplatter_01 ×24, hangarcablefloor_s_128_end_02 ×6, dirtdecals_05 ×11, o_nab_tiretracks_03 ×6, dirtdecals_06 ×8, hangarcablefloor_s_128_end_01 ×10, hangarcablefloor_c45_128_02 ×5, decal_puddle_01 ×3, hangarcablefloor_s_512_02 ×2, o_nab_hangarfloortrim_01 ×12, droidwreckb1_01_posed_c ×1, decalplane256_01 ×17, o_nab_tiretracks_04 ×28, o_nab_struthangar_01 ×21, hangarcablefloor_s_256_connector_02 ×5, o_nab_wallsmallroom_01 ×2, hangarcablefloor_s_256_connector_01 ×7, droidwreckb1_01_part_a ×9, o_nab_ceilinghallcore_01 ×1, o_nab_floorspawnroom_01 ×2, dirtdecals_04 ×52, square_shadow_01 ×3, o_nab_wallhangar_s256_01 ×6, hangarcablefloor_s_512_01 ×3, o_nab_floorspawnroom_03 ×4, hangarcablefloor_c90_256x256_01 ×4, o_nab_doorhangar_01 ×2, droidwreckb1_01_posed_e ×7, lampwallhangar_01_b ×19, o_nab_wallhangar_s512_01 ×6, droidwreckb1_01_posed_f ×8, vehiclehangar_01_b ×2, hangarcablefloor_c90_256x256_02 ×5, lightfloor_01_a ×96, o_nab_tubeshangar_01_e ×4, cargotrolley_02_a ×1, o_nab_tubeshangar_01_d ×1, o_nab_floorhallcore_05 ×2, o_nab_newpowerroom_wall_2048x4096_lights_01_a ×15, o_nab_wallendhangar_01 ×1, o_nab_tubeshangar_01_f ×4, vehiclehangar_01_a ×3, detailhangarwall_06_b ×1, o_nab_stephangar_s1408_01 ×2, bufferstophangar_01 ×1, o_nab_pipehangar_02 ×2, o_nab_furniturecovered_03 ×11, o_nab_hangarwindow_01 ×11, detailhangarwall_07 ×21, o_nab_tubeshangar_01_c ×4, junksorted_02a ×30, o_nab_railingatrium_02 ×2, o_nab_tubeshangar_01_b ×5, o_nab_lighthangarceiling_01 ×25, o_nab_tubeshangar_01_a ×7, ladderhangar_01 ×10, vehiclehangar_01 ×8, o_nab_ceilingcorridor_01 ×23, fuelingstation_02_a ×5, o_nab_archhangar_02 ×4, o_nab_pillarornament_01 ×25, o_nab_floorhallcore_02 ×1, cratehangar_03 ×8, o_nab_powercoreentrancetop_01 ×1, o_nab_floorspawnroom_04 ×2, o_nab_floorhallcore_03 ×1, o_nab_floorhallcore_04 ×1, clampdoor_01 ×36, o_nab_ceilingbeam_01 ×8, o_nab_doorcoredoor_01 ×3, o_nab_doorcoredoor_02 ×3, cratehangar_04 ×16, o_nab_floorspawnroom_02 ×3, o_nab_framedoor_01 ×8, o_nab_ceilingbeam_02 ×22, o_nab_ceilingbeam_02_b ×45, o_nab_railhangar_s1024_01 ×11, o_nab_stairshangar_01 ×3, o_nab_doorcore_01 ×3, o_nab_newpowerroom_lowwall_2048_03_a ×2, pumpstation_01_a ×28, o_nab_newpowerroom_lowwall_2048_02_a ×2, detailhangarwall_03 ×54, cratehangar_01 ×339, o_nab_pipehangar_01 ×21, o_nab_wallcolumnhangar_02 ×12, detailhangarwall_05 ×2, cratehangar_02 ×158, o_nab_archcorridor_01 ×12, o_nab_archornament_01 ×1, statuedecorative_01 ×4, pumpstation_01_b ×56, o_nab_shelfhangar_01 ×7, o_nab_newpowerroom_lowwall_2048_01_a ×4, o_nab_newpowerroom_walkwayring_01_d ×2, o_nab_newpowerroom_balcony_01_a ×4, o_nab_newpowerroom_wall_2048x4096_02_b ×1, o_nab_hangarentrance_beacon_01_a ×2, o_nab_wallhangar_s1024_02 ×2, o_nab_wallhangar_s1024_02_b ×2, detailhangarwall_04 ×435, o_nab_wallhangar_s1024_03 ×2, o_nab_columncore_02_b ×6, o_nab_wallcolumnhangar_01 ×20, o_nab_antennapowercore_01 ×2, o_nab_newpowerroom_wall_2048x4096_01_b ×1, o_nab_columncore_02 ×8, o_nab_newpowerroom_walkwayring_02_b ×2, o_nab_wallhangar_s1024_04 ×1, o_nab_stairshangarcorridor_01 ×2, o_nab_wallcore_02 ×39, o_nab_wallcore_01 ×41, o_nab_hangarceilingbeam_s1024_01 ×11, o_nab_newpowerroom_walkwaystraight_custom_01_a ×10, o_nab_newpowerroom_walkwayring_01_c ×8, o_nat_nab_tree_s_01_c ×7, o_nab_walldoorlargehangar_1024_01 ×3, o_nab_exitarchhangar_01 ×1, o_nab_floorhangar_s1024_01 ×22, o_nab_pillarhangar_01 ×23, o_nab_newpowercore_platform_01 ×1, o_nab_columncore_01 ×68, o_nab_newpowerroom_walkwaystraight_2048_01_a ×18, o_nab_powercorecorridor_01 ×4

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 173 | 18.3 KB | lane R's placed.js |
| actors.json | 0 | 0.1 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 77 | 10.2 KB | fidelity X (nothing until it merges) |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 10 | 965.3 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 139.9 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 420.6 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): none. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 167 | 1241 | 57159 | 0 | 1 | 0 | 1356304 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,0 | 6901 | 174990 |
| -1,0 | 2832 | 95158 |
| 0,-1 | 1215 | 26026 |
| -1,-1 | 804 | 20424 |
| 0,1 | 643 | 9659 |
| 1,0 | 191 | 9329 |
<!-- /physics -->
