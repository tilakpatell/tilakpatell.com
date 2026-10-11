# sb_endor: the game's level

From `levels/space/sb_endor_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/space/sb_endor_01 --world sb_endor --spot -259 -665 --subs SB_Endor_01,Art,Art_LargeGameMode,Level_Design,SpaceBattle --drop SpaceBattle:corvettecr90_01,nowhere*,starcard*,Art:planet_*,Art:moon_* --share 0.5 --arena 4096 --ultra`; do not edit by hand.

- 2331 instances in the arena (±4096 m), 184 beyond it (the horizon), no terrain: no ground layer, the instances alone, 658 cells of 128 m
- left out: SpaceBattle:corvettecr90_01, nowhere*, starcard*, Art:planet_*, Art:moon_*
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): deathstar_debris_l_03_mc80_destruction ×4
- fitted to a share of the tiers' rows: low 0.5, mid 0.5, high 0.5, ultra 0.5
- 210 meshes (2 left out), 551 LOD files, 46.57 MB
- the far list 0.07 MB; terrain none; the spot's ground 0.00 m in the game
- textures missing from the bucket: 0
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 269.59 MB as the table gives them, 5 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 40 (40 m, 800 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 68 (1138) | 57 (702) | 24 (173) | 0 (0) |
| worst place: triangles, calls | 345k, 143 | 663k, 186 | 1151k, 311 | 2639k, 377 |
| texture bytes (every map the level has) | 10.68 MB | 35.54 MB | 35.54 MB | 241.55 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 3.68 MB | 8.11 MB | 21.98 MB | 46.57 MB |

Dropped on low: sb_dirtdecals_03 ×2, sb_dirtdecals_01 ×6, decalmesh_hitscorch_01 ×19, sb_dirtdecals_02 ×7, sb_dirtdecals_05 ×13, sb_dirtdecals_06 ×10, sb_dirtdecals_04 ×21, turretturbolaser_01 ×23, stardestroyer_hangarprimary_door_01 ×1, stardestroyer_hangarprimaryentrance_01 ×1, debris_pipe_xl_01 ×12, stardestroyer_detailsfront_01 ×1, stardestroyer_hangarsecondary_01 ×1, stardestroyer_detailshulltop_04 ×1, mc80_largenodule_01 ×1, stardestroyer_detailshulltop_01 ×1, debris_sdreactorpipe_s1024_a_01 ×37, mc80_largenodule_04 ×1, mc80_largenodule_05 ×1, stardestroyer_detailshulltop_03 ×1, mc80_largenodule_02 ×1, endor_mine_emissiveoff ×6, debris_pipe_xl_02 ×57, mc80_largenodule_03 ×1, mc80_nodulehanger_01 ×1, corvettecr90_01 ×2, mc80_engine_module_01 ×1, stardestroyer_detailsside_01_right_b ×1, stardestroyer_detailsside_01_b ×1, mc80_largenodule_06 ×1, stardestroyer_detailsside_03 ×8, stardestroyer_detailsside_07 ×1, stardestroyer_detailsside_07_right ×1, stardestroyer_solarionizationreactor_01 ×1, stardestroyer_detailsside_01_c ×1, stardestroyer_detailsside_01_right_c ×1, deathstar_debris_l_03 ×89, debris_panelpartial_l_01 ×62, deathstar_debris_m_03 ×8, stardestroyer_communicationstower_01 ×1, debris_panelpartial_l_02 ×73, stardestroyer_detailsside_01_right_d ×1, stardestroyer_detailsside_05 ×1, stardestroyer_detailsside_05_right ×1, endor_engine_targetcollision ×1, stardestroyer_detailsside_01_a ×1, stardestroyer_detailsside_01_right_a ×1, debris_pipe_xl_03 ×93, stardestroyer_detailscommandbridge_03_back ×1, stardestroyer_detailsside_06_right ×1, stardestroyer_detailsside_06 ×1, stardestroyer_detailsside_01_right_e ×1, stardestroyer_detailsside_01_e ×1, stardestroyer_hangarprimary_01 ×1, deathstar_debris_l_04_mirrorx ×114, stardestroyer_detailsengine_02 ×2, stardestroyer_detailscommandbridge_02 ×1, deathstar_debris_l_02 ×64, stardestroyer_mainengine_01 ×3, stardestroyer_detailscommandbridge_01 ×1, mc80_mainturret ×1, deathstar_debris_l_04 ×187, mc80_engine_module_02 ×2, stardestroyer_detailshull_02_front ×1, debris_coretube_l_01 ×39, mc80_engine_skirt_01 ×1, stardestroyer_detailshull_01_front ×1, debris_panel_l_04 ×138

Dropped on mid: sb_dirtdecals_03 ×2, sb_dirtdecals_01 ×6, decalmesh_hitscorch_01 ×19, sb_dirtdecals_02 ×7, sb_dirtdecals_05 ×13, sb_dirtdecals_06 ×10, sb_dirtdecals_04 ×21, deathstar_debris_m_03 ×8, turretturbolaser_01 ×23, mc80_largenodule_01 ×1, mc80_engine_module_03 ×2, mc80_mainturret ×1, debris_pipe_xl_01 ×12, stardestroyer_hangarsecondary_01 ×1, stardestroyer_detailshulltop_04 ×1, stardestroyer_detailshulltop_01 ×1, debris_sdreactorpipe_s1024_a_01 ×37, stardestroyer_hangarprimary_door_01 ×1, stardestroyer_tractorbeam_01 ×2, mc80_largenodule_04 ×1, mc80_largenodule_05 ×1, stardestroyer_detailshulltop_03 ×1, mc80_largenodule_02 ×1, endor_mine_emissiveoff ×6, debris_pipe_xl_02 ×57, mc80_largenodule_03 ×1, stardestroyer_communicationstower_01 ×1, mc80_nodulehanger_01 ×1, corvettecr90_01 ×2, mc80_engine_module_01 ×1, mc80_engine_module_02 ×2, stardestroyer_hangarprimaryentrance_01 ×1, stardestroyer_detailsside_01_right_b ×1, stardestroyer_detailsside_01_b ×1, mc80_largenodule_06 ×1, stardestroyer_detailsside_03 ×8, stardestroyer_detailsside_07 ×1, stardestroyer_detailsside_07_right ×1, stardestroyer_solarionizationreactor_01 ×1, stardestroyer_detailsside_01_c ×1, stardestroyer_detailsside_01_right_c ×1, deathstar_debris_l_03 ×89, debris_panelpartial_l_01 ×62, debris_panelpartial_l_02 ×73, stardestroyer_detailsside_05 ×1, stardestroyer_detailsside_05_right ×1, endor_engine_targetcollision ×1, stardestroyer_detailsside_01_a ×1, stardestroyer_detailsside_01_right_a ×1, debris_pipe_xl_03 ×93, stardestroyer_detailscommandbridge_03_back ×1, stardestroyer_detailsside_06_right ×1, stardestroyer_detailsside_06 ×1, stardestroyer_detailsside_01_right_e ×1, stardestroyer_detailsside_01_e ×1, stardestroyer_hangarprimary_01 ×1, deathstar_debris_l_04_mirrorx ×114

Dropped on high: sb_dirtdecals_03 ×2, sb_dirtdecals_01 ×6, decalmesh_hitscorch_01 ×19, sb_dirtdecals_02 ×7, sb_dirtdecals_05 ×13, sb_dirtdecals_06 ×10, sb_dirtdecals_04 ×21, deathstar_debris_m_03 ×8, turretturbolaser_01 ×23, stardestroyer_hangarprimary_door_01 ×1, stardestroyer_tractorbeam_01 ×2, stardestroyer_hangarprimaryentrance_01 ×1, stardestroyer_detailsside_01_right_d ×1, stardestroyer_detailsside_01_d ×1, mc80_largenodule_01 ×1, mc80_engine_module_03 ×2, mc80_mainturret ×1, debris_pipe_xl_01 ×12, stardestroyer_detailshulltop_02 ×1, stardestroyer_detailsfront_01 ×1, stardestroyer_hangarsecondary_01 ×1, stardestroyer_detailshulltop_04 ×1, stardestroyer_detailshulltop_01 ×1, debris_sdreactorpipe_s1024_a_01 ×37

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 102 | 13.0 KB | lane R's placed.js |
| actors.json | 0 | 0.1 KB | the scene's life rows |
| vehicles.json | 23 | 3.6 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 296 | 38.1 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 887.7 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): CorvetteCR90_LargeTurretBottom ×3, CorvetteCR90_LargeTurretTop ×3, CorvetteCR90_SmallTurretLeftA ×3, CorvetteCR90_SmallTurretLeftB ×3, CorvetteCR90_SmallTurretRightA ×3, CorvetteCR90_SmallTurretRightB ×3, MC80_SmallGunTurret_AntiFighter ×9, MC80_SmallGunTurret_Heavy ×3, Vehicle_Air_AWingRZ3 ×1, Vehicle_Air_BTLYWing ×1, Vehicle_Air_MillenniumFalcon ×1, Vehicle_Air_N1Starfighter ×1, Vehicle_Air_Scimitar ×1, Vehicle_Air_Slave1 ×1, Vehicle_Air_TieAdvancedX1 ×1, Vehicle_Air_TieBomber ×55, Vehicle_Air_TieFighter ×13, Vehicle_Air_TieFighterFirstOrder ×1, Vehicle_Air_TieInterceptor ×1, Vehicle_Air_VultureDroid ×1, Vehicle_Air_Vwing ×1, Vehicle_Air_XWing_T65 ×13, Vehicle_Air_XWing_T70 ×1, Vehicle_Air_Xwing_Red5 ×1, Vehicle_Air_Xwing_T70BlackOne ×1, Vehicle_Air_YWing ×1. Decals skipped: sub 15. Tracks of owners the pack lacks: 25.

## Variations

Written by `node scripts/bf2017-variations.mjs sb_endor` from the level's 13 mesh variation databases (variations.json, 0.22 MB).

| meshes | with variations | applied by instances | by the level rule | mixed (default drawn) | textures missing from the bucket | maps not in the pack |
|---|---|---|---|---|---|---|
| 210 | 15 | 2 | 0 | 3 | 51 | 0 |

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 170 | 3976 | 226799 | 0 | 10 | 0 | 5098600 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 2,8 | 1936 | 24057 |
| 2,13 | 727 | 7891 |
| 0,13 | 377 | 5026 |
| 5,-7 | 370 | 20493 |
| 3,13 | 329 | 1177 |
| -5,7 | 313 | 21637 |
| 4,11 | 309 | 41095 |
| 4,-7 | 301 | 22567 |
| -6,12 | 284 | 15050 |
| 0,11 | 266 | 38516 |
<!-- /physics -->
