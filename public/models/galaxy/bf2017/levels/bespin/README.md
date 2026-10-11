# bespin: the game's level

From `s2/levels/cloudcity_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s2/levels/cloudcity_01 --world bespin --spot 20 0 --floor 199 --walk 192 --arena 256 --subs CloudCity_01,StreamedLevel`; do not edit by hand.

- 4497 instances in the arena (±256 m), 1222 beyond it (the horizon), no terrain: no ground layer, the instances alone, 16 cells of 128 m
- 380 meshes (1 left out), 1001 LOD files, 24.37 MB
- the far list 0.14 MB; terrain none; the spot's ground 199.00 m in the game
- textures missing from the bucket: 3

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 40 (40 m, 800 m) |
| meshes dropped (instances) | 130 (2042) | 115 (2015) | 36 (367) |
| worst place: triangles, calls | 263k, 356 | 377k, 449 | 675k, 630 |
| texture bytes (every map the level has) | 8.41 MB | 23.24 MB | 23.24 MB |

Dropped on low: clouds_02_lightblocker_01 ×1, controlpanelsmall_02 ×18, railing_02_pole_01 ×8, railing_02_straight_128_01 ×3, sculpturelarge_04 ×1, trashbinsmall_01 ×9, lightceilinglarge_02 ×4, lightwallsmall_02 ×42, railing_02_end_128_01 ×8, ul_wall_01_c90_outer_notrim ×6, wallmountedcomputer_01_a ×19, sculpturelarge_03 ×5, wallpanels_01_a ×12, wallpanels_01_b ×16, ul_trimfloorwall_01_384x32 ×13, sculpturelarge_02 ×2, wallpanels_01_c ×20, lightfloormedium_01 ×18, lightfloorlarge_02 ×4, ul_corridorround_01_s_384_windowcover_01 ×3, clouds_02_building_01_entrancepiece ×1, bench_02 ×12, tableglassmedium_01 ×21, bench_02_b ×10, clouds_02_building_01_platform_02_seamcover_01 ×2, clouds__emissivestrip_01 ×55, railing_02_straight_512_01 ×7, pillar_stairstart_01 ×7, ul_corridorround_01_s_384_windowed_glass ×7, ul_wall_01_256_grunge_lodscale ×1, ul_corridorround_01_i90_384_windowed_short ×2, lightceilinglarge_01_light ×15, wallpanels_01_b ×75, ul_wall_01_128_c ×7, ul_wall_01_64_lowradiosity ×16, door_large_01_b ×9, ul_wall_02_c90_outer ×4, wallpanels_01_c ×99, ul_trimfloorwall_01_768x32 ×22, wallpanels_01_a ×110, ul_wall_01_384_glasspane_pillar ×37, doorcorridor_01 ×22, ul_elevator_01_384_lightpane ×9, sofalarge_01 ×50, lightground_01 ×8, ul_corridorround_01_c90_384 ×4, railing_02_straight_256_01 ×2, deskreception_01 ×1, ul_wall_01_128_b ×13, ul_wall_02_c45_inner_128 ×4, ul_wall_01_128_b_controlpanel ×18, ul_wall_01_c45_inner_128 ×18, ul_wall_01_c45_outer_128 ×12, ul_wall_01_c90_inner ×19, ul_wall_01_64 ×40, ul_corridorround_01_s_384_windowed ×7, ul_doorframetop_01_384 ×38, pedestrianplatform_gangway_1024_endpiece_01 ×6, ul_wall_01_stairscustom_clouds_02 ×1, ul_wall_stairscustom_clouds_02_left ×1, door_large_01 ×30, pedestrianplatform_gangway_1024_clouds_02_f ×3, ul_corridorround_01_s_384_windowed_01 ×8, ul_wall_01_128_grunge_lodscale ×25, ul_wallstairs_left_01_768 ×4, ul_wallstairs_right_01_768 ×4, plantfoundation_05 ×20, ul_wall_01_128_c_grunge ×26, ul_trimfloorwall_01_1536x32 ×16, clouds_02_building_01_entrancefloorceiling_01 ×3, o_kam_beamroom_01 ×24, ul_wall_01_384_notrim ×9, ul_wall_02_128_c ×7, buildingentrancedoorconnector01 ×4, ul_doorframe_02_384_b ×17, sculpturesmall_01 ×2, antennae_01_a ×16, ul_wall_01_384 ×10, ul_wall_01_c90_outer ×68, clouds_02_building_01_entrance_02 ×7, ul_wall_02_c45_outer_128 ×6, structure_01 ×1, ul_pillar_01_128 ×38, railing_01 ×12, sculpturesmall_02 ×8, ul_wall_01_384_glasspane ×16, sculpturesmall_02_physics ×10, sculpturesmall_01_banger ×15, vasesmall_01 ×32, buildingaddonhuge03 ×7, ul_doorframe_01_384 ×33, ul_wall_02_64 ×29, ul_wall_02_384 ×6, clouds_hedge_bushlarge_01 ×15, lightwallsmall_05 ×6, ul_wall_01_128 ×77, clouds_02_building_01_entrance_01 ×3, ul_corridorround_01_s_384_windowed_01_cover ×31, lightceilingsmall_01 ×4, clouds_02_building_01_platform_02_smallstair_01_invert ×1, clouds_02_building_01_platform_02_smallstair_01 ×1, ul_wall_01_256 ×46, ul_doorframeexterior_01_1024x512 ×6, ul_corridorround_01_s_384 ×33, ul_elevator_01_384 ×9, plant_01 ×11, chairwaitinghall_01 ×8, plant_03 ×7, lightpolelarge_01 ×76, clouds_02_building_02_windowglass_01 ×1, ul_doorframeround_01_384 ×47, buildingaddonhuge02 ×5, ul_doorframeexterior_01_1024x768 ×8, ul_wall_02_256 ×28, ul_wall_02_128 ×59, imperialshuttletydirium_01_landmark ×1, pillar_03 ×8, pillar_03 ×8, slave1_landmark ×1, pedestrianplatform_base_lcross_2048 ×1, clouds_02_building_02_window_01 ×1, clouds_02_building_02_entrance_03 ×1, clouds_02_building_02_entrance_01 ×1, clouds_02_building_02_entrance_02 ×1, towerhugesection07_gameplaycollision ×1, towerhugesection07 ×2, towerhugesection18 ×1, towerhugesection11 ×6, towerhugesection02 ×6, clouds_02_building_02_bottom_01 ×1

Dropped on mid: clouds_02_lightblocker_01 ×1, controlpanelsmall_02 ×18, railing_02_pole_01 ×8, railing_02_straight_128_01 ×3, sculpturelarge_04 ×1, trashbinsmall_01 ×9, lightceilinglarge_02 ×4, lightwallsmall_02 ×42, railing_02_straight_256_01 ×2, clouds_02_building_01_platform_02_seamcover_01 ×2, railing_02_end_128_01 ×8, deskreception_01 ×1, ul_wall_01_c90_outer_notrim ×6, sculpturelarge_03 ×5, wallpanels_01_a ×12, wallpanels_01_b ×16, ul_trimfloorwall_01_384x32 ×13, sculpturelarge_02 ×2, wallpanels_01_c ×20, ul_wall_01_256_grunge_lodscale ×1, lightfloormedium_01 ×18, chairwaitinghall_01 ×8, wallmountedcomputer_01_a ×19, lightfloorlarge_02 ×4, ul_corridorround_01_s_384_windowcover_01 ×3, clouds_02_building_01_entrancepiece ×1, bench_02 ×12, tableglassmedium_01 ×21, bench_02_b ×10, clouds__emissivestrip_01 ×55, railing_02_straight_512_01 ×7, wallpanels_01_c_flat_grunge ×1, ul_corridorround_01_s_384_windowed_glass ×7, ul_corridorround_01_i90_384_windowed_short ×2, lightceilinglarge_01_light ×15, wallpanels_01_b ×75, door_large_01_b ×9, ul_wall_01_128_c ×7, ul_wall_01_64_lowradiosity ×16, wallpanels_01_a_flat_grunge ×1, pillar_stairstart_01 ×7, ul_wall_02_c90_outer ×4, wallpanels_01_c ×99, wallpanels_01_b_grunge ×25, ul_trimfloorwall_01_768x32 ×22, wallpanels_01_a ×110, wallpanels_01_c_grunge ×37, ul_wall_01_384_glasspane_pillar ×37, doorcorridor_01 ×22, ul_elevator_01_384_lightpane ×9, sofalarge_01 ×50, ul_corridorround_01_c90_384 ×4, ul_wall_01_128_b ×13, ul_wall_02_c45_inner_128 ×4, ul_wall_01_128_b_controlpanel ×18, wallpanels_01_a_grunge ×38, ul_wallstairs_01_768_middle ×4, ul_wall_01_c45_inner_128 ×18, ul_wall_01_c45_outer_128 ×12, ul_wall_01_c90_inner ×19, ul_wall_01_64 ×40, ul_corridorround_01_s_384_windowed ×7, ul_doorframetop_01_384 ×38, pedestrianplatform_gangway_1024_endpiece_01 ×6, ul_wall_01_stairscustom_clouds_02 ×1, ul_wall_stairscustom_clouds_02_left ×1, door_large_01 ×30, pedestrianplatform_gangway_1024_clouds_02_f ×3, ul_corridorround_01_s_384_windowed_01 ×8, ul_wall_01_128_grunge_lodscale ×25, ul_wallstairs_left_01_768 ×4, ul_wallstairs_right_01_768 ×4, ul_wall_01_128_c_grunge ×26, ul_trimfloorwall_01_1536x32 ×16, clouds_02_building_01_entrancefloorceiling_01 ×3, ul_wall_01_384_notrim ×9, ul_wall_02_128_c ×7, buildingentrancedoorconnector01 ×4, ul_doorframe_02_384_b ×17, ul_wall_01_384 ×10, ul_wall_01_c90_outer ×68, clouds_02_building_01_entrance_02 ×7, ul_wall_02_c45_outer_128 ×6, structure_01 ×1, ul_pillar_01_128 ×38, buildingaddonhuge02 ×1, railing_01 ×12, ul_wall_01_384_glasspane ×16, buildingaddonhuge03 ×7, ul_doorframe_01_384 ×33, ul_wall_02_64 ×29, ul_wall_02_384 ×6, clouds_hedge_bushlarge_01 ×15, ul_wall_01_128 ×77, clouds_02_building_01_entrance_01 ×3, ul_corridorround_01_s_384_windowed_01_cover ×31, clouds_02_building_01_platform_02_smallstair_01_invert ×1, clouds_02_building_01_platform_02_smallstair_01 ×1, ul_wall_01_256 ×46, ul_doorframeexterior_01_1024x512 ×6, ul_corridorround_01_s_384 ×33, ul_elevator_01_384 ×9, sculpturesmall_01 ×2, sculpturesmall_02 ×8, sculpturesmall_02_physics ×10, sculpturesmall_01_banger ×15, plaza_wall_a_large_1024x128_01 ×28, lightpolelarge_01 ×76, clouds_02_building_02_windowglass_01 ×1, ul_doorframeround_01_384 ×47, buildingaddonhuge02 ×5, ul_doorframeexterior_01_1024x768 ×8, ul_wall_02_256 ×28, pillar_01 ×6, ul_wall_02_128 ×59

Dropped on high: clouds_02_lightblocker_01 ×1, controlpanelsmall_02 ×18, railing_02_pole_01 ×8, plant_01 ×11, plant_03 ×7, railing_02_straight_128_01 ×3, clouds_ferntongue_01_a ×12, sculpturelarge_04 ×1, trashbinsmall_01 ×9, lightceilinglarge_02 ×4, lightwallsmall_02 ×42, railing_02_straight_256_01 ×2, clouds_02_building_01_platform_02_seamcover_01 ×2, railing_02_end_128_01 ×8, deskreception_01 ×1, ul_wall_01_c90_outer_notrim ×6, sculpturelarge_03 ×5, wallpanels_01_a ×12, wallpanels_01_b ×16, ul_trimfloorwall_01_384x32 ×13, pillar_stairstart_01 ×7, sculpturelarge_02 ×2, wallpanels_01_c ×20, ul_wall_01_256_grunge_lodscale ×1, lightfloormedium_01 ×18, chairwaitinghall_01 ×8, wallmountedcomputer_01_a ×19, lightfloorlarge_02 ×4, ul_corridorround_01_s_384_windowcover_01 ×3, clouds_02_building_01_entrancepiece ×1, bench_02 ×12, tableglassmedium_01 ×21, bench_02_b ×10, wallpanels_01_c_flat_grunge ×1, ul_wallstairs_01_768_middle ×4, clouds__emissivestrip_01 ×55

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 293 | 35.5 KB | lane R's placed.js |
| actors.json | 0 | 0.1 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 62 | 9.3 KB | fidelity X (nothing until it merges) |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 42 | 4054.2 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 839.9 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): none. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 338 | 5042 | 125115 | 80 | 4 | 0 | 3244992 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -1,-1 | 4673 | 120834 |
| -1,0 | 3046 | 101137 |
| 0,-1 | 2639 | 85115 |
| 0,0 | 1023 | 20012 |
| -1,1 | 902 | 50927 |
| 1,1 | 489 | 9901 |
| -2,-2 | 418 | 0 |
| 0,-2 | 413 | 9947 |
| 1,-2 | 390 | 5836 |
| -2,0 | 316 | 11491 |
<!-- /physics -->
